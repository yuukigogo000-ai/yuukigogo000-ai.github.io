// 「第 2 版の音」の写し(2026-11-16)。fx/audio-check.mjs が最終版との音量・明るさの比較に使う。本番では使わない
// はじきバトル 音の部品 第 2 版(端末の中で作る。音源ファイルは使わない)。数値は下の S_V2(当時の写し)。
// 第 1 版は「三角波 1 つ+短い減衰」で、細く小さかった(発注者「音色がショボい」2026-11-16)。第 2 版は 1 つの音を層で作る:
//   立ち上がりの粒(カチッ)+ 胴(音の芯)+ きらめき(高い倍音・鈴の粒)+ 響き(部屋の残響)
// スマホのスピーカーは 200Hz より下がほとんど出ない。低い「ドン」は、ひずませて倍音を足し、中音域で聞こえるようにする。
// 指示表(fx/director.js)の sound / callout をそのまま鳴らせる名前にしてある。
//  - 立ち上がりを数ミリ秒かける(いきなり最大にすると「プチッ」と鳴る)
//  - 同時に鳴る音は上限まで(呼びかけ > 節目・決着 > 当たり の順に残す)
//  - 呼びかけが鳴る間は、効果音を少し下げる(ダッキング)
//  - iPhone は最初のタップの中で準備しないと鳴らない → unlock() を「はじめる」などのタップで呼ぶ
// ctx に OfflineAudioContext を渡せば、鳴らさずに波形を作れる(fx/audio-check.mjs で数字を測る)
// 第 2 版の数値をそのまま持つ(数値の置き場を変えても、第 2 版の音は変わらない)
const S_V2 = {"attackMs":8,"voicesMax":6,"jitterSemi":0.5,"master":0.9,"limiter":{"thresholdDb":-4},"reverb":{"seconds":1.3,"preDelayMs":15,"level":0.9},"reverbSend":{"hit":0.22,"strong":0.25,"ring":0.3,"break":0.35,"blast":0.3,"chord":0.4,"ult":0.45,"gauge":0.45,"finale":0.55,"win":0.45,"voice":0.25},"level":{"ui":1,"step":1.3,"shoot":1.6,"tap":1,"rail":1,"hit":1.7,"strong":1.8,"harm":1,"relay":1.3,"crash":1.3,"bumper":1,"pickup":1.5,"bonus":1.5,"ring":1,"break":1,"blast":1,"chord":1,"ult":1,"gauge":1,"finale":1,"win":1,"lose":1,"voice":1.8},"scales":{"pentatonic":[0,2,4,7,9],"semitone":[0,1,2,3,4,5,6,7,8,9,10,11]},"scale":"semitone","chainBaseHz":523,"chainCap":10,"timbre":"glass","step":{"baseHz":523,"semis":[0,0,4,7],"legacySemis":[0,0,4,8]},"chord":[0,4,7,12],"duck":{"db":-6,"ms":250},"voice":"words","voiceSynth":{"f0":300,"formantScale":1.15,"formants":{"a":[750,1200,2600],"i":[300,2300,3000],"u":[350,1300,2400],"e":[500,1900,2600],"o":[500,850,2500]},"q":[8,11,14],"amp":[1,0.65,0.3],"vibratoHz":5.5,"vibratoDepth":0.015,"breath":0.12},"callout":{"layerSemi":4,"layersMax":3,"maxMs":800,"text1":"ナイス!","text2":"すごい!"},"win":{"semis":[0,4,7,12],"noteMs":90,"lastMs":420},"lose":{"hz":[392,311,233],"noteMs":120}};

export function createAudioV2(opts) {
  const S = S_V2, o = opts || {};
  let ac = o.ctx || null, master = null, sfxBus = null, voiceBus = null, revIn = null, sfxRev = null, voiceRev = null, noiseBuf = null, driveCurve = null;
  const maxVoices = o.voicesMax || S.voicesMax;
  const groups = []; // 鳴っている音(1 回の play を 1 つと数える)
  let cur = null;
  const st = { scale: o.scale || S.scale, step: o.step || 'new', attackMs: o.attackMs === undefined ? S.attackMs : o.attackMs,
               jitter: o.jitter === undefined ? S.jitterSemi : o.jitter, duck: o.duck !== false, timbre: o.timbre || S.timbre, voice: o.voice || S.voice, enabled: true };
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; // 音のゆらし用(勝ち負けには関係しない)

  function setup() {
    if (!ac) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false; ac = new AC(); }
    if (master) return true;
    master = ac.createGain(); master.gain.value = S.master;
    const lim = ac.createDynamicsCompressor(); // 割れ止め(大きな音が重なったときだけ効く)
    lim.threshold.value = S.limiter.thresholdDb; lim.knee.value = 2; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.12;
    master.connect(lim); lim.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    voiceBus = ac.createGain(); voiceBus.connect(master);
    // 響き: 減衰するノイズで作った部屋の残響(起動時に 1 回だけ作る)
    const R = S.reverb, len = Math.round(ac.sampleRate * R.seconds), ch = Math.min(2, ac.destination.channelCount || 2);
    const ir = ac.createBuffer(ch, len, ac.sampleRate);
    for (let c = 0; c < ch; c++) {
      const d = ir.getChannelData(c); let x = 99 + c * 7919, y = 0;
      const pre = Math.round(ac.sampleRate * R.preDelayMs / 1000), tau = R.seconds / 6.91;
      for (let k = pre; k < len; k++) {
        x = (x * 16807) % 2147483647; const n = x / 1073741823.5 - 1, t = (k - pre) / ac.sampleRate;
        const damp = 0.85 - 0.65 * Math.min(1, t / R.seconds); y += damp * (n - y); // 時間とともに高音が先に消える
        d[k] = y * Math.exp(-t / tau);
      }
    }
    const conv = ac.createConvolver(); conv.buffer = ir;
    revIn = ac.createGain(); const revOut = ac.createGain(); revOut.gain.value = R.level;
    revIn.connect(conv); conv.connect(revOut); revOut.connect(master);
    sfxRev = ac.createGain(); sfxRev.connect(revIn);     // 効果音の響き(ダッキングで一緒に下げる)
    voiceRev = ac.createGain(); voiceRev.connect(revIn); // 声の響き
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); let z = 7;
    for (let k = 0; k < nd.length; k++) { z = (z * 16807) % 2147483647; nd[k] = z / 1073741823.5 - 1; }
    driveCurve = new Float32Array(1024);
    for (let k = 0; k < 1024; k++) { const v = k / 511.5 - 1; driveCurve[k] = Math.tanh(3 * v) / Math.tanh(3); }
    return true;
  }
  function unlock() { if (!setup()) return false; if (ac.state === 'suspended' && ac.resume) ac.resume(); return true; }

  // ---- 1 回の音のまとまり(出口・左右・響きへの送り) -----------------------------------
  function begin(prio, rev, pan, bus) {
    const out = ac.createGain(), node = { nodes: [], end: 0, prio, out };
    let head = out;
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p); head = p; }
    head.connect(bus || sfxBus);
    if (rev > 0) { const s = ac.createGain(); s.gain.value = rev; head.connect(s); s.connect(bus === voiceBus ? voiceRev : sfxRev); }
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
  /** 単純な音: 波形・高さ(f → f1 に滑る)・長さ・音量 */
  function tone(type, f, d, vol, q) {
    q = q || {}; const t = T(q.at), s = ac.createOscillator(), g = ac.createGain();
    s.type = type; s.frequency.setValueAtTime(f, t); if (q.f1) s.frequency.exponentialRampToValueAtTime(q.f1, t + (q.glide || d));
    if (q.detune) s.detune.value = q.detune;
    let h = s; if (q.lp) { const b = filt('lowpass', q.lp, q.q, q.lp1, t, d); h.connect(b); h = b; }
    if (q.drive) { const w = ac.createWaveShaper(); w.curve = driveCurve; const pre = ac.createGain(); pre.gain.value = q.drive; h.connect(pre); pre.connect(w); h = w; }
    h.connect(g); g.connect(cur.out); env(g, t, vol, q.a, d); keep(s, t, d);
  }
  /** FM の鈴・ガラス・金属: 比(ratio)で質感、指数(index)で明るさ。指数は音と一緒に減る(鳴り始めが一番きらめく) */
  function fm(f, d, vol, q) {
    q = q || {}; const t = T(q.at), c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    c.type = 'sine'; m.type = 'sine'; c.frequency.setValueAtTime(f, t); m.frequency.setValueAtTime(f * (q.ratio || 3.5), t);
    const depth = f * (q.ratio || 3.5) * (q.index || 2);
    mg.gain.setValueAtTime(depth, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.02), t + (q.idxD || d * 0.5));
    m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(cur.out);
    env(g, t, vol, q.a === undefined ? 2 : q.a, d); keep(c, t, d); keep(m, t, d);
  }
  /** 厚い和音の芯: のこぎり波を少しずつずらして重ね、明るさのフィルターを閉じていく */
  function saw(f, d, vol, q) {
    q = q || {}; const n = q.voices || 3;
    for (let k = 0; k < n; k++) tone('sawtooth', f, d, vol / n, { at: q.at, detune: (k - (n - 1) / 2) * (q.spread || 12), lp: q.lp || 6000, lp1: q.lp1 || 1500, q: 0.9, a: q.a === undefined ? 6 : q.a });
  }
  /** ノイズ: 帯域(type・f → f1)を通した「シュッ」「ザッ」「カッ」 */
  function noise(d, vol, q) {
    q = q || {}; const t = T(q.at), src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true; src.loopStart = rnd() * 0.5;
    const b = filt(q.type || 'bandpass', q.f || 2000, q.q || 0.8, q.f1, t, d);
    src.connect(b); b.connect(g); g.connect(cur.out);
    env(g, t, vol, q.a === undefined ? 1.5 : q.a, d); keep(src, t, d);
  }
  /** ガラス・陶器の「チン」: 調和しない倍音を、それぞれ違う速さで消す */
  function clink(f, vol, q) {
    q = q || {};
    const P = q.partials || [[1, 1, 0.09], [2.76, 0.55, 0.05], [5.4, 0.3, 0.03], [8.93, 0.15, 0.02]];
    for (const [r, a, dd] of P) tone('sine', f * r, dd * (q.len || 1), vol * a, { at: q.at, a: 1.5 });
  }
  /** 低い「ドン」: 高さが落ちるサイン波をひずませる(倍音でスマホでも聞こえる) */
  const thump = (f0, f1, d, vol, at) => tone('sine', f0, d, vol, { f1, glide: d * 0.7, drive: 2.5, at, a: 2 });
  /** きらめき: 鈴の粒を速く並べる */
  function sparkle(base, steps, gapMs, vol, at, up) {
    const P = [0, 4, 7, 12, 16, 19, 24, 28, 31, 36];
    for (let k = 0; k < steps; k++) fm(semi(base, up === false ? P[steps - 1 - k] : P[k % P.length]), 0.28, vol * (1 - k * 0.05), { at: (at || 0) + k * gapMs / 1000, ratio: 3.5, index: 1.2 });
  }
  /** れんさ n 回目の高さ(半音) */
  function chainSemi(n) {
    const sc = S.scales[st.scale] || S.scales.semitone, k = Math.max(0, Math.min(S.chainCap, n) - 1);
    return sc[k % sc.length] + 12 * Math.floor(k / sc.length);
  }
  const jit = () => (st.jitter ? (rnd() * 2 - 1) * st.jitter : 0);
  const chainHz = (n) => semi(S.chainBaseHz, chainSemi(n) + jit());

  // ---- 呼びかけ(声): のこぎり波+息の音を、母音の帯域の山 3 つに通す。子音は短い無音・破裂・摩擦で作る ----
  const V = S.voiceSynth;
  function speak(word, baseHz, at, vol, shift) {
    const F = (v) => V.formants[v].map((x) => x * V.formantScale);
    const t0 = T(at), segs = word; // [{ c: 子音, v: 母音, ms, p: 高さ(半音) }]
    let dur = 0; for (const s of segs) dur += s.ms / 1000;
    const src = ac.createOscillator(); src.type = 'sawtooth';
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = V.vibratoHz; lg.gain.value = baseHz * V.vibratoDepth; lfo.connect(lg); lg.connect(src.frequency);
    const breath = ac.createBufferSource(); breath.buffer = noiseBuf; breath.loop = true;
    const bf = ac.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2500; bf.Q.value = 0.6;
    const bg = ac.createGain(); bg.gain.value = V.breath; breath.connect(bf); bf.connect(bg);
    const sum = ac.createGain(), voiced = ac.createGain(); voiced.gain.value = 1;
    src.connect(voiced);
    const fl = [0, 1, 2].map((k) => { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = V.q[k]; const gg = ac.createGain(); gg.gain.value = V.amp[k]; voiced.connect(b); bg.connect(b); b.connect(gg); gg.connect(sum); return b; });
    const out = ac.createGain(); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5500;
    sum.connect(lp); lp.connect(out); out.connect(cur.out);
    // 摩擦音(す・さ)の道
    const hiss = ac.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true;
    const hf = ac.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 4200; const hg = ac.createGain(); hg.gain.value = 0.0001;
    hiss.connect(hf); hf.connect(hg); hg.connect(cur.out);
    out.gain.setValueAtTime(0.0001, t0);
    src.frequency.setValueAtTime(semi(baseHz, (segs[0].p || 0) + (shift || 0)), t0);
    fl.forEach((b, k) => b.frequency.setValueAtTime(F(segs[0].v || 'a')[k], t0));
    let t = t0;
    for (const s of segs) {
      const d = s.ms / 1000, f = F(s.v || 'a'), hz = semi(baseHz, (s.p || 0) + (shift || 0));
      src.frequency.setTargetAtTime(hz, t, 0.012);
      const loud = s.c === 'n' ? 0.45 : 1;
      if (s.c === 's') { // 無声の摩擦: 声を止めてシーッ
        hg.gain.setTargetAtTime(vol * 0.4, t, 0.006); hg.gain.setTargetAtTime(0.0001, t + d * 0.45, 0.008);
        out.gain.setTargetAtTime(0.0001, t, 0.004); out.gain.setTargetAtTime(vol, t + d * 0.45, 0.01);
      } else if (s.c === 'g' || s.c === 'k' || s.c === 'b') { // 破裂: 一瞬閉じて、開く
        out.gain.setTargetAtTime(0.0001, t, 0.004); out.gain.setTargetAtTime(vol, t + 0.028, 0.006);
        if (s.c === 'b') fl.forEach((b, k) => b.frequency.setValueAtTime([300, 900, 2200][k] * V.formantScale, t + 0.02));
      } else {
        out.gain.setTargetAtTime(vol * loud, t, 0.012);
      }
      const nasal = s.c === 'n';
      fl.forEach((b, k) => b.frequency.setTargetAtTime(nasal ? [280, 1100, 2500][k] * V.formantScale : f[k], t + (s.c === 'b' ? 0.03 : 0), nasal ? 0.006 : 0.02));
      if (nasal) fl.forEach((b, k) => b.frequency.setTargetAtTime(f[k], t + d * 0.5, 0.015));
      t += d;
    }
    out.gain.setTargetAtTime(0.0001, t - 0.04, 0.03);
    for (const n of [src, lfo, breath, hiss]) { n.start(t0); n.stop(t + 0.15); cur.nodes.push(n); }
    if (t + 0.15 > cur.end) cur.end = t + 0.15;
    return t - t0;
  }
  // 言葉の形(子音・母音・長さ・高さ)。高さは語尾で上げて「!」にする
  const WORDS = {
    nice: [{ c: 'n', v: 'a', ms: 120, p: 0 }, { v: 'i', ms: 110, p: 2 }, { c: 's', v: 'u', ms: 150, p: 3 }],           // ナイス!
    sugoi: [{ c: 's', v: 'u', ms: 130, p: 0 }, { c: 'g', v: 'o', ms: 150, p: 3 }, { v: 'i', ms: 210, p: 7 }],           // すごい!
    vowel1: [{ v: 'a', ms: 130, p: 0 }, { v: 'i', ms: 230, p: 5 }],                                                     // あー・いっ(言葉なし)
    vowel2: [{ v: 'a', ms: 110, p: 0 }, { v: 'a', ms: 110, p: 1 }, { v: 'o', ms: 110, p: 2 }, { v: 'e', ms: 240, p: 5 }],
  };
  function tts(text, layers) { // 端末の読み上げ(聴き比べ用。機種で声が変わる)
    try {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = 1.15; u.pitch = 1.3 + 0.15 * ((layers || 1) - 1); u.volume = 1;
      speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  }
  function duck(ms) {
    if (!st.duck) return;
    const s = ac.currentTime, k = Math.pow(10, S.duck.db / 20);
    for (const g of [sfxBus.gain, sfxRev.gain]) {
      g.cancelScheduledValues(s); g.setValueAtTime(g.value, s);
      g.linearRampToValueAtTime(k, s + 0.02); g.setValueAtTime(k, s + ms / 1000); g.linearRampToValueAtTime(1, s + ms / 1000 + 0.08);
    }
  }

  const L = S.level; // 音ごとの大きさ(tokens)
  const HIT = { // 当たりの音色 3 種(発注者が選ぶ)
    glass: (hz, v) => { noise(0.006, 0.35 * v, { type: 'highpass', f: 4000 }); clink(hz * 3.2, 0.12 * v); fm(hz, 0.42, 0.3 * v, { ratio: 3.5, index: 1.6, idxD: 0.06 }); tone('sine', hz, 0.3, 0.12 * v); },
    marimba: (hz, v) => { noise(0.008, 0.25 * v, { type: 'bandpass', f: 1800, q: 1.2 }); tone('sine', hz, 0.32, 0.38 * v, { a: 1.5 }); tone('sine', hz * 4, 0.07, 0.12 * v, { a: 1.5 }); tone('sine', hz * 10, 0.02, 0.05 * v, { a: 1 }); },
    bell: (hz, v) => { noise(0.005, 0.25 * v, { type: 'highpass', f: 5000 }); fm(hz, 0.7, 0.3 * v, { ratio: 1.4, index: 2.2, idxD: 0.2 }); fm(hz * 2, 0.4, 0.1 * v, { ratio: 3.5, index: 1 }); },
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
    shoot: (q) => { // 発射: シュッと抜ける風切り+短い上昇音。強い手は低い押し出し
      const p = q.p || 1; begin(0, 0.12, 0);
      noise(0.09 + p * 0.03, (0.18 + p * 0.06) * L.shoot, { type: 'bandpass', f: 500, f1: 2400 + p * 500, q: 1.1, a: 4 });
      tone('sine', 320 + p * 60, 0.07, 0.12 * L.shoot, { f1: 700 + p * 120, a: 2 });
      if (p >= 3) thump(160, 70, 0.12, 0.3 * L.shoot);
    },
    // 当たり
    tap: (q) => { begin(0, 0.08); clink(2600 + Math.min(900, (q.v || 300)) * 0.6, 0.05 * L.tap, { len: 0.7 }); },
    rail: (q) => { const v = Math.min(1, (q.v || 300) / 1200); begin(0, 0.06); tone('sine', 190, 0.06, 0.18 * v * L.rail, { f1: 140, a: 1.5 }); noise(0.035, 0.12 * v * L.rail, { type: 'lowpass', f: 900 }); },
    hit: (q) => { begin(0, S.reverbSend.hit, q.pan); HIT[st.timbre] ? HIT[st.timbre](chainHz(q.n || 1), L.hit) : HIT.glass(chainHz(q.n || 1), L.hit); },
    strong: () => { // 強打: カッ(立ち上がり)+ドン(ひずませた低音)+バキッ(割れる帯域)+チーン(ガラスの響き)
      begin(1, S.reverbSend.strong);
      noise(0.008, 0.5 * L.strong, { type: 'bandpass', f: 3500, q: 0.9 });
      thump(280, 70, 0.16, 0.55 * L.strong);
      noise(0.14, 0.32 * L.strong, { type: 'bandpass', f: 2200, f1: 700, q: 1.1, a: 2 });
      fm(1760, 0.32, 0.1 * L.strong, { ratio: 3.5, index: 1.4, at: 0.004 });
    },
    harm: () => { begin(0, 0.08); thump(170, 80, 0.16, 0.3 * L.harm); noise(0.08, 0.14 * L.harm, { type: 'lowpass', f: 700 }); },
    relay: () => { begin(0, 0.2); clink(2093, 0.13 * L.relay); clink(2794, 0.13 * L.relay, { at: 0.055 }); fm(1047, 0.25, 0.1 * L.relay, { at: 0.055, ratio: 3.5, index: 1 }); },
    crash: () => { begin(0, 0.12); tone('sine', 520, 0.07, 0.2 * L.crash, { f1: 400, a: 1.5 }); noise(0.05, 0.22 * L.crash, { type: 'bandpass', f: 1000, q: 1.4 }); thump(210, 90, 0.1, 0.25 * L.crash); },
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
    ring: () => { // 敵の場外: ヒューンと落ちていき、最後にポン
      begin(1, S.reverbSend.ring);
      tone('sawtooth', 900, 0.3, 0.12 * L.ring, { f1: 260, glide: 0.28, lp: 3000, lp1: 900 });
      noise(0.26, 0.12 * L.ring, { type: 'bandpass', f: 2200, f1: 500, q: 1.2, a: 6 });
      thump(220, 110, 0.1, 0.3 * L.ring, 0.26);
      sparkle(1568, 3, 45, 0.06 * L.ring, 0.28, false);
    },
    break: () => { // 撃破: 写真シールが割れる。ガラスの破片の粒をばらまく
      begin(1, S.reverbSend.break);
      noise(0.22, 0.3 * L.break, { type: 'highpass', f: 3000, a: 1.5 });
      thump(200, 70, 0.14, 0.38 * L.break);
      for (let k = 0; k < 8; k++) clink(2500 + rnd() * 3500, 0.07 * L.break, { at: 0.01 + rnd() * 0.18, len: 0.6 + rnd() * 0.6 });
      sparkle(2093, 3, 40, 0.05 * L.break, 0.12);
    },
    blast: (q) => { // 花火: ドン+ザーッ+パチパチ。2 発目からは小さく
      const k2 = q.k2 || 1, s = k2 > 1 ? 0.55 : 1;
      begin(1, S.reverbSend.blast * s, q.pan);
      thump(150, 42, 0.4, 0.6 * s * L.blast);
      noise(0.45 * s + 0.1, 0.4 * s * L.blast, { type: 'lowpass', f: 4500, f1: 250, q: 0.7, a: 2 });
      for (let k = 0; k < (k2 > 1 ? 3 : 7); k++) noise(0.012, 0.18 * s * L.blast, { at: 0.04 + rnd() * 0.25, type: 'highpass', f: 2500 + rnd() * 3000 });
    },
    chord: (q) => { // 節目: 厚い和音の一撃+きらめき。高さはそのときのれんさの音から
      const n = q.notes || 2, root = chainHz(Math.min(S.chainCap, q.n || 3)) / 2, d = n >= 4 ? 0.8 : n === 3 ? 0.5 : 0.32;
      begin(1, S.reverbSend.chord);
      for (let k = 0; k < n; k++) saw(semi(root, S.chord[k]), d, 0.16 * L.chord, { lp: 7000, lp1: 1600, spread: 14 });
      sparkle(root * 4, n === 2 ? 3 : n === 3 ? 5 : 8, 32, 0.07 * L.chord, 0.02);
      if (q.low) thump(170, 55, 0.3, 0.4 * L.chord);
    },
    ultFire: () => { // 必殺: ためて(風が上がる)→一撃→和音ときらめき
      begin(1, S.reverbSend.ult);
      noise(0.24, 0.3 * L.ult, { type: 'bandpass', f: 350, f1: 5000, q: 1.3, a: 200 });
      noise(0.01, 0.5 * L.ult, { at: 0.24, type: 'bandpass', f: 3500 }); thump(260, 55, 0.3, 0.55 * L.ult, 0.24);
      for (let k = 0; k < 4; k++) saw(semi(262, S.chord[k]), 0.7, 0.13 * L.ult, { at: 0.24, lp: 8000, lp1: 1800 });
      sparkle(2093, 8, 30, 0.07 * L.ult, 0.26);
    },
    gauge: () => { // ゲージ割り: 割れる音+金属の大きな響き+和音
      begin(1, S.reverbSend.gauge);
      noise(0.25, 0.32 * L.gauge, { type: 'highpass', f: 2500 });
      for (let k = 0; k < 6; k++) clink(2200 + rnd() * 3000, 0.07 * L.gauge, { at: rnd() * 0.15 });
      fm(392, 1.0, 0.2 * L.gauge, { ratio: 1.41, index: 3.5, idxD: 0.5 });
      thump(200, 50, 0.35, 0.5 * L.gauge);
      for (let k = 0; k < 3; k++) saw(semi(392, S.chord[k]), 0.6, 0.12 * L.gauge, { at: 0.05, lp: 6500, lp1: 1500 });
      sparkle(1568, 6, 35, 0.06 * L.gauge, 0.1);
    },
    finale: (q) => { // 決着: 大きな一撃+シンバル+開いていく和音+上がるきらめき。特別版はもう一段
      begin(2, S.reverbSend.finale);
      noise(0.012, 0.6 * L.finale, { type: 'bandpass', f: 3200 });
      thump(240, 42, 0.5, 0.7 * L.finale);
      noise(0.18, 0.35 * L.finale, { type: 'bandpass', f: 2400, f1: 600, q: 1 });
      noise(1.5, 0.2 * L.finale, { type: 'highpass', f: 6000, a: 3 });                      // シンバルのシャーン
      fm(3200, 1.2, 0.05 * L.finale, { ratio: 1.47, index: 3, idxD: 0.8 });
      for (let k = 0; k < 4; k++) saw(semi(262, S.chord[k]), 1.4, 0.14 * L.finale, { at: 0.04, lp: 1200, lp1: 7000, a: 30 }); // 閉じた音から開いていく
      sparkle(1047, 10, 45, 0.07 * L.finale, 0.08);
      if (q.special) {
        thump(200, 45, 0.45, 0.55 * L.finale, 0.35);
        sparkle(2093, 10, 35, 0.07 * L.finale, 0.4);
        for (const [n, k] of [[0, 0], [4, 1], [7, 2]]) speak([{ v: 'a', ms: 650, p: n }], 262, 0.35 + k * 0.02, 0.07 * L.finale); // 歓声の「あー」を 3 声で
      }
    },
    win: () => { // 勝ち: 鈴の 4 音で上がり、最後の音を伸ばして和音で支える
      const W = S.win; begin(2, S.reverbSend.win);
      W.semis.forEach((n, k) => fm(semi(523, n), k === W.semis.length - 1 ? W.lastMs / 1000 + 0.5 : 0.35, 0.2 * L.win, { at: k * W.noteMs / 1000, ratio: 3.5, index: 1.5 }));
      const last = (W.semis.length - 1) * W.noteMs / 1000;
      for (let k = 0; k < 3; k++) saw(semi(262, S.chord[k]), 1.1, 0.09 * L.win, { at: last, lp: 4500, lp1: 1500, a: 20 });
      sparkle(2093, 6, 40, 0.06 * L.win, last + 0.05);
    },
    lose: () => { begin(2, 0.1); S.lose.hz.forEach((hz, k) => tone('triangle', hz, 0.3, 0.14 * L.lose, { at: k * S.lose.noteMs / 1000, lp: 1600 })); },
    // 呼びかけ: 5 れんさは 1 回、10 れんさは声を重ねる(重ねるほど厚く高く)
    callout: (q) => {
      const C = S.callout, layers = Math.max(1, Math.min(C.layersMax, q.layers || 1));
      if (st.voice === 'tts') { tts(layers === 1 ? C.text1 : C.text2, layers); return; }
      begin(2, S.reverbSend.voice, 0, voiceBus);
      const w = st.voice === 'vowel' ? (layers === 1 ? WORDS.vowel1 : WORDS.vowel2) : (layers === 1 ? WORDS.nice : WORDS.sugoi);
      let len = 0;
      for (let L2 = 0; L2 < layers; L2++) len = Math.max(len, speak(w, semi(V.f0, L2 * C.layerSemi), L2 * 0.018, (L2 ? 0.7 : 1) * 0.28 * L.voice, 0));
      duck(Math.min(C.maxMs, len * 1000));
    },
  };
  R.explode = (q) => R.blast(Object.assign({ k2: 2 }, q || {}));

  return {
    unlock,
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
