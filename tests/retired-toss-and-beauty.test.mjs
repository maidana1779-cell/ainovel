import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workerFetch} from '../worker/index.mjs';
import {filterCatalogProducts} from '../catalog-policy.mjs';
import {getSearchPlan} from '../search-plan.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const browserCode=html.slice(html.indexOf('function storefrontEligible(p){'),html.indexOf('\nfunction displayPrice(',html.indexOf('function storefrontEligible(p){')));
const storefrontEligible=new Function(browserCode+'return storefrontEligible;')();
const origin='https://alttulpick-shop.onrender.com';
const req=p=>new Request('https://alttulpick-api.example.workers.dev'+p,{headers:{origin}});
test('Retired Toss links cannot return via live or cached product UI while Coupang remains eligible',()=>{
 const toss={title:'스파클 생수 500ml 80개',cp_name:'토스쇼핑',affiliate_source:'toss_sharelink',commissionlink:'https://toss.shopping/_m/fEfXH2Dz'};
 const tossMerchant={title:'생수 2L',cp_name:'토스 쇼핑',commissionlink:'https://bitl.bz/x1'};
 const tossLink={title:'생수 2L',cp_name:'오픈마켓',commissionlink:'https://toss.shopping/_m/x1'};
 const coupang={title:'생수 2L 12개',cp_name:'쿠팡',commissionlink:'https://bitl.bz/BHrbPz'};
 assert.deepEqual(filterCatalogProducts([toss,tossMerchant,tossLink,coupang]).items,[coupang]);
 for(const p of [toss,tossMerchant,tossLink])assert.equal(storefrontEligible(p),false,p.cp_name);
 assert.equal(storefrontEligible(coupang),true);
 assert.match(html,/const instantMatches=\[\];/);
 assert.match(html,/id="toss-picks"[^>]*hidden/);
 assert.equal(html.includes('<a href="#toss-picks">'),false);
 assert.equal(html,readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));
});
test('Legacy curated products are removed from public Worker responses without reading external APIs',async()=>{
 const res=await workerFetch(req('/api/curated'),{});
 assert.equal(res.status,200);
 assert.deepEqual((await res.json()).data,[]);
});
test('Beauty initial category query uses one upstream keyword and retains follow-on choices',()=>{
 assert.deepEqual(getSearchPlan('화장품',0).terms,['화장품']);
 assert.deepEqual(getSearchPlan('화장품',1).terms,['선크림','립스틱']);
 assert.equal(getSearchPlan('화장품',0).codes,null);
 assert.match(html,/categoryResponseCache=new Map\(\)/);
 assert.match(html,/categoryResponseCache\.set\(categoryCacheKey/);
 assert.match(html,/const endpoint="\/api\/best\?area="\+area\+"&limit=10"/);
});
