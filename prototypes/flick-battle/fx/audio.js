// はじきバトル 音の部品(端末の中で作る。音源ファイルは使わない)。数値はすべて fx/tokens.js の FXT.sound。
// 指示表(fx/director.js)の sound / callout をそのまま鳴らせる名前にしてある。
//  - 立ち上がりを数ミリ秒かける(いきなり最大にすると「プチッ」と鳴る)
//  - 同時に鳴る数に上限(古いものから止める)
//  - 呼びかけが鳴る間は、効果音を少し下げる(ダッキング)
//  - iPhone は最初のタップの中で準備しないと鳴らない → unlock() を「はじめる」などのタップで呼ぶ
// ctx に OfflineAudioContext を渡せば、鳴らさずに波形を作れる(fx/audio-check.mjs で数字を測る)
import { FXT } from './tokens.js';

export function createAudio(opts) {
  const S = FXT.sound, o = opts || {};
  let ac = o.ctx || null, master = null, sfxBus = null, voiceBus = null, noiseBuf = null;
  const live = []; // 鳴っている音(上限の管理)
  let scale = o.scale || S.scale, stepSet = o.step || 'new', attackMs = o.attackMs === undefined ? S.attackMs : o.attackMs, jitter = o.jitter === undefined ? S.jitterSemi : o.jitter;
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; // 音のゆらし用(勝ち負けには関係しない)
  let enabled = true, duckOn = o.duck !== false;

  function setup() {
    if (!ac) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false; ac = new AC(); }
    if (master) return true;
    master = ac.createGain(); master.gain.value = S.master;
    master.connect(ac.destination); // 圧縮器は使わない(短い音の音量が読めなくなる)。割れないことは、同時の数の上限と audio-check で守る
    sfxBus = ac.createGain(); sfxBus.connect(master);
    voiceBus = ac.createGain(); voiceBus.connect(master);
    noiseBuf = ac.createBuffer(1, Math.round(ac.sampleRate * 0.5), ac.sampleRate);
    const d = noiseBuf.getChannelData(0); let x = 7;
    for (let k = 0; k < d.length; k++) { x = (x * 16807) % 2147483647; d[k] = x / 1073741823.5 - 1; }
    return true;
  }
  /** 最初のタップの中で呼ぶ */
  function unlock() { if (!setup()) return false; if (ac.state === 'suspended' && ac.resume) ac.resume(); return true; }

  const semi = (hz, n) => hz * Math.pow(2, n / 12);
  const t0 = (delay) => ac.currentTime + (delay || 0) + 0.005;
  let prio = 0; // いま作っている音の優先度(呼びかけ 2 > 節目・決着 1 > 当たり 0)。上限を超えたら、優先度の低い古い音から止める
  function track(node, end) {
    live.push({ node, end, prio });
    for (let k = live.length - 1; k >= 0; k--) if (live[k].end < ac.currentTime) live.splice(k, 1);
    while (live.length > S.voicesMax) {
      let at = 0; for (let k = 1; k < live.length; k++) if (live[k].prio < live[at].prio) at = k;
      const v = live.splice(at, 1)[0]; try { v.node.stop(); } catch (e) { /* もう止まっている */ }
    }
  }
  const PRIO = { callout: 2, chord: 1, finale: 1, gauge: 1, ultFire: 1, win: 1, lose: 1 };
  /** 1 音: 波形・高さ(または [始め, 終わり] の滑り)・長さ・音量・遅れ・出口 */
  function note(type, hz, dur, vol, delay, bus, filter) {
    const s = t0(delay), o2 = ac.createOscillator(), g = ac.createGain();
    o2.type = type;
    if (Array.isArray(hz)) { o2.frequency.setValueAtTime(hz[0], s); o2.frequency.exponentialRampToValueAtTime(hz[1], s + dur); }
    else o2.frequency.setValueAtTime(hz, s);
    const a = Math.max(0.001, attackMs / 1000);
    g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(vol, s + Math.min(a, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    let head = o2;
    if (filter) { const f = ac.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.hz; f.Q.value = filter.q || 1; o2.connect(f); head = f; }
    head.connect(g); g.connect(bus || sfxBus);
    o2.start(s); o2.stop(s + dur + 0.03);
    track(o2, s + dur);
  }
  function noise(dur, vol, delay, hz, q) {
    const s = t0(delay), src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = hz || 1800; f.Q.value = q || 0.8;
    g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(vol, s + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(s); src.stop(s + dur + 0.02);
    track(src, s + dur);
  }
  /** れんさ n 回目の高さ(半音) */
  function chainSemi(n) {
    const sc = S.scales[scale] || S.scales.pentatonic, k = Math.max(0, Math.min(S.chainCap, n) - 1);
    return sc[k % sc.length] + 12 * Math.floor(k / sc.length);
  }
  const jit = () => (jitter ? (rnd() * 2 - 1) * jitter : 0);

  // 呼びかけ: のこぎり波を母音の帯域の山 2 つに通した、声っぽい音
  function syllable(vowel, hz, dur, vol, delay) {
    const f = S.formants[vowel] || S.formants.a, s = t0(delay);
    const src = ac.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(hz, s); src.frequency.linearRampToValueAtTime(hz * 1.04, s + dur * 0.6); // 少し上ずる
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(vol, s + 0.012); g.gain.setValueAtTime(vol, s + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    for (const [fr, q, k] of [[f[0], 6, 1], [f[1], 9, 0.6]]) {
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q;
      const gg = ac.createGain(); gg.gain.value = k * 3;
      src.connect(bp); bp.connect(gg); gg.connect(g);
    }
    g.connect(voiceBus);
    src.start(s); src.stop(s + dur + 0.03);
    track(src, s + dur);
  }
  function duck(ms) {
    if (!duckOn) return;
    const s = ac.currentTime, k = Math.pow(10, S.duck.db / 20);
    sfxBus.gain.cancelScheduledValues(s); sfxBus.gain.setValueAtTime(sfxBus.gain.value, s);
    sfxBus.gain.linearRampToValueAtTime(k, s + 0.02); sfxBus.gain.setValueAtTime(k, s + ms / 1000); sfxBus.gain.linearRampToValueAtTime(1, s + ms / 1000 + 0.08);
  }

  const R = {
    // 画面の操作
    ui: () => note('sine', 660, 0.04, 0.06),
    step: (q) => { const p = q.p || 0, set = stepSet === 'legacy' ? S.step.legacySemis : S.step.semis; note('square', semi(S.step.baseHz, set[p] || 0), 0.05, 0.05); },
    cancel: () => note('sine', 220, 0.08, 0.06),
    shoot: (q) => { const p = q.p || 1; note('triangle', semi(220, p * 3), 0.09, 0.1); if (p >= 3) note('sine', 110, 0.12, 0.06); },
    // 当たり
    tap: (q) => note('sine', 500 + Math.min(600, (q && q.v) || 300) * 0.4, 0.04, 0.035),
    rail: (q) => noise(0.05, Math.min(0.06, ((q && q.v) || 300) / 12000), 0, 700, 1.2),
    hit: (q) => note('triangle', semi(S.chainBaseHz, chainSemi((q && q.n) || 1) + jit()), 0.07, 0.12),
    strong: () => { noise(0.012, 0.16, 0, 3000, 0.7); note('sawtooth', [180, 90], 0.16, 0.12); note('triangle', 220, 0.1, 0.08, 0.01); }, // 立ち上がり・胴・余韻の 3 層
    harm: () => note('sine', [180, 120], 0.14, 0.09),
    relay: () => { note('sine', 660, 0.05, 0.07); note('sine', 880, 0.06, 0.07, 0.05); },
    crash: () => { noise(0.03, 0.08, 0, 900); note('square', 150, 0.08, 0.07); },
    bumper: () => note('square', 880, 0.05, 0.05),
    pickup: () => { note('sine', 784, 0.07, 0.08); note('sine', 1047, 0.09, 0.08, 0.06); },
    bonus: () => { note('triangle', 523, 0.08, 0.1); note('triangle', 784, 0.14, 0.1, 0.08); },
    ring: () => note('triangle', [523, 330], 0.22, 0.11), // 場外は下がって終わる
    blast: (q) => { const k = (q && q.k2) || 1; noise(0.12, k > 1 ? 0.05 : 0.1, 0, 500, 0.6); note('sine', [140, 70], 0.18, k > 1 ? 0.06 : 0.11); },
    chord: (q) => { // 節目の和音(3 は 2 音、5 は 3 音、10 は 4 音)。高さはそのときのれんさの音から
      const n = (q && q.notes) || 2, base = semi(S.chainBaseHz, chainSemi(Math.min(S.chainCap, (q && q.n) || 3)));
      for (let k = 0; k < n; k++) note('triangle', semi(base, S.chord[k]), 0.22 + k * 0.03, 0.08, k * 0.035);
      if (q && q.low) note('sine', 110, 0.3, 0.1);
    },
    ultFire: () => { note('sawtooth', [300, 1200], 0.25, 0.06, 0, null, { type: 'lowpass', hz: 2400 }); noise(0.02, 0.12, 0.25, 2500); R.chord({ notes: 3, n: 8, low: true }); },
    gauge: () => { note('triangle', [392, 784], 0.3, 0.07); noise(0.03, 0.12, 0.3, 2000); for (let k = 0; k < 3; k++) note('triangle', semi(784, S.chord[k]), 0.35, 0.07, 0.3 + k * 0.04); note('sine', 98, 0.4, 0.1, 0.3); },
    finale: (q) => {
      noise(0.03, 0.16, 0, 2200); note('sawtooth', [220, 110], 0.25, 0.1);
      for (let k = 0; k < 4; k++) note('triangle', semi(523, S.chord[k]), 0.5, 0.07, 0.05 + k * 0.05);
      if (q && q.special) for (let k = 0; k < 6; k++) note('sine', semi(1047, [0, 4, 7, 12, 16, 19][k]), 0.12, 0.05, 0.3 + k * 0.06);
    },
    win: () => { const W = S.win; W.semis.forEach((n, k) => note('triangle', semi(523, n), k === W.semis.length - 1 ? W.lastMs / 1000 : 0.2, 0.1, k * W.noteMs / 1000)); },
    lose: () => S.lose.hz.forEach((hz, k) => note('triangle', hz, 0.25, 0.09, k * S.lose.noteMs / 1000)),
    // 呼びかけ: 5 れんさは 1 回、10 れんさは重ねる(重ねるたびに高く)
    callout: (q) => {
      const C = S.callout, layers = Math.max(1, Math.min(C.layersMax, (q && q.layers) || 1));
      const word = layers === 1 ? ['a', 'i'] : ['a', 'a', 'o', 'e'];
      let t = 0;
      for (let L = 0; L < layers; L++) {
        const base = semi(C.baseHz, L * C.layerSemi);
        word.forEach((v, k) => syllable(v, semi(base, k === word.length - 1 ? C.riseSemi : k), (k === word.length - 1 ? 2.2 : 1) * C.noteMs / 1000, 0.09, (t + k * (C.noteMs + C.gapMs)) / 1000));
        t += layers === 1 ? 0 : (C.noteMs + C.gapMs) * 1.5;
      }
      duck(Math.min(C.maxMs, t + word.length * (C.noteMs + C.gapMs)));
    },
  };

  return {
    unlock,
    get ready() { return !!(ac && master && ac.state !== 'suspended'); },
    get context() { return ac; },
    /** 指示表の sound / callout を鳴らす。名前のない音は鳴らさない */
    play(id, q) { if (!enabled) return false; if (!setup()) return false; const f = R[id]; if (!f) return false; prio = PRIO[id] || 0; try { f(q || {}); } catch (e) { return false; } finally { prio = 0; } return true; },
    names: () => Object.keys(R),
    set(k, v) { if (k === 'scale') scale = v; else if (k === 'step') stepSet = v; else if (k === 'attackMs') attackMs = v; else if (k === 'jitter') jitter = v; else if (k === 'duck') duckOn = v; else if (k === 'enabled') enabled = v; },
    chainSemi,
    liveCount: () => live.filter((v) => v.end >= (ac ? ac.currentTime : 0)).length,
  };
}
