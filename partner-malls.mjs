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
    (u.hostname==="link.adpick.co.kr"||u.hostname==="bitl.bz"||(u.hostname==="biz.adpick.co.kr"&&!u.pathname.startsWith("/api/")));
 }catch{return false}
}
export function normalizePartnerMalls(raw){
 const rows=Array.isArray(raw?.data)?raw.data:Array.isArray(raw?.data?.list)?raw.data.list:[];
 const byCode=new Map();
 for(const mall of rows.slice(0,500)){
  const name=typeof mall?.name==="string"?mall.name.trim():"";
  const code=typeof mall?.cp_code==="string"?mall.cp_code.trim():"";
  if(!name||name.length>100||!code||code.length>40)continue;
  const rawLink=typeof mall?.commissionlink==="string"?mall.commissionlink.trim():"";
  const commissionlink=safeAffiliateLink(rawLink)?rawLink:null;
  const key=code.toLowerCase();
  const normalized={
   cp_code:code,name,
   icon:safeHttpsImage(mall.icon),
   title:typeof mall.title==="string"?mall.title.trim().slice(0,140):"",
   commissionlink
  };
  // The entire BIZ catalog should be visible even if a shop currently has
  // no usable referral link. Prefer a duplicate with a genuine tracking URL.
  const previous=byCode.get(key);
  if(!previous||(!previous.commissionlink&&commissionlink))byCode.set(key,normalized);
 }
 return [...byCode.values()];
}
