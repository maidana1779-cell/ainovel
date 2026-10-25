import {CATALOG_CATEGORIES} from './catalog-core.mjs';

let activePool=null,activeConnection='';
async function poolFor(connectionString){
 if(!connectionString)throw Error('CATALOG_DATABASE_REQUIRED');
 if(activePool&&activeConnection===connectionString)return activePool;
 if(activePool){await activePool.end();activePool=null}
 const {Pool}=await import('pg');
 activePool=new Pool({connectionString,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:4000});
 activeConnection=connectionString;
 return activePool;
}
export async function listCatalogFromDb(db,{category,limit=24,offset=0}={}){
 if(!CATALOG_CATEGORIES.includes(category)||!Number.isInteger(limit)||limit<1||limit>48||
 !Number.isInteger(offset)||offset<0||offset>5000)throw Error('CATALOG_BAD_QUERY');
 const rows=await db.query(
  'SELECT title,price,photo,cp_name,cp_code,commissionlink,category,checked_at,expires_at FROM catalog_products WHERE category=$1 AND expires_at>NOW() ORDER BY checked_at DESC,product_key ASC LIMIT $2 OFFSET $3',
  [category,limit,offset]);
 const total=await db.query('SELECT COUNT(*)::int AS count FROM catalog_products WHERE category=$1 AND expires_at>NOW()',[category]);
 return {success:true,data:{category,count:rows.rows.length,total:total.rows[0]?.count||0,limit,offset,
  list:rows.rows.map(p=>({...p,checked_at:new Date(p.checked_at).toISOString()}))}};
}
export async function catalogPage(connectionString,params){
 return listCatalogFromDb(await poolFor(connectionString),params);
}
export async function upsertCatalogBatch(db,items,meta){
 if(!Array.isArray(items)||items.length>500)throw Error('CATALOG_BAD_BATCH');
 if(!meta||typeof meta.source_id!=='string'||!meta.source_id||!Number.isInteger(meta.received)||
 !Number.isInteger(meta.rejected))throw Error('CATALOG_BAD_META');
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  for(const p of items){
   await client.query(
    'INSERT INTO catalog_products (product_key,source_id,external_id,category,title,cp_name,cp_code,price,photo,commissionlink,checked_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (product_key) DO UPDATE SET category=EXCLUDED.category,title=EXCLUDED.title,cp_name=EXCLUDED.cp_name,cp_code=EXCLUDED.cp_code,price=EXCLUDED.price,photo=EXCLUDED.photo,commissionlink=EXCLUDED.commissionlink,checked_at=EXCLUDED.checked_at,expires_at=EXCLUDED.expires_at,updated_at=NOW()',
    [p.product_key,p.source_id,p.external_id,p.category,p.title,p.cp_name,p.cp_code,
     p.price,p.photo,p.commissionlink,p.checked_at,p.expires_at]);
  }
  await client.query('INSERT INTO catalog_sync_runs (source_id,received,imported,rejected) VALUES ($1,$2,$3,$4)',
   [meta.source_id,meta.received,items.length,meta.rejected]);
  await client.query('COMMIT');
 }catch(err){await client.query('ROLLBACK').catch(()=>{});throw err}
 finally{client.release()}
 return {count:items.length};
}
export async function catalogSyncWriter(connectionString,items,meta){
 return upsertCatalogBatch(await poolFor(connectionString),items,meta);
}
