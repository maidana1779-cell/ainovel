import {createServer} from 'node:http';
import {selectRelevantProducts} from './relevance.mjs';
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
endpoint='search';params={q,limit:String(n)}
}else{send(res,404,{success:false,message:'Unknown route'});return}
const key=process.env.ADPICK_API_KEY;if(!key){send(res,503,{success:false,code:'API_NOT_CONFIGURED',message:'데모 모드'});return}
const now=Date.now();while(hits.length&&now-hits[0]>TIME_WINDOW)hits.shift();if(hits.length>=MAX_CALLS){send(res,429,{success:false,message:'잠시 후 다시 시도해 주세요'});return}hits.push(now);
const upstream=new URL('https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/'+endpoint);for(const[k,v]of Object.entries(params))upstream.searchParams.set(k,v);
try{const r=await fetch(upstream,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});if(!r.ok){send(res,502,{success:false,message:'제휴사에서 응답을 받지 못했습니다'});return}const data=await r.json();if(data.success!==true){send(res,502,{success:false,message:'제휴사 API 응답 오류'});return}
if(endpoint==='search'){
  const incoming=Array.isArray(data.data)?data.data:(Array.isArray(data.data?.list)?data.data.list:[]);
  const matched=selectRelevantProducts(params.q,incoming);
  const filteredData=Array.isArray(data.data)?matched:{...data.data,list:matched};
  send(res,200,{...data,data:filteredData,filter_meta:{received:incoming.length,matched:matched.length,excluded:incoming.length-matched.length}});
  return;
}
send(res,200,data)}catch{send(res,502,{success:false,message:'제휴사 연결 실패'})}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('알뜰픽 서버가 시작됐습니다'));

// Startup smoke test: never log the API key or any affiliate URLs.
server.on('listening',async()=>{
  const key=process.env.ADPICK_API_KEY;
  console.log('[ADPICK CHECK] key_present='+Boolean(key));
  if(!key) return;
  try{
    const url=new URL('https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/best');
    url.searchParams.set('area','today');
    url.searchParams.set('limit','1');
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
    const data=await response.json().catch(()=>null);
    const ok=response.ok&&data?.success===true&&Array.isArray(data?.data?.list);
    console.log('[ADPICK CHECK] result='+(ok?'success':'failed')+' http='+response.status+' count='+(ok?data.data.list.length:0));
    // Single-run capability audit: no product data or affiliate URLs in logs.
    // API search rate limit is 10 requests per minute; test six candidates once.
    for(const [code,name] of [
      ['f5ff7','CJ더마켓'],
      ['c6ac4','풀무원'],
      ['c16a2','11번가'],
      ['b735e','SSG'],
      ['f5d5a','GS SHOP'],
      ['4d9b1','이유몰']
    ]){
      try{
        const probeUrl=new URL('https://biz.adpick.co.kr/api/'+encodeURIComponent(key)+'/search');
        probeUrl.searchParams.set('q','라면');
        probeUrl.searchParams.set('limit','1');
        probeUrl.searchParams.set('cp_code',code);
        const response=await fetch(probeUrl,{signal:AbortSignal.timeout(9000)});
        const body=await response.json().catch(()=>null);
        console.log('[ADPICK CODE TEST] '+JSON.stringify({
          code,name,http:response.status,success:body?.success===true,
          count:Array.isArray(body?.data)?body.data.length:0,
          error_code:body?.error_code||null
        }));
        if(response.status===403||response.status===429)break;
      }catch{console.log('[ADPICK CODE TEST] '+JSON.stringify({code,name,status:'unavailable'}));}
    }
  }catch{
    console.log('[ADPICK CHECK] result=network_error');
  }
});
