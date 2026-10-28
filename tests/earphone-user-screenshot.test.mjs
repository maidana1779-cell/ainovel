import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inStorefrontCatalog} from '../catalog-policy.mjs';
import {relevantItem} from '../relevance.mjs';
const root=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicRoot=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const start=root.indexOf('function storefrontEligible(p){'),end=root.indexOf('\nfunction displayPrice(',start);
const {storefrontEligible,storefrontSearchMatch}=new Function(root.slice(start,end)+'return {storefrontEligible,storefrontSearchMatch}')();
const reject=[
 {title:'평범한 직장인이었던 내가 이어폰 리셀로 부수입을 만든 방법',cp_name:'크몽'},
 {title:'평범한 직장인이었던 내가 이어폰 리셀로 부수입을 만든 방법',cp_name:'전자몰'},
 {title:'상하이 시티투어 버스 티켓 (가이드 지도 &amp; 이어폰 제공)',cp_name:'KKday'},
 {title:'상하이 시티투어 버스 티켓 (가이드 지도 &amp; 이어폰 제공)',cp_name:'행사몰'},
 {title:'[투명톡+젤리 이어폰냥]',cp_name:'마리오케이스'},
 {title:'카카오프렌즈 에어팟 모양 보관함 케이스',cp_name:'보리보리'},
 {title:'블루투스 이어폰 케이스 휴대용 충전 파우치',cp_name:'판매처'}
];
const accept=[
 {title:'브리츠 BZ-ER7L 오픈형 블루투스 이어폰 귀찌 귀걸이형 무선 이어셋',cp_name:'오늘의집'},
 {title:'[엠지텍] IPX8 초소형 초경량 블루투스 이어폰 레드몽R2',cp_name:'이유몰'},
 {title:'[해외] Choice PHILIPS TAT1320 트루 무선 이어폰 블루투스 6.0 TWS',cp_name:'알리익스프레스'},
 {title:'정품 에어팟 본체 케이스 포함',cp_name:'전자몰'}
];
test('User-reported bad results are filtered on backend and even in 90-second browser caches',()=>{
 assert.equal(root,publicRoot);
 for(const item of reject){
  assert.equal(relevantItem('이어폰',item),false,item.title);
  assert.equal(storefrontSearchMatch('이어폰',item),false,item.title);
 }
 for(const item of accept){
  assert.equal(relevantItem('이어폰',item),true,item.title);
  assert.equal(storefrontEligible(item),true,item.title);
  assert.equal(storefrontSearchMatch('이어폰',item),true,item.title);
 }
 assert.match(root,/value\.items\.filter\(storefrontEligible\)\.filter\(item=>storefrontSearchMatch\(currentQuery,item\)\)/);
 assert.match(root,/if\(currentQuery&&!storefrontSearchMatch\(currentQuery,item\)\)continue/);
});
test('Travel and information vendors are never mistaken for physical shopping merchants',()=>{
 for(const item of reject.slice(0,4)){
  assert.equal(inStorefrontCatalog(item),false,item.title);
  assert.equal(storefrontEligible(item),false,item.title);
 }
 // A physical character case is legal inventory elsewhere, but not an earphone device.
 assert.equal(inStorefrontCatalog(reject[4]),true);
 assert.equal(storefrontSearchMatch('이어폰',reject[4]),false);
 assert.equal(inStorefrontCatalog({title:'브리츠 블루투스 이어폰',cp_name:'전자몰'}),true);
});
