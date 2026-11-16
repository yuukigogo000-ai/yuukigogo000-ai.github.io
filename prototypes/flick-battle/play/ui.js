// はじきバトル 仮の戦闘画面(結果を決めるのは engine.js だけ。ここは見せるだけ)
// build.mjs が engine.js / data.js / ai.js と一緒に 1 つのスクリプトにまとめる。
// 2026-11-16: 手触りの演出(reports/はじきバトルの進化案.md の案 M〜U)を足した
// 2026-11-16: 演出を指示表(fx/director.js)で動かす形に作り替えた。描画は fx/render.js、音は fx/audio.js(FX_SPEC.md §8)
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
  let pauseUntil = 0, freezeUntil = 0, acc = 0, last = 0, shotOpen = false;
  const perf = { frames: 0, slow: 0, maxMs: 0, simMsMax: 0, aiMs: 0 };
  globalThis.__flickPerf = perf;
  globalThis.__flickState = () => state;
  const TS = FXT.text.sizes; // 文字の 5 段(1 特大・2 大・3 中・4 小・5 最小)。卓の中の文字はこの 5 つだけ

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
  const fxm = { shotWait: 0, enemyWait: 0, slowMs: 0, finaleMs: 0, finaleT: null, fireT: null, moveT: null, firePos: null, maxFx: 0, texts: new Map(), logText: false, events: [], sounds: [] };

  // ---- 設定(この端末だけに覚える。読めなくても動く) --------------------------
  const store = { get(k, d) { try { const v = localStorage.getItem('flick.' + k); return v === null ? d : v; } catch (e) { return d; } },
                  set(k, v) { try { localStorage.setItem('flick.' + k, v); } catch (e) { /* 覚えられなくても続ける */ } } };
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('fx').value = store.get('fx', reduce ? 'low' : 'full');
  $('snd').value = store.get('snd', 'on');
  const fxKey = () => (FX[$('fx').value] === undefined ? 'full' : $('fx').value);
  const fx = () => FX[fxKey()];
  const R = createFxRender({ width: W, height: H }); // 演出の描画(fx/render.js)
  $('fx').addEventListener('change', () => { store.set('fx', $('fx').value); R.setLevel(fxKey(), reduce); });
  $('snd').addEventListener('change', () => store.set('snd', $('snd').value));
  R.setLevel(fxKey(), reduce);

  // ---- 音(最終版の部品 fx/audio.js。すべて端末の中で作る。音源ファイルは使わない) ----------------
  const AUD = createAudio({});
  let shotStep = 0;
  // 同じ刻みに同じ音が重なったら 2 つまで(ぶつけの両方・花火の連鎖などで音が積み上がって割れないように)
  let sameKey = '', sameN = 0;
  const play = (id, q) => {
    const key = shotStep + ':' + id; if (key === sameKey) { if (++sameN >= 2) return; } else { sameKey = key; sameN = 0; }
    if (fxm.sounds.length < 2000) fxm.sounds.push([shotStep, id, q && (q.n || q.k2 || q.special || (q.ms && Math.round(q.ms)))]);
    if ($('snd').value === 'on') AUD.play(id, q);
  };
  window.addEventListener('pointerdown', () => AUD.unlock(), { passive: true }); // iPhone は最初のタップの中で音を準備する(2 回目からは何もしない)
  // 振動はおまけ(iPhone のブラウザでは使えない。音と見た目だけで手応えが分かるように作ってある)
  const buzz = (ms) => { if (fx() > 0 && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* なし */ } } };

  // ---- 1 手の演出: 離した瞬間に台本(fx/script.js)で 1 手を先に計算し、指示表(fx/director.js)を作る -----
  // 画面は本物の盤面を 1 刻みずつ進め、同じ刻みの指示を実行するだけ(同じ手なら必ず同じ結果になる)
  let cueAt = new Map(), preAt = new Map(), slowWin = null, zoomEnd = -1, memory = {}, ff = 1, skipping = false, longStopUntil = 0, cutinSeen = 0;
  function startShot(st, input) {
    shotStep = 0; cueAt = new Map(); preAt = new Map(); slowWin = null; zoomEnd = -1; skipping = false;
    let plan = null;
    try { const sc = scriptShot(st, input); if (sc) plan = planShot(sc, { level: fxKey(), fast: false, reduceMotion: reduce, memory }); } catch (e) { plan = null; }
    if (!plan) return [];
    memory = plan.memory;
    const now = [];
    for (const c of plan.cues) {
      if (c.i < 0) { now.push(c); continue; }
      const pre = c.pre || (c.k === 'body' && c.anim === 'windup');
      const m = pre ? preAt : cueAt;
      if (!m.has(c.i)) m.set(c.i, []);
      m.get(c.i).push(c);
    }
    return now; // 離した瞬間に出す指示(必殺の閃光など)
  }
  function runCue(c, now) {
    const stopMul = ff > 1 ? FXT.fastForward.stopsMul : 1;
    switch (c.k) {
      case 'stop':
        if (skipping) break;
        freezeUntil = Math.max(freezeUntil, now + c.ms * stopMul);
        if (c.tier >= 3 || c.why === 'finale') longStopUntil = freezeUntil;
        if (c.why === 'finale') fxm.finaleT = now;
        break;
      case 'pause': if (!skipping) pauseUntil = Math.max(pauseUntil, now + c.ms * stopMul); break;
      case 'shake': R.shake(c); break;
      case 'text': R.text(c, now); break;
      case 'sound': play(c.id, c.id === 'riser' ? { ms: c.ms / (skipping ? 6 : ff), top: c.top } : c); break;
      case 'part': R.part(c, state.units); break;
      case 'body': {
        const u = state.units[c.id];
        if (u && (c.anim === 'ringOut' || c.anim === 'shatter')) c = Object.assign({}, c, { unit: { r: u.r, color: u.kind === 'boss' ? colors.boss : u.side === 0 ? colors.ally : colors.enemy, fg: colors[u.side === 0 ? 'ally-fg' : 'enemy-fg'], label: u.kind === 'boss' ? u.name : (SHORT[u.lineage] || u.name.slice(0, 2)) } });
        R.body(c);
        break;
      }
      case 'dim': R.dim(c); break;
      case 'buzz': buzz(c.ms); break;
      case 'slow': if (!skipping) slowWin = { i0: c.i0, i1: c.i1, rate: c.rate }; break;
      case 'zoom': if (!skipping) { zoomEnd = c.i1; R.zoom(c); } break;
      default: break;
    }
  }
  /** いまの進む速さ(早送り × 決着のスロー) */
  function rateNow() {
    let r = skipping ? 6 : ff;
    if (slowWin) { if (shotStep > slowWin.i1) slowWin = null; else if (shotStep >= slowWin.i0) r *= slowWin.rate; }
    if (zoomEnd >= 0 && shotStep > zoomEnd) { zoomEnd = -1; R.zoomOut(); }
    return r;
  }

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bg', 'surface', 'fg', 'muted', 'line', 'table', 'table-edge', 'gap', 'ally', 'ally-fg', 'enemy', 'enemy-fg', 'boss', 'obstacle',
                     'accent', 'danger', 'heal', 'ult', 'ult-fg', 'wet', 'mat', 'stove', 'poison', 'snack'])
      colors[k] = cs.getPropertyValue('--' + k).trim();
    font = getComputedStyle(document.body).fontFamily;
    const th = document.documentElement.getAttribute('data-theme');
    const isDark = th === 'dark' || (!th && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    R.setColors(colors, isDark, font);
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
    R.clear(); aim = null; armed = false; busy = false; replaying = false; lastShot = null;
    acc = 0; pauseUntil = 0; freezeUntil = 0; shotOpen = false; memory = {}; cutinSeen = 0; slowWin = null; skipping = false; threat = null; trails.clear();
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
    $('status').textContent = state.shots + ' 手 ・ ' + state.turnNo + ' ターン目' + (ff > 1 ? ' ・ 2 倍速' : '');
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
      chip.addEventListener('click', () => { play('ui'); openInfo(a.id); });
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
    if (state.phase === 'resolving') hint = '卓をタップで ' + (ff > 1 ? 'ふつうの速さ' : '2 倍速') + '(決着とゲージ割りは飛ばせる)';
    if (replaying) hint = '決め手を再生中';
    $('hint').textContent = hint;
    $('auto').disabled = state.phase !== 'aim' || busy;
  }

  function finish() {
    const won = state.phase === 'won';
    if (!replaying) play(won ? 'win' : 'lose');
    if (won) { let k = 0; for (const u of state.units) if (u.alive && u.side === 0 && u.kind === 'ally') R.body({ id: u.id, anim: 'hop', delay: (k++) * FXT.body.winHop.staggerMs }); } // 勝ち: 残った駒が順に跳ねる(負けは動かさない)
    R.zoomOut();
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
  const nowMs = () => (MANUAL ? manualNow : performance.now());
  cv.addEventListener('pointerdown', (e) => {
    if (R.cutting) R.skipCut(); // カットインはタップで飛ばせる
    if (state.phase === 'resolving') { // 動いている最中: 決着・ゲージ割りは飛ばす、それ以外は 2 倍速の切り替え
      const now = nowMs();
      if (slowWin || now < longStopUntil) { skipping = true; slowWin = null; freezeUntil = 0; pauseUntil = 0; longStopUntil = 0; R.zoomOut(); }
      else { ff = ff > 1 ? 1 : FXT.fastForward.rate; refresh(); }
      e.preventDefault(); return;
    }
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
    if (p !== lastPower) { if (p > 0) play('step', { p }); else if (lastPower > 0) play('cancel'); aim.pulse = nowMs(); lastPower = p; } // 強さの段が変わった瞬間の手応え
  });
  function doShot(sh) {
    lastShot = { st: cloneState(state), input: sh };
    const me = state.units[state.active]; fxm.fireT = nowMs(); fxm.moveT = null; fxm.firePos = me ? [me.id, me.x, me.y] : null;
    const first = startShot(state, sh);
    if (shoot(state, sh)) {
      armed = false; shotOpen = true; play('shoot', { p: sh.power });
      const L = Math.hypot(sh.dx, sh.dy) || 1;
      if (me) R.body({ id: me.id, anim: 'release', nx: sh.dx / L, ny: sh.dy / L }); // 1〜2 コマで伸びて、ばねで戻る
      state.events = [];
      const now = nowMs(); for (const c of first) runCue(c, now);
      refresh();
    }
  }
  cv.addEventListener('pointerup', () => { const sh = shotFromAim(); const was = !!aim; aim = null; if (sh && state.phase === 'aim') doShot(sh); else { if (was) play('cancel'); refresh(); } });
  cv.addEventListener('pointercancel', () => { aim = null; });

  $('ult').addEventListener('click', () => {
    if (state.phase !== 'aim' || !canUlt(state)) return;
    play('ui'); armed = !armed; refresh();
    const u = state.units[state.active];
    if (armed && u) { R.cutin({ name: u.name, ult: ULT_JA[u.ult], ms: cutinSeen++ ? FXT.parts.cutin.repeatMs : FXT.parts.cutin.firstMs, x: u.x, y: u.y }); play('riser', { ms: 260, top: 1568 }); } // 構えた瞬間にカットイン(離した後には挟まない)
  });
  $('auto').addEventListener('click', () => {
    if (state.phase !== 'aim' || busy) return;
    busy = true; $('hint').textContent = '考え中…'; refresh();
    setTimeout(() => { const t0 = performance.now(); const b = bestShot(state); perf.aiMs = performance.now() - t0; busy = false; doShot(b); }, 30);
  });
  for (const id of ['reset', 'again']) $(id).addEventListener('click', () => { play('ui'); newGame(); });
  for (const id of ['stage', 'team']) $(id).addEventListener('change', newGame);
  // 決め手の再生: 最後の 1 手の直前の盤面から、同じ入力をもう一度流す(同じ手なら必ず同じ結果になる)
  $('replay').addEventListener('click', () => {
    if (!lastShot) return;
    play('ui');
    state = cloneState(lastShot.st); state.label = lastShot.st.label;
    replaying = true; busy = true; R.clear(); acc = 0;
    $('overlay').hidden = true;
    const first = startShot(state, lastShot.input); shoot(state, lastShot.input); shotOpen = true; state.events = [];
    const now = nowMs(); for (const c of first) runCue(c, now);
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
  $('dex').addEventListener('click', () => { play('ui'); openDex(); });
  $('infoClose').addEventListener('click', () => { play('ui'); $('info').hidden = true; demo = null; });
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

  // ---- 予想ダメージと前兆(このまま何もしなければ、次の敵の番に味方が受けるダメージ) ------------
  let threat = null;
  function threatNow() {
    const key = state.shots + ':' + state.turnNo + ':' + state.active;
    if (!threat || threat.key !== key) { threat = { key, v: state.phase === 'aim' ? threatPreview(state) : { dmg: {}, ko: [], by: {} } }; }
    return threat.v;
  }
  /** 味方を倒す・大きく削る攻撃をする敵(1 ターン前からゆっくり脈打つ) */
  function lethalFoes(tv) {
    const out = new Set();
    let minHp = Infinity; for (const u of state.units) if (u.alive && u.side === 0 && u.kind === 'ally') minHp = Math.min(minHp, u.maxHp);
    for (const id of Object.keys(tv.by)) if (tv.ko.length || tv.by[id] >= minHp * 0.3) out.add(+id);
    return out;
  }

  // ---- 描画 ------------------------------------------------------------------
  function drawTable() {
    ctx.fillStyle = colors.table; ctx.fillRect(0, 0, W, H);
    for (const p of state.patches) {
      ctx.save(); ctx.globalAlpha = 0.34; ctx.fillStyle = colors[p.kind === 'wet' ? 'wet' : p.kind === 'mat' ? 'mat' : 'stove'];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = colors.fg; ctx.globalAlpha = 0.6; ctx.font = '700 ' + TS[5] + 'px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'wet' ? 'すべる' : p.kind === 'mat' ? 'とまる' : 'あつい', p.x, p.y); ctx.globalAlpha = 1;
    }
    for (const p of state.pickups) { // 回復のおやつ
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = colors.snack; ctx.fill();
      ctx.fillStyle = colors.surface; ctx.font = '700 ' + TS[4] + 'px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', p.x, p.y + 0.5);
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
    ctx.fillStyle = colors.gap; ctx.font = '700 ' + TS[5] + 'px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
      ctx.font = '700 ' + TS[5] + 'px ' + font; ctx.fillText('風', cx, cy - 22); ctx.restore();
    }
  }

  // 予告: 点滅させず、ゆっくり濃淡を変える(約 1.2 秒。動きを減らす設定・演出なしでは止める)
  function drawTelegraphs(now) {
    if (state.phase === 'won' || state.phase === 'lost') return;
    const breathe = !reduce && fx() > 0 ? 0.5 + 0.5 * Math.sin(now / 1200 * Math.PI * 2) : 0.5;
    for (const t of telegraphs(state)) {
      ctx.save(); ctx.fillStyle = colors.danger; ctx.strokeStyle = colors.danger;
      if (t.shape === 'circle') { ctx.globalAlpha = 0.13 + 0.08 * breathe; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill(); }
      else if (t.shape === 'band') { ctx.globalAlpha = 0.13 + 0.08 * breathe; ctx.fillRect(t.x, t.y, t.w, t.h); }
      else if (t.shape === 'line') { ctx.globalAlpha = 0.6; ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
      else if (t.shape === 'gust' || t.shape === 'pull') { ctx.globalAlpha = 0.5; ctx.setLineDash([2, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      for (const id of t.foes || []) { // 敵の攻撃に巻き込まれる敵を光らせる(予告を「使う」ための表示)
        const o = state.units[id];
        ctx.save(); ctx.strokeStyle = colors.ult; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -now / 60;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 7, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = colors.ult; ctx.font = '700 ' + TS[5] + 'px ' + font; ctx.textAlign = 'center'; ctx.fillText('巻き込む', o.x, o.y + o.r + 26);
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

  // ---- 駒の見た目(形を変える動き) ------------------------------------------------
  const trails = new Map(); // 速いときの残像(駒 id → 直近の位置)
  function unitLook(u) { return { base: u.kind === 'boss' ? colors.boss : u.side === 0 ? colors.ally : colors.enemy, fg: u.side === 0 ? colors['ally-fg'] : colors['enemy-fg'] }; }
  /** 駒の体(変形あり)。体力の棒・カウントなどの情報は drawInfo で、演出より手前に描く */
  function drawBody(u, now, lethal) {
    if (u.kind === 'obstacle') return drawObstacle(u);
    const L = FXT.level[fxKey()], Bd = FXT.body;
    if (u.kind === 'mini') { ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2); ctx.fillStyle = colors.ult; ctx.fill(); return; }
    const ally_ = u.side === 0, look = unitLook(u);
    const peel = u.kind !== 'boss' && u.hp * 2 <= u.maxHp;
    const sp = Math.hypot(u.vx, u.vy);
    // 残像(速いときだけ。動きを減らす設定では出さない)
    if (L.afterimage && !reduce) {
      let tr = trails.get(u.id); if (!tr) { tr = []; trails.set(u.id, tr); }
      if (sp > Bd.afterimage.fromSpeed) { tr.unshift([u.x, u.y]); if (tr.length > 7) tr.pop(); } else if (tr.length) tr.pop();
      for (let k = 0; k < Bd.afterimage.count; k++) { const p = tr[(k + 1) * 2]; if (!p) break; ctx.globalAlpha = Bd.afterimage.alpha[k]; ctx.beginPath(); ctx.arc(p[0], p[1], u.r, 0, Math.PI * 2); ctx.fillStyle = look.base; ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // 番の駒の輪(ゆっくり脈打つ。強さの段が変わった瞬間に一度ふくらむ)
    if (ally_ && u.id === state.active && state.phase === 'aim') {
      const pulse = aim && aim.pulse && now - aim.pulse < Bd.stepPulse.ms ? Bd.stepPulse.px : 0;
      ctx.beginPath(); ctx.arc(u.x, u.y, u.r + Bd.turnRing.gap + pulse + Bd.turnRing.amp * Math.sin(now / Bd.turnRing.periodMs * Math.PI * 2), 0, Math.PI * 2);
      ctx.strokeStyle = armed ? colors.ult : colors.accent; ctx.lineWidth = Bd.turnRing.width; ctx.stroke();
    }
    const b = R.bodyOf(u.id);
    ctx.save();
    const wob = peel ? Math.sin(now / 90 + u.id) * Bd.peel.wobblePx : 0; // はがれかけは小さく揺れる
    ctx.translate(u.x + b.ox + wob, u.y + b.oy);
    ctx.scale(b.s, b.s);
    if (b.sx !== 1 || b.sy !== 1) { ctx.rotate(b.ang); ctx.scale(b.sx, b.sy); ctx.rotate(-b.ang); }
    // 生きた変形: 引っぱり中のつぶれ / 動いている最中の伸び / 番の駒と狙う敵の呼吸 / 前兆の脈
    let ls = 1, la = 0;
    if (ally_ && u.id === state.active && state.phase === 'aim' && aim && !aim.exact) {
      const dx = aim.cx - aim.sx, dy = aim.cy - aim.sy, p = powerOf(Math.hypot(dx, dy));
      ls = Bd.dragSquash[p] - (aim.pulse && now - aim.pulse < 90 ? Bd.stepBounce : 0); la = Math.atan2(dy, dx);
    } else if (state.phase === 'resolving' && sp > 60) {
      ls = 1 + (Bd.speedStretch.max - 1) * Math.min(1, sp / Bd.speedStretch.atSpeed); la = Math.atan2(u.vy, u.vx);
    }
    if (ls !== 1) { ctx.rotate(la); ctx.scale(ls, 1 / ls); ctx.rotate(-la); }
    if (L.breathe && !reduce && state.phase === 'aim') {
      const target = aim && aim.pred && aim.pred.marks.find((m) => m.c === 'danger');
      if ((ally_ && u.id === state.active) || (target && target.id === u.id)) { const k = 1 + Bd.breathe.amp * Math.sin(now / Bd.breathe.periodMs * Math.PI * 2 + u.id); ctx.scale(k, 1 / k); }
    }
    if (lethal && lethal.has(u.id) && !reduce) { const k = 1 + 0.045 * Math.max(0, Math.sin(now / 1200 * Math.PI * 2)); ctx.scale(k, k); }
    ctx.globalAlpha = peel ? Bd.peel.alpha : 1;
    ctx.beginPath(); ctx.arc(0, 0, u.r, 0, Math.PI * 2); ctx.fillStyle = look.base; ctx.fill();
    ctx.globalAlpha = 1;
    if (u.move === 'pierce' && ally_) { ctx.setLineDash([3, 3]); ctx.strokeStyle = look.fg; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    if (u.hold) { ctx.strokeStyle = colors.fg; ctx.lineWidth = 3; ctx.stroke(); }
    if (u.shield > 0) { ctx.beginPath(); ctx.arc(0, 0, u.r + 3, 0, Math.PI * 2); ctx.strokeStyle = colors.accent; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = look.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + (u.kind === 'boss' ? TS[3] : TS[4]) + 'px ' + font; // 駒の大きさに比例させず、文字の段に寄せる
    ctx.fillText(u.kind === 'boss' ? u.name : (SHORT[u.lineage] || u.name.slice(0, 2)), 0, 0);
    ctx.restore();
  }
  /** 情報(体力の棒・カウント・特性・ゲージ・予想ダメージ)。演出より手前に描いて、演出に隠させない */
  function drawInfo(u, tv) {
    if (u.kind === 'obstacle' || u.kind === 'mini') return;
    const ally_ = u.side === 0;
    const ratio = Math.max(0, u.hp / u.maxHp), w = Math.max(30, u.r * 1.8), hx = u.x - w / 2, hy = u.y + u.r + 3;
    ctx.fillStyle = colors.line; ctx.fillRect(hx, hy, w, 6);
    ctx.fillStyle = ratio > 0.5 ? colors.heal : colors.danger; ctx.fillRect(hx, hy, w * ratio, 6);
    ctx.fillStyle = colors.fg; ctx.fillRect(hx + w / 2 - 0.5, hy - 1, 1, 8); // 半分の目印(ここを切ると落とせる)
    ctx.font = '700 ' + TS[5] + 'px ' + font; ctx.lineWidth = 3; ctx.strokeStyle = colors.table; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = String(Math.max(0, u.hp)) + (u.poison > 0 ? ' 毒' + u.poison : '');
    ctx.strokeText(label, u.x, hy + 13); ctx.fillStyle = u.poison > 0 ? colors.poison : colors.fg; ctx.fillText(label, u.x, hy + 13);
    if (u.kind === 'boss') { // 残りのゲージ
      for (let i = u.gaugeIdx; i < u.gauges.length; i++) { ctx.beginPath(); ctx.arc(u.x - (u.gauges.length - 1) * 6 + i * 12, u.y - u.r - 8, 4, 0, Math.PI * 2); ctx.fillStyle = colors.boss; ctx.fill(); }
    }
    if (!ally_) { // カウント
      const bx = u.x + u.r * 0.72, by = u.y - u.r * 0.72, soon = u.count === 1 && u.stagger === 0;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fillStyle = soon ? colors.danger : colors.surface; ctx.fill();
      ctx.strokeStyle = colors.fg; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = soon ? colors.surface : colors.fg; ctx.font = '700 ' + TS[4] + 'px ' + font; ctx.fillText(u.stagger > 0 ? '…' : String(u.count), bx, by + 0.5);
      if (u.trait) { ctx.font = '700 ' + TS[5] + 'px ' + font; ctx.fillStyle = colors.fg; ctx.fillText(TRAIT_JA[u.trait], u.x, u.y - u.r - 6); }
    } else {
      if (u.ultCharge >= u.ultNeed) { ctx.beginPath(); ctx.arc(u.x + u.r * 0.72, u.y - u.r * 0.72, 6, 0, Math.PI * 2); ctx.fillStyle = colors.ult; ctx.fill(); } // 必殺が使える
      const d = tv && tv.dmg[u.id];
      if (d && state.phase === 'aim') { // 予想ダメージ(このまま何もしなければ、次の敵の番に受ける)
        const ko = tv.ko.indexOf(u.id) >= 0, s = '-' + d + (ko ? ' たおれる' : '');
        ctx.font = '700 ' + TS[4] + 'px ' + font; ctx.lineWidth = 3; ctx.strokeStyle = colors.surface; ctx.strokeText(s, u.x, u.y - u.r - 12);
        ctx.fillStyle = colors.danger; ctx.fillText(s, u.x, u.y - u.r - 12);
      }
    }
  }

  // 予測線: 本番と同じ計算で、最初に当たる相手まで描く(双眼鏡なら 2 つ目まで)。
  // 当たる相手が味方なら、出るタッチ技の名前と、その技が狙う相手を示す。途中で落ちる・倒れるなら赤
  function drawAim() {
    const sh = shotFromAim(), u = state.units[state.active];
    if (!aim || !u) return;
    if (!sh) { // 取り消しの範囲
      ctx.fillStyle = colors.muted; ctx.font = '700 ' + TS[4] + 'px ' + font; ctx.textAlign = 'center'; ctx.fillText('ここで離すと取り消し', u.x, u.y - u.r - 18);
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
      if (m.txt) { ctx.fillStyle = colors[m.c === 'danger' ? 'fg' : m.c]; ctx.font = '700 ' + TS[4] + 'px ' + font; ctx.textAlign = 'center'; ctx.fillText(m.txt, o.x, o.y - o.r - 10); }
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

  function frame(now) {
    const dtMs = last ? now - last : 16; last = now;
    perf.frames++; if (dtMs > 25) perf.slow++; if (dtMs > perf.maxMs && perf.frames > 5) perf.maxMs = dtMs;
    if (state.phase === 'resolving') { // 撮影台の物差し(見るだけ。進み方は変えない)
      const held = now < pauseUntil || now < freezeUntil;
      if (fxm.finaleT !== null) fxm.finaleMs += dtMs;
      else if (held) { if (shotOpen) fxm.shotWait += dtMs; else fxm.enemyWait += dtMs; }
      if (slowWin && shotStep >= slowWin.i0 && fxm.finaleT === null) fxm.slowMs += dtMs * (1 - slowWin.rate);
    }
    if (fxm.firePos && fxm.moveT === null) { const u = state.units[fxm.firePos[0]]; if (u && (u.x !== fxm.firePos[1] || u.y !== fxm.firePos[2])) fxm.moveT = now - fxm.fireT; }
    if (state.phase === 'resolving' && now >= pauseUntil && now >= freezeUntil) {
      const t0 = performance.now();
      acc += Math.min(dtMs, 50) / 1000 * rateNow();
      let n = 0;
      while (acc >= DT && state.phase === 'resolving' && n < (skipping ? 120 : 16)) {
        const pre = preAt.get(shotStep);
        if (pre) { preAt.delete(shotStep); for (const c of pre) runCue(c, now); if (now < pauseUntil || now < freezeUntil) break; }
        step(state); acc -= DT; n++;
        for (const e of state.events) if (fxm.events.length < 4000) fxm.events.push([Math.round(now - (fxm.fireT || now)), e.t, e.n]);
        state.events = [];
        const list = cueAt.get(shotStep); shotStep++;
        if (list) for (const c of list) runCue(c, now);
        if (shotOpen && !state.motion) shotOpen = false;
        if (now < pauseUntil || now < freezeUntil) break;
        rateNow();
      }
      const sm = performance.now() - t0; if (sm > perf.simMsMax) perf.simMsMax = sm;
      if (state.phase !== 'resolving') { acc = 0; skipping = false; slowWin = null; refresh(); if (state.phase === 'won' || state.phase === 'lost') finish(); else if (replaying) finish(); }
    }
    R.update(Math.min(dtMs, 50));
    const tv = state.phase === 'aim' ? threatNow() : null, lethal = tv ? lethalFoes(tv) : null;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cam = R.camera();
    ctx.save();
    ctx.translate(cam.tx, cam.ty);
    if (cam.s !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy); }
    drawTable();
    R.drawUnder(ctx);            // 暗転・敵の攻撃の形・煙・場外と撃破の片
    drawTelegraphs(now);
    for (const u of state.units) if (u.alive) drawBody(u, now, lethal);
    if (state.phase === 'aim' && !replaying) drawAim();
    R.drawOver(ctx);             // 輪・光・火花・粒
    for (const u of state.units) if (u.alive) drawInfo(u, tv); // 情報は演出より手前
    R.drawTexts(ctx);
    ctx.restore();
    R.drawScreen(ctx);           // 集中線・カットイン(画面に固定)
    if (ff > 1 && state.phase === 'resolving') { ctx.fillStyle = colors.fg; ctx.globalAlpha = 0.7; ctx.font = '700 ' + TS[4] + 'px ' + font; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('×2', W - 8, 8); ctx.globalAlpha = 1; }
    drawDemo(now);
    const st = R.stats(); fxm.maxFx = Math.max(fxm.maxFx, st.particles + st.rings + st.texts);
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
    fxstate: () => ({ cam: R.camera(), cutting: R.cutting, ff, skipping, slow: !!slowWin, stats: R.stats(), body: state ? R.bodyOf(state.active) : null }), // 撮影台: 演出の中の状態
    info: () => ({ phase: state.phase, motion: !!state.motion, overlay: !$('overlay').hidden, shotOpen, chain: state.chain, shots: state.shots }),
    metrics: () => ({ shotWait: Math.round(fxm.shotWait), enemyWait: Math.round(fxm.enemyWait), slowMs: Math.round(fxm.slowMs), finaleMs: Math.round(fxm.finaleMs),
                      releaseToMove: fxm.moveT === null ? null : Math.round(fxm.moveT), maxFx: fxm.maxFx, events: fxm.events.slice(), sounds: fxm.sounds.slice() }),
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
  // 起動の直後に、音の準備と、先読み・割り振りの初回の重さを済ませておく(最初の 1 手で画面が止まらないように)
  setTimeout(() => {
    AUD.prepare();
    try { const w = cloneState(state); if (w.phase === 'aim') { const sc = scriptShot(w, { dx: 0, dy: -1, power: 2 }); if (sc) planShot(sc, { memory: {} }); } } catch (e) { /* 試しの計算なので失敗しても続ける */ }
  }, 50);
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
