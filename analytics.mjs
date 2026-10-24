import {normalize} from './relevance.mjs';

// Aggregate-only, RAM-only counters. No IP, cookie, device ID or raw free-form query retained.
// Free Render instances sleep/restart; counters then reset. Do NOT describe these as unique visitors.
const KEEP_DAYS=7;
const searchAllow=new Set([
 '세제','세탁세제','주방세제','캡슐세제','액체세제','간편식','즉석밥','커피','커피믹스',
 '라면','컵라면','생수','삼다수','이어폰','무선이어폰','노트북','화장품','선크림',
 '의류','티셔츠','주방용품','프라이팬','화장지','물티슈','청소용품','샴푸','섬유유연제',
 '수납용품','냉동식품','과자','쌀','볶음밥','냉동만두','도시락','컵밥','캡슐커피',
 '원두커피','콜드브루','드립백','신라면','불닭볶음면','진라면','짜파게티',
 '백산수','아이시스','평창수','에비앙','에어팟','갤럭시버즈','립스틱','쿠션',
 '클렌징','스킨케어','맨투맨','바지','재킷','패딩','냄비','밀폐용기','도마','그릇',
 '세탁세제','무라벨','스파클'
]);
const merchantChoices=[
 ['토스쇼핑',/토스|toss/i],['11번가',/11번가|11st/i],
 ['올리브영',/올리브영|olive\s?young/i],['SSG',/ssg|에스에스지|신세계/i],
 ['GS SHOP',/gs\s?shop|gs홈쇼핑/i],['롯데ON',/롯데|lotte/i],
 ['하이마트',/하이마트|himart/i],['CJ온스타일',/cj|씨제이/i],
 ['G마켓',/g마켓|gmarket/i],['옥션',/옥션|auction/i],
 ['현대Hmall',/현대|hmall/i]
];
export function safeSearchBucket(value){
 const text=normalize(value);
 return searchAllow.has(text)?text:'기타 검색';
}
export function safeMerchantBucket(value){
 const name=String(value??'').slice(0,80);
 return merchantChoices.find(([,rx])=>rx.test(name))?.[0]||'기타 판매처';
}
function localDate(time=Date.now()){
 // Use Korea's calendar day for the shop operator.
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
}
function emptyDay(day){return {day,pageViews:0,searches:0,emptySearches:0,productClicks:0,searchTerms:{},merchants:{}}}
export function createAnalytics({now=()=>Date.now()}={}){
 const startedAt=new Date(now()).toISOString();
 const days=new Map();
 function prune(){
  const cutoff=localDate(now()-((KEEP_DAYS-1)*86400000));
  for(const day of days.keys())if(day<cutoff)days.delete(day);
 }
 function take(){
  prune();const day=localDate(now());
  if(!days.has(day))days.set(day,emptyDay(day));
  return days.get(day);
 }
 function pageView(){take().pageViews++}
 function search(query,results){
  const d=take();d.searches++;
  if(results===0)d.emptySearches++;
  const key=safeSearchBucket(query);d.searchTerms[key]=(d.searchTerms[key]||0)+1;
 }
 function click(merchant){
  const d=take();d.productClicks++;
  const key=safeMerchantBucket(merchant);d.merchants[key]=(d.merchants[key]||0)+1;
 }
 function snapshot(){
  prune();
  const sum={pageViews:0,searches:0,emptySearches:0,productClicks:0};
  const searches={},merchants={};
  const rows=[...days.values()].sort((a,b)=>a.day.localeCompare(b.day));
  for(const d of rows){
   for(const key of Object.keys(sum))sum[key]+=d[key];
   for(const [key,value] of Object.entries(d.searchTerms))searches[key]=(searches[key]||0)+value;
   for(const [key,value] of Object.entries(d.merchants))merchants[key]=(merchants[key]||0)+value;
  }
  const ordered=obj=>Object.entries(obj).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko'))
   .slice(0,12).map(([name,count])=>({name,count}));
  return {startedAt,asOf:new Date(now()).toISOString(),retention:'RAM_ONLY_RESETS_ON_RESTART',
   days:rows.map(d=>({day:d.day,pageViews:d.pageViews,searches:d.searches,emptySearches:d.emptySearches,productClicks:d.productClicks})),
   totals:sum,emptySearchRate:sum.searches?Math.round(sum.emptySearches/sum.searches*1000)/10:0,
   topSearches:ordered(searches),topMerchants:ordered(merchants),
   note:'방문자 수가 아닌 페이지 요청 수이며, 클릭은 구매·수익과 다릅니다. 서버 재시작 시 초기화됩니다.'};
 }
 return {pageView,search,click,snapshot};
}
