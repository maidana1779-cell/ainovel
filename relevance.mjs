// Filter only current API responses by product title, with no product storage.
const aliases={
  "라면": [
    "라면",
    "볶음면",
    "짜파게티",
    "너구리",
    "왕뚜껑",
    "컵누들",
    "짜장범벅",
    "비빔면",
    "우동컵"
  ],
  "간편식": [
    "간편식",
    "즉석밥",
    "도시락",
    "볶음밥",
    "냉동식품",
    "햇반",
    "컵밥",
    "라면",
    "국밥",
    "레토르트"
  ],
  "세제": [
    "세제",
    "세탁",
    "섬유유연제"
  ],
  "이어폰": [
    "이어폰",
    "에어팟",
    "갤럭시버즈",
    "블루투스이어버드"
  ],
  "무선이어폰": [
    "무선이어폰",
    "블루투스이어폰",
    "에어팟",
    "갤럭시버즈"
  ],
  "화장품": [
    "화장품",
    "스킨케어",
    "립스틱",
    "쿠션",
    "파운데이션",
    "선크림",
    "클렌징",
    "토너",
    "에센스",
    "크림",
    "파우더"
  ],
  "의류": [
    "의류",
    "티셔츠",
    "맨투맨",
    "스웨터",
    "바지",
    "셔츠",
    "니트",
    "자켓",
    "재킷",
    "원피스",
    "후드티"
  ],
  "주방용품": [
    "주방용품",
    "프라이팬",
    "후라이팬",
    "도마",
    "밀폐용기",
    "냄비",
    "그릇",
    "수세미",
    "주방세제"
  ]
};
export function normalize(value){return String(value??"").toLowerCase().replace(/[^가-힣a-z0-9]/g,"");}
export function relevantTitle(query,title){
  if(typeof title!=="string"||!title.trim())return false;
  const normalizedTitle=normalize(title),normalizedQuery=normalize(query);
  if(!normalizedQuery)return false;
  const variants=aliases[normalizedQuery];
  if(variants)return variants.some(v=>normalizedTitle.includes(normalize(v)));
  if(normalizedTitle.includes(normalizedQuery))return true;
  const words=String(query).trim().split(/[\s,]+/).map(normalize).filter(v=>v.length>=2);
  return words.length>1&&words.every(w=>normalizedTitle.includes(w));
}
export function selectRelevantProducts(query,items){if(!Array.isArray(items))return [];return items.filter(item=>relevantTitle(query,item?.title));}
