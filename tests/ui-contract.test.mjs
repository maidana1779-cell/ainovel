import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('Redesigned shop preserves critical interactive controls',()=>{
  for(const id of ['searchform','q','categories-buttons','subcategories','subcatlist',
    'products','tabs','product-heading','status','toss-picks','toss-products','quick-searches']){
    const hits=html.match(new RegExp('id="'+id+'"','g'))||[];
    assert.equal(hits.length,1,'unique element '+id);
  }
});
test('Client script parses and binds revised category container',()=>{
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script,'inline app script exists');
  assert.doesNotThrow(()=>new Function(script));
  assert.match(script,/categories=document\.getElementById\("categories-buttons"\)/);
  assert.match(script,/getElementById\("quick-searches"\)\.addEventListener/);
  assert.match(script,/loadCuratedProducts\(\)/);
});
test('Ad and partner disclosures remain in the interface',()=>{
  assert.match(html,/토스쇼핑 쉐어링크 활동의 일환/);
  assert.match(html,/상품 링크를 통한 구매가 발생하면 운영자에게 제휴 수수료가 지급됩니다/);
  const deals=html.indexOf('id="deals"'),notice=html.indexOf('<aside class="affiliate-banner"'),cards=html.indexOf('id="products"');
  assert.ok(deals<notice&&notice<cards,'disclosure is visible immediately before products');
  assert.match(html,/최저가를 보장하지 않습니다/);
});
test('Mobile layout and semantic product sections remain present',()=>{
  assert.match(html,/@media\(max-width:730px\)/);
  assert.match(html,/id="deals"/);
  assert.match(html,/id="toss-picks"/);
  assert.match(html,/data-query="간편식"/);
  assert.match(html,/data-area="popular"/);
  assert.doesNotMatch(html,/heroart|hero-art|토스쇼핑 둘러보기/);
});
