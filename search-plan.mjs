import {normalize,isGroceryQuery,isDetergentQuery} from './relevance.mjs';

// Codes verified against the user's Adpick account. Unverified malls never enter a search pack.
export const FOOD_STORES=Object.freeze(['f5ff7','c6ac4','c16a2','b735e','f5d5a']);
export const HOUSEHOLD_STORES=Object.freeze(['c16a2','b735e','f5d5a','012a5','2cfd6']);
const EXPANSION=Object.freeze({
 '세제':['세제','주방세제'],
 '간편식':['간편식','즉석밥'],
 '커피':['커피','커피믹스'],
 '라면':['라면','컵라면'],
 '생수':['생수','삼다수'],
 '이어폰':['이어폰','무선이어폰'],
 '의류':['의류','티셔츠'],
 '주방용품':['주방용품','프라이팬'],
 '화장품':['화장품','선크림']
});
export function getSearchPlan(query){
 const q=normalize(query);
 const terms=EXPANSION[q]||[String(query).trim()];
 const codes=isGroceryQuery(q)?FOOD_STORES:isDetergentQuery(q)?HOUSEHOLD_STORES:null;
 return {terms,codes};
}
export function uniqueProductResults(items){
 const seen=new Set();
 return items.filter(item=>{
  const title=normalize(item?.title||'');
  if(!title)return false;
  // Keep separate merchants or pack prices. Sharelinks and Adpick tracking URLs are never altered.
  const key=String(item.affiliate_source||item.cp_code||item.cp_name||'')+'|'+title+'|'+String(item.price??'');
  if(seen.has(key))return false;
  seen.add(key);return true;
 });
}
