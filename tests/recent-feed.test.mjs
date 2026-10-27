import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);

test('Recently successful listings show before the asynchronous live fetch without omitting refresh',()=>{
 assert.doesNotThrow(()=>new Script(js));
 assert.match(js,/const cachedItems=recentFeed\(url\)/);
 assert.match(js,/statusEl\.textContent="최근 조회 상품 "/);
 assert.match(js,/keepRecentFeed\(url,initial\)/);
 const loader=js.slice(js.indexOf('async function load(url){'),js.indexOf('// Progressive category discovery'));
 assert.ok(loader.indexOf('recentFeed(url)')<loader.indexOf('await fetchProducts(url,'));
 assert.match(loader,/if\(cachedItems\)\{[\s\S]*?최근 조회 상품 표시 중/);
 assert.match(loader,/가격은 판매처에서 확인/);
 assert.match(js,/const RECENT_FEED_MS=90000/);
});

test('Browser cache expires in 90 seconds and never needs storage access to work',()=>{
 const begin=js.indexOf('const RECENT_FEED_MS=');
 const end=js.indexOf('const retryMain=',begin);
 assert.ok(end>begin,'isolate recent-feed helpers from DOM controls');
 assert.ok(begin>=0&&end>begin);
 const values=new Map();
 const storage={
  getItem:k=>values.get(k)||null,
  setItem:(k,v)=>values.set(k,v),
  removeItem:k=>values.delete(k)
 };
 const guardStart=js.indexOf('function storefrontEligible(p){');
 const guardEnd=js.indexOf('function displayPrice(',guardStart);
 assert.ok(guardStart>0&&guardEnd>guardStart);
 const browserPolicy=js.slice(guardStart,guardEnd);
 const funcs=new Function('sessionStorage','let currentQuery="";\n'+browserPolicy+js.slice(begin,end)+'return {recentFeed,keepRecentFeed};')(storage);
 funcs.keepRecentFeed('/api/best?area=today&limit=10',[{title:'상품',price:100}]);
 assert.deepEqual(funcs.recentFeed('/api/best?area=today&limit=10'),[{title:'상품',price:100}]);
 assert.equal(funcs.recentFeed('/api/best?area=popular&limit=10'),null);
 const key=[...values.keys()][0];
 const saved=JSON.parse(values.get(key));saved.at-=90001;values.set(key,JSON.stringify(saved));
 assert.equal(funcs.recentFeed('/api/best?area=today&limit=10'),null);
 const denied=new Function('sessionStorage','let currentQuery="";\n'+browserPolicy+js.slice(begin,end)+'return {recentFeed,keepRecentFeed};')({
  getItem(){throw Error('denied')},setItem(){throw Error('denied')},removeItem(){throw Error('denied')}
 });
 assert.equal(denied.recentFeed('/api/best?area=today&limit=10'),null);
 assert.doesNotThrow(()=>denied.keepRecentFeed('/api/best?area=today&limit=10',[{title:'상품'}]));
});
