import test from 'node:test';
import assert from 'node:assert/strict';
import {clearlyUnavailable,removeClearlyUnavailable} from '../availability-labels.mjs';
test('Hide products whose titles explicitly disclose unavailable stock',()=>{
 for(const title of ['[품절] 이어폰 3개','【판매종료】 세탁세제','(일시품절) 커피','[SOLD OUT] 한정판','재고없음: 에어팟','마스크 판매중단']){
  assert.equal(clearlyUnavailable({title}),true,title);
 }
});
test('Marketing language, retail alerts and mixed words are not treated as confirmed sold-out',()=>{
 for(const title of ['품절대란 무선이어폰','품절임박 운동화','품절 후 재입고','품절 걱정 없는 생수','에어팟 판매종료 방지법','품절 인기템 재입고 2개','[품절임박] 세제']){
  assert.equal(clearlyUnavailable({title}),false,title);
 }
});
test('Remove only unavailable items and report exact count',()=>{
 const input=[{title:'[품절] 가방'},{title:'재입고 가방'},{title:'커피'},{title:'(판매종료) 가방'}];
 const result=removeClearlyUnavailable(input);
 assert.deepEqual(result.items,[input[1],input[2]]);
 assert.equal(result.removed,2);
});
