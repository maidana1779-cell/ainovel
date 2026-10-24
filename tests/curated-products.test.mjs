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
