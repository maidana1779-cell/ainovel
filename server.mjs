import {createServer} from 'node:http';
import {selectRelevantProducts,isGroceryQuery} from './relevance.mjs';
// Confirmed search-capable Adpick retailers on 2026-10-24; food queries use a curated five-mall search.
const FOOD_MALL_CODES=['f5ff7','c6ac4','c16a2','b735e','f5d5a'];
const FOOD_MALL_SET=new Set(FOOD_MALL_CODES);
const page = (await import('node:fs/promises')).readFile(new URL('./index.html',import.meta.url),'utf8');
const TIME_WINDOW=60000, MAX_CALLS=8, hits=[];
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};
const server=createServer(async(req,res)=>{
const url=new URL(req.url||'/', 'http://localhost');
if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await page);return}
if(!url.pathname.startsWith('/api/')){res.writeHead(404);res.end('Not found');return}
if(req.method!=='GET'){send(res,405,{success:false,message:'GET only'});return}
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

// Lightweight startup check. Do not log secrets, product titles or affiliate links.
server.on('listening',async()=>{
  const key=process.env.ADPICK_API_KEY;
  console.log('[ADPICK CHECK] key_present='+Boolean(key));
  if(!key)return;
  try{
    const url=new URL('https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/search');
    url.searchParams.set('q','라면');
    url.searchParams.set('limit','5');
    url.searchParams.set('cp_code',FOOD_MALL_CODES.join(','));
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
    const data=await response.json().catch(()=>null);
    const items=Array.isArray(data?.data)?data.data:[];
    const scoped=items.filter(item=>FOOD_MALL_SET.has(String(item?.cp_code||'').toLowerCase()));
    const matched=selectRelevantProducts('라면',scoped);
    console.log('[ADPICK FOOD CHECK] '+JSON.stringify({
      status:response.status,success:data?.success===true,received:items.length,
      allowed_stores:scoped.length,relevant:matched.length,
      code:data?.error_code||null
    }));
  }catch{console.log('[ADPICK FOOD CHECK] network_error');}
});
