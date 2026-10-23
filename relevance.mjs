// In-memory filtering of current Adpick API response, never storing product data.
const ALIASES = {
  "간편식": ["간편식","즉석밥","도시락","볶음밥","냉동식품","햇반","컵밥","라면","국밥","레토르트"],
  "세제": ["세제","세탁","섬유유연제"],
  "이어폰": ["이어폰","에어팟","갤럭시버즈","블루투스이어버드"],
  "무선이어폰": ["무선이어폰","블루투스이어폰","에어팟","갤럭시버즈"],
  "화장품": ["화장품","스킨케어","립스틱","쿠션","파운데이션","선크림","클렌징","토너","에센스","크림","파우더"],
  "의류": ["의류","티셔츠","맨투맨","스웨터","바지","셔츠","니트","자켓","재킷","원피스","후드티"],
  "주방용품": ["주방용품","프라이팬","후라이팬","도마","밀폐용기","냄비","그릇","수세미","주방세제"]
};
const FOOD_QUERIES = new Set(["라면","간편식","즉석밥","도시락","볶음밥","냉동식품","햇반","컵밥","국밥","레토르트","커피","생수","쌀","과자"]);
const NON_FOOD_MERCHANT = /마이리얼트립|클룩|와그|klook|myrealtrip|여기어때|야놀자|트립닷컴|agoda|아고다|익스피디아/i;
const NON_FOOD_TITLES = /개발자|프로그래밍|코딩|개발\s?강의|온라인\s?강의|수강권|강의|강좌|세미나|입문서|전자책|e-?book|도서|교재|튜토리얼|취업\s?준비|자격증|패키지\s?여행|투어|여행|호텔|숙박|항공권|버스\s?투어|기차표|입장권|체험권|여행\s?가이드|키링|피규어|모형|스티커|컵받침|텀블러/i;

export function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[^가-힣a-z0-9]/g,"");
}
function ramenIsFood(title) {
  const compact=normalize(title);
  // Actual packaged noodle brands or styles; do not accept arbitrary suffix "..라면".
  const noodleNames=["신라면","진라면","열라면","삼양라면","참깨라면","컵라면","봉지라면","김치라면",
    "볶음면","비빔면","짜파게티","너구리","왕뚜껑","컵누들","짜장범벅","안성탕면","사발면",
    "튀김우동","짜왕","진짬뽕","육개장사발","짜장라면","마라라면","쌀라면","치즈라면"];
  if(noodleNames.some(word=>compact.includes(normalize(word))))return true;
  // A standalone '라면' word or '라면사리'/'라면세트' etc.
  if(/(?:^|[\s()[\]{},·/+\-])라면(?=$|[\s()[\]{},·/+\-\d]|사리|세트|멀티|팩|봉지|컵|스프|건면)/.test(title))return true;
  // Compounds without a word break must show a strong food/product cue, e.g. 150g or 5봉.
  return compact.includes("라면") &&
    /(?:농심|오뚜기|삼양|팔도|풀무원|하림|청정원|\d+\s*(?:g|kg|그램|봉|개입|입|팩|묶음|봉지|박스))/i.test(title);
}
export function relevantItem(query,item) {
  if(!item || typeof item.title!=="string" || !item.title.trim())return false;
  const q=normalize(query);
  const title=item.title;
  const compact=normalize(title);
  if(!q)return false;
  if(FOOD_QUERIES.has(q)){
    if(NON_FOOD_MERCHANT.test(String(item.cp_name||"")) || NON_FOOD_TITLES.test(title))return false;
  }
  if(q==="라면")return ramenIsFood(title);
  const terms=ALIASES[q];
  if(terms){
    return terms.some(term=>{
      if(term==="라면")return ramenIsFood(title);
      return compact.includes(normalize(term));
    });
  }
  if(compact.includes(q))return true;
  const words=String(query).trim().split(/[\s,]+/).map(normalize).filter(word=>word.length>=2);
  return words.length>1 && words.every(word=>compact.includes(word));
}
export function relevantTitle(query,title){return relevantItem(query,{title});}
export function selectRelevantProducts(query,items){
  if(!Array.isArray(items))return [];
  return items.filter(item=>relevantItem(query,item));
}
