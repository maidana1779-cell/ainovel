import test from 'node:test';
import assert from 'node:assert/strict';
import {workerFetch} from '../worker/index.mjs';

const BASE='https://alttulpick-api.example.workers.dev';
const HOME='https://alttulpick-shop.onrender.com';
function request(path,init){return new Request(BASE+path,init)}
test('Worker health, origin permissions, and missing secret response',async()=>{
 const health=await workerFetch(request('/health'));assert.equal(health.status,200);
 const details=await health.json();
 assert.equal(details.revision,'binding-diagnostic-v3-20261025');
 assert.equal(details.adpick_binding,'not_bound');
 assert.equal(details.best_fresh_seconds,180);
 assert.equal(details.best_stale_seconds,900);
 const options=await workerFetch(request('/api/search',{method:'OPTIONS',headers:{origin:HOME}}));
 assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),HOME);
 const denied=await workerFetch(request('/api/search',{method:'OPTIONS',headers:{origin:'https://evil.example'}}));
 assert.equal(denied.status,403);
 // Without a Worker runtime secret, the public feed uses the existing Render Adpick API.
 // The dedicated proxy tests mock this call so this unit test does not contact production.
});
test('Curated products are available without upstream or credentials',async()=>{
 const res=await workerFetch(request('/api/curated'),{});
 assert.equal(res.status,200);
 const payload=await res.json();assert.equal(payload.success,true);assert.ok(Array.isArray(payload.data));
});
test('Worker best feed preserves product shape and removes explicit stock markers',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:[
  {title:'[품절] 한정 상품',price:'9,000원'},
  {title:'정상 판매 생수',price:'7,000원',commissionlink:'https://bitl.bz/abc'}
 ]}),{status:200,headers:{'content-type':'application/json'}});
 try{
  const res=await workerFetch(request('/api/best?area=today&limit=10',{headers:{origin:HOME}}),{ADPICK_API_KEY:'fake-for-test'});
  assert.equal(res.status,200);
  const payload=await res.json();
  assert.equal(payload.data.length,1);
  assert.equal(payload.filter_meta.explicitly_unavailable_removed,1);
  assert.equal(payload.filter_meta.verification.eligible,0);
 }finally{globalThis.fetch=old}
});
test('Worker does not expose API secrets or accept fabricated telemetry events',async()=>{
 const invalid=await workerFetch(request('/api/telemetry',{method:'POST',headers:{origin:HOME,'content-type':'application/json'},body:JSON.stringify({event:'forged',merchant:'shop'})}));
 assert.equal(invalid.status,400);
 const valid=await workerFetch(request('/api/telemetry',{method:'POST',headers:{origin:HOME,'content-type':'application/json'},body:JSON.stringify({event:'product_click',merchant:'shop'})}));
 assert.equal(valid.status,200);
});

test('Repeated public best feed is served from short-lived Worker cache without another BIZ call',async()=>{
 const old=globalThis.fetch;let upstream=0;
 globalThis.fetch=async()=>{
  upstream++;
  return new Response(JSON.stringify({success:true,data:[
   {title:'캐시 테스트 상품',price:14900,cp_name:'판매처',commissionlink:'https://bitl.bz/test123'}
  ]}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const first=await workerFetch(request('/api/best?area=pick&limit=7',{headers:{origin:HOME}}),{ADPICK_API_KEY:'fake-for-test'});
  const second=await workerFetch(request('/api/best?area=pick&limit=7',{headers:{origin:HOME}}),{ADPICK_API_KEY:'fake-for-test'});
  assert.equal(first.status,200);
  assert.equal(second.status,200);
  assert.equal(upstream,1);
  assert.deepEqual(await first.json(),await second.json());
  assert.equal(second.headers.get('access-control-allow-origin'),HOME);
 }finally{globalThis.fetch=old}
});

test('Free Edge cache serves stale best products immediately and refreshes in the background',async()=>{
 const previousFetch=globalThis.fetch;
 const previousNow=Date.now;
 let current=previousNow(),upstream=0;
 Date.now=()=>current;
 globalThis.fetch=async()=>{
  upstream++;
  return new Response(JSON.stringify({success:true,data:[
   {title:'상품 버전 '+upstream,price:10000,commissionlink:'https://bitl.bz/real-affiliate'}
  ]}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const requestUrl='/api/best?area=popular&limit=4';
  const first=await workerFetch(request(requestUrl,{headers:{origin:HOME}}),{ADPICK_API_KEY:'fake-for-test'});
  assert.equal((await first.json()).data[0].title,'상품 버전 1');
  current+=181000;
  const pending=[],ctx={waitUntil(promise){pending.push(promise)}};
  const stale=await workerFetch(request(requestUrl,{headers:{origin:HOME}}),{ADPICK_API_KEY:'fake-for-test'},ctx);
  const staleData=await stale.json();
  assert.equal(staleData.data[0].title,'상품 버전 1');
  assert.equal(staleData.filter_meta.cache_status,'stale');
  assert.ok(staleData.filter_meta.cache_age_seconds>=180);
  assert.equal(pending.length,1);
  await Promise.all(pending);
  const refreshed=await workerFetch(request(requestUrl,{headers:{origin:HOME}}),{ADPICK_API_KEY:'fake-for-test'});
  assert.equal((await refreshed.json()).data[0].title,'상품 버전 2');
  assert.equal(upstream,2);
 }finally{globalThis.fetch=previousFetch;Date.now=previousNow}
});
test('Failed Adpick response is not stored in the successful public cache',async()=>{
 const previous=globalThis.fetch;let count=0;
 globalThis.fetch=async()=>{
  count++;
  if(count===1)return new Response('unavailable',{status:503});
  return new Response(JSON.stringify({success:true,data:[{title:'복구된 상품',price:11000}]}),
   {status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const path='/api/best?area=pick&limit=9';
  const failed=await workerFetch(request(path,{headers:{origin:HOME}}),{ADPICK_API_KEY:'fake-for-test'});
  assert.equal(failed.status,502);
  const good=await workerFetch(request(path,{headers:{origin:HOME}}),{ADPICK_API_KEY:'fake-for-test'});
  assert.equal(good.status,200);
  assert.equal((await good.json()).data[0].title,'복구된 상품');
  assert.equal(count,2);
 }finally{globalThis.fetch=previous}
});

test('Health checks secret-binding presence without revealing any secret',async()=>{
 const absent=await (await workerFetch(request('/health'),{})).json();
 const ready=await (await workerFetch(request('/health'),{ADPICK_API_KEY:'test-secret-do-not-expose'})).json();
 const empty=await (await workerFetch(request('/health'),{ADPICK_API_KEY:''})).json();
 const invalid=await (await workerFetch(request('/health'),{ADPICK_API_KEY:{get(){return 'secret'}}})).json();
 assert.equal(absent.adpick_binding,'not_bound');
 assert.equal(ready.adpick_binding,'ready');
 assert.equal(empty.adpick_binding,'empty');
 assert.equal(invalid.adpick_binding,'invalid_type');
 for(const obj of [absent,ready,empty,invalid]){
  assert.ok(!JSON.stringify(obj).includes('test-secret-do-not-expose'));
  assert.equal(obj.status,'ok');
 }
});

test('Production Worker serves real Adpick affiliate feed via its existing Render backup when runtime binding is absent',async()=>{
 const previous=globalThis.fetch, urls=[];
 globalThis.fetch=async url=>{
  urls.push(String(url));
  return new Response(JSON.stringify({success:true,data:[
   {title:'실제 애드픽 상품',price:8900,commissionlink:'https://bitl.bz/real-tracking'}
  ]}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const res=await workerFetch(request('/api/best?area=today&limit=8',{headers:{origin:HOME}}),{});
  assert.equal(res.status,200);
  const payload=await res.json();
  assert.equal(payload.data[0].commissionlink,'https://bitl.bz/real-tracking');
  assert.equal(payload.success,true);
  assert.equal(urls.length,1);
  assert.equal(urls[0],'https://alttulpick-preview.onrender.com/api/best?area=today&limit=8');
  const cached=await workerFetch(request('/api/best?area=today&limit=8',{headers:{origin:HOME}}),{});
  assert.equal(cached.status,200);
  assert.equal(urls.length,1,'cached affiliate feed must not wake Render again');
 }finally{globalThis.fetch=previous}
});

test('Unconfigured Worker does not cache broken Render pages or change affiliate URLs',async()=>{
 const previous=globalThis.fetch;
 let count=0;
 globalThis.fetch=async()=>{
  count++;
  if(count===1)return new Response('<html>Starting Render...</html>',{status:503,headers:{'content-type':'text/html'}});
  return new Response(JSON.stringify({success:true,data:[
   {title:'정상 상품',price:9900,commissionlink:'https://bitl.bz/unchanged'}
  ]}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const url='/api/best?area=popular&limit=6';
  const broken=await workerFetch(request(url),{});
  assert.equal(broken.status,502);
  assert.equal((await broken.json()).success,false);
  const fixed=await workerFetch(request(url),{});
  assert.equal(fixed.status,200);
  assert.equal((await fixed.json()).data[0].commissionlink,'https://bitl.bz/unchanged');
  assert.equal(count,2);
 }finally{globalThis.fetch=previous}
});

test('Missing secret proxy rejects unbounded or invalid query before contacting Render',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('Unexpected network call')};
 try{
  const bad=await workerFetch(request('/api/search?q=a&limit=30'),{});
  assert.equal(bad.status,400);
  const forbidden=await workerFetch(request('/api/best?area=internal&limit=10'),{});
  assert.equal(forbidden.status,400);
 }finally{globalThis.fetch=previous}
});
