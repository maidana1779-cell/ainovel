import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const begin=script.indexOf('let preferBackupUntil=0;');
const end=script.indexOf('\nconst grid=',begin);
assert.ok(begin>=0&&end>begin);
const primary='https://alttulpick-api.maidana1779.workers.dev';
const backup='https://alttulpick-preview.onrender.com';
const runtime=script.slice(begin,end);
const timer=(callback,delay)=>{
 if(delay===4000)queueMicrotask(callback);
 return 1;
};
function client(fetchImpl,clock=Date){
 return new Function('fetch','setTimeout','clearTimeout','AbortController','API_ORIGIN','BACKUP_API_ORIGIN','Date',
  runtime+'return fetchProducts;')(fetchImpl,timer,()=>{},AbortController,primary,backup,clock);
}
const response=(body,status=200,contentType='application/json')=>
 new Response(body,{status,headers:{'content-type':contentType}});

test('Cloudflare fails, Render spins up with HTML 503, then actual product JSON succeeds',async()=>{
 const calls=[];let fallbacks=0;
 const fetcher=client(async url=>{
  calls.push(url);
  if(url.startsWith(primary))throw Error('network blocked');
  if(++fallbacks===1)return response('<html>Render loading</html>',503,'text/html');
  return response(JSON.stringify({success:true,data:[{title:'실제 상품',price:15900}]}));
 });
 let wake=0;
 const result=await fetcher('/api/best?area=today&limit=10',()=>wake++);
 const payload=await result.json();
 assert.equal(payload.data.length,1);
 assert.equal(payload.data[0].title,'실제 상품');
 assert.equal(wake,1);
 assert.equal(calls.length,3);
 assert.equal(calls.filter(url=>url.startsWith(backup)).length,2);
});
test('HTML 200 loading response is not mistaken for product JSON',async()=>{
 let count=0;
 const fetcher=client(async url=>{
  if(url.startsWith(primary))return response('<html>Cloudflare challenge</html>',403,'text/html');
  return ++count===1?response('<html>Loading</html>',200,'text/html'):
    response(JSON.stringify({success:true,data:[]}));
 });
 const result=await fetcher('/api/best?area=today&limit=10');
 assert.equal((await result.json()).success,true);
 assert.equal(count,2);
});
test('Verified 429 JSON is handled immediately without waking backup',async()=>{
 const urls=[];
 const fetcher=client(async url=>{
  urls.push(url);
  return response(JSON.stringify({success:false,message:'한도 초과'}),429);
 });
 const result=await fetcher('/api/best?area=today&limit=10');
 assert.equal(result.status,429);
 assert.equal(urls.length,1);
});

test('A warm backup serves the second search without repeating a failed Worker request',async()=>{
 const calls=[];
 const fetcher=client(async url=>{
  calls.push(String(url));
  if(String(url).startsWith(primary))return response('{}',502);
  return response(JSON.stringify({success:true,data:[{title:'실제 이어폰',price:12900}]}));
 });
 const first=await fetcher('/api/search?q='+encodeURIComponent('이어폰')+'&limit=30');
 assert.equal((await first.json()).success,true);
 const second=await fetcher('/api/search?q='+encodeURIComponent('커피')+'&limit=30');
 assert.equal((await second.json()).success,true);
 assert.deepEqual(calls.map(url=>url.startsWith(primary)?'edge':'backup'),['edge','backup','backup']);
});
test('Worker takes priority again after the short temporary backup preference',async()=>{
 const calls=[];let now=1000000,first=true;
 const fetcher=client(async url=>{
  calls.push(String(url));
  if(String(url).startsWith(primary)&&first){first=false;return response('{}',503)}
  return response(JSON.stringify({success:true,data:[]}));
 },{now:()=>now});
 await fetcher('/api/search?q='+encodeURIComponent('이어폰'));
 now+=91000;
 await fetcher('/api/search?q='+encodeURIComponent('라면'));
 assert.deepEqual(calls.map(url=>url.startsWith(primary)?'edge':'backup'),['edge','backup','edge']);
});
test('A dead backup gives the recovered Worker a chance and resets backup preference',async()=>{
 const calls=[];let first=true,backupDown=false;
 const fetcher=client(async url=>{
  calls.push(String(url));
  if(String(url).startsWith(primary)){
   if(first){first=false;return response('{}',502)}
   return response(JSON.stringify({success:true,data:[]}));
  }
  if(backupDown)return response('<html>loading</html>',503,'text/html');
  return response(JSON.stringify({success:true,data:[]}));
 });
 await fetcher('/api/search?q='+encodeURIComponent('이어폰'));
 backupDown=true;
 const result=await fetcher('/api/search?q='+encodeURIComponent('생수'));
 assert.equal(result.status,200);
 assert.deepEqual(calls.map(url=>url.startsWith(primary)?'edge':'backup'),['edge','backup','backup','edge']);
});

test('Search-only Worker 429 falls back to Render without retrying the same limited Worker',async()=>{
 const calls=[];
 const fetcher=client(async url=>{
  calls.push(String(url));
  if(String(url).startsWith(primary))return response(JSON.stringify({success:false,code:'SEARCH_QUOTA_COOLDOWN'}),429);
  return response(JSON.stringify({success:true,data:[{title:'쿠팡 충전기',cp_name:'쿠팡',commissionlink:'https://bitl.bz/BHrbPz'}]}));
 });
 const result=await fetcher('/api/search?q='+encodeURIComponent('충전기')+'&limit=20');
 assert.equal(result.status,200);
 assert.equal((await result.json()).data[0].cp_name,'쿠팡');
 assert.deepEqual(calls.map(url=>url.startsWith(primary)?'edge':'backup'),['edge','backup']);
});
