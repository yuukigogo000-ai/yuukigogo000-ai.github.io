// メトロノーム:Web Audio のルックアヘッドスケジューラで揺れのないクリックを刻む。
// setInterval で先の音を予約し続け、発音タイミングは AudioContext の時計に任せる方式。

import { store, save } from "./store.js";

const LOOKAHEAD_MS = 25;       // スケジューラの起床間隔
const SCHEDULE_AHEAD = 0.12;   // 何秒先まで予約するか

let audioCtx = null;
let running = false;
let timerId = null;
let nextNoteTime = 0;
let beatIndex = 0;
let subIndex = 0;
let beatQueue = [];            // 予約済みビート {time, beat} — 見た目の同期用
let rafId = 0;
let wakeLock = null;

let els = null;
let loadedSong = null;         // セトリから読み込んだ曲名(表示用)
let onRenderChips = null;

function ensureCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function scheduleClick(beat, subI, time) {
  const ctx = audioCtx;
  const isHead = beat === 0 && subI === 0;
  const isBeat = subI === 0;
  const accentOn = store.metro.accent;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = isHead && accentOn ? 1760 : isBeat ? 1318 : 987;

  const vol = (store.metro.vol / 100) * (isHead && accentOn ? 1 : isBeat ? 0.75 : 0.4);
  gain.gain.setValueAtTime(Math.max(0.0001, vol), time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.06);

  if (isBeat) beatQueue.push({ time, beat });
}

function scheduler() {
  const ctx = audioCtx;
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleClick(beatIndex, subIndex, nextNoteTime);
    const secPerBeat = 60 / store.metro.bpm;
    nextNoteTime += secPerBeat / store.metro.sub;
    subIndex++;
    if (subIndex >= store.metro.sub) {
      subIndex = 0;
      beatIndex = (beatIndex + 1) % store.metro.beats;
    }
  }
}

function drawLoop() {
  if (!running) return;
  const now = audioCtx.currentTime;
  let current = null;
  while (beatQueue.length && beatQueue[0].time <= now) current = beatQueue.shift();
  if (current !== null) flashDot(current.beat);
  rafId = requestAnimationFrame(drawLoop);
}

function flashDot(beat) {
  const dots = els.beatDots.children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle("hit", i === beat);
    dots[i].classList.toggle("head", i === beat && beat === 0);
  }
}

function renderDots() {
  els.beatDots.replaceChildren(
    ...Array.from({ length: store.metro.beats }, () => document.createElement("i"))
  );
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    }
  } catch { /* 対応外・省電力モードなどは無視 */ }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

export function metronomeStart() {
  if (running) return;
  const ctx = ensureCtx();
  ctx.resume();
  running = true;
  beatIndex = 0;
  subIndex = 0;
  beatQueue = [];
  nextNoteTime = ctx.currentTime + 0.08;
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  rafId = requestAnimationFrame(drawLoop);
  els.toggleBtn.textContent = "ストップ";
  els.toggleBtn.classList.add("running");
  requestWakeLock();
}

export function metronomeStop() {
  if (!running) return;
  running = false;
  clearInterval(timerId);
  cancelAnimationFrame(rafId);
  beatQueue = [];
  for (const d of els.beatDots.children) d.classList.remove("hit", "head");
  els.toggleBtn.textContent = "スタート";
  els.toggleBtn.classList.remove("running");
  releaseWakeLock();
}

export function isMetronomeRunning() {
  return running;
}

function setBpm(bpm, fromSong = null) {
  store.metro.bpm = Math.min(260, Math.max(30, Math.round(bpm)));
  save();
  loadedSong = fromSong;
  syncUI();
}

function syncUI() {
  els.bpmValue.textContent = store.metro.bpm;
  els.bpmSlider.value = store.metro.bpm;
  els.beatsSelect.value = store.metro.beats;
  els.subSelect.value = store.metro.sub;
  els.accentCheck.checked = store.metro.accent;
  els.volSlider.value = store.metro.vol;
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
export function renderSongChips(setlist) {
  const wrap = els.songChips;
  const withBpm = setlist ? setlist.songs.filter((s) => s.bpm) : [];
  if (!withBpm.length) {
    wrap.innerHTML = '<p class="note">セトリの曲に BPM を登録すると、ここからワンタップで呼び出せます。</p>';
    return;
  }
  wrap.replaceChildren(
    ...withBpm.map((s) => {
      const idx = setlist.songs.indexOf(s) + 1;
      const b = document.createElement("button");
      b.className = "song-chip";
      b.append(`${idx}. ${s.title}`);
      const bb = document.createElement("b");
      bb.textContent = s.bpm;
      b.append(bb);
      b.addEventListener("click", () => setBpm(s.bpm, s.title));
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
  };

  els.toggleBtn.addEventListener("click", () => (running ? metronomeStop() : metronomeStart()));
  els.tapBtn.addEventListener("click", tap);

  els.bpmSlider.addEventListener("input", () => setBpm(els.bpmSlider.value));
  document.getElementById("bpmMinus5").addEventListener("click", () => setBpm(store.metro.bpm - 5));
  document.getElementById("bpmMinus1").addEventListener("click", () => setBpm(store.metro.bpm - 1));
  document.getElementById("bpmPlus1").addEventListener("click", () => setBpm(store.metro.bpm + 1));
  document.getElementById("bpmPlus5").addEventListener("click", () => setBpm(store.metro.bpm + 5));

  els.beatsSelect.addEventListener("change", () => {
    store.metro.beats = Number(els.beatsSelect.value);
    beatIndex = 0; subIndex = 0;
    save();
    renderDots();
  });
  els.subSelect.addEventListener("change", () => {
    store.metro.sub = Number(els.subSelect.value);
    subIndex = 0;
    save();
  });
  els.accentCheck.addEventListener("change", () => {
    store.metro.accent = els.accentCheck.checked;
    save();
  });
  els.volSlider.addEventListener("input", () => {
    store.metro.vol = Number(els.volSlider.value);
    save();
  });

  // 画面復帰時に WakeLock を取り直す
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && running && !wakeLock) requestWakeLock();
  });

  syncUI();
}
