import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMerchantOffer,verifyProductBatch,verifyProductBatchWithMeta} from '../merchant-offers.mjs';
const title='브랜드 무선 이어폰 2세대';
const originalPrice=100000;
function page(availability='InStock',regular=100000,sale=70000,product=title){
 return '<html><script type="application/ld+json">'+JSON.stringify({
  '@context':'https://schema.org','@type':'Product',name:product,
  offers:{'@type':'Offer',price:sale,priceCurrency:'KRW',
   availability:'https://schema.org/'+availability,
   priceSpecification:{'@type':'UnitPriceSpecification',priceType:'https://schema.org/StrikethroughPrice',price:regular,priceCurrency:'KRW'}}
 })+'</script></html>';
}
test('Verified same-product offer supplies strict, same-currency regular/sale values',()=>{
 const value=parseMerchantOffer(page(),title,70000);
 assert.equal(value.stock,'in');
 assert.deepEqual(value.discount,{price_org:originalPrice,price_sale:70000,affiliate_source:'adpick_biz_verified_offer'});
});
test('Sold-out product is identified independently of discount',()=>{
 assert.equal(parseMerchantOffer(page('OutOfStock'),title,70000).stock,'out');
 assert.equal(parseMerchantOffer(page('SoldOut'),title,70000).stock,'out');
 assert.equal(parseMerchantOffer(page('Discontinued'),title,70000).stock,'out');
});
test('Do not manufacture discounts from stale prices, currency mismatch, or different products',()=>{
 assert.equal(parseMerchantOffer(page(),title,69000).discount,null);
 assert.equal(parseMerchantOffer(page('InStock',100000,70000,'관계없는 다른 제품'),title,70000),null);
 assert.equal(parseMerchantOffer(page('InStock',100000,70000).replace('"priceCurrency":"KRW"','"priceCurrency":"USD"'),title,70000),null);
});
test('Missing data, malformed JSON, and unknown stock fail closed',()=>{
 assert.equal(parseMerchantOffer('<html>sold out</html>',title,70000),null);
 assert.equal(parseMerchantOffer('<script type="application/ld+json">bad</script>',title,70000),null);
 assert.equal(parseMerchantOffer(page('BackOrder'),title,70000).stock,'unknown');
});
test('Arbitrary product-supplied URL does not initiate direct server fetch',async()=>{
 const input=[{title,price:70000,commissionlink:'https://127.0.0.1/admin'},
              {title,price:70000,commissionlink:'http://bitl.bz/foo'}];
 assert.deepEqual(await verifyProductBatch(input),input);
});

test('Direct merchant page can suppress confirmed sold-out products without touching tracking links',async()=>{
 const old=globalThis.fetch;
 let count=0;
 globalThis.fetch=async(url)=>{
  count++;
  assert.match(url,/^https:\/\/www\.11st\.co\.kr\/products\//);
  return new Response(page('OutOfStock'),{status:200,headers:{'content-type':'text/html'}});
 };
 try{
  const input=[{title,price:70000,commissionlink:'https://bitl.bz/abc',product_url:'https://www.11st.co.kr/products/123'}];
  assert.deepEqual(await verifyProductBatch(input),[]);
  assert.equal(count,1);
 }finally{globalThis.fetch=old}
});
test('Without direct merchant product URL the affiliate link is never fetched',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('Affiliate tracking URL was touched')};
 try{
  const p={title,price:70000,commissionlink:'https://bitl.bz/test'};
  assert.deepEqual(await verifyProductBatch([p]),[p]);
 }finally{globalThis.fetch=old}
});

test('Korean catalog price formats are accepted but mismatched prices stay unverified',()=>{
 assert.equal(parseMerchantOffer(page(),title,'70,000원').discount.price_sale,70000);
 assert.equal(parseMerchantOffer(page(),title,'69,900원').discount,null);
 assert.equal(parseMerchantOffer(page(),title,'70,000원~').discount,null);
});
test('Coverage metadata distinguishes eligible, unknown and verified unavailable items',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>new Response(page('OutOfStock'),{status:200,headers:{'content-type':'text/html'}});
 try{
  const out=await verifyProductBatchWithMeta([
   {title,price:'70,000원',product_url:'https://www.11st.co.kr/products/coverage-test'},
   {title,price:'70,000원',commissionlink:'https://bitl.bz/unavailable'}
  ]);
  assert.equal(out.items.length,1);
  assert.deepEqual(out.verification,{checked:1,eligible:1,unverified:1,sold_out_removed:1,discounts_verified:0});
 }finally{globalThis.fetch=old}
});
