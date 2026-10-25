import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {curatedProducts} from '../curated-products.mjs';
import {affiliateLinkInspection,reviewPreflight} from '../review-preflight.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const page=path=>readFileSync(resolve(root,path),'utf8');
const html=page('index.html'),contact=page('public/contact.html'),privacy=page('public/privacy.html'),guide=page('public/guide.html');

test('Every currently manually listed Toss affiliate link is syntactically safe, without clicking tracking endpoints',()=>{
 const products=curatedProducts();
 assert.ok(products.length>=7);
 for(const product of products){
  const result=affiliateLinkInspection(product.commissionlink,product);
  assert.equal(result.valid,true,product.title);
  assert.equal(result.provider,'toss');
 }
});
test('Known-good Adpick referral URLs are accepted and deceptive alternatives are rejected',()=>{
 for(const url of ['https://biz.adpick.co.kr/r5413496','https://link.adpick.co.kr/r123',
  'https://bitl.bz/ab123']){
  assert.equal(affiliateLinkInspection(url).valid,true,url);
 }
 for(const url of ['http://biz.adpick.co.kr/r5413496','https://biz.adpick.co.kr.evil.example/r123',
  'https://biz.adpick.co.kr:8888/r1','javascript:alert(1)','https://toss.shopping/_m/fEfXH2Dz',
  'https://u:p@biz.adpick.co.kr/r123','https://biz.adpick.co.kr/',
  'https://biz.adpick.co.kr/r1#fragment']){
  assert.equal(affiliateLinkInspection(url).valid,false,url);
 }
 assert.equal(affiliateLinkInspection('https://toss.shopping/_m/fEfXH2Dz',{affiliate_source:'toss_sharelink'}).valid,true);
});
test('Live storefront product-card validator uses same HTTPS, host and source limits',()=>{
 const start=html.indexOf('function validAffiliateLink(raw,product){');
 const end=html.indexOf('function show(',start);
 assert.ok(start>0&&end>start);
 const local=new Function(html.slice(start,end)+'return validAffiliateLink')();
 const records=[
  ['https://biz.adpick.co.kr/r5413496',{},true],
  ['https://toss.shopping/_m/fEfXH2Dz',{affiliate_source:'toss_sharelink'},true],
  ['https://toss.shopping/_m/fEfXH2Dz',{},false],
  ['https://biz.adpick.co.kr.evil.example/r123',{},false],
  ['http://biz.adpick.co.kr/r123',{},false],
  ['https://biz.adpick.co.kr:8888/r123',{},false],
  ['javascript:alert(1)',{},false]
 ];
 for(const [url,product,valid] of records)assert.equal(local(url,product),valid,url);
 assert.match(html,/link\.rel="sponsored nofollow noopener noreferrer"/);
});
test('Real operator contact is a blocking prerequisite, not a fake passing score',()=>{
 const result=reviewPreflight({homepage:html,contact,privacy,guide,products:curatedProducts()});
 assert.equal(result.ready,false);
 assert.ok(result.blockers.some(v=>/연락처/.test(v)));
 assert.equal(result.link_issues.length,0);
 assert.equal(result.products_checked,curatedProducts().length);
});
test('Approved contact address must match both pages; not enough to have placeholder or one-sided contact',()=>{
 const email='help@verified-domain.kr';
 const cleanContact='<a href="mailto:'+email+'">'+email+'</a>';
 const cleanPrivacy='운영자 문의 연락처: '+email;
 const result=reviewPreflight({homepage:html,contact:cleanContact,privacy:cleanPrivacy,guide,products:curatedProducts()});
 assert.equal(result.ready,true);
 const mismatch=reviewPreflight({homepage:html,contact:cleanContact,privacy:'운영자 문의 연락처: other@sample.kr',guide,products:curatedProducts()});
 assert.equal(mismatch.ready,false);
 const fake=reviewPreflight({homepage:html,contact:'<a href="mailto:hello@example.com">hello@example.com</a>',privacy:'hello@example.com',guide,products:[]});
 assert.equal(fake.ready,false);
});
test('Preflight reports representative category coverage without making third-party network requests',()=>{
 const result=reviewPreflight({homepage:html,contact,privacy,guide,products:curatedProducts()});
 assert.ok(result.checks.some(v=>v.name.includes('6개 카테고리')&&v.pass));
 assert.ok(result.warnings.some(v=>/상품 품절/.test(v)));
 assert.ok(result.warnings.some(v=>/애드픽/.test(v)));
});
