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
test('The homepage has actual photographic shopping banners at the top from first paint',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 assert.match(html,/<section id="shopping-events" class="shopping-events top-shopping-feature"/);
 assert.ok(html.indexOf('id="shopping-events"')<html.indexOf('class="hero"'));
 assert.ok(html.indexOf('id="shopping-events"')<html.indexOf('id="shop-categories"'));
 assert.match(html,/id="shopping-theme-grid" class="shopping-theme-grid"/);
 assert.match(html,/data-feature-department="간편식"/);
 assert.match(html,/data-feature-department="의류"/);
 assert.match(html,/images\.unsplash\.com\/photo-1721406769891-f2ba651401d9/);
 assert.match(html,/images\.unsplash\.com\/photo-1603400521630-9f2de124b33b/);
 assert.match(html,/id="shopping-event-grid" class="shopping-event-grid" hidden/);
 assert.match(script,/fetch\("\/shopping-events\.json",\{cache:"no-store"\}\)/);
 assert.match(script,/a\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(script,/img\.loading="lazy"/);
 assert.match(script,/if\(!eligible\.length\)\{showThemes\(\);return 0\}/);
 assert.match(script,/if\(!grid\.children\.length\)showThemes\(\)/);
 assert.deepEqual(manifest,{events:[]},'Do not claim that Adidas or 11st campaign is active');
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

test('Top feature tiles are accessible, clickable and route to real department searches',()=>{
 const js=script;
 assert.match(js,/document\.getElementById\("shopping-theme-grid"\)\.addEventListener\("click",event=>/);
 assert.match(js,/changeDepartment\(chosen\.dataset\.featureDepartment,\{scroll:true\}\)/);
 assert.match(html,/class="shopping-theme-card theme-living" data-feature-department="간편식"/);
 assert.match(html,/class="shopping-theme-card theme-fashion" data-feature-department="의류"/);
 assert.match(html,/loading="eager" fetchpriority="high"/);
 assert.doesNotMatch(html,/쇼핑몰 기획전.*~7%|쇼핑몰 기획전.*~2\.1%/);
 const top=html.slice(html.indexOf('<section id="shopping-events"'),html.indexOf('<section class="hero"'));
 assert.doesNotMatch(top,/아디다스 기획전|11번가 생활용품BEST|할인율|수수료율/);
});
test('A verified promotion replaces—not follows—the top photo feature cards',()=>{
 const renderer=script.slice(script.indexOf('function renderShoppingEvents('),script.indexOf('async function loadShoppingEvents('));
 assert.match(renderer,/themes\.hidden=true;grid\.hidden=false;section\.hidden=false/);
 assert.match(renderer,/title\.textContent="진행 중인 쇼핑몰 기획전"/);
 assert.match(renderer,/themes\.hidden=false/);
 assert.match(renderer,/grid\.hidden=true/);
 assert.doesNotMatch(html,/id="shopping-events"[^>]*hidden/);
});
