// ペンギンずもう — 画面と入力(結果を決めるのは core.js / run.js。ここは見せるだけ)
// build.mjs が core.js / solver.js / run.js と一緒に 1 つのスクリプトにまとめる。
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), wrap = $('wrap'), panel = $('panel');
  const SAVE_KEY = 'penguin-sumo.v1';
  const DIR_JA = { up: '上', down: '下', left: '左', right: '右' };
  const SHORT = { crab: 'カニ', seal: 'アザ', gullH: 'カモ', gullV: 'カモ', bear: 'クマ', walrus: 'セイ', bomb: '爆', dosukoi: 'ドス', yukioroshi: 'ユキ', nushi: 'ヌシ' };
  const WHY_JA = { crab: 'カニのハサミ', seal: 'アザラシの突進', walrus: 'セイウチの突進', gull: 'カモメの雪玉', bear: 'シロクマの氷割り', bomb: 'ばくだん',
                   dosukoi: 'ドスコイの突進', fall: '穴・場外に落ちた', melt: '氷がとけた' };

  let run = null, fl = null, state = null, prev = null;   // ラン、いまのフロア、盤面、1 手前の盤面
  let sprites = {}, queue = [], animating = false, popups = [], tipMove = null, brakeOn = false, skipArmed = false, picked = null;
  let cell = 48, dpr = 1, colors = {}, font = 'sans-serif', swipe = null;
  // 自動確認用の窓口(画面の状態と、探索のおすすめの手)
  globalThis.__ps = () => ({ run, state, fl, animating, panelOpen: !panel.hidden, suggest: state && state.phase === 'play' ? bestMove(state, 3) : null });

  // ---- 保存(この端末のブラウザだけ。読めなくても遊べる) ----------------------
  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
  function store(patch) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(Object.assign(load(), patch))); } catch (e) { /* 保存できなくても続ける */ } }
  const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  function saveResume() { store({ resume: run && !run.over && state && state.phase === 'play' ? { run, state: Object.assign({}, state, { events: [] }), par: fl.par, quickTurns: fl.quickTurns, area: fl.area, boss: fl.boss } : null }); }
  function recordBest() {
    const sv = load(), cleared = run.over === 'won' ? TOTAL_FLOORS : run.floor;
    if (run.mode === 'daily') { const d = sv.daily || {}; if (!(d.date === today() && d.floors >= cleared)) store({ daily: { date: today(), floors: cleared, won: run.over === 'won' } }); }
    else if (!sv.best || cleared > sv.best.floors) store({ best: { floors: cleared, won: run.over === 'won' } });
  }

  // ---- 見た目の下ごしらえ ----------------------------------------------------
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bg', 'surface', 'fg', 'muted', 'line', 'ice', 'ice-2', 'hole', 'rock', 'crack', 'penguin', 'penguin-fg', 'belly', 'beak', 'foe', 'foe-fg', 'boss', 'bomb', 'accent', 'danger', 'good', 'gold'])
      colors[k] = cs.getPropertyValue('--' + k).trim();
    font = getComputedStyle(document.body).fontFamily;
  }
  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    cell = Math.max(20, Math.floor(Math.min(w / W, h / H)));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = cell * W + 'px'; cv.style.height = cell * H + 'px';
    cv.width = cell * W * dpr; cv.height = cell * H * dpr;
  }
  function syncSprites() {
    sprites = { 0: { x: state.p.x, y: state.p.y, alive: true } };
    for (const e of state.enemies) if (e.alive) sprites[e.id] = { x: e.x, y: e.y, alive: true };
  }

  // ---- 上下の表示 ------------------------------------------------------------
  function refresh() {
    if (!state) { $('where').textContent = ''; $('hearts').textContent = ''; $('turns').textContent = ''; return; }
    $('where').textContent = AREAS[fl.area].ja + ' ' + (run.floor % FLOORS_PER_AREA + 1) + '/' + FLOORS_PER_AREA + (run.mode === 'daily' ? ' ・ きょうの氷' : '');
    $('hearts').textContent = '♥'.repeat(state.p.hearts) + '♡'.repeat(Math.max(0, state.p.maxHearts - state.p.hearts));
    $('hearts').setAttribute('aria-label', 'ハート ' + state.p.hearts + ' / ' + state.p.maxHearts);
    const t = $('turns'); t.textContent = '';
    t.append(state.turn + ' ターン目 ・ はやわざ ');
    const b = document.createElement('b'); b.textContent = fl.quickTurns + ' 以内'; t.append(b);
    const playing = state.phase === 'play' && !animating && panel.hidden;
    $('brakeN').textContent = 'あと ' + brakesLeft(state); $('brake').disabled = !playing || brakesLeft(state) <= 0;
    $('brake').className = brakeOn ? 'on' : ''; $('brake').setAttribute('aria-pressed', brakeOn ? 'true' : 'false');
    $('undoN').textContent = 'あと ' + undosLeft(state); $('undo').disabled = !playing || !prev || undosLeft(state) <= 0;
    $('tipN').textContent = state.use.hint ? 'あと 0' : 'あと 1'; $('tip').disabled = !playing || !!state.use.hint;
    $('skip').disabled = !playing; $('skip').className = skipArmed ? 'on' : '';
    for (const b2 of document.querySelectorAll('#pad [data-dir]')) b2.disabled = !playing;
  }
  function setHint(text) { $('hint').textContent = text; }
  function defaultHint() {
    if (!state || state.phase !== 'play') return setHint('');
    if (brakeOn) return setHint('ブレーキ中: つぎのスワイプは 1 マスだけ進みます');
    if (skipArmed) return setHint('もう一度「こうさん」を押すと、ハートを 1 つ失って次のフロアへ進みます(強化なし)');
    setHint(fl.boss ? KINDS[fl.boss].ja + ': ' + KINDS[fl.boss].text : 'スワイプで滑る。助走が長いほど遠くへ押せます。敵をタップすると説明が出ます');
  }

  // ---- 重ねる画面 ------------------------------------------------------------
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function show(nodes) { panel.textContent = ''; for (const n of nodes) panel.append(n); panel.hidden = false; panel.scrollTop = 0; refresh(); }
  function hide() { panel.hidden = true; refresh(); defaultHint(); }
  function btn(text, cls, fn, sub) { const b = el('button', cls, text); b.type = 'button'; if (sub) b.append(el('small', '', sub)); b.addEventListener('click', fn); return b; }

  function titleScreen() {
    state = null; run = null; refresh(); setHint('');
    const sv = load(), nodes = [el('h2', '', 'ペンギンずもう'), el('p', '', '氷の上を滑って、敵を外へ押し出そう')];
    if (sv.resume && sv.resume.run && sv.resume.state) nodes.push(btn('つづきから', 'primary', () => resume(sv.resume), AREAS[sv.resume.area].ja + ' ' + (sv.resume.run.floor % FLOORS_PER_AREA + 1) + '/' + FLOORS_PER_AREA));
    nodes.push(btn('はじめる', sv.resume ? '' : 'primary', () => begin('normal'), sv.best ? 'これまでの最高: ' + (sv.best.won ? '全 15 フロア制覇' : sv.best.floors + ' フロア') : '全 15 フロア'));
    const d = sv.daily && sv.daily.date === today() ? sv.daily : null;
    nodes.push(btn('きょうの氷', '', () => begin('daily'), d ? 'きょうの記録: ' + (d.won ? '制覇' : d.floors + ' フロア') : '毎日かわる同じ並びに挑戦'));
    nodes.push(btn('あそびかた', '', howTo));
    show(nodes);
  }
  function howTo() {
    const ul = el('ul');
    for (const t of ['スワイプ(または矢印ボタン)でペンギンが滑ります。岩・敵・氷のふちにぶつかるまで止まりません',
      '敵にぶつかると 1 ダメージ。助走が長いほど遠くへ押せます(助走 − 相手のおもさ = 押す距離)',
      '氷の外や穴に落とせば、体力が残っていても退場です',
      '敵の数字は「あと何ターンで動くか」。赤いマスは次に攻撃される場所です',
      'ペンギンは自分ではふちから落ちません。落ちるのは穴に入ったときと、押し流されたときです',
      '「ブレーキ」で 1 マスだけ進めます。「はやわざ」の手数以内に勝つとハートが回復します',
      'フロアに勝つたびに、3 つの強化から 1 つ選べます。5 フロアごとにボスがいます'])
      ul.append(el('li', '', t));
    show([el('h2', '', 'あそびかた'), ul, btn('もどる', 'primary', () => (run ? hide() : titleScreen()))]);
  }
  function floorIntro() {
    const n = run.floor % FLOORS_PER_AREA + 1, nodes = [el('p', '', AREAS[fl.area].ja + ' ' + n + ' / ' + FLOORS_PER_AREA)];
    if (fl.boss) { nodes.push(el('div', 'big', 'ボス ' + KINDS[fl.boss].ja)); nodes.push(el('p', '', KINDS[fl.boss].text)); }
    else { nodes.push(el('div', 'big', 'フロア ' + (run.floor + 1))); if (n === 1) nodes.push(el('p', '', AREAS[fl.area].text)); }
    nodes.push(el('p', '', 'はやわざ: ' + fl.quickTurns + ' ターン以内'));
    nodes.push(btn('はじめる', 'primary', hide));
    show(nodes);
  }
  function upgradeScreen(w) {
    const nodes = [el('h2', '', 'フロア クリア!')];
    nodes.push(el('p', '', (w.quick ? 'はやわざ達成! ' : '') + (w.healed ? 'ハートが ' + w.healed + ' つ回復' : state.turn + ' ターンで勝ち')));
    nodes.push(el('p', '', '強化を 1 つ選んでください'));
    picked = null;
    for (const k of w.offers) {
      const b = el('button', 'choice'); b.type = 'button';
      b.append(el('b', '', UPGRADES[k].ja + ((run.ups[k] || 0) > 0 ? '(2 つめ)' : '')), el('span', '', UPGRADES[k].text));
      b.addEventListener('click', () => { if (picked) return; picked = k; takeUpgrade(run, k); nextFloor(); });
      nodes.push(b);
    }
    show(nodes);
  }
  function resultScreen() {
    recordBest(); store({ resume: null });
    const won = run.over === 'won', cleared = won ? TOTAL_FLOORS : run.floor;
    const rows = el('div', 'rows');
    const add = (a, b) => rows.append(el('span', '', a), el('span', '', b));
    add('クリアしたフロア', cleared + ' / ' + TOTAL_FLOORS); add('かかったターン', String(run.stats.turns)); add('落とした敵', String(run.stats.ringOuts));
    add('はやわざ', run.stats.quick + ' 回');
    const by = Object.keys(run.stats.by).sort((a, b) => run.stats.by[b] - run.stats.by[a]);
    if (by.length) add('いちばん痛かったもの', (WHY_JA[by[0]] || by[0]) + '(' + run.stats.by[by[0]] + ')');
    const ups = Object.keys(run.ups).map((k) => UPGRADES[k].ja + (run.ups[k] > 1 ? '×' + run.ups[k] : ''));
    show([el('h2', '', won ? '優勝!' : 'まけ…'), el('p', '', won ? '全 15 フロアを勝ちぬきました' : AREAS[Math.min(2, Math.floor(run.floor / FLOORS_PER_AREA))].ja + 'で力つきました'),
          rows, el('p', '', ups.length ? '強化: ' + ups.join('、') : '強化なし'), btn('もう一回', 'primary', () => begin(run.mode)), btn('タイトルへ', '', titleScreen)]);
  }

  // ---- 進行 ------------------------------------------------------------------
  function begin(mode) {
    let seed;
    if (mode === 'daily') seed = dailySeed(today());
    else { const a = new Uint32Array(1); try { crypto.getRandomValues(a); seed = a[0]; } catch (e) { seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0; } }
    run = newRun(seed, mode);
    nextFloor(true);
  }
  function nextFloor() {
    fl = startFloor(run); state = fl.state; prev = null; tipMove = null; brakeOn = false; skipArmed = false; queue = []; popups = []; animating = false;
    syncSprites(); saveResume(); floorIntro();
  }
  function resume(r) {
    run = r.run; state = r.state; state.events = []; fl = { state, par: r.par, quickTurns: r.quickTurns, area: r.area, boss: r.boss };
    prev = null; tipMove = null; brakeOn = false; skipArmed = false; queue = []; popups = []; animating = false;
    syncSprites(); hide();
  }
  function afterAct() {
    animating = false;
    syncSprites();
    if (state.phase === 'won') { const w = winFloor(run, state, fl.quickTurns); if (w.finished) resultScreen(); else { store({ resume: null }); upgradeScreen(w); } }
    else if (state.phase === 'lost') { loseRun(run, state); resultScreen(); }
    else { saveResume(); refresh(); defaultHint(); }
  }
  function move(dir) {
    if (!state || state.phase !== 'play' || animating || !panel.hidden) return;
    prev = cloneState(state); prev.events = [];
    const useBrake = brakeOn && brakesLeft(state) > 0;
    act(state, dir, useBrake);
    brakeOn = false; skipArmed = false; tipMove = null;
    queue = state.events.slice(); state.events = [];
    animating = true; refresh();
  }

  // ---- 入力 ------------------------------------------------------------------
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); swipe = { x: e.clientX, y: e.clientY }; e.preventDefault(); });
  cv.addEventListener('pointerup', (e) => {
    if (!swipe || !state) { swipe = null; return; }
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; swipe = null;
    if (Math.abs(dx) < 22 && Math.abs(dy) < 22) { // タップ: そのマスの敵の説明
      const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell), f = enemyAt(state, x, y);
      if (f) setHint(KINDS[f.kind].ja + '(体力 ' + f.hp + (f.object ? '' : ' ・ おもさ ' + f.weight) + ' ・ あと ' + f.count + ' ターン)' + KINDS[f.kind].text);
      else if (x === state.p.x && y === state.p.y) setHint('ペンギン: スワイプした向きへ、ぶつかるまで滑ります');
      else defaultHint();
      return;
    }
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  cv.addEventListener('pointercancel', () => { swipe = null; });
  for (const b of document.querySelectorAll('#pad [data-dir]')) b.addEventListener('click', () => move(b.dataset.dir));
  window.addEventListener('keydown', (e) => { const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key]; if (m && panel.hidden) { e.preventDefault(); move(m); } });
  $('brake').addEventListener('click', () => { if (brakesLeft(state) > 0) { brakeOn = !brakeOn; skipArmed = false; refresh(); defaultHint(); } });
  $('undo').addEventListener('click', () => {
    if (!prev || undosLeft(state) <= 0 || animating) return;
    const used = state.use.undo + 1;
    state = prev; state.use.undo = used; fl.state = state; prev = null; tipMove = null; brakeOn = false; skipArmed = false;
    syncSprites(); saveResume(); refresh(); setHint('1 手もどしました');
  });
  $('tip').addEventListener('click', () => {
    if (state.use.hint || animating) return;
    state.use.hint = 1; tipMove = bestMove(state, 4);
    refresh(); setHint('ヒント: ' + DIR_JA[tipMove.dir] + 'へ' + (tipMove.brake ? '(ブレーキを使う)' : '') + '。数手先まで読んだおすすめです');
  });
  $('skip').addEventListener('click', () => {
    if (!skipArmed) { skipArmed = true; brakeOn = false; refresh(); defaultHint(); return; }
    skipArmed = false;
    if (skipFloor(run, state)) nextFloor(); else resultScreen();
  });

  // ---- 出来事を順に見せる ----------------------------------------------------
  const pop = (x, y, text, c, now) => popups.push({ x, y, text, c, t: now });
  let cur = null;
  function advance(now) {
    while (animating) {
      if (cur) {
        const k = Math.min(1, (now - cur.t0) / cur.dur), sp = sprites[cur.id];
        if (sp) { sp.x = cur.from[0] + (cur.to[0] - cur.from[0]) * k; sp.y = cur.from[1] + (cur.to[1] - cur.from[1]) * k; }
        if (k < 1) return;
        cur = null;
      }
      const e = queue.shift();
      if (!e) { afterAct(); return; }
      const sp = e.id !== undefined ? sprites[e.id] : null;
      switch (e.t) {
        case 'move': { const d = Math.abs(e.to[0] - e.from[0]) + Math.abs(e.to[1] - e.from[1]); cur = { id: e.id, from: e.from, to: e.to, t0: now, dur: 70 + d * 45 }; if (!sprites[e.id]) sprites[e.id] = { x: e.from[0], y: e.from[1], alive: true }; break; }
        case 'bump': if (sp) pop(sp.x, sp.y - 0.5, e.r > 0 ? 'ドン! 助走 ' + e.r : 'コツン', 'gold', now); break;
        case 'hit': if (sp) pop(sp.x, sp.y - 0.2, '-' + e.n, 'danger', now); break;
        case 'brace': if (sp) pop(sp.x, sp.y - 0.5, '踏んばった', 'muted', now); break;
        case 'ko': if (sp) { sp.alive = false; pop(e.x, e.y, e.how === 'hp' ? 'たおした' : e.how === 'self' ? '自分で落ちた!' : '場外!', 'gold', now); } break;
        case 'hurt': pop(sprites[0].x, sprites[0].y - 0.5, 'ハート -' + e.n, 'danger', now); break;
        case 'shield': pop(sprites[0].x, sprites[0].y - 0.5, 'たてで防いだ', 'good', now); break;
        case 'grip': pop(sprites[0].x, sprites[0].y - 0.5, 'ふんばった', 'good', now); break;
        case 'fall': pop(sprites[0].x, sprites[0].y, '落ちた! ハート -1', 'danger', now); cur = { id: -1, from: [0, 0], to: [0, 0], t0: now, dur: 260 }; break;
        case 'respawn': sprites[0].x = e.x; sprites[0].y = e.y; break;
        case 'act': if (sp && e.kind !== 'crab') cur = { id: -1, from: [0, 0], to: [0, 0], t0: now, dur: 120 }; break;
        case 'explode': pop(e.x, e.y, 'ドカン!', 'danger', now); if (sprites[e.id]) sprites[e.id].alive = false; cur = { id: -1, from: [0, 0], to: [0, 0], t0: now, dur: 160 }; break;
        case 'snowball': if (sp) pop(sp.x, sp.y - 0.5, '雪玉', 'accent', now); break;
        case 'sweep': pop(W / 2 - 0.5, 0.2, '押し流し!', 'boss', now); break;
        case 'tide': pop(W / 2 - 0.5, 0.2, '潮が ' + DIR_JA[e.dir] + ' へ!', 'boss', now); break;
        case 'spawn': { const en = state.enemies.find((q) => q.id === e.id); if (en) sprites[e.id] = { x: en.x, y: en.y, alive: true }; break; }
        case 'melt': pop(W / 2 - 0.5, 0.2, '氷がとけてきた! ハート -1', 'danger', now); break;
        default: break;
      }
    }
  }

  // ---- 描画 ------------------------------------------------------------------
  const cx = (x) => (x + 0.5) * cell, cy = (y) => (y + 0.5) * cell;
  function arrow(x, y, dir, color, size) {
    const d = DIRS[dir], s = size || cell * 0.22;
    ctx.save(); ctx.translate(cx(x), cy(y)); ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(d[0] * s * 1.6, d[1] * s * 1.6); ctx.lineTo(-d[1] * s - d[0] * s * 0.4, d[0] * s - d[1] * s * 0.4); ctx.lineTo(d[1] * s - d[0] * s * 0.4, -d[0] * s - d[1] * s * 0.4); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawBoard(view) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = view.cells[y * W + x];
      ctx.fillStyle = c === HOLE ? colors.hole : (x + y) % 2 ? colors.ice : colors['ice-2'];
      ctx.fillRect(x * cell, y * cell, cell, cell);
      if (c === ROCK) { ctx.fillStyle = colors.rock; ctx.beginPath(); ctx.roundRect(x * cell + cell * 0.12, y * cell + cell * 0.12, cell * 0.76, cell * 0.76, cell * 0.16); ctx.fill(); }
      if (c === CRACK) {
        ctx.strokeStyle = colors.crack; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(x * cell + cell * 0.15, y * cell + cell * 0.3); ctx.lineTo(x * cell + cell * 0.5, y * cell + cell * 0.55); ctx.lineTo(x * cell + cell * 0.35, y * cell + cell * 0.85);
        ctx.moveTo(x * cell + cell * 0.5, y * cell + cell * 0.55); ctx.lineTo(x * cell + cell * 0.88, y * cell + cell * 0.4); ctx.stroke();
      }
    }
  }
  function drawIntents(view) {
    for (const it of intents(view)) {
      ctx.save(); ctx.globalAlpha = it.kind === 'sweep' ? 0.22 : 0.28; ctx.fillStyle = it.kind === 'sweep' || it.kind === 'tide' ? colors.boss : colors.danger;
      for (const c of it.cells) ctx.fillRect(c[0] * cell + 2, c[1] * cell + 2, cell - 4, cell - 4);
      ctx.restore();
      if (it.dir && it.cells.length) { const c = it.kind === 'sweep' ? it.cells[Math.floor(it.cells.length / 2)] : it.cells[0]; arrow(c[0], c[1], it.dir, it.kind === 'sweep' ? colors.boss : colors.danger); }
      if (it.kind === 'tide') for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) { ctx.globalAlpha = 0.35; arrow(x - 0.5, y - 0.5, it.dir, colors.boss, cell * 0.14); ctx.globalAlpha = 1; }
    }
  }
  function drawPenguin(sp) {
    const x = cx(sp.x), y = cy(sp.y), r = cell * 0.36;
    ctx.fillStyle = colors.penguin; ctx.beginPath(); ctx.ellipse(x, y, r * 0.92, r * 1.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors.belly; ctx.beginPath(); ctx.ellipse(x, y + r * 0.22, r * 0.58, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors.beak; ctx.beginPath(); ctx.moveTo(x - r * 0.22, y - r * 0.28); ctx.lineTo(x + r * 0.22, y - r * 0.28); ctx.lineTo(x, y - r * 0.02); ctx.closePath(); ctx.fill();
    ctx.fillStyle = colors.penguin; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.5, r * 0.09, 0, Math.PI * 2); ctx.arc(x + r * 0.3, y - r * 0.5, r * 0.09, 0, Math.PI * 2); ctx.fill();
    if (brakeOn) { ctx.strokeStyle = colors.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, Math.PI * 2); ctx.stroke(); }
  }
  function drawEnemy(e, sp) {
    const x = cx(sp.x), y = cy(sp.y), r = cell * (e.boss ? 0.44 : 0.3 + e.weight * 0.035);
    ctx.fillStyle = e.boss ? colors.boss : e.object ? colors.bomb : colors.foe;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (e.brace) { ctx.strokeStyle = colors.fg; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.fillStyle = e.object ? colors.surface : e.boss ? colors.surface : colors['foe-fg']; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.round(cell * 0.24) + 'px ' + font; ctx.fillText(SHORT[e.kind], x, y);
    if ((e.kind === 'seal' || e.kind === 'walrus' || e.kind === 'dosukoi') && e.count > 1) { ctx.globalAlpha = 0.55; arrow(sp.x + DIRS[e.dir][0] * 0.42, sp.y + DIRS[e.dir][1] * 0.42, e.dir, colors.danger, cell * 0.1); ctx.globalAlpha = 1; }
    if (e.kind === 'gullH' || e.kind === 'gullV') { ctx.strokeStyle = colors['foe-fg']; ctx.lineWidth = 2; ctx.beginPath(); if (e.kind === 'gullH') { ctx.moveTo(x - r * 0.8, y + r * 0.62); ctx.lineTo(x + r * 0.8, y + r * 0.62); } else { ctx.moveTo(x + r * 0.7, y - r * 0.6); ctx.lineTo(x + r * 0.7, y + r * 0.6); } ctx.stroke(); }
    if (!e.object) { // 体力の粒
      const n = e.hp, gap = Math.min(cell * 0.13, cell * 0.8 / Math.max(1, n));
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x - (n - 1) * gap / 2 + i * gap, y + r + cell * 0.07, cell * 0.045, 0, Math.PI * 2); ctx.fillStyle = colors.good; ctx.fill(); }
    }
    const bx = x + r * 0.78, by = y - r * 0.78, soon = e.count === 1; // カウント
    ctx.beginPath(); ctx.arc(bx, by, cell * 0.17, 0, Math.PI * 2); ctx.fillStyle = soon ? colors.danger : colors.surface; ctx.fill(); ctx.strokeStyle = colors.fg; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = soon ? colors.surface : colors.fg; ctx.font = '700 ' + Math.round(cell * 0.22) + 'px ' + font; ctx.fillText(String(e.count), bx, by + 1);
  }
  function frame(now) {
    if (animating) advance(now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cell * W, cell * H);
    if (state) {
      drawBoard(state);
      if (!animating) drawIntents(state); // 動いている間は予告を消す
      const list = animating && prev ? prev.enemies.concat(state.enemies.filter((e) => !prev.enemies.some((q) => q.id === e.id))) : state.enemies;
      for (const e of list) { const sp = sprites[e.id]; if (sp && sp.alive) drawEnemy(animating ? (state.enemies.find((q) => q.id === e.id) || e) : e, sp); }
      if (sprites[0]) drawPenguin(sprites[0]);
      if (tipMove && !animating) arrow(state.p.x + DIRS[tipMove.dir][0] * 0.75, state.p.y + DIRS[tipMove.dir][1] * 0.75, tipMove.dir, colors.gold, cell * 0.2);
      popups = popups.filter((p) => now - p.t < 900);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 ' + Math.round(cell * 0.27) + 'px ' + font;
      for (const p of popups) {
        const k = (now - p.t) / 900, px = Math.max(cell * 0.9, Math.min(cell * (W - 0.9), cx(p.x))), py = Math.max(cell * 0.3, cy(p.y) - k * cell * 0.5);
        ctx.globalAlpha = 1 - k * k; ctx.lineWidth = 3; ctx.strokeStyle = colors.surface; ctx.strokeText(p.text, px, py); ctx.fillStyle = colors[p.c] || colors.fg; ctx.fillText(p.text, px, py);
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }

  readColors();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', resize);
  resize(); titleScreen();
  requestAnimationFrame(frame);
})();
