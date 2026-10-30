import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];

test('Homepage prioritizes product feeds and no longer advertises a mall directory',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 for(const id of ['product-discovery','discovery-products','discovery-status','discovery-more']){
   assert.equal(html.split('id="'+id+'"').length-1,1,id);
 }
 assert.ok(html.indexOf('id="product-discovery"')>html.indexOf('id="deals"'));
 assert.ok(html.indexOf('id="toss-picks"')<html.indexOf('id="product-discovery"'));
 assert.doesNotMatch(html,/제휴몰 둘러보기|partner-malls|쇼핑몰 찾기/);
 assert.doesNotMatch(script,/\/api\/malls|loadPartnerMalls|mallGrid/);
 assert.doesNotMatch(server,/\/api\/malls|normalizePartnerMalls/);
});
test('BIZ best remains customer-focused and does not show operator-commission picks',()=>{
 for(const area of ['today','popular','pick']){
  assert.equal((html.match(new RegExp('<button[^>]*data-area="'+area+'"','g'))||[]).length,1,area);
 }
 assert.doesNotMatch(html,/data-area="commission"|최고 수익 상품/);
 assert.match(server,/\['today','popular','pick'\]\.includes\(area\)/);
});
test('Main today grid and distinct additional popular-product grid render live products',()=>{
 assert.match(script,/load\("\/api\/best\?area=today&limit=10"\)/);
 assert.match(script,/const area=step===0\?"popular":"pick"/);
 assert.match(script,/const endpoint="\/api\/best\?area="\+area\+"&limit=10"/);
 assert.match(script,/fetchProducts\(endpoint\)/);
 assert.match(script,/timeZone:"Asia\/Seoul"/);
 assert.match(html,/상품의 재고와 판매 여부는 실시간으로 확인되지 않으며/);
 assert.doesNotMatch(script,/if\(!isDemo\)box\.append\(make\("div","price-reference","실시간 재고 확인 불가/);
 assert.match(script,/show\(visible,false,discoveryGrid\)/);
 assert.match(script,/const existing=new Set\(availableItems\.map\(productKey\)\)/);
 assert.match(script,/const seen=new Set\(\)/);
 assert.match(script,/discoveredProducts\.push\(p\)/);
 assert.match(script,/discoveryMore\.addEventListener\("click",loadDiscoveryStep\)/);
 assert.match(script,/observer\.observe\(discoverySection\)/);
 assert.match(script,/if\(primaryPending\|\|!discoveryInView/);
 assert.match(html,/category-active \.product-discovery\{display:none\}/);
 assert.match(script,/const API_ORIGIN='https:\/\/alttulpick-api\.maidana1779\.workers\.dev'/);
 assert.match(server,/Access-Control-Allow-Origin/);
});
test('Default browsing spends two BIZ requests, extra products require a user click',()=>{
 assert.match(script,/let discoveredProducts=\[\],discoveryLoaded=false,discoveryBusy=false,discoveryStep=0/);
 assert.match(script,/if\(discoveryBusy\|\|discoveryStep>=2/);
 assert.match(script,/discoveryStep=step\+1/);
 assert.match(script,/if\(!discoveryLoaded&&!discoveryBusy\)loadDiscoveryStep\(\)/);
 assert.match(script,/if\(id===requestId\)\{/);
 assert.match(script,/primaryPending=false;/);
 assert.match(script,/renderSelectedExplore\(\)/);
 assert.match(script,/if\(discoveryInView\)ensureDiscovery\(\)/);
 const discoveryScript=script.slice(script.indexOf("async function loadDiscoveryStep()"),script.indexOf("function ensureDiscovery()"));
 assert.doesNotMatch(discoveryScript,/setInterval|setTimeout/);
 assert.match(server,/const TIME_WINDOW=60000, MAX_CALLS=8/);
});
test('Provider product referral links include BIZ short URL but not fake discounts',()=>{
 assert.match(script,/\["biz\.adpick\.co\.kr","link\.adpick\.co\.kr","bitl\.bz"\]\.includes\(url\.hostname\)/);
 assert.match(script,/url\.hostname==="toss\.shopping"/);
 assert.match(script,/link\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(script,/verifiedDiscount\(p\)/);
 assert.match(html,/토스쇼핑 쉐어링크 활동의 일환/);
 assert.match(html,/최저가를 보장하지 않습니다/);
});
