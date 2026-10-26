import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('The first-screen hero presents shopping, not repeated affiliate marketing',()=>{
 const begin=html.indexOf('<section class="hero"');
 const hero=html.slice(begin,html.indexOf('</section>',begin));
 assert.doesNotMatch(hero,/제휴|수수료|파트너/);
 assert.match(hero,/필요한 상품을 빠르게 찾아보세요/);
 assert.doesNotMatch(html,/class="brand-tag">상품 검색 · 가격 비교/);
});
test('Exactly one explicit on-page commission notice sits by the actual product list',()=>{
 assert.equal(html.split('class="affiliate-banner"').length-1,1);
 const deal=html.indexOf('id="deals"'),notice=html.indexOf('class="affiliate-banner"');
 assert.ok(notice>deal&&notice<html.indexOf('id="products"'));
 assert.match(html,/광고·제휴 안내/);
 assert.match(html,/상품 링크를 통한 구매 등으로 운영자가 수수료를 받을 수 있습니다/);
 assert.match(html,/주문·결제는 판매처에서 진행됩니다/);
});
test('A full guide and the distinct Toss disclosure remain without redundant front copy',()=>{
 assert.match(html,/href="\/guide.html"/);
 assert.match(html,/토스쇼핑 쉐어링크 활동의 일환/);
 assert.match(html,/표시 가격은 최종 결제 금액과 다를 수 있으며/);
 assert.doesNotMatch(html,/여러 제휴 쇼핑몰 상품을 모아 보여드려요/);
 assert.doesNotMatch(html,/이 사이트에는 제휴 마케팅 링크가 포함되어 있으며/);
});
