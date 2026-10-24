# 알뜰픽 Cloudflare Workers 배포

현재 운영 API는 Render에 그대로 두고, Cloudflare Worker의 정상 동작을 확인한 뒤 변경합니다.

## 1. 계정 연결 및 프로젝트 생성
1. Cloudflare 계정 생성 또는 로그인: https://dash.cloudflare.com/
2. Workers & Pages 에서 Workers 사용 가능 여부를 확인합니다.
3. GitHub 저장소 `maidana1779-cell/ainovel`, 브랜치 `alttulpick-deploy`를 연결하거나 Wrangler CLI를 사용합니다.
4. 프로젝트의 시작 경로는 저장소 루트이며 `wrangler.jsonc`에서 `worker/index.mjs`를 지정합니다.
5. CI/CLI 배포: `npx wrangler deploy`. 로그인은 `npx wrangler login`으로 진행할 수 있습니다.

## 2. 필수 비밀값
Cloudflare 프로젝트 Settings > Variables and Secrets에서 `ADPICK_API_KEY`를 **Secret**으로 입력합니다.
CLI 방식: `npx wrangler secret put ADPICK_API_KEY`
API 키를 코드, GitHub 파일, 공개 변수에 넣지 마세요.

## 3. 검증 및 전환
Cloudflare가 발급한 실제 `https://...workers.dev` 주소를 확인하세요.
`/health`, `/api/best?area=today&limit=10`, `/api/search?q=커피&limit=20`을 테스트합니다.
검색 결과의 상품 링크가 열리고, 홈의 재고·가격 안내와 제휴 고지가 유지되는지 점검하세요.

기존 알뜰픽 프런트엔드에는 `const API_ORIGIN='https://alttulpick-preview.onrender.com';`이 있습니다.
Worker 배포와 비밀값 등록이 성공한 **뒤에만** 이 값을 실제 Workers URL로 수정해 배포하세요.
Cloudflare 배포 전에 Render 서비스는 삭제하지 마세요.

## 주의
- Workers의 CPU, 서브요청 및 일별 무료 한도를 계정 플랜에 맞춰 검증해야 합니다.
- 애드픽 API 자체 지연은 Workers로 옮겨도 없어지지 않습니다.
- Worker telemetry 엔드포인트는 현재 유효성 검사 후 응답만 반환합니다. 기존 Render의 관리자 클릭 통계와 연동되지 않으므로 통계 이전 작업은 별도로 필요합니다.
- Worker에서는 제휴 추적 링크를 서버에서 자동 열지 않으며, 판매처의 명시적인 원본 상품 URL이 있는 경우에만 재고·할인가 검증을 시도합니다.

## 빌드 문제 진단
현재 Workers 빌드의 Production branch는 반드시 `alttulpick-deploy`여야 합니다. 해당 브랜치에는 `wrangler.jsonc`와 `worker/index.mjs`가 존재합니다. 과거 `main` 브랜치의 Next.js 자동 감지 오류가 보이면 최신 빌드의 커밋/브랜치를 확인하고 새 배포를 실행하세요. 기존 Render API는 Cloudflare의 `/health`와 실제 상품 검색이 검증될 때까지 유지합니다.
