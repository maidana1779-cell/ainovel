import {createHash} from 'node:crypto';
import {inStorefrontCatalog} from './catalog-policy.mjs';

export const CATALOG_CATEGORIES=Object.freeze(['food','living','digital','beauty','fashion','kitchen']);
const kinds=new Set(CATALOG_CATEGORIES);
const linkedHosts=new Set(['biz.adpick.co.kr','link.adpick.co.kr','bitl.bz','toss.shopping']);
const sourcePattern=/^[a-z0-9][a-z0-9:_-]{1,79}$/i;
export function catalogEnabled(env=process.env){
 return env.CATALOG_LICENSE_APPROVED==='true'&&typeof env.CATALOG_DATABASE_URL==='string'&&!!env.CATALOG_DATABASE_URL.trim();
}
export function catalogStatus(env=process.env){
 const licensed=env.CATALOG_LICENSE_APPROVED==='true',database=!!String(env.CATALOG_DATABASE_URL||'').trim();
 return {success:true,enabled:licensed&&database,license_approved:licensed,database_configured:database,
  mode:licensed&&database?'licensed_catalog':'awaiting_license_and_persistent_storage',
  categories:CATALOG_CATEGORIES};
}
function clean(s,max=180){return String(s??'').normalize('NFKC').trim().slice(0,max)}
function httpsUrl(raw,merchantLink=false){
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.href.length>2048)return null;
  if(merchantLink&&!linkedHosts.has(u.hostname.toLowerCase()))return null;
  if(merchantLink&&u.hostname==='toss.shopping'&&!/^\/_m\/[A-Za-z0-9]+$/.test(u.pathname))return null;
  return u.href;
 }catch{return null}
}
function amount(v){
 if(v==null||v==='')return null;
 if(typeof v!=='number'&&typeof v!=='string')return null;
 const text=String(v).replace(/[,원\s]/g,'');
 if(!/^\d{1,12}$/.test(text))return null;
 const n=Number(text);
 return Number.isSafeInteger(n)&&n>0?n:null;
}
export function normalizeLicensedCatalog(records,{sourceId,checkedAt=new Date(),ttlHours=24}={}){
 if(!sourcePattern.test(String(sourceId||'')))throw Error('CATALOG_BAD_SOURCE');
 if(!Array.isArray(records)||records.length>500)throw Error('CATALOG_BATCH_LIMIT');
 if(!Number.isFinite(ttlHours)||ttlHours<1||ttlHours>72)throw Error('CATALOG_BAD_TTL');
 const checked=new Date(checkedAt);
 if(!Number.isFinite(checked.valueOf()))throw Error('CATALOG_BAD_DATE');
 const expires=new Date(checked.valueOf()+ttlHours*3600000).toISOString();
 const out=[],seen=new Set();
 for(const p of records){
  if(!p||!kinds.has(p.category)||!inStorefrontCatalog(p))continue;
  const externalId=clean(p.external_id,160),code=clean(p.cp_code||p.cp_name,120);
  const link=httpsUrl(p.commissionlink,true);
  if(!externalId||!code||!link)continue;
  const productKey=createHash('sha256').update([sourceId,code,externalId].join('\u0000')).digest('hex');
  if(seen.has(productKey))continue;seen.add(productKey);
  out.push({product_key:productKey,source_id:sourceId,external_id:externalId,category:p.category,
   title:clean(p.title,220),cp_name:clean(p.cp_name,120),cp_code:clean(p.cp_code,100),
   price:amount(p.price),photo:httpsUrl(p.photo),commissionlink:link,
   checked_at:checked.toISOString(),expires_at:expires});
 }
 return {items:out,received:records.length,rejected:records.length-out.length};
}
export function validateLicensedFeedUrl(raw,hosts){
 const approved=String(hosts??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!approved.length||approved.length>12)throw Error('CATALOG_APPROVED_HOSTS_REQUIRED');
 let url;try{url=new URL(raw)}catch{throw Error('CATALOG_BAD_FEED_URL')}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||
    !approved.includes(url.hostname.toLowerCase())||url.href.length>1800)
  throw Error('CATALOG_FEED_HOST_NOT_ALLOWED');
 if(/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1)/.test(url.hostname))
  throw Error('CATALOG_LOCAL_FEED_BLOCKED');
 return url.href;
}
export async function syncLicensedFeed({env=process.env,fetchImpl=fetch,writeBatch,clock=()=>new Date()}={}){
 // No external call and no persistence are possible before BOTH approvals exist.
 if(!catalogEnabled(env))throw Error('CATALOG_DISABLED_UNTIL_LICENSE_AND_DB');
 if(typeof writeBatch!=='function')throw Error('CATALOG_NO_WRITER');
 const feedUrl=validateLicensedFeedUrl(env.CATALOG_APPROVED_FEED_URL,env.CATALOG_APPROVED_FEED_HOSTS);
 const response=await fetchImpl(feedUrl,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('CATALOG_SOURCE_HTTP_'+response.status);
 if(Number(response.headers.get('content-length')||0)>2000000)throw Error('CATALOG_TOO_LARGE');
 const text=await response.text();
 if(text.length>2000000)throw Error('CATALOG_TOO_LARGE');
 let feed;
 try{feed=JSON.parse(text)}catch{throw Error('CATALOG_INVALID_JSON')}
 if(!Array.isArray(feed?.products))throw Error('CATALOG_INVALID_SHAPE');
 const batch=normalizeLicensedCatalog(feed.products,{sourceId:env.CATALOG_SOURCE_ID,checkedAt:clock()});
 if(feed.products.length>0&&!batch.items.length)throw Error('CATALOG_ALL_REJECTED');
 await writeBatch(batch.items,{source_id:env.CATALOG_SOURCE_ID,received:batch.received,rejected:batch.rejected});
 return {success:true,received:batch.received,imported:batch.items.length,rejected:batch.rejected};
}
