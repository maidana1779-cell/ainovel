import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {normalizeSdkProducts,parseWon,adpickAffiliateUrl,getShoppingMateProducts,shoppingMateConfigured} from '../shoppingmate.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');

const authenticShaped={
 title:'추천 상품',
 theme_code:'daily',
 list:[{product_name:'테스트 세제 500ml',photo:'https://cdn.example.test/a.jpg',mall:'11st.co.kr',
  price_org:'30,000원',price_sale:'16,500원',buyurl:'https://deg.kr/test-tracking'},
 {product_name:'할인 표시 불가한 제품',mall:'coupang.com',price_sale:'25,000원',buyurl:'https://deg.kr/no-original'}]
};
test('Normalize real SDK documented list fields into verified product prices',()=>{
 const products=normalizeSdkProducts([authenticShaped]);
 assert.equal(products.length,1);
 assert.equal(products[0].title,'테스트 세제 500ml');
 assert.equal(products[0].price,16500);
 assert.equal(products[0].price_org,30000);
 assert.equal(products[0].price_sale,16500);
 assert.equal(products[0].cp_name,'11번가');
 assert.equal(products[0].affiliate_source,'adpick_shoppingmate');
 assert.equal(products[0].commissionlink,'https://deg.kr/test-tracking');
 assert.equal(products[0].photo,'https://cdn.example.test/a.jpg');
});
test('Nested JSON envelope and integer-keyed theme lists are handled',()=>{
 const result=normalizeSdkProducts({data:{'0':authenticShaped}});
 assert.equal(result.length,1);
});
test('No raw affiliate clicks to unsafe or non-affiliate domains',()=>{
 for(const uri of ['javascript:alert(1)','http://deg.kr/a','https://example.net/products/1','https://fakeadpick.co.kr/a','https://deg.kr.evil.com/a','https://username@deg.kr/a']){
   assert.equal(adpickAffiliateUrl(uri),false,uri);
 }
 for(const uri of ['https://deg.kr/safe','https://adpick.co.kr/promo','https://link.adpick.co.kr/xyz']){
  assert.equal(adpickAffiliateUrl(uri),true,uri);
 }
 assert.equal(normalizeSdkProducts({list:[{product_name:'bad product',price_org:30000,price_sale:16500,buyurl:'https://shop.example.com/checkout'}]}).length,0);
});
test('Price validation never invents discounts',()=>{
 assert.equal(parseWon('30,000원'),30000);
 assert.equal(parseWon('16,500원'),16500);
 assert.equal(parseWon('free'),null);
 assert.equal(parseWon(''),null);
 assert.equal(parseWon('16,500원부터'),null);
 assert.equal(parseWon(0),null);
 assert.equal(normalizeSdkProducts({list:[{product_name:'No sale',price_org:1000,price_sale:2000,buyurl:'https://deg.kr/test'}]}).length,0);
});
test('SDK requires a separate member affid; does not reuse BIZ API key',async()=>{
 assert.equal(shoppingMateConfigured(''),false);
 assert.equal(shoppingMateConfigured('member123'),true);
 const result=await getShoppingMateProducts({affid:''});
 assert.deepEqual(result,{configured:false,products:[]});
 assert.match(server,/getShoppingMateProducts\(\)/);
 assert.match(server,/pathname==='\/api\/shoppingmate'/);
 assert.match(server,/configured:false,data:\[\]/);
 assert.doesNotMatch(server,/getShoppingMateProducts\(\{affid:key\}/);
});
test('SDK response is combined with cached hotdeal/recommended offers and deduplicated',async()=>{
 const kinds=[];
 const products=await getShoppingMateProducts({
   affid:'test-fixture-member-unique-26',now:()=>Date.parse('2026-10-25T04:10:00Z'),
   fetchFn:async url=>{
    kinds.push(String(url));
    assert.equal(url.searchParams.get('affid'),'test-fixture-member-unique-26');
    return {ok:true,text:async()=>JSON.stringify({data:[authenticShaped]})};
   }
 });
 assert.equal(products.configured,true);
 assert.equal(products.products.length,1);
 assert.equal(products.products[0].shoppingmate_kind,'hotdeal');
 assert.equal(kinds.length,2,'one call per official endpoint');
 const again=await getShoppingMateProducts({
   affid:'test-fixture-member-unique-26',now:()=>Date.parse('2026-10-25T04:11:00Z'),
   fetchFn:async()=>{throw new Error('must use 5-minute file/memory cache')}
 });
 assert.equal(again.products.length,1);
});
test('Homepage has a separate, hidden-by-default real-offer area and only activates on data',()=>{
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script));
 for(const id of ['shoppingmate-offers','shoppingmate-products']){
   assert.equal(html.split('id="'+id+'"').length-1,1);
 }
 assert.match(script,/fetch\("\/api\/shoppingmate"/);
 assert.match(script,/payload\.configured!==true/);
 assert.match(script,/const offers=payload\.data\.filter\(item=>verifiedDiscount\(item\)\)/);
 assert.match(script,/panel\.hidden=false/);
 assert.match(script,/isShoppingMate=p\.affiliate_source==="adpick_shoppingmate"/);
 assert.match(script,/url\.hostname==="deg\.kr"/);
 assert.match(html,/제휴사에서 제공한 정상가·할인가/);
});
