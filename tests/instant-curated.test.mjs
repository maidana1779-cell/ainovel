import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {curatedProducts} from '../curated-products.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const start=script.indexOf('const featuredTossProducts='),end=script.indexOf('\nfunction loadCuratedProducts()',start);
assert.ok(start>=0&&end>start);
const featured=new Function(script.slice(start,end)+'return featuredTossProducts;')();

test('All manually curated Toss items show immediately without another API request',()=>{
 assert.equal(featured.length,7);
 const saved=curatedProducts();
 assert.deepEqual(featured.map(p=>p.commissionlink),saved.map(p=>p.commissionlink));
 assert.deepEqual(featured.map(p=>p.title),saved.map(p=>p.title));
 const loader=script.slice(end,script.indexOf('\n// Curated feed is requested',end));
 assert.doesNotMatch(loader,/fetch|async|await/);
 assert.match(loader,/show\(featuredTossProducts,false,target\)/);
 assert.match(loader,/panel.hidden=false/);
 assert.match(script,/loadCuratedProducts\(\);\s*$/);
 assert.doesNotThrow(()=>new Script(script));
});

test('UI remains responsive when external font CDN or cold fallback server is slow',()=>{
 assert.match(html,/<link rel="preload" as="style"/);
 assert.match(html,/onload="this\.onload=null;this\.rel='stylesheet'"/);
 assert.doesNotMatch(html,/<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus/);
 assert.match(script,/if\(response\.ok\|\|!\[502,503,504\]\.includes\(response\.status\)\)return response/);
 assert.match(script,/setTimeout\(\(\)=>backup\.abort\(\),4500\)/);
});
