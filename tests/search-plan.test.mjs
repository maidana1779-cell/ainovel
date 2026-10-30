import test from 'node:test';
import assert from 'node:assert/strict';
import {relevantItem,isDetergentQuery} from '../relevance.mjs';
import {getSearchPlan,uniqueProductResults} from '../search-plan.mjs';
import {readFileSync} from 'node:fs';

const detergentCases=[
 ['세제','넥타이 세제품 3종 세트',false],
 ['세제','넥타이 실크 세제품',false],
 ['세제','신상품 셔츠 세제품',false],
 ['세제','세제곱 프로그래밍 교재',false],
 ['세제','세제통 보관용기 2개',false],
 ['세제','세제 보관함 수납용기',false],
 ['세제','세제품 모음 3종',false],
 ['세제','퍼실 액체세제 2.7L',true],
 ['세제','비트 액체세제 리필 1.8L',true],
 ['세제','무궁화 세탁세제 5kg',true],
 ['세제','퐁퐁 주방세제 1L',true],
 ['세제','세제 3L 본품 2개',true],
 ['세탁세제','퍼실 세탁세제 2.7L',true],
 ['세탁세제','퐁퐁 주방세제 1L',false],
 ['주방세제','퐁퐁 주방세제 1L',true],
 ['주방세제','퍼실 액체세제 2.7L',false],
 ['캡슐세제','캡슐세제 30개',true],
 ['캡슐세제','가루세제 3kg',false],
 ['액체세제','리큐 액체세제 2.1L',true],
 ['액체세제','일반 분말세제 5kg',false]
];
for(const [query,title,expected] of detergentCases){
  test('Detergent classification: '+query+' '+title,()=>{
    assert.equal(relevantItem(query,{title,cp_name:'11번가'}),expected);
  });
}
test('Classify detergent terms for retail-mall routing',()=>{
  for(const q of ['세제','세탁세제','주방세제','캡슐세제','액체세제'])assert.equal(isDetergentQuery(q),true,q);
  for(const q of ['넥타이','라면','커피','이어폰'])assert.equal(isDetergentQuery(q),false,q);
});
test('Broad shopping first page uses one provider keyword to protect shared API quota',()=>{
 const plans={
  '세제':['세제'],
  '간편식':['간편식'],
  '커피':['커피'],
  '라면':['라면'],
  '생수':['생수'],
  '이어폰':['이어폰'],
  '화장품':['화장품'],
  '의류':['의류'],
  '주방용품':['주방용품'],
  '노트북':['노트북']
 };
 for(const [q,expected] of Object.entries(plans)){
  const plan=getSearchPlan(q);
  assert.deepEqual(plan.terms,expected);
  assert.ok(plan.terms.length<=2);
 }
});
test('Grocery and household searches include every API-enabled merchant, including newly approved Coupang',()=>{
 for(const q of ['세제','세탁세제','간편식','라면','생수','커피','이어폰','노트북','물티슈']){
  assert.equal(getSearchPlan(q).codes,null,q);
 }
});
test('Additional relevant shopping searches are available only through explicit pagination',()=>{
 for(const q of ['노트북','충전기','물티슈','화장지','청소기','샴푸','운동화','과자']){
  const first=getSearchPlan(q,0),next=getSearchPlan(q,1);
  assert.equal(first.terms.length,1,q+' initial search stays one request');
  assert.ok(next.terms.length>=1&&next.terms.length<=2,q);
  assert.ok(first.totalBatches>=2,q);
  assert.equal(first.batch,0);
  assert.equal(next.batch,1);
  assert.ok(first.terms.every(term=>term.includes(q)),q+' must remain relevant to user intent');
 }
});
test('Union result removes duplicates but retains distinct merchants or pack prices',()=>{
 const items=[
  {title:'퍼실 액체세제 2.7L',cp_code:'c16a2',price:15400,commissionlink:'https://link.adpick.co.kr/one'},
  {title:'퍼실 액체세제 2.7L',cp_code:'c16a2',price:15400,commissionlink:'https://link.adpick.co.kr/two'},
  {title:'퍼실 액체세제 2.7L',cp_code:'b735e',price:15400},
  {title:'퍼실 액체세제 2.7L',cp_code:'c16a2',price:16500}
 ];
 const distinct=uniqueProductResults(items);
 assert.equal(distinct.length,3);
 assert.equal(distinct[0].commissionlink,items[0].commissionlink);
});
test('Server reserves actual affiliate API quota for all expanded searches',()=>{
 const src=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(src,/const remaining=MAX_CALLS-hits\.length/);
 assert.match(src,/const activeTerms=endpoint==='search'\?plan\.terms\.slice\(0,remaining\):\[\]/);
 assert.match(src,/const callCount=endpoint==='search'\?activeTerms\.length:1/);
 assert.match(src,/Promise\.allSettled\(requests\)/);
 assert.match(src,/uniqueProductResults/);
});
