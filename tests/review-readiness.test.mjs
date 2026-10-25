import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Script} from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const pages=['about','guide','privacy','contact'];

test('Homepage is discoverable and transparent for affiliate platform review',()=>{
 assert.match(html,/<meta name="robots" content="index,follow,max-image-preview:large">/);
 assert.match(html,/rel="canonical" href="https:\/\/alttulpick-shop\.onrender\.com\/"/);
 assert.match(html,/<meta property="og:title"/);
 assert.match(html,/https:\/\/alttulpick-shop\.onrender\.com\/share-preview\.png/);
 assert.match(html,/name="twitter:image"/);
 assert.match(html,/제휴 상품 안내 서비스/);
 assert.match(html,/운영자가 수수료를 받을 수 있습니다/);
 assert.match(html,/판매처에서 진행됩니다/);
 assert.match(html,/토스쇼핑 쉐어링크 활동의 일환/);
 assert.match(html,/id="retry-main"/);
 assert.doesNotMatch(script,/show\(demo,true\)/);
 assert.doesNotMatch(html,/알뜰픽 베타 서비스/);
 assert.doesNotThrow(()=>new Script(script));
});

test('Every service and privacy page has a real standalone URL and a return to shopping',()=>{
 for(const name of pages){
  const path=resolve(root,'public',name+'.html');
  assert.ok(existsSync(path),path);
  const page=readFileSync(path,'utf8');
  assert.match(page,/<html lang="ko">/);
  assert.match(page,/meta name="description" content="[^"]+"/);
  assert.match(page,new RegExp('canonical" href="https://alttulpick-shop\\.onrender\\.com/'+name+'\\.html"'));
  assert.match(page,/meta property="og:image"/);
  assert.match(page,/share-preview\.png/);
  assert.match(page,/href="\/"/);
  for(const linked of pages){
   assert.match(page,new RegExp('href="/'+linked+'\\.html"'),name+' -> '+linked);
   assert.match(html,new RegExp('href="/'+linked+'\\.html"'),'homepage -> '+linked);
  }
 }
});

test('Privacy disclosure describes the actual no-account, 90s browser-cache and anonymous aggregate analytics',()=>{
 const privacy=readFileSync(resolve(root,'public/privacy.html'),'utf8');
 for(const item of ['회원가입','sessionStorage','90초','Render','Cloudflare Workers','애드픽 BIZ','토스쇼핑','접속기록','문의 연락처']){
  assert.ok(privacy.includes(item),item);
 }
 const contact=readFileSync(resolve(root,'public/contact.html'),'utf8');
 assert.match(contact,/공식 연락처를 확인하지 않은 상태에서 임의의 이메일 주소나 연락처를 안내하지 않습니다/);
 assert.doesNotMatch(contact,/example\.com|mailto:hello@|contact@alttulpick/);
});

test('Search engines can discover public information while admin pages stay private',()=>{
 const robots=readFileSync(resolve(root,'public/robots.txt'),'utf8');
 const map=readFileSync(resolve(root,'public/sitemap.xml'),'utf8');
 assert.match(robots,/Allow: \//);
 assert.match(robots,/Disallow: \/admin/);
 assert.match(robots,/Sitemap: https:\/\/alttulpick-shop\.onrender\.com\/sitemap\.xml/);
 for(const page of ['',...pages.map(n=>n+'.html')]){
  assert.ok(map.includes('https://alttulpick-shop.onrender.com/'+page),page);
 }
 const publicFiles=['robots.txt','sitemap.xml','share-preview.svg',...pages.map(p=>p+'.html')];
 for(const name of publicFiles)assert.ok(existsSync(resolve(root,'public',name)),name);
});

test('Build-time social card is an actual 1200x630 PNG, no remote dependencies',()=>{
 const task=spawnSync(process.execPath,['scripts/build-og.mjs'],{cwd:root,encoding:'utf8',timeout:9000});
 assert.equal(task.status,0,task.stderr||task.stdout);
 const png=readFileSync(resolve(root,'public','share-preview.png'));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),1200);
 assert.equal(png.readUInt32BE(20),630);
 assert.ok(png.length>1000);
 assert.ok(png.length<200000,'share card must be lightweight');
 const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
 assert.match(pkg.scripts.postinstall,/node scripts\/build-og\.mjs/);
});
