import {selectRelevantProducts} from '../relevance.mjs';
import {curatedProducts,matchingCuratedProducts} from '../curated-products.mjs';
import {getSearchPlan,uniqueProductResults} from '../search-plan.mjs';
import {removeClearlyUnavailable} from '../availability-labels.mjs';
import {verifyProductBatchWithMeta} from '../merchant-offers.mjs';

const ORIGINS=new Set(['https://alttulpick-shop.onrender.com']);
const MAX_CALLS=8,WINDOW=60000;
let hits=[];
// Anonymous public product response cache: 3-minute fresh best feed, then up to
// 15-minute stale fallback while background refresh runs. Never cache errors or secrets.
const productCache=new Map(), refreshing=new Set(), MAX_CACHE=120;
const BEST_FRESH_SECONDS=180, BEST_STALE_SECONDS=900, SEARCH_CACHE_SECONDS=60;
function productCacheKey(url){
 return "https://alttulpick-api.maidana1779.workers.dev/__response_cache"+url.pathname+url.search;
}
function cachedProductPayload(payload,savedAt,status){
 if(status!=="stale")return payload;
 return {...payload,filter_meta:{...(payload.filter_meta||{}),
  cache_status:"stale",cache_age_seconds:Math.max(0,Math.floor((Date.now()-savedAt)/1000))}};
}
async function lookupCached(url){
 const key=productCacheKey(url),now=Date.now();
 const found=productCache.get(key);
 if(found&&found.staleUntil>now){
  return {payload:found.payload,savedAt:found.savedAt,
   stale:found.freshUntil<=now};
 }
 if(found)productCache.delete(key);
 try{
  if(typeof caches!=="undefined"&&caches.default){
   const response=await caches.default.match(new Request(key));
   if(response?.ok){
    const savedAt=Number(response.headers.get("x-alttulpick-saved-at")||0);
    const freshSeconds=Number(response.headers.get("x-alttulpick-fresh-seconds")||0);
    const staleSeconds=Number(response.headers.get("x-alttulpick-stale-seconds")||0);
    const payload=await response.json();
    if(payload?.success===true&&savedAt>0&&savedAt<=now&&
       staleSeconds>0&&now-savedAt<staleSeconds*1000){
     const record={payload,savedAt,freshUntil:savedAt+freshSeconds*1000,
      staleUntil:savedAt+staleSeconds*1000};
     productCache.set(key,record);
     return {payload,savedAt,stale:now>=record.freshUntil};
    }
   }
  }
 }catch{/* Cache is optional on development runtimes and some data centers. */}
 return null;
}
function rememberCached(url,payload,freshSeconds,ctx,staleSeconds=freshSeconds){
 if(!payload||payload.success!==true)return;
 const key=productCacheKey(url),savedAt=Date.now();
 if(productCache.size>=MAX_CACHE)productCache.delete(productCache.keys().next().value);
 productCache.set(key,{payload,savedAt,freshUntil:savedAt+freshSeconds*1000,
  staleUntil:savedAt+staleSeconds*1000});
 try{
  if(ctx?.waitUntil&&typeof caches!=="undefined"&&caches.default){
   const saved=new Response(JSON.stringify(payload),{
    headers:{"content-type":"application/json; charset=utf-8",
     "cache-control":"public, max-age="+staleSeconds,
     "x-alttulpick-saved-at":String(savedAt),
     "x-alttulpick-fresh-seconds":String(freshSeconds),
     "x-alttulpick-stale-seconds":String(staleSeconds)}
   });
   ctx.waitUntil(caches.default.put(new Request(key),saved).catch(()=>{}));
  }
 }catch{/* A cache failure must never break a customer request. */}
}
function json(data,status=200,origin=''){
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff'};
 if(ORIGINS.has(origin)){headers['access-control-allow-origin']=origin;headers.vary='Origin'}
 return new Response(JSON.stringify(data),{status,headers});
}
async function fetchBIZ(key,route,params){
 const u=new URL('https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/'+route);
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
 const response=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw Error('UPSTREAM_HTTP_'+response.status);
 const body=await response.json();
 if(body?.success!==true)throw Error('UPSTREAM_DATA');
 return body;
}
async function bestPayload(key,area,n){
 const data=await fetchBIZ(key,'best',{area,limit:n});
 const list=Array.isArray(data.data)?data.data:Array.isArray(data.data?.list)?data.data.list:null;
 if(!list)return data;
 const sourceFiltered=removeClearlyUnavailable(list);
 const {items,verification}=await verifyProductBatchWithMeta(sourceFiltered.items);
 return {...data,data:Array.isArray(data.data)?items:{...data.data,list:items},
  filter_meta:{verification,explicitly_unavailable_removed:sourceFiltered.removed}};
}
export async function workerFetch(request,env={},ctx={}){
 const u=new URL(request.url),origin=request.headers.get('origin')||'';
 const path=u.pathname;
 if(request.method==='OPTIONS'&&path.startsWith('/api/')){
  if(!ORIGINS.has(origin))return new Response(null,{status:403});
  return new Response(null,{status:204,headers:{
   'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS',
   'access-control-allow-headers':'Content-Type','access-control-max-age':'600','vary':'Origin'
  }});
 }
 if(path==='/health'&&request.method==='GET')return json({status:'ok',runtime:'cloudflare-worker',revision:'edge-best-cache-v2-20261025',best_fresh_seconds:BEST_FRESH_SECONDS,best_stale_seconds:BEST_STALE_SECONDS},200,origin);
 if(path==='/api/telemetry'&&request.method==='POST'){
  if(!ORIGINS.has(origin)||!(request.headers.get('content-type')||'').startsWith('application/json'))return json({success:false},403,origin);
  try{
   if(Number(request.headers.get('content-length')||0)>900)return json({success:false},413,origin);
   const body=await request.text();
   if(body.length>900)return json({success:false},413,origin);
   const event=JSON.parse(body);
   if(event?.event!=='product_click'||typeof event.merchant!=='string'||event.merchant.length>80)return json({success:false},400,origin);
   // No visitor identifier, persistent store or third-party telemetry.
   return json({success:true},200,origin);
  }catch{return json({success:false},400,origin)}
 }
 if(!['/api/best','/api/search','/api/curated'].includes(path))return json({success:false,message:'Not found'},404,origin);
 if(request.method!=='GET')return json({success:false,message:'GET only'},405,origin);
 if(path==='/api/curated')return json({success:true,data:curatedProducts()},200,origin);
 const key=env.ADPICK_API_KEY;
 if(!key)return json({success:false,code:'API_NOT_CONFIGURED',message:'API key not configured'},503,origin);
 // Serve successful public feeds from free Worker edge cache, without touching BIZ.
 // On stale best results, return immediately and refresh asynchronously when quota permits.
 const cached=u.search.length<=350?await lookupCached(u):null;
 const now=Date.now();
 hits=hits.filter(t=>now-t<WINDOW);
 if(cached){
  if(cached.stale&&path==='/api/best'&&ctx?.waitUntil){
   const area=u.searchParams.get('area')||'today',n=Number(u.searchParams.get('limit')||10);
   const cacheKey=productCacheKey(u);
   if(['today','popular','pick'].includes(area)&&Number.isInteger(n)&&n>=1&&n<=10&&
      hits.length<MAX_CALLS&&!refreshing.has(cacheKey)){
    hits.push(now);
    refreshing.add(cacheKey);
    ctx.waitUntil(bestPayload(key,area,n)
     .then(payload=>rememberCached(u,payload,BEST_FRESH_SECONDS,ctx,BEST_STALE_SECONDS))
     .catch(()=>{})
     .finally(()=>refreshing.delete(cacheKey)));
   }
  }
  return json(cachedProductPayload(cached.payload,cached.savedAt,cached.stale?'stale':'fresh'),200,origin);
 }
 if(hits.length>=MAX_CALLS)return json({success:false,message:'잠시 후 다시 시도해 주세요'},429,origin);
 try{
  if(path==='/api/best'){
   const area=u.searchParams.get('area')||'today', n=Number(u.searchParams.get('limit')||10);
   if(!['today','popular','pick'].includes(area)||!Number.isInteger(n)||n<1||n>10)
    return json({success:false,message:'요청값이 올바르지 않습니다'},400,origin);
   hits.push(now);
   const payload=await bestPayload(key,area,n);
   rememberCached(u,payload,BEST_FRESH_SECONDS,ctx,BEST_STALE_SECONDS);
   return json(payload,200,origin);
  }
  const q=(u.searchParams.get('q')||'').trim(),n=Number(u.searchParams.get('limit')||30),batch=Number(u.searchParams.get('batch')||0);
  if(q.length<2||q.length>60||!Number.isInteger(n)||n<1||n>30||!Number.isInteger(batch)||batch<0||batch>2)
   return json({success:false,message:'요청값이 올바르지 않습니다'},400,origin);
  const plan=getSearchPlan(q,batch);
  if(!plan.terms.length)return json({success:false,message:'더 검색할 연관 품목이 없습니다'},400,origin);
  const active=plan.terms.slice(0,MAX_CALLS-hits.length);
  if(!active.length)return json({success:false,message:'잠시 후 다시 시도해 주세요'},429,origin);
  for(let i=0;i<active.length;i++)hits.push(now);
  const params={q,limit:String(Math.min(n,20))};
  if(plan.codes)params.cp_code=plan.codes.join(',');
  const settled=await Promise.allSettled(active.map(term=>fetchBIZ(key,'search',{...params,q:term})));
  const successes=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);
  if(!successes.length)return json({success:false,message:'제휴사 검색 응답을 받지 못했습니다'},502,origin);
  const incoming=successes.flatMap(data=>Array.isArray(data.data)?data.data:Array.isArray(data.data?.list)?data.data.list:[]);
  const allowed=plan.codes?new Set(plan.codes):null;
  const scoped=allowed?incoming.filter(item=>allowed.has(String(item?.cp_code||'').toLowerCase())):incoming;
  const matched=selectRelevantProducts(q,scoped);
  const distinct=uniqueProductResults(matched);
  const curated=plan.batch===0?matchingCuratedProducts(q):[];
  const sourceFiltered=removeClearlyUnavailable(uniqueProductResults([...curated,...distinct]));
  const {items,verification}=await verifyProductBatchWithMeta(sourceFiltered.items.slice(0,n));
  const original=successes[0];
  const payload={...original,data:Array.isArray(original.data)?items:{...original.data,list:items},filter_meta:{
   received:incoming.length,matched:items.length,excluded:incoming.length-matched.length,
   duplicates_removed:matched.length-distinct.length,stores_restricted:Boolean(allowed),
   queries_checked:successes.length,queries_requested:active.length,batch:plan.batch,
   total_batches:plan.totalBatches,has_more:plan.batch+1<plan.totalBatches,
   quota_limited:active.length<plan.terms.length,verification,
   explicitly_unavailable_removed:sourceFiltered.removed
  }};
  rememberCached(u,payload,SEARCH_CACHE_SECONDS,ctx);
  return json(payload,200,origin);
 }catch{return json({success:false,message:'제휴사 연결 실패'},502,origin)}
}
export default {fetch:workerFetch};
