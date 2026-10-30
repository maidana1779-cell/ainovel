import {normalize} from './relevance.mjs';

// ADPICK BIZ API: omitting cp_code includes all currently search-enabled partner malls.
// Do not pin fixed seller codes: this silently excludes newly approved partners such as Coupang.
// Keep relevance/catalog screening below to exclude unrelated books, tours and accessories.

// Curated keyword batches, not a fabricated API page/offset. Each user-initiated
// "more" request searches NEW terms; the provider only returns up to 20 per call.
// Do not collect or store the supplier's catalog between requests.
const BATCHES=Object.freeze({
  '세제':[['세제'],['주방세제','캡슐세제'],['액체세제','세탁세제']],
  '간편식':[['간편식'],['즉석밥','냉동만두'],['볶음밥','도시락']],
  '커피':[['커피'],['커피믹스','캡슐커피'],['원두커피','콜드브루']],
  '라면':[['라면'],['컵라면','신라면'],['불닭볶음면','진라면']],
  '생수':[['생수'],['삼다수','백산수'],['아이시스','평창수']],
  '이어폰':[['이어폰'],['무선이어폰','에어팟'],['갤럭시버즈']],
  '화장품':[['화장품'],['선크림','립스틱'],['쿠션','스킨케어']],
  '의류':[['의류'],['티셔츠','맨투맨'],['바지','재킷']],
  '주방용품':[['주방용품'],['프라이팬','냄비'],['밀폐용기','도마']],
  // Additional terms are fetched only on the shopper's explicit 'more' interaction.
  '노트북':[['노트북'],['게이밍노트북','삼성 노트북'],['LG 노트북','노트북 15인치']],
  '충전기':[['충전기'],['고속충전기','무선충전기'],['멀티충전기','차량용 충전기']],
  '물티슈':[['물티슈'],['아기물티슈','캡형 물티슈'],['대용량 물티슈']],
  '화장지':[['화장지'],['롤화장지','화장지 30롤'],['천연펄프 화장지']],
  '청소기':[['청소기'],['무선청소기','로봇청소기'],['핸디청소기']],
  '샴푸':[['샴푸'],['두피샴푸','탈모샴푸'],['약산성샴푸']],
  '운동화':[['운동화'],['러닝운동화','남성 운동화'],['여성 운동화']],
  '과자':[['과자'],['스낵과자','초코 과자'],['간식 과자']]
});
export function getSearchPlan(query,batch=0){
  const q=normalize(query);
  const batches=BATCHES[q]||[[String(query).trim()]];
  const codes=null; // Let the provider return all supported malls; do not artificially exclude Coupang.
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
