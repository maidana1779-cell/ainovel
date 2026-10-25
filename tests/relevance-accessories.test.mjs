import test from 'node:test';
import assert from 'node:assert/strict';
import {relevantItem} from '../relevance.mjs';

test('Broad earphone and beauty categories exclude accessory-only false matches',()=>{
 const cases=[["이어폰","에어팟 프로 2세대 실리콘 케이스",false],["무선이어폰","갤럭시버즈 전용 이어팁 세트",false],["이어폰","정품 에어팟 본체 케이스 포함",true],["이어폰","소니 무선 이어폰 WF-1000XM5",true],["화장품","소파 쿠션 방석 2개",false],["화장품","생크림 크림치즈 케이크",false],["화장품","화장품 보관함 수납함",false],["화장품","라네즈 네오 쿠션 파운데이션",true],["화장품","에이지투웨니스 커버 쿠션 팩트 13g",true]];
 for(const [query,title,expected] of cases)
  assert.equal(relevantItem(query,{title,cp_name:'제휴몰'}),expected,query+': '+title);
});
