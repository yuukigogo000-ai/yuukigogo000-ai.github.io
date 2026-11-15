// はじきバトル試作 — 画面と入力(結果を決めるのは sim.js だけ。ここは見せるだけ)
(function () {
  'use strict';
  const S = globalThis.FlickSim;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), wrap = $('wrap');
  const RULES = { base: {}, shooterSafe: { shooterSafe: true }, ringReturn: { playerRingReturn: true } };
  const HP_RULES = { half: { ringHalf: true }, both: { hpKnockback: 'both' }, off: {} };
  const SKILL_JA = { slash: '一閃', heal: '給食', stun: '足止め', burst: 'びっくり箱' };

  let state, scale = 1, dpr = 1, colors = {};
  let aim = null;          // { sx, sy, cx, cy } 画面座標のドラッグ
  let popups = [], rings = [], pauseUntil = 0, acc = 0, last = 0, busy = false;
  const perf = { frames: 0, slow: 0, maxMs: 0, simMsMax: 0 };
  globalThis.__flickPerf = perf;
  globalThis.__flickState = () => state;

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bg', 'surface', 'fg', 'muted', 'line', 'table', 'table-edge', 'gap', 'ally', 'ally-fg', 'enemy', 'enemy-fg', 'accent', 'danger', 'heal'])
      colors[k] = cs.getPropertyValue('--' + k).trim();
  }

  function newGame() {
    state = S.createState($('stage').value, { rules: Object.assign({}, RULES[$('rule').value], HP_RULES[$('hpk').value]) });
    popups = []; rings = []; aim = null; acc = 0; pauseUntil = 0; busy = false;
    $('overlay').hidden = true;
    updateStatus();
  }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    scale = Math.max(0.2, Math.min(w / S.W, h / S.H));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = Math.floor(S.W * scale) + 'px';
    cv.style.height = Math.floor(S.H * scale) + 'px';
    cv.width = Math.floor(S.W * scale * dpr);
    cv.height = Math.floor(S.H * scale * dpr);
  }

  function updateStatus() {
    const u = state.units[state.active];
    $('status').textContent = state.shots + ' 手 ・ ' + state.turnNo + ' ターン目';
    let hint = '';
    if (state.phase === 'aim' && u) hint = u.name + ' の番です。引っぱって離すと反対向きに飛びます';
    else if (state.phase === 'resolving') hint = '…';
    $('hint').textContent = hint;
    $('auto').disabled = state.phase !== 'aim' || busy;
  }

  function finish() {
    const won = state.phase === 'won';
    $('ovTitle').textContent = won ? '勝ち!' : '負け…';
    $('ovSub').textContent = state.shots + ' 手 ・ ' + state.turnNo + ' ターン';
    $('overlay').hidden = false;
    $('hint').textContent = '';
  }

  // ---- 入力(引っぱって離す) ------------------------------------------------
  function shotFromAim() {
    if (!aim) return null;
    const dx = aim.sx - aim.cx, dy = aim.sy - aim.cy; // 引いた向きの反対に飛ぶ
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 16) return null; // 短すぎる引きはキャンセル
    return { dx: Math.round(dx), dy: Math.round(dy), power: Math.max(10, Math.min(100, Math.round(len * 0.7))) };
  }
  cv.addEventListener('pointerdown', (e) => {
    if (state.phase !== 'aim' || busy) return;
    cv.setPointerCapture(e.pointerId);
    aim = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY };
    e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => { if (aim) { aim.cx = e.clientX; aim.cy = e.clientY; } });
  function release() {
    const sh = shotFromAim();
    aim = null;
    if (sh && state.phase === 'aim') { S.shoot(state, sh.dx, sh.dy, sh.power); updateStatus(); }
  }
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', () => { aim = null; });

  $('auto').addEventListener('click', () => {
    if (state.phase !== 'aim' || busy) return;
    busy = true; $('hint').textContent = '考え中…'; updateStatus();
    setTimeout(() => {
      const t0 = performance.now();
      const b = S.bestShot(state);
      perf.aiMs = performance.now() - t0;
      busy = false;
      S.shoot(state, b.dx, b.dy, b.power);
      updateStatus();
    }, 30);
  });
  $('reset').addEventListener('click', newGame);
  $('again').addEventListener('click', newGame);
  $('stage').addEventListener('change', newGame);
  $('rule').addEventListener('change', newGame);
  $('hpk').addEventListener('change', newGame);

  // ---- 出来事を画面に出す ----------------------------------------------------
  function consumeEvents(now) {
    const ev = state.events;
    if (!ev.length) return;
    for (const e of ev) {
      if (e.t === 'hit') { const u = state.units[e.to]; popups.push({ x: u.x, y: u.y - u.r, text: '-' + e.dmg, c: 'danger', t: now }); }
      else if (e.t === 'heal') { const u = state.units[e.to]; popups.push({ x: u.x, y: u.y - u.r, text: '+' + e.amt, c: 'heal', t: now }); }
      else if (e.t === 'skill') { const u = state.units[e.by]; popups.push({ x: u.x, y: u.y + u.r + 12, text: SKILL_JA[e.kind] || e.kind, c: 'accent', t: now }); rings.push({ x: u.x, y: u.y, r: u.r + 6, c: 'accent', t: now }); }
      else if (e.t === 'stun') { const u = state.units[e.to]; popups.push({ x: u.x, y: u.y - u.r - 14, text: 'カウント+1', c: 'accent', t: now }); }
      else if (e.t === 'ko') { const u = state.units[e.id]; popups.push({ x: Math.max(30, Math.min(S.W - 30, u.x)), y: Math.max(20, Math.min(S.H - 10, u.y)), text: e.how === 'ring' ? '場外!' : 'たおれた', c: 'danger', t: now }); }
      else if (e.t === 'fall') { const u = state.units[e.id]; popups.push({ x: u.x, y: u.y - u.r, text: '落ちた(戻る)', c: 'danger', t: now }); }
      else if (e.t === 'blast') { const u = state.units[e.by]; rings.push({ x: u.x, y: u.y, r: e.r, c: 'danger', t: now, fill: true }); pauseUntil = now + 380; }
      else if (e.t === 'pull') { const u = state.units[e.by]; rings.push({ x: u.x, y: u.y, r: 220, c: 'muted', t: now, shrink: true }); pauseUntil = now + 250; }
      else if (e.t === 'charge') { pauseUntil = now + 200; }
    }
    state.events = [];
  }

  // ---- 描画 ------------------------------------------------------------------
  function drawTable() {
    ctx.fillStyle = colors.table; ctx.fillRect(0, 0, S.W, S.H);
    const g = state.gaps;
    const seg = (x1, y1, x2, y2, open) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = open ? colors.gap : colors['table-edge'];
      ctx.setLineDash(open ? [6, 6] : []); ctx.lineWidth = open ? 3 : 8; ctx.stroke(); ctx.setLineDash([]);
    };
    const side = (list, len, fn) => {
      let c = 0;
      const sorted = list.slice().sort((a, b) => a[0] - b[0]);
      for (const gp of sorted) { if (gp[0] > c) fn(c, gp[0], false); fn(gp[0], gp[1], true); c = gp[1]; }
      if (c < len) fn(c, len, false);
    };
    side(g.top, S.W, (a, b, o) => seg(a, 0, b, 0, o));
    side(g.bottom, S.W, (a, b, o) => seg(a, S.H, b, S.H, o));
    side(g.left, S.H, (a, b, o) => seg(0, a, 0, b, o));
    side(g.right, S.H, (a, b, o) => seg(S.W, a, S.W, b, o));
    ctx.fillStyle = colors.gap; ctx.font = '700 11px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const gp of g.top) ctx.fillText('落ちる', (gp[0] + gp[1]) / 2, 12);
    for (const gp of g.bottom) ctx.fillText('落ちる', (gp[0] + gp[1]) / 2, S.H - 12);
    for (const gp of g.left) ctx.fillText('落', 12, (gp[0] + gp[1]) / 2);
    for (const gp of g.right) ctx.fillText('落', S.W - 12, (gp[0] + gp[1]) / 2);
  }

  function drawUnit(u, now) {
    const ally = u.side === 0, base = ally ? colors.ally : colors.enemy, fg = ally ? colors['ally-fg'] : colors['enemy-fg'];
    // 予告: 次の敵の番で動く相手は、範囲と狙いを先に見せる
    if (!ally && u.count === 1 && state.phase !== 'won' && state.phase !== 'lost') {
      ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = colors.danger;
      if (u.act === 'blast') { ctx.beginPath(); ctx.arc(u.x, u.y, u.blastR, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (u.act === 'charge') {
        let t = null, bd = 0;
        for (const o of state.units) { if (!o.alive || o.side !== 0) continue; const d = (o.x - u.x) * (o.x - u.x) + (o.y - u.y) * (o.y - u.y); if (!t || d < bd) { t = o; bd = d; } }
        if (t) { ctx.save(); ctx.strokeStyle = colors.danger; ctx.globalAlpha = 0.55; ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.restore(); }
      }
    }
    if (ally && u.id === state.active && state.phase === 'aim') {
      const pulse = 4 + 2 * Math.sin(now / 180);
      ctx.beginPath(); ctx.arc(u.x, u.y, u.r + pulse, 0, Math.PI * 2); ctx.strokeStyle = colors.accent; ctx.lineWidth = 3; ctx.stroke();
    }
    const ratio = Math.max(0, u.hp / u.maxHp);
    // はがれかけ(落ちる・飛びやすい状態)の駒は色を薄くする
    let alpha = 1;
    if (!u.anchored) {
      if (state.rules.ringHalf) alpha = u.hp * 2 > u.maxHp ? 1 : 0.55;
      else if (state.rules.hpKnockback === 'both' || (state.rules.hpKnockback === 'enemy' && !ally)) alpha = 0.5 + 0.5 * ratio;
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2); ctx.fillStyle = base; ctx.fill();
    ctx.globalAlpha = 1;
    if (u.move === 'pierce') { ctx.setLineDash([3, 3]); ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.max(10, Math.round(u.r * 0.62)) + 'px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText(u.name.slice(0, u.r >= 28 ? 3 : 2), u.x, u.y);
    // 体力
    const w = Math.max(30, u.r * 1.8), hx = u.x - w / 2, hy = u.y + u.r + 3;
    ctx.fillStyle = colors.line; ctx.fillRect(hx, hy, w, 6);
    ctx.fillStyle = ratio > 0.4 ? colors.heal : colors.danger; ctx.fillRect(hx, hy, w * ratio, 6);
    ctx.font = '700 10px ' + getComputedStyle(document.body).fontFamily;
    ctx.lineWidth = 3; ctx.strokeStyle = colors.table; ctx.strokeText(String(Math.max(0, u.hp)), u.x, hy + 13);
    ctx.fillStyle = colors.fg; ctx.fillText(String(Math.max(0, u.hp)), u.x, hy + 13);
    // 敵のカウント
    if (!ally) {
      const bx = u.x + u.r * 0.72, by = u.y - u.r * 0.72;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fillStyle = u.count === 1 ? colors.danger : colors.surface; ctx.fill();
      ctx.strokeStyle = colors.fg; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = u.count === 1 ? colors.surface : colors.fg; ctx.font = '700 11px ' + getComputedStyle(document.body).fontFamily; ctx.fillText(String(u.count), bx, by + 0.5);
    }
  }

  function drawAim() {
    const sh = shotFromAim();
    const u = state.units[state.active];
    if (!aim || !u) return;
    if (!sh) return;
    // 予測線: 同じシミュレータに通した最初の 0.5 秒ぶんの軌道
    const c = S.cloneState(state);
    S.shoot(c, sh.dx, sh.dy, sh.power, { noEnemyPhase: true });
    ctx.fillStyle = colors.accent;
    for (let i = 0; i < 120 && c.phase === 'resolving'; i++) {
      S.step(c);
      const cu = c.units[u.id];
      if (!cu.alive) break;
      if (i % 8 === 7) { ctx.globalAlpha = 1 - i / 140; ctx.beginPath(); ctx.arc(cu.x, cu.y, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // 強さの目盛り
    const len = Math.sqrt(sh.dx * sh.dx + sh.dy * sh.dy), k = (u.r + 10 + sh.power * 0.5) / len;
    ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x + sh.dx * k, u.y + sh.dy * k);
    ctx.strokeStyle = colors.accent; ctx.lineWidth = 3; ctx.stroke();
    $('hint').textContent = '強さ ' + sh.power + '(離すと発射。短く戻すと取り消し)';
  }

  function drawFx(now) {
    rings = rings.filter((r) => now - r.t < 450);
    for (const r of rings) {
      const p = (now - r.t) / 450;
      ctx.save(); ctx.globalAlpha = (1 - p) * (r.fill ? 0.35 : 0.9);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.shrink ? r.r * (1 - p) : r.r * (0.6 + 0.4 * p), 0, Math.PI * 2);
      if (r.fill) { ctx.fillStyle = colors[r.c]; ctx.fill(); } else { ctx.strokeStyle = colors[r.c]; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.restore();
    }
    popups = popups.filter((p) => now - p.t < 900);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 14px ' + getComputedStyle(document.body).fontFamily;
    for (const p of popups) {
      const k = (now - p.t) / 900;
      ctx.globalAlpha = 1 - k * k;
      ctx.lineWidth = 3; ctx.strokeStyle = colors.surface; ctx.strokeText(p.text, p.x, p.y - k * 22);
      ctx.fillStyle = colors[p.c]; ctx.fillText(p.text, p.x, p.y - k * 22);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dtMs = last ? now - last : 16; last = now;
    perf.frames++; if (dtMs > 25) perf.slow++; if (dtMs > perf.maxMs && perf.frames > 5) perf.maxMs = dtMs;
    // 固定刻みで進める(描画の速さは結果に影響しない)
    if (state.phase === 'resolving' && now >= pauseUntil) {
      const t0 = performance.now();
      acc += Math.min(dtMs, 50) / 1000;
      let n = 0;
      while (acc >= S.DT && state.phase === 'resolving' && n < 16) {
        S.step(state); acc -= S.DT; n++;
        if (state.events.length) { consumeEvents(now); if (now < pauseUntil) break; }
      }
      const sm = performance.now() - t0; if (sm > perf.simMsMax) perf.simMsMax = sm;
      if (state.phase !== 'resolving') { acc = 0; updateStatus(); if (state.phase === 'won' || state.phase === 'lost') finish(); }
    }
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, S.W, S.H);
    drawTable();
    for (const u of state.units) if (u.alive) drawUnit(u, now);
    if (state.phase === 'aim') drawAim();
    drawFx(now);
    requestAnimationFrame(frame);
  }

  readColors();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', resize);
  newGame(); resize();
  requestAnimationFrame(frame);
})();
