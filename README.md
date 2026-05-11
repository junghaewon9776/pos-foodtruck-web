# POS-Foodtruck 클라우드 웹

푸드트럭 손님 주문 페이지 — Firebase Realtime Database 백엔드 사용.

## 파일

- `customer.html` — 손님 주문 화면 (메뉴 보고 → 주문 → 입금 → 픽업번호 확인)
- `display.html` — 매장 호출 모니터 (조리중/픽업하세요 표시)
- `firebase-config.js` — Firebase 프로젝트 설정 (foodtruck-8bd3e)
- `transport-cloud.js` — 원래 customer.html이 호출하던 `/api/ft/*` fetch를 Firebase RTDB로 라우팅
- `netlify.toml`, `_redirects` — Netlify 배포용 (다른 호스팅이면 무시)

## 배포 방법 (셋 중 하나)

### A. GitHub Pages (가장 간단)
1. GitHub에 레포 생성 후 이 폴더 푸시
2. Settings → Pages → Branch: `main` / Folder: `/ (root)` 선택
3. 발급 URL: `https://your-id.github.io/repo-name/`

### B. Netlify
1. https://app.netlify.com/drop 에 이 폴더 드래그앤드롭
2. 즉시 URL 발급

### C. Firebase Hosting
```
firebase init hosting
# public: web
firebase deploy --only hosting
```

## POS에 URL 등록

POS 앱 → 푸드트럭 모드 설정 → "손님 주문 페이지 URL"에 발급받은 URL 입력 → 저장

## 보안

- Firebase API 키가 공개 노출됨 — 정상 (Firebase의 설계)
- **RTDB 보안규칙을 반드시 적용**할 것 (`../database.rules.json` 참조)
- 익명 인증으로 손님폰이 RTDB 접근

## 로컬 vs 클라우드 동작

- **클라우드 ON + 인터넷 OK** → QR이 이 페이지 URL로 발행 → 손님이 LTE로도 주문 가능
- **인터넷 끊김** → QR이 자동으로 로컬 IP로 발행 → 같은 와이파이만 있으면 동작
- 두 경로 모두 POS에서 통합 표시
