import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const noticeStart=page.indexOf('<aside class="affiliate-banner"');
const noticeEnd=page.indexOf('</aside>',noticeStart);
const notice=page.slice(noticeStart,noticeEnd);
test('Marketing hero and category navigation are shopping-focused, not affiliate-jargon-filled',()=>{
 const start=page.indexOf('<header');
 const banner=page.slice(start,noticeStart);
 assert.doesNotMatch(banner,/제휴\s*(?:쇼핑몰|상품|마케팅|링크)/);
 assert.doesNotMatch(banner,/가격 비교/);
 assert.match(banner,/식품부터 생활용품·가전까지/);
 assert.match(page,/<meta name="twitter:title" content="알뜰픽 \| 다양한 상품 둘러보기"/);
});
test('One unambiguous commission notice appears immediately with product listing',()=>{
 assert.ok(noticeStart>page.indexOf('id="deals"'));
 assert.ok(noticeStart<page.indexOf('id="products"'));
 assert.equal(page.split('<aside class="affiliate-banner"').length-1,1);
 assert.match(notice,/광고·제휴 안내/);
 assert.match(notice,/상품 링크를 통한 구매가 발생하면 운영자에게 제휴 수수료가 지급됩니다/);
 assert.match(notice,/주문·결제는 판매처에서 진행됩니다/);
 assert.doesNotMatch(notice,/수수료를 받을 수 있습니다|소정의 수수료/);
});
test('Detailed guide and independent Toss Sharelink disclosure remain visible',()=>{
 for(const pageName of ['guide','privacy','about','contact'])
  assert.ok(page.includes('href="/'+pageName+'.html"'));
 assert.match(page,/토스쇼핑 쉐어링크 활동의 일환/);
 assert.match(page,/표시 가격은 최종 결제 금액과 다를 수 있으며/);
 assert.doesNotMatch(page,/여러 제휴 쇼핑몰 상품을 모아 보여드려요/);
});
