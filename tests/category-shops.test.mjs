import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
test('Six distinct category entrances open dedicated shopping views',()=>{
 assert.ok(script);
 for(const term of ['간편식','세제','이어폰','화장품','의류','주방용품']){
  assert.equal(html.split('data-department="'+term+'"').length-1,1,term);
  assert.equal(html.split('data-query="'+term+'"').length-1,1,term+" legacy category");
 }
 for(const id of ['department-grid','category-intro','category-intro-title','category-intro-description','browse-layout','category-aside','side-links','merchant-filter','product-sort','product-toolbar','visible-count']){
  assert.equal(html.split('id="'+id+'"').length-1,1,id);
 }
 assert.ok(html.indexOf('id="shop-categories"')<html.indexOf('id="deals"'));
 assert.ok(html.indexOf('id="deals"')<html.indexOf('id="toss-picks"'));
});
test('Category routes have safe query-key deep linking, back navigation and in-page sidebar discovery',()=>{
 assert.doesNotThrow(()=>new Script(script));
 assert.match(script,/history\.pushState\(\{category:q\}/);
 assert.match(script,/URLSearchParams\(location\.search\)\.get\("category"\)/);
 assert.match(script,/window\.addEventListener\("popstate"/);
 assert.match(script,/Object\.prototype\.hasOwnProperty\.call\(departmentInfo,requestedDepartment\)/);
 assert.match(script,/sideLinks\.addEventListener\("click"/);
 assert.match(script,/selectCategoryTerm\(btn\.dataset\.sidequery\)/);
 assert.match(script,/renderSubcategories\(q\)/);
});
test('Price sort is local to received products and puts unknown prices last',()=>{
 assert.match(html,/현재 화면에 불러온 상품에만 적용/);
 const begin=script.indexOf('function displayPrice(p){');
 const end=script.indexOf('function resetProductFilters(){',begin);
 assert.ok(begin>=0&&end>begin);
 const displayPrice=new Function(script.slice(begin,end)+'return displayPrice;')();
 assert.equal(displayPrice({price:25000}),25000);
 assert.equal(displayPrice({price:"19,900원"}),19900);
 assert.equal(displayPrice({price:null}),null);
 assert.equal(displayPrice({price:""}),null);
 assert.match(script,/if\(pa===null&&pb!==null\)return 1/);
 assert.match(script,/if\(pa!==null&&pb===null\)return -1/);
 assert.match(script,/const filtered=availableItems\.filter/);
 assert.match(script,/const sorted=filtered\.map/);
 assert.match(script,/merchantFilter\.addEventListener\("change",renderListing\)/);
 assert.match(script,/sortSelect\.addEventListener\("change",renderListing\)/);
 assert.doesNotMatch(script,/sort=.*\/api\/search|\/api\/search.*sort=/);
});
test('Affiliate tracking and disclosures preserved, no mock discount/shipping/rating labels',()=>{
 assert.match(script,/link\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(script,/navigator\.sendBeacon/);
 assert.match(script,/isToss=p\.affiliate_source==="toss_sharelink"/);
 assert.match(html,/쉐어링크 활동의 일환/);
 assert.match(html,/최저가를 보장하지 않습니다/);
 assert.doesNotMatch(html,/무료배송|최대 \d+% 할인|100만명 구매/);
});
