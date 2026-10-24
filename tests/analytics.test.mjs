import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {createAnalytics,safeSearchBucket,safeMerchantBucket} from '../analytics.mjs';

test('Anonymous aggregate dashboard counts page requests, searches, missing results and outbound clicks',()=>{
 let now=Date.parse('2026-10-24T15:00:00.000Z');
 const a=createAnalytics({now:()=>now});
 a.pageView();a.pageView();
 a.search('세제',3);a.search('알수없는 전화번호 010-1234-5678',0);a.click('토스쇼핑');a.click('11번가');
 const d=a.snapshot();
 assert.equal(d.totals.pageViews,2);
 assert.equal(d.totals.searches,2);
 assert.equal(d.totals.emptySearches,1);
 assert.equal(d.emptySearchRate,50);
 assert.equal(d.totals.productClicks,2);
 assert.deepEqual(d.topSearches,[{name:'기타 검색',count:1},{name:'세제',count:1}]);
 assert.ok(d.topMerchants.some(item=>item.name==='토스쇼핑'));
 assert.equal(d.days[0].day,'2026-10-25');
 assert.equal(d.retention,'RAM_ONLY_RESETS_ON_RESTART');
 assert.ok(!JSON.stringify(d).includes('010-1234-5678'));
 assert.equal(d.note.includes('구매·수익과 다릅니다'),true);
});
test('Personal search contents never become analytics buckets',()=>{
 for(const query of ['my secret 010-1234-5678','someone@example.com','홍길동','무작위 검색어']){
  assert.equal(safeSearchBucket(query),'기타 검색');
 }
 assert.equal(safeSearchBucket('캡슐세제'),'캡슐세제');
 assert.equal(safeSearchBucket('  커 피 '),'커피');
 assert.equal(safeMerchantBucket('올리브영 공식'),'올리브영');
 assert.equal(safeMerchantBucket('알 수 없는 상점'),'기타 판매처');
});
test('Dashboard only keeps trailing seven Korean calendar days',()=>{
 let now=Date.parse('2026-10-18T15:00:00.000Z');const a=createAnalytics({now:()=>now});
 a.pageView();
 now=Date.parse('2026-10-26T15:00:00.000Z');a.pageView();
 const snapshot=a.snapshot();
 assert.equal(snapshot.totals.pageViews,1);
 assert.equal(snapshot.days[0].day,'2026-10-27');
});
test('Admin routes enforce bearer token and block raw private analytics',()=>{
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 const page=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(server,/timingSafeEqual/);
 assert.match(server,/secret\.length<32/);
 assert.match(server,/if\(!isAdmin\(req\)\)/);
 assert.match(server,/allowedOrigin\(req\)/);
 assert.match(server,/const TRACK_LIMIT=120/);
 assert.match(server,/analytics\.pageView\(\)/);
 assert.match(server,/analytics\.search\(params\.q,combined\.length\)/);
 assert.match(server,/analytics\.click\(body\.merchant\)/);
 assert.match(index,/navigator\.sendBeacon/);
 assert.match(index,/product_click/);
 assert.match(page,/noindex,nofollow,noarchive/);
 assert.doesNotMatch(page,/localStorage|sessionStorage|document\.cookie/);
 assert.doesNotMatch(index,/ALTTUL_ADMIN_TOKEN/);
 assert.ok(!page.includes('ALTTUL_ADMIN_TOKEN'));
 const script=page.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script));
});
