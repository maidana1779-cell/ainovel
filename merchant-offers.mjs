// Merchant offer verification: only explicit public merchant product pages reached through
// explicitly supplied, non-affiliate merchant product URLs are inspected. No affiliate clicks.
const MERCHANT_HOSTS=['11st.co.kr','gmarket.co.kr','auction.co.kr','ssg.com','oliveyoung.co.kr','gsshop.com','lotteon.com','coupang.com','smartstore.naver.com','shopping.naver.com','hmall.com','akmall.com','interpark.com'];
const stockOut=new Set(['OutOfStock','SoldOut','Discontinued']);
const stockIn=new Set(['InStock','LimitedAvailability','OnlineOnly']);
const cache=new Map();
const CACHE_MS=10*60*1000;
const LIMIT=600;
const subdomain=(host,base)=>host===base||host.endsWith('.'+base);
function approvedMerchant(host){return MERCHANT_HOSTS.some(base=>subdomain(host,base))}
function parseUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'&& !u.username&&!u.password&&!u.port&&u.href.length<2200?u:null}catch{return null}}
function money(value){if(typeof value==='number')return Number.isSafeInteger(value)&&value>0?value:null;if(typeof value!=='string'||!/^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)(?:원)?$/.test(value.trim()))return null;const n=Number(value.trim().replace(/[원,]/g,''));return Number.isSafeInteger(n)&&n>0?n:null}
function typeHas(v,name){return (Array.isArray(v)?v:[v]).some(t=>typeof t==='string'&&(t===name||t.endsWith('/'+name)))}
function flatten(input,output=[]){if(Array.isArray(input)){for(const x of input)flatten(x,output)}else if(input&&typeof input==='object'){output.push(input);if(input['@graph'])flatten(input['@graph'],output);if(input.mainEntity)flatten(input.mainEntity,output)}return output}
function cleanTitle(t){return String(t||'').normalize('NFKC').toLowerCase().replace(/[^가-힣a-z0-9]+/g,' ').trim().split(/\s+/).filter(t=>t.length>=2)}
function sameProduct(name,title){const a=cleanTitle(name),b=cleanTitle(title);return a.length>=2&&b.length>=2&&a.filter(x=>b.some(y=>x===y||(x.length>=4&&y.includes(x)))).length>=2}
export function parseMerchantOffer(html,expectedTitle,expectedPrice){
 if(typeof html!=='string'||html.length>1600000)return null;
 const tags=[...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)];
 for(const [,raw] of tags.slice(0,30)){
  let data;try{data=JSON.parse(raw.trim())}catch{continue}
  const objects=flatten(data);
  for(const product of objects){
   if(!typeHas(product['@type'],'Product')||!sameProduct(product.name,expectedTitle))continue;
   const offers=flatten(product.offers).filter(o=>typeHas(o['@type'],'Offer'));
   if(offers.length!==1)continue; // Avoid mismatched variants, price ranges, and sellers.
   const offer=offers[0];
   const currency=offer.priceCurrency;
   if(currency!=='KRW')continue;
   const sale=money(offer.price);
   const spec=flatten(offer.priceSpecification).filter(o=>typeHas(o['@type'],'UnitPriceSpecification'));
   const regularSpec=spec.filter(o=>typeHas(o.priceType,'StrikethroughPrice')||typeHas(o.priceType,'ListPrice'));
   const regular=regularSpec.length===1&&regularSpec[0].priceCurrency==='KRW'?money(regularSpec[0].price):null;
   const availability=typeof offer.availability==='string'?offer.availability.split('/').pop():null;
   const stock=stockOut.has(availability)?'out':stockIn.has(availability)?'in':'unknown';
   // Only show a discount when the live sale equals the catalog price.
   const priceMatches=sale!==null&&money(expectedPrice)===sale;
   const discount=priceMatches&&regular!==null&&regular>sale&&regular<sale*20
    ?{price_org:regular,price_sale:sale,affiliate_source:'adpick_biz_verified_offer'}:null;
   return {stock,discount,checked_at:new Date().toISOString()};
  }
 }
 return null;
}
async function fetchLimited(url){
 const response=await fetch(url,{redirect:'manual',headers:{'Accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(2500)});
 return response;
}
async function verifyOne(item){
 const link=parseUrl(item?.product_url||item?.productUrl||item?.item_url);
 // Never open commission links in a bot: doing so may create artificial affiliate clicks.
 if(!link||!approvedMerchant(link.hostname))return null;
 const cacheKey=link.href;
 const saved=cache.get(cacheKey);
 if(saved&&Date.now()-saved.at<CACHE_MS)return saved.value;
 let result=null;
 try{
  let destination=link;
  // Follow only whitelisted redirects; never reach an arbitrary host.
  for(let hop=0;hop<4;hop++){
   if(!approvedMerchant(destination.hostname))break;
   const response=await fetchLimited(destination.href);
   if(response.status>=300&&response.status<400){
    const location=response.headers.get('location');
    if(!location)break;
    const next=parseUrl(new URL(location,destination).href);
    if(!next||!approvedMerchant(next.hostname))break;
    destination=next;continue;
   }
   if(!response.ok||!approvedMerchant(destination.hostname))break;
   const len=Number(response.headers.get('content-length')||0);
   const contentType=response.headers.get('content-type')||'';
   if(len>1600000||!contentType.toLowerCase().includes('text/html'))break;
   // Enforce a read-size ceiling even for chunked bodies.
   const reader=response.body?.getReader();if(!reader)break;
   const chunks=[];let size=0;let tooLarge=false;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1600000){tooLarge=true;await reader.cancel();break}chunks.push(value)}
   if(tooLarge)break;
   const html=new TextDecoder().decode(Buffer.concat(chunks.map(x=>Buffer.from(x))));
   result=parseMerchantOffer(html,item.title,item.price);
   break;
  }
 }catch{/* Merchant fetch failures never imply sold-out status. */}
 if(cache.size>=LIMIT)cache.delete(cache.keys().next().value);
 cache.set(cacheKey,{at:Date.now(),value:result});
 return result;
}
export async function verifyProductBatchWithMeta(items){
 if(!Array.isArray(items)||!items.length)return {items:Array.isArray(items)?items:[],verification:{checked:0,eligible:0,unverified:0,sold_out_removed:0,discounts_verified:0}};
 const subset=items.slice(0,10);
 const eligible=subset.filter(item=>{const url=parseUrl(item?.product_url||item?.productUrl||item?.item_url);return url&&approvedMerchant(url.hostname)}).length;
 const results=await Promise.all(subset.map(async item=>({item,check:await verifyOne(item)})));
 const verified=results.filter(x=>x.check);
 const returned=results.map(({item,check})=>{
  if(!check)return item;
  if(check.stock==='out')return null;
  return check.discount?{...item,...check.discount}:item;
 }).filter(Boolean);
 return {items:[...returned,...items.slice(10)],verification:{
  checked:verified.length,eligible,unverified:subset.length-verified.length,
  sold_out_removed:results.filter(x=>x.check?.stock==='out').length,
  discounts_verified:results.filter(x=>x.check?.discount&&x.check.stock!=='out').length
 }};
}
export async function verifyProductBatch(items){
 const outcome=await verifyProductBatchWithMeta(items);
 return outcome.items;
}
