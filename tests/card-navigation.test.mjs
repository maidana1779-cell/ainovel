import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
test('Product image, name and price share one affiliate-card link without a purchase-button widget',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 const show=script.slice(script.indexOf('function show('),script.indexOf('\nconst browseLayout=',script.indexOf('function show(')));
 assert.match(show,/const link=make\(clickable\?"a":"div","product-card-link"\)/);
 assert.match(show,/link\.append\(pic\)/);
 assert.match(show,/box\.append\(merchantBadge\(p\)\)/);
 assert.match(show,/box\.append\(pricing\)/);
 assert.match(show,/link\.append\(box\);card\.append\(link\)/);
 assert.doesNotMatch(show,/make\("a","go"|make\("a","go"\+/);
 assert.match(show,/link\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(show,/url\.hostname==="toss\.shopping"/);
 assert.match(html,/\.product-card-link\{display:flex/);
 assert.match(html,/\.product-card-link:focus-visible/);
});

test('Visible v3 redesign loads the real font and makes cards materially larger',()=>{
 assert.match(html,/pretendardvariable-dynamic-subset\.min\.css/);
 assert.match(html,/data-design-version="storefront-v3-20261025"/);
 assert.match(html,/\.grid,\.product-discovery \.discovery-grid\{\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(html,/\.product-card-link \.price\{[\s\S]*?font-size:31px/);
 assert.match(html,/\.product-card-link \.product\{[\s\S]*?font-size:17px/);
 const show=script.slice(script.indexOf('function show('),script.indexOf('\nconst browseLayout=',script.indexOf('function show(')));
 assert.ok(show.indexOf('box.append(pricing);')<show.indexOf('box.append(merchantBadge(p));'));
 assert.doesNotMatch(show,/상품 자세히 보기/);
 assert.match(html,/\.product-card-link \.merchant-badge\{/);
});
