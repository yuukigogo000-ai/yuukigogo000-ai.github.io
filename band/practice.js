// 練習タブ:通し練習モード・耳コピ用ループ再生・リハ録音

import {
  store, save, activeSetlist, entriesOf, fmtTime, uid,
} from "./store.js";
import { engine, requestWakeLock, releaseWakeLock } from "./metronome.js";
import {
  addRecording, deleteRecording, updateRecording, listRecordings, storageEstimate,
} from "./rec-db.js";

const $ = (id) => document.getElementById(id);
let toast = () => {};

// ============================================================
// 通し練習モード
// ============================================================

const run = {
  steps: [],       // {type:'song'|'gap', entry?, next?, sec, mc?}
  idx: -1,
  active: false,
  paused: false,
  stepStart: 0,    // performance.now() 基準
  pausedAt: 0,
  timer: null,
};

function buildSteps(sl) {
  const entries = entriesOf(sl);
  const steps = [];
  entries.forEach((e, i) => {
    steps.push({ type: "song", entry: e, sec: e.song.sec, index: i + 1, total: entries.length });
    if (i < entries.length - 1) {
      const gap = (sl.gapSec || 0) + (e.item.mc ? sl.mcSec || 0 : 0);
      steps.push({ type: "gap", sec: gap, mc: e.item.mc, next: entries[i + 1] });
    }
  });
  return steps;
}

function runStart() {
  const sl = activeSetlist();
  const steps = buildSteps(sl);
  if (!steps.length) { toast("セトリに曲がありません"); return; }
  run.steps = steps;
  run.idx = -1;
  run.active = true;
  run.paused = false;
  $("runIdle").hidden = true;
  $("runView").hidden = false;
  $("runSetlistName").textContent = sl.name;
  requestWakeLock();
  runAdvance(0);
  run.timer = setInterval(runTick, 200);
}

function runStop(finished = false) {
  if (!run.active) return;
  run.active = false;
  clearInterval(run.timer);
  engine.stop();
  engine.onBeat = null;
  releaseWakeLock();
  $("runIdle").hidden = false;
  $("runView").hidden = true;
  if (finished) toast("お疲れさまでした!通し完了 🎉");
}

function runAdvance(nextIdx) {
  engine.stop();
  if (nextIdx < 0) nextIdx = 0;
  if (nextIdx >= run.steps.length) { runStop(true); return; }
  run.idx = nextIdx;
  run.stepStart = performance.now();
  run.paused = false;
  const step = run.steps[run.idx];

  if (step.type === "song") {
    const song = step.entry.song;
    if (song.bpm) {
      engine.onBeat = (beat, bar, countIn) => flashRunDots(beat, countIn);
      renderRunDots(store.metro.beats);
      engine.start({
        params: {
          bpm: song.bpm, beats: store.metro.beats, sub: 1,
          vol: store.metro.vol, accent: store.metro.accent,
        },
        countInBars: $("runCountIn").checked ? 1 : 0,
      });
    } else {
      $("runDots").replaceChildren();
    }
  }
  renderRunStep();
}

function runTick() {
  if (!run.active || run.paused) return;
  const step = run.steps[run.idx];
  const elapsed = (performance.now() - run.stepStart) / 1000;
  if (step.sec > 0 && elapsed >= step.sec) {
    runAdvance(run.idx + 1);
    return;
  }
  const remain = step.sec > 0 ? step.sec - elapsed : elapsed;
  $("runTime").textContent = step.sec > 0 ? `残り ${fmtTime(remain)}` : `経過 ${fmtTime(remain)}`;
  const pct = step.sec > 0 ? Math.min(100, (elapsed / step.sec) * 100) : 0;
  $("runProgressFill").style.width = `${pct}%`;
}

function renderRunStep() {
  const step = run.steps[run.idx];
  const isSong = step.type === "song";
  $("runStepType").textContent = isSong
    ? `${step.index} / ${step.total} 曲目`
    : step.mc ? "転換+MC" : "転換";
  $("runTitle").textContent = isSong ? step.entry.song.title : `次:${step.next.song.title}`;

  const meta = $("runMeta");
  meta.replaceChildren();
  const addChip = (text) => {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = text;
    meta.appendChild(c);
  };
  if (isSong) {
    const s = step.entry.song;
    if (s.bpm) addChip(`♩=${s.bpm}`);
    if (s.key) addChip(`Key ${s.key}`);
    if (s.tuning) addChip(s.tuning);
    if (s.sec) addChip(fmtTime(s.sec));
  } else if (step.next.song.tuning) {
    addChip(`次のチューニング:${step.next.song.tuning}`);
  }

  // 転換中は次の曲のチェックリストを出す
  const checkWrap = $("runChecklist");
  checkWrap.replaceChildren();
  const gear = isSong ? [] : step.next.song.gear;
  if (gear.length) {
    const h = document.createElement("p");
    h.className = "note";
    h.textContent = "転換チェックリスト:";
    checkWrap.appendChild(h);
    for (const g of gear) {
      const label = document.createElement("label");
      label.className = "check-label gear-check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      label.append(cb, ` ${g}`);
      checkWrap.appendChild(label);
    }
  }

  $("runNext").textContent =
    isSong && run.idx + 2 < run.steps.length + 1
      ? nextSongLabel()
      : "";
  $("runPauseBtn").textContent = "一時停止";
  $("runProgressFill").style.width = "0%";
  $("runView").classList.toggle("is-gap", !isSong);
}

function nextSongLabel() {
  for (let i = run.idx + 1; i < run.steps.length; i++) {
    if (run.steps[i].type === "song") return `次の曲:${run.steps[i].entry.song.title}`;
  }
  return "ラスト曲です";
}

function renderRunDots(beats) {
  $("runDots").replaceChildren(
    ...Array.from({ length: beats }, () => document.createElement("i"))
  );
}

function flashRunDots(beat, countIn) {
  const dots = $("runDots").children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle("hit", i === beat);
    dots[i].classList.toggle("head", i === beat && (beat === 0 || countIn));
  }
}

function runPauseToggle() {
  if (!run.active) return;
  if (run.paused) {
    run.stepStart = performance.now() - run.pausedAt;
    run.paused = false;
    const step = run.steps[run.idx];
    if (step.type === "song" && step.entry.song.bpm) {
      engine.start({
        params: {
          bpm: step.entry.song.bpm, beats: store.metro.beats, sub: 1,
          vol: store.metro.vol, accent: store.metro.accent,
        },
      });
    }
    $("runPauseBtn").textContent = "一時停止";
  } else {
    run.pausedAt = performance.now() - run.stepStart;
    run.paused = true;
    engine.stop();
    $("runPauseBtn").textContent = "再開";
  }
}

function initRunThrough() {
  $("runStartBtn").addEventListener("click", runStart);
  $("runStopBtn").addEventListener("click", () => runStop(false));
  $("runPauseBtn").addEventListener("click", runPauseToggle);
  $("runPrevBtn").addEventListener("click", () => {
    // 直前の「曲」ステップへ
    for (let i = run.idx - 1; i >= 0; i--) {
      if (run.steps[i].type === "song") { runAdvance(i); return; }
    }
    runAdvance(0);
  });
  $("runNextBtn").addEventListener("click", () => runAdvance(run.idx + 1));
}

// ============================================================
// 耳コピ用ループ再生
// ============================================================

const loop = {
  audio: null,
  peaks: null,
  duration: 0,
  a: null,
  b: null,
  raf: 0,
};

function loopSetStatus(text) {
  $("loopStatus").textContent = text;
}

async function loopLoadFile(file) {
  if (!file) return;
  if (loop.audio) { loop.audio.pause(); URL.revokeObjectURL(loop.audio.src); }
  const audio = new Audio();
  audio.src = URL.createObjectURL(file);
  audio.preload = "auto";
  if ("preservesPitch" in audio) audio.preservesPitch = true;
  if ("webkitPreservesPitch" in audio) audio.webkitPreservesPitch = true;
  audio.playbackRate = Number($("loopSpeed").value);
  loop.audio = audio;
  loop.a = null;
  loop.b = null;
  $("loopFileName").textContent = file.name;
  $("loopControls").hidden = false;
  loopSetStatus("波形を解析中…");

  // 波形ピーク抽出(表示用)
  try {
    const buf = await file.arrayBuffer();
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ac.decodeAudioData(buf);
    loop.duration = decoded.duration;
    const ch = decoded.getChannelData(0);
    const COLS = 600;
    const per = Math.floor(ch.length / COLS) || 1;
    const peaks = new Float32Array(COLS);
    for (let i = 0; i < COLS; i++) {
      let max = 0;
      const start = i * per;
      for (let j = start; j < start + per && j < ch.length; j += 8) {
        const v = Math.abs(ch[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    loop.peaks = peaks;
    ac.close().catch(() => {});
    loopSetStatus("再生ボタンで開始。聞きたい区間で A → B を押すとループします。");
  } catch {
    loop.peaks = null;
    loop.duration = 0;
    loopSetStatus("波形は表示できませんが再生はできます。");
  }
  drawLoopWave();
  loopUpdateAB();
}

function drawLoopWave() {
  const canvas = $("loopWave");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 90;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const dur = loopDuration();

  // A-B 区間の背景
  if (loop.a !== null && loop.b !== null && dur) {
    ctx.fillStyle = "rgba(255,180,84,0.14)";
    const x1 = (loop.a / dur) * w;
    const x2 = (loop.b / dur) * w;
    ctx.fillRect(x1, 0, x2 - x1, h);
  }

  // 波形
  if (loop.peaks) {
    ctx.fillStyle = "#3d4759";
    const colW = w / loop.peaks.length;
    for (let i = 0; i < loop.peaks.length; i++) {
      const ph = Math.max(1, loop.peaks[i] * (h - 8));
      ctx.fillRect(i * colW, (h - ph) / 2, Math.max(1, colW - 0.4), ph);
    }
  } else {
    ctx.fillStyle = "#2a3242";
    ctx.fillRect(0, h / 2 - 1, w, 2);
  }

  // A/B マーカー
  const marker = (t, label) => {
    if (t === null || !dur) return;
    const x = (t / dur) * w;
    ctx.strokeStyle = "#7ab8ff";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.fillStyle = "#7ab8ff";
    ctx.font = "700 11px sans-serif";
    ctx.fillText(label, x + 3, 12);
  };
  marker(loop.a, "A");
  marker(loop.b, "B");

  // 再生位置
  if (loop.audio && dur) {
    const x = (loop.audio.currentTime / dur) * w;
    ctx.strokeStyle = "#ffb454";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
}

function loopDuration() {
  return loop.duration || (loop.audio && isFinite(loop.audio.duration) ? loop.audio.duration : 0);
}

function loopTick() {
  const a = loop.audio;
  if (!a) return;
  // A-B ループ判定
  if (loop.a !== null && loop.b !== null && a.currentTime >= loop.b) {
    a.currentTime = loop.a;
  }
  $("loopTime").textContent = `${fmtTime(a.currentTime)} / ${fmtTime(loopDuration())}`;
  drawLoopWave();
  if (!a.paused) loop.raf = requestAnimationFrame(loopTick);
}

function loopUpdateAB() {
  $("loopABLabel").textContent =
    loop.a !== null && loop.b !== null
      ? `ループ:${fmtTime(loop.a)} 〜 ${fmtTime(loop.b)}`
      : loop.a !== null
        ? `A:${fmtTime(loop.a)}(次にBを押すとループ開始)`
        : "A-B未設定";
  drawLoopWave();
}

function initLooper() {
  $("loopFile").addEventListener("change", () => loopLoadFile($("loopFile").files[0]));

  $("loopPlayBtn").addEventListener("click", () => {
    const a = loop.audio;
    if (!a) return;
    if (a.paused) {
      a.play();
      $("loopPlayBtn").textContent = "一時停止";
      cancelAnimationFrame(loop.raf);
      loop.raf = requestAnimationFrame(loopTick);
    } else {
      a.pause();
      $("loopPlayBtn").textContent = "再生";
    }
  });

  $("loopBackBtn").addEventListener("click", () => {
    if (loop.audio) loop.audio.currentTime = Math.max(0, loop.audio.currentTime - 5);
    drawLoopWave();
  });

  $("loopABtn").addEventListener("click", () => {
    if (!loop.audio) return;
    loop.a = loop.audio.currentTime;
    if (loop.b !== null && loop.b <= loop.a) loop.b = null;
    loopUpdateAB();
  });

  $("loopBBtn").addEventListener("click", () => {
    if (!loop.audio || loop.a === null) return;
    const t = loop.audio.currentTime;
    if (t > loop.a) {
      loop.b = t;
      loop.audio.currentTime = loop.a;
      loopUpdateAB();
    }
  });

  $("loopClearBtn").addEventListener("click", () => {
    loop.a = null;
    loop.b = null;
    loopUpdateAB();
  });

  $("loopSpeed").addEventListener("input", () => {
    const v = Number($("loopSpeed").value);
    $("loopSpeedOut").textContent = `${v.toFixed(2)}x`;
    if (loop.audio) loop.audio.playbackRate = v;
  });

  $("loopWave").addEventListener("pointerdown", (e) => {
    const dur = loopDuration();
    if (!loop.audio || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * dur;
    loop.audio.currentTime = Math.max(0, Math.min(dur - 0.05, t));
    drawLoopWave();
  });

  window.addEventListener("resize", () => { if (loop.audio) drawLoopWave(); });
}

// ============================================================
// リハ録音
// ============================================================

const rec = {
  recorder: null,
  stream: null,
  chunks: [],
  startMs: 0,
  timer: null,
  playingUrl: null,
};

function pickMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

async function recStart() {
  if (!window.MediaRecorder) {
    $("recStatus").textContent = "このブラウザは録音に対応していません。";
    return;
  }
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    $("recStatus").textContent = "マイクの使用が許可されませんでした。";
    return;
  }
  const mime = pickMime();
  rec.recorder = new MediaRecorder(rec.stream, mime ? { mimeType: mime } : undefined);
  rec.chunks = [];
  rec.recorder.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
  rec.recorder.onstop = onRecStop;
  rec.recorder.start(1000);
  rec.startMs = Date.now();
  rec.timer = setInterval(() => {
    $("recTime").textContent = fmtTime((Date.now() - rec.startMs) / 1000);
  }, 500);
  $("recToggleBtn").textContent = "録音停止";
  $("recToggleBtn").classList.add("running");
  $("recStatus").textContent = "録音中…";
  requestWakeLock();
}

async function onRecStop() {
  clearInterval(rec.timer);
  rec.stream?.getTracks().forEach((t) => t.stop());
  const sec = Math.round((Date.now() - rec.startMs) / 1000);
  const mime = rec.recorder.mimeType || "audio/webm";
  const blob = new Blob(rec.chunks, { type: mime });
  const d = new Date();
  const name = `リハ録音 ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  try {
    await addRecording({ id: uid(), name, songId: null, date: Date.now(), mime, sec, blob });
    toast("録音を保存しました");
  } catch (e) {
    console.warn(e);
    toast("録音の保存に失敗しました(容量不足の可能性)");
  }
  $("recToggleBtn").textContent = "録音開始";
  $("recToggleBtn").classList.remove("running");
  $("recStatus").textContent = "";
  $("recTime").textContent = "0:00";
  releaseWakeLock();
  renderRecordings();
}

function extOf(mime) {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

async function renderRecordings() {
  const listEl = $("recList");
  let recs = [];
  try {
    recs = await listRecordings();
  } catch {
    listEl.innerHTML = '<p class="note">録音一覧を読み込めませんでした。</p>';
    return;
  }
  if (!recs.length) {
    listEl.innerHTML = '<p class="note">まだ録音はありません。スタジオでの通しを録っておくと、後から聴き返せます。</p>';
    return;
  }
  listEl.replaceChildren(
    ...recs.map((r) => {
      const li = document.createElement("div");
      li.className = "rec-row";

      const main = document.createElement("div");
      main.className = "rec-main";
      const title = document.createElement("div");
      title.className = "rec-name";
      title.textContent = r.name;
      const meta = document.createElement("div");
      meta.className = "rec-meta note";
      const d = new Date(r.date);
      meta.textContent = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ・ ${fmtTime(r.sec)}`;

      const songSel = document.createElement("select");
      songSel.className = "rec-song";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "曲にひも付けない";
      songSel.appendChild(none);
      for (const s of store.library) {
        const o = document.createElement("option");
        o.value = s.id;
        o.textContent = `♪ ${s.title}`;
        songSel.appendChild(o);
      }
      songSel.value = r.songId && store.library.some((s) => s.id === r.songId) ? r.songId : "";
      songSel.addEventListener("change", () => {
        updateRecording(r.id, { songId: songSel.value || null }).catch(() => {});
      });

      main.append(title, meta, songSel);

      const actions = document.createElement("div");
      actions.className = "rec-actions";
      const mkBtn = (label, title2, fn, cls = "") => {
        const b = document.createElement("button");
        b.className = `icon-btn ${cls}`.trim();
        b.textContent = label;
        b.title = title2;
        b.addEventListener("click", fn);
        return b;
      };
      actions.append(
        mkBtn("▶", "再生", () => {
          if (rec.playingUrl) URL.revokeObjectURL(rec.playingUrl);
          rec.playingUrl = URL.createObjectURL(r.blob);
          const player = $("recPlayer");
          player.src = rec.playingUrl;
          player.hidden = false;
          $("recPlayerLabel").textContent = `再生中:${r.name}`;
          $("recPlayerLabel").hidden = false;
          player.play().catch(() => {});
        }),
        mkBtn("⬇", "ダウンロード", () => {
          const url = URL.createObjectURL(r.blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${r.name.replace(/[\\/:*?"<>|]/g, "_")}.${extOf(r.mime)}`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }),
        mkBtn("✎", "名前を変更", async () => {
          const name = prompt("録音の名前", r.name);
          if (name === null) return;
          await updateRecording(r.id, { name: name.trim() || r.name }).catch(() => {});
          renderRecordings();
        }),
        mkBtn("×", "削除", async () => {
          if (!confirm(`「${r.name}」を削除しますか?`)) return;
          await deleteRecording(r.id).catch(() => {});
          renderRecordings();
        }, "danger")
      );

      li.append(main, actions);
      return li;
    })
  );

  const est = await storageEstimate();
  $("recStorage").textContent = est && est.quota
    ? `ストレージ使用量:${(est.usage / 1048576).toFixed(1)} MB / 空き目安 ${((est.quota - est.usage) / 1048576).toFixed(0)} MB`
    : "";
}

function initRecorder() {
  $("recToggleBtn").addEventListener("click", () => {
    if (rec.recorder && rec.recorder.state === "recording") {
      rec.recorder.stop();
    } else {
      recStart();
    }
  });
  renderRecordings();
}

// ============================================================

export function isRunThroughActive() {
  return run.active;
}

// タブを開いたとき・ライブラリ変更時に呼ばれる
export function refreshPracticeTab() {
  const sl = activeSetlist();
  const d = entriesOf(sl).length;
  $("runSetlistInfo").textContent = `対象:「${sl.name}」(${d}曲)`;
  renderRecordings();
}

export function initPractice(toastFn) {
  toast = toastFn;
  initRunThrough();
  initLooper();
  initRecorder();
}
