import test from 'node:test';
import assert from 'node:assert/strict';
import {workerFetch} from '../worker/index.mjs';
const BASE='https://alttulpick-api.testing.workers.dev';
const request=path=>new Request(BASE+path);
const jsonBody=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
test('Malformed BIZ best success is rejected instead of cached',async()=>{
 const prev=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{
  calls++;
  return calls===1?jsonBody({success:true,data:{count:10}}):
   jsonBody({success:true,data:{list:[{title:'정상 상품',price:2000}]}});
 };
 try{
  const url='/api/best?area=today&limit=3';
  const first=await workerFetch(request(url),{ADPICK_API_KEY:'test-only'});
  const second=await workerFetch(request(url),{ADPICK_API_KEY:'test-only'});
  assert.equal(first.status,502);
  assert.equal(second.status,200);
  assert.equal((await second.json()).data.list[0].title,'정상 상품');
  assert.equal(calls,2);
 }finally{globalThis.fetch=prev}
});
test('Malformed search success is not represented as an empty search',async()=>{
 const prev=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{
  calls++;return jsonBody({success:true,data:{count:0}});
 };
 try{
  const url='/api/search?q='+encodeURIComponent('신제품검증테스트')+'&limit=6';
  const res=await workerFetch(request(url),{ADPICK_API_KEY:'test-only'});
  assert.equal(res.status,502);
  assert.equal((await res.json()).success,false);
  assert.equal(calls,1);
 }finally{globalThis.fetch=prev}
});
test('An actually empty list is a legitimate successful response',async()=>{
 const prev=globalThis.fetch;
 globalThis.fetch=async()=>jsonBody({success:true,data:{list:[]}});
 try{
  const res=await workerFetch(request('/api/best?area=popular&limit=3'),{ADPICK_API_KEY:'test-only'});
  assert.equal(res.status,200);
  assert.deepEqual((await res.json()).data.list,[]);
 }finally{globalThis.fetch=prev}
});
