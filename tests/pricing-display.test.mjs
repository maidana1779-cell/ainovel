import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {curatedProducts} from '../curated-products.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'inline site script exists');
const from=js.indexOf('function won(value)');
const to=js.indexOf('function resetProductFilters(){',from);
assert.ok(from>=0&&to>from);
const {verifiedDiscount,sourceMoney,won}=new Function(js.slice(from,to)+'return {verifiedDiscount,sourceMoney,won};')();
const fromFeed=(price_org,price_sale,price)=>({affiliate_source:'adpick_biz_verified_offer',price_org,price_sale,price});

test('Verified 30,000 to 16,500 sale is precisely 45% off',()=>{
 const d=verifiedDiscount(fromFeed('30,000원','16,500원','16,500원'));
 assert.deepEqual(d,{original:30000,sale:16500,rate:45});
 assert.equal(won(d.original),'30,000원');
 assert.equal(won(d.sale),'16,500원');
});
test('Unverified BIZ search prices cannot masquerade as discounted',()=>{
 assert.equal(verifiedDiscount({price:'16,500원',price_org:'30,000원',price_sale:'16,500원'}),null);
 assert.equal(verifiedDiscount({affiliate_source:'adpick_biz',price:'16,500원',price_org:'30,000원',price_sale:'16,500원'}),null);
 assert.equal(verifiedDiscount({affiliate_source:'adpick_biz_verified_offer',price:'16,500원'}),null);
 assert.equal(verifiedDiscount(fromFeed('30,000원','16,500원','19,900원')),null);
});
test('Invalid, unchanged and greater-than-normal price cannot show a discount',()=>{
 for(const t of [
  ['16,500원','16,500원','16,500원'],['10,000원','16,500원','16,500원'],
  ['0','16,500원','16,500원'],['삼만원','16,500원','16,500원'],
  ['999,999,999,999,999,999원','16,500원','16,500원'],
  ['30,000원','free','16,500원'],['30,000원',null,'16,500원'],
  ['30,000원','0원','0원'],['30,000원','16,500원','abc']
 ]){
  assert.equal(verifiedDiscount(fromFeed(...t)),null,JSON.stringify(t));
 }
});
test('Price input parser accepts normal KRW strings and rejects untrusted copy',()=>{
 assert.equal(sourceMoney('30,000원'),30000);
 assert.equal(sourceMoney('16,500원'),16500);
 assert.equal(sourceMoney(16500),16500);
 assert.equal(sourceMoney('16,500원~'),null);
 assert.equal(sourceMoney('최대 50% 16,500원'),null);
 assert.equal(sourceMoney('상품 16,500원'),null);
 assert.equal(sourceMoney(null),null);
});
test('Current Adpick API products and unpriced curated Sharelink have no fake discount',()=>{
 const item={title:'주방세제',price:'16,500원',cp_name:'11번가'};
 assert.equal(verifiedDiscount(item),null);
 const toss=curatedProducts().find(x=>x.affiliate_source==='toss_sharelink');
 assert.ok(toss);
 assert.equal(toss.price,null);
 assert.equal(verifiedDiscount(toss),null);
});
test('Real HTML price component is guarded and affiliate link/disclosures are preserved',()=>{
 assert.doesNotThrow(()=>new Script(js));
 assert.match(js,/const discount=verifiedDiscount\(p\)/);
 assert.match(js,/if\(discount\)/);
 assert.match(js,/make\("s","regular-price",won\(discount\.original\)\)/);
 assert.match(js,/discount\.rate\+"% 할인"/);
 assert.match(js,/price===null\?\(p\.affiliate_source==="toss_sharelink"/);
 assert.match(html,/판매처 확인 가격 · 결제 시 변동 가능/);
 assert.match(js,/link\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(html,/쉐어링크 활동의 일환/);
 assert.match(html,/최저가를 보장하지 않습니다/);
});
test('Larger type on desktop and mobile, two-column cards remain',()=>{
 assert.match(html,/\.product\{font-size:14px;/);
 assert.match(html,/\.price\{font-size:24px;/);
 assert.match(html,/\.merchant\{color:#5e718a;font-size:12px;/);
 assert.match(html,/\.department-name\{font-size:16px;/);
 assert.match(html,/\.product\{font-size:13px;min-height:62px;/);
 assert.match(html,/\.price\{font-size:20px;margin:0 0 12px/);
 assert.match(html,/\.grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
