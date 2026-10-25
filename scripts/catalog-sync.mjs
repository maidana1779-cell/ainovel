import {syncLicensedFeed} from '../catalog-core.mjs';
import {catalogSyncWriter} from '../catalog-store.mjs';

// Run only as an authorized one-off task or via a paid scheduled service.
// Intentionally does not fetch Adpick BIZ search output and does not run on server startup.
try{
 const result=await syncLicensedFeed({writeBatch:(items,meta)=>
  catalogSyncWriter(process.env.CATALOG_DATABASE_URL,items,meta)});
 console.log('Licensed catalog sync completed:',JSON.stringify(result));
 process.exitCode=0;
}catch(err){
 console.error('Licensed catalog sync not started or failed:',String(err?.message||'error'));
 process.exitCode=1;
}
