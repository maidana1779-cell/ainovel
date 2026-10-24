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
 assert.ok(html.indexOf('id="product-discovery"')<html.indexOf('id="toss-picks"'));
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
 assert.match(script,/fetch\(API_ORIGIN\+"\/api\/best\?area="\+area\+"&limit=10"/);
 assert.match(script,/show\(visible,false,discoveryGrid\)/);
 assert.match(script,/const existing=new Set\(availableItems\.map\(productKey\)\)/);
 assert.match(script,/const seen=new Set\(\)/);
 assert.match(script,/discoveredProducts\.push\(p\)/);
 assert.match(script,/discoveryMore\.addEventListener\("click",loadDiscoveryStep\)/);
 assert.match(script,/if\(!document\.body\.classList\.contains\("category-active"\)\)ensureDiscovery\(\)/);
 assert.match(html,/category-active \.product-discovery\{display:none\}/);
 assert.match(script,/const API_ORIGIN='https:\/\/alttulpick-preview\.onrender\.com'/);
 assert.match(server,/Access-Control-Allow-Origin/);
});
test('Default browsing spends two BIZ requests, extra products require a user click',()=>{
 assert.match(script,/let discoveredProducts=\[\],discoveryLoaded=false,discoveryBusy=false,discoveryStep=0/);
 assert.match(script,/if\(discoveryBusy\|\|discoveryStep>=2/);
 assert.match(script,/discoveryStep=step\+1/);
 assert.match(script,/if\(!discoveryLoaded&&!discoveryBusy\)loadDiscoveryStep\(\)/);
 assert.doesNotMatch(script,/setInterval|setTimeout\(loadDiscovery/);
 assert.match(server,/const TIME_WINDOW=60000, MAX_CALLS=8/);
});
test('Provider product referral links include BIZ short URL but not fake discounts',()=>{
 assert.match(script,/url\.hostname==="bitl\.bz"/);
 assert.match(script,/url\.hostname==="toss\.shopping"/);
 assert.match(script,/link\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(script,/verifiedDiscount\(p\)/);
 assert.match(html,/토스쇼핑 쉐어링크 활동의 일환/);
 assert.match(html,/최저가를 보장하지 않습니다/);
});
