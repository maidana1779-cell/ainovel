import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const begin=script.indexOf('async function fetchProducts(path,onBackupStart){');
const end=script.indexOf('\nconst grid=',begin);
assert.ok(begin>=0&&end>begin);
const primary='https://alttulpick-api.maidana1779.workers.dev';
const backup='https://alttulpick-preview.onrender.com';
const runtime=script.slice(begin,end);
const timer=(callback,delay)=>{
 if(delay===4000)queueMicrotask(callback);
 return 1;
};
function client(fetchImpl){
 return new Function('fetch','setTimeout','clearTimeout','AbortController','API_ORIGIN','BACKUP_API_ORIGIN',
  runtime+'return fetchProducts;')(fetchImpl,timer,()=>{},AbortController,primary,backup);
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
