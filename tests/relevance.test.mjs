import test from 'node:test';
import assert from 'node:assert/strict';
import {relevantItem, selectRelevantProducts} from '../relevance.mjs';

const cases=[
  ["커피","클리오 킬브로우 컬러 브로우 래커 피넛브라운 6g","뷰티몰",false],
  ["커피","클리오 킬브로우 컬러 브로우 래커 피넛브라운 6g","커피몰",false],
  ["커피","래커 피넛브라운 6g","브랜드몰",false],
  ["커피","브라운 커피 색상 파우더 6g","화장품몰",false],
  ["라면","PI0200U 라면 패딩조끼(그레이+네이비)","필웨이",false],
  ["커피","스프링은 어려워! 코틀린과 Ktor로 백엔드/서버개발 기초정복 (커피주문시스템 개발)","인프런",false],
  ["라면","개발자라면 필수인 책","서점",false],
  ["라면","라면모양 키링 굿즈 3개","제휴몰",false],
  ["커피","라떼 메이크업 파우더 10g","화장품몰",false],
  ["커피","커피머신 1대","가전몰",false],
  ["커피","캡슐커피 10개","식품몰",true],
  ["커피","커피믹스 100T","식품몰",true],
  ["커피","맥심 모카골드 100T","식품몰",true],
  ["커피","카누 다크로스트 100T","식품몰",true],
  ["커피","일리 원두 250g","식품몰",true],
  ["커피","콜롬비아 원두커피 1kg","식품몰",true],
  ["커피","스타벅스 콜드브루 커피 270ml","식품몰",true],
  ["커피","커피 270ml 10병","식품몰",true],
  ["커피","바닐라 라떼 24개","식품몰",true],
  ["라면","신라면 5봉","식품몰",true],
  ["라면","불닭볶음면 큰컵","식품몰",true],
  ["라면","진라면 매운맛 5입","식품몰",true],
  ["라면","짜파게티 10개","식품몰",true],
  ["라면","라면 5개","식품몰",true],
  ["간편식","비비고 볶음밥 2kg","식품몰",true],
  ["간편식","햇반 즉석밥 210g","식품몰",true],
  ["간편식","진라면 매운맛 5봉","식품몰",true],
  ["생수","삼다수 2L 12병","식품몰",true],
  ["세제","퍼실 세제 2L","생활몰",true],
  ["이어폰","소니 무선이어폰","하이마트",true],
  ["무선이어폰","에어팟 프로","하이마트",true],
  ["의류","패딩조끼 네이비","필웨이",true],
  ["화장품","클리오 킬브로우 컬러 브로우 래커 피넛브라운 6g","뷰티몰",true],
  ["주방용품","테팔 프라이팬 28cm","생활몰",true],
  ["노트북","삼성 노트북 갤럭시북4","하이마트",true],
  ["노트북","갤럭시 커피색 노트북","하이마트",true],
  ["커피","수업용 커피 주문 시스템 150g","제휴몰",false],
  ["라면","라면 투어 일본 미식 3시간","마이리얼트립",false],
];
for (const [query,title,cp_name,expected] of cases) {
  test(query+" => "+title,()=>assert.equal(relevantItem(query,{title,cp_name}),expected));
}
test('Only relevant products survive in a live response',()=>{
 const items=[
  {title:"클리오 킬브로우 컬러 브로우 래커 피넛브라운 6g",cp_name:"뷰티몰"},
  {title:"맥심 커피믹스 100T",cp_name:"식품몰"}
 ];
 assert.deepEqual(selectRelevantProducts('커피',items),[items[1]]);
});
test('Empty / malformed input stays empty',()=>{
 assert.deepEqual(selectRelevantProducts('라면',null),[]);
 assert.deepEqual(selectRelevantProducts('라면',[{},null]),[]);
});
