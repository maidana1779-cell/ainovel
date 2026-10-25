import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('Homepage keeps working search and category controls',()=>{
  for(const id of ['q','searchform','quick-searches','categories-buttons','subcategories','subcatlist','tabs','product-heading','status','products','toss-picks','toss-products']) {
    assert.equal(html.split('id="'+id+'"').length-1,1,id+' appears once');
  }
  assert.ok(html.includes('data-query="간편식"'));
  assert.ok(html.includes('data-query="세제"'));
  assert.ok(html.includes('data-area="today"'));
  assert.ok(html.includes('data-quick="생수"'));
});
test('Homepage script parses and retains affiliate search endpoints',()=>{
  const matches=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.equal(matches.length,1);
  assert.doesNotThrow(()=>new Script(matches[0][1]));
  for(const endpoint of ['/api/search','/api/best']) {
    assert.ok(html.includes(endpoint),endpoint);
  }
  // Curated Sharelinks are intentionally rendered locally, without a second API call.
  assert.match(html,/const featuredTossProducts=/);
  assert.match(html,/show\(featuredTossProducts,false,target\)/);
});
test('Product feed precedes Toss product feature, as in new mockup',()=>{
  assert.ok(html.indexOf('id="deals"')<html.indexOf('id="toss-picks"'));
  assert.ok(html.includes('토스쇼핑 쉐어링크 활동의 일환'));
  assert.ok(html.includes('가격은 토스에서 확인'));
  assert.ok(html.includes('@media(max-width:730px)'));
  assert.ok(!html.includes('무료배송'));
});
