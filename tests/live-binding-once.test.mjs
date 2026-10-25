import test from 'node:test';
test('One-time safe Cloudflare production binding check',async()=>{
 const started=Date.now();
 try{
  const res=await fetch('https://alttulpick-api.maidana1779.workers.dev/health',{
   signal:AbortSignal.timeout(8000),
   headers:{accept:'application/json'}
  });
  const data=await res.json();
  const best=await fetch('https://alttulpick-api.maidana1779.workers.dev/api/best?area=today&limit=10',{signal:AbortSignal.timeout(12000),headers:{origin:'https://alttulpick-shop.onrender.com',accept:'application/json'}});
  const bestData=await best.json();
  console.log('ALTTUL_EDGE_PRODUCT_CHECK '+JSON.stringify({status:best.status,success:bestData.success===true,code:bestData.code||null,has_products:Array.isArray(bestData.data)?bestData.data.length>0:false}));
  console.log('ALTTUL_EDGE_BINDING_CHECK '+JSON.stringify({
   http_status:res.status,
   revision:typeof data.revision==='string'?data.revision:'not-available',
   adpick_binding:typeof data.adpick_binding==='string'?data.adpick_binding:'not-reported',
   elapsed_ms:Date.now()-started
  }));
 }catch(e){console.log('ALTTUL_EDGE_BINDING_CHECK '+JSON.stringify({error:e?.name||'error',elapsed_ms:Date.now()-started}))}
});