import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogEnabled,catalogStatus,CATALOG_CATEGORIES,normalizeLicensedCatalog,validateLicensedFeedUrl,syncLicensedFeed} from '../catalog-core.mjs';
import {listCatalogFromDb,upsertCatalogBatch} from '../catalog-store.mjs';
const env={
 CATALOG_LICENSE_APPROVED:'true',CATALOG_DATABASE_URL:'postgresql://test/',
 CATALOG_APPROVED_FEED_URL:'https://licensed.example.com/feed.json',
 CATALOG_APPROVED_FEED_HOSTS:'licensed.example.com',CATALOG_SOURCE_ID:'licensed-demo'
};
const item={external_id:'SKU-102',category:'food',title:'국산 생수 2L',cp_name:'이유몰',
 cp_code:'abcd1',price:'1,990원',photo:'https://media.example.com/product.jpg',
 commissionlink:'https://biz.adpick.co.kr/r123'};
test('Catalog requires both explicit product-data approval and persistent database',()=>{
 assert.equal(catalogEnabled({}),false);
 assert.equal(catalogEnabled({...env,CATALOG_LICENSE_APPROVED:'false'}),false);
 assert.equal(catalogEnabled({...env,CATALOG_DATABASE_URL:''}),false);
 assert.equal(catalogEnabled(env),true);
 assert.equal(catalogStatus({}).mode,'awaiting_license_and_persistent_storage');
 assert.deepEqual(CATALOG_CATEGORIES,['food','living','digital','beauty','fashion','kitchen']);
});
test('Permission gate blocks network and writes when unapproved',async()=>{
 let requests=0,writes=0;
 await assert.rejects(syncLicensedFeed({env:{...env,CATALOG_LICENSE_APPROVED:'false'},
  fetchImpl:async()=>{requests++;throw Error('should not be called')},
  writeBatch:async()=>{writes++}}),/CATALOG_DISABLED/);
 assert.equal(requests,0);assert.equal(writes,0);
});
test('Licensed catalog keeps genuine items, identifiers and unchanged affiliate links',()=>{
 const at='2026-10-26T00:00:00.000Z';
 const result=normalizeLicensedCatalog([item,{...item},{...item,external_id:'SKU-103',cp_name:'YES24'},
  {...item,external_id:'SKU-104',title:'항공권 여행 상품'},
  {...item,external_id:'SKU-105',category:'travel'},
  {...item,external_id:'SKU-106',commissionlink:'http://bad.example.com/a'},
  {...item,external_id:'SKU-107',category:'digital',title:'전기포트'}],
  {sourceId:'licensed-demo',checkedAt:at});
 assert.equal(result.received,7);
 assert.equal(result.rejected,5);
 assert.equal(result.items.length,2);
 assert.equal(result.items[0].price,1990);
 assert.equal(result.items[0].commissionlink,item.commissionlink);
 assert.equal(result.items[0].checked_at,at);
 assert.equal(result.items[0].expires_at,'2026-10-27T00:00:00.000Z');
 assert.notEqual(result.items[0].product_key,result.items[1].product_key);
});
test('Catalog rejects excessive, malformed or unsuitable input',()=>{
 assert.throws(()=>normalizeLicensedCatalog(new Array(501).fill(item),{sourceId:'licensed-demo'}),/CATALOG_BATCH_LIMIT/);
 assert.throws(()=>normalizeLicensedCatalog([item],{sourceId:'!' }),/CATALOG_BAD_SOURCE/);
 assert.throws(()=>normalizeLicensedCatalog([item],{sourceId:'licensed-demo',ttlHours:100}),/CATALOG_BAD_TTL/);
 assert.throws(()=>validateLicensedFeedUrl('http://licensed.example.com/feed','licensed.example.com'),/NOT_ALLOWED/);
 assert.throws(()=>validateLicensedFeedUrl('https://evil.example/feed','licensed.example.com'),/NOT_ALLOWED/);
 assert.equal(validateLicensedFeedUrl(env.CATALOG_APPROVED_FEED_URL,env.CATALOG_APPROVED_FEED_HOSTS),env.CATALOG_APPROVED_FEED_URL);
});
test('Approved sync fetches at most one explicitly allowlisted feed and writes validated products',async()=>{
 let calls=0,writes=0,imported=null;
 const response={ok:true,headers:new Headers({'content-type':'application/json'}),
  text:async()=>JSON.stringify({products:[item,{...item,external_id:'SKU-200',cp_name:'마이리얼트립'}]})};
 const stats=await syncLicensedFeed({env,fetchImpl:async(url)=>{calls++;assert.equal(url,env.CATALOG_APPROVED_FEED_URL);return response},
  writeBatch:async(items,meta)=>{writes++;imported={items,meta}},
  clock:()=>new Date('2026-10-26T10:00:00Z')});
 assert.equal(calls,1);assert.equal(writes,1);
 assert.equal(stats.imported,1);assert.equal(imported.items[0].title,item.title);
 assert.equal(imported.meta.rejected,1);
});
test('Licensed feed failure never writes an incomplete catalog batch',async()=>{
 let writes=0;
 await assert.rejects(syncLicensedFeed({env,
  fetchImpl:async()=>({ok:true,headers:new Headers(),text:async()=>JSON.stringify({products:[{title:'invalid'}]})}),
  writeBatch:async()=>{writes++}}),/CATALOG_ALL_REJECTED/);
 assert.equal(writes,0);
});
test('Paged catalog only reads unexpired items and validates category bounds',async()=>{
 const history=[];
 const db={query:async(sql,args)=>{
  history.push({sql,args});
  if(/COUNT/.test(sql))return {rows:[{count:13}]};
  return {rows:[{title:'생수',price:1990,photo:null,cp_name:'이유몰',cp_code:'m1',
   commissionlink:'https://biz.adpick.co.kr/r1',category:'food',checked_at:'2026-10-26T00:00:00Z',expires_at:'2026-10-27T00:00:00Z'}]};
 }};
 const result=await listCatalogFromDb(db,{category:'food',limit:24,offset:0});
 assert.equal(result.data.count,1);assert.equal(result.data.total,13);
 assert.equal(result.data.list[0].checked_at,'2026-10-26T00:00:00.000Z');
 assert.match(history[0].sql,/expires_at>NOW\(\)/);
 assert.deepEqual(history[0].args,['food',24,0]);
 assert.deepEqual(history[1].args,['food']);
 await assert.rejects(listCatalogFromDb(db,{category:'travel'}),/CATALOG_BAD_QUERY/);
 await assert.rejects(listCatalogFromDb(db,{category:'food',limit:900}),/CATALOG_BAD_QUERY/);
});
test('Batch upsert is atomic and keyed by source product ID',async()=>{
 const sql=[],db={connect:async()=>({query:async(s,v)=>{sql.push([s,v]);return {rows:[]}},release:()=>{sql.push(['RELEASE'])}})};
 const {items}=normalizeLicensedCatalog([item],{sourceId:'licensed-demo'});
 const out=await upsertCatalogBatch(db,items,{source_id:'licensed-demo',received:1,rejected:0});
 assert.equal(out.count,1);
 assert.equal(sql[0][0],'BEGIN');assert.match(sql[1][0],/ON CONFLICT \(product_key\)/);
 assert.equal(sql[2][1][2],1);assert.equal(sql[3][0],'COMMIT');assert.equal(sql[4][0],'RELEASE');
});
test('Database write rollback protects old catalog against a failed update',async()=>{
 let rolledBack=0,released=0;
 const db={connect:async()=>({query:async(q)=>{
  if(q==='ROLLBACK'){rolledBack++;return}
  if(/INSERT INTO catalog_products/.test(q))throw Error('DB write failed');
 },release:()=>released++})};
 const {items}=normalizeLicensedCatalog([item],{sourceId:'licensed-demo'});
 await assert.rejects(upsertCatalogBatch(db,items,{source_id:'licensed-demo',received:1,rejected:0}),/DB write failed/);
 assert.equal(rolledBack,1);assert.equal(released,1);
});

test('Approved data source cannot silently redirect to a non-licensed host',async()=>{
 let seen=null;
 try{await syncLicensedFeed({env,
  fetchImpl:async(_url,init)=>{seen=init;throw Error('redirect blocked')},
  writeBatch:async()=>{throw Error('write must not run')}})}catch{}
 assert.equal(seen?.redirect,'error');
});
