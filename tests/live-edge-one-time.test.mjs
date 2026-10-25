import test from 'node:test';
test('One-time end-to-end Cloudflare Adpick feed timing probe',async()=>{
 const started=Date.now();
 try{
  const response=await fetch('https://alttulpick-api.maidana1779.workers.dev/api/best?area=today&limit=10',{
   headers:{origin:'https://alttulpick-shop.onrender.com'},
   signal:AbortSignal.timeout(12500)
  });
  const payload=await response.json();
  const list=Array.isArray(payload.data)?payload.data:Array.isArray(payload.data?.list)?payload.data.list:[];
  console.log('LIVE_EDGE_FEED_DIAGNOSTIC '+JSON.stringify({
   status:response.status,elapsed_ms:Date.now()-started,
   success:payload.success===true,count:list.length,
   cache_state:payload.filter_meta?.cache_status||'not-stale',
   api_error_code:payload.code||null
  }));
 }catch(error){
  console.log('LIVE_EDGE_FEED_DIAGNOSTIC '+JSON.stringify({
   status:'error',elapsed_ms:Date.now()-started,name:error?.name||'Error'
  }));
 }
});