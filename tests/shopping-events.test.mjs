import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const manifest=JSON.parse(readFileSync(new URL('../public/shopping-events.json',import.meta.url),'utf8'));
function eventValidator(){
 const a=script.indexOf('function validAffiliateLink(raw,product){');
 const b=script.indexOf('function show(',a);
 const c=script.indexOf('function shoppingEventValidDate(');
 const d=script.indexOf('function renderShoppingEvents(',c);
 assert.ok(a>0&&b>a&&c>b&&d>c);
 return new Function(script.slice(a,b)+'\n'+script.slice(c,d)+'\nreturn eligibleShoppingEvent;')();
}
const event={mall:'테스트 쇼핑몰',title:'테스트용 기획전',description:'공식 행사 페이지로 이동',
 starts_on:'2026-10-20',ends_on:'2026-10-30',image_url:'https://cdn.adpick.co.kr/official-event.jpg',
 url:'https://link.adpick.co.kr/owner-generated-link',asset_authorized:true,link_confirmed:true};
test('Above-the-fold carousel shows all three genuine tracking links with matching slides',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 const top=html.slice(html.indexOf('<section id="shopping-events"'),html.indexOf('<section class="hero"'));
 assert.match(top,/class="shopping-events top-shopping-feature"/);
 assert.ok(html.indexOf('id="shopping-events"')<html.indexOf('id="searchform"'));
 assert.match(top,/class="shopping-theme-grid shopping-campaign-slider"/);
 for(const link of ['jKubOI','l0gfEs','DfTQat'])
  assert.ok(top.includes('href="https://bitl.bz/'+link+'"'),link);
 for(const file of ['11st-living.png','xiaomi-band-11.jpg','intel-ultra-coupang.jpg'])
  assert.ok(top.includes('src="/events/'+file+'"'),file);
 assert.equal((top.match(/rel="sponsored nofollow noopener noreferrer"/g)||[]).length,3);
 assert.equal((top.match(/data-campaign-slide="/g)||[]).length,3);
 assert.equal((top.match(/data-campaign-dot="/g)||[]).length,3);
 assert.match(top,/행사 및 구매 조건은 판매처에서 확인해 주세요/);
 assert.doesNotMatch(top,/images\.unsplash\.com|배너는 연출 사진입니다/);
 assert.doesNotMatch(top,/class="shopping-theme-text"/);
 assert.match(top,/id="shopping-event-grid" class="shopping-event-grid" hidden/);
 assert.match(script,/fetch\("\/shopping-events\.json",\{cache:"no-store"\}\)/);
 assert.match(script,/if\(!eligible\.length\)\{showThemes\(\);return 0\}/);
 assert.deepEqual(manifest,{events:[]},'No fake deadlines or undeclared official campaign data');
});
test('Only real, current, rights-authorized shopping promotions are eligible',()=>{
 const eligible=eventValidator();
 assert.equal(eligible(event,'2026-10-26'),true);
 assert.equal(eligible({...event,asset_authorized:false},'2026-10-26'),false);
 assert.equal(eligible({...event,link_confirmed:false},'2026-10-26'),false);
 assert.equal(eligible({...event,ends_on:'2026-10-25'},'2026-10-26'),false);
 assert.equal(eligible({...event,starts_on:'2026-10-27'},'2026-10-26'),false);
 assert.equal(eligible({...event,ends_on:'2026-02-30'},'2026-02-10'),false);
 assert.equal(eligible({...event,url:'https://shopping.naver.com/'},'2026-10-26'),false);
 assert.equal(eligible({...event,url:'https://biz.adpick.co.kr/api/SECRET/directlink?url=a'},'2026-10-26'),false);
 assert.equal(eligible({...event,image_url:'http://cdn.adpick.co.kr/official-event.jpg'},'2026-10-26'),false);
 assert.equal(eligible({...event,image_url:'https://username:password@cdn.adpick.co.kr/a.jpg'},'2026-10-26'),false);
});
test('Operator commission percentages cannot be mistaken for customer discounts',()=>{
 const eligible=eventValidator();
 assert.equal(eligible({...event,title:'신상품 ~7% 혜택'},'2026-10-26'),false);
 assert.equal(eligible({...event,description:'~2.1% 혜택'},'2026-10-26'),false);
 assert.equal(eligible({...event,description:'커미션율 7'},'2026-10-26'),false);
 assert.equal(eligible({...event,commission_per:'7'},'2026-10-26'),false);
 assert.equal(eligible({...event,commission_rate:2.1},'2026-10-26'),false);
 assert.equal(eligible({...event,discount_rate:7},'2026-10-26'),false);
 const part=script.slice(script.indexOf('function renderShoppingEvents('),script.indexOf('async function loadShoppingEvents('));
 assert.doesNotMatch(part,/commission_per|commission_rate|discount_rate/);
 assert.doesNotMatch(html,/~7%|~2\.1%/);
});
test('Original affiliate links survive unchanged and no third-party event feed is scraped',()=>{
 const part=script.slice(script.indexOf('function renderShoppingEvents('),script.indexOf('async function loadShoppingEvents('));
 assert.match(part,/a\.href=event\.url/);
 assert.match(part,/img\.src=event\.image_url/);
 assert.match(part,/\.textContent=event\.title/);
 assert.match(part,/\.textContent=event\.mall/);
 assert.match(part,/used\.has\(event\.url\)/);
 assert.match(part,/\.slice\(0,6\)/);
 assert.match(html,/body\.category-active \.shopping-events\{display:none\}/);
 assert.match(html,/class="affiliate-banner"/);
 assert.match(html,/토스쇼핑 쉐어링크 활동의 일환/);
});

test('Campaign slider has responsive navigation, accessible inactive slides and safe playback',()=>{
 assert.match(script,/function initShoppingCampaignSlider\(\)/);
 assert.match(script,/setAttribute\("aria-hidden",String\(!on\)\)/);
 assert.match(script,/card\.tabIndex=on\?0:-1/);
 assert.match(script,/aria-current",String\(i===active\)/);
 assert.match(script,/shopping-campaign-prev/);
 assert.match(script,/shopping-campaign-next/);
 assert.match(script,/prefers-reduced-motion: reduce/);
 assert.match(script,/document\.hidden/);
 assert.match(script,/touchstart/);
 assert.match(script,/touchend/);
 assert.match(html,/shopping-campaign-slider \.shopping-theme-card\.is-active\{display:block\}/);
 assert.match(html,/\.shopping-campaign-slider \.shopping-theme-card\{display:none/);
 assert.match(html,/@media\(max-width:730px\)/);
 assert.doesNotMatch(html,/~7%|~2\.1%/);
});
test('A verified promotion replaces—not follows—the top photo feature cards',()=>{
 const renderer=script.slice(script.indexOf('function renderShoppingEvents('),script.indexOf('async function loadShoppingEvents('));
 assert.match(renderer,/themes\.hidden=true;grid\.hidden=false;section\.hidden=false/);
 assert.match(renderer,/title\.textContent="진행 중인 쇼핑몰 기획전"/);
 assert.match(renderer,/themes\.hidden=false/);
 assert.match(renderer,/grid\.hidden=true/);
 assert.doesNotMatch(html,/id="shopping-events"[^>]*hidden/);
});

test('Uploaded original creatives are used without placeholder thumbnails or unauthorized imitations',()=>{
 const files=[['11st-living.png','png'],['xiaomi-band-11.jpg','jpg'],['intel-ultra-coupang.jpg','jpg']];
 for(const [file,type] of files){
  const bytes=readFileSync(new URL('../public/events/'+file,import.meta.url));
  assert.ok(bytes.length>20000,'Too small for supplied original: '+file);
  if(type==='png')assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  else assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
 }
});
