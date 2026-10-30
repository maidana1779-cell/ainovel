import test from 'node:test';
import assert from 'node:assert/strict';
import {workerFetch} from '../worker/index.mjs';
import {getSearchPlan} from '../search-plan.mjs';

const origin='https://alttulpick-shop.onrender.com';
const request=q=>new Request('https://alttulpick-api.example.workers.dev/api/search?q='+encodeURIComponent(q)+'&limit=20',{headers:{origin}});
const json=data=>new Response(JSON.stringify({success:true,data}),{status:200,headers:{'content-type':'application/json'}});

test('Searchable food and household items from newly approved Coupang are not excluded by fixed mall codes',async()=>{
 for(const [q,good,bad] of [
  ['생수','스파클 생수 500ml 20병','생수 마시는 방법 전자책'],
  ['세제','퍼실 액체세제 2.7L','세제곱 프로그래밍 교재']
 ]){
  const calls=[],old=globalThis.fetch;
  globalThis.fetch=async url=>{
   const u=new URL(String(url));calls.push(u);
   if(u.pathname.endsWith('/search'))return json([
    {title:good,cp_name:'쿠팡',cp_code:'COUPANG',price:'19,900원',commissionlink:'https://bitl.bz/BHrbPz'},
    {title:bad,cp_name:'쿠팡',cp_code:'COUPANG',price:'9,900원',commissionlink:'https://bitl.bz/BHrbPz'},
    {title:good,cp_name:'11번가',cp_code:'11ST',price:'22,900원',commissionlink:'https://link.adpick.co.kr/merchant-test'}
   ]);
   throw Error('Unexpected outbound request: '+url);
  };
  try{
   assert.equal(getSearchPlan(q).codes,null);
   const res=await workerFetch(request(q),{ADPICK_API_KEY:'unit-test-secret'});
   assert.equal(res.status,200,q);
   const payload=await res.json();
   const products=Array.isArray(payload.data)?payload.data:payload.data.list;
   assert.equal(payload.success,true);
   assert.ok(products.some(p=>p.cp_name==='쿠팡'&&p.commissionlink==='https://bitl.bz/BHrbPz'),q);
   assert.ok(products.some(p=>p.cp_name==='11번가'),q);
   assert.ok(products.every(p=>p.title!==bad),q+' digital or service false positives remain blocked');
   assert.equal(payload.filter_meta.stores_restricted,false);
   assert.ok(calls.length>=1&&calls.length<=2,q+' respects keyword request budget');
   assert.ok(calls.every(u=>!u.searchParams.has('cp_code')),q+' must not pin previously approved malls');
  }finally{globalThis.fetch=old}
 }
});
