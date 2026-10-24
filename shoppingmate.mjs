// Adpick personal-account ShoppingMate SDK (distinct from the BIZ API).
// Source: https://adpick.co.kr/?ac=guide&md=shoppingapi&tac=sdk
// and https://adpick.co.kr/?ac=guide&md=hotdealapi&tac=sdk
// The official SDK asks for file/DB caching and at most 1 call per minute.
// The local /tmp file is ephemeral on Render free; it is NOT a persistent catalog.
// Do not use a third party's affid or infer an affid from the BIZ API key.
import {readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const CACHE_MS=5*60*1000, MIN_INTERVAL_MS=61*1000;
const MAX_RESPONSE_BYTES=3*1024*1024;
const ENDPOINTS=Object.freeze([
  {name:'recommend',path:'sdk_shopping.php'},
  {name:'hotdeal',path:'sdk_shopping_hotdeal.php'}
]);
const state=new Map();
const memory=new Map();
function text(value,max=200){
  return typeof value==='string'?value.trim().slice(0,max):'';
}
export function parseWon(value){
  if(typeof value==='number')return Number.isSafeInteger(value)&&value>0?value:null;
  if(typeof value!=='string'||!/^\s*[0-9][0-9,]*\s*(?:원)?\s*$/.test(value))return null;
  const v=Number(value.replace(/[^0-9]/g,''));
  return Number.isSafeInteger(v)&&v>0?v:null;
}
export function adpickAffiliateUrl(value){
  try{
    const u=new URL(value);
    const host=u.hostname.toLowerCase();
    return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2048&&
      (host==='deg.kr'||host==='adpick.co.kr'||host.endsWith('.adpick.co.kr'));
  }catch{return false}
}
function validatedPhoto(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&url.href.length<=2048&&!url.username&&!url.password?url.href:null;
  }catch{return null}
}
function mallName(value){
  const raw=text(value,100);
  let m=raw.toLowerCase();
  try{if(m.startsWith('http'))m=new URL(m).hostname.toLowerCase()}catch{return '제휴 쇼핑몰'}
  const brands=[
    [/11st|11번가/,'11번가'],[/oliveyoung|올리브영/,'올리브영'],
    [/coupang|쿠팡/,'쿠팡'],[/ssg|신세계/,'SSG'],
    [/gmarket|g마켓/,'G마켓'],[/auction|옥션/,'옥션'],
    [/lotte|롯데/,'롯데'],[/gs(shop|eshop)|gs샵/,'GS SHOP'],
    [/cj|씨제이/,'CJ온스타일']
  ];
  for(const [test,name] of brands)if(test.test(m))return name;
  return /^[a-z0-9.-]{2,90}$/.test(m)?m:'제휴 쇼핑몰';
}
// SDK examples may contain themed lists (title/description/theme_code/list)
// or a flat "list" object; avoid assuming all feeds are shaped identically.
function collectLists(root){
  const products=[];
  const seen=new Set();
  function walk(node,depth){
    if(depth>5||!node||typeof node!=='object'||seen.has(node))return;
    seen.add(node);
    if(Array.isArray(node)){for(const child of node.slice(0,150))walk(child,depth+1);return}
    if(typeof node.product_name==='string'&&node.buyurl){products.push(node);return}
    for(const key of ['data','list','items','themes','products','result']){
      if(node[key]&&typeof node[key]==='object')walk(node[key],depth+1);
    }
    // Some theme lists use an object keyed by theme code instead of an array.
    if(depth<=2&&Object.keys(node).some(k=>/^\d+$/.test(k))){
      for(const key of Object.keys(node).filter(k=>/^\d+$/.test(k)).slice(0,80))walk(node[key],depth+1);
    }
  }
  walk(root,0);
  return products;
}
export function normalizeSdkProducts(raw,kind='recommend'){
 const list=collectLists(raw),out=[],duplicates=new Set();
 for(const item of list){
   const title=text(item.product_name,180),link=text(item.buyurl,2048);
   const original=parseWon(item.price_org),sale=parseWon(item.price_sale);
   if(!title||!adpickAffiliateUrl(link)||original===null||sale===null||original<=sale)continue;
   const discountRate=Math.round((original-sale)/original*100);
   if(discountRate<1||discountRate>99)continue;
   const seller=mallName(item.mall);
   const key=title.normalize('NFKC').toLowerCase().replace(/\s+/g,'')+'|'+seller+'|'+sale;
   if(duplicates.has(key))continue;
   duplicates.add(key);
   out.push({
      title,photo:validatedPhoto(item.photo),cp_name:seller,
      price:sale,price_org:original,price_sale:sale,
      commissionlink:link,affiliate_source:'adpick_shoppingmate',
      shoppingmate_kind:kind
   });
   if(out.length>=50)break;
 }
 return out;
}
function filePath(kind,affid){
 const digest=createHash('sha256').update(affid).digest('hex').slice(0,12);
 return join(tmpdir(),'alttulpick-sdk-'+kind+'-'+digest+'.json');
}
async function cachedFromFile(kind,affid){
 try{
  const obj=JSON.parse(await readFile(filePath(kind,affid),'utf8'));
  return obj&&Array.isArray(obj.products)&&Number.isFinite(obj.at)?obj:null;
 }catch{return null}
}
async function fetchFeed(kind,affid,{fetchFn=fetch,now=Date.now}={}){
 const cacheKey=kind+'|'+affid;
 let cached=memory.get(cacheKey);
 if(!cached){
   cached=await cachedFromFile(kind,affid);
   if(cached)memory.set(cacheKey,cached);
 }
 if(cached&&now()-cached.at<CACHE_MS)return cached.products;
 let current=state.get(cacheKey);
 if(current?.promise)return current.promise;
 if(current&&now()-current.lastAttempt<MIN_INTERVAL_MS)return cached?.products||[];
 // Respect each SDK endpoint's 1-minute minimum even after a failed fetch.
 current={lastAttempt:now(),promise:null};
 const promise=(async()=>{
   const endpoint=ENDPOINTS.find(p=>p.name===kind);
   const url=new URL('https://adpick.co.kr/apis/'+endpoint.path);
   url.searchParams.set('affid',affid);
   const response=await fetchFn(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
   if(!response.ok)throw Error('ShoppingMate endpoint error');
   const rawText=await response.text();
   if(rawText.length>MAX_RESPONSE_BYTES)throw Error('ShoppingMate response too large');
   const data=JSON.parse(rawText);
   if(data?.success===false||data?.error)throw Error('ShoppingMate feed rejected');
   const products=normalizeSdkProducts(data,kind);
   const result={at:now(),products};
   memory.set(cacheKey,result);
   // SDK asks for file storage to avoid excessive calls. /tmp is ephemeral.
   await writeFile(filePath(kind,affid),JSON.stringify(result),{mode:0o600}).catch(()=>{});
   return products;
 })().catch(()=>cached&&now()-cached.at<CACHE_MS?cached.products:[]);
 current.promise=promise;state.set(cacheKey,current);
 try{return await promise}finally{current.promise=null}
}
export function shoppingMateConfigured(affid=process.env.ADPICK_AFFID){
 return typeof affid==='string'&&/^[a-zA-Z0-9_.-]{2,100}$/.test(affid);
}
export async function getShoppingMateProducts({affid=process.env.ADPICK_AFFID,fetchFn=fetch,now=Date.now}={}){
 if(!shoppingMateConfigured(affid))return {configured:false,products:[]};
 const entries=await Promise.all(ENDPOINTS.map(x=>fetchFeed(x.name,affid,{fetchFn,now})));
 const seen=new Set(),products=[];
 for(const item of [...entries[1],...entries[0]]){
  const key=item.title.normalize('NFKC').toLowerCase().replace(/\s+/g,'')+'|'+item.cp_name+'|'+item.price_sale;
  if(seen.has(key))continue;
  seen.add(key);products.push(item);
  if(products.length>=24)break;
 }
 return {configured:true,products};
}
