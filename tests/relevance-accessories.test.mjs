import test from 'node:test';
import assert from 'node:assert/strict';
import {relevantItem} from '../relevance.mjs';

test('Broad earphone and beauty categories exclude accessory-only false matches',()=>{
 const cases=[["이어폰","에어팟 프로 2세대 실리콘 케이스",false],["무선이어폰","갤럭시버즈 전용 이어팁 세트",false],["이어폰","정품 에어팟 본체 케이스 포함",true],["이어폰","소니 무선 이어폰 WF-1000XM5",true],["화장품","소파 쿠션 방석 2개",false],["화장품","생크림 크림치즈 케이크",false],["화장품","화장품 보관함 수납함",false],["화장품","라네즈 네오 쿠션 파운데이션",true],["화장품","에이지투웨니스 커버 쿠션 팩트 13g",true]];
 for(const [query,title,expected] of cases)
  assert.equal(relevantItem(query,{title,cp_name:'제휴몰'}),expected,query+': '+title);
});

test('Real user screenshot: exclude earphone resale ebook, city tour and novelty earphone items',()=>{
 const fixtures=[
  ['평범한 직장인이었던 내가 이어폰 리셀로 부수입을 만든 방법','크몽'],
  ['상하이 시티투어 버스 티켓 (가이드 지도 &amp; 이어폰 제공)','KKday'],
  ['평범한 직장인이었던 내가 이어폰 리셀로 부수입을 만든 방법','제휴몰'],
  ['[투명톡+젤리 이어폰냥]','마리오케이스'],
  ['카카오프렌즈 에어팟 모양 보관함 케이스','보리보리'],
  ['에어팟 프로2 보호 커버','전자제품몰']
 ];
 for(const [title,cp_name] of fixtures){
   const item={title,cp_name};
   assert.equal(relevantItem('이어폰',item),false,title);
   assert.equal(relevantItem('무선이어폰',item),false,title);
 }
 const good=[
  ['브리츠 BZ-ER7L 오픈형 블루투스 이어폰 귀찌 귀걸이형 무선 이어셋','오늘의집'],
  ['[엠지텍] IPX8 초소형 초경량 블루투스 이어폰 레드몽R2','이유몰'],
  ['[해외] Choice PHILIPS TAT1320 트루 무선 이어폰 블루투스 6.0 TWS','알리익스프레스'],
  ['정품 에어팟 본체 케이스 포함','전자몰'],
  ['[보리보리] 아트박스 POOM 골전도 이어폰 블루투스 본체','보리보리']
 ];
 for(const [title,cp_name] of good){
   assert.equal(relevantItem('이어폰',{title,cp_name}),true,title);
 }
});
