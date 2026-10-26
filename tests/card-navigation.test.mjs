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
 assert.match(script,/function validAffiliateLink\(raw,product\)/);
 assert.match(script,/url\.hostname==="toss\.shopping"/);
 assert.match(html,/\.product-card-link\{display:flex/);
 assert.match(html,/\.product-card-link:focus-visible/);
});

test('Retail design v5 preserves loaded font and uses product-dense readable cards',()=>{
 assert.match(html,/pretendardvariable-dynamic-subset\.min\.css/);
 assert.match(html,/data-design-version="retail-v5-20261026"/);
 const retail=html.slice(html.indexOf('ALTTUL PICK — RETAIL DESIGN SYSTEM'));
 assert.match(retail,/\.grid,\.product-discovery \.discovery-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(retail,/\.product-card-link \.price\{font-size:24px/);
 assert.match(retail,/\.product-card-link \.product\{font-size:14px/);
 const show=script.slice(script.indexOf('function show('),script.indexOf('\nconst browseLayout=',script.indexOf('function show(')));
 assert.ok(show.indexOf('box.append(pricing);')<show.indexOf('box.append(merchantBadge(p));'));
 assert.doesNotMatch(show,/상품 자세히 보기/);
 assert.match(html,/\.product-card-link \.merchant-badge\{/);
});
