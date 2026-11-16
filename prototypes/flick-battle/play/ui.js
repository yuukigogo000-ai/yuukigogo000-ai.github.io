// はじきバトル 仮の戦闘画面(結果を決めるのは engine.js だけ。ここは見せるだけ)
// build.mjs が engine.js / data.js / ai.js と一緒に 1 つのスクリプトにまとめる。
// 2026-11-16: 手触りの演出(reports/はじきバトルの進化案.md の案 M〜U)を足した
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
  // 進化の組を持たせた編成(見本用)
  const EVO_TEAMS = {
    evo: [['kitchen', 'blade', 'strong'], ['stationery', 'mirror', 'nimble'], ['creature', 'fan', 'cheer'], ['machine', 'dumbbell', 'sturdy']],
    evo2: [['machine', 'match', 'grit'], ['kitchen', 'battery', 'early'], ['furniture', 'whistle', 'stunRes'], ['food', 'magnifier', 'strong']],
  };
  const MOBS = [['kitchen', 'plant', 'creature'], ['machine', 'food', 'stationery', 'toy'], ['book', 'electronic', 'furniture', 'clothing']];
  const TRAITS = [[null, null, null], [null, null, 'back', null], ['hard', null, null, 'spike']];
  const SHORT = { kitchen: '台所', food: '食べ', stationery: '文具', book: '本', plant: '植物', creature: '生物', machine: '機械',
                  electronic: '電子', clothing: '衣類', furniture: '家具', toy: '玩具', bath: '浴室' };
  const TRAIT_JA = { hard: 'かたい', spike: 'トゲ', back: '背中が弱点', split: '分裂' };
  const TRICK_JA = { crashRing: 'ぶつけ落とし!', bankDouble: '柵返し 2 体!' };
  const OBJ_MARK = { cup: '', bumper: '輪', bottle: '瓶', lid: 'ふた', pin: '' };
  const FX = { full: 1, low: 0.5, off: 0 };

  let state, cfgNow = null, goal = null, gameNo = 0, scale = 1, dpr = 1, colors = {}, font = 'sans-serif';
  let aim = null, armed = false, busy = false, replaying = false, lastShot = null, lastPower = 0;
  let popups = [], rings = [], bolts = [], pauseUntil = 0, freezeUntil = 0, acc = 0, last = 0, slowUntil = 0, slowRate = 1;
  let shakeUntil = 0, shakeAmp = 0, shotOpen = false, shotDmg = 0;
  const perf = { frames: 0, slow: 0, maxMs: 0, simMsMax: 0, aiMs: 0 };
  globalThis.__flickPerf = perf;
  globalThis.__flickState = () => state;

  // ---- 撮影台のためのフック(URL に付けたときだけ働く。ふだんの動きは変えない) --------
  //  ?scene=<場面>     : fx/scenes.js の場面を開く(state の場面は止まった状態、shot の場面は __fx.fire() で弾く)
  //  ?clock=manual    : 時計を止める。__fx.advance(ms) で 1 コマずつ進める(同じ画面を何度でも撮れる)
  //  ?state=<状態>     : UI 発注書 §2 の状態を開いて、その瞬間で止める(uicheck --state 用)
  const Q = new URLSearchParams(location.search);
  const STATE_TO_SCENE = { aim: ['aim'], drag: ['drag'], dragDanger: ['dragDanger'], ultReady: ['ultArmed', null, true], ultArmed: ['ultArmed'],
                           moving: ['hit', 'ms:150'], enemy: ['enemyTurn', 'ev:act'], chain: ['chain5', 'chain:5'], boss: ['gauge'],
                           gauge: ['gauge', 'ev:gaugeBreak'], chain10: ['chain10', 'chain:10'], finale: ['finale', 'ev:ko'], won: ['finale', 'end'], lost: ['lost', 'end'] };
  const ST = Q.get('state') && STATE_TO_SCENE[Q.get('state')];
  const SCENE = typeof sceneById === 'function' ? sceneById(ST ? ST[0] : Q.get('scene')) || null : null;
  const MANUAL = Q.get('clock') === 'manual' || !!ST;
  let manualNow = 1000;
  // 測るもの: 1 手で演出が足した待ち・敵の番の待ち・スローで伸びた時間・決着の余韻・離してから動くまで・同時に出た演出の数・文字
  const fxm = { shotWait: 0, enemyWait: 0, slowMs: 0, finaleMs: 0, finaleT: null, fireT: null, moveT: null, firePos: null, maxFx: 0, texts: new Map(), logText: false, events: [] };

  // ---- 設定(この端末だけに覚える。読めなくても動く) --------------------------
  const store = { get(k, d) { try { const v = localStorage.getItem('flick.' + k); return v === null ? d : v; } catch (e) { return d; } },
                  set(k, v) { try { localStorage.setItem('flick.' + k, v); } catch (e) { /* 覚えられなくても続ける */ } } };
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('fx').value = store.get('fx', reduce ? 'low' : 'full');
  $('snd').value = store.get('snd', 'on');
  const fx = () => FX[$('fx').value] === undefined ? 1 : FX[$('fx').value];
  $('fx').addEventListener('change', () => store.set('fx', $('fx').value));
  $('snd').addEventListener('change', () => store.set('snd', $('snd').value));

  // ---- 音(端末の中で作る。音源ファイルは使わない) ----------------------------
  let audio = null;
  function tone(freq, dur, type, vol, delay) {
    if ($('snd').value !== 'on') return;
    try {
      if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audio = new AC(); }
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime + (delay || 0), o = audio.createOscillator(), g = audio.createGain();
      o.type = type || 'triangle'; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol || 0.12, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* 音が出なくても続ける */ }
  }
  const semi = (base, n) => base * Math.pow(2, n / 12); // 画面の音だけ。勝ち負けの計算には使わない
  const sfx = {
    tap: () => tone(660, 0.04, 'sine', 0.06),
    step: (p) => tone(semi(392, p * 4), 0.05, 'square', 0.05),
    cancel: () => tone(220, 0.08, 'sine', 0.06),
    shoot: (p) => tone(semi(220, p * 3), 0.09, 'triangle', 0.1),
    hit: (n) => tone(semi(330, Math.min(12, n)), 0.07, 'triangle', 0.12),
    strong: () => { tone(110, 0.16, 'sawtooth', 0.12); tone(220, 0.1, 'triangle', 0.1); },
    milestone: (n) => { const b = semi(392, Math.min(12, n)); tone(b, 0.18, 'triangle', 0.1); tone(b * 1.25, 0.18, 'triangle', 0.08, 0.04); tone(b * 1.5, 0.22, 'triangle', 0.08, 0.08); },
    ring: () => tone(523, 0.12, 'sine', 0.11),
    crash: () => tone(150, 0.08, 'square', 0.08),
    bumper: () => tone(880, 0.05, 'square', 0.05),
    pickup: () => { tone(784, 0.07, 'sine', 0.08); tone(1047, 0.09, 'sine', 0.08, 0.06); },
    bonus: () => { tone(523, 0.08, 'triangle', 0.1); tone(784, 0.14, 'triangle', 0.1, 0.08); },
    near: () => tone(196, 0.3, 'sine', 0.08),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.11, i * 0.09)),
    lose: () => [392, 311, 233].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, i * 0.12)),
  };
  // 振動はおまけ(iPhone のブラウザでは使えない。音と見た目だけで手応えが分かるように作ってある)
  const buzz = (ms) => { if (fx() > 0 && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* なし */ } } };

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bg', 'surface', 'fg', 'muted', 'line', 'table', 'table-edge', 'gap', 'ally', 'ally-fg', 'enemy', 'enemy-fg', 'boss', 'obstacle',
                     'accent', 'danger', 'heal', 'ult', 'ult-fg', 'wet', 'mat', 'stove', 'poison', 'snack'])
      colors[k] = cs.getPropertyValue('--' + k).trim();
    font = getComputedStyle(document.body).fontFamily;
  }

  function makeTeam() {
    const k = $('team').value;
    if (EVO_TEAMS[k]) return EVO_TEAMS[k].map((e) => ally(e[0], { item: e[1], passives: [e[2]] }));
    return TEAMS[k].map((l) => ally(l));
  }
  function newGame() {
    const st = $('stage').value.split(':');
    if (SCENE) { cfgNow = SCENE.cfg(); state = sceneState(SCENE); state.label = '場面: ' + SCENE.ja; goal = null; }
    else {
      cfgNow = st[0] === 'boss' ? bossBattle(st[1], makeTeam()) : mobBattle(st[1], makeTeam(), MOBS[+st[2]], { traits: TRAITS[+st[2]] });
      state = createBattle(cfgNow);
      state.label = st[0] === 'boss' ? BOSSES[st[1]].rule : TABLES[st[1]].ja;
      goal = pickGoal(++gameNo, cfgNow);
    }
    popups = []; rings = []; bolts = []; aim = null; armed = false; busy = false; replaying = false; lastShot = null;
    acc = 0; pauseUntil = 0; freezeUntil = 0; slowUntil = 0; shakeUntil = 0; shotOpen = false;
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
    $('goal').textContent = goal ? 'おまけ目標: ' + goal.text : '';
    const order = $('order');
    order.textContent = '';
    for (const a of state.units) {
      if (a.kind !== 'ally') continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      const ready = a.alive && a.ultCharge >= a.ultNeed;
      chip.className = 'chip' + (a.id === state.active && state.phase === 'aim' ? ' now' : '') + (a.alive ? '' : ' down') + (ready ? ' ready' : '');
      const b = document.createElement('b'); b.textContent = a.name;
      const sp = document.createElement('span');
      sp.textContent = !a.alive ? 'たおれた' : '重' + a.weight + '・' + (ready ? '必殺OK' : '必殺' + (a.ultNeed - a.ultCharge));
      chip.append(b, sp);
      chip.setAttribute('aria-label', a.name + 'のくわしい説明と技の見本');
      chip.addEventListener('click', () => { sfx.tap(); openInfo(a.id); });
      order.append(chip);
    }
    const ub = $('ult'), can = state.phase === 'aim' && !busy && canUlt(state);
    if (!can) armed = false;
    ub.disabled = !can;
    ub.className = 'ult' + (can ? ' ready' : '') + (armed ? ' armed' : '');
    ub.textContent = u && u.ult ? (armed ? '必殺で弾く: ' : '必殺 ') + ULT_JA[u.ult] + (can ? '' : '(まだ)') : '必殺';
    ub.setAttribute('aria-pressed', armed ? 'true' : 'false');
    let hint = state.label || '';
    if (state.phase === 'aim' && u) hint = u.name + ' の番 ・ ' + (state.label || '');
    if (replaying) hint = '決め手を再生中';
    $('hint').textContent = hint;
    $('auto').disabled = state.phase !== 'aim' || busy;
  }

  function finish() {
    const won = state.phase === 'won';
    if (!replaying) (won ? sfx.win : sfx.lose)();
    $('ovTitle').textContent = won ? '勝ち!' : '負け…';
    const g = goal ? (goalMet(goal, state) ? 'おまけ目標 達成!' : 'おまけ目標 ならず') : '';
    $('ovSub').textContent = state.shots + ' 手 ・ 最大 ' + state.bestChain + ' れんさ ・ 1 手の最高 ' + state.stats.bestShotDmg + ' ダメージ' + (replaying ? '(再生)' : '');
    $('ovGoal').textContent = g;
    $('replay').hidden = !lastShot;
    $('overlay').hidden = false;
    replaying = false; busy = false;
  }

  // ---- 入力(引っぱって離す。強さは引いた長さで 3 段階) ----------------------
  function powerOf(len) { return len < 18 ? 0 : len < 60 ? 1 : len < 115 ? 2 : 3; } // 0 = 取り消し
  function shotFromAim() {
    if (!aim) return null;
    if (aim.exact) return Object.assign({}, aim.exact, { ult: armed }); // 撮影台: 場面の手をそのまま
    const dx = aim.sx - aim.cx, dy = aim.sy - aim.cy; // 引いた向きの反対に飛ぶ
    const p = powerOf(Math.sqrt(dx * dx + dy * dy));
    if (!p) return null;
    return { dx: Math.round(dx), dy: Math.round(dy), power: p, ult: armed };
  }
  cv.addEventListener('pointerdown', (e) => {
    if (state.phase !== 'aim' || busy) return;
    cv.setPointerCapture(e.pointerId);
    aim = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, pulse: 0 };
    lastPower = 0;
    e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!aim) return;
    aim.cx = e.clientX; aim.cy = e.clientY;
    const dx = aim.sx - aim.cx, dy = aim.sy - aim.cy, p = powerOf(Math.sqrt(dx * dx + dy * dy));
    if (p !== lastPower) { if (p > 0) sfx.step(p); else if (lastPower > 0) sfx.cancel(); aim.pulse = performance.now(); lastPower = p; } // 強さの段が変わった瞬間の手応え
  });
  function doShot(sh) {
    lastShot = { st: cloneState(state), input: sh };
    const me = state.units[state.active]; fxm.fireT = MANUAL ? manualNow : performance.now(); fxm.moveT = null; fxm.firePos = me ? [me.id, me.x, me.y] : null;
    if (shoot(state, sh)) { armed = false; shotOpen = true; shotDmg = 0; sfx.shoot(sh.power); refresh(); }
  }
  cv.addEventListener('pointerup', () => { const sh = shotFromAim(); const was = !!aim; aim = null; if (sh && state.phase === 'aim') doShot(sh); else { if (was) sfx.cancel(); refresh(); } });
  cv.addEventListener('pointercancel', () => { aim = null; });

  $('ult').addEventListener('click', () => { if (state.phase === 'aim' && canUlt(state)) { sfx.tap(); armed = !armed; refresh(); } });
  $('auto').addEventListener('click', () => {
    if (state.phase !== 'aim' || busy) return;
    busy = true; $('hint').textContent = '考え中…'; refresh();
    setTimeout(() => { const t0 = performance.now(); const b = bestShot(state); perf.aiMs = performance.now() - t0; busy = false; doShot(b); }, 30);
  });
  for (const id of ['reset', 'again']) $(id).addEventListener('click', () => { sfx.tap(); newGame(); });
  for (const id of ['stage', 'team']) $(id).addEventListener('change', newGame);
  // 決め手の再生: 最後の 1 手の直前の盤面から、同じ入力をもう一度流す(同じ手なら必ず同じ結果になる)
  $('replay').addEventListener('click', () => {
    if (!lastShot) return;
    sfx.tap();
    state = cloneState(lastShot.st); state.label = lastShot.st.label;
    replaying = true; busy = true; popups = []; rings = []; acc = 0;
    $('overlay').hidden = true;
    shoot(state, lastShot.input); shotOpen = true; shotDmg = 0;
    refresh();
  });

  // ---- くわしい説明と技の見本(本物のエンジンで小さな卓を動かす) --------------
  let demo = null;
  function openInfo(id) {
    const a = state.units[id];
    if (!a || a.kind !== 'ally') return;
    const L = LINEAGES[a.lineage];
    const lines = [];
    lines.push(['系統', L.ja + ' ・ 重さ ' + a.weight + ' ・ ' + (a.move === 'pierce' ? '貫く' : '跳ねる')]);
    lines.push(['タッチ技', TOUCH_JA[a.touch] + '(味方に当てられると出る)']);
    lines.push(['必殺', ULT_JA[a.ult] + '(自分の番 ' + a.ultNeed + ' 回でたまる)']);
    const src = cfgNow.allies[state.units.filter((u) => u.kind === 'ally').indexOf(a)];
    if (src && src.item) { const it = ITEMS[src.item]; lines.push(['持ち物', it.ja + ': ' + it.on + ' → ' + it.text]); }
    if (src && src.passives && src.passives.length) lines.push(['パッシブ', src.passives.map((p) => PASSIVES[p].ja).join('・')]);
    if (src && src.evo) { const e = EVOLUTIONS.find((x) => x.key === src.evo); lines.push(['進化', e.ja + ': ' + e.on + ' → ' + e.text]); }
    $('infoTitle').textContent = a.name;
    const dl = $('infoBody'); dl.textContent = '';
    for (const [k, v] of lines) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
    $('demoCap').textContent = '見本: ' + TOUCH_JA[a.touch] + '(灰色の駒を当てると出る)';
    $('demo').hidden = false;
    demo = { lineage: a.lineage, s: null, t: 0 };
    $('info').hidden = false;
  }
  function openDex() {
    $('infoTitle').textContent = '図鑑: 進化の組と卓の物';
    const dl = $('infoBody'); dl.textContent = '';
    for (const e of EVOLUTIONS) { const dt = document.createElement('dt'); dt.textContent = e.ja; const dd = document.createElement('dd'); dd.textContent = ITEMS[e.item].ja + ' + ' + PASSIVES[e.passive].ja + ' → ' + e.on + ': ' + e.text; dl.append(dt, dd); }
    const notes = { cup: '動かない。跳ね返りに使える', bumper: '当たった駒を強く弾き返す', bottle: '押すと動く。敵にぶつけるとダメージ', lid: '味方が当てると開いて、回復のおやつが出る', pin: '全部倒すと、決まった柵が 2 ターン開く' };
    for (const k of Object.keys(OBJ)) { const dt = document.createElement('dt'); dt.textContent = OBJ[k].ja; const dd = document.createElement('dd'); dd.textContent = notes[k]; dl.append(dt, dd); }
    $('demo').hidden = true; $('demoCap').textContent = '';
    demo = null;
    $('info').hidden = false;
  }
  $('dex').addEventListener('click', () => { sfx.tap(); openDex(); });
  $('infoClose').addEventListener('click', () => { sfx.tap(); $('info').hidden = true; demo = null; });
  function demoBattle(lin) {
    const NOGAP = { top: [], bottom: [], left: [], right: [] };
    const dummy = (x, y, name) => ({ name, hp: 100, atk: 10, weight: 3, action: 'blast', count: 9, actR: 10, x, y });
    const s = createBattle({ gaps: NOGAP, allies: [Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 460, touch: null, atk: 1 }), Object.assign(ally(lin), { name: 'B', x: 180, y: 360 }),
                                                   Object.assign(ally('furniture'), { name: 'C', x: 70, y: 470, touch: null })],
                            enemies: [dummy(180, 240, 'まと'), dummy(280, 170, 'まと2')] });
    s.units[2].hp = Math.round(s.units[2].maxHp * 0.5);
    shoot(s, { dx: 0, dy: -1, power: 2 }, { preview: true });
    return s;
  }
  function drawDemo(now) {
    if (!demo || $('info').hidden) return;
    const c = $('demo'), g = c.getContext('2d'), k = c.width / W;
    if (!demo.s || (demo.s.phase !== 'resolving' && now - demo.endAt > 1200)) { demo.s = demoBattle(demo.lineage); demo.endAt = Infinity; demo.fx = []; }
    for (let i = 0; i < 4 && demo.s.phase === 'resolving'; i++) { step(demo.s); for (const e of demo.s.events) if (e.t === 'touch' || e.t === 'hit' || e.t === 'heal' || e.t === 'shield' || e.t === 'stun' || e.t === 'poison') demo.fx.push({ id: e.to !== undefined ? e.to : e.by, t: now, txt: e.t === 'touch' ? TOUCH_JA[e.kind] : e.t === 'hit' ? '-' + e.dmg : e.t === 'heal' ? '+' + e.amt : e.t === 'shield' ? '盾' : e.t === 'stun' ? 'カウント+' : '毒' }); demo.s.events = []; }
    if (demo.s.phase !== 'resolving' && demo.endAt === Infinity) demo.endAt = now;
    g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = colors.table; g.fillRect(0, 0, W, H);
    for (const p of demo.s.patches) { g.globalAlpha = 0.34; g.fillStyle = colors.wet; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    for (const u of demo.s.units) {
      if (!u.alive) continue;
      g.beginPath(); g.arc(u.x, u.y, u.r, 0, Math.PI * 2);
      g.fillStyle = u.side === 1 ? colors.enemy : u.name === 'A' ? colors.obstacle : colors.ally; g.fill();
      if (u.shield > 0) { g.strokeStyle = colors.accent; g.lineWidth = 4; g.stroke(); }
    }
    demo.fx = demo.fx.filter((f) => now - f.t < 1000);
    g.font = '700 40px ' + font; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const f of demo.fx) { const u = demo.s.units[f.id]; if (!u) continue; g.globalAlpha = 1 - (now - f.t) / 1000; g.lineWidth = 6; g.strokeStyle = colors.surface; g.strokeText(f.txt, u.x, u.y - u.r - 20); g.fillStyle = colors.ult; g.fillText(f.txt, u.x, u.y - u.r - 20); }
    g.globalAlpha = 1;
  }

  // ---- 出来事を画面に出す(強弱をつける: 毎手は短く、決着の 1 発だけ大きく) ------
  // 卓の上の中央に出す大きな文字は、重ならないように段をずらす
  const center = (text, c, now, size) => {
    const busyLanes = popups.filter((p) => p.lane !== undefined && now - p.t < 700).map((p) => p.lane);
    let lane = 0; while (busyLanes.indexOf(lane) >= 0) lane++;
    popups.push({ x: W / 2, y: 34 + lane * 28, text, c, t: now, big: true, size, lane });
  };
  const pop = (u, text, c, dy, now, big) => popups.push({ x: Math.max(24, Math.min(W - 24, u.x)), y: Math.max(16, Math.min(H - 8, u.y + (dy || 0))), text, c, t: now, big });
  const freeze = (now, ms) => { freezeUntil = Math.max(freezeUntil, now + ms * fx()); };
  const shake = (now, amp, ms) => { if (fx() === 0) return; shakeAmp = Math.max(now < shakeUntil ? shakeAmp : 0, amp * fx()); shakeUntil = Math.max(shakeUntil, now + ms); };
  function enemiesLeft() { let n = 0; for (const u of state.units) if (u.alive && u.side === 1) n++; return n; }
  function flushShot(now) {
    if (!shotOpen) return;
    shotOpen = false;
    if (shotDmg > 0) center('合計 ' + shotDmg, 'fg', now);
    // 惜しい: あと少しで倒せた敵がいる(大きく見せて、もう 1 回を誘う)
    const near = state.units.find((u) => u.alive && u.side === 1 && u.kind !== 'boss' && u.hp > 0 && u.hp <= u.maxHp * 0.08);
    if (near && state.phase !== 'won') { pop(near, 'あと少し!', 'ult', -near.r - 26, now, true); sfx.near(); }
  }
  function consumeEvents(now) {
    for (const e of state.events) {
      if (fxm.events.length < 4000) fxm.events.push([Math.round(now - (fxm.fireT || now)), e.t, e.n]);
      const by = e.by >= 0 ? state.units[e.by] : null, to = e.to !== undefined && e.to >= 0 ? state.units[e.to] : null;
      switch (e.t) {
        case 'hit':
          if (!to) break;
          pop(to, '-' + e.dmg, e.kind === 'dot' ? 'poison' : 'danger', -to.r, now);
          if (shotOpen && to.side === 1 && e.kind !== 'dot' && e.kind !== 'foe') shotDmg += e.dmg;
          if (shotOpen && to.side === 1 && (e.kind === 'hit' || e.kind === 'ult')) { sfx.hit(state.chain); freeze(now, state.chain <= 1 ? 30 : 0); } // 普通の当たりは止めないか、ごく短く
          break;
        case 'strong': pop(to, '強打!', 'ult', -to.r - 16, now); freeze(now, 90); shake(now, 3, 150); sfx.strong(); buzz(20); break;
        case 'heal': pop(to, '+' + e.amt, 'heal', -to.r, now); break;
        case 'shield': pop(to, '盾+' + e.amt, 'accent', -to.r - 14, now); break;
        case 'block': pop(to, '盾で防いだ', 'accent', -to.r - 14, now); break;
        case 'touch': pop(by, TOUCH_JA[e.kind], 'accent', by.r + 16, now); rings.push({ x: by.x, y: by.y, r: by.r + 8, c: 'accent', t: now }); break;
        case 'ult': pop(by, ULT_JA[e.kind] + '!', 'ult', -by.r - 18, now); rings.push({ x: by.x, y: by.y, r: by.r + 16, c: 'ult', t: now }); pauseUntil = now + 320; break;
        case 'ultAfter': rings.push({ x: by.x, y: by.y, r: 220, c: 'ult', t: now }); break;
        case 'chain': // れんさの三層: 1 つごとに音が上がる / 5・10 れんさで色と音が変わる / 手の最後に合計
          if (e.n >= 2) { popups = popups.filter((p) => !p.chain); center(e.n + ' れんさ!', e.n >= 10 ? 'danger' : e.n >= 5 ? 'ult' : 'accent', now, Math.min(30, 16 + e.n * 1.5)); popups[popups.length - 1].chain = true; }
          if (e.n === 5 || e.n === 10) { sfx.milestone(e.n); rings.push({ x: W / 2, y: H / 2, r: 260, c: e.n >= 10 ? 'danger' : 'ult', t: now }); }
          break;
        case 'stun': pop(to, 'カウント+', 'accent', -to.r - 14, now); break;
        case 'poison': pop(to, '毒' + e.n, 'poison', to.r + 14, now); break;
        case 'charge': pop(to, '必殺が進んだ', 'ult', -to.r - 14, now); break;
        case 'chainCharge': pop(to, '3 れんさ: 必殺+1', 'ult', -to.r - 16, now); break;
        case 'execute': pop(to, 'とどめ!', 'ult', -to.r - 16, now); break;
        case 'bolt': bolts.push({ a: state.units[e.from], b: to, t: now }); break;
        case 'ko': {
          const u = state.units[e.id];
          if (u.kind === 'mini') break;
          pop(u, e.how === 'ring' ? '場外!' : 'たおれた', 'danger', 0, now);
          if (u.side === 1 && enemiesLeft() === 0) { // 決着の 1 発だけ、長めのスローと大きな揺れ
            fxm.finaleT = now;
            slowUntil = now + 600 * fx(); slowRate = 0.35; shake(now, 7, 250); freeze(now, 140); buzz(60);
          } else if (u.side === 1) { freeze(now, 120); if (e.how === 'ring') sfx.ring(); buzz(25); }
          break;
        }
        case 'fall': pop(state.units[e.id], '落ちた(戻る)', 'danger', -20, now); break;
        case 'gaugeBreak': pop(state.units[e.id], 'ゲージを割った!', 'ult', -60, now); pauseUntil = now + 500; shake(now, 5, 220); break;
        case 'act': { rings.push({ x: by.x, y: by.y, r: by.action === 'blast' || by.action === 'bomb' ? by.actR : by.r + 14, c: 'danger', t: now, fill: by.action === 'blast' });
                      pop(by, ACTION_JA[e.kind] || e.kind, 'danger', by.r + 16, now); pauseUntil = now + 330; break; }
        case 'explode': rings.push({ x: by.x, y: by.y, r: e.r, c: 'danger', t: now, fill: true }); break;
        case 'bossRule': center({ pull: '吸い寄せ!', blow: '吹き出し!', spin: '卓が回った!', wind: '風向きが変わった!' }[e.kind], 'boss', now); pauseUntil = now + 380; break;
        // 2026-11-16 の追加
        case 'crash': pop(to, 'ぶつけ!', 'ult', -to.r - 14, now); sfx.crash(); shake(now, 2, 110); break;
        case 'friendly': pop(to, '同士討ち!', 'danger', -to.r - 14, now); break;
        case 'bumper': { const b = state.units[e.id]; rings.push({ x: b.x, y: b.y, r: b.r + 10, c: 'accent', t: now }); sfx.bumper(); break; }
        case 'lid': popups.push({ x: e.x, y: e.y - 20, text: 'おやつが出た', c: 'heal', t: now }); break;
        case 'pin': { const p = state.units[e.id]; rings.push({ x: p.x, y: p.y, r: 16, c: 'fg', t: now }); break; }
        case 'pinOpen': center('お皿を全部倒した: 柵が開いた!', 'ult', now, 16); break;
        case 'pickup': pop(to, 'おやつ', 'heal', -to.r - 16, now); sfx.pickup(); break;
        case 'split': pop(by, '二枚刃!', 'ult', -by.r - 16, now); break;
        case 'relay': pop(to, '玉突き!', 'accent', -to.r - 16, now); rings.push({ x: to.x, y: to.y, r: to.r + 10, c: 'accent', t: now }); break;
        case 'blast': rings.push({ x: e.x, y: e.y, r: e.r, c: 'ult', t: now, fill: true }); freeze(now, 60); shake(now, 3, 140); sfx.strong(); break;
        case 'mirror': rings.push({ x: by.x, y: by.y, r: by.r + 6, c: 'accent', t: now }); break;
        case 'bonusShot': center('場外: もう 1 手!', 'ult', now); sfx.bonus(); break;
        case 'trick': pop(to || { x: W / 2, y: 140 }, TRICK_JA[e.kind] || '', 'ult', -40, now, true); break;
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
    for (const p of state.pickups) { // 回復のおやつ
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = colors.snack; ctx.fill();
      ctx.fillStyle = colors.surface; ctx.font = '700 13px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', p.x, p.y + 0.5);
    }
    if (state.slickTurns > 0) { ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = colors.wet; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    const g = state.gaps;
    const seg = (x1, y1, x2, y2, open) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = open ? colors.gap : colors['table-edge'];
      ctx.setLineDash(open ? [6, 6] : []); ctx.lineWidth = open ? 3 : 8; ctx.stroke(); ctx.setLineDash([]);
    };
    const side = (name, len, fn) => {
      const list = g[name].concat(state.bonusGaps.filter((b) => b.side === name).map((b) => b.range));
      let c = 0;
      for (const gp of list.slice().sort((a, b) => a[0] - b[0])) { if (gp[0] > c) fn(c, gp[0], false); fn(Math.max(c, gp[0]), gp[1], true); c = Math.max(c, gp[1]); }
      if (c < len) fn(c, len, false);
    };
    side('top', W, (a, b, o) => seg(a, 0, b, 0, o)); side('bottom', W, (a, b, o) => seg(a, H, b, H, o));
    side('left', H, (a, b, o) => seg(0, a, 0, b, o)); side('right', H, (a, b, o) => seg(W, a, W, b, o));
    ctx.fillStyle = colors.gap; ctx.font = '700 11px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const gp of g.top) ctx.fillText('落ちる', (gp[0] + gp[1]) / 2, 12);
    for (const gp of g.bottom) ctx.fillText('落ちる', (gp[0] + gp[1]) / 2, H - 12);
    for (const gp of g.left) ctx.fillText('落', 12, (gp[0] + gp[1]) / 2);
    for (const gp of g.right) ctx.fillText('落', W - 12, (gp[0] + gp[1]) / 2);
    for (const b of state.bonusGaps) { // お皿で開いた柵
      const mid = (b.range[0] + b.range[1]) / 2, label = '開いた ' + b.turns;
      if (b.side === 'right') ctx.fillText(label, W - 30, mid); else if (b.side === 'left') ctx.fillText(label, 30, mid);
      else if (b.side === 'top') ctx.fillText(label, mid, 24); else ctx.fillText(label, mid, H - 24);
    }
    if (state.wind) { // 風向き
      const wx = state.wind.ax, wy = state.wind.ay, l = Math.sqrt(wx * wx + wy * wy) || 1, cx = W - 34, cy = H - 34;
      ctx.save(); ctx.strokeStyle = colors.boss; ctx.fillStyle = colors.boss; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - wx / l * 14, cy - wy / l * 14); ctx.lineTo(cx + wx / l * 14, cy + wy / l * 14); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + wx / l * 14, cy + wy / l * 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '700 10px ' + font; ctx.fillText('風', cx, cy - 22); ctx.restore();
    }
  }

  function drawTelegraphs(now) {
    if (state.phase === 'won' || state.phase === 'lost') return;
    for (const t of telegraphs(state)) {
      ctx.save(); ctx.fillStyle = colors.danger; ctx.strokeStyle = colors.danger;
      if (t.shape === 'circle') { ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill(); }
      else if (t.shape === 'band') { ctx.globalAlpha = 0.18; ctx.fillRect(t.x, t.y, t.w, t.h); }
      else if (t.shape === 'line') { ctx.globalAlpha = 0.6; ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
      else if (t.shape === 'gust' || t.shape === 'pull') { ctx.globalAlpha = 0.5; ctx.setLineDash([2, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      for (const id of t.foes || []) { // 敵の攻撃に巻き込まれる敵を光らせる(予告を「使う」ための表示)
        const o = state.units[id];
        ctx.save(); ctx.strokeStyle = colors.ult; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -now / 60;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 7, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = colors.ult; ctx.font = '700 9px ' + font; ctx.textAlign = 'center'; ctx.fillText('巻き込む', o.x, o.y + o.r + 26);
      }
    }
  }

  function drawObstacle(u) {
    const r = u.r;
    if (u.obj === 'bumper') {
      ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fillStyle = colors.surface; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = colors.accent; ctx.stroke();
    } else if (u.obj === 'pin') {
      ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fillStyle = colors.surface; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = colors.obstacle; ctx.stroke();
      ctx.beginPath(); ctx.arc(u.x, u.y, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    } else if (u.obj === 'lid') {
      ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fillStyle = colors.obstacle; ctx.fill();
      ctx.beginPath(); ctx.arc(u.x, u.y, 5, 0, Math.PI * 2); ctx.fillStyle = colors.surface; ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fillStyle = colors.obstacle; ctx.fill();
    }
    const m = OBJ_MARK[u.obj];
    if (m) { ctx.fillStyle = u.obj === 'bumper' ? colors.accent : colors.surface; ctx.font = '700 10px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m, u.x, u.obj === 'lid' ? u.y + 11 : u.y); }
  }

  function drawUnit(u, now) {
    if (u.kind === 'obstacle') return drawObstacle(u);
    const ally_ = u.side === 0, base = u.kind === 'boss' ? colors.boss : ally_ ? colors.ally : colors.enemy;
    const fg = ally_ ? colors['ally-fg'] : colors['enemy-fg'];
    if (u.kind === 'mini') { ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2); ctx.fillStyle = colors.ult; ctx.fill(); return; }
    const peel = u.kind !== 'boss' && u.hp * 2 <= u.maxHp;
    if (ally_ && u.id === state.active && state.phase === 'aim') {
      const pulse = aim && aim.pulse && now - aim.pulse < 160 ? 5 : 0; // 強さの段が変わった瞬間に一度ふくらむ
      ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 4 + pulse + 2 * Math.sin(now / 180), 0, Math.PI * 2); ctx.strokeStyle = armed ? colors.ult : colors.accent; ctx.lineWidth = 3; ctx.stroke();
    }
    const wob = peel ? Math.sin(now / 90 + u.id) * 1.2 : 0; // はがれかけは小さく揺れる
    ctx.globalAlpha = peel ? 0.6 : 1;
    ctx.beginPath(); ctx.arc(u.x + wob, u.y, u.r, 0, Math.PI * 2); ctx.fillStyle = base; ctx.fill();
    ctx.globalAlpha = 1;
    if (u.move === 'pierce' && ally_) { ctx.setLineDash([3, 3]); ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    if (u.hold) { ctx.strokeStyle = colors.fg; ctx.lineWidth = 3; ctx.stroke(); }
    if (u.shield > 0) { ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 3, 0, Math.PI * 2); ctx.strokeStyle = colors.accent; ctx.lineWidth = 2; ctx.stroke(); }
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

  // 予測線: 本番と同じ計算で、最初に当たる相手まで描く(双眼鏡なら 2 つ目まで)。
  // 当たる相手が味方なら、出るタッチ技の名前と、その技が狙う相手を示す。途中で落ちる・倒れるなら赤
  function drawAim(now) {
    const sh = shotFromAim(), u = state.units[state.active];
    if (!aim || !u) return;
    if (!sh) { // 取り消しの範囲
      ctx.fillStyle = colors.muted; ctx.font = '700 12px ' + font; ctx.textAlign = 'center'; ctx.fillText('ここで離すと取り消し', u.x, u.y - u.r - 18);
      $('hint').textContent = '引っぱって強さを決める(戻して離すと取り消し)';
      return;
    }
    const key = sh.dx + ',' + sh.dy + ',' + sh.power + ',' + (sh.ult ? 1 : 0) + ',' + state.shots + ',' + state.turnNo;
    if (!aim.pred || aim.pred.key !== key) aim.pred = predict(sh, u, key);
    const { pts, marks, bad, info } = aim.pred;
    const col = bad ? colors.danger : sh.ult ? colors.ult : colors.accent;
    ctx.fillStyle = col;
    for (const p of pts) { ctx.globalAlpha = Math.max(0.25, 1 - p[2] / 420); ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const m of marks) {
      const o = state.units[m.id]; if (!o || !o.alive) continue;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 5, 0, Math.PI * 2); ctx.strokeStyle = colors[m.c]; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      if (m.txt) { ctx.fillStyle = colors[m.c]; ctx.font = '700 11px ' + font; ctx.textAlign = 'center'; ctx.fillText(m.txt, o.x, o.y - o.r - 10); }
    }
    const len = Math.sqrt(sh.dx * sh.dx + sh.dy * sh.dy), k = (u.r + 8 + sh.power * 16) / len;
    ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x + sh.dx * k, u.y + sh.dy * k);
    ctx.strokeStyle = col; ctx.lineWidth = 2 + sh.power; ctx.stroke();
    $('hint').textContent = (bad ? '⚠ 落ちる・倒れる軌道です ・ ' : '') + '強さ ' + ['', '弱', '中', '強'][sh.power] + (sh.ult ? ' ・ 必殺' : '') + (info ? ' ・ ' + info : '') + '(戻して離すと取り消し)';
  }

  function predict(sh, u, key) {
    const c = cloneState(state);
    shoot(c, sh, { preview: true });
    const want = u.mods && u.mods.guide >= 2 ? 2 : 1;
    const pts = [], marks = []; let bad = false, contacts = 0, info = '', drawing = true;
    for (let i = 0; i < 360 && c.phase === 'resolving'; i++) {
      step(c);
      const cu = c.units[u.id];
      let touched = false;
      for (const e of c.events) {
        if ((e.t === 'fall' || e.t === 'ko') && e.id === u.id) bad = true;
        if (!drawing) continue;
        if (e.t === 'touch' && e.by !== u.id) { touched = true; info = TOUCH_JA[e.kind] + ' が出る'; marks.push({ id: e.by, c: 'accent' }); }
        else if (e.t === 'hit' && e.by === u.id && e.kind !== 'foe') { touched = true; marks.push({ id: e.to, c: 'danger', txt: '-' + e.dmg }); }
        else if (e.t === 'hit' && e.kind === 'touch') marks.push({ id: e.to, c: 'danger', txt: '-' + e.dmg });
        else if ((e.t === 'heal' || e.t === 'shield' || e.t === 'stun' || e.t === 'poison') && e.to !== undefined) marks.push({ id: e.to, c: 'accent' });
        else if (e.t === 'bumper' || e.t === 'lid' || e.t === 'pin') touched = true;
      }
      c.events = [];
      if (bad || !cu.alive) break;
      if (drawing) {
        if (touched) contacts++;
        if (i % 6 === 5 || (touched && contacts >= want)) pts.push([cu.x, cu.y, i]);
        if (contacts >= want && !touched) drawing = false; // 当たる相手までで線を止める
      }
      if (!drawing && i >= 120) break; // 線を止めたあとも 0.5 秒ぶんは「落ちないか」だけ確かめる
    }
    return { key, pts, marks, bad, info };
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
      ctx.font = '700 ' + (p.size || (p.big ? 20 : 13)) + 'px ' + font;
      ctx.lineWidth = 3; ctx.strokeStyle = colors.surface; ctx.strokeText(p.text, p.x, p.y - k * 22);
      ctx.fillStyle = colors[p.c] || colors.fg; ctx.fillText(p.text, p.x, p.y - k * 22);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dtMs = last ? now - last : 16; last = now;
    perf.frames++; if (dtMs > 25) perf.slow++; if (dtMs > perf.maxMs && perf.frames > 5) perf.maxMs = dtMs;
    if (state.phase === 'resolving') { // 撮影台の物差し(見るだけ。進み方は変えない)
      const held = now < pauseUntil || now < freezeUntil;
      if (fxm.finaleT !== null) fxm.finaleMs += dtMs;
      else if (held) { if (shotOpen) fxm.shotWait += dtMs; else fxm.enemyWait += dtMs; }
      if (now < slowUntil && fxm.finaleT === null) fxm.slowMs += dtMs * (1 - slowRate);
    }
    if (fxm.firePos && fxm.moveT === null) { const u = state.units[fxm.firePos[0]]; if (u && (u.x !== fxm.firePos[1] || u.y !== fxm.firePos[2])) fxm.moveT = now - fxm.fireT; }
    if (state.phase === 'resolving' && now >= pauseUntil && now >= freezeUntil) {
      const t0 = performance.now();
      acc += Math.min(dtMs, 50) / 1000 * (now < slowUntil ? slowRate : 1);
      let n = 0;
      while (acc >= DT && state.phase === 'resolving' && n < 16) {
        step(state); acc -= DT; n++;
        if (state.events.length) { consumeEvents(now); if (now < pauseUntil || now < freezeUntil) break; }
        if (shotOpen && !state.motion) flushShot(now);
      }
      const sm = performance.now() - t0; if (sm > perf.simMsMax) perf.simMsMax = sm;
      if (state.phase !== 'resolving') { acc = 0; consumeEvents(now); flushShot(now); refresh(); if (state.phase === 'won' || state.phase === 'lost') finish(); else if (replaying) finish(); }
    }
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (now < shakeUntil) { const a = shakeAmp * (shakeUntil - now) / 250; ctx.translate(Math.sin(now / 17) * a, Math.cos(now / 23) * a); }
    drawTable();
    drawTelegraphs(now);
    for (const u of state.units) if (u.alive) drawUnit(u, now);
    if (state.phase === 'aim' && !replaying) drawAim(now);
    drawFx(now);
    drawDemo(now);
    fxm.maxFx = Math.max(fxm.maxFx, rings.length + popups.length + bolts.length);
    if (!MANUAL) requestAnimationFrame(frame);
  }

  readColors();
  { // 撮影台: 卓に書いた文字(大きさ・色)を数える。logText のときだけ
    const fill = ctx.fillText.bind(ctx);
    ctx.fillText = (t, x, y, w) => { if (fxm.logText) { const k = ctx.font.match(/(\d+(?:\.\d+)?)px/)[1] + '|' + ctx.fillStyle + '|' + t; fxm.texts.set(k, (fxm.texts.get(k) || 0) + 1); } return w === undefined ? fill(t, x, y) : fill(t, x, y, w); };
  }
  globalThis.__fx = {
    scene: SCENE ? SCENE.id : null,
    scenes: typeof SCENES !== 'undefined' ? SCENES.map((s) => ({ id: s.id, ja: s.ja, kind: s.kind, tier: s.tier })) : [],
    colors: () => Object.assign({}, colors),
    fire() { const inp = SCENE && SCENE_INPUTS[SCENE.id]; if (!inp || state.phase !== 'aim') return false; aim = null; doShot(Object.assign({}, inp)); return true; },
    advance(ms) { const n = Math.max(1, Math.round(ms / (1000 / 60))); for (let k = 0; k < n; k++) { manualNow += 1000 / 60; frame(manualNow); } return this.info(); },
    hold(ms) { const now = MANUAL ? manualNow : performance.now(); pauseUntil = Math.max(pauseUntil, now + ms); }, // 検査器の自己検査用(わざと待たせる)
    info: () => ({ phase: state.phase, motion: !!state.motion, overlay: !$('overlay').hidden, shotOpen, chain: state.chain, shots: state.shots }),
    metrics: () => ({ shotWait: Math.round(fxm.shotWait), enemyWait: Math.round(fxm.enemyWait), slowMs: Math.round(fxm.slowMs), finaleMs: Math.round(fxm.finaleMs),
                      releaseToMove: fxm.moveT === null ? null : Math.round(fxm.moveT), maxFx: fxm.maxFx, events: fxm.events.slice() }),
    textLog(on) { fxm.logText = on; if (on) fxm.texts.clear(); return Array.from(fxm.texts.entries()).map(([k, n]) => { const [px, fill, t] = k.split('|'); return { px: +px, fill, t, n }; }); },
    lum() { // 卓の平均の明るさ(0〜1)。明滅を数えるため
      const c = document.createElement('canvas'); c.width = 24; c.height = 35; const g = c.getContext('2d'); g.drawImage(cv, 0, 0, 24, 35);
      const d = g.getImageData(0, 0, 24, 35).data; let s = 0;
      for (let k = 0; k < d.length; k += 4) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; s += 0.2126 * f(d[k]) + 0.7152 * f(d[k + 1]) + 0.0722 * f(d[k + 2]); }
      return s / (d.length / 4);
    },
  };
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', resize);
  newGame(); resize();
  if (SCENE && SCENE.kind === 'state') { // 止まった状態の場面
    const inp = SCENE_INPUTS[SCENE.id];
    if (SCENE.armed && !(ST && ST[2])) armed = true;
    if (SCENE.drag && inp) { aim = { sx: 0, sy: 0, cx: 0, cy: 0, pulse: 0, exact: inp }; }
    refresh();
  }
  if (!MANUAL) requestAnimationFrame(frame);
  else {
    frame(manualNow);
    if (ST && ST[1]) { // ?state= の瞬間まで進めて止める
      const [kind, arg] = ST[1].split(':');
      if (kind !== 'end' || SCENE.kind === 'shot') globalThis.__fx.fire();
      for (let k = 0; k < 60 * 30; k++) {
        globalThis.__fx.advance(1000 / 60);
        if (kind === 'ms' && k * 1000 / 60 >= +arg) break;
        if (kind === 'chain' && state.chain >= +arg) break;
        if (kind === 'ev' && fxm.events.some((e) => e[1] === arg)) break;
        if (kind === 'end' && !$('overlay').hidden) break;
      }
    }
  }
})();
