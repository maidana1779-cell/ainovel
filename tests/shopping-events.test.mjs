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
test('Shopping-event section and accessible image-first card template are present but not advertised prematurely',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 assert.match(html,/<section id="shopping-events" class="shopping-events"[^>]*>/);
 assert.doesNotMatch(html,/<section id="shopping-events" class="shopping-events"[^>]* hidden>/);
 assert.ok(html.indexOf('id="shopping-events"')<html.indexOf('<section class="hero"'),'Hero carousel is first');
 assert.equal((html.match(/data-featured-theme=/g)||[]).length,3,'Three instantly visible real-photo themes');
 assert.match(html,/id="shopping-event-next"/);
 assert.match(html,/id="shopping-event-prev"/);
 assert.match(html,/id="shopping-event-count"/);
 assert.match(html,/images\.unsplash\.com\/photo-/);
 assert.match(html,/id="shopping-event-grid" class="shopping-event-grid"/);
 assert.match(script,/async function loadShoppingEvents\(\)/);
 assert.match(script,/fetch\("\/shopping-events\.json",\{cache:"no-store"\}\)/);
 assert.match(script,/if\(!eligible\.length\)\{restoreShoppingThemes\(\);return 0\}/);
 assert.match(script,/a\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(script,/img\.loading="lazy"/);
 assert.match(script,/addEventListener\("error",\(\)=>\{a\.remove\(\);if\(!grid\.children\.length\)restoreShoppingThemes\(\)/);
 assert.deepEqual(manifest,{events:[]},'Never invent currently active events');
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
