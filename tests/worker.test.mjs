import test from 'node:test';
import assert from 'node:assert/strict';
import {workerFetch} from '../worker/index.mjs';

const BASE='https://alttulpick-api.example.workers.dev';
const HOME='https://alttulpick-shop.onrender.com';
function request(path,init){return new Request(BASE+path,init)}
test('Worker health, origin permissions, and missing secret response',async()=>{
 const health=await workerFetch(request('/health'));assert.equal(health.status,200);
 const options=await workerFetch(request('/api/search',{method:'OPTIONS',headers:{origin:HOME}}));
 assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),HOME);
 const denied=await workerFetch(request('/api/search',{method:'OPTIONS',headers:{origin:'https://evil.example'}}));
 assert.equal(denied.status,403);
 const missing=await workerFetch(request('/api/best'),{});
 assert.equal(missing.status,503);assert.equal((await missing.json()).code,'API_NOT_CONFIGURED');
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
