import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const beforeBanner=html.slice(html.indexOf('<header'),html.indexOf('<aside class="affiliate-banner"'));
const notice=html.slice(html.indexOf('<aside class="affiliate-banner"'),html.indexOf('</aside>',html.indexOf('<aside class="affiliate-banner"')));
test('Shop search/brand/hero are customer-facing and free of repeated affiliate jargon',()=>{
 assert.match(beforeBanner,/찾는 상품이나 브랜드를 검색해 보세요/);
 assert.match(beforeBanner,/식품부터 가전까지 필요한 상품을 찾아보세요/);
 assert.doesNotMatch(beforeBanner,/제휴\s*(?:쇼핑몰|상품|마케팅|링크|프로그램)/);
 assert.doesNotMatch(beforeBanner,/가격 비교/);
 assert.doesNotMatch(html,/<p class="section-sub">제휴 쇼핑몰에서 제공한 상품/);
 assert.doesNotMatch(html,/여러 제휴 쇼핑몰 상품을 모아 보여드려요/);
});
test('The consumer sees a clear early paid relationship notice, not just a footer disclaimer',()=>{
 assert.match(notice,/<strong>광고·제휴 안내<\/strong>/);
 assert.match(notice,/상품 링크를 통한 구매가 발생하면 운영자에게 제휴 수수료가 지급됩니다/);
 assert.match(notice,/주문·결제는 각 판매처에서 진행됩니다/);
 assert.ok(html.indexOf('class="affiliate-banner"')<html.indexOf('id="products"'));
 assert.equal(html.match(/<aside class="affiliate-banner"/g)?.length,1);
 assert.doesNotMatch(notice,/수수료를 받을 수 있습니다|소정의 수수료/);
});
test('Specific Toss product disclosure and the detailed purchase policy stay available',()=>{
 assert.match(html,/이 포스팅은 토스쇼핑 쉐어링크 활동의 일환/);
 assert.match(html,/<p class="footer-disclosure">이 사이트에는 제휴 링크/);
 assert.match(html,/구매 전 확인해 주세요/);
 assert.match(html,/상품의 재고와 판매 여부는 실시간으로 확인되지 않으며/);
 for(const name of ['guide','about','privacy','contact'])
  assert.ok(html.includes('href="/'+name+'.html"'));
});
