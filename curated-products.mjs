// Curated product links explicitly supplied for Alttulpick publication.
// These are Toss Sharelink tracking URLs, NOT Adpick links.
// Prices/images are intentionally omitted until independently confirmed.
// Add more manually vetted products here. No scraping or Toss Open API dependency.
const products=Object.freeze([
  Object.freeze({
    id:'toss-sparkle-water-500ml-80',
    title:'스파클 생수, 무라벨, 500ml, 80개',
    cp_name:'토스쇼핑',
    price:null,
    photo:null,
    commissionlink:'https://toss.shopping/_m/fEfXH2Dz',
    affiliate_source:'toss_sharelink',
    icon:'💧',
    keywords:['스파클','생수','무라벨','500ml','80개','물','음료','식품']
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
