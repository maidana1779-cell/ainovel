// Only diversify relevant, deduplicated *search* results, not ranked best feeds.
export function merchantKey(p){return String(p?.cp_code||p?.cp_name||'').trim().toLowerCase()||'unknown'}
export function merchantCount(items){
 return Array.isArray(items)?new Set(items.filter(Boolean).map(merchantKey).filter(x=>x!=='unknown')).size:0;
}
export function interleaveSearchMerchants(items){
 if(!Array.isArray(items))return [];
 const shops=new Map();
 for(const p of items){
  const key=merchantKey(p);
  if(!shops.has(key))shops.set(key,{items:[],offset:0});
  shops.get(key).items.push(p);
 }
 if(shops.size<2)return items.slice();
 const output=[];
 while(output.length<items.length){
  for(const bucket of shops.values()){
   for(let n=0;n<2&&bucket.offset<bucket.items.length;n++)output.push(bucket.items[bucket.offset++]);
  }
 }
 return output;
}
