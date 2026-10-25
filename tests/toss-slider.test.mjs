import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
test('Toss section scrolls horizontally and exposes working previous/next controls',()=>{
 assert.ok(js);assert.doesNotThrow(()=>new Script(js));
 for(const id of ['toss-prev','toss-next','toss-slide-count','toss-products']){
  assert.equal(html.split('id="'+id+'"').length-1,1);
 }
 assert.match(html,/\.curated-grid\{[\s\S]*?display:flex;gap:16px;overflow-x:auto/);
 assert.match(html,/scroll-snap-type:x mandatory/);
 assert.match(js,/const targetIndex=\(current\+step\+items\.length\)%items\.length/);
 assert.match(js,/target\.scrollTo\(\{left:items\[targetIndex\]\.offsetLeft-target\.offsetLeft,behavior:"smooth"\}\)/);
 assert.match(js,/prev\.addEventListener\("click"/);
 assert.match(js,/next\.addEventListener\("click"/);
 assert.match(js,/initTossSlider\(panel,target\)/);
});
test('Autoplay pauses for manual interaction, hidden tabs, offscreen sections and reduced motion',()=>{
 assert.match(js,/window\.setInterval\(/);
 assert.match(js,/4800/);
 assert.match(js,/getBoundingClientRect\(\)/);
 assert.match(js,/document\.hidden/);
 assert.match(js,/mouseenter/);
 assert.match(js,/mouseleave/);
 assert.match(js,/touchstart/);
 assert.match(js,/touchend/);
 assert.match(js,/focusin/);
 assert.match(js,/focusout/);
 assert.match(js,/prefers-reduced-motion: reduce/);
 assert.match(js,/window\.clearInterval\(timer\)/);
});
test('Missing Toss images use honest branded placeholders rather than unrelated products',()=>{
 assert.match(js,/product\?\.affiliate_source==="toss_sharelink"/);
 assert.match(js,/product\.icon\|\|"🛍️"/);
 assert.match(js,/상품 사진은 토스쇼핑에서 확인/);
 assert.match(html,/토스쇼핑 쉐어링크 활동의 일환/);
 assert.match(html,/\.toss-product-fallback\{/);
});
