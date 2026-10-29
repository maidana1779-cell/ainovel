import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const pub=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('The new main page shows an honest service closure with no live shopping links',()=>{
 assert.equal(root,pub);
 const start=root.indexOf('<template id="retired-storefront">'),end=root.indexOf('</template>',start);
 assert.ok(start>0&&end>start);
 const visible=root.slice(end);
 assert.match(visible,/id="main-content"/);
 assert.match(visible,/상품 검색·추천 서비스를 중단했습니다/);
 assert.match(visible,/재개 여부와 일정은 아직 정해지지 않았습니다/);
 assert.match(visible,/구매 전 확인할 4가지/);
 assert.doesNotMatch(visible,/<script|https:\/\/bitl\.bz\//);
 assert.doesNotMatch(visible,/<a[^>]+href="https:\/\/toss\.shopping/);
 assert.doesNotMatch(visible,/<form[^>]+id="searchform"/);
});
test('Legacy product UI and its script stay inert for rollback',()=>{
 const start=root.indexOf('<template id="retired-storefront">'),end=root.indexOf('</template>',start);
 assert.match(root.slice(start,end),/function fetchProducts\(/);
 assert.match(root.slice(start,end),/loadCuratedProducts\(\)/);
 assert.equal((root.match(/<\/template>/g)||[]).length,1);
 assert.equal((root.match(/<\/script>/g)||[]).length,1);
});
