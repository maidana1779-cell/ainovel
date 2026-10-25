import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workerFetch} from '../worker/index.mjs';

const origin='https://alttulpick-shop.onrender.com';
const base='https://alttulpick-api.example.workers.dev';
const request=path=>new Request(base+path,{headers:{origin}});
const json=payload=>new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}});

test('Cloudflare best removes unrelated vendors but preserves legitimate items, prices and links',async()=>{
 const old=globalThis.fetch;
 const list=[
  {title:'여행 호텔권',cp_name:'마이리얼트립',price:10000},
  {title:'무선 이어폰',cp_name:'YES24',price:8000},
  {title:'무선 이어폰',cp_name:'가전몰',price:59000,commissionlink:'https://biz.adpick.co.kr/r123'}
 ];
 globalThis.fetch=async()=>json({success:true,data:{area:'pick',list}});
 try{
  const res=await workerFetch(request('/api/best?area=pick&limit=2'),{ADPICK_API_KEY:'fake-test-key'});
  assert.equal(res.status,200);
  const payload=await res.json();
  assert.equal(payload.data.list.length,1);
  assert.equal(payload.data.list[0].cp_name,'가전몰');
  assert.equal(payload.data.list[0].price,59000);
  assert.equal(payload.data.list[0].commissionlink,'https://biz.adpick.co.kr/r123');
  assert.equal(payload.filter_meta.out_of_catalog_removed,2);
 }finally{globalThis.fetch=old}
});

test('Cloudflare search filters off-category merchants as well as irrelevant goods',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>json({success:true,data:[
  {title:'에어팟 무선이어폰',cp_name:'YES24',price:10000},
  {title:'에어팟 무선이어폰',cp_name:'11번가',price:169000,commissionlink:'https://biz.adpick.co.kr/r456'},
  {title:'에어팟 케이스',cp_name:'마이리얼트립',price:13000}
 ]});
 try{
  const res=await workerFetch(request('/api/search?q='+encodeURIComponent('에어팟')+'&limit=3'),{ADPICK_API_KEY:'fake-test-key'});
  assert.equal(res.status,200);
  const result=await res.json();
  const items=Array.isArray(result.data)?result.data:result.data.list;
  assert.equal(items.length,1);
  assert.equal(items[0].cp_name,'11번가');
  assert.equal(items[0].commissionlink,'https://biz.adpick.co.kr/r456');
  assert.ok(result.filter_meta.out_of_catalog_removed>=1);
 }finally{globalThis.fetch=old}
});

test('Render proxy fallback also strips disallowed vendors from otherwise successful feeds',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>json({success:true,data:{area:'today',list:[
  {title:'여행권',cp_name:'마이리얼트립'},
  {title:'생수',cp_name:'이유몰',commissionlink:'https://biz.adpick.co.kr/r789'}
 ]}});
 try{
  const res=await workerFetch(request('/api/best?area=today&limit=9'),{});
  assert.equal(res.status,200);
  const result=await res.json();
  assert.deepEqual(result.data.list.map(x=>x.cp_name),['이유몰']);
  assert.equal(result.filter_meta.out_of_catalog_removed,1);
 }finally{globalThis.fetch=old}
});

test('Client-side guard works even when stale third-party API sends forbidden sellers',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 const begin=js.indexOf('function storefrontEligible(p){');
 const end=js.indexOf('function displayPrice(',begin);
 assert.ok(begin>0&&end>begin);
 const allowed=new Function(js.slice(begin,end)+'return storefrontEligible;')();
 assert.equal(allowed({cp_name:'YES24',title:'전자제품'}),false);
 assert.equal(allowed({cp_name:'마이리얼트립',title:'생수 12병'}),false);
 assert.equal(allowed({cp_name:'이유몰',title:'생수 12병'}),true);
});
