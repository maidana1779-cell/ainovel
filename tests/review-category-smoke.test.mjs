import test from 'node:test';
import assert from 'node:assert/strict';
import {workerFetch} from '../worker/index.mjs';
const base='https://alttulpick-api.example.workers.dev',origin='https://alttulpick-shop.onrender.com';
const samples=[
 {query:'간편식',title:'비비고 볶음밥 2kg'},
 {query:'세제',title:'퍼실 액체세제 2L'},
 {query:'이어폰',title:'소니 무선 이어폰 WF-1000XM5'},
 {query:'화장품',title:'클리오 화장품 쿠션 파운데이션'},
 {query:'의류',title:'따뜻한 패딩조끼 의류'},
 {query:'주방용품',title:'테팔 프라이팬 28cm'}
];
test('Six representative category searches filter unrelated merchants and retain valid purchase URLs',async()=>{
 const old=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async()=>{
  requests++;
  return new Response(JSON.stringify({success:true,data:[
   ...samples.map((sample,i)=>({
    title:sample.title,cp_name:i%2?'가전생활몰':'이유몰',cp_code:i===0?'f5ff7':i===1?'c16a2':'seller_'+i,
    price:9000+i,commissionlink:'https://biz.adpick.co.kr/r'+(5000000+i)})),
   {title:'국내 항공권',cp_name:'마이리얼트립',commissionlink:'https://biz.adpick.co.kr/r8888'},
   {title:'프로그래밍 책',cp_name:'YES24',commissionlink:'https://biz.adpick.co.kr/r9999'}
  ]}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  for(const sample of samples){
   const url=new URL(base+'/api/search');
   url.searchParams.set('q',sample.query);
   url.searchParams.set('limit','20');
   const response=await workerFetch(new Request(url.href,{headers:{origin}}),{ADPICK_API_KEY:'test-key'});
   assert.equal(response.status,200,sample.query);
   const payload=await response.json();
   assert.equal(payload.success,true,sample.query);
   const result=Array.isArray(payload.data)?payload.data:payload.data?.list;
   assert.ok(Array.isArray(result),sample.query);
   assert.ok(result.some(p=>p.title===sample.title),sample.query+' should find its relevant product');
   assert.ok(result.every(p=>p.cp_name!=='마이리얼트립'&&p.cp_name!=='YES24'));
   assert.ok(result.every(p=>p.commissionlink.startsWith('https://biz.adpick.co.kr/r')));
  }
  assert.ok(requests>=samples.length);
 }finally{globalThis.fetch=old}
});
