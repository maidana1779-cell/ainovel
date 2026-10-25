// Curated product links explicitly supplied for Alttulpick publication.
// These are Toss Sharelink tracking URLs, NOT Adpick links.
// Prices/images are intentionally omitted until independently confirmed.
// Add more manually vetted products here. No scraping or Toss Open API dependency.
const products=Object.freeze([
  Object.freeze({
    id:'toss-sparkle-water-500ml-80',
    title:'스파클 생수, 무라벨, 500ml, 80개',
    cp_name:'토스쇼핑',
    // Official Toss brand asset; this is presentation-only, not a tracking link.
    cp_icon:'https://static.toss.im/icons/png/4x/icon-toss-logo.png',
    price:null,
    photo:null,
    commissionlink:'https://toss.shopping/_m/fEfXH2Dz',
    affiliate_source:'toss_sharelink',
    icon:'💧',
    keywords:['스파클','생수','무라벨','500ml','80개','물','음료','식품']
  }),
  Object.freeze({
    id:'toss-ems-foot-massager-black',
    title:'EMS 스마트 발 마사지기, 리모컨 포함, 블랙, 1개',
    cp_name:'토스쇼핑',
    cp_icon:'https://static.toss.im/icons/png/4x/icon-toss-logo.png',
    price:null,
    photo:null,
    commissionlink:'https://toss.shopping/_m/T3YXM88A',
    affiliate_source:'toss_sharelink',
    icon:'🦶',
    keywords:["발마사지기","EMS","안마기","마사지","리모컨","헬스"]
  }),
  Object.freeze({
    id:'toss-sunridge-navel-orange-3-5kg',
    title:'썬리지 호주산 네이블 오렌지, 중과, 3.5kg, 1박스',
    cp_name:'토스쇼핑',
    cp_icon:'https://static.toss.im/icons/png/4x/icon-toss-logo.png',
    price:null,
    photo:null,
    commissionlink:'https://toss.shopping/_m/vUfumnfn',
    affiliate_source:'toss_sharelink',
    icon:'🍊',
    keywords:["썬리지","오렌지","과일","네이블","3.5kg","식품"]
  }),
  Object.freeze({
    id:'toss-myeongsik-paraegim-100',
    title:'명식품 파래김, 100매, 1개',
    cp_name:'토스쇼핑',
    cp_icon:'https://static.toss.im/icons/png/4x/icon-toss-logo.png',
    price:null,
    photo:null,
    commissionlink:'https://toss.shopping/_m/9DX0e7mh',
    affiliate_source:'toss_sharelink',
    icon:'🍙',
    keywords:["파래김","김","명식품","반찬","100매","식품"]
  }),
  Object.freeze({
    id:'toss-daesikga-budae-1kg-3',
    title:'대식가 일키로 부대찌개, 1kg, 3팩',
    cp_name:'토스쇼핑',
    cp_icon:'https://static.toss.im/icons/png/4x/icon-toss-logo.png',
    price:null,
    photo:null,
    commissionlink:'https://toss.shopping/_m/b8L8owyC',
    affiliate_source:'toss_sharelink',
    icon:'🍲',
    keywords:["부대찌개","대식가","찌개","1kg","3팩","간편식","식품"]
  }),
  Object.freeze({
    id:'toss-foresti-peanut-butter-450g-2',
    title:'포레스티 국내제조 땅콩버터, 무첨가, 무가당, 무설탕, 450g, 2개',
    cp_name:'토스쇼핑',
    cp_icon:'https://static.toss.im/icons/png/4x/icon-toss-logo.png',
    price:null,
    photo:null,
    commissionlink:'https://toss.shopping/_m/vd1C807g',
    affiliate_source:'toss_sharelink',
    icon:'🥜',
    keywords:["땅콩버터","포레스티","무가당","땅콩","450g","식품"]
  }),
  Object.freeze({
    id:'toss-kojoobu-eomuktang-210g-4',
    title:'코주부 밀가루 없는 3분 어묵탕, 210g, 4팩',
    cp_name:'토스쇼핑',
    cp_icon:'https://static.toss.im/icons/png/4x/icon-toss-logo.png',
    price:null,
    photo:null,
    commissionlink:'https://toss.shopping/_m/73U6YhQD',
    affiliate_source:'toss_sharelink',
    icon:'🍢',
    keywords:["코주부","어묵탕","어묵","210g","4팩","간편식","식품"]
  })
]);
export function curatedProducts(){
  return products.map(p=>({...p,keywords:undefined}));
}
export function matchingCuratedProducts(query){
  const q=String(query??'').normalize('NFKC').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
  if(q.length<2)return [];
  return products.filter(p=>p.keywords.some(k=>k.normalize('NFKC').toLowerCase().replace(/[^가-힣a-z0-9]/g,'').includes(q))||
    p.title.normalize('NFKC').toLowerCase().replace(/[^가-힣a-z0-9]/g,'').includes(q))
    .map(p=>({...p,keywords:undefined}));
}
