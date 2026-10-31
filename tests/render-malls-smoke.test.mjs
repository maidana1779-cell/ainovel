import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {normalizeMallsResponse,mallCategory,safeMallUrl} from '../merchant-directory.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Render storefront publish copy is synchronized with 13 categories and mall directory',()=>{
 const html=read('index.html');
 assert.equal(html,read('public/index.html'));
 assert.match(html,/13개 카테고리/);
 assert.match(html,/href="\/malls\.html"/);
 const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 for(const q of ['사료','기저귀','운동용품','의자','차량용품','필기구','마사지기']){
  assert.ok(html.includes('data-extra-department="'+q+'"'));
  assert.ok(html.includes('data-query="'+q+'"'));
 }
});
test('Render Node backend retains licensed catalog routes and adds Adpick /malls',()=>{
 const server=read('server.mjs');
 for(const str of ["url.pathname==='/api/catalog/status'","url.pathname==='/api/catalog'","url.pathname==='/api/malls'"]){
  assert.ok(server.includes(str),str);
 }
 assert.ok(server.includes('normalizeMallsResponse'));
 assert.ok(server.includes("url.pathname==='/malls.html'"));
 const page=read('public/malls.html');
 assert.match(page,/alttulpick-api\.maidana1779\.workers\.dev\/api\/malls/);
 assert.match(page,/sponsored nofollow noopener noreferrer/);
 const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.doesNotThrow(()=>new Script(script));
});
test('Service merchants retain authenticated supplier links, exclude unsafe URLs',()=>{
 assert.equal(mallCategory('교복몰'),'학생·유아동');
 assert.equal(mallCategory('인프런'),'온라인 강의');
 assert.equal(mallCategory('애드픽 지식마켓'),'지식·전문서비스');
 const response=normalizeMallsResponse({success:true,data:[
  {name:'교복몰',cp_code:'uniform',commissionlink:'https://link.adpick.co.kr/actual'},
  {name:'인프런',cp_code:'course',commissionlink:''},
  {name:'지식마켓',cp_code:'knowledge',commissionlink:'javascript:alert(1)'}
 ]});
 assert.equal(response.data.length,3);
 assert.equal(response.data[0].commissionlink,'https://link.adpick.co.kr/actual');
 assert.equal(response.data[1].commissionlink,'');
 assert.equal(response.data[2].commissionlink,'');
 assert.equal(safeMallUrl('http://example.com'),'');
});
