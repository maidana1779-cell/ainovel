import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {curatedProducts} from './curated-products.mjs';
import {inStorefrontCatalog} from './catalog-policy.mjs';
import {getSearchPlan} from './search-plan.mjs';

const root=dirname(fileURLToPath(import.meta.url));
function file(name){return readFileSync(resolve(root,name),'utf8')}

export function affiliateLinkInspection(raw,product={}){
 try{
  if(typeof raw!=='string'||raw.length>2048)return {valid:false,reason:'invalid'};
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.pathname==='/')
   return {valid:false,reason:'unsafe_url'};
  if(['biz.adpick.co.kr','link.adpick.co.kr','bitl.bz'].includes(url.hostname))
   return {valid:true,provider:'adpick',hostname:url.hostname};
  if(product.affiliate_source==='toss_sharelink'&&url.hostname==='toss.shopping'&&
    /^\/_m\/[A-Za-z0-9]+$/.test(url.pathname))
   return {valid:true,provider:'toss',hostname:url.hostname};
  return {valid:false,reason:'unapproved_host'};
 }catch{return {valid:false,reason:'malformed_url'}}
}

export function reviewPreflight({homepage,contact,privacy,guide,products=[]}={}){
 const blockers=[],warnings=[],checks=[];
 function check(ok,name,{block=true}={}){
  checks.push({name,pass:!!ok});
  if(!ok)(block?blockers:warnings).push(name);
 }
 const contactAddresses=[...String(contact||'').matchAll(/href=["']mailto:([^"'?<> \t]+)(?:\?[^"'<>]*)?["']/gi)]
  .map(m=>m[1].trim().toLowerCase()).filter(v=>/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(v));
 // A URL is contact information only if a valid real receiving address appears.
 // A user must confirm ownership before their actual address is published.
 const hasPublishedContact=contactAddresses.length>0&&
  contactAddresses.some(addr=>String(privacy||'').toLowerCase().includes(addr))&&
  !contactAddresses.some(addr=>/example\.(?:com|org|net)|invalid|test\.|noreply|no-reply/.test(addr));
 check(hasPublishedContact,'운영·개인정보 문의 가능한 동일 연락처 게시');
 check(!/연락처는.*준비|문의 채널은.*준비|심사 제출.*예정/.test(String(contact||'')),
  '문의 페이지에 심사 전 미완료 문구 없음');
 check(!/법적 필수 기재사항.*최종 처리방침|정식 심사 전에 완성/.test(String(privacy||'')),
  '개인정보 페이지 미완성 문구 제거');
 check(String(homepage||'').includes('광고·제휴 안내')&&
  String(homepage||'').includes('구매가 발생하면 운영자에게 제휴 수수료가 지급됩니다')&&
  String(guide||'').includes('제휴 수수료 고지'),'제휴 수익 및 구매 조건 고지');
 check(/href="\/about\.html"/.test(homepage)&&/href="\/privacy\.html"/.test(homepage)&&
  /href="\/contact\.html"/.test(homepage),'서비스·개인정보·문의 페이지 접근');
 check(/function validAffiliateLink\(raw,product\)/.test(homepage)&&
  /link\.rel="sponsored nofollow noopener noreferrer"/.test(homepage)&&
  /link\.target="_blank"/.test(homepage),'제휴 URL 검증·새 창·후원 링크 속성');
 const failures=[];
 for(const p of products){
  const link=affiliateLinkInspection(p.commissionlink,p);
  if(!link.valid||!inStorefrontCatalog(p)||!p.title)failures.push({title:String(p.title||'').slice(0,80),reason:link.reason||'not_in_catalog'});
 }
 check(failures.length===0,'직접 등록된 상품 링크 형식·카테고리 확인');
 const keywords=['간편식','세제','이어폰','화장품','의류','주방용품'];
 check(keywords.every(q=>getSearchPlan(q).terms.length>0),'대표 6개 카테고리 검색 계획 준비');
 // This checks the link's syntax, NOT whether remote products still exist.
 warnings.push('게시된 운영 문의 이메일의 실제 수신·회신 여부는 운영자가 직접 확인 필요');
 warnings.push('실제 제휴 링크 최종 이동·상품 품절·가격·배송 조건은 외부 판매처에서 직접 확인 필요');
 warnings.push('제휴 상품 정보·이미지의 사용 범위 및 매체 승인 조건은 애드픽 측 확인 필요');
 return {ready:blockers.length===0,checks,blockers,warnings,products_checked:products.length,
  contact_addresses_found:contactAddresses.length,link_issues:failures};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=reviewPreflight({
  homepage:file('index.html'),contact:file('public/contact.html'),
  privacy:file('public/privacy.html'),guide:file('public/guide.html'),
  products:curatedProducts()
 });
 const passed=result.checks.filter(v=>v.pass).length;
 console.log('알뜰픽 애드픽 심사 사전 점검: '+(result.ready?'기본 점검 통과':'제출 전 필수 보완'));
 console.log('확인 항목 '+passed+'/'+result.checks.length+' · 직접 등록한 제휴 링크 '+result.products_checked+'개 · 외부 링크 클릭 0회');
 for(const item of result.checks)console.log((item.pass?'[통과] ':'[보완] ')+item.name);
 for(const message of result.warnings)console.log('[추가 검증] '+message);
 process.exitCode=result.ready?0:2;
}
