import {normalize,isGroceryQuery,isDetergentQuery} from './relevance.mjs';

// Only provider-confirmed mall codes are used for restricted searches.
export const FOOD_STORES=Object.freeze(['f5ff7','c6ac4','c16a2','b735e','f5d5a']);
export const HOUSEHOLD_STORES=Object.freeze(['c16a2','b735e','f5d5a','012a5','2cfd6']);

// Curated keyword batches, not a fabricated API page/offset. Each user-initiated
// "more" request searches NEW terms; the provider only returns up to 20 per call.
// Do not collect or store the supplier's catalog between requests.
const BATCHES=Object.freeze({
  '세제':[['세제','주방세제'],['캡슐세제','액체세제'],['세탁세제','분말세제']],
  '간편식':[['간편식','즉석밥'],['냉동만두','볶음밥'],['도시락','컵밥']],
  '커피':[['커피','커피믹스'],['캡슐커피','원두커피'],['콜드브루','드립백']],
  '라면':[['라면','컵라면'],['신라면','불닭볶음면'],['진라면','짜파게티']],
  '생수':[['생수','삼다수'],['백산수','아이시스'],['평창수','에비앙']],
  '이어폰':[['이어폰','무선이어폰'],['에어팟','갤럭시버즈']],
  '화장품':[['화장품','선크림'],['립스틱','쿠션'],['클렌징','스킨케어']],
  '의류':[['의류','티셔츠'],['맨투맨','바지'],['재킷','패딩']],
  '주방용품':[['주방용품','프라이팬'],['냄비','밀폐용기'],['도마','그릇']]
});
export function getSearchPlan(query,batch=0){
  const q=normalize(query);
  const batches=BATCHES[q]||[[String(query).trim()]];
  const codes=isGroceryQuery(q)?FOOD_STORES:isDetergentQuery(q)?HOUSEHOLD_STORES:null;
  return {terms:batches[batch]||[],codes,totalBatches:batches.length,batch};
}
export function productIdentity(item){
  return String(item?.affiliate_source||item?.cp_code||item?.cp_name||'')+'|'+
    normalize(item?.title||'')+'|'+String(item?.price??'');
}
export function uniqueProductResults(items){
 const seen=new Set();
 return items.filter(item=>{
  const title=normalize(item?.title||'');
  if(!title)return false;
  const key=productIdentity(item);
  if(seen.has(key))return false;
  seen.add(key);return true;
 });
}
