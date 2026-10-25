import test from 'node:test';
test('One-time production review pages and social thumbnail HTTP probe',async()=>{
 const base='https://alttulpick-shop.onrender.com';
 for(const path of ['/','/about.html','/guide.html','/privacy.html','/contact.html','/robots.txt','/sitemap.xml','/share-preview.png']){
  const start=Date.now();
  try{
   const response=await fetch(base+path,{signal:AbortSignal.timeout(10000)});
   const arr=new Uint8Array(await response.arrayBuffer());
   const first=Buffer.from(arr.subarray(0,256)).toString('utf8');
   console.log('PUBLIC_SITE_SMOKE '+JSON.stringify({
    path,status:response.status,bytes:arr.length,
    mime:response.headers.get('content-type')||'',
    png:path.endsWith('.png')?Buffer.from(arr.subarray(0,8)).toString('hex')==='89504e470d0a1a0a':null,
    homeText:path==='/'?first.includes('<!doctype html>'):null,
    elapsed_ms:Date.now()-start
   }));
  }catch(e){console.log('PUBLIC_SITE_SMOKE '+JSON.stringify({path,error:e?.name||'Error',elapsed_ms:Date.now()-start}))}
 }
});
