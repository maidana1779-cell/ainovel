import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {getSearchPlan,uniqueProductResults,productIdentity} from '../search-plan.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];

test('Every category has at most 3 distinct keyword batches',()=>{
 for(const q of ['세제','간편식','커피','라면','생수','이어폰','의류','주방용품','화장품']){
  const base=getSearchPlan(q);
  assert.ok(base.totalBatches>=2&&base.totalBatches<=3,q);
  const all=[];
  for(let i=0;i<base.totalBatches;i++){
   const p=getSearchPlan(q,i);
   assert.ok(p.terms.length>=1&&p.terms.length<=2,q+' batch '+i);
   all.push(...p.terms);
   assert.deepEqual(p.codes,base.codes);
  }
  assert.equal(new Set(all).size,all.length,'Each batch uses a fresh term: '+q);
  assert.deepEqual(getSearchPlan(q,base.totalBatches).terms,[]);
 }
 assert.deepEqual(getSearchPlan('노트북',0).terms,['노트북']);
 assert.deepEqual(getSearchPlan('노트북',1).terms,[]);
});

test('Additional detergent rounds use actual detergent categories, not random strings',()=>{
 assert.deepEqual(getSearchPlan('세제',0).terms,['세제','주방세제']);
 assert.deepEqual(getSearchPlan('세제',1).terms,['캡슐세제','액체세제']);
 assert.deepEqual(getSearchPlan('세제',2).terms,['세탁세제','분말세제']);
});

test('Same merchant and product duplicates are suppressed independently of referral URL',()=>{
 const items=[
  {cp_code:'11',title:'퍼실 액체세제 2.7L',price:9900,commissionlink:'https://link.adpick.co.kr/a'},
  {cp_code:'11',title:'퍼실 액체세제 2.7 L',price:9900,commissionlink:'https://link.adpick.co.kr/b'},
  {cp_code:'22',title:'퍼실 액체세제 2.7L',price:9900,commissionlink:'https://link.adpick.co.kr/c'}
 ];
 assert.equal(productIdentity(items[0]),productIdentity(items[1]));
 assert.equal(uniqueProductResults(items).length,2);
});

test('Server validates batch boundaries and never invents supplier pagination',()=>{
 assert.match(server,/batch=Number\(url\.searchParams\.get\('batch'\)\|\|0\)/);
 assert.match(server,/batch>2/);
 assert.match(server,/if\(!plan\.terms\.length\)/);
 assert.match(server,/plan\.batch===0\?matchingCuratedProducts/);
 assert.match(server,/has_more:plan\.batch\+1<plan\.totalBatches/);
 assert.match(server,/const activeTerms=endpoint==='search'\?plan\.terms\.slice\(0,remaining\):\[\]/);
 assert.doesNotMatch(server,/upstream\.searchParams\.set\('page'/);
 assert.doesNotMatch(server,/\[SEARCH BASELINE\]|\[DETERGENT OVERLAP\]/);
});

test('Load more UI appends products and guards stale responses',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 for(const id of ['more-area','more-products','more-note','related-browse','related-list']){
  assert.equal(html.split('id="'+id+'"').length-1,1,id);
 }
 assert.match(script,/availableItems\.push\(\.\.\.fresh\)/);
 assert.match(script,/refreshMerchantOptions\(\);renderListing\(\)/);
 assert.match(script,/if\(id!==requestId\)return/);
 assert.match(script,/moreButton\.addEventListener\("click"/);
 assert.match(script,/seenProductKeys/);
 assert.match(html,/연관 품목을 새로 검색해 보여줍니다/);
});

test('UI memory deduplication mirrors server product identity',()=>{
 const start=script.indexOf('function productKey(p){');
 const end=script.indexOf('function updateMoreControls(',start);
 assert.ok(start>=0&&end>start);
 const f=new Function('let seenProductKeys=new Set();\n'+script.slice(start,end)+'\nreturn {productKey,uniqueNew};')();
 const records=[
  {title:'퍼실 액체세제 2.7L',price:9900,cp_code:'a'},
  {title:'퍼실 액체세제 2.7 L',price:9900,cp_code:'a'},
  {title:'주방세제 1L',price:6500,cp_code:'b'}
 ];
 assert.deepEqual(f.uniqueNew(records),[records[0],records[2]]);
 assert.equal(f.uniqueNew([records[0],records[1]]).length,0);
 assert.equal(f.productKey(records[0]),productIdentity(records[0]));
});
