import test from 'node:test';
import assert from 'node:assert/strict';
import {createBestFeedCache} from '../best-feed-cache.mjs';

const feed=(names=['커피'])=>({success:true,data:names.map(title=>({title,link:'https://example.com/product'}))});

test('Best feed cache reuses successful feed until its fresh TTL and labels stale results',async()=>{
 let now=0,calls=0;
 const cache=createBestFeedCache({clock:()=>now,freshMs:180000,staleMs:900000});
 await cache.load('today|10',async()=>{calls++;return feed()});
 assert.equal(cache.peek('today|10').stale,false);
 now=179999;
 assert.equal(cache.peek('today|10').stale,false);
 now=180000;
 const stale=cache.peek('today|10');
 assert.equal(stale.stale,true);
 assert.equal(cache.stalePayload(stale).filter_meta.cache_status,'stale');
 assert.equal(cache.stalePayload(stale).filter_meta.cache_age_seconds,180);
 assert.equal(calls,1);
 now=900000;
 assert.equal(cache.peek('today|10'),null);
});

test('Simultaneous identical best queries share one upstream request',async()=>{
 const cache=createBestFeedCache();
 let calls=0,release;
 const pending=new Promise(resolve=>release=resolve);
 const loader=async()=>{calls++;await pending;return feed()};
 const a=cache.load('popular|10',loader);
 const b=cache.load('popular|10',loader);
 assert.equal(a,b);
 release();
 await Promise.all([a,b]);
 assert.equal(calls,1);
 assert.equal(cache.peek('popular|10').payload.success,true);
});

test('Failed or malformed replies never replace verified best products',async()=>{
 let now=0;
 const cache=createBestFeedCache({clock:()=>now,freshMs:100,staleMs:1000});
 await cache.load('pick|5',async()=>feed(['정상상품']));
 now=150;
 await assert.rejects(cache.load('pick|5',async()=>({success:false,data:[]})),/INVALID_BEST_FEED/);
 assert.equal(cache.peek('pick|5').payload.data[0].title,'정상상품');
 await assert.rejects(cache.load('pick|5',async()=>{throw Error('upstream')}),/upstream/);
 assert.equal(cache.peek('pick|5').stale,true);
});

test('Cache bounds entries and accepts nested provider list responses',async()=>{
 const cache=createBestFeedCache({maxEntries:2});
 await cache.load('a',async()=>feed());
 await cache.load('b',async()=>({success:true,data:{list:[{title:'상품'}]}}));
 await cache.load('c',async()=>feed());
 assert.equal(cache.peek('a'),null);
 assert.equal(cache.peek('b').payload.data.list.length,1);
 assert.ok(cache.peek('c'));
});
