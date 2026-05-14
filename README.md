# 🍔 POS Foodtruck

푸드트럭 + 매장 통합 POS 시스템. 한 레포에 모든 소스 + 웹페이지.

## 폴더 구조

```
POS-Foodtruck-web/
├── index.html, customer.html, display.html,    ← GitHub Pages 호스팅 (정적 웹)
│   staff.html, transport-cloud.js,
│   firebase-config.js, netlify.toml, _redirects
│
├── pos-app/                                    ← POS Electron 소스
│   ├── app.js, main.js, preload.js
│   ├── index.html (POS 사장님 UI)
│   ├── customer.html, display.html (로컬 IP용)
│   ├── firebase-config.js
│   ├── package.json
│   ├── default-images/
│   └── ...
│
├── .gitignore
└── README.md
```

## 작업 흐름

### 웹 페이지 수정 (손님/직원/디스플레이)
- 루트의 `customer.html`, `staff.html`, `display.html`, `transport-cloud.js` 편집
- git push → GitHub Pages 자동 배포

### POS Electron 앱 수정
- `pos-app/` 내부 파일 편집
- 빌드:
  ```bash
  cd pos-app
  npm install   # 처음 한 번
  npm run build-install
  ```
- 출력: `pos-app/dist/POS Foodtruck Setup 1.0.0.exe`

### POS exe 배포
- 빌드된 exe를 **GitHub Releases**에 업로드
  1. https://github.com/junghaewon9776/pos-foodtruck-web/releases
  2. "Draft a new release" → Tag `v1.0.0`
  3. `pos-app/dist/POS Foodtruck Setup 1.0.0.exe` 드래그
  4. Publish
- `index.html`의 다운로드 버튼이 `releases/latest`로 자동 연결

## Firebase 설정 동기화

`firebase-config.js`가 양쪽 (루트와 pos-app/)에 있음. 같은 내용이어야 함.
설정 바꾸면 양쪽 다 수정.

## .gitignore에 제외된 것

- `pos-app/node_modules/` — npm install 결과
- `pos-app/dist/` — 빌드 출력 (Releases로 배포)
- `pos-app/backup/` — 로컬 백업
- `.exe`, `.zip` 등 바이너리 (Releases로 배포)

## 초기 셋업

```bash
git clone https://github.com/junghaewon9776/pos-foodtruck-web.git
cd pos-foodtruck-web/pos-app
npm install
npm run build-install
```
