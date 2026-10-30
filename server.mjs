import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {createAnalytics} from './analytics.mjs';
import {selectRelevantProducts} from './relevance.mjs';
import {curatedProducts,matchingCuratedProducts} from './curated-products.mjs';
import {getSearchPlan,uniqueProductResults} from './search-plan.mjs';
import {verifyProductBatchWithMeta} from './merchant-offers.mjs';
import {removeClearlyUnavailable} from './availability-labels.mjs';
import {createBestFeedCache} from './best-feed-cache.mjs';
import {interleaveSearchMerchants,merchantCount} from './merchant-diversity.mjs';
import {filterCatalogProducts,inStorefrontCatalog} from './catalog-policy.mjs';
import {catalogEnabled,catalogStatus,CATALOG_CATEGORIES} from './catalog-core.mjs';
import {catalogPage} from './catalog-store.mjs';
const page = (await import('node:fs/promises')).readFile(new URL('./index.html',import.meta.url),'utf8');
const adminPage=(await import('node:fs/promises')).readFile(new URL('./admin.html',import.meta.url),'utf8');
const analytics=createAnalytics();
const trackHits=[];
const TRACK_LIMIT=120;
function isAdmin(req){
 const secret=process.env.ALTTUL_ADMIN_TOKEN||'';
 const supplied=String(req.headers.authorization||'');
 if(secret.length<32||!supplied.startsWith('Bearer '))return false;
 const offered=supplied.slice(7);
 if(offered.length<32||offered.length>256)return false;
 const storedHash=createHash('sha256').update(secret).digest();
 const suppliedHash=createHash('sha256').update(offered).digest();
 return timingSafeEqual(storedHash,suppliedHash);
}
function allowedOrigin(req){
 const origin=req.headers.origin;
 // Same-origin sendBeacon POSTs include the page origin.
 if(typeof origin!=='string')return false;
 try{
  const parsed=new URL(origin);
  const host=String(req.headers.host||'');
  return origin==='https://alttulpick-shop.onrender.com'||(parsed.host===host&&(parsed.protocol==='https:'||parsed.protocol==='http:'));
 }catch{return false}
}
async function readSmallJson(req){
 let content='';
 for await (const chunk of req){
  content+=chunk.toString('utf8');
  if(content.length>900)throw Error('too large');
 }
 return JSON.parse(content);
}

const TIME_WINDOW=60000, MAX_CALLS=8, hits=[];
const bestFeedCache=createBestFeedCache();
// Only successful, verified public search results; short-lived, bounded and never persisted.
const searchFeedCache=createBestFeedCache({freshMs:90000,staleMs:180000,maxEntries:80});
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};
const server=createServer(async(req,res)=>{
const url=new URL(req.url||'/', 'http://localhost');
// Browser access is limited to the separate, public Alttulpick storefront.
const storefrontOrigin='https://alttulpick-shop.onrender.com';
if(req.headers.origin===storefrontOrigin && url.pathname.startsWith('/api/')){
 res.setHeader('Access-Control-Allow-Origin',storefrontOrigin);
 res.setHeader('Vary','Origin');
}
if(req.method==='OPTIONS'&&url.pathname.startsWith('/api/')){
 if(req.headers.origin!==storefrontOrigin){res.writeHead(403);res.end();return}
 res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});
 res.end();return;
}
if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){
 analytics.pageView();
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(await page);return;
}
if(req.method==='GET'&&(url.pathname==='/admin'||url.pathname==='/admin/')){
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'});
 res.end(await adminPage);return;
}
if(req.method==='GET'&&url.pathname==='/api/admin/summary'){
 if(!isAdmin(req)){send(res,401,{success:false,message:'Unauthorized'});return}
 send(res,200,analytics.snapshot());return;
}
if(req.method==='POST'&&url.pathname==='/api/telemetry'){
 if(!allowedOrigin(req)||!String(req.headers['content-type']||'').startsWith('application/json')){
  send(res,403,{success:false});return;
 }
 const now=Date.now();while(trackHits.length&&now-trackHits[0]>60000)trackHits.shift();
 if(trackHits.length>=TRACK_LIMIT){send(res,429,{success:false});return}
 trackHits.push(now);
 try{
  const body=await readSmallJson(req);
  if(body?.event!=='product_click'||typeof body?.merchant!=='string'||body.merchant.length>80){
   send(res,400,{success:false});return;
  }
  analytics.click(body.merchant);
  send(res,200,{success:true});return;
 }catch{send(res,400,{success:false});return}
}
if(!url.pathname.startsWith('/api/')){res.writeHead(404);res.end('Not found');return}
if(req.method!=='GET'){send(res,405,{success:false,message:'GET only'});return}
if(url.pathname==='/api/catalog/status'){
 send(res,200,catalogStatus());
 return;
}
if(url.pathname==='/api/catalog'){
 // Never persist API-derived products without the separately licensed feed contract.
 if(!catalogEnabled()){send(res,503,{success:false,code:'CATALOG_NOT_CONFIGURED',message:'상품 데이터 이용 승인 및 영구 DB 연결이 필요합니다'});return}
 const category=url.searchParams.get('category')||'food';
 const limit=Number(url.searchParams.get('limit')||24),offset=Number(url.searchParams.get('offset')||0);
 if(!CATALOG_CATEGORIES.includes(category)||!Number.isInteger(limit)||limit<1||limit>48||
  !Number.isInteger(offset)||offset<0||offset>5000){
  send(res,400,{success:false,code:'CATALOG_BAD_QUERY'});return;
 }
 try{send(res,200,await catalogPage(process.env.CATALOG_DATABASE_URL,{category,limit,offset}))}
 catch{send(res,503,{success:false,code:'CATALOG_DATABASE_UNAVAILABLE',message:'상품 카탈로그 DB 연결을 확인해 주세요'})}
 return;
}
if(url.pathname==='/api/curated'){
  send(res,200,{success:true,data:curatedProducts().filter(inStorefrontCatalog)});
  return;
}
let endpoint,params={},plan=null,requested=1;
if(url.pathname==='/api/best'){
const area=url.searchParams.get('area')||'today';const n=Number(url.searchParams.get('limit')||10);
if(!['today','popular','pick'].includes(area)||!Number.isInteger(n)||n<1||n>10){send(res,400,{success:false,message:'요청값이 올바르지 않습니다'});return}
endpoint='best';params={area,limit:String(n)}
}else if(url.pathname==='/api/search'){
const q=(url.searchParams.get('q')||'').trim();
const n=Number(url.searchParams.get('limit')||30);
const batch=Number(url.searchParams.get('batch')||0);
if(q.length<2||q.length>60||!Number.isInteger(n)||n<1||n>30||!Number.isInteger(batch)||batch<0||batch>2){
 send(res,400,{success:false,message:'요청값이 올바르지 않습니다'});return
}
plan=getSearchPlan(q,batch);
if(!plan.terms.length){send(res,400,{success:false,message:'더 검색할 연관 품목이 없습니다'});return}
endpoint='search';params={q,limit:String(Math.min(n,20))};requested=n;
if(plan.codes)params.cp_code=plan.codes.join(',');
}else{send(res,404,{success:false,message:'Unknown route'});return}
const key=process.env.ADPICK_API_KEY;if(!key){send(res,503,{success:false,code:'API_NOT_CONFIGURED',message:'데모 모드'});return}
const apiBase='https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/';
async function fetchAffiliate(action,searchParams){
 const upstream=new URL(apiBase+action);
 for(const[k,v]of Object.entries(searchParams))upstream.searchParams.set(k,String(v));
 const response=await fetch(upstream,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw Error('UPSTREAM_HTTP_'+response.status);
 const data=await response.json();
 if(data?.success!==true)throw Error('UPSTREAM_DATA');
 return data;
}
async function loadBestPayload(){
 const data=await fetchAffiliate('best',params);
 const list=Array.isArray(data.data)?data.data:Array.isArray(data.data?.list)?data.data.list:null;
 if(!list)throw Error('UPSTREAM_SHAPE');
 const sourceFiltered=removeClearlyUnavailable(list);
 const catalog=filterCatalogProducts(sourceFiltered.items);
 const {items:checked,verification}=await verifyProductBatchWithMeta(catalog.items);
 const result=Array.isArray(data.data)?checked:{...data.data,list:checked};
 return {...data,data:result,filter_meta:{verification,explicitly_unavailable_removed:sourceFiltered.removed,out_of_catalog_removed:catalog.removed}};
}
const cacheKey=endpoint==='best'?params.area+'|'+params.limit:null;
const cached=cacheKey?bestFeedCache.peek(cacheKey):null;
const searchKey=endpoint==='search'?params.q.normalize('NFKC').trim()+'|'+plan.batch+'|'+requested:null;
const cachedSearch=searchKey?searchFeedCache.peek(searchKey):null;
if(cachedSearch){send(res,200,cachedSearch.stale?searchFeedCache.stalePayload(cachedSearch):cachedSearch.payload);return}
if(cached&&!cached.stale){send(res,200,cached.payload);return}
const searchInFlight=searchKey?searchFeedCache.pending(searchKey):null;
if(searchInFlight){
 try{send(res,200,await searchInFlight)}
 catch{send(res,502,{success:false,message:'제휴사 검색 응답 지연'})}
 return;
}
const inFlight=cacheKey?bestFeedCache.pending(cacheKey):null;
const now=Date.now();while(hits.length&&now-hits[0]>TIME_WINDOW)hits.shift();
const remaining=MAX_CALLS-hits.length;
if(cached){
 // Even while one background refresh is running, return stale products immediately.
 // The short-lived stale response is clearly labeled and only for previously verified feeds.
 if(!inFlight&&remaining>0){hits.push(now);void bestFeedCache.load(cacheKey,loadBestPayload).catch(()=>{});}
 send(res,200,bestFeedCache.stalePayload(cached));return;
}
if(inFlight){
 try{send(res,200,await inFlight)}
 catch{send(res,502,{success:false,message:'제휴사 연결 실패'});}
 return;
}
if(remaining<1){
 const retry=Math.max(1,Math.ceil((TIME_WINDOW-(now-hits[0]))/1000));
 res.setHeader('Retry-After',String(retry));
 send(res,429,{success:false,code:'SEARCH_QUOTA_COOLDOWN',retry_after_seconds:retry,message:'검색 요청이 몰렸습니다. 잠시 후 다시 조회해 주세요'});
 return;
}
// If the remaining API quota only permits one call, preserve the core keyword search.
const activeTerms=endpoint==='search'?plan.terms.slice(0,remaining):[];
const callCount=endpoint==='search'?activeTerms.length:1;
for(let i=0;i<callCount;i++)hits.push(now);

try{
 if(endpoint==='search'){
   const searchPayload=await searchFeedCache.load(searchKey,async()=>{
   // One bounded follow-up keyword for broad categories, never an unbounded crawler.
   const requests=activeTerms.map(term=>fetchAffiliate('search',{...params,q:term}));
   const batches=await Promise.allSettled(requests);
   const successes=batches.filter(batch=>batch.status==='fulfilled').map(batch=>batch.value).filter(data=>Array.isArray(data.data)||Array.isArray(data.data?.list));
   if(!successes.length)throw Error('UPSTREAM_SEARCH_UNAVAILABLE');
   const incoming=successes.flatMap(data=>Array.isArray(data.data)?data.data:(Array.isArray(data.data?.list)?data.data.list:[]));
   const allowed=plan.codes?new Set(plan.codes):null;
   const scoped=allowed?incoming.filter(item=>allowed.has(String(item?.cp_code||'').toLowerCase())):incoming;
   const matched=selectRelevantProducts(params.q,scoped);
   const distinct=uniqueProductResults(matched);
   const curated=plan.batch===0?matchingCuratedProducts(params.q):[];
   const sourceFiltered=removeClearlyUnavailable(uniqueProductResults([...curated,...distinct]));
   const catalog=filterCatalogProducts(sourceFiltered.items);
   const balanced=interleaveSearchMerchants(catalog.items);
   const {items:combined,verification}=await verifyProductBatchWithMeta(balanced.slice(0,requested));
   analytics.search(params.q,combined.length);
   const original=successes[0];
   const filteredData=Array.isArray(original.data)?combined:{...original.data,list:combined};
   return {...original,data:filteredData,filter_meta:{
     received:incoming.length,matched:combined.length,excluded:incoming.length-matched.length,
     duplicates_removed:matched.length-distinct.length,stores_restricted:Boolean(allowed),
     merchants_count:merchantCount(combined),
     queries_checked:successes.length,queries_requested:activeTerms.length,
     batch:plan.batch,total_batches:plan.totalBatches,
     has_more:plan.batch+1<plan.totalBatches,
     quota_limited:activeTerms.length<plan.terms.length,verification,
     explicitly_unavailable_removed:sourceFiltered.removed,
     out_of_catalog_removed:catalog.removed
   }};
   });
   send(res,200,searchPayload);
   return;
 }
 const payload=await bestFeedCache.load(cacheKey,loadBestPayload);
 send(res,200,payload);
}catch{send(res,502,{success:false,message:'제휴사 연결 실패'})}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>{
 console.log('알뜰픽 서버가 시작됐습니다');
 // One nonblocking health probe per cold start; no affiliate requests or user data.
 // This tells us whether the free Cloudflare origin has actually deployed the edge cache.
 void fetch('https://alttulpick-api.maidana1779.workers.dev/health',{
  signal:AbortSignal.timeout(4500)
 }).then(async response=>{
  const data=await response.json().catch(()=>null);
  console.log('[edge-health] status='+response.status+
   ' revision='+String(data?.revision||'unidentified').slice(0,80)+
   ' adpick_binding='+String(data?.adpick_binding||'not-reported').slice(0,30));
 }).catch(err=>console.log('[edge-health] unavailable '+String(err?.name||'error').slice(0,60)));
});

