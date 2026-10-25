import test from 'node:test';
import assert from 'node:assert/strict';
import {interleaveSearchMerchants,merchantCount} from '../merchant-diversity.mjs';
const prod=(code,n)=>({cp_code:code,cp_name:code,title:code+n,commissionlink:'https://biz.adpick.co.kr/r'+n});
test('Actual available merchants are interleaved before result trimming',()=>{
 const original=[...Array.from({length:20},(_,i)=>prod('A',i)),...Array.from({length:12},(_,i)=>prod('B',i)),prod('C',1)];
 const result=interleaveSearchMerchants(original);
 assert.deepEqual(result.slice(0,10).map(x=>x.cp_code),['A','A','B','B','C','A','A','B','B','A']);
 assert.equal(result.length,original.length);
 assert.equal(new Set(result).size,original.length);
 assert.equal(merchantCount(result.slice(0,10)),3);
 assert.equal(original[2].cp_code,'A');
});
test('Single merchant, unnamed merchants and empty responses are not fabricated',()=>{
 const solo=[prod('A',1),prod('A',2)];
 assert.deepEqual(interleaveSearchMerchants(solo),solo);
 assert.deepEqual(interleaveSearchMerchants([]),[]);
 assert.equal(merchantCount(solo),1);
 assert.equal(merchantCount([{title:'Unnamed'}]),0);
});
test('Uses confirmed cp_code over inconsistent cp_name spellings',()=>{
 assert.equal(merchantCount([{cp_code:'a',cp_name:'상점'},{cp_code:'a',cp_name:'상점 '},{cp_code:'b',cp_name:'다른 상점'}]),2);
});
