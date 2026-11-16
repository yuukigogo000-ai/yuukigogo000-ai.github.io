// はじきバトル 音の部品 最終版(すべて端末の中で作る。音源ファイルは使わない)。調整できる数値は fx/tokens.js の FXT.sound。
// 歩み: 第 1 版 三角波 1 つで細く小さかった → 第 2 版 1 つの音を層で作る(立ち上がりの粒・芯・きらめき・部屋の響き)「よいね」
//   → 第 3 版 爽快感を足す(溜めて放つ・ポン・れんさで層が増える・パシッ)+英語の掛け声 → 最終版 掛け声を外す(発注者「声いらん」2026-11-16)
//   - 溜めて放つ: 決着・10 れんさの直前に「キュイーン」と上がる溜め(riser)を入れ、当たった瞬間に解放する(台本で先に分かるので外れない)
//   - 当たりは「ポン」という弾ける粒+澄んだ音(和音に合う倍音)。れんさが伸びるほど層が増え、左右に広がる
//   - 一撃に「パシッ」という手拍子の層、全体に高音の持ち上げ(スマホで明るく聞こえる)
// スマホのスピーカーは 200Hz より下がほとんど出ない。低い「ドン」は、ひずませて倍音を足し、中音域で聞こえるようにする。
//  - 立ち上がりを数ミリ秒かける(いきなり最大にすると「プチッ」と鳴る)
//  - 同時に鳴る音は上限まで(決着・節目 > 当たり の順に残す)
//  - iPhone は最初のタップの中で準備しないと鳴らない → unlock() を「はじめる」などのタップで呼ぶ
// ctx に OfflineAudioContext を渡せば、鳴らさずに波形を作れる(fx/audio-check.mjs で数字を測る)
import { FXT } from './tokens.js';

export function createAudio(opts) {
  const S = FXT.sound, o = opts || {};
  let ac = o.ctx || null, master = null, sfxBus = null, revIn = null, sfxRev = null, noiseBuf = null, driveCurve = null;
  const maxVoices = o.voicesMax || S.voicesMax;
  const groups = []; // 鳴っている音(1 回の play を 1 つと数える)
  let cur = null;
  const st = { scale: o.scale || S.scale, step: o.step || 'new', attackMs: o.attackMs === undefined ? S.attackMs : o.attackMs,
               jitter: o.jitter === undefined ? S.jitterSemi : o.jitter, timbre: o.timbre || S.timbre, glue: o.glue !== false, enabled: true };
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; // 音のゆらし用(勝ち負けには関係しない)

  function setup() {
    if (!ac) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false; ac = new AC(); }
    if (master) return true;
    master = ac.createGain(); master.gain.value = S.master;
    let head = master;
    if (st.glue) { // 高音の持ち上げ(スマホで明るく)。圧縮は使わない(音が小さくなり、先読みの分だけ遅れるため)
      const G = S.glue, air = ac.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = G.airHz; air.gain.value = G.airDb;
      head.connect(air); head = air;
    }
    const lim = ac.createDynamicsCompressor(); // 割れ止め(大きな音が重なったときだけ効く)
    lim.threshold.value = S.limiter.thresholdDb; lim.knee.value = 2; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.12;
    head.connect(lim); lim.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    // 響き: 減衰するノイズで作った部屋の残響(起動時に 1 回だけ作る)
    const R = S.reverb, len = Math.round(ac.sampleRate * R.seconds), ch = Math.min(2, ac.destination.channelCount || 2);
    const ir = ac.createBuffer(ch, len, ac.sampleRate);
    for (let c = 0; c < ch; c++) {
      const d = ir.getChannelData(c); let x = 99 + c * 7919, y = 0;
      const pre = Math.round(ac.sampleRate * R.preDelayMs / 1000), tau = R.seconds / 6.91;
      const decay = Math.exp(-1 / (tau * ac.sampleRate)), dstep = 0.65 / Math.max(1, len - pre); // 指数は掛け算で進める(起動を軽く)
      let amp = 1, damp = 0.85;
      for (let k = pre; k < len; k++) {
        x = (x * 16807) % 2147483647; const n = x / 1073741823.5 - 1;
        y += damp * (n - y); damp -= dstep; // 時間とともに高音が先に消える
        d[k] = y * amp; amp *= decay;
      }
    }
    const conv = ac.createConvolver(); conv.buffer = ir;
    revIn = ac.createGain(); const revOut = ac.createGain(); revOut.gain.value = R.level;
    revIn.connect(conv); conv.connect(revOut); revOut.connect(master);
    sfxRev = ac.createGain(); sfxRev.connect(revIn);     // 効果音の響き
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); let z = 7;
    for (let k = 0; k < nd.length; k++) { z = (z * 16807) % 2147483647; nd[k] = z / 1073741823.5 - 1; }
    driveCurve = new Float32Array(1024);
    for (let k = 0; k < 1024; k++) { const v = k / 511.5 - 1; driveCurve[k] = Math.tanh(3 * v) / Math.tanh(3); }
    return true;
  }
  function unlock() { if (!setup()) return false; if (ac.state === 'suspended' && ac.resume) ac.resume(); return true; }
  /** 音の準備だけ先にする(タップ前でもよい。鳴らすのは unlock の後)。最初の 1 音で画面が止まらないように */
  function prepare() { try { return setup(); } catch (e) { return false; } }

  // ---- 1 回の音のまとまり(出口・左右・響きへの送り) -----------------------------------
  function begin(prio, rev, pan) {
    const out = ac.createGain(), node = { nodes: [], end: 0, prio, out };
    let head = out;
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p); head = p; }
    head.connect(sfxBus);
    if (rev > 0) { const s = ac.createGain(); s.gain.value = rev; head.connect(s); s.connect(sfxRev); }
    cur = node;
  }
  function finish() {
    const g = cur; cur = null;
    groups.push(g);
    for (let k = groups.length - 1; k >= 0; k--) if (groups[k].end < ac.currentTime) groups.splice(k, 1);
    while (groups.length > maxVoices) {
      let at = 0; for (let k = 1; k < groups.length; k++) if (groups[k].prio < groups[at].prio) at = k;
      const v = groups.splice(at, 1)[0];
      for (const n of v.nodes) { try { n.stop(); } catch (e) { /* もう止まっている */ } }
    }
  }
  const T = (at) => ac.currentTime + 0.005 + (at || 0);
  const semi = (hz, n) => hz * Math.pow(2, n / 12);
  /** 音量の形: a ミリ秒で立ち上がり、d 秒で消える */
  function env(g, t, peak, a, d) {
    const A = Math.max(0.0015, (a === undefined ? st.attackMs : a) / 1000);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(A, d * 0.5)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    if (t + d > cur.end) cur.end = t + d;
  }
  const keep = (src, t, d) => { src.start(t); src.stop(t + d + 0.05); cur.nodes.push(src); };
  function filt(type, f, q, f1, t, d) {
    const b = ac.createBiquadFilter(); b.type = type; b.Q.value = q || 0.7;
    b.frequency.setValueAtTime(f, t); if (f1) b.frequency.exponentialRampToValueAtTime(f1, t + d);
    return b;
  }
  /** 出口を左右に振る(きらめきを広げる) */
  function outTo(g, p) {
    if (!p || !ac.createStereoPanner) { g.connect(cur.out); return; }
    const pn = ac.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, p)); g.connect(pn); pn.connect(cur.out);
  }
  /** 単純な音: 波形・高さ(f → f1 に滑る)・長さ・音量 */
  function tone(type, f, d, vol, q) {
    q = q || {}; const t = T(q.at), s = ac.createOscillator(), g = ac.createGain();
    s.type = type; s.frequency.setValueAtTime(f, t); if (q.f1) s.frequency.exponentialRampToValueAtTime(q.f1, t + (q.glide || d));
    if (q.detune) s.detune.value = q.detune;
    let h = s; if (q.lp) { const b = filt('lowpass', q.lp, q.q, q.lp1, t, d); h.connect(b); h = b; }
    if (q.drive) { const w = ac.createWaveShaper(); w.curve = driveCurve; const pre = ac.createGain(); pre.gain.value = q.drive; h.connect(pre); pre.connect(w); h = w; }
    h.connect(g); outTo(g, q.pan); env(g, t, vol, q.a, d); keep(s, t, d);
  }
  /** FM の鈴・ガラス・金属: 比(ratio)で質感、指数(index)で明るさ。指数は音と一緒に減る(鳴り始めが一番きらめく) */
  function fm(f, d, vol, q) {
    q = q || {}; const t = T(q.at), c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    c.type = 'sine'; m.type = 'sine'; c.frequency.setValueAtTime(f, t); m.frequency.setValueAtTime(f * (q.ratio || 3.5), t);
    const depth = f * (q.ratio || 3.5) * (q.index || 2);
    mg.gain.setValueAtTime(depth, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.02), t + (q.idxD || d * 0.5));
    m.connect(mg); mg.connect(c.frequency); c.connect(g); outTo(g, q.pan);
    env(g, t, vol, q.a === undefined ? 2 : q.a, d); keep(c, t, d); keep(m, t, d);
  }
  /** 厚い和音の芯: のこぎり波を少しずつずらして重ね、左右に広げ、明るさのフィルターを閉じていく */
  function saw(f, d, vol, q) {
    q = q || {}; const n = q.voices || 3;
    for (let k = 0; k < n; k++) tone('sawtooth', f, d, vol / n, { at: q.at, detune: (k - (n - 1) / 2) * (q.spread || 12), lp: q.lp || 6000, lp1: q.lp1 || 1500, q: 0.9, a: q.a === undefined ? 6 : q.a, pan: q.wide ? (k - (n - 1) / 2) * q.wide : 0 });
  }
  /** ノイズ: 帯域(type・f → f1)を通した「シュッ」「ザッ」「カッ」 */
  function noise(d, vol, q) {
    q = q || {}; const t = T(q.at), src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true; src.loopStart = rnd() * 0.5;
    const b = filt(q.type || 'bandpass', q.f || 2000, q.q || 0.8, q.f1, t, d);
    src.connect(b); b.connect(g); outTo(g, q.pan);
    env(g, t, vol, q.a === undefined ? 1.5 : q.a, d); keep(src, t, d);
  }
  /** ガラス・陶器の「チン」: 調和しない倍音を、それぞれ違う速さで消す */
  function clink(f, vol, q) {
    q = q || {};
    const P = q.partials || [[1, 1, 0.09], [2.76, 0.55, 0.05], [5.4, 0.3, 0.03]]; // 倍音 3 つ(音の部品の数を抑えて、一度に鳴っても重くしない)
    for (const [r, a, dd] of P) tone('sine', f * r, dd * (q.len || 1), vol * a, { at: q.at, a: 1.5, pan: q.pan });
  }
  /** 低い「ドン」: 高さが落ちるサイン波をひずませる(倍音でスマホでも聞こえる) */
  const thump = (f0, f1, d, vol, at) => tone('sine', f0, d, vol, { f1, glide: d * 0.7, drive: 2.5, at, a: 2 });
  /** 「ポン」: 高いところから一気に落ちる短い音(泡がはじける・玉が弾ける感じ) */
  const pop = (f0, vol, at) => tone('sine', f0, 0.05, vol, { f1: f0 * 0.28, glide: 0.03, at, a: 1 });
  /** 「パシッ」: 短いノイズを 3 回、少しずらして(手拍子のような締まり) */
  function clap(vol, at) { for (let k = 0; k < 3; k++) noise(k === 2 ? 0.07 : 0.012, vol * (k === 2 ? 0.8 : 0.6), { at: (at || 0) + k * 0.009, type: 'bandpass', f: 1500, q: 1.1, a: 1 }); }
  /** きらめき: 鈴の粒を速く並べ、左右に振り分ける */
  function sparkle(base, steps, gapMs, vol, at, up) {
    const P = [0, 4, 7, 12, 16, 19, 24, 28, 31, 36];
    for (let k = 0; k < steps; k++) fm(semi(base, up === false ? P[steps - 1 - k] : P[k % P.length]), 0.28, vol * (1 - k * 0.05), { at: (at || 0) + k * gapMs / 1000, ratio: 2, index: 1.2, pan: (k % 2 ? 0.45 : -0.45) * Math.min(1, k / 3) });
  }
  /** 溜め: ノイズの風切りと、のこぎり波の「キュイーン」が ms かけて上がり、最後の瞬間で止まる */
  function rise(ms, vol, top) {
    const d = Math.max(0.12, ms / 1000), t = T(), hz = top || 1760;
    const s = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter(), lf = ac.createOscillator(), lg = ac.createGain();
    s.type = 'sawtooth'; s.frequency.setValueAtTime(hz / 6, t); s.frequency.exponentialRampToValueAtTime(hz, t + d);
    lf.frequency.value = 9; lg.gain.value = hz * 0.012; lf.connect(lg); lg.connect(s.frequency);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(7000, t + d); lp.Q.value = 3;
    s.connect(lp); lp.connect(g); g.connect(cur.out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + d * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.02);
    s.start(t); s.stop(t + d + 0.05); lf.start(t); lf.stop(t + d + 0.05); cur.nodes.push(s, lf); if (t + d > cur.end) cur.end = t + d;
    const src = ac.createBufferSource(), ng = ac.createGain(), bp = ac.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true; bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(6000, t + d);
    src.connect(bp); bp.connect(ng); ng.connect(cur.out);
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(vol * 0.9, t + d * 0.95); ng.gain.linearRampToValueAtTime(0.0001, t + d + 0.02);
    src.start(t); src.stop(t + d + 0.05); cur.nodes.push(src);
  }
  /** れんさ n 回目の高さ(半音) */
  function chainSemi(n) {
    const sc = S.scales[st.scale] || S.scales.semitone, k = Math.max(0, Math.min(S.chainCap, n) - 1);
    return sc[k % sc.length] + 12 * Math.floor(k / sc.length);
  }
  const jit = () => (st.jitter ? (rnd() * 2 - 1) * st.jitter : 0);
  const chainHz = (n) => semi(S.chainBaseHz, chainSemi(n) + jit());

  const L = S.level; // 音ごとの大きさ(tokens)
  const HIT = { // 当たりの音色 3 種(発注者が選ぶ)。どれも「ポン」+澄んだ芯。れんさが伸びるほど層が増える(grow 0〜1)
    glass: (hz, v, grow) => {
      pop(hz * 2.5, 0.22 * v); noise(0.005, 0.22 * v, { type: 'highpass', f: 5000 }); clink(hz * 4, 0.07 * v, { len: 0.8 });
      fm(hz, 0.38, 0.3 * v, { ratio: 2, index: 1.3, idxD: 0.05 }); tone('sine', hz * 2, 0.22, 0.08 * v);
      if (grow > 0.3) fm(hz * 2, 0.3, 0.12 * v * grow, { ratio: 3, index: 1, pan: -0.4, at: 0.012 });
      if (grow > 0.6) fm(hz * 3, 0.3, 0.1 * v * grow, { ratio: 2, index: 0.8, pan: 0.4, at: 0.024 });
    },
    marimba: (hz, v, grow) => {
      pop(hz * 2, 0.18 * v); tone('sine', hz, 0.3, 0.4 * v, { a: 1.5 }); tone('sine', hz * 4, 0.07, 0.12 * v, { a: 1.5 }); tone('sine', hz * 10, 0.02, 0.05 * v, { a: 1 });
      if (grow > 0.3) tone('sine', hz * 2, 0.2, 0.15 * v * grow, { pan: -0.4, at: 0.012 });
      if (grow > 0.6) tone('sine', hz * 3, 0.18, 0.12 * v * grow, { pan: 0.4, at: 0.024 });
    },
    bell: (hz, v, grow) => {
      pop(hz * 2.5, 0.16 * v); noise(0.005, 0.2 * v, { type: 'highpass', f: 5000 }); fm(hz, 0.6, 0.3 * v, { ratio: 1.4, index: 2.2, idxD: 0.2 }); fm(hz * 2, 0.4, 0.1 * v, { ratio: 3.5, index: 1 });
      if (grow > 0.5) fm(hz * 3, 0.35, 0.1 * v * grow, { ratio: 2, index: 1, pan: 0.4, at: 0.02 });
    },
  };
  const R = {
    // 画面の操作
    ui: () => { begin(0, 0.05); tone('sine', 1320, 0.035, 0.12 * L.ui, { f1: 1100 }); noise(0.004, 0.08 * L.ui, { type: 'highpass', f: 5000 }); },
    step: (q) => { // 強さの段: ドミソのベルが段ごとに上がる。3 段目はきらめきを足す
      const p = q.p || 0, set = st.step === 'legacy' ? S.step.legacySemis : S.step.semis, hz = semi(S.step.baseHz, set[p] || 0);
      begin(0, 0.15); noise(0.004, 0.12 * L.step, { type: 'highpass', f: 4500 }); fm(hz, 0.22, 0.22 * L.step, { ratio: 2, index: 1.2, idxD: 0.05 }); tone('sine', hz, 0.18, 0.1 * L.step);
      if (p >= 3) sparkle(hz * 2, 2, 30, 0.07 * L.step, 0.03);
    },
    cancel: () => { begin(0, 0.05); tone('triangle', 440, 0.1, 0.16 * L.ui, { f1: 300, lp: 2500 }); },
    shoot: (q) => { // 発射: シュッと抜ける風切り+短い上昇音。強い手は低い押し出しと「パシッ」
      const p = q.p || 1; begin(0, 0.12, 0);
      noise(0.09 + p * 0.03, (0.18 + p * 0.06) * L.shoot, { type: 'bandpass', f: 500, f1: 2400 + p * 500, q: 1.1, a: 4 });
      tone('sine', 320 + p * 60, 0.07, 0.12 * L.shoot, { f1: 700 + p * 120, a: 2 });
      if (p >= 3) { thump(160, 70, 0.12, 0.3 * L.shoot); clap(0.16 * L.shoot); }
    },
    // 当たり
    tap: (q) => { begin(0, 0.08); clink(2600 + Math.min(900, (q.v || 300)) * 0.6, 0.05 * L.tap, { len: 0.7 }); },
    rail: (q) => { const v = Math.min(1, (q.v || 300) / 1200); begin(0, 0.06); tone('sine', 190, 0.06, 0.18 * v * L.rail, { f1: 140, a: 1.5 }); noise(0.035, 0.12 * v * L.rail, { type: 'lowpass', f: 900 }); },
    hit: (q) => {
      const n = q.n || 1, grow = Math.min(1, Math.max(0, (n - 2) / 7));
      begin(0, S.reverbSend.hit + 0.12 * grow, q.pan);
      (HIT[st.timbre] || HIT.glass)(chainHz(n), L.hit, grow);
    },
    strong: () => { // 強打: カッ(立ち上がり)+パシッ(締まり)+ドン(ひずませた低音)+バキッ(割れる帯域)+チーン(響き)
      begin(1, S.reverbSend.strong);
      noise(0.008, 0.5 * L.strong, { type: 'bandpass', f: 3500, q: 0.9 });
      clap(0.3 * L.strong, 0.002);
      thump(280, 70, 0.16, 0.55 * L.strong);
      noise(0.14, 0.32 * L.strong, { type: 'bandpass', f: 2200, f1: 700, q: 1.1, a: 2 });
      fm(1760, 0.32, 0.1 * L.strong, { ratio: 2, index: 1.4, at: 0.004 });
    },
    harm: () => { begin(0, 0.08); thump(170, 80, 0.16, 0.3 * L.harm); noise(0.08, 0.14 * L.harm, { type: 'lowpass', f: 700 }); },
    relay: () => { begin(0, 0.2); clink(2093, 0.13 * L.relay); clink(2794, 0.13 * L.relay, { at: 0.055 }); fm(1047, 0.25, 0.1 * L.relay, { at: 0.055, ratio: 2, index: 1 }); },
    crash: () => { begin(0, 0.12); tone('sine', 520, 0.07, 0.2 * L.crash, { f1: 400, a: 1.5 }); noise(0.05, 0.22 * L.crash, { type: 'bandpass', f: 1000, q: 1.4 }); thump(210, 90, 0.1, 0.25 * L.crash); clap(0.12 * L.crash); },
    bumper: () => { // ボヨン: 高さが揺れながら上がる
      begin(0, 0.15); const t = T(), s = ac.createOscillator(), lf = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
      s.type = 'sine'; s.frequency.setValueAtTime(330, t); s.frequency.exponentialRampToValueAtTime(560, t + 0.22);
      lf.frequency.value = 22; lg.gain.setValueAtTime(70, t); lg.gain.exponentialRampToValueAtTime(2, t + 0.25); lf.connect(lg); lg.connect(s.frequency);
      s.connect(g); g.connect(cur.out); env(g, t, 0.28 * L.bumper, 2, 0.26); keep(s, t, 0.26); keep(lf, t, 0.26);
    },
    pickup: () => { begin(0, 0.2); tone('square', 988, 0.07, 0.1 * L.pickup, { lp: 5000 }); tone('square', 1319, 0.32, 0.1 * L.pickup, { at: 0.07, lp: 5000 }); sparkle(2637, 2, 40, 0.05 * L.pickup, 0.1); },
    bonus: () => { // もう 1 手: 上がっていく合図
      begin(1, 0.3); [0, 7, 12].forEach((n, k) => tone('square', semi(1047, n), k === 2 ? 0.3 : 0.06, 0.09 * L.bonus, { at: k * 0.06, lp: 6000 }));
      sparkle(2093, 3, 35, 0.06 * L.bonus, 0.14);
    },
    ring: () => { // 敵の場外: ヒューンと落ちていき、ポンと消え、ごほうびの「チリン」
      begin(1, S.reverbSend.ring);
      tone('sawtooth', 900, 0.3, 0.12 * L.ring, { f1: 260, glide: 0.28, lp: 3000, lp1: 900 });
      noise(0.26, 0.12 * L.ring, { type: 'bandpass', f: 2200, f1: 500, q: 1.2, a: 6 });
      thump(220, 110, 0.1, 0.3 * L.ring, 0.26); pop(1400, 0.16 * L.ring, 0.27);
      fm(1568, 0.4, 0.14 * L.ring, { at: 0.3, ratio: 2, index: 1.2, pan: -0.3 }); fm(2093, 0.5, 0.14 * L.ring, { at: 0.37, ratio: 2, index: 1.2, pan: 0.3 });
    },
    break: () => { // 撃破: 写真シールが割れる。ガラスの破片の粒をばらまき、ごほうびの「チリン」
      begin(1, S.reverbSend.break);
      noise(0.22, 0.3 * L.break, { type: 'highpass', f: 3000, a: 1.5 });
      clap(0.2 * L.break);
      thump(200, 70, 0.14, 0.38 * L.break);
      for (let k = 0; k < 5; k++) clink(2500 + rnd() * 3500, 0.08 * L.break, { at: 0.01 + rnd() * 0.18, len: 0.6 + rnd() * 0.6, pan: rnd() * 1.2 - 0.6 });
      fm(1568, 0.4, 0.12 * L.break, { at: 0.12, ratio: 2, index: 1.2 }); fm(2093, 0.5, 0.12 * L.break, { at: 0.19, ratio: 2, index: 1.2 });
    },
    blast: (q) => { // 花火: ドン+ザーッ+パチパチ。2 発目からは小さく
      const k2 = q.k2 || 1, s = k2 > 1 ? 0.55 : 1;
      begin(1, S.reverbSend.blast * s, q.pan);
      thump(150, 42, 0.4, 0.6 * s * L.blast); clap(0.2 * s * L.blast);
      noise(0.45 * s + 0.1, 0.4 * s * L.blast, { type: 'lowpass', f: 4500, f1: 250, q: 0.7, a: 2 });
      for (let k = 0; k < (k2 > 1 ? 3 : 7); k++) noise(0.012, 0.18 * s * L.blast, { at: 0.04 + rnd() * 0.25, type: 'highpass', f: 2500 + rnd() * 3000, pan: rnd() * 1.4 - 0.7 });
    },
    chord: (q) => { // 節目: 「キュイン」と駆け上がる音+厚い和音の一撃(左右に広げる)+きらめき。高さはそのときのれんさの音から
      const n = q.notes || 2, root = chainHz(Math.min(S.chainCap, q.n || 3)) / 2, d = n >= 4 ? 0.85 : n === 3 ? 0.55 : 0.34;
      begin(1, S.reverbSend.chord);
      tone('square', root * 2, 0.09, 0.07 * L.chord, { f1: root * 8, glide: 0.08, lp: 6000 });
      for (let k = 0; k < n; k++) saw(semi(root, S.chord[k]), d, 0.17 * L.chord, { lp: 8000, lp1: 1800, spread: 14, wide: 0.5, at: 0.05 });
      clap(0.14 * L.chord, 0.05);
      sparkle(root * 4, n === 2 ? 3 : n === 3 ? 5 : 8, 30, 0.08 * L.chord, 0.07);
      if (q.low) thump(170, 55, 0.3, 0.42 * L.chord, 0.05);
    },
    riser: (q) => { begin(1, 0.25); rise(q.ms || 300, 0.14 * L.riser, q.top || 1760); }, // 溜め(決着・10 れんさの直前)
    ultFire: () => { // 必殺: ためて(風が上がる)→一撃→和音ときらめき
      begin(1, S.reverbSend.ult);
      rise(240, 0.12 * L.ult, 2093);
      noise(0.01, 0.5 * L.ult, { at: 0.24, type: 'bandpass', f: 3500 }); clap(0.25 * L.ult, 0.24); thump(260, 55, 0.3, 0.55 * L.ult, 0.24);
      for (let k = 0; k < 4; k++) saw(semi(262, S.chord[k]), 0.7, 0.13 * L.ult, { at: 0.24, lp: 8000, lp1: 1800, wide: 0.5 });
      sparkle(2093, 8, 30, 0.07 * L.ult, 0.26);
    },
    gauge: () => { // ゲージ割り: 割れる音+金属の大きな響き+和音
      begin(1, S.reverbSend.gauge);
      noise(0.25, 0.32 * L.gauge, { type: 'highpass', f: 2500 }); clap(0.22 * L.gauge);
      for (let k = 0; k < 4; k++) clink(2200 + rnd() * 3000, 0.08 * L.gauge, { at: rnd() * 0.15, pan: rnd() * 1.2 - 0.6 });
      fm(392, 1.0, 0.2 * L.gauge, { ratio: 1.41, index: 3.5, idxD: 0.5 });
      thump(200, 50, 0.35, 0.5 * L.gauge);
      for (let k = 0; k < 3; k++) saw(semi(392, S.chord[k]), 0.6, 0.12 * L.gauge, { at: 0.05, lp: 6500, lp1: 1500, wide: 0.5 });
      sparkle(1568, 6, 35, 0.06 * L.gauge, 0.1);
    },
    finale: (q) => { // 決着: 大きな一撃+パシッ+シンバル+開いていく和音+上がるきらめき。特別版はもう一段
      begin(2, S.reverbSend.finale);
      noise(0.012, 0.6 * L.finale, { type: 'bandpass', f: 3200 }); clap(0.35 * L.finale);
      thump(240, 42, 0.5, 0.7 * L.finale);
      noise(0.18, 0.35 * L.finale, { type: 'bandpass', f: 2400, f1: 600, q: 1 });
      noise(1.5, 0.2 * L.finale, { type: 'highpass', f: 6000, a: 3 });                      // シンバルのシャーン
      fm(3200, 1.2, 0.05 * L.finale, { ratio: 1.47, index: 3, idxD: 0.8 });
      for (let k = 0; k < 4; k++) saw(semi(262, S.chord[k]), 1.4, 0.15 * L.finale, { at: 0.04, lp: 1200, lp1: 7000, a: 30, wide: 0.6, voices: 2, spread: 16 }); // 閉じた音から開いていく
      sparkle(1047, 8, 50, 0.08 * L.finale, 0.08);
      if (q.special) {
        thump(200, 45, 0.45, 0.55 * L.finale, 0.35); clap(0.3 * L.finale, 0.35);
        sparkle(2093, 7, 40, 0.07 * L.finale, 0.4);
        for (let k = 0; k < 4; k++) saw(semi(523, S.chord[k]), 1.1, 0.08 * L.finale, { at: 0.35, lp: 3000, lp1: 9000, a: 40, wide: 0.8, voices: 2, spread: 16 });
      }
    },
    win: () => { // 勝ち: 鈴の 4 音で上がり、最後の音を伸ばして和音で支える
      const W = S.win; begin(2, S.reverbSend.win);
      W.semis.forEach((n, k) => fm(semi(523, n), k === W.semis.length - 1 ? W.lastMs / 1000 + 0.5 : 0.35, 0.2 * L.win, { at: k * W.noteMs / 1000, ratio: 2, index: 1.5 }));
      const last = (W.semis.length - 1) * W.noteMs / 1000;
      for (let k = 0; k < 3; k++) saw(semi(262, S.chord[k]), 1.1, 0.09 * L.win, { at: last, lp: 4500, lp1: 1500, a: 20, wide: 0.5 });
      sparkle(2093, 6, 40, 0.06 * L.win, last + 0.05);
    },
    lose: () => { begin(2, 0.1); S.lose.hz.forEach((hz, k) => tone('triangle', hz, 0.3, 0.14 * L.lose, { at: k * S.lose.noteMs / 1000, lp: 1600 })); },
  };
  R.explode = (q) => R.blast(Object.assign({ k2: 2 }, q || {}));

  return {
    unlock, prepare,
    get ready() { return !!(ac && master && ac.state !== 'suspended'); },
    get context() { return ac; },
    /** 指示表の sound / callout を鳴らす。名前のない音は鳴らさない */
    play(id, q) {
      if (!st.enabled) return false; if (!setup()) return false; const f = R[id]; if (!f) return false;
      try { f(q || {}); } catch (e) { cur = null; return false; }
      if (cur) finish();
      return true;
    },
    names: () => Object.keys(R),
    set(k, v) { if (k in st) st[k] = v; },
    get: (k) => st[k],
    chainSemi,
    liveCount: () => groups.filter((g) => g.end >= (ac ? ac.currentTime : 0)).length,
  };
}
