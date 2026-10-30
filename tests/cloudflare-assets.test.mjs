import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const project=(path)=>new URL('../'+path,import.meta.url);
const wrangler=JSON.parse(readFileSync(project('wrangler.jsonc'),'utf8'));

test('Cloudflare Worker serves public storefront files while preserving API routing',()=>{
 assert.equal(wrangler.name,'alttulpick-api');
 assert.equal(wrangler.main,'worker/index.mjs');
 assert.equal(wrangler.assets.directory,'./public');
 assert.ok(wrangler.assets.run_worker_first.includes('/api/*'));
 assert.ok(wrangler.assets.run_worker_first.includes('/health'));
 assert.equal(wrangler.keep_vars,true,'Existing Cloudflare secrets must not be replaced');
});
test('Cloudflare index matches validated storefront exactly',()=>{
 const root=readFileSync(project('index.html'));
 const publicPage=readFileSync(project('public/index.html'));
 assert.ok(root.equals(publicPage),'Keep the public home page synchronized with index.html');
 const html=publicPage.toString('utf8');
 assert.match(html,/\/events\/11st-living\.png/);
 assert.match(html,/\/events\/xiaomi-smart-band-11\.jpg/);
 assert.match(html,/\/events\/intel-core-ultra-coupang\.jpg/);
 assert.match(html,/href="https:\/\/bitl\.bz\/jKubOI"/);
 assert.match(html,/href="https:\/\/bitl\.bz\/l0gfEs"/);
 assert.match(html,/href="https:\/\/bitl\.bz\/DfTQat"/);
 assert.doesNotMatch(html,/배너는 연출 사진입니다/);
});
test('Campaign media and required public informational routes are deployable',()=>{
 for(const file of [
   'public/events/11st-living.png',
   'public/events/xiaomi-smart-band-11.jpg',
   'public/events/intel-core-ultra-coupang.jpg',
   'public/about.html',
   'public/contact.html',
   'public/guide.html',
   'public/privacy.html',
   'public/shopping-events.json'
 ]){
  assert.ok(statSync(project(file)).size>0,file+' is missing or empty');
 }
});
