// はじきバトル 演出の描画(Canvas 2D)。指示表(fx/director.js)の part / text / body / shake / dim / zoom を絵にする。
// 画面の仕組み(React など)には依存しない。本体の戦闘画面でも、同じ ctx と色の表を渡せば使える。数値は fx/tokens.js。
// 決まり(R2 エフェクトの表):
//  - 3 層(メイン・サブ・賑やかし)、1 つの効果に色は 4 つまで。粒は使い回しの配列で、同時に FXT.budget.particlesMax まで
//  - 光は起動時に 1 回だけ描いた丸い絵を貼る(shadowBlur を毎コマ使わない)。ライトの卓は加算で白く飛ぶので通常の重ね方にする
//  - 演出は、敵のカウント・予告・体力の棒を隠さない(それらは画面側が演出より手前に描く)
//  - 「なし」では粒・揺れ・寄りを出さず、文字と小さなつぶれだけ
import { FXT } from './tokens.js';

export function createFxRender(opts) {
  const o = opts || {};
  const W = o.width || 360, H = o.height || 520;
  const T = FXT, P = T.parts, B = T.body;
  let colors = {}, dark = false, lv = T.level.full, reduce = false, font = 'sans-serif';
  // 粒(使い回し)
  const CAP = T.budget.particlesMax;
  const pool = Array.from({ length: CAP }, () => ({ on: false }));
  let live = 0, peak = 0;
  const rings = [], flashes = [], fills = [], bolts = [], lines = [], ghosts = [], texts = [], later = [];
  const anims = new Map(); // 駒 id → 動きの一覧
  let shakeS = null, dimS = null, zoomS = null, cut = null;
  const glowCache = new Map();
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; // 見た目のゆらぎ(勝ち負けとは無関係)
  const rr = (a, b) => a + (b - a) * rnd();
  const col = (role) => colors[T.color[role]] || colors[role] || colors.fg || '#888';

  function glow(color) { // 中心が色で外側が透明な丸い絵(色ごとに 1 回だけ作る)
    if (glowCache.has(color)) return glowCache.get(color);
    const c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(64, 64) : Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
    return c;
  }
  function spawn(p) {
    if (lv.particles <= 0) return null;
    for (let k = 0; k < CAP; k++) {
      const q = pool[k];
      if (!q.on) { Object.assign(q, { on: true, age: 0, g: 0, drag: 0, rot: 0, vr: 0, w: 1.5, size: 2 }, p); live++; if (live > peak) peak = live; return q; }
    }
    return null; // 上限に達したら新しい粒を省く(古い演出を消さない)
  }
  const n = (k, mul) => Math.max(0, Math.round(k * (mul === undefined ? 1 : mul) * lv.particles));
  const life = (ms) => ms * lv.life;
  const burst = (x, y, count, q) => { // 向き(nx,ny)のまわりに広がる火花・粒
    const base = q.nx || q.ny ? Math.atan2(q.ny, q.nx) : rnd() * Math.PI * 2, spread = q.spread === undefined ? 1.2 : q.spread;
    for (let k = 0; k < count; k++) {
      const a = base + (rnd() - 0.5) * spread * 2, sp = rr(q.speed[0], q.speed[1]);
      spawn({ type: q.type || 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: life(rr(q.life[0], q.life[1])), color: q.color, w: q.w || 1.6, size: q.size || 2, drag: q.drag || 3, g: q.g || 0 });
    }
  };
  const ring = (x, y, r0, r1, ms, color, w, delay) => rings.push({ x, y, r0, r1, t: -(delay || 0), life: life(ms), color, w: w || 3 });
  const flash = (x, y, r, ms, color) => { if (lv.glow) flashes.push({ x, y, r, t: 0, life: life(ms), color }); };

  // ---- 指示表の part ---------------------------------------------------------------
  function part(c, units) {
    const at = (id) => (units && units[id]) || null;
    const mul = c.mul === undefined ? 1 : c.mul;
    if (c.delayMs) { later.push({ t: -c.delayMs, c: Object.assign({}, c, { delayMs: 0 }), units }); return; }
    switch (c.id) {
      case 'tap': burst(c.x, c.y, n(2, mul), { nx: c.nx, ny: c.ny, speed: [60, 140], life: [120, 180], color: col('plain') }); break;
      case 'hit': {
        const primary = col('good');
        flash(c.x, c.y, 16, P.hit.flashMs, primary);
        burst(c.x, c.y, n(P.hit.sparks, mul), { nx: c.nx, ny: c.ny, speed: P.hit.sparkSpeed, life: P.hit.sparkLife, color: primary });
        break;
      }
      case 'strong': {
        const primary = col('great');
        flash(c.x, c.y, 24, P.strong.flashMs, primary);
        if (rings.filter((r) => r.kind === 'strong').length < P.strong.ringsMax) { ring(c.x, c.y, P.strong.ringR[0], P.strong.ringR[1], P.strong.ringMs, primary, 4); rings[rings.length - 1].kind = 'strong'; }
        burst(c.x, c.y, n(P.strong.sparks, mul), { nx: c.nx, ny: c.ny, speed: [180, 380], life: P.strong.sparkLife, color: primary });
        burst(c.x, c.y, n(P.strong.dots, mul), { type: 'dot', nx: c.nx, ny: c.ny, spread: 3, speed: [60, 160], life: [P.strong.dotLife, P.strong.dotLife], color: col('good'), size: 2.2, g: 120 });
        break;
      }
      case 'milestone': {
        const u = at(c.unit); if (!u) break;
        const colr = col(c.color || 'good');
        ring(u.x, u.y, u.r + 4, u.r + 26 + (c.n >= 10 ? 30 : c.n >= 5 ? 14 : 0), P.milestone.ringMs, colr, c.n >= 10 ? 5 : 3);
        burst(u.x, u.y, n(c.dots || 6, mul), { type: 'dot', spread: Math.PI, speed: [80, 220], life: [P.milestone.dotLife * 0.7, P.milestone.dotLife], color: colr, size: 2.4, drag: 2.5 });
        if (c.n >= 10) burst(u.x, u.y, n(10, mul), { type: 'dot', spread: Math.PI, speed: [120, 260], life: [400, 600], color: '#ffffff', size: 1.8 });
        break;
      }
      case 'touch': ring(c.x, c.y, 10, 30, 300, col('good'), 3); break;
      case 'ring': ring(c.x, c.y, (c.r || 16) * 0.6, c.r || 16, 300, col(c.color || 'good'), 2.5); break;
      case 'ringOut': { // 縁に沿った輪(卓の内側だけ)
        const ex = Math.max(0, Math.min(W, c.x)), ey = Math.max(0, Math.min(H, c.y));
        ring(ex, ey, 6, 34, P.ringOut.edgeRingMs, '#ffffff', 3); rings[rings.length - 1].clip = true;
        burst(ex, ey, n(P.ringOut.dots, mul), { type: 'dot', spread: Math.PI, speed: [40, 120], life: [P.ringOut.dotLife * 0.7, P.ringOut.dotLife], color: col('good'), size: 2 });
        break;
      }
      case 'shatter': burst(c.x, c.y, n(P.shatter.dots, mul), { type: 'dot', spread: Math.PI, speed: [80, 200], life: [P.shatter.dotLife * 0.7, P.shatter.dotLife], color: colors.enemy, size: 2.4, g: 200 }); break;
      case 'blast': case 'blastRing': {
        const first = c.id === 'blast', primary = col('great');
        ring(c.x, c.y, (c.r || 90) * 0.3, c.r || 90, P.blast.ringMs, primary, first ? 5 : 3);
        if (first) {
          flash(c.x, c.y, 40, P.blast.flashMs, primary);
          burst(c.x, c.y, n(P.blast.sparks, mul), { spread: Math.PI, speed: [160, 320], life: [250, 380], color: primary });
          for (let k = 0; k < n(P.blast.smoke, mul); k++) spawn({ type: 'smoke', x: c.x + rr(-12, 12), y: c.y + rr(-12, 12), vx: rr(-10, 10), vy: rr(-24, -8), life: life(rr(P.blast.smokeLife[0], P.blast.smokeLife[1])), size: rr(14, 22), color: colors.muted || '#888' });
        }
        break;
      }
      case 'explode': fills.push({ shape: 'circle', x: c.x, y: c.y, r: c.r || 90, t: 0, life: 320, color: col('harm') }); ring(c.x, c.y, (c.r || 90) * 0.5, c.r || 90, 300, col('harm'), 3); break;
      case 'act': { // 敵の攻撃の形(危険色。プレイヤーに悪いこと)
        const u = at(c.by), x = u ? u.x : c.x, y = u ? u.y : c.y, r = u ? u.r : (c.r || 16), hc = col('harm');
        if (c.kind === 'blast' || c.kind === 'bomb') fills.push({ shape: 'circle', x, y, r: (u && u.actR) || 105, t: 0, life: 360, color: hc });
        else if (c.kind === 'beamH') fills.push({ shape: 'rect', x: 0, y: y - r - 12, w: W, h: (r + 12) * 2, t: 0, life: 360, color: hc });
        else if (c.kind === 'beamV') fills.push({ shape: 'rect', x: x - r - 12, y: 0, w: (r + 12) * 2, h: H, t: 0, life: 360, color: hc });
        else ring(x, y, r + 4, r + 18, 330, hc, 3);
        break;
      }
      case 'bolt': bolts.push({ x: c.x, y: c.y, x2: c.x2, y2: c.y2, t: 0, life: 260, color: col('great'), j: Array.from({ length: 6 }, () => rr(-8, 8)) }); break;
      case 'ultFire': {
        const primary = col('great');
        flash(c.x, c.y, 46, P.ult.flashMs, primary);
        ring(c.x, c.y, 18, 92, P.ult.ringMs, primary, 5);
        burst(c.x, c.y, n(P.ult.sparks, mul), { spread: Math.PI, speed: [200, 420], life: [300, 450], color: primary });
        if (lv.speedLines) for (let k = 0; k < P.ult.speedLines; k++) { const a = (k / P.ult.speedLines) * Math.PI * 2 + rr(-0.1, 0.1); lines.push({ a, t: 0, life: life(P.ult.speedLineMs), color: primary }); }
        break;
      }
      case 'ultAfter': ring(c.x, c.y, 40, 220, 450, col('great'), 3); break;
      case 'gauge': { // ゲージの片が割れて落ちる
        const primary = colors.boss || col('great');
        for (let k = 0; k < n(P.gauge.pieces, mul); k++) spawn({ type: 'chip', x: c.x + rr(-24, 24), y: c.y, vx: rr(-90, 90), vy: rr(-160, -60), g: 520, life: life(P.gauge.ms + 200), size: rr(5, 8), color: primary, rot: rr(0, 6), vr: rr(-12, 12) });
        burst(c.x, c.y, n(P.gauge.sparks, mul), { spread: Math.PI, speed: [140, 300], life: [250, 400], color: '#ffffff' });
        flash(c.x, c.y, 30, 120, primary);
        break;
      }
      case 'bumper': ring(c.x, c.y, 12, 26, 250, col('good'), 3); break;
      case 'finale': {
        const primary = col('great');
        flash(c.x, c.y, 60, 160, primary);
        ring(c.x, c.y, 16, 120, P.finale.ringMs, primary, 6); ring(c.x, c.y, 10, 80, P.finale.ringMs, '#ffffff', 3, 120);
        burst(c.x, c.y, n(P.finale.sparks, mul), { spread: Math.PI, speed: [200, 420], life: P.finale.life, color: primary, drag: 2 });
        const pal = [col('great'), col('good'), colors.heal || '#3a3', colors.boss || '#73a'];
        for (let k = 0; k < n(P.finale.confetti, mul); k++) spawn({ type: 'chip', x: c.x + rr(-30, 30), y: c.y + rr(-20, 10), vx: rr(-160, 160), vy: rr(-320, -140), g: 520, life: life(rr(P.finale.life[0], P.finale.life[1] + 300)), size: rr(4, 6), color: pal[k % pal.length], rot: rr(0, 6), vr: rr(-14, 14) });
        break;
      }
      default: break;
    }
  }

  // ---- 文字(段 1〜5・色の役割)-----------------------------------------------------------
  function text(c, now) {
    if (c.key === 'chain') for (const t of texts) if (t.key === 'chain') t.dead = true; // れんさの文字は 1 つだけ(入れ替える)
    const size = T.text.sizes[c.size] || T.text.sizes[4];
    let lane;
    if (c.center) { const busy = texts.filter((t) => t.center && !t.dead && t.age < 700).map((t) => t.lane); lane = 0; while (busy.indexOf(lane) >= 0) lane++; }
    texts.push({ str: c.str, size, tier: c.size, color: col(c.color), plate: !!c.plate, x: c.center ? W / 2 : c.x, y: c.center ? 40 + lane * 30 : c.y, center: !!c.center, lane,
                 key: c.key, age: 0, life: T.text.lifeMs[c.size] || 900 });
  }

  // ---- 駒の動き(見た目だけ。物理は変えない)---------------------------------------------
  function body(c) {
    const list = anims.get(c.id) || []; anims.set(c.id, list);
    if (c.anim === 'squash') { if (lv.particles === 0 && c.amt < 0.85) c = Object.assign({}, c, { amt: 0.9 }); list.push({ k: 'squash', t: 0, amt: c.amt, nx: c.nx, ny: c.ny, life: B.hitSquash.recoverMs }); }
    else if (c.anim === 'jitter') { if (lv.shake > 0) list.push({ k: 'jitter', t: 0, px: c.px, life: c.ms }); }
    else if (c.anim === 'flinch') list.push({ k: 'flinch', t: 0, amt: c.amt, life: c.ms });
    else if (c.anim === 'windup') list.push({ k: 'windup', t: 0, amt: c.amt, life: c.ms + 80 });
    else if (c.anim === 'allyFall') list.push({ k: 'pop', t: 0, life: B.allyFall.stickMs });
    else if (c.anim === 'release') list.push({ k: 'release', t: 0, nx: c.nx, ny: c.ny, life: 420 });
    else if (c.anim === 'hop') list.push({ k: 'hop', t: -(c.delay || 0), life: B.winHop.hopMs + B.winHop.bowMs });
    else if (c.anim === 'ringOut' || c.anim === 'shatter') ghost(c);
  }
  function ghost(c) {
    const u = c.unit || {};
    const base = { x: c.x, y: c.y, r: u.r || 15, color: u.color || colors.enemy, label: u.label || '', fg: u.fg || colors['enemy-fg'] };
    if (c.anim === 'ringOut') {
      const ex = Math.max(base.r * 0.5, Math.min(W - base.r * 0.5, c.x)), ey = Math.max(base.r * 0.5, Math.min(H - base.r * 0.5, c.y));
      ghosts.push(Object.assign(base, { k: 'ringOut', x: ex, y: ey, vx: (c.vx || 0) * 0.25, vy: (c.vy || 0) * 0.25, t: 0, life: B.ringOut.wobbleMs + B.ringOut.ms }));
    } else {
      const pieces = Math.round(rr(P.shatter.pieces[0], P.shatter.pieces[1] + 0.99)), a0 = rnd() * Math.PI * 2;
      for (let k = 0; k < pieces; k++) {
        const a1 = a0 + (k / pieces) * Math.PI * 2, a2 = a0 + ((k + 1) / pieces) * Math.PI * 2, mid = (a1 + a2) / 2, sp = rr(80, 170);
        ghosts.push(Object.assign({}, base, { k: 'shard', a1, a2, x: c.x, y: c.y, vx: Math.cos(mid) * sp + (c.vx || 0) * 0.2, vy: Math.sin(mid) * sp + (c.vy || 0) * 0.2 - 40, rot: 0, vr: rr(-8, 8), t: 0, life: life(P.shatter.ms) }));
      }
    }
  }
  /** 駒の見た目の変形: { sx, sy, ang(変形の向き), ox, oy, alpha, s(全体の大きさ) } */
  function bodyOf(id) {
    const out = { sx: 1, sy: 1, ang: 0, ox: 0, oy: 0, alpha: 1, s: 1 };
    const list = anims.get(id);
    if (!list) return out;
    for (const a of list) {
      if (a.t < 0) continue;
      const p = Math.min(1, a.t / a.life);
      if (a.k === 'squash') { // 速く入って(1 コマ)、ゆっくり戻る
        const k = a.t < T.frameMs ? a.amt : a.amt + (1 - a.amt) * easeOutBack(p);
        out.ang = Math.atan2(a.ny || 0, a.nx || 0); out.sx *= k; out.sy *= 1 / k;
      } else if (a.k === 'jitter') { const d = a.px * (1 - p); out.ox += Math.sin(a.t * 0.11) * d; out.oy += Math.cos(a.t * 0.137) * d; }
      else if (a.k === 'flinch') { const k = a.amt + (1 - a.amt) * easeOutBack(p); out.sy *= k; out.sx *= 1 / k; }
      else if (a.k === 'windup') { const k = p < 0.6 ? 1 - (1 - a.amt) * (p / 0.6) : a.amt + (1 - a.amt) * ((p - 0.6) / 0.4); out.sy *= k; out.sx *= 1 / k; }
      else if (a.k === 'pop') out.s *= easeOutBack(p);
      else if (a.k === 'release') { // 1〜2 コマで伸びきり、ばねで 1 回だけ行き過ぎて戻る
        const R = B.release, hold = R.frames * T.frameMs, t = Math.max(0, a.t - hold) / 1000;
        const w0 = Math.sqrt(R.spring.stiffness), z = R.spring.damping, wd = w0 * Math.sqrt(1 - z * z);
        const k = a.t < hold ? R.stretch : 1 + (R.stretch - 1) * Math.exp(-z * w0 * t) * Math.cos(wd * t);
        out.ang = Math.atan2(a.ny || 0, a.nx || 0); out.sx *= k; out.sy *= 1 / k;
      } else if (a.k === 'hop') {
        const H1 = B.winHop.hopMs, ms = a.t;
        if (ms < H1) out.oy -= Math.abs(Math.sin((ms / H1) * Math.PI * B.winHop.hops)) * 10;
        else { const q = (ms - H1) / B.winHop.bowMs; const k = 1 - 0.15 * Math.sin(q * Math.PI); out.sy *= k; out.sx *= 1 / k; }
      }
    }
    return out;
  }
  const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);

  // ---- 揺れ・暗転・寄り・カットイン -----------------------------------------------------------
  function shake(c) { if (lv.shake <= 0 || reduce || !c.px) return; shakeS = { px: c.px * lv.shake, nx: c.nx || 0, ny: c.ny || 0, t: 0, life: c.ms || 150 }; }
  function dim(c) { if (lv.particles <= 0) return; dimS = { pct: c.pct / 100, t: 0, life: c.ms }; }
  function zoom(c) { if (reduce || lv.shake <= 0) return; zoomS = { x: c.x, y: c.y, s: c.scale, t: 0, inMs: T.tiers[4].zoomMs, out: false, outT: 0 }; }
  function zoomOut() { if (zoomS && !zoomS.out) { zoomS.out = true; zoomS.outT = 0; } }
  function cutin(c) { cut = { name: c.name, ult: c.ult, t: 0, life: c.ms, x: c.x, y: c.y }; if (lv.particles > 0) for (let k = 0; k < n(P.ult.gather); k++) { const a = rnd() * Math.PI * 2, d = rr(50, 90); spawn({ type: 'gather', x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, tx: c.x, ty: c.y, life: life(P.ult.gatherMs), color: col('great'), size: 2.4 }); } }
  const skipCut = () => { if (cut) cut.t = cut.life; };

  /** カメラ: 揺れと寄り(画面側が ctx に掛ける) */
  function camera() {
    let tx = 0, ty = 0, s = 1, cx = W / 2, cy = H / 2;
    if (shakeS) {
      const p = shakeS.t / shakeS.life, a = shakeS.px * (1 - p) * (1 - p);
      if (shakeS.nx || shakeS.ny) { const w = Math.sin(shakeS.t * 0.09) * a; tx += shakeS.nx * w; ty += shakeS.ny * w; }
      else { tx += Math.sin(shakeS.t / 17) * a; ty += Math.cos(shakeS.t / 23) * a; }
    }
    if (zoomS) {
      const p = zoomS.out ? 1 - Math.min(1, zoomS.outT / zoomS.inMs) : Math.min(1, zoomS.t / zoomS.inMs), e = easeOut(p);
      s = 1 + (zoomS.s - 1) * e; cx = W / 2 + (zoomS.x - W / 2) * e; cy = H / 2 + (zoomS.y - H / 2) * e;
    }
    return { tx, ty, s, cx, cy };
  }

  // ---- 進める -------------------------------------------------------------------------
  function update(dt) {
    const s = dt / 1000;
    for (const L of later) L.t += dt;
    for (let k = later.length - 1; k >= 0; k--) if (later[k].t >= 0) { const L = later.splice(k, 1)[0]; part(L.c, L.units); }
    for (const q of pool) {
      if (!q.on) continue;
      q.age += dt;
      if (q.age >= q.life) { q.on = false; live--; continue; }
      if (q.type === 'gather') { const p = q.age / q.life, e = p * p; q.x += (q.tx - q.x) * Math.min(1, e * 0.6 + 0.04); q.y += (q.ty - q.y) * Math.min(1, e * 0.6 + 0.04); continue; }
      const dr = Math.exp(-q.drag * s); q.vx *= dr; q.vy *= dr; q.vy += q.g * s;
      q.x += q.vx * s; q.y += q.vy * s; q.rot += q.vr * s;
    }
    for (const arr of [rings, flashes, fills, bolts, lines, texts]) { for (const x of arr) { if (x.t !== undefined) x.t += dt; if (x.age !== undefined) x.age += dt; } }
    for (let k = rings.length - 1; k >= 0; k--) if (rings[k].t > rings[k].life) rings.splice(k, 1);
    for (const arr of [flashes, fills, bolts, lines]) for (let k = arr.length - 1; k >= 0; k--) if (arr[k].t > arr[k].life) arr.splice(k, 1);
    for (let k = texts.length - 1; k >= 0; k--) if (texts[k].dead || texts[k].age > texts[k].life) texts.splice(k, 1);
    for (const g of ghosts) { g.t += dt; if (g.k === 'shard') { g.vy += 380 * s; g.x += g.vx * s; g.y += g.vy * s; g.rot += g.vr * s; } else if (g.t > B.ringOut.wobbleMs) { g.x += g.vx * s; g.y += g.vy * s; } }
    for (let k = ghosts.length - 1; k >= 0; k--) if (ghosts[k].t > ghosts[k].life) ghosts.splice(k, 1);
    for (const [id, list] of anims) { for (const a of list) a.t += dt; const keep = list.filter((a) => a.t < a.life); if (keep.length) anims.set(id, keep); else anims.delete(id); }
    if (shakeS) { shakeS.t += dt; if (shakeS.t > shakeS.life) shakeS = null; }
    if (dimS) { dimS.t += dt; if (dimS.t > dimS.life) dimS = null; }
    if (zoomS) { if (zoomS.out) { zoomS.outT += dt; if (zoomS.outT > zoomS.inMs) zoomS = null; } else zoomS.t += dt; }
    if (cut) { cut.t += dt; if (cut.t > cut.life) cut = null; }
  }

  // ---- 描く -------------------------------------------------------------------------
  /** 卓の上・駒の下: 暗転、敵の攻撃の形、煙と片(通常の重ね方) */
  function drawUnder(g) {
    if (dimS) { const p = dimS.t / dimS.life, a = dimS.pct * (p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85); g.save(); g.globalAlpha = Math.max(0, a); g.fillStyle = '#000'; g.fillRect(-W, -H, W * 3, H * 3); g.restore(); }
    for (const f of fills) { const p = f.t / f.life; g.save(); g.globalAlpha = 0.32 * (1 - p); g.fillStyle = f.color; if (f.shape === 'circle') { g.beginPath(); g.arc(f.x, f.y, f.r * (0.7 + 0.3 * easeOut(p)), 0, Math.PI * 2); g.fill(); } else g.fillRect(f.x, f.y, f.w, f.h); g.restore(); }
    for (const q of pool) if (q.on && q.type === 'smoke') { const p = q.age / q.life; g.save(); g.globalAlpha = 0.35 * (1 - p); g.drawImage(glow(q.color), q.x - q.size * (1 + p), q.y - q.size * (1 + p), q.size * 2 * (1 + p), q.size * 2 * (1 + p)); g.restore(); }
    for (const gh of ghosts) drawGhost(g, gh);
  }
  function drawGhost(g, gh) {
    const p = gh.t / gh.life;
    g.save();
    if (gh.k === 'ringOut') {
      const w = B.ringOut.wobbleMs, sh = gh.t < w ? 1 : 1 - (1 - B.ringOut.shrinkTo) * ((gh.t - w) / (gh.life - w));
      const ang = gh.t < w ? Math.sin(gh.t * 0.12) * 0.25 : ((gh.t - w) / (gh.life - w)) * Math.PI * 2 * B.ringOut.turns;
      g.translate(gh.x, gh.y); g.rotate(ang); g.scale(sh, sh); g.globalAlpha = gh.t < w ? 1 : 1 - (gh.t - w) / (gh.life - w);
      g.beginPath(); g.arc(0, 0, gh.r, 0, Math.PI * 2); g.fillStyle = gh.color; g.fill();
      if (gh.label) { g.fillStyle = gh.fg; g.font = '700 ' + T.text.sizes[4] + 'px ' + font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(gh.label, 0, 0); }
    } else {
      g.translate(gh.x, gh.y); g.rotate(gh.rot); g.globalAlpha = 1 - p * p;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, gh.r, gh.a1, gh.a2); g.closePath(); g.fillStyle = gh.color; g.fill();
      g.strokeStyle = colors.surface || '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    g.restore();
  }
  /** 駒の上: 輪・光・火花・粒・稲妻・片(光は加算、ライトの卓では通常の重ね方) */
  function drawOver(g) {
    const add = dark ? 'lighter' : 'source-over';
    for (const r of rings) {
      if (r.t < 0) continue;
      const p = Math.min(1, r.t / r.life), e = easeOut(p);
      g.save(); if (r.clip) { g.beginPath(); g.rect(0, 0, W, H); g.clip(); }
      g.globalAlpha = 1 - p; g.strokeStyle = r.color; g.lineWidth = Math.max(0.5, r.w * (1 - p * 0.7));
      if (!dark) { g.beginPath(); g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2); g.lineWidth += 1.5; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke(); g.lineWidth -= 1.5; g.strokeStyle = r.color; }
      g.beginPath(); g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2); g.stroke(); g.restore();
    }
    g.save(); g.globalCompositeOperation = add;
    for (const f of flashes) { const p = f.t / f.life, rr2 = f.r * (0.6 + 0.6 * p); g.globalAlpha = (1 - p) * (dark ? 1 : 0.85); g.drawImage(glow(f.color), f.x - rr2, f.y - rr2, rr2 * 2, rr2 * 2); }
    g.lineCap = 'round';
    for (const q of pool) {
      if (!q.on || q.type === 'smoke') continue;
      const p = q.age / q.life; g.globalAlpha = 1 - p * p;
      if (q.type === 'spark') { const L = Math.min(14, Math.hypot(q.vx, q.vy) * 0.035 + 2); const sp = Math.hypot(q.vx, q.vy) || 1; g.strokeStyle = q.color; g.lineWidth = q.w; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx / sp * L, q.y - q.vy / sp * L); g.stroke(); }
      else if (q.type === 'dot' || q.type === 'gather') { g.fillStyle = q.color; g.beginPath(); g.arc(q.x, q.y, q.size * (1 - p * 0.5), 0, Math.PI * 2); g.fill(); }
      else if (q.type === 'chip') { g.save(); g.globalCompositeOperation = 'source-over'; g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = q.color; g.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); g.restore(); }
    }
    for (const b of bolts) { const p = b.t / b.life; g.globalAlpha = 1 - p; g.strokeStyle = b.color; g.lineWidth = 3; g.beginPath(); g.moveTo(b.x, b.y); for (let k = 1; k < 6; k++) { const f = k / 6; g.lineTo(b.x + (b.x2 - b.x) * f + b.j[k], b.y + (b.y2 - b.y) * f + b.j[(k + 2) % 6]); } g.lineTo(b.x2, b.y2); g.stroke(); }
    g.restore();
  }
  /** 文字(カメラの中で、駒と演出の上) */
  function drawTexts(g) {
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of texts) {
      const p = t.age / t.life, rise = t.center ? 0 : p * T.text.rise;
      const pop = t.age < 90 ? 0.7 + 0.3 * easeOutBack(t.age / 90) : 1; // 出た瞬間に少しはずむ
      g.globalAlpha = 1 - p * p;
      g.font = '700 ' + t.size + 'px ' + font;
      const x = Math.max(24, Math.min(W - 24, t.x)), y = t.y - rise;
      g.save(); g.translate(x, y); g.scale(pop, pop);
      if (t.plate) { // 10 れんさの札: 必殺色の地に白い文字
        const w = g.measureText(t.str).width + 28, h = t.size + 16;
        g.fillStyle = colors.ult || t.color; roundRect(g, -w / 2, -h / 2, w, h, 8); g.fill();
        g.fillStyle = colors['ult-fg'] || '#fff'; g.fillText(t.str, 0, 1);
      } else {
        g.lineWidth = t.tier <= 2 ? 5 : 3; g.strokeStyle = colors.surface || '#fff'; g.lineJoin = 'round'; g.strokeText(t.str, 0, 0);
        g.fillStyle = t.color; g.fillText(t.str, 0, 0);
      }
      g.restore();
    }
    g.restore();
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  /** 画面に固定のもの(カメラの外): 集中線とカットイン */
  function drawScreen(g) {
    if (lines.length) {
      g.save(); g.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      for (const L of lines) { const p = L.t / L.life, r0 = Math.hypot(W, H) * 0.55, r1 = r0 * (0.72 - 0.1 * p); g.globalAlpha = 0.8 * (1 - p); g.strokeStyle = L.color; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 + Math.cos(L.a) * r0, H / 2 + Math.sin(L.a) * r0); g.lineTo(W / 2 + Math.cos(L.a) * r1, H / 2 + Math.sin(L.a) * r1); g.stroke(); }
      g.restore();
    }
    if (cut) { // 必殺のカットイン: 帯が横から入り、技の名前を大きく
      const p = cut.t / cut.life, inP = Math.min(1, cut.t / 120), outP = Math.max(0, (cut.t - (cut.life - 120)) / 120);
      const x = (1 - easeOut(inP)) * -W + easeOut(outP) * W, y = H * 0.42, h = 76;
      g.save(); g.translate(x, 0);
      g.globalAlpha = 0.92; g.fillStyle = colors.surface || '#fff'; g.fillRect(0, y - h / 2, W, h);
      g.globalAlpha = 1; g.fillStyle = colors.ult || '#b7791f'; g.fillRect(0, y - h / 2, W, 4); g.fillRect(0, y + h / 2 - 4, W, 4);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = colors.fg || '#222'; g.font = '700 ' + T.text.sizes[3] + 'px ' + font; g.fillText(cut.name, W / 2, y - 16);
      g.fillStyle = colors.ult || '#b7791f'; g.font = '700 ' + T.text.sizes[1] + 'px ' + font; g.fillText(cut.ult, W / 2, y + 12);
      g.restore();
      void p;
    }
  }

  return {
    setColors(c, isDark, f) { colors = c; dark = !!isDark; if (f) font = f; glowCache.clear(); for (const k of ['good', 'great', 'harm']) glow(col(k)); if (colors.boss) glow(colors.boss); if (colors.muted) glow(colors.muted); }, // よく使う光の絵は先に作っておく
    setLevel(key, reduceMotion) { lv = T.level[key] || T.level.full; reduce = !!reduceMotion; },
    part, text, body, shake, dim, zoom, zoomOut, cutin, skipCut, camera, bodyOf, update, drawUnder, drawOver, drawTexts, drawScreen,
    get cutting() { return !!cut; },
    clear() { for (const q of pool) q.on = false; live = 0; for (const a of [rings, flashes, fills, bolts, lines, ghosts, texts, later]) a.length = 0; anims.clear(); shakeS = dimS = zoomS = cut = null; },
    stats: () => ({ particles: live, peak, rings: rings.length, texts: texts.length, ghosts: ghosts.length }),
    resetPeak() { peak = live; },
  };
}
