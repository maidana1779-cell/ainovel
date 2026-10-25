import test from 'node:test';
test('One-time safe Cloudflare production binding check',async()=>{
 const started=Date.now();
 try{
  const res=await fetch('https://alttulpick-api.maidana1779.workers.dev/health',{
   signal:AbortSignal.timeout(8000),
   headers:{accept:'application/json'}
  });
  const data=await res.json();
  console.log('ALTTUL_EDGE_BINDING_CHECK '+JSON.stringify({
   http_status:res.status,
   revision:typeof data.revision==='string'?data.revision:'not-available',
   adpick_binding:typeof data.adpick_binding==='string'?data.adpick_binding:'not-reported',
   elapsed_ms:Date.now()-started
  }));
 }catch(e){console.log('ALTTUL_EDGE_BINDING_CHECK '+JSON.stringify({error:e?.name||'error',elapsed_ms:Date.now()-started}))}
});