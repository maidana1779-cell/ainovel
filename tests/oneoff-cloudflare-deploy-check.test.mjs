import test from 'node:test';
test('Temporary production Worker revision and secret-binding status probe',async()=>{
 const url='https://alttulpick-api.maidana1779.workers.dev/health';
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(7500)});
  const data=await res.json();
  console.log('CLOUDFLARE_DIAGNOSTIC '+JSON.stringify({
   http_status:res.status,
   revision:data?.revision||null,
   adpick_binding:data?.adpick_binding||'not-reported'
  }));
 }catch(error){
  console.log('CLOUDFLARE_DIAGNOSTIC '+JSON.stringify({error:error?.name||'unknown'}));
 }
});
