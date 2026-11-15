// うしみつ時計 — 画面と入力(結果を決めるのは battle.js / run.js。ここは見せるだけ)
// build.mjs が data.js・battle.js・tales.js・run.js と一緒に 1 つのスクリプトにまとめる。
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), wrap = $('wrap'), panel = $('panel');
  const SAVE_KEY = 'ushimitsu.v1';
  const GLYPH = [['curse', '呪'], ['slow', '砂'], ['steal', '盗'], ['armor', '固'], ['up', '強'], ['heal', '癒'], ['summon', '呼']];

  let run = null, sel = null, tgt = -1, busy = false, skip = false, alwaysFast = false, view = null, note = '', bagOpen = false, sub = null;
  let setup = { char: 0, diff: 'normal', mode: 'normal' };
  let S = 300, dpr = 1, colors = {}, font = 'sans-serif', handPos = 0, shakeUntil = 0;
  // 検査用の入口(browser-check.mjs が使う)。best は「見通し」だけで選ぶ、かんたんな打ち手
  function bestMove() {
    const b = run && run.battle; if (!b || b.over) return null; let best = null, bs = -1e9;
    const tryIt = (a) => { const sp = specOf(b, a); if (!sp) return; for (let k = sp.min; k <= sp.max; k++) for (const f of needsTarget(sp) ? alive(b) : [null]) {
      const o = { a, k, target: f ? f.id : tgt }, p = preview(b, o); if (!p.ok) continue;
      const s = (p.over === 'win' ? 500 : p.over === 'lose' ? -5000 : 0) - p.hpLost * 2.5 + p.foes.reduce((x, y) => x + y.lost + (y.broke ? 6 : 0) + (y.dead ? 6 : 0), 0) - p.cost;
      if (s > bs) { bs = s; best = o; } } };
    tryIt('utsu'); tryIt('ukeru'); for (let i = 0; i < b.hand.length; i++) tryIt(i); return best;
  }
  globalThis.__um = () => ({ run, busy, sel, tgt, panelOpen: !panel.hidden, sub: !!sub, best: bestMove, setFast: (v) => { alwaysFast = !!v; } });

  // ---- 保存(この端末のブラウザだけ。読めなくても遊べる) ----------------------
  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
  function store(patch) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(Object.assign(load(), patch))); } catch (e) { /* 保存できなくても続ける */ } }
  const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  const dateSeed = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  function saveResume() { store({ resume: run && run.phase !== 'over' ? { run, mode: setup.mode } : null }); }

  // ---- 効果音(その場で音を作る) ----------------------------------------------
  let audio = null, soundOn = load().sound !== false;
  const SFX = { tap: [[620, 620, 0.03, 'sine', 0.07]], tock: [[180, 150, 0.05, 'square', 0.05]], hit: [[330, 220, 0.09, 'triangle', 0.14]], hurt: [[160, 90, 0.2, 'sawtooth', 0.14]],
                block: [[520, 480, 0.06, 'square', 0.06]], brk: [[440, 880, 0.12, 'triangle', 0.14], [660, 1320, 0.12, 'triangle', 0.08, 0.06]], coin: [[880, 1175, 0.1, 'sine', 0.1]],
                story: [[220, 208, 0.9, 'sine', 0.1], [330, 311, 0.9, 'sine', 0.05, 0.05]], bell: [[196, 190, 1.1, 'sine', 0.16]],
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

  // ---- 部品 ------------------------------------------------------------------
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function btn(label, cls, fn, small) {
    const b = el('button', cls); b.type = 'button'; b.append(el('b', '', label)); if (small) b.append(el('small', '', small));
    if (fn) b.addEventListener('click', () => { sfx('tap'); fn(); }); return b;
  }
  function choice(title, text, fn, extra) { const b = el('button', 'choice' + (extra ? ' ' + extra : '')); b.type = 'button'; b.append(el('b', '', title)); if (text) b.append(el('span', '', text)); if (fn) b.addEventListener('click', () => { sfx('tap'); fn(); }); return b; }
  function show(nodes) { panel.replaceChildren(...nodes); panel.hidden = false; panel.scrollTop = 0; }
  function hide() { panel.hidden = true; panel.replaceChildren(); }
  const wait = (ms) => (skip || alwaysFast ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
  const cardLine = (id) => { const c = getCard(id); return ticksText(c) + '・' + describe(c); };
  const foeColor = (f) => colors['f' + (f.id % 3)];
  const bt = () => view || (run && run.battle);

  // ---- 下ごしらえ ------------------------------------------------------------
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bg', 'surface', 'fg', 'muted', 'line', 'face', 'rim', 'hand', 'f0', 'f1', 'f2', 'foe-fg', 'atk', 'def', 'waza', 'fire', 'accent', 'danger', 'good']) colors[k] = cs.getPropertyValue('--' + k).trim();
    font = getComputedStyle(document.body).fontFamily;
  }
  function resize() {
    const r = wrap.getBoundingClientRect(); S = Math.max(160, Math.floor(Math.min(r.width, r.height)));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.width = S + 'px'; cv.style.height = S + 'px'; cv.width = Math.round(S * dpr); cv.height = Math.round(S * dpr);
    draw();
  }

  // ---- 時計を描く --------------------------------------------------------------
  const ang = (p) => (p / CLOCK) * Math.PI * 2 - Math.PI / 2;
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S, S);
    const b = bt(); if (!b || !run || run.phase !== 'battle' && !view) return;
    const cx = S / 2 + (performance.now() < shakeUntil ? Math.sin(performance.now() / 18) * 4 : 0), cy = S / 2, R = S / 2 - 36;
    const text = (s, x, y, size, color, weight) => { ctx.font = (weight || 400) + ' ' + size + 'px ' + font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
    // 文字盤
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = colors.face; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = colors.rim; ctx.stroke();
    for (let i = 0; i < CLOCK; i++) {
      const a = ang(i), x0 = cx + Math.cos(a) * (R - 6), y0 = cy + Math.sin(a) * (R - 6), x1 = cx + Math.cos(a) * R, y1 = cy + Math.sin(a) * R;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = colors.rim; ctx.lineWidth = 2; ctx.stroke();
    }
    // あと何刻かの数字と、札を引く刻(小さな四角)
    for (let i = 1; i < CLOCK; i++) {
      const a = ang(b.t + i); text('' + i, cx + Math.cos(a) * (R - 18), cy + Math.sin(a) * (R - 18), 11, colors.muted);
      if ((b.t + i) % DRAW_EVERY === 0 && b.hand.length < handMax(b)) { ctx.fillStyle = colors.waza; ctx.fillRect(cx + Math.cos(a) * (R - 33) - 2.5, cy + Math.sin(a) * (R - 33) - 2.5, 5, 5); }
    }
    text('鐘', cx, cy - R + 48, 11, colors.danger); // 針がてっぺんを過ぎるたび、化け物の攻撃が上がる
    // これから使う刻(見通し)
    let end = -1, kind = 'atk';
    if (sel && !busy) {
      const sp = specOf(b, sel.a);
      if (sp) { end = b.t + costOf(b, sel.k); kind = sp.kind; ctx.beginPath(); ctx.arc(cx, cy, R - 3, ang(b.t), ang(end)); ctx.lineWidth = 8; ctx.strokeStyle = colors[kind]; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt'; }
    }
    // 化け物の印
    const byTick = {};
    for (const f of b.foes) if (!f.dead && f.mark && f.mark.at - b.t < CLOCK) (byTick[f.mark.at] = byTick[f.mark.at] || []).push(f);
    for (const k of Object.keys(byTick)) {
      const list = byTick[k], n = list.length;
      list.forEach((f, i) => {
        const a = ang(+k) + (i - (n - 1) / 2) * 0.27, x = cx + Math.cos(a) * (R + 18), y = cy + Math.sin(a) * (R + 18), it = intent(b, f), pat = FOES[f.kind].pat[f.mark.ai];
        ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fillStyle = foeColor(f); ctx.fill();
        if (it.poise) { ctx.beginPath(); ctx.arc(x, y, 15.5, 0, Math.PI * 2); ctx.lineWidth = 2.5; ctx.strokeStyle = colors.accent; ctx.stroke(); }
        if (end >= 0 && +k <= end) { ctx.beginPath(); ctx.arc(x, y, 18.5, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = colors.fg; ctx.stroke(); }
        const g = GLYPH.find((x2) => pat[x2[0]]);
        text(pat.dmg ? (pat.x ? it.dmg / pat.x + '×' + pat.x : '' + it.dmg) : g ? g[1] : '?', x, y + 0.5, pat.dmg && pat.x ? 10 : 12, colors['foe-fg'], 700);
      });
    }
    if (b.dawn && b.dawn - b.t < CLOCK) { const a = ang(b.dawn), x = cx + Math.cos(a) * (R + 18), y = cy + Math.sin(a) * (R + 18); ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fillStyle = colors.good; ctx.fill(); text('朝', x, y + 0.5, 12, colors['foe-fg'], 700); }
    // 針
    const hand = (p, color, w, dash) => { const a = ang(p); ctx.beginPath(); ctx.setLineDash(dash || []); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26)); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt'; };
    if (end > b.t) hand(end, colors[kind], 3, [5, 5]);
    hand(busy ? handPos : b.t, colors.hand, 4);
    // まん中: 体力と守り
    ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fillStyle = colors.face; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = colors.rim; ctx.stroke();
    text('' + b.hp, cx, cy - 8, 24, lowHp(b) ? colors.danger : colors.fg, 800);
    const st = [];
    if (b.guard > 0) st.push('守' + b.guard); if (b.ward) st.push('見' + b.ward); if (b.power) st.push('力+' + b.power); if (b.curse) st.push('呪' + b.curse); if (b.slow) st.push('砂');
    text(st.length ? st.join(' ') : '体力', cx, cy + 14, 11, b.guard > 0 ? colors.def : colors.muted, 700);
    if (b.dawn) text('夜明けまで ' + Math.max(0, b.dawn - b.t) + ' 刻', cx, cy + R - 44, 11, colors.good);
  }
  let rafOn = false;
  function loop() { if (!rafOn) return; draw(); if (busy || performance.now() < shakeUntil) requestAnimationFrame(loop); else rafOn = false; }
  function kick() { if (!rafOn) { rafOn = true; requestAnimationFrame(loop); } }

  // ---- 戦いの画面 --------------------------------------------------------------
  function fixTarget() { const b = bt(); if (!b) return; const f = b.foes.find((x) => x.id === tgt && !x.dead); if (!f) { const a = b.foes.find((x) => !x.dead); tgt = a ? a.id : -1; } }
  function renderBattle() {
    const b = bt(); fixTarget();
    // 化け物
    const shown = b.foes.filter((f) => !f.dead).concat(b.foes.filter((f) => f.dead)).slice(0, 3).sort((x, y) => x.id - y.id);
    const fo = $('foes'); fo.replaceChildren(); fo.style.gridTemplateColumns = 'repeat(' + Math.max(1, shown.length) + ', minmax(0, 1fr))';
    for (const f of shown) {
      const it = f.dead ? null : intent(b, f), e = el('button', 'foe' + (f.dead ? ' gone' : '') + (f.id === tgt ? ' sel' : '')); e.type = 'button'; e.dataset.id = f.id; e.style.borderTopColor = foeColor(f);
      e.append(el('b', '', f.name));
      e.append(el('span', '', f.dead ? 'たおした' : '体 ' + f.hp + '/' + f.maxHp + (f.burn ? ' 火' + f.burn : '') + (f.armor ? ' 固' + f.armor : '') + (f.up ? ' 強' + f.up : '')));
      e.append(el('span', 'next', it ? 'あと ' + it.in + ' 刻: ' + it.text : f.dead ? '' : '…'));
      e.append(el('span', '', it ? (it.poise ? 'かまえ あと ' + it.poiseLeft : it.name) + (f.broken ? '(ひるみ)' : '') : ''));
      if (!f.dead) e.addEventListener('click', () => { if (busy) return; sfx('tap'); tgt = f.id; refresh(); });
      fo.append(e);
    }
    // 構えと札
    const mk = (a, sp, wrapEl) => {
      const e = btn(sp.name, 'act ' + sp.kind + (sel && sel.a === a ? ' sel' : ''), () => { if (busy) return; const keep = sel && sel.a === a ? sel.k : sp.min; sel = { a, k: keep }; refresh(); }, ticksText(sp));
      e.disabled = busy; wrapEl.append(e);
    };
    const ba = $('basics'), ca = $('cards'); ba.replaceChildren(); ca.replaceChildren(); ca.className = 'acts cards' + (handMax(b) > 3 ? ' four' : '');
    mk('utsu', specOf(b, 'utsu'), ba); mk('ukeru', specOf(b, 'ukeru'), ba);
    for (let i = 0; i < handMax(b); i++) { if (b.hand[i]) mk(i, getCard(b.hand[i]), ca); else { const e = btn('—', 'act empty', null, '札なし'); e.disabled = true; ca.append(e); } }
    // 見通し
    const info = $('info'), sp = sel ? specOf(b, sel.a) : null;
    if (busy) info.textContent = note;
    else if (!sp) {
      sel = null; const f = b.foes.find((x) => x.id === tgt && !x.dead), it = f ? intent(b, f) : null;
      info.textContent = (it ? f.name + ': あと ' + it.in + ' 刻で「' + it.name + '」' + it.text + (it.poise ? '(かまえ あと ' + it.poiseLeft + ')' : '') + '。' : '') + '構えか札を選んで、針を回す';
    }
    else {
      if (sel.k < sp.min || sel.k > sp.max) sel.k = sp.min;
      const o = { a: sel.a, k: sel.k, target: tgt }, p = preview(b, o), cost = costOf(b, sel.k);
      let h = '<b>' + sp.name + '・' + sel.k + ' 刻</b> ' + describe(sp, sel.k, b) + (cost !== sel.k ? '(針は ' + cost + ' 刻進む)' : '') + '<br>';
      if (!p.ok) h += '<span class="bad">' + p.why + '</span>';
      else if (p.over === 'win') h += '<span class="ok">これで勝ち</span>';
      else if (p.over === 'lose') h += '<span class="bad">これをやると倒れる</span>';
      else {
        const parts = [p.hpLost ? '受ける <span class="bad">' + p.hpLost + '</span>' : '<span class="ok">無傷</span>'];
        if (p.blocked) parts.push('守りで ' + p.blocked + ' 防ぐ');
        for (const f of p.foes) if (f.lost > 0 || f.broke) parts.push(b.foes.find((x) => x.id === f.id).name + ' −' + f.lost + (f.dead ? '(たおす)' : f.broke ? '<span class="ok">(くずす)</span>' : ''));
        if (p.over === 'dawn') parts.push('<span class="ok">夜が明ける</span>');
        h += parts.join('・');
      }
      info.innerHTML = h; // 中身は札の名前と数字だけ(外から来た文字は入らない)
    }
    $('kText').textContent = sp ? sel.k + ' 刻' : '—';
    $('less').disabled = busy || !sp || sel.k <= sp.min; $('more').disabled = busy || !sp || sel.k >= sp.max;
    $('go').disabled = busy || !sp || !!whyNot(b, { a: sel.a, k: sel.k, target: tgt });
    draw();
  }
  function popOn(id, textStr) { const e = $('foes').querySelector('[data-id="' + id + '"]'); if (!e) return; const p = el('span', 'pop', textStr); e.append(p); setTimeout(() => p.remove(), 750); }

  async function commit() {
    if (busy || !sel || !run || run.phase !== 'battle') return;
    const o = { a: sel.a, k: sel.k, target: tgt }, before = cloneState(run.battle);
    const res = fight(run, o);
    if (!res.ok) { $('info').textContent = res.why; return; }
    if (typeof o.a === 'number') before.hand.splice(o.a, 1);
    view = before; busy = true; skip = false; sel = null; handPos = view.t; note = ''; saveResume(); kick();
    const foe = (id) => view.foes.find((f) => f.id === id);
    for (const ev of res.events) {
      let pause = 0;
      switch (ev.e) {
        case 'act': note = ev.name + '・' + ev.k + ' 刻'; break;
        case 'tick': { const from = ev.t - 1, t0 = performance.now(), dur = skip || alwaysFast ? 0 : 190; sfx('tock');
          while (dur && performance.now() - t0 < dur) { handPos = from + (performance.now() - t0) / dur; await new Promise((r) => requestAnimationFrame(r)); if (skip) break; }
          handPos = ev.t; view.t = ev.t; if (view.guardUntil < view.t) view.guard = 0; break; }
        case 'guard': view.guard += ev.v; view.guardUntil = 999; break;
        case 'dmg': case 'burn': { const f = foe(ev.id); if (f) { f.hp = Math.max(0, f.hp - ev.v); if (ev.e === 'burn') f.burn = Math.max(0, f.burn - 1); } renderBattle(); popOn(ev.id, '−' + ev.v); sfx('hit'); pause = 150; break; }
        case 'kill': { const f = foe(ev.id); if (f) { f.dead = true; f.mark = null; note = f.name + ' をたおした'; } pause = 200; break; }
        case 'break': { const f = foe(ev.id); if (f) { f.mark = null; f.broken = true; note = f.name + ' のかまえをくずした'; } sfx('brk'); pause = 320; break; }
        case 'foe': { const f = foe(ev.id); if (f) { f.mark = null; f.armor = 0; note = f.name + '「' + ev.n + '」'; } pause = 220; break; }
        case 'hit': case 'curse': case 'aura': view.hp = Math.max(0, view.hp - ev.v); shakeUntil = performance.now() + 220; sfx('hurt'); note += ev.e === 'hit' ? ' → ' + ev.v + ' うけた' : ev.e === 'curse' ? '(のろい ' + ev.v + ')' : '(毒の息 ' + ev.v + ')'; pause = 170; break;
        case 'block': view.guard = Math.max(0, view.guard - ev.v); sfx('block'); note += ' → 守りで ' + ev.v + ' 防いだ'; pause = 120; break;
        case 'ward': view.ward = Math.max(0, view.ward - 1); note += ' → かわした'; sfx('block'); pause = 150; break;
        case 'heal': view.hp = Math.min(view.maxHp, view.hp + ev.v); break;
        case 'self': view.hp -= ev.v; break;
        case 'doll': view.hp = 1; note = '身代わり人形が、かわりに倒れた'; pause = 400; break;
        case 'burned': { const f = foe(ev.id); if (f) f.burn += ev.v; break; }
        case 'delay': { const f = foe(ev.id); if (f && f.mark) f.mark.at += ev.v; break; }
        case 'draw': if (view.hand.length < handMax(view)) view.hand.push(ev.id); break;
        case 'steal': { const i = view.hand.indexOf(ev.card); if (i >= 0) view.hand.splice(i, 1); note += '・札を 1 枚落とされた'; break; }
        case 'cursed': note += '・のろい ' + ev.v; break;
        case 'slowed': note += '・砂をかけられた(次の行動 +1 刻)'; break;
        case 'summon': note += '・仲間を呼んだ'; break;
        case 'counter': note = '受けきった。次の攻撃 +' + ev.v; break;
        case 'lap': note = '鐘が鳴った。化け物の攻撃 +' + ev.v; sfx('bell'); pause = 380; break;
        case 'over': pause = 350; break;
      }
      renderBattle(); if (pause) await wait(pause);
    }
    view = null; busy = false; skip = false; note = '';
    saveResume(); refresh();
  }
  function setK(k) { const b = bt(); if (!sel || !b) return; const sp = specOf(b, sel.a); if (!sp) return; const n = Math.max(sp.min, Math.min(sp.max, k)); if (n !== sel.k) { sel.k = n; sfx('tock'); renderBattle(); } }
  function dragTo(e) { // 針を引っぱる: 指のある向きの刻まで回す
    const b = bt(); if (busy || !sel || !b) return;
    const r = cv.getBoundingClientRect(), a = Math.atan2(e.clientY - r.top - S / 2, e.clientX - r.left - S / 2);
    let d = (a - ang(b.t)) / (Math.PI * 2 / CLOCK); d = ((d % CLOCK) + CLOCK) % CLOCK; const want = Math.round(d) % CLOCK;
    const sp = specOf(b, sel.a); let best = sp.min, bd = 99;
    for (let k = sp.min; k <= sp.max; k++) { const dd = Math.abs(costOf(b, k) - want); if (dd < bd) { bd = dd; best = k; } }
    setK(best);
  }

  // ---- 画面の切りかえ ----------------------------------------------------------
  function refresh() {
    const inRun = !!run;
    $('bar').hidden = !inRun;
    if (inRun) {
      const b = bt(), hp = run.phase === 'battle' || view ? b.hp : run.hp, max = run.maxHp;
      $('when').textContent = HOURS[Math.min(run.step, HOURS.length - 1)] + '(' + Math.min(run.step + 1, 9) + ' / 9)';
      $('hpText').textContent = '体力 ' + hp + '/' + max; $('hpBar').style.width = Math.max(0, Math.min(100, hp / max * 100)) + '%'; $('hpBar').className = hp <= max * LOW_HP ? 'low' : '';
      $('zeni').textContent = '銭 ' + run.zeni;
    } else $('when').textContent = '';
    if (bagOpen) return bagPanel();
    if (sub) return sub();
    if (!run) return titlePanel();
    if (view || run.phase === 'battle') { hide(); return renderBattle(); }
    if (run.phase === 'map') return mapPanel();
    if (run.phase === 'reward') return rewardPanel();
    if (run.phase === 'shop') return shopPanel();
    if (run.phase === 'rest') return restPanel();
    if (run.phase === 'event') return eventPanel();
    if (run.phase === 'over') return overPanel();
  }
  const after = (fn) => () => { fn(); saveResume(); refresh(); };

  function titlePanel() {
    const sv = load(), rec = sv.rec || {}, nodes = [el('h2', '', 'うしみつ時計'), el('p', '', '針を回したぶんだけ、強く打てる。けれど針が印を越えると、化け物が動く。夜明けまで、九つの刻。')];
    nodes.push(el('h3', '', '夜回り'));
    const g1 = el('div', ''); g1.style.display = 'grid'; g1.style.gap = '6px';
    CHARS.forEach((c, i) => g1.append(choice(c.name, c.trait + '(体力 ' + c.hp + ')', () => { setup.char = i; refresh(); }, setup.char === i ? 'sel' : '')));
    nodes.push(g1, el('h3', '', 'むずかしさ'));
    const g2 = el('div', 'grid3'); for (const k of Object.keys(DIFFS)) g2.append(btn(DIFFS[k].name, 'choice' + (setup.diff === k ? ' sel' : ''), () => { setup.diff = k; refresh(); }));
    nodes.push(g2);
    nodes.push(btn('夜回りに出る', 'primary', () => begin('normal')));
    const d = sv.daily && sv.daily.date === today() ? sv.daily : null;
    nodes.push(btn('きょうの夜', '', () => begin('daily'), d ? 'きょうの結果: ' + (d.win ? ENDINGS[d.how].title : HOURS[d.step] + ' で倒れた') : 'その日の日付で決まる、みんな同じ夜'));
    if (sv.resume && sv.resume.run && sv.resume.run.v === 1) nodes.push(btn('つづきから', '', () => { run = sv.resume.run; setup.mode = sv.resume.mode || 'normal'; setup.char = run.char; setup.diff = run.diff; sel = null; refresh(); }, HOURS[sv.resume.run.step] + '・' + CHARS[sv.resume.run.char].name));
    const g3 = el('div', 'grid2'); g3.append(btn('あそびかた', '', () => { sub = howPanel; refresh(); }), btn('音: ' + (soundOn ? 'あり' : 'なし'), '', () => { soundOn = !soundOn; store({ sound: soundOn }); refresh(); }));
    nodes.push(g3);
    const wins = Object.keys(rec).reduce((a, k) => a + rec[k].win, 0), ends = Object.keys(sv.endings || {}).length;
    nodes.push(el('p', '', '朝をむかえた回数: ' + wins + '・見た結末: ' + ends + ' / 3'));
    show(nodes);
  }
  function begin(mode) {
    setup.mode = mode;
    const seed = mode === 'daily' ? dateSeed(today()) : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    run = newRun({ seed, char: setup.char, diff: setup.diff }); sel = null; tgt = -1; saveResume();
    sub = introPanel; sfx('story'); refresh();
  }
  function introPanel() {
    const c = charOf(run), boss = FOES[bossOf(run)], nodes = [el('p', '', '夜語り'), el('h2', '', c.name)];
    for (const line of INTRO[c.id]) nodes.push(el('p', 'tale', line));
    nodes.push(el('h3', '', '今夜、丑三つ時に来るもの'), el('p', 'tale', boss.name + ' — ' + boss.rule));
    nodes.push(btn('歩きだす', 'primary', () => { sub = null; refresh(); }));
    show(nodes);
  }
  function howPanel() {
    const ul = el('ul', ''); ul.style.margin = '0'; ul.style.paddingLeft = '1.2em';
    for (const t of ['構え(打つ・受ける)か札を選び、時計の針を引っぱって、使う刻を決める。「決める」で針が進む',
      '攻めは、回し終わった刻に当たる。同じ刻なら、あなたが先',
      '守りは、回しているあいだだけ効く',
      '時計のまわりの丸い印が、化け物の次の行動。針がその刻に来ると動く。数字はダメージ',
      '金色の輪がついた印は大技。「かまえ」の数だけ先に削ると、つぶせる',
      '札は 2 刻ごとに 1 枚引く(時計の内側の小さな四角)',
      '針がてっぺん(鐘)を過ぎるたび、化け物の攻撃が ' + LAP_UP + ' 上がる。長引かせても得はしない',
      '体力が 3 割以下になると、守りが 1.5 倍になる(火事場)',
      '丑三つ時は、相手を倒すか、夜明けの刻まで立っていれば勝ち']) ul.append(el('li', '', t));
    show([el('h2', '', 'あそびかた'), ul, btn('もどる', 'primary', () => { sub = null; refresh(); })]);
  }
  const optLabel = (n) => TYPE_JA[n.type] + (n.foes ? ': ' + n.foes.map((k) => FOES[k].name).join('・') : '');
  const optText = (n) => (n.type === 'event' ? '何かが起きる。2 つから選ぶ' : n.type === 'shop' ? '札・おまもり・手当て(銭 ' + run.zeni + ')' : n.type === 'rest' ? '体力を 3 割もどすか、札を 1 枚きたえる' : n.type === 'elite' ? '勝てば、おまもり' : n.type === 'mid' ? '勝てば、おまもりと手当て' : n.type === 'boss' ? FOES[n.foes[0]].rule : '勝てば、銭と札');
  function mapPanel() {
    const nodes = [el('h2', '', HOURS[run.step]), el('p', 'tale', HOUR_LINES[run.step])];
    run.nodes.forEach((opts, i) => {
      const row = el('div', 'hour' + (i < run.step ? ' past' : i === run.step ? ' now' : '')), o = el('div', 'o');
      row.append(el('div', 'h', HOURS[i]), o);
      if (i === run.step) opts.forEach((n, j) => o.append(choice(optLabel(n), optText(n), () => enter(j))));
      else o.append(el('span', '', opts.map(optLabel).join(' / ')));
      nodes.push(row);
    });
    show(nodes);
  }
  function enter(j) {
    const n = run.nodes[run.step][j]; choose(run, j); sel = null; tgt = -1; saveResume();
    if (n.type === 'boss') { sub = () => show([el('p', '', '丑三つ時'), el('h2', '', FOES[n.foes[0]].name), el('p', 'tale', BOSS_LINES[n.foes[0]]), el('p', 'tale', FOES[n.foes[0]].rule + '。夜明けの刻(朝の印)まで立っていれば、勝ち。'), btn('むかえうつ', 'primary', () => { sub = null; refresh(); })]); sfx('bell'); }
    refresh();
  }
  function rewardPanel() {
    const rw = run.reward, nodes = [el('h2', '', '切りぬけた'), el('p', '', '銭 +' + rw.zeni + (rw.healed ? '・体力 +' + rw.healed : ''))];
    if (rw.relics) { nodes.push(el('h3', '', 'おまもりを 1 つ選ぶ')); rw.relics.forEach((id, i) => nodes.push(choice(RELICS[id].name, RELICS[id].text, after(() => { takeRelic(run, i); sfx('coin'); })))); }
    else { nodes.push(el('h3', '', '札を 1 枚もらう(束は ' + run.deck.length + ' 枚)')); rw.cards.forEach((id, i) => nodes.push(choice(getCard(id).name, cardLine(id), after(() => takeCard(run, i))))); nodes.push(btn('もらわない', '', after(() => takeCard(run, -1)))); }
    show(nodes);
  }
  function pickCard(title, filter, onPick, back) { // 束から 1 枚選ぶ
    sub = () => { const nodes = [el('h2', '', title)]; run.deck.forEach((id, i) => { if (filter(id)) nodes.push(choice(getCard(id).name, cardLine(id), () => { sub = null; onPick(i); saveResume(); refresh(); })); }); nodes.push(btn('やめる', '', () => { sub = null; refresh(); })); show(nodes); };
    refresh();
  }
  function shopPanel() {
    const s = run.shop, nodes = [el('h2', '', '店'), el('p', '', '銭 ' + run.zeni)];
    const item = (name, text, price, sold, fn) => { const b = el('button', 'item'); b.type = 'button'; const l = el('div', ''); l.append(el('b', '', name), el('span', '', text)); b.append(l, el('em', '', sold ? '売り切れ' : '銭 ' + price)); b.disabled = sold || run.zeni < price; b.addEventListener('click', () => { sfx('coin'); fn(); }); return b; };
    nodes.push(el('h3', '', '札'));
    s.cards.forEach((it, i) => nodes.push(item(getCard(it.id).name, cardLine(it.id), PRICE.card, it.sold, after(() => buy(run, 'card', i)))));
    nodes.push(el('h3', '', 'おまもり'));
    s.relics.forEach((it, i) => nodes.push(item(RELICS[it.id].name, RELICS[it.id].text, PRICE.relic, it.sold, after(() => buy(run, 'relic', i)))));
    nodes.push(el('h3', '', 'そのほか'));
    const h = item('手当て', '体力 +' + SHOP_HEAL, PRICE.heal, s.healSold, after(() => buy(run, 'heal'))); if (run.hp >= run.maxHp) h.disabled = true; nodes.push(h);
    const rm = item('札を 1 枚手放す', '束をうすくして、ほしい札を引きやすくする', PRICE.remove, s.removeSold, () => pickCard('手放す札', () => true, (i) => buy(run, 'remove', i))); if (run.deck.length <= 5) rm.disabled = true; nodes.push(rm);
    nodes.push(btn('店を出る', 'primary', after(() => leave(run))));
    show(nodes);
  }
  function restPanel() {
    const v = Math.min(Math.ceil(run.maxHp * REST_HEAL), run.maxHp - run.hp);
    show([el('h2', '', '茶屋'), el('p', 'tale', '湯のみが、ひとつ多く出ている。だれのぶんかは、聞かないことにした。'),
      choice('休む', '体力 +' + v, after(() => rest(run, 'heal'))),
      choice('札をきたえる', '束の札を 1 枚、強くする', () => pickCard('きたえる札', canUpgrade, (i) => rest(run, 'up', i))),
      btn('もちものを見る', '', () => { bagOpen = true; refresh(); })]);
  }
  function eventPanel() {
    const ev = EVENTS[run.event], nodes = [el('p', '', '出来事'), el('h2', '', ev.title), el('p', 'tale', ev.text)];
    for (const ch of ['a', 'b']) {
      const b = choice(ev[ch].label, '', () => { const r = answer(run, ch); saveResume(); sfx('story');
        sub = () => show([el('h2', '', ev.title), el('p', 'tale', r.out), el('p', 'note', r.notes.length ? r.notes.join('・') : '何も変わらなかった'), btn('つぎへ', 'primary', () => { sub = null; refresh(); })]); refresh(); });
      b.disabled = !canAnswer(run, ch); nodes.push(b);
    }
    show(nodes);
  }
  function overPanel() {
    const rs = run.result, end = ENDINGS[rs.how], sv = load();
    if (!run.counted) {
      run.counted = true; sfx(rs.win ? 'victory' : 'defeat');
      const rec = sv.rec || {}, key = run.char + '/' + run.diff; rec[key] = rec[key] || { win: 0, play: 0 }; rec[key].play++; if (rs.win) rec[key].win++;
      const ends = sv.endings || {}; ends[rs.how] = true;
      const patch = { rec, endings: ends, resume: null };
      if (setup.mode === 'daily' && !(sv.daily && sv.daily.date === today() && sv.daily.win)) patch.daily = { date: today(), win: rs.win, how: rs.how, step: rs.step };
      store(patch);
    }
    const rows = el('div', 'rows'); const add = (a, b) => rows.append(el('span', '', a), el('span', '', b));
    add('たどりついた刻', HOURS[rs.step]); add('戦い', run.stats.fights + ' 回'); add('与えたダメージ', '' + run.stats.dealt); add('受けたダメージ', '' + run.stats.taken); add('くずした大技', run.stats.breaks + ' 回');
    if (rs.win) add('丑三つ時', rs.how === 'slain' ? rs.ticks + ' 刻で退治' : '夜明けまで耐えた');
    const nodes = [el('p', '', '結末'), el('h2', '', end.title)]; for (const line of end.lines) nodes.push(el('p', 'tale', line));
    nodes.push(rows, btn('もう一回', 'primary', () => begin(setup.mode)), btn('タイトルへ', '', () => { run = null; refresh(); }));
    show(nodes);
  }
  function bagPanel() {
    const c = charOf(run), nodes = [el('h2', '', 'もちもの'), el('h3', '', c.name), el('p', 'tale', c.trait)];
    nodes.push(el('h3', '', 'おまもり(' + run.relics.length + ')'));
    if (!run.relics.length) nodes.push(el('p', '', 'まだない')); for (const id of run.relics) nodes.push(el('p', 'tale', RELICS[id].name + ' — ' + RELICS[id].text));
    nodes.push(el('h3', '', '札の束(' + run.deck.length + ' 枚)'));
    const count = {}; for (const id of run.deck) count[id] = (count[id] || 0) + 1;
    for (const id of Object.keys(count)) nodes.push(el('p', 'tale', getCard(id).name + (count[id] > 1 ? ' ×' + count[id] : '') + ' — ' + cardLine(id)));
    const g = el('div', 'grid2'); g.append(btn('あそびかた', '', () => { bagOpen = false; sub = howPanel; refresh(); }), btn('とじる', 'primary', () => { bagOpen = false; refresh(); }));
    nodes.push(g, btn('この夜をやめてタイトルへ', '', () => { bagOpen = false; saveResume(); run = null; refresh(); }));
    show(nodes);
  }

  // ---- 入力 ------------------------------------------------------------------
  let dragging = false;
  cv.addEventListener('pointerdown', (e) => { if (busy) { skip = true; return; } if (!sel) return; dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* つかめなくても続ける */ } dragTo(e); });
  cv.addEventListener('pointermove', (e) => { if (dragging) dragTo(e); });
  cv.addEventListener('pointerup', () => { dragging = false; });
  cv.addEventListener('pointercancel', () => { dragging = false; });
  $('less').addEventListener('click', () => { if (sel) setK(sel.k - 1); });
  $('more').addEventListener('click', () => { if (sel) setK(sel.k + 1); });
  $('go').addEventListener('click', () => { sfx('tap'); commit(); });
  $('bag').addEventListener('click', () => { if (busy || !run) return; sfx('tap'); bagOpen = !bagOpen; if (!bagOpen) hide(); refresh(); });
  $('info').addEventListener('click', () => { if (busy) skip = true; });
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
  try { const mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', () => { readColors(); draw(); }); } catch (e) { /* 古いブラウザ */ }

  readColors(); refresh(); resize();
})();
