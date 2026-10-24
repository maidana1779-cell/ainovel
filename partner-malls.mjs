// Public BIZ /malls response (not a product catalogue).
// Keep only provider-originated, click-safe referral links. Never display
// commission_per as a consumer discount.
function safeHttpsImage(value){
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&u.href.length<2048?u.href:null}catch{return null}
}
export function safeAffiliateLink(value){
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&!u.username&&!u.password&&u.href.length<2048&&
    (u.hostname==="link.adpick.co.kr"||(u.hostname==="biz.adpick.co.kr"&&!u.pathname.startsWith("/api/")));
 }catch{return false}
}
export function normalizePartnerMalls(raw){
 const rows=Array.isArray(raw?.data)?raw.data:Array.isArray(raw?.data?.list)?raw.data.list:[];
 const seen=new Set(),valid=[];
 for(const mall of rows.slice(0,150)){
  const name=typeof mall?.name==="string"?mall.name.trim():"";
  const code=typeof mall?.cp_code==="string"?mall.cp_code.trim():"";
  const url=typeof mall?.commissionlink==="string"?mall.commissionlink.trim():"";
  if(!name||name.length>100||!code||code.length>40||!safeAffiliateLink(url))continue;
  const key=code.toLowerCase();
  if(seen.has(key))continue;
  seen.add(key);
  valid.push({
   cp_code:code,name,
   icon:safeHttpsImage(mall.icon),
   title:typeof mall.title==="string"?mall.title.trim().slice(0,140):"",
   commissionlink:url
  });
 }
 return valid;
}
