import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {normalizePartnerMalls,safeAffiliateLink} from '../partner-malls.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const goodMall=(id,commissionlink='https://link.adpick.co.kr/abc')=>({
 cp_code:id,name:'판매처 '+id,icon:'https://cdn.adpick.co.kr/icons/store.png',
 title:'제휴 쇼핑몰',commissionlink,commission_per:'3.0'
});
test('Normalize only legitimate BIZ merchant sales links, never affiliate percentage as discount',()=>{
 const list=normalizePartnerMalls({success:true,data:[
  goodMall('A'),goodMall('A','https://link.adpick.co.kr/def'),
  goodMall('B','https://biz.adpick.co.kr/r/abc'),
  goodMall('C','https://evil.example/shopping'),
  goodMall('D','http://link.adpick.co.kr/abc'),
  goodMall('E','https://biz.adpick.co.kr/api/SECRET/search'),
  {...goodMall('F'),commissionlink:''},
 ]});
 assert.equal(list.length,2);
 assert.deepEqual(list.map(x=>x.cp_code),['A','B']);
 assert.ok(list.every(x=>x.commission_per===undefined));
 assert.equal(list[0].icon,'https://cdn.adpick.co.kr/icons/store.png');
 assert.equal(list[0].title,'제휴 쇼핑몰');
});
test('Referral links are host verified, not merely adpick substrings',()=>{
 for(const u of ['http://link.adpick.co.kr/a','https://badadpick.co.kr/a','https://link.adpick.co.kr.evil.com/a','javascript:alert(1)','https://biz.adpick.co.kr/api/my-secret/malls']){
  assert.equal(safeAffiliateLink(u),false,u);
 }
 assert.equal(safeAffiliateLink('https://link.adpick.co.kr/abc'),true);
 assert.equal(safeAffiliateLink('https://biz.adpick.co.kr/go/a'),true);
});
test('BIZ provider route is separate from search quota and never displays secret keys',()=>{
 assert.match(server,/pathname==='\/api\/malls'/);
 assert.match(server,/\/api\/'\+encodeURIComponent\(key\)\+'\/malls'/);
 assert.match(server,/upstream\.searchParams\.set\('order','popular'\)/);
 assert.match(server,/normalizePartnerMalls\(data\)/);
 assert.match(server,/const mallHits=\[\]/);
 assert.match(server,/mallHits\.length>=30/);
 assert.match(server,/pathname==='\/api\/best'/);
 assert.match(server,/!?\['today','popular','pick','commission'\]\.includes\(area\)/);
});
test('All four exact BIZ console best areas are accessible from shop UI',()=>{
 for(const area of ['today','popular','pick','commission']){
  assert.equal(html.split('data-area="'+area+'"').length-1,1,area);
 }
 assert.match(html,/최고 수익 상품/);
 assert.match(html,/운영자 수익 성과 기준이며 할인율이 아닙니다/);
});
test('Live mall list includes provider icons, safe merchant links and expansion',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 for(const id of ['partner-malls','partner-mall-grid','partner-malls-more'])assert.equal(html.split('id="'+id+'"').length-1,1,id);
 assert.match(script,/fetch\("\/api\/malls"/);
 assert.match(script,/renderPartnerMalls\(\)/);
 assert.match(script,/mallMore\.addEventListener\("click"/);
 assert.match(script,/tile\.rel="sponsored nofollow noopener noreferrer"/);
 assert.match(script,/m\.commissionlink/);
 assert.ok(html.indexOf('id="partner-malls"')>html.indexOf('id="deals"'));
 assert.ok(html.indexOf('id="partner-malls"')<html.indexOf('id="toss-picks"'));
 assert.doesNotMatch(html,/(\d+)% 할인 적용!/);
});
