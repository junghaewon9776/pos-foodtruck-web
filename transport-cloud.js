// Cloud transport — customer.html이 호출하는 /api/ft/* fetch를 가로채서 Firebase RTDB로 라우팅
// 원본 customer.html 코드를 수정하지 않고 fetch만 오버라이드하는 방식

(function() {
  const STORE_ID = 'default';  // 추후 멀티매장 지원 시 URL param에서 추출
  const _origFetch = window.fetch.bind(window);

  // 픽업번호 자동 만료 클라이언트 측 보조 (POS도 별도로 만료 처리)
  function _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function _jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  async function _readMenu() {
    const snap = await FT.menu().once('value');
    const v = snap.val() || {};
    return {
      cats: v.cats || [],
      menus: v.menus || [],
      sname: v.sname || '',
      tables: v.tables || [],
      foodtruckMode: !!v.foodtruckMode,
      pickupPrefix: v.pickupPrefix || 'A',
      payInfo: v.payInfo || {},
      event: v.event || { enabled:false, probability:1000, menuIds:[] },
    };
  }

  // 랜덤 이벤트 추첨 — 당첨 시 증정 메뉴 객체 반환, 아니면 null
  function _rollEvent(menuData){
    const ev = (menuData && menuData.event) || {};
    if(!ev.enabled) return null;
    const prob = parseInt(ev.probability, 10) || 1000;
    const ids = ev.menuIds || [];
    if(prob < 2 || !ids.length) return null;
    if(Math.floor(Math.random() * prob) !== 0) return null; // 1/prob 확률
    const pool = (menuData.menus || []).filter(m => ids.includes(m.id));
    if(!pool.length) return null;
    const winner = pool[Math.floor(Math.random() * pool.length)];
    return {
      id: winner.id,
      name: winner.name,
      emoji: winner.emoji || '',
      price: winner.price || 0,
    };
  }

  async function _nextPickup(prefix) {
    const ref = FT.pickup();
    const res = await ref.transaction(cur => {
      let n = (cur || 0) + 1;
      if (n > 9999) n = 1;
      return n;
    });
    const num = res.snapshot.val();
    return (prefix || 'A') + String(num).padStart(4, '0');
  }

  // 제한치 (메뉴 데이터에서 오버라이드 가능)
  const DEFAULT_MAX_PENDING = 50;
  const DEFAULT_RATE_LIMIT_MS = 30 * 1000; // 30초

  // 클라이언트 식별자 (재주문 속도 제한용)
  function _getClientId() {
    let id = localStorage.getItem('ft_client_id');
    if (!id) {
      id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('ft_client_id', id);
    }
    return id;
  }

  async function _checkLimits(menu) {
    const maxPending = (menu.payInfo && menu.payInfo.maxPending) || DEFAULT_MAX_PENDING;
    const rateMs = (menu.payInfo && menu.payInfo.rateLimitMs) || DEFAULT_RATE_LIMIT_MS;

    // 1) 같은 폰 재주문 속도 제한
    const lastTime = parseInt(localStorage.getItem('ft_last_submit') || '0', 10);
    if (lastTime && Date.now() - lastTime < rateMs) {
      const wait = Math.ceil((rateMs - (Date.now() - lastTime)) / 1000);
      return { ok: false, msg: `잠시 후 다시 시도해주세요 (${wait}초)` };
    }

    // 2) 전체 대기 주문 수 제한
    const snap = await FT.orders().orderByChild('status').equalTo('pending').once('value');
    let pendingCount = 0;
    snap.forEach(() => { pendingCount++; });
    if (pendingCount >= maxPending) {
      return { ok: false, msg: '대기 주문이 너무 많습니다. 잠시 후 다시 시도해주세요' };
    }
    return { ok: true };
  }

  async function _submitOrder(body) {
    const items = (body.items || []).filter(x => x && x.id && x.qty > 0);
    if (!items.length) return { ok: false, msg: '메뉴를 선택해주세요' };

    const menu = await _readMenu();

    // 제한 검증
    const limit = await _checkLimits(menu);
    if (!limit.ok) return limit;
    const menus = menu.menus || [];
    let total = 0;
    const safe = items.map(it => {
      const m = menus.find(x => x.id === it.id);
      if (!m) return null;
      const unit = it.price || m.price;
      total += unit * it.qty;
      return { id: m.id, name: m.name, emoji: m.emoji || '', qty: it.qty, price: unit, options: it.options || [] };
    }).filter(Boolean);
    if (!safe.length) return { ok: false, msg: '유효한 메뉴 없음' };

    const pickup = await _nextPickup(menu.pickupPrefix);
    const now = Date.now();
    const pi = menu.payInfo || {};
    const expMin = pi.expireMinutes || 10;
    const id = _genId();
    // 랜덤 이벤트 추첨
    const eventBonus = _rollEvent(menu);
    // 룰렛 적격 판정 — 픽업번호 끝 N의 배수면 룰렛 등장
    const ev = menu.event || {};
    let rouletteEligible = false;
    if(ev.rouletteEnabled && (ev.menuIds||[]).length){
      const every = parseInt(ev.rouletteEvery,10) || 10;
      const pickupNum = parseInt(String(pickup).replace(/^[A-Za-z]+/,''),10) || 0;
      if(pickupNum > 0 && pickupNum % every === 0){
        rouletteEligible = true;
      }
    }
    const order = {
      id, pickup, items: safe, total,
      status: 'pending',
      source: 'qr-cloud',
      clientId: _getClientId(),
      customerName: (body.name || '').toString().slice(0, 20),
      phone: (body.phone || '').toString().slice(0, 20),
      note: (body.note || '').toString().slice(0, 100),
      createdAt: now,
      expireAt: now + expMin * 60 * 1000,
      paidAt: null, readyAt: null,
      paidAmount: 0,
      eventBonus: eventBonus || null,
      rouletteEligible,
      rouletteResult: null, // 손님이 룰렛 돌린 결과 — 나중에 별도 업데이트
    };
    await FT.order(id).set(order);
    localStorage.setItem('ft_last_submit', String(now));

    return {
      ok: true, pickup, total,
      expireAt: order.expireAt,
      pay: {
        bank: pi.bank || '',
        account: pi.account || '',
        holder: pi.holder || '',
        kakaopayQR: pi.kakaopayQR || '',
        showAccount: pi.showAccount !== false,
        showQR: pi.showQR !== false,
        expireMinutes: expMin,
      },
      sname: menu.sname || '',
      _orderId: id,
      eventBonus: eventBonus || null,
      rouletteEligible,
      roulettePool: rouletteEligible ? (menu.menus||[]).filter(m=>(menu.event.menuIds||[]).includes(m.id)).map(m=>({id:m.id,name:m.name,emoji:m.emoji||'',price:m.price||0})) : null,
    };
  }

  // 룰렛 결과 저장 (손님이 룰렛 돌린 후 호출)
  async function _saveRouletteResult(orderId, prize){
    if(!orderId) return { ok:false, msg:'orderId 없음' };
    try{
      await FT.order(orderId).update({ rouletteResult: prize || null });
      return { ok:true };
    }catch(e){
      return { ok:false, msg:e.message };
    }
  }

  // pickup → orderId 캐시 (status 조회 가속용)
  const _pickupCache = {};
  async function _findOrderByPickup(pickup) {
    if (_pickupCache[pickup]) {
      const snap = await FT.order(_pickupCache[pickup]).once('value');
      if (snap.exists()) return snap.val();
    }
    // 폴백: 전체 스캔 (orderBy 인덱스 없으면 한번에 가져옴 — 일반적으로 주문 수 적음)
    const snap = await FT.orders().orderByChild('pickup').equalTo(pickup).limitToLast(1).once('value');
    let result = null;
    snap.forEach(s => { result = s.val(); _pickupCache[pickup] = s.key; });
    return result;
  }

  async function _getStatus(pickup) {
    const o = await _findOrderByPickup(pickup);
    if (!o) return { ok: false, msg: 'not found' };

    // 전체 활성 주문 가져와서 큐 순서 계산
    const allSnap = await FT.orders().once('value');
    const all = Object.values(allSnap.val() || {}).filter(x => x && x.createdAt);
    const today = new Date().toDateString();
    const todayOrders = all.filter(x => new Date(x.createdAt).toDateString() === today);

    let aheadCooking = 0;
    let aheadInQueue = 0; // 내 앞에서 아직 음식 안 받은 사람들

    if (o.status === 'cooking') {
      aheadCooking = todayOrders.filter(x =>
        x.status === 'cooking' && x.paidAt && o.paidAt && x.paidAt < o.paidAt
      ).length;
    }

    // 큐 순서: 내가 아직 ready/done이 아니면, 내 앞에 활성 주문 카운트
    if (['pending','paid','cooking'].includes(o.status)) {
      aheadInQueue = todayOrders.filter(x => {
        if (!['pending','paid','cooking','ready'].includes(x.status)) return false;
        if (x.id === o.id) return false;
        // 정렬 기준: paidAt(있으면) → createdAt
        const myKey = o.paidAt || o.createdAt;
        const xKey  = x.paidAt || x.createdAt;
        return xKey < myKey;
      }).length;
    }

    return {
      ok: true,
      status: o.status,
      pickup: o.pickup,
      total: o.total,
      items: o.items,
      aheadCooking,
      aheadInQueue,
      readyAt: o.readyAt || null,
      paidAmount: o.paidAmount || 0,
      shortBy: o.shortBy || 0,
      overBy: o.overBy || 0,
      refundRejected: !!o.refundRejected,
      refundRejectReason: o.refundRejectReason || '',
      eventBonus: o.eventBonus || null,
      rouletteEligible: !!o.rouletteEligible,
      rouletteResult: o.rouletteResult || null,
    };
  }

  async function _requestRefund(pickup, reason, account) {
    const o = await _findOrderByPickup(pickup);
    if (!o) return { ok: false, msg: 'not found' };
    const key = _pickupCache[pickup];
    if (!key) return { ok: false, msg: 'key missing' };
    await FT.order(key).update({
      refundRequested: true,
      refundReason: reason || '',
      refundAccount: account || '',
      refundRequestedAt: Date.now(),
    });
    return { ok: true };
  }

  async function _displaySnapshot() {
    const snap = await FT.orders().once('value');
    const v = snap.val() || {};
    const orders = Object.values(v);
    const today = new Date().toDateString();
    const recent = orders.filter(o => o && o.createdAt && new Date(o.createdAt).toDateString() === today);
    return {
      ok: true,
      sname: (await _readMenu()).sname || '푸드트럭',
      waiting: recent.filter(o => o.status === 'pending' || o.status === 'paid').map(o => o.pickup),
      cooking: recent.filter(o => o.status === 'cooking').map(o => o.pickup),
      ready:   recent.filter(o => o.status === 'ready').map(o => o.pickup),
    };
  }

  // fetch 인터셉터
  window.fetch = async function(input, init) {
    try {
      const url = typeof input === 'string' ? input : (input.url || '');
      const u = new URL(url, location.origin);

      // /api/menu — 메뉴 조회
      if (u.pathname === '/api/menu' && (!init || !init.method || init.method === 'GET')) {
        const menu = await _readMenu();
        return _jsonResponse(menu);
      }

      // /api/ft/order — 주문 접수
      if (u.pathname === '/api/ft/order' && init && init.method === 'POST') {
        const body = JSON.parse(init.body || '{}');
        const r = await _submitOrder(body);
        return _jsonResponse(r);
      }

      // /api/ft/status — 주문 상태 폴링
      if (u.pathname === '/api/ft/status') {
        const pickup = u.searchParams.get('pickup');
        const r = await _getStatus(pickup);
        return _jsonResponse(r);
      }

      // /api/ft/refund-request — 환불 요청
      if (u.pathname === '/api/ft/refund-request' && init && init.method === 'POST') {
        const body = JSON.parse(init.body || '{}');
        const r = await _requestRefund(body.pickup, body.reason, body.account);
        return _jsonResponse(r);
      }

      // /api/ft/roulette-result — 룰렛 결과 저장
      if (u.pathname === '/api/ft/roulette-result' && init && init.method === 'POST') {
        const body = JSON.parse(init.body || '{}');
        // pickup → orderId 찾기
        const o = await _findOrderByPickup(body.pickup);
        if(!o) return _jsonResponse({ ok:false, msg:'주문 없음' });
        const orderId = _pickupCache[body.pickup];
        const r = await _saveRouletteResult(orderId, body.prize);
        return _jsonResponse(r);
      }

      // /api/ft/display — 디스플레이용
      if (u.pathname === '/api/ft/display') {
        const r = await _displaySnapshot();
        return _jsonResponse(r);
      }

      // /images/X — Firebase Storage URL 매핑 (현재는 빈 응답)
      if (u.pathname.startsWith('/images/')) {
        return new Response('', { status: 404 });
      }

      // 그 외 경로는 원본 fetch에 위임 (CDN 등)
    } catch (e) {
      console.warn('[transport-cloud] error:', e);
      return _jsonResponse({ ok: false, msg: e.message }, 500);
    }
    return _origFetch(input, init);
  };

  console.log('[transport-cloud] active — Firebase RTDB 라우팅 활성화');
})();
