import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const switching=script.slice(script.indexOf('let selectedProductCategory='),script.indexOf('function productKey(p){'));
const fetchFlow=script.slice(script.indexOf('async function fetchRecommendationCategory(category){'),
 script.indexOf('// Progressive category discovery.',script.indexOf('async function fetchRecommendationCategory(category){')));

test('Changing a product category immediately starts real fetching without a second click',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 assert.match(switching,/productCategoryTabs\.addEventListener\("click",event=>/);
 assert.match(switching,/showExploreCategory\(button\.dataset\.productCategory\)/);
 assert.match(switching,/void fetchRecommendationCategory\(category\)/);
 assert.match(fetchFlow,/fetchProducts\("\/api\/search\?q="\+encodeURIComponent\(term\)\+"&limit=20"\)/);
 assert.match(html,/카테고리를 누르면 상품 목록이 바로 바뀝니다/);
 assert.doesNotMatch(html,/다른 판매처 상품 찾아보기/);
});

test('Each selected category has an independent visible product list, not mixed cumulative stock',()=>{
 assert.match(switching,/let selectedProductCategory="",recommendationExploreProgress=\{\},recommendationExploreItems=\{\}/);
 assert.match(switching,/availableItems=\(recommendationExploreItems\[category\]\|\|\[\]\)\.slice\(\)/);
 assert.match(switching,/refreshMerchantOptions\(\)/);
 assert.match(switching,/renderListing\(\)/);
 assert.match(switching,/grid\.replaceChildren\(make\("div","empty"/);
 assert.match(fetchFlow,/const items=recommendationExploreItems\[category\]\|\|\[\]/);
 assert.match(fetchFlow,/const seen=new Set\(items\.map\(productKey\)\)/);
 assert.match(fetchFlow,/recommendationExploreItems\[category\]=items\.concat\(fresh\)/);
 assert.match(fetchFlow,/if\(selectedProductCategory===category\)\{/);
 assert.match(fetchFlow,/if\(!storefrontEligible\(item\)\)continue/);
 assert.match(fetchFlow,/recommendation_discovered:true/);
});

test('Immediate response goes to matching category and all stale main routes are rejected',()=>{
 assert.match(fetchFlow,/if\(id!==requestId\|\|recommendationExplore\.hidden\)return/);
 assert.match(fetchFlow,/if\(selectedProductCategory===category\)\{/);
 assert.match(fetchFlow,/recommendationExploreProgress\[category\]=step\+1/);
 assert.match(script,/if\(selectedProductCategory&&!recommendationExplore\.hidden\)\{/);
 assert.match(script,/renderSelectedExplore\(\)/);
 assert.match(script,/if\(queued&&\(recommendationExploreProgress\[queued\]\|\|0\)===0\)void fetchRecommendationCategory\(queued\)/);
});

test('Fast category switches keep the latest selection while serializing requests',()=>{
 assert.match(switching,/recommendationExploreQueued=null/);
 assert.match(switching,/recommendationExploreQueued=category/);
 assert.match(switching,/if\(!primaryPending&&!recommendationExploreBusy\)\{/);
 assert.match(fetchFlow,/const queued=recommendationExploreQueued;recommendationExploreQueued=null/);
 assert.match(fetchFlow,/if\(queued&&queued===selectedProductCategory/);
 assert.match(switching,/b\.disabled=false/);
 assert.match(switching,/b\.setAttribute\("aria-pressed",String\(active\)\)/);
});

test('More button now only loads later terms in selected category',()=>{
 assert.match(fetchFlow,/recommendationExploreButton\.addEventListener\("click",\(\)=>\{/);
 assert.match(fetchFlow,/void fetchRecommendationCategory\(category\)/);
 assert.match(switching,/recommendationExploreButton\.hidden=!category\|\|done/);
 assert.match(fetchFlow,/step>=PRODUCT_CATEGORY_TERMS\[category\]\.length/);
 assert.match(fetchFlow,/response\.ok\|\|payload\.success!==true/);
 assert.match(fetchFlow,/검색 한도에 도달/);
 assert.match(fetchFlow,/if\(id===requestId&&!recommendationExplore\.hidden\)\{/);
});

test('Initial best items are not falsely labeled as selected Food products',()=>{
 assert.match(html,/data-product-category="food" aria-pressed="false"/);
 assert.match(html,/id="recommendation-explore-button"[^>]*hidden>/);
 assert.match(switching,/selectedProductCategory=""/);
 assert.match(switching,/recommendationExploreNote\.textContent="카테고리를 선택하면 상품을 바로 조회합니다/);
 assert.match(script,/const area=step===0\?"popular":"pick"/);
 assert.match(script,/link\.rel="sponsored nofollow noopener noreferrer"/);
});
