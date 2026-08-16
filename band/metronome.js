// メトロノーム:Web Audio のルックアヘッドスケジューラで揺れのないクリックを刻む。
// setInterval で先の音を予約し続け、発音タイミングは AudioContext の時計に任せる方式。
// クリックエンジン(engine)は UI から独立していて、通し練習モードからも使われる。

import { store, save } from "./store.js";

const LOOKAHEAD_MS = 25;       // スケジューラの起床間隔
const SCHEDULE_AHEAD = 0.12;   // 何秒先まで予約するか

// ---------- エンジン ----------

export const engine = {
  running: false,
  params: { bpm: 120, beats: 4, sub: 1, vol: 70, accent: true },
  countInBars: 0,              // 開始時のカウントイン小節数
  onBeat: null,                // (beat, bar, isCountIn) => void  ※拍頭のみ
  onBar: null,                 // (bar) => void  ※カウントイン明けの小節頭
  isMuted: null,               // (bar) => boolean  ※抜き練習用(視覚は鳴らす)

  _ctx: null, _timer: null, _nextTime: 0,
  _beat: 0, _sub: 0, _bar: 0, _queue: [],

  ctx() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  },

  start(opts = {}) {
    if (this.running) this.stop();
    Object.assign(this.params, opts.params || {});
    this.countInBars = opts.countInBars || 0;
    const ctx = this.ctx();
    ctx.resume();
    this.running = true;
    this._beat = 0;
    this._sub = 0;
    this._bar = -this.countInBars;   // 負の小節番号 = カウントイン
    this._queue = [];
    this._nextTime = ctx.currentTime + 0.08;
    this._timer = setInterval(() => this._schedule(), LOOKAHEAD_MS);
    this._drain();
  },

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this._timer);
    this._queue = [];
  },

  setBpm(bpm) { this.params.bpm = bpm; },

  _schedule() {
    const ctx = this._ctx;
    while (this._nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this._click(this._beat, this._sub, this._bar, this._nextTime);
      const secPerBeat = 60 / this.params.bpm;
      this._nextTime += secPerBeat / this.params.sub;
      this._sub++;
      if (this._sub >= this.params.sub) {
        this._sub = 0;
        this._beat++;
        if (this._beat >= this.params.beats) {
          this._beat = 0;
          this._bar++;
        }
      }
    }
  },

  _click(beat, subI, bar, time) {
    const ctx = this._ctx;
    const countIn = bar < 0;
    const isHead = beat === 0 && subI === 0;
    const isBeat = subI === 0;
    const accent = this.params.accent && isHead;
    const muted = !countIn && this.isMuted && this.isMuted(bar);

    if (!muted) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      // カウントインは全拍高めの音で「入り」を分からせる
      osc.frequency.value = countIn ? 2093 : accent ? 1760 : isBeat ? 1318 : 987;
      const vol = (this.params.vol / 100) * (countIn ? 0.9 : accent ? 1 : isBeat ? 0.75 : 0.4);
      gain.gain.setValueAtTime(Math.max(0.0001, vol), time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.06);
    }

    if (isBeat) {
      this._queue.push({ time, beat, bar, countIn });
      // バックグラウンドで rAF が止まっている間に溜まりすぎないように
      if (this._queue.length > 128) this._queue.shift();
    }
  },

  // 予約済みイベントを実時間でコールバックに流す(見た目・小節フックの同期)
  _drain() {
    if (!this.running) return;
    const now = this._ctx.currentTime;
    while (this._queue.length && this._queue[0].time <= now) {
      const ev = this._queue.shift();
      if (this.onBeat) this.onBeat(ev.beat, ev.bar, ev.countIn);
      if (this.onBar && ev.beat === 0 && ev.bar >= 0) this.onBar(ev.bar);
    }
    requestAnimationFrame(() => this._drain());
  },
};

// ---------- 画面共通:WakeLock ----------

let wakeLock = null;
export async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    }
  } catch { /* 対応外・省電力モードなどは無視 */ }
}
export function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && engine.running && !wakeLock) requestWakeLock();
});

// ---------- メトロノームタブ UI ----------

let els = null;
let loadedSong = null;       // セトリから読み込んだ曲名(表示用)
let uiRunning = false;       // このタブがエンジンを使用中か(通し練習と区別)
let trainerBaseBpm = null;   // トレーナー開始時のBPM(停止時に戻す)

function flashDot(beat, countIn) {
  const dots = els.beatDots.children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle("hit", i === beat);
    dots[i].classList.toggle("head", i === beat && (beat === 0 || countIn));
  }
}

function renderDots() {
  els.beatDots.replaceChildren(
    ...Array.from({ length: store.metro.beats }, () => document.createElement("i"))
  );
}

function metroParams() {
  const { bpm, beats, sub, vol, accent } = store.metro;
  return { bpm, beats, sub, vol, accent };
}

export function metronomeStart() {
  if (uiRunning) return;
  uiRunning = true;
  const m = store.metro;
  trainerBaseBpm = m.trainer.on ? m.bpm : null;

  engine.onBeat = (beat, bar, countIn) => flashDot(beat, countIn);
  engine.isMuted = m.mute.on
    ? (bar) => bar % (m.mute.play + m.mute.rest) >= m.mute.play
    : null;
  engine.onBar = (bar) => {
    // 段階テンポアップ:bars 小節ごとに step ずつ目標まで上げる
    const tr = store.metro.trainer;
    if (tr.on && bar > 0 && bar % tr.bars === 0 && store.metro.bpm < tr.to) {
      store.metro.bpm = Math.min(tr.to, store.metro.bpm + tr.step);
      engine.setBpm(store.metro.bpm);
      els.bpmValue.textContent = store.metro.bpm;
      els.bpmSlider.value = store.metro.bpm;
      save();
    }
  };
  engine.start({
    params: metroParams(),
    countInBars: m.countIn ? 1 : 0,
  });
  els.toggleBtn.textContent = "ストップ";
  els.toggleBtn.classList.add("running");
  requestWakeLock();
}

export function metronomeStop() {
  if (!uiRunning) return;
  uiRunning = false;
  engine.stop();
  engine.onBar = null;
  engine.isMuted = null;
  for (const d of els.beatDots.children) d.classList.remove("hit", "head");
  // トレーナーで上がったBPMを開始値へ戻す
  if (trainerBaseBpm !== null) {
    store.metro.bpm = trainerBaseBpm;
    trainerBaseBpm = null;
    save();
    syncUI();
  }
  els.toggleBtn.textContent = "スタート";
  els.toggleBtn.classList.remove("running");
  releaseWakeLock();
}

export function isMetronomeRunning() {
  return uiRunning;
}

function setBpm(bpm, fromSong = null) {
  store.metro.bpm = Math.min(260, Math.max(30, Math.round(bpm)));
  save();
  loadedSong = fromSong;
  if (uiRunning) engine.setBpm(store.metro.bpm);
  syncUI();
}

function syncUI() {
  const m = store.metro;
  els.bpmValue.textContent = m.bpm;
  els.bpmSlider.value = m.bpm;
  els.beatsSelect.value = m.beats;
  els.subSelect.value = m.sub;
  els.accentCheck.checked = m.accent;
  els.volSlider.value = m.vol;
  els.countInCheck.checked = m.countIn;
  els.trainerCheck.checked = m.trainer.on;
  els.trainerTo.value = m.trainer.to;
  els.trainerStep.value = m.trainer.step;
  els.trainerBars.value = m.trainer.bars;
  els.trainerFields.classList.toggle("disabled-block", !m.trainer.on);
  els.muteCheck.checked = m.mute.on;
  els.mutePlay.value = m.mute.play;
  els.muteRest.value = m.mute.rest;
  els.muteFields.classList.toggle("disabled-block", !m.mute.on);
  els.songLabel.hidden = !loadedSong;
  if (loadedSong) els.songLabel.textContent = `♪ ${loadedSong}`;
  renderDots();
}

// ---- タップテンポ ----
let taps = [];
function tap() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
  taps.push(now);
  if (taps.length > 6) taps.shift();
  if (taps.length >= 2) {
    const intervals = [];
    for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    setBpm(60000 / avg);
  }
}

// セトリ側から「この曲のテンポで」と呼ばれる
export function metronomeLoadSong(title, bpm) {
  setBpm(bpm, title);
}

// メトロノームタブを開いたときに曲チップを描き直す
export function renderSongChips(entries) {
  const wrap = els.songChips;
  const withBpm = entries.filter((e) => e.song.bpm);
  if (!withBpm.length) {
    wrap.innerHTML = '<p class="note">セトリの曲に BPM を登録すると、ここからワンタップで呼び出せます。</p>';
    return;
  }
  wrap.replaceChildren(
    ...withBpm.map((e) => {
      const idx = entries.indexOf(e) + 1;
      const b = document.createElement("button");
      b.className = "song-chip";
      b.append(`${idx}. ${e.song.title}`);
      const bb = document.createElement("b");
      bb.textContent = e.song.bpm;
      b.append(bb);
      b.addEventListener("click", () => setBpm(e.song.bpm, e.song.title));
      return b;
    })
  );
}

export function initMetronome() {
  els = {
    bpmValue: document.getElementById("bpmValue"),
    bpmSlider: document.getElementById("bpmSlider"),
    beatsSelect: document.getElementById("beatsSelect"),
    subSelect: document.getElementById("subSelect"),
    accentCheck: document.getElementById("accentCheck"),
    volSlider: document.getElementById("volSlider"),
    beatDots: document.getElementById("beatDots"),
    toggleBtn: document.getElementById("metroToggle"),
    tapBtn: document.getElementById("tapBtn"),
    songLabel: document.getElementById("metroSongLabel"),
    songChips: document.getElementById("songChips"),
    countInCheck: document.getElementById("countInCheck"),
    trainerCheck: document.getElementById("trainerCheck"),
    trainerTo: document.getElementById("trainerTo"),
    trainerStep: document.getElementById("trainerStep"),
    trainerBars: document.getElementById("trainerBars"),
    trainerFields: document.getElementById("trainerFields"),
    muteCheck: document.getElementById("muteCheck"),
    mutePlay: document.getElementById("mutePlay"),
    muteRest: document.getElementById("muteRest"),
    muteFields: document.getElementById("muteFields"),
  };

  els.toggleBtn.addEventListener("click", () => (uiRunning ? metronomeStop() : metronomeStart()));
  els.tapBtn.addEventListener("click", tap);

  els.bpmSlider.addEventListener("input", () => setBpm(els.bpmSlider.value));
  document.getElementById("bpmMinus5").addEventListener("click", () => setBpm(store.metro.bpm - 5));
  document.getElementById("bpmMinus1").addEventListener("click", () => setBpm(store.metro.bpm - 1));
  document.getElementById("bpmPlus1").addEventListener("click", () => setBpm(store.metro.bpm + 1));
  document.getElementById("bpmPlus5").addEventListener("click", () => setBpm(store.metro.bpm + 5));

  els.beatsSelect.addEventListener("change", () => {
    store.metro.beats = Number(els.beatsSelect.value);
    if (uiRunning) engine.params.beats = store.metro.beats;
    save();
    renderDots();
  });
  els.subSelect.addEventListener("change", () => {
    store.metro.sub = Number(els.subSelect.value);
    if (uiRunning) engine.params.sub = store.metro.sub;
    save();
  });
  els.accentCheck.addEventListener("change", () => {
    store.metro.accent = els.accentCheck.checked;
    if (uiRunning) engine.params.accent = store.metro.accent;
    save();
  });
  els.volSlider.addEventListener("input", () => {
    store.metro.vol = Number(els.volSlider.value);
    if (uiRunning) engine.params.vol = store.metro.vol;
    save();
  });
  els.countInCheck.addEventListener("change", () => {
    store.metro.countIn = els.countInCheck.checked;
    save();
  });

  const num = (el, min, max, fb) => {
    const n = Number(el.value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fb;
  };
  els.trainerCheck.addEventListener("change", () => {
    store.metro.trainer.on = els.trainerCheck.checked;
    save(); syncUI();
  });
  els.trainerTo.addEventListener("change", () => {
    store.metro.trainer.to = num(els.trainerTo, 30, 260, 160); save(); syncUI();
  });
  els.trainerStep.addEventListener("change", () => {
    store.metro.trainer.step = num(els.trainerStep, 1, 40, 5); save(); syncUI();
  });
  els.trainerBars.addEventListener("change", () => {
    store.metro.trainer.bars = num(els.trainerBars, 1, 64, 4); save(); syncUI();
  });
  els.muteCheck.addEventListener("change", () => {
    store.metro.mute.on = els.muteCheck.checked;
    if (uiRunning) {
      const m = store.metro;
      engine.isMuted = m.mute.on
        ? (bar) => bar % (m.mute.play + m.mute.rest) >= m.mute.play
        : null;
    }
    save(); syncUI();
  });
  els.mutePlay.addEventListener("change", () => {
    store.metro.mute.play = num(els.mutePlay, 1, 64, 4); save(); syncUI();
  });
  els.muteRest.addEventListener("change", () => {
    store.metro.mute.rest = num(els.muteRest, 1, 64, 2); save(); syncUI();
  });

  syncUI();
}
