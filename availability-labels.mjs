// Very conservative prefilter: only unambiguous, item-specific unavailable markers.
// These are explicit source labels, not a live stock check.
const bracketed=/(?:^|\s)[\[【(（]\s*(?:품절|일시품절|판매종료|판매중단|재고없음|sold\s*out|out\s*of\s*stock)\s*[\]】)）]/i;
const leading=/^(?:(?:품절|일시품절|판매종료|판매중단|재고없음)\s*[:：\-–]\s*)/i;
const tail=/(?:\s+)(?:판매종료|판매중단|재고없음)$/;
export function clearlyUnavailable(item){
 if(!item||typeof item.title!=='string')return false;
 const title=item.title.trim();
 return bracketed.test(title)||leading.test(title)||tail.test(title);
}
export function removeClearlyUnavailable(items){
 const source=Array.isArray(items)?items:[];
 const kept=source.filter(item=>!clearlyUnavailable(item));
 return {items:kept,removed:source.length-kept.length};
}
