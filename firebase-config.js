// Firebase 설정 (foodtruck-8bd3e)
const firebaseConfig = {
  apiKey: "AIzaSyBRQLOxID3_HyJ20ti1HfgB-O4egZJ7k6Y",
  authDomain: "foodtruck-8bd3e.firebaseapp.com",
  databaseURL: "https://foodtruck-8bd3e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "foodtruck-8bd3e",
  storageBucket: "foodtruck-8bd3e.firebasestorage.app",
  messagingSenderId: "428856063370",
  appId: "1:428856063370:web:0c447bbd43bfa3639e0473"
};

firebase.initializeApp(firebaseConfig);
const fbDb = firebase.database();
const fbAuth = firebase.auth();

// 익명 로그인 (보안 규칙용)
fbAuth.signInAnonymously().catch(e => console.warn('익명 로그인 실패:', e.message));

// RTDB 노드 경로 헬퍼 — 추후 storeId 다중 매장 지원 가능
const FT_ROOT = '/foodtruck';
const FT = {
  menu:    () => fbDb.ref(FT_ROOT + '/menu'),
  orders:  () => fbDb.ref(FT_ROOT + '/orders'),
  order:   (id) => fbDb.ref(FT_ROOT + '/orders/' + id),
  pickup:  () => fbDb.ref(FT_ROOT + '/pickupCounter'),
  payInfo: () => fbDb.ref(FT_ROOT + '/payInfo'),
  meta:    () => fbDb.ref(FT_ROOT + '/meta'),
};
