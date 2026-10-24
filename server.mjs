import {createServer} from 'node:http';
import {selectRelevantProducts,isGroceryQuery} from './relevance.mjs';
// Confirmed search-capable Adpick retailers on 2026-10-24; food queries use a curated five-mall search.
const FOOD_MALL_CODES=['f5ff7','c6ac4','c16a2','b735e','f5d5a'];
const FOOD_MALL_SET=new Set(FOOD_MALL_CODES);
const page = (await import('node:fs/promises')).readFile(new URL('./index.html',import.meta.url),'utf8');
const TIME_WINDOW=60000, MAX_CALLS=8, hits=[];
const TOSS_CODE='2205c';
let tossCache=null, tossCacheUntil=0;
function safeAffiliateLink(raw){
  if(typeof raw!=='string')return null;
  try{
    const u=new URL(raw);
    const host=u.hostname.toLowerCase();
    if(u.protocol==='https:'&&['link.adpick.co.kr','biz.adpick.co.kr','bitl.bz'].includes(host))return u.href;
  }catch{}
  return null;
}
async function getTossLink(){
  const now=Date.now();
  if(tossCache && now<tossCacheUntil)return tossCache;
  const key=process.env.ADPICK_API_KEY;
  if(!key)return {available:false,reason:'API_NOT_CONFIGURED'};
  const u=new URL('https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/malls');
  u.searchParams.set('p_data','alttulpick_toss');
  const response=await fetch(u,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error('Affiliate mall lookup failed: '+response.status);
  const data=await response.json();
  const entry=Array.isArray(data?.data)?data.data.find(x=>String(x?.cp_code||'')===TOSS_CODE):null;
  const raw=entry?.commissionlink;
  const link=safeAffiliateLink(raw);
  const result={available:Boolean(link),name:'토스쇼핑',link:link||undefined};
  // In-memory mall metadata cache only (not product details/images); avoid frequent API calls.
  tossCache=result; tossCacheUntil=now+(link?300000:60000);
  return result;
}
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};
const server=createServer(async(req,res)=>{
const url=new URL(req.url||'/', 'http://localhost');
if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await page);return}
if(!url.pathname.startsWith('/api/')){res.writeHead(404);res.end('Not found');return}
if(req.method!=='GET'){send(res,405,{success:false,message:'GET only'});return}
if(url.pathname==='/api/toss'){
  try{const item=await getTossLink();send(res,200,{success:true,...item})}
  catch{send(res,502,{success:false,message:'토스쇼핑 제휴 링크 확인 실패'})}
  return;
}
let endpoint,params={};
if(url.pathname==='/api/best'){
const area=url.searchParams.get('area')||'today';const n=Number(url.searchParams.get('limit')||10);
if(!['today','popular','pick','commission'].includes(area)||!Number.isInteger(n)||n<1||n>10){send(res,400,{success:false,message:'요청값이 올바르지 않습니다'});return}
endpoint='best';params={area,limit:String(n)}
}else if(url.pathname==='/api/search'){
const q=(url.searchParams.get('q')||'').trim(),n=Number(url.searchParams.get('limit')||20);
if(q.length<2||q.length>60||!Number.isInteger(n)||n<1||n>20){send(res,400,{success:false,message:'요청값이 올바르지 않습니다'});return}
endpoint='search';params={q,limit:String(n)};
if(isGroceryQuery(q))params.cp_code=FOOD_MALL_CODES.join(',');
}else{send(res,404,{success:false,message:'Unknown route'});return}
const key=process.env.ADPICK_API_KEY;if(!key){send(res,503,{success:false,code:'API_NOT_CONFIGURED',message:'데모 모드'});return}
const now=Date.now();while(hits.length&&now-hits[0]>TIME_WINDOW)hits.shift();if(hits.length>=MAX_CALLS){send(res,429,{success:false,message:'잠시 후 다시 시도해 주세요'});return}hits.push(now);
const upstream=new URL('https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/'+endpoint);for(const[k,v]of Object.entries(params))upstream.searchParams.set(k,v);
try{const r=await fetch(upstream,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});if(!r.ok){send(res,502,{success:false,message:'제휴사에서 응답을 받지 못했습니다'});return}const data=await r.json();if(data.success!==true){send(res,502,{success:false,message:'제휴사 API 응답 오류'});return}
if(endpoint==='search'){
  const incoming=Array.isArray(data.data)?data.data:(Array.isArray(data.data?.list)?data.data.list:[]);
  const stores_restricted=isGroceryQuery(params.q);
  const scoped=stores_restricted?incoming.filter(item=>FOOD_MALL_SET.has(String(item?.cp_code||'').toLowerCase())):incoming;
  const matched=selectRelevantProducts(params.q,scoped);
  const filteredData=Array.isArray(data.data)?matched:{...data.data,list:matched};
  send(res,200,{...data,data:filteredData,filter_meta:{received:incoming.length,matched:matched.length,excluded:incoming.length-matched.length,stores_restricted}});
  return;
}
send(res,200,data)}catch{send(res,502,{success:false,message:'제휴사 연결 실패'})}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('알뜰픽 서버가 시작됐습니다'));
server.on('listening',async()=>{
  try{
    const data=await getTossLink();
    // Never log affiliate links, API keys, or link identifiers.
    console.log('[TOSS AFFILIATE CHECK] '+JSON.stringify({available:data.available,merchant:data.name||'unknown'}));
  }catch{console.log('[TOSS AFFILIATE CHECK] unavailable');}
});
