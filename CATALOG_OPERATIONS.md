# 알뜰픽 상시 갱신 카탈로그 설계·운영

## 실제 활성화 상태
현재 기능은 비활성화 상태입니다. 기존 검색·베스트 API는 계속 운영되며 카탈로그 동기화 작업은 자동 실행되지 않습니다.

### 애드픽 데이터 이용 조건
애드픽 BIZ API 가이드는 상품 이미지와 상품 정보 저장·가공·재이용을 허락하지 않는다고 명시합니다. 또한 상품 일괄 제공, 호출량 증대, API 이외의 데이터 이용은 사전 협의가 필요하다고 안내합니다.

정책 URL: https://biz.adpick.co.kr/?ac=api&sub=guide

이 기능은 별도 서면 허가 또는 권한을 갖춘 상품 제공자 피드를 사용할 때만 활성화할 수 있습니다. 일반 애드픽 검색 API를 자동으로 반복 수집해 장기 보관하는 작업을 허가 없이 시작해서는 안 됩니다.

## 이미 구현한 기반 기능
- 카테고리: food / living / digital / beauty / fashion / kitchen
- 고유 식별값: 승인된 출처 + 판매처 식별 + 출처의 상품 ID
- 갱신: 기존 ID일 때 업데이트(UPSERT), 새 ID이면 INSERT
- 상품 데이터: 제목, 판매처, 가격, 이미지 URL, 제휴 링크, 확인 시각, 만료 시각
- 원본 가격과 제휴 링크는 변경하지 않음. 같은 상품의 중복 레코드는 병합
- 기본 만료: 마지막 갱신 후 24시간, 최대 72시간 입력 허용
- 정기 갱신이 실패하면 만료된 제품은 API에서 제외
- 목록 API: /api/catalog?category=food&limit=24&offset=0
- 설정상태 API: /api/catalog/status (인증정보 미노출)
- 관리자 아닌 조회만 가능. write는 별도 CLI 전용
- 1회 승인 피드 최대 500개, 최대 2MB, 승인한 HTTPS 호스트만 호출

## 운영 전에 반드시 확인
1. 상품 제공자로부터 서면으로 상품명·이미지·가격의 저장, 재가공, 재노출, 만료 정책, 제휴 링크 사용, 갱신 주기, bulk feed 권한을 확인합니다.
2. 오래 유지할 수 있는 Postgres 데이터베이스를 연결합니다. Render 무료 웹 서비스 파일은 재시작 시 삭제되고 무료 Postgres는 30일 후 만료되어 상시 카탈로그에 적합하지 않습니다.
3. SQL 초기화: db/catalog.sql 내용을 해당 DB에서 실행합니다.
4. 아래 환경변수는 서버/스케줄러의 비밀 환경변수로만 입력합니다.
   - CATALOG_LICENSE_APPROVED=true (서면 승인 후에만 활성화)
   - CATALOG_DATABASE_URL=postgresql://... (실제 영구 DB)
   - CATALOG_APPROVED_FEED_URL=https://approved-provider.example/products.json (승인된 피드)
   - CATALOG_APPROVED_FEED_HOSTS=approved-provider.example (승인한 HTTPS 도메인, 쉼표 구분)
   - CATALOG_SOURCE_ID=licensed-provider (2~80자의 출처 ID)
5. 피드 형식은 JSON 배열 필드 products입니다. 각 레코드는 external_id, category, title, cp_name 또는 cp_code, commissionlink가 필수이고 price/photo는 선택입니다. 제휴 링크는 현재 사이트의 검증된 제휴 링크 호스트만 사용합니다.
6. 단발 작업: npm run catalog:sync. 실행 전 승인과 DB 환경변수를 검사합니다. 단발 작업 성공 후 승인 범위 안에서 Render Cron 등 독립 스케줄러를 연결해야 합니다.
7. 정기적으로 실제 공개 상품 수, 신규 등록 건수, 만료 건수, 실패 사유, 최근 확인 시각을 모니터링합니다. 스케줄러와 영구 저장이 연결되기 전에는 상시 운영이라고 표시하면 안 됩니다.

## 주의
- Render 무료 웹 서비스는 휴면 상태가 될 수 있으므로 Node 내부 setInterval만으로 정기 갱신을 보장하지 않습니다.
- 유료 자원을 사용자 승인 없이 생성하지 않습니다.
- 서면 사용 권한이 없으면 카탈로그를 활성화하지 않습니다.
- 기존 애드픽 API의 짧은 페이지 응답 캐시는 장기 상품 DB에 복제하지 않습니다.
