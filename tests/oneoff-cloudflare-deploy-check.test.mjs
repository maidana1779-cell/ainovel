import test from 'node:test';
// One-time, no-secret smoke check. Remove after observing live build logs.
test('Production Adpick feed failover smoke check',async()=>{
 const edge='https://alttulpick-api.maidana1779.workers.dev';
 const origin='https://alttulpick-shop.onrender.com';
 try{
  // Wake the existing free Render backup so the smoke test measures the proxy, not sleeping.
  const warmStart=Date.now();
  try{
   const warm=await fetch('https://alttulpick-preview.onrender.com/',{
    signal:AbortSignal.timeout(65000)
   });
   console.log('ONEOFF_RENDER_WAKE '+JSON.stringify({status:warm.status,elapsed_ms:Date.now()-warmStart}));
   await warm.body?.cancel();
  }catch(e){console.log('ONEOFF_RENDER_WAKE '+JSON.stringify({error:e?.name||'error'}))}
  const health=await(await fetch(edge+'/health',{signal:AbortSignal.timeout(8000)})).json();
  console.log('ONEOFF_WORKER_HEALTH '+JSON.stringify({
   revision:health.revision,adpick_binding:health.adpick_binding
  }));
  for(let index=1;index<=2;index++){
   const t=Date.now();
   const response=await fetch(edge+'/api/best?area=today&limit=4',{
    signal:AbortSignal.timeout(14000),headers:{origin}
   });
   const payload=await response.json();
   const list=Array.isArray(payload.data)?payload.data:Array.isArray(payload.data?.list)?payload.data.list:[];
   console.log('ONEOFF_WORKER_PRODUCTS '+JSON.stringify({
    request:index,http_status:response.status,success:payload.success===true,
    count:list.length,elapsed_ms:Date.now()-t,cache:payload.filter_meta?.cache_status||null,
    code:payload.code||null
   }));
  }
 }catch(e){console.log('ONEOFF_WORKER_ERROR '+JSON.stringify({error:e?.name||'Error'}))}
});
