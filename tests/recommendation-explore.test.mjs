import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {getSearchPlan} from '../search-plan.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const clickStart=script?.indexOf('recommendationExploreButton.addEventListener("click"')??-1;
const clickEnd=script?.indexOf('// Progressive category discovery',clickStart)??-1;
const click=script?.slice(clickStart,clickEnd);

test('All three top recommendation tabs offer customer-driven product exploration',()=>{
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script));
 for(const id of ['recommendation-explore','recommendation-explore-button','recommendation-explore-note','product-category-tabs'])
  assert.equal(html.split('id="'+id+'"').length-1,1,id);
 assert.match(script,/return u\.pathname==="\/api\/best"&&\["today","popular","pick"\]\.includes/);
 assert.match(script,/updateRecommendationExplore\(url\)/);
 assert.match(html,/상품 더 찾아보기/);
 assert.match(html,/실제 제휴 상품을 더 조회/);
 assert.doesNotMatch(html,/다른 판매처 상품 찾아보기|다른 제휴 쇼핑몰 상품도 찾아보세요/);
});

test('Shoppers can choose actual shopping departments, led by food/living/electronics',()=>{
 for(const [code,label] of [['food','식품'],['living','리빙·주방'],['digital','가전·디지털'],['beauty','뷰티'],['fashion','패션']]){
  assert.match(html,new RegExp('data-product-category="'+code+'"[^>]*>'+label+'<'));
 }
 const start=script.indexOf('const PRODUCT_CATEGORY_TERMS=');
 const end=script.indexOf('const PRODUCT_CATEGORY_NAMES=',start);
 assert.ok(start>0&&end>start);
 const productTopics=new Function(script.slice(start,end)+'return PRODUCT_CATEGORY_TERMS;')();
 assert.deepEqual(Object.keys(productTopics),['food','living','digital','beauty','fashion']);
 for(const [name,topics] of Object.entries(productTopics)){
  assert.ok(topics.length>=5&&topics.length<=7,name);
  assert.equal(new Set(topics).size,topics.length,name);
  assert.ok(topics.every(v=>typeof v==='string'&&v.length>=2));
  assert.ok(topics.every(v=>getSearchPlan(v).terms.length>=1),name);
 }
 assert.deepEqual(productTopics.food.slice(0,3),['간편식','라면','생수']);
 assert.deepEqual(productTopics.living.slice(0,2),['세제','주방용품']);
 assert.deepEqual(productTopics.digital.slice(0,2),['이어폰','노트북']);
});

test('Click fetches one bounded real category search, not a merchant-directory request',()=>{
 assert.ok(clickStart>0&&clickEnd>clickStart);
 assert.match(click,/fetchProducts\("\/api\/search\?q="\+encodeURIComponent\(term\)\+"&limit=20"\)/);
 assert.match(click,/const fresh=uniqueNew\(list\)\.map/);
 assert.match(click,/recommendation_discovered:true/);
 assert.match(click,/availableItems\.push\(\.\.\.fresh\)/);
 assert.match(click,/shownCount=availableItems\.length/);
 assert.match(click,/새 상품 "\+fresh\.length\+"개 추가/);
 assert.match(click,/updateRecommendationExploreButton\(\)/);
 assert.match(script,/p\.recommendation_discovered===true/);
 assert.match(script,/추가 탐색 상품/);
 assert.doesNotMatch(click,/new Set\(fresh\.map\(p=>String\(p\.cp_name/);
 assert.doesNotMatch(click,/판매처 \+|새 판매처|merchantCount/);
 assert.doesNotMatch(click,/setInterval|while\s*\(|\/api\/malls/);
});

test('Quota errors and stale tab changes do not consume a search topic',()=>{
 assert.match(click,/if\(id!==requestId\|\|recommendationExplore\.hidden\)return/);
 assert.match(click,/if\(!response\.ok\|\|payload\.success!==true\)throw/);
 assert.match(click,/recommendationExploreProgress\[category\]=step\+1/);
 const successIdx=click.indexOf('recommendationExploreProgress[category]=step+1');
 const failureIdx=click.indexOf('if(!response.ok||payload.success!==true)throw');
 assert.ok(successIdx>failureIdx);
 assert.match(click,/검색 한도에 도달/);
 assert.match(script,/recommendationExploreProgress=\{\}/);
});

test('Category chips are touch-friendly and have accessible selected states',()=>{
 assert.match(html,/\.product-category-chip\{border:1px/);
 assert.match(html,/\.product-category-chip\{min-height:42px\}/);
 assert.match(script,/b\.setAttribute\("aria-pressed",String\(active\)\)/);
 assert.match(script,/b\.disabled=recommendationExploreBusy/);
 assert.match(script,/recommendationExploreButton\.disabled=recommendationExploreBusy\|\|recommendationExplore\.hidden\|\|done\|\|primaryPending/);
});

test('Original supplier ranking and affiliate links are preserved for all additional cards',()=>{
 assert.match(script,/const fresh=uniqueNew\(list\)\.map\(item=>\(\{\.\.\.item,recommendation_discovered:true\}\)\)/);
 assert.match(script,/link\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(script,/priceLabel\(price\)/);
});
