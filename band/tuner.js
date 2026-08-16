// クロマチックチューナー:マイク入力を自己相関(ACF)でピッチ検出する。
// ベース最低音(B0 ≈ 31Hz)〜1kHz を検出範囲とし、倍音による1オクターブ下の
// 誤検出は「最大ピークの90%を超える最小ラグのピークを採る」ことで防ぐ。

import { store, save, clampNum } from "./store.js";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FFT_SIZE = 2048;
const MIN_FREQ = 27;    // A0 付近まで
const MAX_FREQ = 1000;
const RMS_GATE = 0.006; // これ未満は無音扱い
const CLARITY_GATE = 0.3;

let els = null;
let running = false;
let stream = null;
let audioCtx = null;
let analyser = null;
let buf = null;
let intervalId = null;
let wakeLock = null;
let centsHistory = [];

// ---------- ピッチ検出 ----------

function autoCorrelate(b, sampleRate) {
  const SIZE = b.length;
  let sumSq = 0;
  for (let i = 0; i < SIZE; i++) sumSq += b[i] * b[i];
  const rms = Math.sqrt(sumSq / SIZE);
  if (rms < RMS_GATE) return -1;

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQ));
  const maxLag = Math.min(SIZE - 2, Math.ceil(sampleRate / MIN_FREQ));
  if (maxLag <= minLag) return -1;

  const c = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE - lag; i++) sum += b[i] * b[i + lag];
    c[lag] = sum;
  }

  // 全体の最大値を求め、その90%を超える「最小ラグの山」を基本周期とする
  let maxVal = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) if (c[lag] > maxVal) maxVal = c[lag];
  if (maxVal <= 0 || maxVal / sumSq < CLARITY_GATE) return -1;

  const threshold = maxVal * 0.9;
  let T0 = -1;
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (c[lag] > threshold && c[lag] >= c[lag - 1] && c[lag] >= c[lag + 1]) {
      T0 = lag;
      break;
    }
  }
  if (T0 < 0) return -1;

  // 放物線補間でサブサンプル精度に
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  const shift = a ? -bb / (2 * a) : 0;
  return sampleRate / (T0 + shift);
}

function freqToNote(freq, a4) {
  const midi = 69 + 12 * Math.log2(freq / a4);
  const nearest = Math.round(midi);
  return {
    name: NOTE_NAMES[((nearest % 12) + 12) % 12],
    octave: Math.floor(nearest / 12) - 1,
    cents: (midi - nearest) * 100,
  };
}

// ---------- ゲージ描画 ----------

function buildGauge() {
  const svg = els.gauge;
  const cx = 150, cy = 160, r = 130;
  const parts = [];

  // 目盛り:-50〜+50 cent を -60°〜+60° に対応させる
  for (let cents = -50; cents <= 50; cents += 10) {
    const ang = (cents * 1.2 - 90) * (Math.PI / 180);
    const isMajor = cents % 50 === 0 || cents === 0;
    const r1 = r - (isMajor ? 16 : 10);
    const x1 = cx + r1 * Math.cos(ang), y1 = cy + r1 * Math.sin(ang);
    const x2 = cx + r * Math.cos(ang), y2 = cy + r * Math.sin(ang);
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
      stroke="${cents === 0 ? "#6fd899" : "#3a4356"}" stroke-width="${isMajor ? 3 : 2}" stroke-linecap="round"/>`);
    if (isMajor) {
      const rt = r - 28;
      const tx = cx + rt * Math.cos(ang), ty = cy + rt * Math.sin(ang);
      parts.push(`<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" fill="#7d8699" font-size="12"
        text-anchor="middle" dominant-baseline="middle">${cents === 0 ? "0" : (cents > 0 ? "+" : "") + cents}</text>`);
    }
  }

  // ±5 cent の「合ってる」ゾーン(弧)
  const zone = (deg) => {
    const a = (deg - 90) * (Math.PI / 180);
    return [cx + (r + 6) * Math.cos(a), cy + (r + 6) * Math.sin(a)];
  };
  const [zx1, zy1] = zone(-6);
  const [zx2, zy2] = zone(6);
  parts.push(`<path d="M ${zx1.toFixed(1)} ${zy1.toFixed(1)} A ${r + 6} ${r + 6} 0 0 1 ${zx2.toFixed(1)} ${zy2.toFixed(1)}"
    stroke="#6fd899" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.85"/>`);

  // 針(transform で回す)
  parts.push(`<g id="tunerNeedle" transform="rotate(0 ${cx} ${cy})">
    <line x1="${cx}" y1="${cy - 18}" x2="${cx}" y2="${cy - r + 20}" stroke="#ffb454" stroke-width="4" stroke-linecap="round"/>
  </g>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="7" fill="#ffb454"/>`);

  svg.innerHTML = parts.join("");
  els.needle = svg.querySelector("#tunerNeedle");
}

function renderIdle() {
  els.note.textContent = "--";
  els.note.classList.remove("in-tune");
  els.octave.textContent = "";
  els.cents.textContent = "± 0 cent";
  els.freq.textContent = "0.0 Hz";
  setNeedle(0);
}

function setNeedle(cents) {
  const deg = Math.max(-50, Math.min(50, cents)) * 1.2;
  els.needle.setAttribute("transform", `rotate(${deg.toFixed(1)} 150 160)`);
}

// ---------- 動作 ----------

function update() {
  analyser.getFloatTimeDomainData(buf);
  const freq = autoCorrelate(buf, audioCtx.sampleRate);
  if (freq < 0) {
    centsHistory = [];
    renderIdle();
    els.status.textContent = "音を待っています…(単音で鳴らしてください)";
    return;
  }
  const { name, octave, cents } = freqToNote(freq, store.tuner.a4);

  // 針の暴れを抑えるため直近3回の中央値を使う
  centsHistory.push(cents);
  if (centsHistory.length > 3) centsHistory.shift();
  const sorted = [...centsHistory].sort((a, b) => a - b);
  const smooth = sorted[Math.floor(sorted.length / 2)];

  els.note.textContent = name;
  els.octave.textContent = String(octave);
  els.cents.textContent = `${smooth >= 0 ? "+" : "−"}${Math.abs(smooth).toFixed(0)} cent`;
  els.freq.textContent = `${freq.toFixed(1)} Hz`;
  setNeedle(smooth);
  const inTune = Math.abs(smooth) <= 5;
  els.note.classList.toggle("in-tune", inTune);
  els.status.textContent = inTune ? "ジャストです ✓" : smooth > 0 ? "少し高い(下げる)" : "少し低い(上げる)";
}

async function tunerStart() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    els.status.classList.add("error");
    els.status.textContent =
      e && (e.name === "NotAllowedError" || e.name === "SecurityError")
        ? "マイクの使用が許可されませんでした。ブラウザの設定からこのサイトのマイクを許可してください。"
        : "マイクを開けませんでした。他のアプリが使用中でないか確認してください。";
    return;
  }
  els.status.classList.remove("error");
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  const src = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  src.connect(analyser);
  buf = new Float32Array(FFT_SIZE);
  centsHistory = [];

  running = true;
  intervalId = setInterval(update, 60);
  els.toggle.textContent = "チューナー停止";
  els.toggle.classList.add("running");
  els.status.textContent = "音を待っています…";
  try {
    if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
  } catch { /* 無視 */ }
}

export function tunerStop() {
  if (!running) return;
  running = false;
  clearInterval(intervalId);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  audioCtx?.close().catch(() => {});
  audioCtx = null;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  renderIdle();
  els.toggle.textContent = "チューナー開始";
  els.toggle.classList.remove("running");
  els.status.textContent = "マイクを使ってクロマチックチューニングします。";
}

export function isTunerRunning() {
  return running;
}

export function initTuner() {
  els = {
    gauge: document.getElementById("tunerGauge"),
    note: document.getElementById("tunerNote"),
    octave: document.getElementById("tunerOctave"),
    cents: document.getElementById("tunerCents"),
    freq: document.getElementById("tunerFreq"),
    status: document.getElementById("tunerStatus"),
    toggle: document.getElementById("tunerToggle"),
    a4Input: document.getElementById("a4Input"),
  };
  buildGauge();
  renderIdle();
  els.a4Input.value = store.tuner.a4;
  els.a4Input.addEventListener("change", () => {
    store.tuner.a4 = clampNum(els.a4Input.value, 415, 466, 440);
    els.a4Input.value = store.tuner.a4;
    save();
  });
  els.toggle.addEventListener("click", () => (running ? tunerStop() : tunerStart()));
}
