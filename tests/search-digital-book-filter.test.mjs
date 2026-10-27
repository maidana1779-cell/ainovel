import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inStorefrontCatalog,filterCatalogProducts} from '../catalog-policy.mjs';
import {relevantItem,selectRelevantProducts} from '../relevance.mjs';
const homepage=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const pub=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const begin=homepage.indexOf('function storefrontEligible(p){');
const end=homepage.indexOf('\nfunction displayPrice(',begin);
assert.ok(begin>=0&&end>begin);
const browser=new Function(homepage.slice(begin,end)+'return {storefrontEligible,storefrontSearchMatch};')();
const physical=[
 {title:'소니 WF-1000XM5 무선 이어폰',cp_name:'전자제품몰'},
 {title:'삼성 갤럭시버즈3 무선이어폰',cp_name:'쇼핑몰'},
 {title:'애플 에어팟 프로 2세대 이어폰 본체 충전 케이스 포함',cp_name:'전자제품몰'}
];
const irrelevant=[
 {title:'무선 이어폰 고르는 법 전자 책',cp_name:'기획전몰'},
 {title:'이어폰 구매 가이드 E-Book PDF 다운로드',cp_name:'기획전몰'},
 {title:'이어폰 사용법 이북(e북) 교육 자료',cp_name:'쇼핑몰'},
 {title:'이어폰 비교 전자도서 EPUB',cp_name:'전자제품몰'},
 {title:'블루투스 이어폰 영상 온라인 강의 수강권',cp_name:'쇼핑몰'},
 {title:'무선 이어폰 갤럭시 버즈 실리콘 케이스',cp_name:'전자제품몰'},
 {title:'전자책 리더기 전자도서 단말기',cp_name:'전자제품몰'},
 {title:'어학 실전 PDF 문제집',cp_name:'쇼핑몰'}
];

test('Digital books, downloads and online courses cannot be sold as physical earbuds',()=>{
 for(const p of irrelevant.slice(0,5)){
  assert.equal(inStorefrontCatalog(p),false,p.title);
  assert.equal(relevantItem('이어폰',p),false,p.title);
  assert.equal(browser.storefrontEligible(p),false,p.title);
 }
 assert.deepEqual(filterCatalogProducts([...physical,...irrelevant]).items,[...physical,irrelevant[5]]);
 for(const p of physical){
  assert.equal(inStorefrontCatalog(p),true,p.title);
  assert.equal(relevantItem('이어폰',p),true,p.title);
  assert.equal(browser.storefrontEligible(p),true,p.title);
  assert.equal(browser.storefrontSearchMatch('이어폰',p),true,p.title);
 }
});
test('Browser applies a query-specific guard even to stale or malformed external result feeds',()=>{
 assert.equal(homepage,pub);
 for(const p of irrelevant){
  assert.equal(browser.storefrontSearchMatch('이어폰',p),false,p.title);
 }
 assert.equal(browser.storefrontSearchMatch('이어폰',{title:'무선 이어폰 액세서리 실리콘 케이스'}),false);
 assert.equal(browser.storefrontSearchMatch('이어폰',{title:'무선 충전기'}),false);
 assert.equal(browser.storefrontSearchMatch('이어폰',physical[0]),true);
 assert.equal(browser.storefrontSearchMatch('생수',{title:'스파클 생수 500ml'}),true);
 assert.match(homepage,/if\(currentQuery&&!storefrontSearchMatch\(currentQuery,item\)\)continue/);
 assert.match(homepage,/const filtered=availableItems\.filter\(p=>storefrontEligible\(p\)&&\(!currentQuery\|\|storefrontSearchMatch\(currentQuery,p\)\)/);
 assert.match(homepage,/value\.items\.filter\(storefrontEligible\)\.filter\(item=>storefrontSearchMatch\(currentQuery,item\)\)/);
});
test('API filters irrelevant physical-format lookalikes before recommending them',()=>{
 const all=[...irrelevant,...physical];
 assert.deepEqual(selectRelevantProducts('이어폰',all),physical);
 assert.deepEqual(selectRelevantProducts('무선이어폰',all),physical);
});
