import {createServer} from 'node:http';
import {selectRelevantProducts,isGroceryQuery} from './relevance.mjs';
import {curatedProducts,matchingCuratedProducts} from './curated-products.mjs';
import {getSearchPlan,uniqueProductResults} from './search-plan.mjs';
const page = (await import('node:fs/promises')).readFile(new URL('./index.html',import.meta.url),'utf8');
const TIME_WINDOW=60000, MAX_CALLS=8, hits=[];
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};
const server=createServer(async(req,res)=>{
const url=new URL(req.url||'/', 'http://localhost');
if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await page);return}
if(!url.pathname.startsWith('/api/')){res.writeHead(404);res.end('Not found');return}
if(req.method!=='GET'){send(res,405,{success:false,message:'GET only'});return}
if(url.pathname==='/api/curated'){
  send(res,200,{success:true,data:curatedProducts()});
  return;
}
let endpoint,params={},plan=null,requested=1;
if(url.pathname==='/api/best'){
const area=url.searchParams.get('area')||'today';const n=Number(url.searchParams.get('limit')||10);
if(!['today','popular','pick','commission'].includes(area)||!Number.isInteger(n)||n<1||n>10){send(res,400,{success:false,message:'요청값이 올바르지 않습니다'});return}
endpoint='best';params={area,limit:String(n)}
}else if(url.pathname==='/api/search'){
const q=(url.searchParams.get('q')||'').trim(),n=Number(url.searchParams.get('limit')||30);
if(q.length<2||q.length>60||!Number.isInteger(n)||n<1||n>30){send(res,400,{success:false,message:'요청값이 올바르지 않습니다'});return}
endpoint='search';params={q,limit:String(Math.min(n,20))};requested=n;
plan=getSearchPlan(q);
if(plan.codes)params.cp_code=plan.codes.join(',');
}else{send(res,404,{success:false,message:'Unknown route'});return}
const key=process.env.ADPICK_API_KEY;if(!key){send(res,503,{success:false,code:'API_NOT_CONFIGURED',message:'데모 모드'});return}
const now=Date.now();while(hits.length&&now-hits[0]>TIME_WINDOW)hits.shift();
const remaining=MAX_CALLS-hits.length;
if(remaining<1){send(res,429,{success:false,message:'잠시 후 다시 시도해 주세요'});return}
// If the remaining API quota only permits one call, preserve the core keyword search.
const activeTerms=endpoint==='search'?plan.terms.slice(0,remaining):[];
const callCount=endpoint==='search'?activeTerms.length:1;
for(let i=0;i<callCount;i++)hits.push(now);
const apiBase='https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/';
const fetchAffiliate=async(action,searchParams)=>{
 const upstream=new URL(apiBase+action);
 for(const[k,v]of Object.entries(searchParams))upstream.searchParams.set(k,String(v));
 const response=await fetch(upstream,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw Error('UPSTREAM_HTTP_'+response.status);
 const data=await response.json();
 if(data?.success!==true)throw Error('UPSTREAM_DATA');
 return data;
};
try{
 if(endpoint==='search'){
   // One bounded follow-up keyword for broad categories, never an unbounded crawler.
   const requests=activeTerms.map(term=>fetchAffiliate('search',{...params,q:term}));
   const batches=await Promise.allSettled(requests);
   const successes=batches.filter(batch=>batch.status==='fulfilled').map(batch=>batch.value);
   if(!successes.length){send(res,502,{success:false,message:'제휴사 검색 응답을 받지 못했습니다'});return}
   const incoming=successes.flatMap(data=>Array.isArray(data.data)?data.data:(Array.isArray(data.data?.list)?data.data.list:[]));
   const allowed=plan.codes?new Set(plan.codes):null;
   const scoped=allowed?incoming.filter(item=>allowed.has(String(item?.cp_code||'').toLowerCase())):incoming;
   const matched=selectRelevantProducts(params.q,scoped);
   const distinct=uniqueProductResults(matched);
   const combined=uniqueProductResults([...matchingCuratedProducts(params.q),...distinct]).slice(0,requested);
   const original=successes[0];
   const filteredData=Array.isArray(original.data)?combined:{...original.data,list:combined};
   send(res,200,{...original,data:filteredData,filter_meta:{
     received:incoming.length,matched:combined.length,excluded:incoming.length-matched.length,
     duplicates_removed:matched.length-distinct.length,stores_restricted:Boolean(allowed),
     queries_checked:successes.length,queries_requested:activeTerms.length
   }});
   return;
 }
 const data=await fetchAffiliate('best',params);
 send(res,200,data);
}catch{send(res,502,{success:false,message:'제휴사 연결 실패'})}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('알뜰픽 서버가 시작됐습니다'));
// Temporary supplier diagnostics: four bounded API queries, no product titles or links
// written to logs. Remove after collecting a baseline.
server.on('listening',async()=>{
 const key=process.env.ADPICK_API_KEY;
 if(!key)return;
 const selections=['세제','세탁세제','커피','생수'];
 for(const q of selections){
  const p=getSearchPlan(q),upstream=new URL('https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/search');
  upstream.searchParams.set('q',q);
  upstream.searchParams.set('limit','20');
  if(p.codes)upstream.searchParams.set('cp_code',p.codes.join(','));
  try{
   const response=await fetch(upstream,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
   const body=await response.json().catch(()=>null);
   const incoming=Array.isArray(body?.data)?body.data:(Array.isArray(body?.data?.list)?body.data.list:[]);
   const scoped=p.codes?incoming.filter(item=>p.codes.includes(String(item?.cp_code||'').toLowerCase())):incoming;
   const matched=selectRelevantProducts(q,scoped);
   console.log('[SEARCH BASELINE] '+JSON.stringify({q,status:response.status,success:body?.success===true,received:incoming.length,allowed:scoped.length,relevant:matched.length,reason:body?.error_code||null}));
   if(response.status===429)break;
  }catch{console.log('[SEARCH BASELINE] '+JSON.stringify({q,error:'unavailable'}));}
 }
});
