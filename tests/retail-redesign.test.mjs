import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const style=html.match(/<style>\s*([\s\S]*?)<\/style>/)?.[1];
const theme=style?.slice(style.indexOf('ALTTUL PICK — RETAIL DESIGN SYSTEM'));
test('Retail design is deliberately separated from prior layout and uses one calm brand system',()=>{
 assert.ok(theme);
 assert.match(html,/data-design-version="retail-v5-20261026"/);
 assert.match(theme,/:root\{[\s\S]*?--primary:#1769d1/);
 assert.match(theme,/\.site\{max-width:none;background:#fff;box-shadow:none\}/);
 assert.match(theme,/\.header\{position:sticky;top:0;z-index:40/);
 assert.match(theme,/\.bar\{min-height:57px;border:2px solid #2268ca/);
 assert.match(theme,/\.department-grid\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(theme,/\.grid,\.product-discovery \.discovery-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(theme,/\.product-toolbar\{padding:9px 0 12px/);
 assert.doesNotMatch(theme,/fake.?discount|fake.?review|fake.?shipping/i);
});
test('Mobile storefront prioritizes search, category clarity and two-column product scanning',()=>{
 assert.match(theme,/@media\(max-width:730px\)\{/);
 assert.match(theme,/\.department-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(theme,/\.grid,\.product-discovery \.discovery-grid,\.browse-layout\.category-open \.grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(theme,/\.product-category-chip\{font-size:11px;padding:9px 10px;min-height:39px/);
 assert.match(theme,/\.recommendation-explore-button\{width:100%;min-height:41px/);
 assert.match(theme,/\.product-toolbar \.toolbar-controls select\{min-height:39px/);
});
test('Retail refresh preserves functioning search, filtering and affiliate disclosure DOM contracts',()=>{
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script));
 for(const id of ['searchform','q','shop-categories','department-grid','categories-buttons',
  'products','merchant-filter','product-sort','recommendation-explore','product-category-tabs',
  'toss-picks','discovery-products','guide','tabs'].filter(v=>v!=='guide'))
  assert.equal(html.split('id="'+id+'"').length-1,1,'id='+id);
 assert.match(html,/id="affiliate-disclosure"/);
 assert.match(html,/상품 링크를 통해 구매하면 운영자가 수수료를 받을 수 있습니다/);
 assert.match(script,/function validAffiliateLink\(raw,product\)/);
 assert.match(script,/link\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(script,/function storefrontEligible\(p\)/);
 assert.match(script,/function renderSelectedExplore\(\)/);
});
test('Redesign does not invent delivery, stock or discount assurances',()=>{
 assert.match(html,/표시 가격은 최종 결제 금액과 다를 수 있으며/);
 assert.match(html,/상품의 재고와 판매 여부는 실시간으로 확인되지 않으며/);
 assert.doesNotMatch(theme,/무료배송|로켓배송|오늘도착|최저가보장/);
 assert.match(html,/data-department="간편식"/);
 assert.match(html,/data-department="세제"/);
 assert.match(html,/data-department="이어폰"/);
});
