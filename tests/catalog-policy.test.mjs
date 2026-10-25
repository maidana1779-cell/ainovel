import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {catalogMerchantExcluded,inStorefrontCatalog,filterCatalogProducts,restrictCatalogPayload} from '../catalog-policy.mjs';
const fixtures=[
 {title:'무선 이어폰',cp_name:'YES24',commissionlink:'https://biz.adpick.co.kr/r1'},
 {title:'생수 2L',cp_name:'예스이십사'},
 {title:'호텔 예약 패키지',cp_name:'마이리얼트립'},
 {title:'커피 원두 1kg',cp_name:'My Real Trip'},
 {title:'도서 프로그래밍 강좌',cp_name:'11번가'},
 {title:'항공권',cp_name:'쿠팡'},
 {title:'생수 2L',cp_name:'이유몰',commissionlink:'https://biz.adpick.co.kr/r2'},
 {title:'무선 이어폰',cp_name:'보리보리'},
 {title:'전기포트',cp_name:'11번가'},
 {title:'화장품 쿠션 팩트',cp_name:'뷰티몰'},
 {title:'캡슐커피 10개',cp_name:'마트몰'}
];
test('Book, travel and course vendors are excluded from recommendations',()=>{
 for(const seller of ['YES24','YES 24','예스24','예스이십사','교보문고','알라딘','마이리얼트립','My Real Trip','KLOOK','클룩','클래스101','인프런'])
  assert.equal(catalogMerchantExcluded(seller),true,seller);
 for(const seller of ['이유몰','보리보리','11번가','쿠팡','가전몰'])
  assert.equal(catalogMerchantExcluded(seller),false,seller);
});
test('Mixed stores retain genuine merchandise and unchanged affiliate links',()=>{
 const {items,removed}=filterCatalogProducts(fixtures);
 assert.equal(removed,6);
 assert.deepEqual(items,fixtures.slice(6));
 assert.equal(items[0].commissionlink,'https://biz.adpick.co.kr/r2');
 for(const title of ['여행용 파우치','호텔식 수건 10장','생수 2L','의류 티셔츠'])
  assert.equal(inStorefrontCatalog({title,cp_name:'11번가'}),true,title);
});
test('Recommendation API response supports list and nested feed formats',()=>{
 for(const data of [fixtures,{area:'pick',count:11,list:fixtures}]){
  const src={success:true,data,filter_meta:{verification:{unverified:11}}};
  const out=restrictCatalogPayload(src);
  assert.equal((Array.isArray(out.data)?out.data:out.data.list).length,5);
  assert.equal(out.filter_meta.out_of_catalog_removed,6);
  assert.deepEqual(out.filter_meta.verification,src.filter_meta.verification);
 }
});
test('The browser filters cached and live results before the merchant dropdown',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);assert.doesNotThrow(()=>new Script(js));
 assert.match(js,/function storefrontEligible\(p\)/);
 assert.match(js,/if\(!storefrontEligible\(item\)\)continue/);
 assert.match(js,/value\.items\.filter\(storefrontEligible\)/);
 assert.match(js,/if\(storefrontEligible\(p\)&&!known\.has\(key\)\)/);
 assert.match(js,/RECENT_FEED_PREFIX="alttulpick:feed:v2:"/);
});
