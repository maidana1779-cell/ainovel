// Storefront scope: physical products in current shopping categories.
// Do not rewrite affiliate URLs or invent replacement sellers.
const excludedSeller=/(?:yes24|예스24|예스이십사|교보문고|알라딘|리디북스|밀리의서재|마이리얼트립|myrealtrip|클룩|klook|와그|여기어때|야놀자|트립닷컴|tripcom|아고다|agoda|익스피디아|expedia|클래스101|class101|인프런|패스트캠퍼스|탈잉|유데미|udemy)/;
const excludedProduct=/(?:전자책|e-?book|온라인\s*(?:강의|강좌|수업)|인강|수강권|학습지|(?:^|[\s[(])(?:도서|교재|서적|문제집|참고서)(?=\s|$)|항공권|숙박권|호텔\s*(?:예약|숙박)|펜션\s*(?:예약|숙박)|여행\s*(?:상품|패키지|투어|일정)|관광\s*(?:투어|입장권)|(?:콘서트|뮤지컬|공연|전시)\s*(?:티켓|관람권)|체험\s*(?:예약|입장권|프로그램))/i;
export function catalogMerchantExcluded(value){
 return excludedSeller.test(String(value??'').normalize('NFKC').toLowerCase().replace(/[\s._-]+/g,''));
}
export function inStorefrontCatalog(item){
 return !!item&&typeof item.title==='string'&&!!item.title.trim()&&
 !catalogMerchantExcluded(item.cp_name)&&!excludedProduct.test(item.title.normalize('NFKC'));
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
