# 🍔 POS-Foodtruck — 다음 세션 인계 문서

작성일: 2026-05-14

## 📂 프로젝트 위치 (메인)

```
C:\Users\USER\Downloads\POS-Foodtruck-web\
├── (루트 — GitHub Pages 호스팅: customer/staff/display)
│   ├── customer.html         손님 주문 페이지
│   ├── display.html          호출 디스플레이
│   ├── staff.html            직원 도우미
│   ├── transport-cloud.js    Firebase fetch 인터셉터
│   ├── firebase-config.js
│   ├── index.html            안내 페이지 + POS 다운로드 버튼
│   ├── netlify.toml, _redirects
│   ├── database.rules.json   Firebase RTDB 보안규칙
│   └── README.md
│
└── pos-app/                  POS Electron 소스 (빌드 대상)
    ├── app.js                메인 렌더러 (300KB+, 모든 POS 로직)
    ├── main.js               Electron 메인 (HTTP 서버, IPC, 인증서 설치)
    ├── preload.js            IPC bridge
    ├── index.html            POS 사장님 UI
    ├── customer.html         로컬 IP QR용 손님 페이지
    ├── display.html          로컬 IP QR용 디스플레이
    ├── firebase-config.js
    ├── package.json
    ├── default-images/
    └── dist/                 빌드 출력
```

## 🌐 운영 환경

| 항목 | 값 |
|---|---|
| GitHub 레포 | `https://github.com/junghaewon9776/pos-foodtruck-web` |
| GitHub Pages URL | `https://junghaewon9776.github.io/pos-foodtruck-web` |
| Firebase 프로젝트 | `foodtruck-8bd3e` |
| Firebase RTDB | `asia-southeast1` (싱가포르) |
| QZ Tray 인증서 | BulpanPOS 자체서명 (override.crt) |
| 금전함 프린터 | SLK-TS100 (Sewoo) |
| POS 빌드 버전 | 1.0.0 (`POS Foodtruck Setup 1.0.0.exe`) |

## 🚀 핵심 기능 요약

### 운영 모드
- **테이블 모드**: 테이블 주문/결제/QR
- **푸드트럭 모드**: `DB.foodtruckMode=true` — 픽업번호(A0001~) + 사전주문 + 호출

### 클라우드 동기화
- POS ↔ Firebase RTDB 양방향
- 손님 주문(QR) → Firebase → POS 실시간 수신
- 자동 입금확인: 안드로이드 알림리스너 → /api/ft/auto-pay → 매칭(픽업번호/입금자명/금액)
- Firebase presence: POS 꺼지면 손님 페이지 "영업 종료" 자동 표시

### 메뉴판 (프리셋) — 최근 작업
- 업종/행사별 카테고리 묶음 (홀/닭꼬치집/츄러스집 등)
- 메뉴판 선택 시 POS·손님페이지 둘 다 즉시 필터링
- 추가/복사/수정/삭제, 최소 1개 유지
- 카테고리 0개 메뉴판은 생성 불가

### 이벤트/룰렛
- 랜덤 무료증정 (1/N 확률, 기본 1/1000)
- 픽업번호 N의 배수마다 룰렛 등장 (기본 매 10번)

### 금전함 (SLK-TS100)
- 상단 글로벌 [💰 금전함] 버튼
- 시작 금액 입력 → 영업 중 매출 누적 → 마감 시 차액 비교
- 현금 결제 시 자동 열기 (홀·푸드트럭 통합)
- 수령완료 시는 열리지 않음 (이중 열림 방지)
- 설정 → 프린터 설정 → 💰 금전함 → 프린터 선택
- ESC/POS `1B700019FA` (공백 없는 hex)

### QR 인쇄
- [🖨️ QR 인쇄 (3종)] 단일 버튼 → 한 페이지에 손님/직원/디스플레이 QR
- QR URL에 보안 키 `?k=` (DB.urlKey) — 새 키 발급 시 옛 QR 만료
- 듀얼: 로컬 IP + 클라우드 URL 동시 인쇄

### 직원 도우미 (/staff)
- PIN 4자리 보호
- 핸드폰으로 주문 처리 (입금확인/조리시작/완료)
- 새 주문 알림, 환불 요청 알림

### 호출 디스플레이 (/display)
- 픽업번호 큰 화면 표시
- 차임벨 + TTS 음성 호출
- 외부 브라우저 열기 (Electron 팝업 차단 회피)

### 신규 주문 알림 (POS)
- 띵동 차임벨 (도-미-솔-도)
- TTS: "X번 주문 들어왔습니다"
- 카드 깜빡임 효과

### 데이터 영속화
- localStorage (DB.menus, DB.sales, DB.cashDrawer 등)
- `%APPDATA%\POS Foodtruck\ft_orders.json` (푸드트럭 주문, 7일 보관)
- 재시작/크래시 복구 자동

## 🔧 작업 흐름

### 웹 페이지 수정 (손님/직원/디스플레이)
- 루트 `.html`/`.js` 편집
- git push → GitHub Pages 자동 배포
- **재빌드 불필요**

### POS 앱 수정
- `pos-app/` 내부 편집
- `cd pos-app && npm run build-install`
- 결과: `pos-app/dist/POS Foodtruck Setup 1.0.0.exe`
- 재설치 필요

### exe 배포
- GitHub Releases에 .exe 업로드
- `index.html`의 ⬇️ 다운로드 버튼이 `releases/latest`로 자동 연결

## ⚠️ 알려진 제약

- POS 인터넷 끊김 시 클라우드 주문 못 받음 (로컬 QR은 OK)
- Firebase 무료 플랜: 동시접속 100명, 다운로드 10GB/월
- QZ Tray "Allow" 팝업: 새 PC 깔 때 Site Manager → strict mode 해제 + 처음 한 번 Allow
- GitHub Pages 캐시: customer.html에 meta cache-control 박혀있지만 가끔 강력새로고침 필요

## 🐛 최근 수정 (이번 세션)

1. **금전함 hex 포맷**: `1B 70 00 19 FA` → `1B700019FA` (QZ Tray 호환)
2. **금전함 위치**: 푸드트럭 설정 → 일반 설정으로 이동 (홀/푸드트럭 통합)
3. **수령완료 시 금전함 안 열림**: 결제 시점에 이미 열렸으므로 done에서는 매출 기록만
4. **메뉴판 자동 필터**: POS 메뉴 관리 화면도 선택된 메뉴판 카테고리만 표시
5. **카테고리 ▲▼ 이동 버튼**: 순서 변경 가능
6. **QR 보안 키**: 새 키 발급 시 이전 QR 자동 무효화
7. **QZ 인증서 4곳 동시 설치**: 버전별 위치 호환
8. **메뉴판 최소 1개 유지**: 마지막 메뉴판 삭제 차단
9. **메뉴판 카테고리 0개 차단**: 빈 메뉴판 생성 불가
10. **신규 주문 TTS**: "X번 주문 들어왔습니다"
11. **엑셀 4시트**: 메뉴/카테고리/메뉴판/메뉴판별메뉴
12. **DB 기본값**: 클라우드 URL 자동 입력 (`junghaewon9776.github.io/pos-foodtruck-web`)

## 📋 사용자 선호 / 규칙

- **한국어** 응답
- **짧은 보고** 선호
- **묻지 말고 바로 작업** (Auto mode)
- 변경 후 **자동 빌드** (`npm run build-install`)
- **들여쓰기 깔끔히** (긴 한 줄 X)
- 코드 변경은 백업 폴더(`backup/날짜/`) 만들고 진행하지 않음 (사용자가 git으로 관리)

## 🔄 다음 세션 시작 시

1. 메모리의 `project_pos_app.md` 자동 로드됨
2. 이 파일(`SESSION_HANDOFF.md`) 읽기로 컨텍스트 회복
3. 사용자가 요청하는 다음 작업 시작

## 🎯 알려진 미완료/추후 검토

- 안드로이드 자동입금 알림리스너 앱 (별도 제작 필요)
- 메뉴 이미지 base64로 Firebase에 푸시 — 250KB 제한 있음 (대용량은 Firebase Storage 권장)
- 매출 통계 시각화 (현재 텍스트만)
- 카테고리 드래그앤드롭 (현재 ▲▼ 버튼만)
