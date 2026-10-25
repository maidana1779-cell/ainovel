import test from 'node:test';
import assert from 'node:assert/strict';
import {curatedProducts,matchingCuratedProducts} from '../curated-products.mjs';

test('Toss curated product retains the user-provided Sharelink',()=>{
  const p=curatedProducts()[0];
  assert.equal(p.title,'스파클 생수, 무라벨, 500ml, 80개');
  assert.equal(p.commissionlink,'https://toss.shopping/_m/fEfXH2Dz');
  assert.equal(p.affiliate_source,'toss_sharelink');
  assert.equal(p.price,null);
  assert.equal(p.photo,null);
  assert.equal(new URL(p.commissionlink).hostname,'toss.shopping');
});
test('Specific or category searches find the bottled water',()=>{
  for(const q of ['스파클','생수','무라벨','500ml','80개']) {
    assert.equal(matchingCuratedProducts(q).length,1,q);
  }
  for(const q of ['물','라면','커피','노트북','클리오']) {
    assert.equal(matchingCuratedProducts(q).length,0,q);
  }
});
test('Curated public response omits editorial index keywords',()=>{
  const p=curatedProducts()[0];
  assert.equal(p.keywords,undefined);
  assert.equal(matchingCuratedProducts('생수')[0].keywords,undefined);
});

test('All seven Toss Sharelinks preserve the exact shared affiliate links and do not fabricate product photos',()=>{
 const entries=[
  ['스파클 생수, 무라벨, 500ml, 80개','fEfXH2Dz'],
  ['EMS 스마트 발 마사지기, 리모컨 포함, 블랙, 1개','T3YXM88A'],
  ['썬리지 호주산 네이블 오렌지, 중과, 3.5kg, 1박스','vUfumnfn'],
  ['명식품 파래김, 100매, 1개','9DX0e7mh'],
  ['대식가 일키로 부대찌개, 1kg, 3팩','b8L8owyC'],
  ['포레스티 국내제조 땅콩버터, 무첨가, 무가당, 무설탕, 450g, 2개','vd1C807g'],
  ['코주부 밀가루 없는 3분 어묵탕, 210g, 4팩','73U6YhQD']
 ];
 const current=curatedProducts();
 assert.equal(current.length,entries.length);
 const urls=new Set();
 for(let i=0;i<entries.length;i++){
  const p=current[i];
  assert.equal(p.title,entries[i][0]);
  assert.equal(p.commissionlink,'https://toss.shopping/_m/'+entries[i][1]);
  assert.equal(p.affiliate_source,'toss_sharelink');
  assert.equal(p.price,null);
  assert.equal(p.photo,null);
  assert.ok(!urls.has(p.commissionlink));
  urls.add(p.commissionlink);
 }
});
test('New curated products are individually searchable by accurate category keywords',()=>{
 for(const [q,part] of [['발마사지기','EMS'],['오렌지','썬리지'],['파래김','명식품'],['부대찌개','대식가'],['땅콩버터','포레스티'],['어묵탕','코주부']]){
  assert.ok(matchingCuratedProducts(q).some(p=>p.title.includes(part)),q);
 }
});
