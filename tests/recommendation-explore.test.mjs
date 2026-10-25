import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
test('Recommendation tab explains supplier-ranked top ten, with an optional merchant explorer',()=>{
 assert.ok(js);assert.doesNotThrow(()=>new Script(js));
 for(const id of ['recommendation-explore','recommendation-explore-button','recommendation-explore-note'])
  assert.equal(html.split('id="'+id+'"').length-1,1,id);
 assert.match(html,/최대 10개 상품/);
 assert.match(html,/현재 가져온 판매처만 표시/);
 assert.match(js,/recommendationExploreVisible\(url\)/);
 assert.match(js,/parsed\.searchParams\.get\("area"\)==="pick"/);
 assert.match(js,/updateRecommendationExplore\(url\)/);
});
test('Discovery only calls a real search on a customer click, deduplicates, and labels results',()=>{
 const start=js.indexOf('recommendationExploreButton.addEventListener("click"');
 const end=js.indexOf('// Progressive category discovery',start);
 assert.ok(start>0&&end>start);
 const fragment=js.slice(start,end);
 assert.match(fragment,/fetchProducts\("\/api\/search\?q="/);
 assert.match(fragment,/encodeURIComponent\(term\)/);
 assert.match(fragment,/const fresh=uniqueNew\(list\)/);
 assert.match(fragment,/recommendation_discovered:true/);
 assert.match(fragment,/availableItems\.push\(\.\.\.fresh\)/);
 assert.match(js,/p\.recommendation_discovered===true/);
 assert.match(js,/추가 검색 상품/);
 assert.match(fragment,/if\(id!==requestId\|\|recommendationExplore\.hidden\)return/);
 assert.doesNotMatch(fragment,/setInterval|while\s*\(/);
});
test('Cross-category searches are bounded and the mobile CTA remains tappable',()=>{
 assert.match(js,/const RECOMMENDATION_EXPLORE_TERMS=\["의류","이어폰","화장품","주방용품","간편식"\]/);
 assert.match(js,/recommendationExploreStep>=RECOMMENDATION_EXPLORE_TERMS\.length/);
 assert.match(js,/새 판매처가 꼭 발견되는 것은 아닙니다/);
 assert.match(html,/\.recommendation-explore-button\{width:100%;min-height:44px\}/);
});

test('Recommendation exploration waits until the original feed loads',()=>{
 assert.match(js,/recommendationExploreButton\.disabled=!recommendationExplore\.hidden/);
 assert.match(js,/if\(!recommendationExplore\.hidden\)recommendationExploreButton\.disabled=false/);
});
