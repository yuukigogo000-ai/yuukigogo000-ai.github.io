// はじきバトル 仮の戦闘画面(結果を決めるのは engine.js だけ。ここは見せるだけ)
// build.mjs が engine.js / data.js / ai.js と一緒に 1 つのスクリプトにまとめる。
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), wrap = $('wrap');
  const TEAMS = {
    mixed: ['kitchen', 'food', 'creature', 'machine'],
    heavy: ['machine', 'furniture', 'bath', 'kitchen'],
    chain: ['creature', 'toy', 'book', 'kitchen'],
    poison: ['plant', 'stationery', 'bath', 'food'],
    pierce: ['stationery', 'electronic', 'kitchen', 'clothing'],
  };
  const MOBS = [['kitchen', 'plant', 'creature'], ['machine', 'food', 'stationery', 'toy'], ['book', 'electronic', 'furniture', 'clothing']];
  const TRAITS = [[null, null, null], [null, null, 'back', null], ['hard', null, null, 'spike']];
  const SHORT = { kitchen: '台所', food: '食べ', stationery: '文具', book: '本', plant: '植物', creature: '生物', machine: '機械',
                  electronic: '電子', clothing: '衣類', furniture: '家具', toy: '玩具', bath: '浴室' };
  const TRAIT_JA = { hard: 'かたい', spike: 'トゲ', back: '背中が弱点', split: '分裂' };

  let state, scale = 1, dpr = 1, colors = {}, font = 'sans-serif';
  let aim = null, armed = false, busy = false;
  let popups = [], rings = [], bolts = [], pauseUntil = 0, acc = 0, last = 0, slowUntil = 0;
  const perf = { frames: 0, slow: 0, maxMs: 0, simMsMax: 0, aiMs: 0 };
  globalThis.__flickPerf = perf;
  globalThis.__flickState = () => state;

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bg', 'surface', 'fg', 'muted', 'line', 'table', 'table-edge', 'gap', 'ally', 'ally-fg', 'enemy', 'enemy-fg', 'boss', 'obstacle',
                     'accent', 'danger', 'heal', 'ult', 'ult-fg', 'wet', 'mat', 'stove', 'poison'])
      colors[k] = cs.getPropertyValue('--' + k).trim();
    font = getComputedStyle(document.body).fontFamily;
  }

  function newGame() {
    const team = TEAMS[$('team').value].map((l) => ally(l));
    const st = $('stage').value.split(':');
    const cfg = st[0] === 'boss' ? bossBattle(st[1], team) : mobBattle(st[1], team, MOBS[+st[2]], { traits: TRAITS[+st[2]] });
    state = createBattle(cfg);
    state.label = st[0] === 'boss' ? BOSSES[st[1]].rule : TABLES[st[1]].ja;
    popups = []; rings = []; bolts = []; aim = null; armed = false; busy = false; acc = 0; pauseUntil = 0;
    $('overlay').hidden = true;
    refresh();
  }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    scale = Math.max(0.2, Math.min(w / W, h / H));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = Math.floor(W * scale) + 'px';
    cv.style.height = Math.floor(H * scale) + 'px';
    cv.width = Math.floor(W * scale * dpr);
    cv.height = Math.floor(H * scale * dpr);
  }

  // ---- 上下の表示 ------------------------------------------------------------
  function refresh() {
    const u = state.units[state.active];
    $('status').textContent = state.shots + ' 手 ・ ' + state.turnNo + ' ターン目';
    const order = $('order');
    order.textContent = '';
    for (const a of state.units) {
      if (a.side !== 0) continue;
      const chip = document.createElement('div');
      const ready = a.alive && a.ultCharge >= a.ultNeed;
      chip.className = 'chip' + (a.id === state.active && state.phase === 'aim' ? ' now' : '') + (a.alive ? '' : ' down') + (ready ? ' ready' : '');
      const b = document.createElement('b'); b.textContent = a.name;
      const sp = document.createElement('span');
      sp.textContent = !a.alive ? 'たおれた' : '重さ' + a.weight + ' ・ ' + (ready ? '必殺OK' : 'あと' + (a.ultNeed - a.ultCharge));
      chip.append(b, sp); order.append(chip);
    }
    const ub = $('ult'), can = state.phase === 'aim' && !busy && canUlt(state);
    if (!can) armed = false;
    ub.disabled = !can;
    ub.className = 'ult' + (can ? ' ready' : '') + (armed ? ' armed' : '');
    ub.textContent = u && u.ult ? (armed ? '必殺で弾く: ' : '必殺 ') + ULT_JA[u.ult] + (can ? '' : '(まだ)') : '必殺';
    ub.setAttribute('aria-pressed', armed ? 'true' : 'false');
    let hint = state.label || '';
    if (state.phase === 'aim' && u) hint = u.name + ' の番 ・ ' + (state.label || '');
    $('hint').textContent = hint;
    $('auto').disabled = state.phase !== 'aim' || busy;
  }

  function finish() {
    const won = state.phase === 'won';
    $('ovTitle').textContent = won ? '勝ち!' : '負け…';
    $('ovSub').textContent = state.shots + ' 手 ・ 最大 ' + state.bestChain + ' れんさ ・ 必殺 ' + state.stats.ultsUsed + ' 回';
    $('overlay').hidden = false;
  }

  // ---- 入力(引っぱって離す。強さは引いた長さで 3 段階) ----------------------
  function shotFromAim() {
    if (!aim) return null;
    const dx = aim.sx - aim.cx, dy = aim.sy - aim.cy; // 引いた向きの反対に飛ぶ
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 18) return null; // 短すぎる引きは取り消し
    return { dx: Math.round(dx), dy: Math.round(dy), power: len < 60 ? 1 : len < 115 ? 2 : 3, ult: armed };
  }
  cv.addEventListener('pointerdown', (e) => {
    if (state.phase !== 'aim' || busy) return;
    cv.setPointerCapture(e.pointerId);
    aim = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY };
    e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => { if (aim) { aim.cx = e.clientX; aim.cy = e.clientY; } });
  function doShot(sh) { if (shoot(state, sh)) { armed = false; refresh(); } }
  cv.addEventListener('pointerup', () => { const sh = shotFromAim(); aim = null; if (sh && state.phase === 'aim') doShot(sh); else refresh(); });
  cv.addEventListener('pointercancel', () => { aim = null; });

  $('ult').addEventListener('click', () => { if (state.phase === 'aim' && canUlt(state)) { armed = !armed; refresh(); } });
  $('auto').addEventListener('click', () => {
    if (state.phase !== 'aim' || busy) return;
    busy = true; $('hint').textContent = '考え中…'; refresh();
    setTimeout(() => { const t0 = performance.now(); const b = bestShot(state); perf.aiMs = performance.now() - t0; busy = false; doShot(b); }, 30);
  });
  for (const id of ['reset', 'again']) $(id).addEventListener('click', newGame);
  for (const id of ['stage', 'team']) $(id).addEventListener('change', newGame);

  // ---- 出来事を画面に出す ----------------------------------------------------
  const pop = (u, text, c, dy, now) => popups.push({ x: Math.max(24, Math.min(W - 24, u.x)), y: Math.max(16, Math.min(H - 8, u.y + (dy || 0))), text, c, t: now });
  function consumeEvents(now) {
    for (const e of state.events) {
      const by = e.by >= 0 ? state.units[e.by] : null, to = e.to !== undefined ? state.units[e.to] : null;
      switch (e.t) {
        case 'hit': pop(to, '-' + e.dmg, e.kind === 'dot' ? 'poison' : 'danger', -to.r, now); break;
        case 'strong': pop(to, '強打!', 'ult', -to.r - 16, now); slowUntil = now + 90; break;
        case 'heal': pop(to, '+' + e.amt, 'heal', -to.r, now); break;
        case 'shield': pop(to, '盾+' + e.amt, 'accent', -to.r - 14, now); break;
        case 'block': pop(to, '盾で防いだ', 'accent', -to.r - 14, now); break;
        case 'touch': pop(by, TOUCH_JA[e.kind], 'accent', by.r + 16, now); rings.push({ x: by.x, y: by.y, r: by.r + 8, c: 'accent', t: now }); break;
        case 'ult': pop(by, ULT_JA[e.kind] + '!', 'ult', -by.r - 18, now); rings.push({ x: by.x, y: by.y, r: by.r + 16, c: 'ult', t: now }); pauseUntil = now + 320; break;
        case 'ultAfter': rings.push({ x: by.x, y: by.y, r: 220, c: 'ult', t: now }); break;
        case 'chain': if (e.n >= 2) popups.push({ x: W / 2, y: 34, text: e.n + ' れんさ!', c: 'ult', t: now, big: true }); break;
        case 'stun': pop(to, 'カウント+', 'accent', -to.r - 14, now); break;
        case 'poison': pop(to, '毒' + e.n, 'poison', to.r + 14, now); break;
        case 'charge': pop(to, '必殺が進んだ', 'ult', -to.r - 14, now); break;
        case 'execute': pop(to, 'とどめ!', 'ult', -to.r - 16, now); break;
        case 'bolt': bolts.push({ a: state.units[e.from], b: to, t: now }); break;
        case 'ko': { const u = state.units[e.id]; pop(u, e.how === 'ring' ? '場外!' : 'たおれた', 'danger', 0, now); if (e.how === 'ring') slowUntil = now + 260; break; }
        case 'fall': pop(state.units[e.id], '落ちた(戻る)', 'danger', -20, now); break;
        case 'gaugeBreak': pop(state.units[e.id], 'ゲージを割った!', 'ult', -60, now); pauseUntil = now + 500; break;
        case 'act': { rings.push({ x: by.x, y: by.y, r: by.action === 'blast' || by.action === 'bomb' ? by.actR : by.r + 14, c: 'danger', t: now, fill: by.action === 'blast' });
                      pop(by, ACTION_JA[e.kind] || e.kind, 'danger', by.r + 16, now); pauseUntil = now + 330; break; }
        case 'explode': rings.push({ x: by.x, y: by.y, r: e.r, c: 'danger', t: now, fill: true }); break;
        case 'bossRule': popups.push({ x: W / 2, y: 60, text: { pull: '吸い寄せ!', blow: '吹き出し!', spin: '卓が回った!', wind: '風向きが変わった!' }[e.kind], c: 'boss', t: now, big: true }); pauseUntil = now + 380; break;
        default: break;
      }
    }
    state.events = [];
  }

  // ---- 描画 ------------------------------------------------------------------
  function drawTable() {
    ctx.fillStyle = colors.table; ctx.fillRect(0, 0, W, H);
    for (const p of state.patches) {
      ctx.save(); ctx.globalAlpha = 0.34; ctx.fillStyle = colors[p.kind === 'wet' ? 'wet' : p.kind === 'mat' ? 'mat' : 'stove'];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = colors.fg; ctx.globalAlpha = 0.6; ctx.font = '700 10px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'wet' ? 'すべる' : p.kind === 'mat' ? 'とまる' : 'あつい', p.x, p.y); ctx.globalAlpha = 1;
    }
    if (state.slickTurns > 0) { ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = colors.wet; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    const g = state.gaps;
    const seg = (x1, y1, x2, y2, open) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = open ? colors.gap : colors['table-edge'];
      ctx.setLineDash(open ? [6, 6] : []); ctx.lineWidth = open ? 3 : 8; ctx.stroke(); ctx.setLineDash([]);
    };
    const side = (list, len, fn) => {
      let c = 0;
      for (const gp of list.slice().sort((a, b) => a[0] - b[0])) { if (gp[0] > c) fn(c, gp[0], false); fn(gp[0], gp[1], true); c = gp[1]; }
      if (c < len) fn(c, len, false);
    };
    side(g.top, W, (a, b, o) => seg(a, 0, b, 0, o)); side(g.bottom, W, (a, b, o) => seg(a, H, b, H, o));
    side(g.left, H, (a, b, o) => seg(0, a, 0, b, o)); side(g.right, H, (a, b, o) => seg(W, a, W, b, o));
    ctx.fillStyle = colors.gap; ctx.font = '700 11px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const gp of g.top) ctx.fillText('落ちる', (gp[0] + gp[1]) / 2, 12);
    for (const gp of g.bottom) ctx.fillText('落ちる', (gp[0] + gp[1]) / 2, H - 12);
    for (const gp of g.left) ctx.fillText('落', 12, (gp[0] + gp[1]) / 2);
    for (const gp of g.right) ctx.fillText('落', W - 12, (gp[0] + gp[1]) / 2);
    if (state.wind) { // 風向き
      const wx = state.wind.ax, wy = state.wind.ay, l = Math.sqrt(wx * wx + wy * wy) || 1, cx = W - 34, cy = H - 34;
      ctx.save(); ctx.strokeStyle = colors.boss; ctx.fillStyle = colors.boss; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - wx / l * 14, cy - wy / l * 14); ctx.lineTo(cx + wx / l * 14, cy + wy / l * 14); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + wx / l * 14, cy + wy / l * 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '700 10px ' + font; ctx.fillText('風', cx, cy - 22); ctx.restore();
    }
  }

  function drawTelegraphs() {
    if (state.phase === 'won' || state.phase === 'lost') return;
    for (const t of telegraphs(state)) {
      ctx.save(); ctx.fillStyle = colors.danger; ctx.strokeStyle = colors.danger;
      if (t.shape === 'circle') { ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill(); }
      else if (t.shape === 'band') { ctx.globalAlpha = 0.18; ctx.fillRect(t.x, t.y, t.w, t.h); }
      else if (t.shape === 'line') { ctx.globalAlpha = 0.6; ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
      else if (t.shape === 'gust' || t.shape === 'pull') { ctx.globalAlpha = 0.5; ctx.setLineDash([2, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
  }

  function drawUnit(u, now) {
    const ally_ = u.side === 0, base = u.kind === 'obstacle' ? colors.obstacle : u.kind === 'boss' ? colors.boss : ally_ ? colors.ally : colors.enemy;
    const fg = ally_ ? colors['ally-fg'] : colors['enemy-fg'];
    const peel = u.kind !== 'obstacle' && u.kind !== 'boss' && u.hp * 2 <= u.maxHp;
    if (ally_ && u.id === state.active && state.phase === 'aim') {
      ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 4 + 2 * Math.sin(now / 180), 0, Math.PI * 2); ctx.strokeStyle = armed ? colors.ult : colors.accent; ctx.lineWidth = 3; ctx.stroke();
    }
    const wob = peel ? Math.sin(now / 90 + u.id) * 1.2 : 0; // はがれかけは小さく揺れる
    ctx.globalAlpha = peel ? 0.6 : 1;
    ctx.beginPath(); ctx.arc(u.x + wob, u.y, u.r, 0, Math.PI * 2); ctx.fillStyle = base; ctx.fill();
    ctx.globalAlpha = 1;
    if (u.move === 'pierce' && ally_) { ctx.setLineDash([3, 3]); ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    if (u.hold) { ctx.strokeStyle = colors.fg; ctx.lineWidth = 3; ctx.stroke(); }
    if (u.shield > 0) { ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 3, 0, Math.PI * 2); ctx.strokeStyle = colors.accent; ctx.lineWidth = 2; ctx.stroke(); }
    if (u.kind === 'obstacle') return;
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.max(9, Math.round(u.r * 0.56)) + 'px ' + font;
    ctx.fillText(u.kind === 'boss' ? u.name : (SHORT[u.lineage] || u.name.slice(0, 2)), u.x + wob, u.y);
    // 体力
    const ratio = Math.max(0, u.hp / u.maxHp), w = Math.max(30, u.r * 1.8), hx = u.x - w / 2, hy = u.y + u.r + 3;
    ctx.fillStyle = colors.line; ctx.fillRect(hx, hy, w, 6);
    ctx.fillStyle = ratio > 0.5 ? colors.heal : colors.danger; ctx.fillRect(hx, hy, w * ratio, 6);
    ctx.fillStyle = colors.fg; ctx.fillRect(hx + w / 2 - 0.5, hy - 1, 1, 8); // 半分の目印(ここを切ると落とせる)
    ctx.font = '700 10px ' + font; ctx.lineWidth = 3; ctx.strokeStyle = colors.table;
    const label = String(Math.max(0, u.hp)) + (u.poison > 0 ? ' 毒' + u.poison : '');
    ctx.strokeText(label, u.x, hy + 13); ctx.fillStyle = u.poison > 0 ? colors.poison : colors.fg; ctx.fillText(label, u.x, hy + 13);
    if (u.kind === 'boss') { // 残りのゲージ
      for (let i = u.gaugeIdx; i < u.gauges.length; i++) { ctx.beginPath(); ctx.arc(u.x - (u.gauges.length - 1) * 6 + i * 12, u.y - u.r - 8, 4, 0, Math.PI * 2); ctx.fillStyle = colors.boss; ctx.fill(); }
    }
    if (!ally_) { // カウント
      const bx = u.x + u.r * 0.72, by = u.y - u.r * 0.72, soon = u.count === 1 && u.stagger === 0;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fillStyle = soon ? colors.danger : colors.surface; ctx.fill();
      ctx.strokeStyle = colors.fg; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = soon ? colors.surface : colors.fg; ctx.font = '700 11px ' + font; ctx.fillText(u.stagger > 0 ? '…' : String(u.count), bx, by + 0.5);
      if (u.trait) { ctx.font = '700 9px ' + font; ctx.fillStyle = colors.fg; ctx.fillText(TRAIT_JA[u.trait], u.x, u.y - u.r - 6); }
    } else if (u.ultCharge >= u.ultNeed) { // 必殺が使える
      ctx.beginPath(); ctx.arc(u.x + u.r * 0.72, u.y - u.r * 0.72, 6, 0, Math.PI * 2); ctx.fillStyle = colors.ult; ctx.fill();
    }
  }

  function drawAim() {
    const sh = shotFromAim(), u = state.units[state.active];
    if (!aim || !u || !sh) return;
    // 予測線: 本番と同じ計算で最初の 0.5 秒ぶんを描く。途中で落ちる・倒れるなら赤
    const c = cloneState(state);
    shoot(c, sh, { preview: true });
    const pts = []; let bad = false;
    for (let i = 0; i < 120 && c.phase === 'resolving'; i++) {
      step(c);
      const cu = c.units[u.id];
      for (const e of c.events) if ((e.t === 'fall' || e.t === 'ko') && e.id === u.id) bad = true;
      c.events = [];
      if (bad || !cu.alive) break;
      if (i % 8 === 7) pts.push([cu.x, cu.y, i]);
    }
    ctx.fillStyle = bad ? colors.danger : sh.ult ? colors.ult : colors.accent;
    for (const p of pts) { ctx.globalAlpha = 1 - p[2] / 140; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    const len = Math.sqrt(sh.dx * sh.dx + sh.dy * sh.dy), k = (u.r + 8 + sh.power * 16) / len;
    ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x + sh.dx * k, u.y + sh.dy * k);
    ctx.strokeStyle = bad ? colors.danger : sh.ult ? colors.ult : colors.accent; ctx.lineWidth = 2 + sh.power; ctx.stroke();
    $('hint').textContent = (bad ? '⚠ 落ちる・倒れる軌道です ・ ' : '') + '強さ ' + ['', '弱', '中', '強'][sh.power] + (sh.ult ? ' ・ 必殺' : '') + '(離すと発射、短く戻すと取り消し)';
  }

  function drawFx(now) {
    rings = rings.filter((r) => now - r.t < 450);
    for (const r of rings) {
      const p = (now - r.t) / 450;
      ctx.save(); ctx.globalAlpha = (1 - p) * (r.fill ? 0.35 : 0.9);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.6 + 0.4 * p), 0, Math.PI * 2);
      if (r.fill) { ctx.fillStyle = colors[r.c]; ctx.fill(); } else { ctx.strokeStyle = colors[r.c]; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.restore();
    }
    bolts = bolts.filter((b) => now - b.t < 260);
    for (const b of bolts) { ctx.save(); ctx.globalAlpha = 1 - (now - b.t) / 260; ctx.strokeStyle = colors.ult; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke(); ctx.restore(); }
    popups = popups.filter((p) => now - p.t < 950);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of popups) {
      const k = (now - p.t) / 950;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = '700 ' + (p.big ? 20 : 13) + 'px ' + font;
      ctx.lineWidth = 3; ctx.strokeStyle = colors.surface; ctx.strokeText(p.text, p.x, p.y - k * 22);
      ctx.fillStyle = colors[p.c]; ctx.fillText(p.text, p.x, p.y - k * 22);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dtMs = last ? now - last : 16; last = now;
    perf.frames++; if (dtMs > 25) perf.slow++; if (dtMs > perf.maxMs && perf.frames > 5) perf.maxMs = dtMs;
    if (state.phase === 'resolving' && now >= pauseUntil) {
      const t0 = performance.now();
      acc += Math.min(dtMs, 50) / 1000 * (now < slowUntil ? 0.3 : 1); // 強打と場外の瞬間は少しゆっくり見せる
      let n = 0;
      while (acc >= DT && state.phase === 'resolving' && n < 16) {
        step(state); acc -= DT; n++;
        if (state.events.length) { consumeEvents(now); if (now < pauseUntil) break; }
      }
      const sm = performance.now() - t0; if (sm > perf.simMsMax) perf.simMsMax = sm;
      if (state.phase !== 'resolving') { acc = 0; consumeEvents(now); refresh(); if (state.phase === 'won' || state.phase === 'lost') finish(); }
    }
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawTable();
    drawTelegraphs();
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
