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
 const withoutNoscript=html.replace(/<noscript>[\s\S]*?<\/noscript>/g,'');
 assert.doesNotMatch(withoutNoscript,/<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus/);
 assert.match(script,/if\(jsonResponse&&\(response\.ok\|\|!\[502,503,504\]\.includes\(response\.status\)\)\)return response/);
 assert.match(script,/setTimeout\(\(\)=>backup\.abort\(\),22000\)/);
});

test('Live search can instantly show a verified query-matching Toss item during API wake-up',()=>{
 const start=script.indexOf('const featuredTossProducts=');
 const helper=script.indexOf('function instantMatchingTossProducts(query){',start);
 const end=script.indexOf('\nconst retryMain=',helper);
 assert.ok(start>=0&&helper>start&&end>helper,'preloaded Toss matching is available before initial search');
 const code=script.slice(start,end).replace(/function loadCuratedProducts\(\)\{[\s\S]*?\n\}/,'');
 const match=new Function(code+'return instantMatchingTossProducts;')();
 const result=match('생수');
 assert.equal(result.length,1);
 assert.match(result[0].title,/스파클 생수/);
 assert.equal(result[0].affiliate_source,'toss_sharelink');
 assert.equal(result[0].price,null);
 assert.equal(match('이어폰').length,0,'never display an unrelated product as a search match');
 assert.match(script,/else if\(instantMatches\.length\)\{[\s\S]*?renderListing\(\)/);
 assert.match(script,/토스쇼핑 등록 상품/);
 assert.match(script,/애드픽 검색 결과 없음/);
 assert.match(script,/if\(instantMatches\.length\)\{statusEl\.textContent/);
 assert.match(script,/}else if\(instantMatches\.length\)\{\s*statusEl\.textContent=/);
});
