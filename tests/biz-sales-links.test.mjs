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
  goodMall('LIVE','https://bitl.bz/provider-issued-link'),
  goodMall('C','https://evil.example/shopping'),
  goodMall('D','http://link.adpick.co.kr/abc'),
  goodMall('E','https://biz.adpick.co.kr/api/SECRET/search'),
  {...goodMall('F'),commissionlink:''},
 ]});
 assert.equal(list.length,7);
 assert.deepEqual(list.map(x=>x.cp_code),['A','B','LIVE','C','D','E','F']);
 assert.equal(list.find(x=>x.cp_code==='C').commissionlink,null);
 assert.equal(list.find(x=>x.cp_code==='D').commissionlink,null);
 assert.equal(list.find(x=>x.cp_code==='E').commissionlink,null);
 assert.equal(list.find(x=>x.cp_code==='F').commissionlink,null);
 assert.ok(list.every(x=>x.commission_per===undefined));
 assert.equal(list[0].icon,'https://cdn.adpick.co.kr/icons/store.png');
 assert.equal(list[0].title,'제휴 쇼핑몰');
});
test('Referral links are host verified, not merely adpick substrings',()=>{
 for(const u of ['http://link.adpick.co.kr/a','https://badadpick.co.kr/a','https://link.adpick.co.kr.evil.com/a','javascript:alert(1)','https://biz.adpick.co.kr/api/my-secret/malls']){
  assert.equal(safeAffiliateLink(u),false,u);
 }
 assert.equal(safeAffiliateLink('https://link.adpick.co.kr/abc'),true);
 assert.equal(safeAffiliateLink('https://bitl.bz/provider-issued-link'),true);
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
 assert.match(server,/!?\['today','popular','pick'\]\.includes\(area\)/);
 assert.doesNotMatch(server,/\['today','popular','pick','commission'\]/);
});
test('Customer site exposes three shopper-focused areas, excluding commission-ranked content',()=>{
 for(const area of ['today','popular','pick']){
  assert.equal((html.match(new RegExp('<button[^>]*data-area="'+area+'"','g'))||[]).length,1,area);
 }
 assert.doesNotMatch(html,/data-area="commission"|최고 수익 상품/);
});
test('Every returned mall is shown by default, including unlinked shops, with a name search',()=>{
 assert.ok(script);assert.doesNotThrow(()=>new Script(script));
 for(const id of ['partner-malls','partner-mall-grid','partner-malls-search','partner-malls-count'])
   assert.equal(html.split('id="'+id+'"').length-1,1,id);
 assert.match(script,/fetch\("\/api\/malls"/);
 assert.match(script,/u.hostname==="bitl.bz"/);
 assert.match(script,/const visible=partnerMalls\.filter/);
 assert.match(script,/mallSearch\.addEventListener\("input",renderPartnerMalls\)/);
 assert.match(script,/const canVisit=Boolean\(mall\.commissionlink\)/);
 assert.match(script,/canVisit\?"a":"div"/);
 assert.match(script,/현재 제휴 링크 미제공/);
 assert.match(script,/tile\.rel="sponsored nofollow noopener noreferrer"/);
 assert.ok(html.indexOf('id="partner-malls"')>html.indexOf('id="deals"'));
 assert.ok(html.indexOf('id="partner-malls"')<html.indexOf('id="toss-picks"'));
 assert.doesNotMatch(html,/data-area="commission"|partner-malls-more/);
 assert.doesNotMatch(html,/(\d+)% 할인 적용!/);
});
