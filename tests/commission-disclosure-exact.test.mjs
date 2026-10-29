import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const pub=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const about=readFileSync(new URL('../public/about.html',import.meta.url),'utf8');
const guide=readFileSync(new URL('../public/guide.html',import.meta.url),'utf8');
test('Coupang reviewer requested unambiguous commission disclosure in all storefront pages',()=>{
 assert.equal(root,pub);
 for(const page of [root,pub,about,guide]){
  assert.doesNotMatch(page,/수수료를\s*받을\s*수\s*있습니다/);
 }
 assert.match(root,/광고·제휴 상품 링크를 통한 구매 시 알뜰픽 운영자가 일정액의 수수료를 받습니다/);
 assert.match(about,/제휴 프로그램에서 인정하는 활동이 발생하면 운영자가 수수료를 받습니다/);
 assert.match(about,/제휴 프로그램이 인정하는 활동을 통해 운영자가 수수료를 받습니다/);
 assert.match(root,/구매자에게 별도의 알뜰픽 리워드는 제공되지 않습니다/);
 assert.match(root,/class="affiliate-banner"/);
 assert.match(root,/class="curated-disclosure"/);
});
