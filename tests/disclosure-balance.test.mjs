import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewPreflight} from '../review-preflight.mjs';
import {curatedProducts} from '../curated-products.mjs';
const homepage=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const get=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Site branding, search and categories lead with shopping, not repeated affiliate explanations',()=>{
 const body=homepage.slice(homepage.indexOf('<body'),homepage.indexOf('<section id="deals"'));
 assert.doesNotMatch(body,/제휴 쇼핑몰|제휴 상품 안내 서비스|수수료를 받을 수 있습니다/);
 assert.doesNotMatch(body,/class="affiliate-banner"/);
 assert.match(body,/식품부터 가전까지, 필요한 상품을 빠르게 찾아보세요/);
 assert.match(body,/id="searchform"/);
 assert.match(body,/id="department-grid"/);
});
test('General purchase commission appears visibly once immediately before product results',()=>{
 const matches=[...homepage.matchAll(/id="affiliate-disclosure"/g)];
 assert.equal(matches.length,1);
 const start=homepage.indexOf('<section id="deals"');
 const notice=homepage.indexOf('id="affiliate-disclosure"');
 const grid=homepage.indexOf('id="products"');
 assert.ok(start<notice&&notice<grid);
 const excerpt=homepage.slice(notice,grid);
 assert.match(excerpt,/상품 링크를 통해 구매하면 운영자가 수수료를 받을 수 있습니다/);
 assert.match(excerpt,/구매·결제는 판매처에서 진행됩니다/);
 assert.match(excerpt,/href="\/guide\.html"/);
 assert.match(homepage,/\.product-affiliate-notice\{margin:0 0 12px;padding:10px 0/);
});
test('Footer and policy guide remain reachable without repeating commission on every section',()=>{
 const footer=homepage.slice(homepage.indexOf('<section id="about"'));
 assert.doesNotMatch(footer,/제휴 상품 안내 서비스|제휴 마케팅 링크가 포함|수수료를 받을 수 있습니다/);
 assert.match(footer,/href="\/guide\.html"/);
 assert.match(footer,/href="\/privacy\.html"/);
 assert.match(footer,/href="\/contact\.html"/);
 assert.match(homepage,/토스쇼핑 쉐어링크 활동의 일환/);
});
test('Strict review preflight passes concise product-level disclosure and fails without it',()=>{
 const args={homepage,contact:get('../public/contact.html'),privacy:get('../public/privacy.html'),
  guide:get('../public/guide.html'),products:curatedProducts()};
 const pass=reviewPreflight(args);
 assert.equal(pass.blockers.length,0,pass.blockers.join(','));
 const removed=homepage.replace(/<p class="product-affiliate-notice" id="affiliate-disclosure">[\s\S]*?<\/p>/,'');
 const fail=reviewPreflight({...args,homepage:removed});
 assert.ok(fail.blockers.some(s=>/경제적 이해관계 고지/.test(s)));
});
