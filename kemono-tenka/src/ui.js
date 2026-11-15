// けもの天下 — 画面と入力(結果を決めるのは core.js。ここは見せるだけ)
// build.mjs が core.js と一緒に 1 つのスクリプトにまとめる。
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), wrap = $('wrap'), panel = $('panel');
  const SAVE_KEY = 'kemono-tenka.v1';
  const INTENT_JA = { recruit: '兵', develop: '開', fortify: '城' };

  let state = null, sel = -1, target = -1, setup = { clan: 0, difficulty: 'normal', mode: 'normal' };
  let W = 320, H = 400, dpr = 1, colors = {}, font = 'sans-serif', tiles = [], flash = null;
  globalThis.__kt = () => ({ state, panelOpen: !panel.hidden, advice: state && state.phase === 'orders' && !state.event && state.ordersLeft > 0 ? advice(state, 3) : [] });

  // ---- 保存(この端末のブラウザだけ。読めなくても遊べる) ----------------------
  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
  function store(patch) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(Object.assign(load(), patch))); } catch (e) { /* 保存できなくても続ける */ } }
  const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  const dateSeed = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  function saveResume() { store({ resume: state && state.phase !== 'over' ? { state, mode: setup.mode } : null }); }

  // ---- 効果音(その場で音を作る) ----------------------------------------------
  let audio = null, soundOn = load().sound !== false;
  const SFX = { tap: [[620, 620, 0.03, 'sine', 0.08]], order: [[330, 440, 0.08, 'triangle', 0.13]], win1: [[392, 588, 0.14, 'triangle', 0.15]], lose1: [[220, 150, 0.2, 'sawtooth', 0.14]],
                turn: [[196, 196, 0.06, 'square', 0.08], [262, 262, 0.08, 'square', 0.08, 0.07]], event: [[660, 880, 0.12, 'sine', 0.12]],
                victory: [[523, 523, 0.1, 'triangle', 0.14, 0], [659, 659, 0.1, 'triangle', 0.14, 0.1], [784, 784, 0.1, 'triangle', 0.14, 0.2], [1047, 1047, 0.24, 'triangle', 0.14, 0.3]],
                defeat: [[392, 392, 0.14, 'triangle', 0.14, 0], [311, 311, 0.14, 'triangle', 0.14, 0.14], [233, 233, 0.3, 'triangle', 0.14, 0.28]] };
  function sfx(name) {
    if (!soundOn || !SFX[name]) return;
    try {
      if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audio = new AC(); }
      if (audio.state === 'suspended') audio.resume();
      for (const n of SFX[name]) {
        const t0 = audio.currentTime + (n[5] || 0), o = audio.createOscillator(), g = audio.createGain();
        o.type = n[3]; o.frequency.setValueAtTime(n[0], t0); o.frequency.linearRampToValueAtTime(n[1], t0 + n[2]);
        g.gain.setValueAtTime(n[4], t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + n[2]);
        o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + n[2] + 0.02);
      }
    } catch (e) { /* 音が出せなくても続ける */ }
  }

  // ---- 下ごしらえ ------------------------------------------------------------
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bg', 'surface', 'fg', 'muted', 'line', 'land', 'road', 'neutral', 'neutral-fg', 'c0', 'c1', 'c2', 'c3', 'clan-fg', 'accent', 'danger', 'good', 'gold']) colors[k] = cs.getPropertyValue('--' + k).trim();
    font = getComputedStyle(document.body).fontFamily;
    draw();
  }
  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const k = Math.min(w / 3, h / 4.2);
    W = Math.max(180, Math.floor(k * 3)); H = Math.max(240, Math.floor(k * 4.2));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = W * dpr; cv.height = H * dpr;
    const tw = W / 3, th = H / 4, pad = Math.max(5, tw * 0.07);
    tiles = [];
    for (let i = 0; i < 12; i++) tiles.push({ x: (i % 3) * tw + pad, y: Math.floor(i / 3) * th + pad, w: tw - pad * 2, h: th - pad * 2 });
    draw();
  }
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const btn = (text, cls, fn, sub) => { const b = el('button', cls, text); b.type = 'button'; if (sub) b.append(el('small', '', sub)); b.addEventListener('click', () => { sfx('tap'); fn(); }); return b; };
  const sign = (n) => (n > 0 ? '+' : '') + n;
  const me = () => state.clans[state.player];

  // ---- 上の表示 --------------------------------------------------------------
  function refresh() {
    const playing = !!state && state.phase === 'orders' && !state.event && panel.hidden;
    $('end').disabled = !playing; $('advice').disabled = !playing || state.ordersLeft <= 0; $('logBtn').disabled = !state;
    $('bar').hidden = !state;
    if (!state) { for (const id of ['when', 'rice', 'provs', 'pips', 'info']) $(id).textContent = ''; $('clans').textContent = ''; $('acts').textContent = ''; draw(); return; }
    const inc = incomeOf(state, state.player);
    $('when').textContent = yearOf(state.turn) + ' 年目の' + seasonOf(state.turn) + '(' + state.turn + ' / ' + MAX_TURNS + ')';
    $('rice').textContent = '米 ' + me().rice + '(毎ターン ' + sign(inc.net) + ')';
    $('provs').textContent = '国 ' + countOf(state, state.player) + ' / ' + WIN_PROVS;
    $('pips').textContent = '●'.repeat(state.ordersLeft) + '○'.repeat(ORDERS_PER_TURN - state.ordersLeft);
    $('pips').setAttribute('aria-label', 'あと ' + state.ordersLeft + ' つ');
    const box = $('clans'); box.textContent = '';
    for (const c of state.clans) {
      const b = el('button', 'clan' + (c.alive ? '' : ' gone')); b.type = 'button'; b.style.borderLeftColor = colors['c' + c.id];
      const mine = c.id === state.player;
      b.append(el('b', '', c.name), el('span', '', !c.alive ? 'ほろびた' : '国' + countOf(state, c.id) + (mine ? ' あなた' : ' 仲' + sign(c.rel) + (c.pact > 0 ? ' 約' + c.pact : '')) + (state.coalition === c.id ? ' 包囲' : '')));
      b.addEventListener('click', () => { sfx('tap'); clanPanel(c.id); });
      box.append(b);
    }
    sheet(); draw();
  }

  // ---- 選んだ国の命令 --------------------------------------------------------
  function sheet() {
    const acts = $('acts'), info = $('info'); acts.textContent = ''; acts.className = 'acts';
    if (!state || state.phase !== 'orders') { info.textContent = ''; return; }
    const playing = !state.event && panel.hidden, can = playing && state.ordersLeft > 0;
    const add = (label, sub, o, cls) => { const why = whyNot(state, state.player, o); const b = btn(label, cls || '', () => doOrder(o), why ? why : sub); b.disabled = !can || !!why; acts.append(b); return b; };
    if (sel < 0) { info.textContent = state.ordersLeft > 0 ? '国をタップして命令を選びます。迷ったら「家臣の進言」。赤い矢印は、相手が次にする攻めです' : '命令を出し切りました。「番をおえる」を押すと、相手の家が予告どおりに動きます'; return; }
    const p = state.provs[sel], mine = p.owner === state.player;
    const head = p.name + '(' + ownerName(state, p.owner) + ')兵 ' + p.troops + ' ・ 石高 ' + p.koku + (p.id === CAPITAL ? '(都 +2)' : '') + ' ・ 城 ' + p.castle + (p.unrest ? ' ・ 次のターンは米を生まない' : '');
    if (target >= 0) { // 出陣の確かめ: 全軍か半分かを、結果を見て選ぶ
      const q = state.provs[target], all = p.troops - 1, half = Math.max(1, Math.floor(p.troops / 2));
      const label = (n) => { if (q.owner === state.player) return '兵 ' + n + ' を送る'; const f = forecast(state, sel, target, n); return f.win ? '勝てる(残る兵 ' + f.attackerLeft + ')' : '負ける(失う兵 ' + f.attackerLoss + ')'; };
      info.textContent = p.name + ' → ' + q.name + '(' + ownerName(state, q.owner) + ' 兵 ' + q.troops + ' 城 ' + q.castle + ')' + (q.owner >= 0 && q.owner !== state.player && state.clans[q.owner].pact > 0 ? ' ⚠ 不戦の約束を破ることになります' : '');
      acts.className = 'acts three';
      const f1 = q.owner === state.player || forecast(state, sel, target, all).win;
      add('全軍 ' + all, label(all), { t: 'march', from: sel, to: target, sent: all }, f1 ? 'primary' : 'warn');
      if (half < all) add('半分 ' + half, label(half), { t: 'march', from: sel, to: target, sent: half }, q.owner === state.player || forecast(state, sel, target, half).win ? '' : 'warn');
      acts.append(btn('やめる', '', () => { target = -1; refresh(); }));
      return;
    }
    if (mine) {
      info.textContent = head + (p.troops >= 2 && !p.tired ? '。となりの国をタップすると出陣' : p.tired ? '。攻め取ったばかりで、このターンは出陣できません' : '');
      const n = recruitSize(me().rice);
      add('徴兵', n > 0 ? '米 ' + n + ' → 兵 ' + (n + (me().officers.includes('pyon') ? 1 : 0)) : '米がない', { t: 'recruit', at: sel });
      add('開発', '米 ' + costOf(state, state.player, 'develop') + ' → 石高 +1', { t: 'develop', at: sel });
      add('築城', '米 ' + costOf(state, state.player, 'fortify') + ' → 城 +1', { t: 'fortify', at: sel });
      acts.append(btn('とじる', '', () => { sel = -1; refresh(); }));
    } else {
      const it = intentsOn(sel);
      info.textContent = head + (it ? '。' + it : '') + (p.owner >= 0 ? '' : '。持ち主のいない国は動きません');
      if (p.owner >= 0) acts.append(btn(ownerName(state, p.owner) + ' のこと', '', () => clanPanel(p.owner)));
      acts.append(btn('とじる', '', () => { sel = -1; refresh(); }));
    }
  }
  function intentsOn(id) { // その国にかかわる相手の予定を言葉にする
    const out = [];
    for (const c of state.clans) if (c.id !== state.player && c.alive) for (const i of c.intents) {
      if (i.t === 'march' && (i.from === id || i.to === id)) out.push(c.name + ' が ' + state.provs[i.from].name + ' から ' + state.provs[i.to].name + ' へ兵 ' + (state.provs[i.from].troops - 1) + ' を出す予定');
      else if (i.t !== 'march' && i.at === id) out.push(c.name + ' がここで' + { recruit: '兵を集める', develop: '開発する', fortify: '城を固める' }[i.t] + '予定');
    }
    return out.join('。');
  }

  function doOrder(o) {
    const before = state.log.length;
    if (!order(state, o)) return;
    const last = state.log[state.log.length - 1];
    sfx(o.t === 'march' && last && last.kind === 'bad' ? 'lose1' : o.t === 'march' && state.log.length > before && last.kind === 'good' ? 'win1' : 'order');
    flash = { id: o.t === 'march' ? o.to : o.at !== undefined ? o.at : -1, t: performance.now() };
    target = -1; if (o.t === 'march' && state.provs[o.to].owner === state.player) sel = o.to;
    saveResume();
    if (state.phase === 'over') return gameOver();
    refresh();
    if (state.log.length > before && last) $('info').textContent = last.text;
  }

  // ---- 重ねる画面 ------------------------------------------------------------
  function show(nodes) { panel.textContent = ''; for (const n of nodes) panel.append(n); panel.hidden = false; panel.scrollTop = 0; refresh(); }
  function hide() { panel.hidden = true; refresh(); }

  function titleScreen() {
    state = null; sel = -1; target = -1;
    const sv = load(), nodes = [el('h2', '', 'けもの天下'), el('p', '', '12 の国を取り合う、けものたちの国盗り。' + WIN_PROVS + ' 国を取れば天下人')];
    if (sv.resume && sv.resume.state) nodes.push(btn('つづきから', 'primary', () => { state = sv.resume.state; setup.mode = sv.resume.mode || 'normal'; sel = -1; target = -1; hide(); if (state.event) eventPanel(); }, yearOf(sv.resume.state.turn) + ' 年目の' + seasonOf(sv.resume.state.turn)));
    nodes.push(el('p', '', 'どの家ではじめますか'));
    const g = el('div', 'grid2');
    CLANS.forEach((c, i) => { const b = el('button', 'choice' + (setup.clan === i ? ' sel' : '')); b.type = 'button'; b.append(el('b', '', c.ja), el('span', '', OFFICERS[c.officer].ja + ': ' + OFFICERS[c.officer].text)); b.addEventListener('click', () => { sfx('tap'); setup.clan = i; titleScreen(); }); g.append(b); });
    nodes.push(g);
    const d = el('div', 'grid3');
    for (const k of Object.keys(DIFFICULTY)) { const b = el('button', 'choice' + (setup.difficulty === k ? ' sel' : '')); b.type = 'button'; b.append(el('b', '', DIFFICULTY[k].ja)); b.addEventListener('click', () => { sfx('tap'); setup.difficulty = k; titleScreen(); }); d.append(b); }
    nodes.push(d, el('p', '', DIFFICULTY[setup.difficulty].text));
    const rec = sv.wins && sv.wins[setup.difficulty] ? 'この難しさでの天下取り: ' + sv.wins[setup.difficulty] + ' 回' + (sv.fastest && sv.fastest[setup.difficulty] ? '(最短 ' + sv.fastest[setup.difficulty] + ' ターン)' : '') : '';
    nodes.push(btn('はじめる', sv.resume ? '' : 'primary', () => begin('normal'), rec || undefined));
    const dl = sv.daily && sv.daily.date === today() ? sv.daily : null;
    nodes.push(btn('きょうの乱', '', () => begin('daily'), dl ? 'きょうの記録: ' + (dl.won ? dl.turn + ' ターンで天下取り' : '天下ならず') : '毎日かわる同じ並びに挑戦'));
    const row = el('div', 'grid2');
    row.append(btn('あそびかた', '', howTo), btn('音: ' + (soundOn ? 'オン' : 'オフ'), '', () => { soundOn = !soundOn; store({ sound: soundOn }); sfx('tap'); titleScreen(); }));
    nodes.push(row);
    show(nodes);
  }
  function howTo() {
    const ul = el('ul');
    for (const t of ['国をタップして命令を選びます。命令は 1 ターンに 3 つまでです',
      '自分の国を選んでから、となりの国をタップすると出陣です。勝ち負けは出す前に分かります(運はありません)',
      '徴兵は兵 1 つにつき米 1。兵 4 つにつき毎ターン米 1 の維持費がかかります',
      '相手の家は、次に何をするかを地図に出しています。矢印は攻め、「兵・開・城」は国の中の動きです',
      '攻めは必ず予告されます。先に守りを固めるか、出どころの国を取ってしまえば防げます',
      'いちばん大きな家(5 国以上)には包囲網が組まれます。あなたにも、相手にも同じ決まりです',
      '最初の 1 年は、どの家も、ほかの家の本拠を攻められません',
      WIN_PROVS + ' 国を取った家がその場で天下人。6 年たったら、いちばん国の多い家の勝ちです'])
      ul.append(el('li', '', t));
    show([el('h2', '', 'あそびかた'), ul, btn('もどる', 'primary', () => (state ? hide() : titleScreen()))]);
  }
  function begin(mode) {
    let seed;
    if (mode === 'daily') seed = dateSeed(today());
    else { const a = new Uint32Array(1); try { crypto.getRandomValues(a); seed = a[0]; } catch (e) { seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0; } }
    setup.mode = mode;
    state = newGame({ seed: seed || 1, clan: setup.clan, difficulty: setup.difficulty });
    sel = -1; target = -1; saveResume();
    const c = CLANS[setup.clan];
    show([el('p', '', mode === 'daily' ? 'きょうの乱' : DIFFICULTY[setup.difficulty].ja), el('div', 'big', c.ja), el('p', '', '左下の「' + state.provs[me().home].name + '」があなたの本拠です'),
          el('p', '', '家臣 ' + OFFICERS[c.officer].ja + ': ' + OFFICERS[c.officer].text), btn('はじめる', 'primary', hide)]);
  }
  function clanPanel(id) {
    const c = state.clans[id], K = CLANS[id], mine = id === state.player, nodes = [el('h2', '', c.name + (mine ? '(あなた)' : ''))];
    if (!c.alive) nodes.push(el('p', '', 'この家はほろびました'));
    else {
      if (!mine) nodes.push(el('p', '', '性格: ' + K.persona + '。' + K.personaText));
      const rows = el('div', 'rows'); const add = (a, b) => rows.append(el('span', '', a), el('span', '', b));
      add('国', countOf(state, id) + ' / ' + WIN_PROVS); add('米', String(c.rice));
      if (!mine) { add('あなたとの仲', sign(c.rel) + '(-5 〜 +5)'); add('不戦の約束', c.pact > 0 ? 'あと ' + c.pact + ' ターン' : 'なし'); }
      if (state.coalition === id) add('包囲網', 'ほかの家からねらわれている');
      nodes.push(rows);
      const ul = el('ul'); for (const k of c.officers) ul.append(el('li', '', OFFICERS[k].ja + ': ' + OFFICERS[k].text)); nodes.push(el('p', '', '家臣'), ul);
      if (!mine && state.phase === 'orders' && !state.event) {
        const mk = (label, o) => { const why = whyNot(state, state.player, o), b = btn(label, '', () => { hide(); doOrder(o); }, why || '米 ' + COST[o.t]); b.disabled = !!why || state.ordersLeft <= 0; return b; };
        const g = el('div', 'grid2'); g.append(mk('贈り物をする', { t: 'gift', clan: id }), mk('不戦の約束', { t: 'pact', clan: id })); nodes.push(g);
      }
    }
    nodes.push(btn('とじる', 'primary', hide));
    show(nodes);
  }
  function advicePanel() {
    const list = advice(state, 3), nodes = [el('h2', '', '家臣の進言'), el('p', '', 'タップすると、その命令を出します')];
    if (!list.length) nodes.push(el('p', '', 'いまは、これといった手がありません。番を終えてもよいでしょう'));
    for (const r of list) { const b = el('button', 'choice'); b.type = 'button'; b.append(el('b', '', orderName(r.o)), el('span', '', r.why)); b.addEventListener('click', () => { sfx('tap'); hide(); doOrder(r.o); }); nodes.push(b); }
    nodes.push(btn('とじる', '', hide));
    show(nodes);
  }
  function orderName(o) {
    if (o.t === 'march') return state.provs[o.from].name + ' から ' + state.provs[o.to].name + ' へ出陣(兵 ' + o.sent + ')';
    if (o.t === 'gift') return state.clans[o.clan].name + ' に贈り物'; if (o.t === 'pact') return state.clans[o.clan].name + ' と不戦の約束';
    return state.provs[o.at].name + ' で' + { recruit: '徴兵', develop: '開発', fortify: '築城' }[o.t];
  }
  function logPanel(lines, title, next) {
    const ul = el('ul');
    for (const l of lines) ul.append(el('li', l.kind === 'good' || l.kind === 'bad' || l.kind === 'big' ? l.kind : '', (title ? '' : l.turn + ': ') + l.text));
    show([el('h2', '', title || 'きろく'), ul, btn(next ? 'つぎへ' : 'とじる', 'primary', next || hide)]);
  }
  function eventPanel() {
    const e = state.event; sfx('event');
    const mk = (label, ch) => btn(label, 'choice', () => { const text = answerEvent(state, ch); saveResume(); if (state.phase === 'over') return gameOver(); show([el('h2', '', e.title), el('p', '', text), btn('つぎへ', 'primary', hide)]); });
    show([el('h2', '', e.title), el('p', '', e.text), mk(e.a, 'A'), mk(e.b, 'B')]);
  }
  function gameOver() {
    const won = state.winner === state.player, sv = load();
    sfx(won ? 'victory' : 'defeat');
    if (setup.mode === 'daily') { if (!(sv.daily && sv.daily.date === today() && sv.daily.won && (!won || sv.daily.turn <= state.turn))) store({ daily: { date: today(), won, turn: state.turn } }); }
    else if (won) { const w = sv.wins || {}, f = sv.fastest || {}; w[state.difficulty] = (w[state.difficulty] || 0) + 1; if (!f[state.difficulty] || state.turn < f[state.difficulty]) f[state.difficulty] = state.turn; store({ wins: w, fastest: f }); }
    store({ resume: null });
    const rows = el('div', 'rows'); const add = (a, b) => rows.append(el('span', '', a), el('span', '', b));
    add('決着', yearOf(state.turn) + ' 年目の' + seasonOf(state.turn) + '(' + state.turn + ' ターン)'); add('持っていた国', countOf(state, state.player) + '(最大 ' + state.stats.peak + ')');
    add('いくさ', state.stats.battlesWon + ' 勝 ' + state.stats.battlesLost + ' 敗'); add('取った国 / 取られた国', state.stats.provsTaken + ' / ' + state.stats.provsLost);
    const ul = el('ul'); for (const l of state.log.slice(-4)) ul.append(el('li', l.kind === 'good' || l.kind === 'bad' ? l.kind : '', l.text));
    show([el('h2', '', won ? '天下を取った!' : '天下ならず'), el('p', '', state.clans[state.winner].name + ' が天下人に。' + state.endReason), rows, ul,
          btn('もう一回', 'primary', () => begin(setup.mode)), btn('タイトルへ', '', titleScreen)]);
  }

  // ---- 入力 ------------------------------------------------------------------
  cv.addEventListener('click', (e) => {
    if (!state || state.phase !== 'orders' || state.event || !panel.hidden) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const id = tiles.findIndex((t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h);
    sfx('tap');
    if (id < 0) { sel = -1; target = -1; return refresh(); }
    const cur = sel >= 0 ? state.provs[sel] : null;
    // 自分の国を選んでいるときに、となりの国をタップしたら出陣の確かめへ
    if (cur && cur.owner === state.player && id !== sel && cur.adj.includes(id) && cur.troops >= 2 && !cur.tired && state.ordersLeft > 0) { target = id; return refresh(); }
    sel = id === sel && target < 0 ? -1 : id; target = -1; refresh();
  });
  $('advice').addEventListener('click', () => { sfx('tap'); advicePanel(); });
  $('logBtn').addEventListener('click', () => { sfx('tap'); logPanel(state.log.slice(-30)); });
  $('end').addEventListener('click', () => {
    if (!state || state.phase !== 'orders' || state.event) return;
    const before = state.log.length, turn = state.turn;
    sfx('turn'); endTurn(state); sel = -1; target = -1; saveResume();
    const lines = state.log.slice(before).filter((l) => !/年目の/.test(l.text) || state.phase === 'over');
    const next = () => { if (state.phase === 'over') return gameOver(); if (state.event) return eventPanel(); hide(); };
    if (lines.length) logPanel(lines, turn + ' ターン目に起きたこと', next); else next();
  });

  // ---- 描画 ------------------------------------------------------------------
  const center = (i) => ({ x: tiles[i].x + tiles[i].w / 2, y: tiles[i].y + tiles[i].h / 2 });
  function arrow(a, b, color, label) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
    const x1 = a.x + ux * len * 0.32, y1 = a.y + uy * len * 0.32, x2 = a.x + ux * len * 0.7, y2 = a.y + uy * len * 0.7, s = Math.max(6, W * 0.024);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(3, W * 0.012);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2 + ux * s * 1.4, y2 + uy * s * 1.4); ctx.lineTo(x2 - uy * s, y2 + ux * s); ctx.lineTo(x2 + uy * s, y2 - ux * s); ctx.closePath(); ctx.fill();
    if (label) { const mx = (x1 + x2) / 2 - uy * s * 1.6, my = (y1 + y2) / 2 + ux * s * 1.6; ctx.font = '700 ' + Math.round(W * 0.036) + 'px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = colors.bg; ctx.strokeText(label, mx, my); ctx.fillText(label, mx, my); }
  }
  function draw() {
    if (!tiles.length || !colors.bg) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.land; ctx.fillRect(0, 0, W, H);
    if (!state) return;
    ctx.strokeStyle = colors.road; ctx.lineWidth = Math.max(4, W * 0.016); // 道
    for (const p of state.provs) for (const j of p.adj) if (j > p.id) { const a = center(p.id), b = center(j); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    const fs = (k) => Math.round(W * k);
    for (const p of state.provs) {
      const t = tiles[p.id], col = p.owner < 0 ? colors.neutral : colors['c' + p.owner], fg = p.owner < 0 ? colors['neutral-fg'] : colors['clan-fg'];
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(t.x, t.y, t.w, t.h, 10); ctx.fill();
      if (p.owner === state.player) { ctx.strokeStyle = colors.fg; ctx.lineWidth = 2; ctx.stroke(); }
      if (p.id === sel || p.id === target) { ctx.strokeStyle = p.id === target ? colors.danger : colors.accent; ctx.lineWidth = 4; ctx.stroke(); }
      else if (sel >= 0 && target < 0 && state.provs[sel].owner === state.player && state.provs[sel].adj.includes(p.id) && state.provs[sel].troops >= 2 && !state.provs[sel].tired) { ctx.setLineDash([5, 4]); ctx.strokeStyle = colors.accent; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
      if (flash && flash.id === p.id && performance.now() - flash.t < 500) { ctx.globalAlpha = 0.5 * (1 - (performance.now() - flash.t) / 500); ctx.fillStyle = colors.surface; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + fs(0.036) + 'px ' + font; ctx.fillText(p.name + (p.id === CAPITAL ? '(都)' : ''), t.x + t.w / 2, t.y + t.h * 0.2);
      ctx.font = '800 ' + fs(0.085) + 'px ' + font; ctx.fillText(String(p.troops), t.x + t.w / 2, t.y + t.h * 0.52);
      ctx.font = '700 ' + fs(0.034) + 'px ' + font;
      ctx.fillText('石' + p.koku + ' 城' + p.castle + (p.unrest ? ' 乱' : ''), t.x + t.w / 2, t.y + t.h * 0.84);
      if (p.owner >= 0 && state.clans[p.owner].home === p.id) { ctx.font = '700 ' + fs(0.03) + 'px ' + font; ctx.textAlign = 'left'; ctx.fillText('本拠', t.x + 6, t.y + t.h * 0.52); }
    }
    for (const c of state.clans) { // 相手の予告
      if (c.id === state.player || !c.alive) continue;
      for (const i of c.intents) {
        if (i.t === 'march') { if (state.provs[i.from].owner !== c.id) continue; arrow(center(i.from), center(i.to), state.provs[i.to].owner === state.player ? colors.danger : colors['c' + c.id], String(state.provs[i.from].troops - 1)); }
        else if (state.provs[i.at].owner === c.id) { const t = tiles[i.at], r = Math.max(9, W * 0.032); ctx.beginPath(); ctx.arc(t.x + t.w - r - 3, t.y + t.h * 0.52, r, 0, Math.PI * 2); ctx.fillStyle = colors.surface; ctx.fill(); ctx.fillStyle = colors.fg; ctx.font = '700 ' + fs(0.034) + 'px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(INTENT_JA[i.t], t.x + t.w - r - 3, t.y + t.h * 0.52 + 1); }
      }
    }
    if (sel >= 0 && target >= 0) arrow(center(sel), center(target), colors.accent, '');
    if (flash && performance.now() - flash.t < 500) requestAnimationFrame(draw);
  }

  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', resize);
  readColors(); resize(); titleScreen();
})();
