// Conservative, explainable classification for current Adpick search responses.
// No product data is persisted. The API does not provide trusted product taxonomy.
const CATEGORY_ALIASES = {
  "세제":["세제","세탁세제","캡슐세제","섬유유연제"],
  "이어폰":["이어폰","에어팟","갤럭시버즈","이어버드","버즈프로"],
  "무선이어폰":["무선이어폰","블루투스이어폰","에어팟","갤럭시버즈","이어버드"],
  "화장품":["화장품","스킨케어","립스틱","쿠션","파운데이션","선크림","클렌징","토너","에센스","크림","파우더","브로우","아이브로우","래커","틴트"],
  "의류":["의류","티셔츠","맨투맨","스웨터","바지","셔츠","니트","자켓","재킷","원피스","후드티","패딩","조끼"],
  "주방용품":["주방용품","프라이팬","후라이팬","도마","밀폐용기","냄비","그릇","수세미","주방세제"]
};
const GROCERY_TERMS = {
  "라면":["신라면","진라면","열라면","삼양라면","참깨라면","컵라면","봉지라면","김치라면",
    "볶음면","비빔면","짜파게티","너구리","왕뚜껑","컵누들","짜장범벅","안성탕면",
    "사발면","튀김우동","짜왕","진짬뽕","짜장라면","불닭볶음면","불닭","라면사리"],
  "커피":["커피믹스","캡슐커피","커피캡슐","원두커피","커피원두","원두","드립백","콜드브루",
    "아메리카노","에스프레소","카페라떼","카페라테","라떼","모카골드","카누","맥심",
    "네스카페","맥스웰","블랙커피","인스턴트커피","더치커피","핸드드립","일리커피"],
  "간편식":["간편식","즉석밥","도시락","볶음밥","냉동식품","햇반","컵밥","국밥","레토르트","죽","미역국","육개장","냉동만두","만두","카레"],
  "생수":["생수","삼다수","백산수","아이시스","평창수","에비앙","워터"],
  "과자":["과자","스낵","감자칩","새우깡","꼬북칩","비스킷","쿠키"],
  "쌀":["쌀","백미","현미","잡곡","찹쌀"]
};
const FOOD_QUERY_SET = new Set(["라면","커피","간편식","생수","과자","쌀","원두","라떼","즉석밥","볶음밥","햇반","국밥","도시락","냉동식품","컵밥"]);
const NON_GROCERY_MERCHANT = /마이리얼트립|클룩|와그|klook|myrealtrip|여기어때|야놀자|트립닷컴|agoda|아고다|익스피디아|필웨이|머스트잇|발란|트렌비|클래스101|인프런|패스트캠퍼스|탈잉|유데미|교보문고|알라딘|예스24|리디북스/i;
const EDUCATION_TRAVEL = /개발자|개발|프로그래밍|코딩|코틀린|kotlin|ktor|spring|스프링\s?부트|백엔드|서버\s?개발|주문\s?시스템|강의|강좌|세미나|수강|전자책|e-?book|도서|교재|튜토리얼|취업|자격증|패키지\s?여행|여행|투어|호텔|숙박|항공권|입장권|체험권|체험\s?프로그램|어학|인강/i;
const OTHER_PHYSICAL = /패딩|조끼|점퍼|자켓|재킷|후드|티셔츠|셔츠|블라우스|원피스|바지|스커트|운동화|스니커즈|구두|신발|가방|백팩|지갑|키링|피규어|인형|모형|스티커|포스터|머그컵|컵받침|텀블러|프린팅|장난감|파우더|립스틱|쿠션\s?팩트|클리오|아이브로우|브로우|래커|메이크업|틴트|스킨케어|샴푸|향수|헤어\s?제품|로션|비누|세탁\s?세제|주방\s?세제|커피\s?(?:머신|메이커|포트|그라인더|필터|프레스|용품|도구|잔|컵|머그|주전자|서버|드리퍼|주문)/i;

export function normalize(value){
  return String(value??"").normalize("NFKC").toLowerCase().replace(/[^가-힣a-z0-9]/g,"");
}
// Unlike normalize(), tokenization NEVER fuses parts from adjacent words.
// "래커 피넛브라운" must not turn into "래커피넛브라운" and manufacture "커피".
function productTokens(value){
  return String(value??"").normalize("NFKC").toLowerCase()
    .replace(/[^가-힣a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean);
}
function hasPhraseToken(tokens,needle){
  const n=normalize(needle);
  if(!n)return false;
  // Product terminology may be embedded within one actual token, but never across separate tokens.
  return tokens.some(token=>token.includes(n));
}
function hasAny(tokens,terms){
  return terms.some(term=>hasPhraseToken(tokens,term));
}
function genuineRamen(tokens){
  if(hasAny(tokens,GROCERY_TERMS["라면"]))return true;
  if(tokens.some(t=>t==="라면" || /^(라면)(?:세트|팩|봉지|컵|멀티|사리|스프|건면)$/.test(t)))return true;
  // An unrecognized ramen brand may still be a product if '라면' is an actual ending
  // in one token and packaging/brand evidence appears elsewhere. No arbitrary '라면' suffix.
  return tokens.some(t=>t.endsWith("라면") && t.length<=8) &&
    hasAny(tokens,["농심","오뚜기","삼양","팔도","풀무원","하림","청정원"]);
}
function genuineCoffee(tokens,title){
  if(hasAny(tokens,GROCERY_TERMS["커피"]))return true;
  const genuineWord=tokens.some(t=>t==="커피"||t.startsWith("커피"));
  if(!genuineWord)return false;
  // A separate word '커피' is weak evidence: require actual drink/bean form.
  return /(?:커피\s?(?:믹스|원두|캡슐|분말|스틱|음료|병|캔|팩|티백|파우치)|\d+\s*(?:g|kg|ml|l|개입|스틱|t|봉|캔|병|팩|박스))/i.test(title);
}
function genuineGrocery(query,tokens,title){
  if(query==="라면")return genuineRamen(tokens);
  if(["커피","원두","라떼"].includes(query))return genuineCoffee(tokens,title);
  if(query==="간편식")return genuineRamen(tokens)||hasAny(tokens,GROCERY_TERMS["간편식"]);
  const words=GROCERY_TERMS[query];
  if(words)return hasAny(tokens,words);
  return hasPhraseToken(tokens,query);
}
export function relevantItem(query,item){
  if(!item||typeof item.title!=="string"||!item.title.trim())return false;
  const q=normalize(query), title=item.title, tokens=productTokens(title);
  if(!q)return false;
  if(FOOD_QUERY_SET.has(q)){
    if(NON_GROCERY_MERCHANT.test(String(item.cp_name||""))||
       EDUCATION_TRAVEL.test(title)||OTHER_PHYSICAL.test(title))return false;
    return genuineGrocery(q,tokens,title);
  }
  const aliases=CATEGORY_ALIASES[q];
  if(aliases)return hasAny(tokens,aliases);
  const words=productTokens(query).filter(w=>w.length>=2);
  return words.length>=1 && words.every(w=>hasPhraseToken(tokens,w));
}
export function relevantTitle(query,title){return relevantItem(query,{title});}
export function selectRelevantProducts(query,items){
  if(!Array.isArray(items))return [];
  return items.filter(item=>relevantItem(query,item));
}
