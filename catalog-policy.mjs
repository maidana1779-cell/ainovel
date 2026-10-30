// Storefront scope: physical products in current shopping categories.
// Do not rewrite affiliate URLs or invent replacement sellers.
const excludedSeller=/(?:yes24|예스24|예스이십사|교보문고|알라딘|리디북스|밀리의서재|마이리얼트립|myrealtrip|클룩|klook|와그|여기어때|야놀자|트립닷컴|tripcom|아고다|agoda|익스피디아|expedia|클래스101|class101|인프런|패스트캠퍼스|탈잉|유데미|udemy)/;
// Physical products only: normalize spaced e-books and digital file formats too.
const excludedDigitalMedia=/(?:전자\s*책|전자\s*도서|전자\s*교재|e[\s-]*book|e\s*북|이\s*북|오디오\s*북|(?:^|[^a-z0-9])(?:pdf|epub)(?=$|[^a-z0-9])|디지털\s*(?:도서|서적|교재)|온라인\s*(?:강의|강좌|수업))/i;
const excludedServiceSeller=/(?:크몽|kmong|kkday|케이케이데이|케이케이데이|klook|myrealtrip|마이리얼트립)/i;
const excludedServiceTitle=/(?:시티\s*투어|관광\s*(?:투어|버스|티켓)|투어\s*(?:버스|티켓|패스)|버스\s*(?:투어|티켓|탑승권)|(?:버스|항공|관광)\s*티켓|가이드\s*지도|(?:전자|디지털)\s*(?:콘텐츠|문서|파일)|(?:리셀|부업|부수입|재테크|n\s*잡|수익화|창업)\s*(?:로|을|을\s*통해|방법|노하우|가이드|만들|만든|벌|하는)|(?:돈|부수입)\s*(?:버는|벌기|만드는|만든)\s*방법|(?:이어폰|에어팟|버즈).{0,18}(?:리셀|부업|부수입|노하우|가이드북|수익화))/i;
const excludedProduct=/(?:전자책|e-?book|온라인\s*(?:강의|강좌|수업)|인강|수강권|학습지|(?:^|[\s[(])(?:도서|교재|서적|문제집|참고서)(?=\s|$)|항공권|숙박권|호텔\s*(?:예약|숙박)|펜션\s*(?:예약|숙박)|여행\s*(?:상품|패키지|투어|일정)|관광\s*(?:투어|입장권)|(?:콘서트|뮤지컬|공연|전시)\s*(?:티켓|관람권)|체험\s*(?:예약|입장권|프로그램))/i;
export function catalogMerchantExcluded(value){
 return excludedSeller.test(String(value??'').normalize('NFKC').toLowerCase().replace(/[\s._-]+/g,''));
}
export function inStorefrontCatalog(item){
 // Retired Toss Sharelinks are not active Adpick offers and must never reappear.
 if(item?.affiliate_source==="toss_sharelink"||
    /(?:토스쇼핑|tossshopping)/i.test(String(item?.cp_name||"").replace(/\s+/g,""))||
    /^https:\/\/toss\.shopping\//i.test(String(item?.commissionlink||"")))return false;
 return !!item&&typeof item.title==='string'&&!!item.title.trim()&&
 !catalogMerchantExcluded(item.cp_name)&&!excludedServiceSeller.test(String(item.cp_name||''))&&
 !excludedServiceTitle.test(item.title.normalize('NFKC'))&&!excludedDigitalMedia.test(item.title.normalize('NFKC'))&&
 !excludedProduct.test(item.title.normalize('NFKC'));
}
export function filterCatalogProducts(items){
 const source=Array.isArray(items)?items:[];
 const kept=source.filter(inStorefrontCatalog);
 return {items:kept,removed:source.length-kept.length};
}
export function restrictCatalogPayload(payload){
 if(payload?.success!==true)return payload;
 const list=Array.isArray(payload.data)?payload.data:Array.isArray(payload.data?.list)?payload.data.list:null;
 if(!list)return payload;
 const {items,removed}=filterCatalogProducts(list);
 if(!removed)return payload;
 return {...payload,data:Array.isArray(payload.data)?items:{...payload.data,list:items},
  filter_meta:{...(payload.filter_meta||{}),
   out_of_catalog_removed:Number(payload.filter_meta?.out_of_catalog_removed||0)+removed}};
}
