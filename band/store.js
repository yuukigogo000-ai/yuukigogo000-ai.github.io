// データ層 v2:曲ライブラリ(マスター)+セットリスト(参照)構造。
// v1(セトリに曲を直接内包)からの自動マイグレーションと Undo/Redo を持つ。

const STORE_KEY = "setlism:v1"; // キーは据え置き、中身の v フィールドで世代管理

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

// ---------- モデル ----------

export function newSong(partial = {}) {
  return {
    id: uid(),
    title: "",
    bpm: null,
    key: "",
    tuning: "",
    sec: 0,
    energy: 3,
    memo: "",
    gear: [],        // 転換チェックリスト(文字列の配列)
    ...partial,
  };
}

// セットリストの1行:ライブラリの曲への参照+その位置固有の情報
export function newItem(songId, partial = {}) {
  return { id: uid(), songId, mc: false, ...partial };
}

export function newSetlist(name) {
  return {
    id: uid(),
    name,
    targetMin: 30,
    gapSec: 15,
    mcSec: 90,
    template: "",    // エナジーフローの型テンプレートID
    items: [],
  };
}

export function newEvent(name) {
  return {
    id: uid(),
    name,
    startTime: "18:00",   // 開演 "HH:MM"
    changeoverMin: 10,    // バンド間の転換(分)
    acts: [],             // {id, name, min, setlistId|null, actualStart|null}
  };
}

export function newAct(name) {
  return { id: uid(), name, min: 30, setlistId: null, actualStart: null };
}

function sampleData() {
  const songs = [
    newSong({ title: "シグナル",         bpm: 182, key: "E",  tuning: "レギュラー", sec: 200, energy: 4,
              gear: ["ギター:カポなし", "同期スタート確認"] }),
    newSong({ title: "夜間飛行",         bpm: 128, key: "Am", tuning: "レギュラー", sec: 252, energy: 3 }),
    newSong({ title: "ブルーアワー",     bpm: 76,  key: "C",  tuning: "半音下げ",   sec: 300, energy: 1,
              gear: ["ギター持ち替え(半音下げ)", "ディレイON"] }),
    newSong({ title: "灯火",             bpm: 140, key: "G",  tuning: "半音下げ",   sec: 235, energy: 3 }),
    newSong({ title: "ラストスパート",   bpm: 196, key: "Bm", tuning: "ドロップD",  sec: 210, energy: 5,
              memo: "ラスト、キメ4回に変更", gear: ["ギター持ち替え(ドロップD)"] }),
    newSong({ title: "アンコールの前に", bpm: 92,  key: "D",  tuning: "レギュラー", sec: 268, energy: 2 }),
  ];
  const sl = newSetlist("サンプル・ワンマン");
  sl.items = songs.map((s, i) => newItem(s.id, { mc: i === 1 || i === 4 }));
  return { library: songs, setlists: [sl] };
}

function defaults() {
  const { library, setlists } = sampleData();
  return {
    v: 2,
    activeId: setlists[0].id,
    library,
    setlists,
    events: [],
    live: null,          // 本番モードの進行状態(クラッシュ復帰用に永続化)
    metro: {
      bpm: 120, beats: 4, sub: 1, vol: 70, accent: true,
      countIn: false,
      trainer: { on: false, to: 160, step: 5, bars: 4 },
      mute: { on: false, play: 4, rest: 2 },
    },
    tuner: { a4: 440 },
  };
}

// ---------- サニタイズ・マイグレーション ----------

export function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function sanitizeSong(t) {
  return newSong({
    id: String(t.id || uid()),
    title: String(t.title || "").slice(0, 80),
    bpm: t.bpm == null || t.bpm === "" ? null : clampNum(t.bpm, 20, 400, null),
    key: String(t.key || "").slice(0, 10),
    tuning: String(t.tuning || "").slice(0, 20),
    sec: clampNum(t.sec, 0, 6000, 0),
    energy: clampNum(t.energy, 1, 5, 3),
    memo: String(t.memo || "").slice(0, 500),
    gear: (Array.isArray(t.gear) ? t.gear : []).slice(0, 20).map((g) => String(g).slice(0, 60)).filter(Boolean),
  });
}

function sanitizeSetlist(s, songIds) {
  const sl = {
    ...newSetlist(String(s.name || "無題のセトリ").slice(0, 60)),
    id: String(s.id || uid()),
    targetMin: clampNum(s.targetMin, 0, 600, 30),
    gapSec: clampNum(s.gapSec, 0, 600, 15),
    mcSec: clampNum(s.mcSec, 0, 1800, 90),
    template: typeof s.template === "string" ? s.template : "",
  };
  sl.items = (Array.isArray(s.items) ? s.items : [])
    .filter((it) => it && songIds.has(it.songId))
    .map((it) => newItem(it.songId, { id: String(it.id || uid()), mc: !!it.mc }));
  return sl;
}

// v1: setlists[].songs に曲データを直接内包していた → ライブラリへ吸い上げる
function migrateV1(raw) {
  const library = [];
  const byTitle = new Map();
  const setlists = (raw.setlists || []).map((s) => {
    const sl = {
      ...newSetlist(String(s.name || "無題のセトリ")),
      id: String(s.id || uid()),
      targetMin: clampNum(s.targetMin, 0, 600, 30),
      gapSec: clampNum(s.gapSec, 0, 600, 15),
      mcSec: clampNum(s.mcSec, 0, 1800, 90),
    };
    sl.items = (Array.isArray(s.songs) ? s.songs : [])
      .filter((t) => t && typeof t === "object")
      .map((t) => {
        const clean = sanitizeSong(t);
        let song = byTitle.get(clean.title);
        if (!song) {
          song = clean;
          library.push(song);
          byTitle.set(song.title, song);
        }
        return newItem(song.id, { mc: !!t.mc });
      });
    return sl;
  });
  return { library, setlists };
}

function sanitize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.setlists)) return d;

  let library, setlists;
  if (raw.v === 2 && Array.isArray(raw.library)) {
    library = raw.library.filter((t) => t && typeof t === "object").map(sanitizeSong);
    const songIds = new Set(library.map((s) => s.id));
    setlists = raw.setlists.filter((s) => s && typeof s === "object").map((s) => sanitizeSetlist(s, songIds));
  } else {
    ({ library, setlists } = migrateV1(raw));
  }
  if (!setlists.length) setlists = [newSetlist("新しいセトリ")];

  const activeId = setlists.some((s) => s.id === raw.activeId) ? raw.activeId : setlists[0].id;
  const m = raw.metro || {};
  const tr = m.trainer || {};
  const mu = m.mute || {};

  const events = (Array.isArray(raw.events) ? raw.events : [])
    .filter((e) => e && typeof e === "object")
    .map((e) => ({
      ...newEvent(String(e.name || "イベント").slice(0, 60)),
      id: String(e.id || uid()),
      startTime: /^\d{1,2}:\d{2}$/.test(e.startTime) ? e.startTime : "18:00",
      changeoverMin: clampNum(e.changeoverMin, 0, 120, 10),
      acts: (Array.isArray(e.acts) ? e.acts : []).map((a) => ({
        ...newAct(String(a.name || "バンド").slice(0, 40)),
        id: String(a.id || uid()),
        min: clampNum(a.min, 1, 300, 30),
        setlistId: setlists.some((s) => s.id === a.setlistId) ? a.setlistId : null,
        actualStart: Number.isFinite(a.actualStart) ? a.actualStart : null,
      })),
    }));

  // live 状態:形が正しく参照が生きている場合のみ復元(壊れていたら破棄)
  let live = null;
  const rl = raw.live;
  if (
    rl && typeof rl === "object" &&
    Array.isArray(rl.steps) && rl.steps.length &&
    setlists.some((s) => s.id === rl.setlistId)
  ) {
    const steps = rl.steps
      .filter((st) => st && (st.type === "song" || st.type === "mc"))
      .map((st) => ({
        type: st.type,
        songId: typeof st.songId === "string" ? st.songId : null,
        label: String(st.label || "").slice(0, 80),
        planStart: clampNum(st.planStart, 0, 86400, 0),
        planSec: clampNum(st.planSec, 0, 6000, 0),
        index: clampNum(st.index, 1, 999, 1),
        total: clampNum(st.total, 1, 999, 1),
      }));
    if (steps.length) {
      const now = Date.now();
      live = {
        setlistId: rl.setlistId,
        setlistName: String(rl.setlistName || "").slice(0, 60),
        steps,
        idx: clampNum(rl.idx, 0, steps.length - 1, 0),
        startedAt: Number.isFinite(rl.startedAt) ? rl.startedAt : now,
        stepStartedAt: Number.isFinite(rl.stepStartedAt) ? rl.stepStartedAt : now,
        log: (Array.isArray(rl.log) ? rl.log : [])
          .filter((x) => x && typeof x === "object")
          .map((x) => ({
            label: String(x.label || "").slice(0, 80),
            type: x.type === "mc" ? "mc" : "song",
            planSec: clampNum(x.planSec, 0, 6000, 0),
            actualSec: clampNum(x.actualSec, 0, 86400, 0),
          })),
      };
    }
  }

  return {
    v: 2,
    activeId,
    library,
    setlists,
    events,
    live,
    metro: {
      bpm: clampNum(m.bpm, 30, 260, 120),
      beats: clampNum(m.beats, 1, 7, 4),
      sub: clampNum(m.sub, 1, 4, 1),
      vol: clampNum(m.vol, 0, 100, 70),
      accent: m.accent !== false,
      countIn: !!m.countIn,
      trainer: {
        on: !!tr.on,
        to: clampNum(tr.to, 30, 260, 160),
        step: clampNum(tr.step, 1, 40, 5),
        bars: clampNum(tr.bars, 1, 64, 4),
      },
      mute: {
        on: !!mu.on,
        play: clampNum(mu.play, 1, 64, 4),
        rest: clampNum(mu.rest, 1, 64, 2),
      },
    },
    tuner: { a4: clampNum(raw.tuner?.a4, 415, 466, 440) },
  };
}

function load() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORE_KEY)));
  } catch {
    return defaults();
  }
}

export const store = load();

// ---------- 保存 ----------

let saveTimer = null;
let dirty = false;

function flush() {
  if (!dirty) return;
  dirty = false;
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("保存に失敗しました", e);
  }
}

// スライダー操作などの連続更新をまとめるため軽くデバウンスしつつ、
// ページ離脱時には必ず書き切る
export function save() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 150);
}

window.addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
});

// ---------- Undo / Redo ----------
// データ編集(ライブラリ・セトリ・イベント)のみ対象。metro/tuner/live は含めない。

const UNDO_MAX = 50;
const undoStack = [];
const redoStack = [];
const listeners = new Set();

function snapshot() {
  return JSON.stringify({
    activeId: store.activeId,
    library: store.library,
    setlists: store.setlists,
    events: store.events,
  });
}

function applySnapshot(json) {
  const s = JSON.parse(json);
  store.activeId = s.activeId;
  store.library = s.library;
  store.setlists = s.setlists;
  store.events = s.events;
  save();
}

// データを変更する直前に呼ぶ
export function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack.length = 0;
  notifyUndo();
}

export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(snapshot());
  applySnapshot(undoStack.pop());
  notifyUndo();
  return true;
}

export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(snapshot());
  applySnapshot(redoStack.pop());
  notifyUndo();
  return true;
}

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;
export function onUndoChange(fn) { listeners.add(fn); }
function notifyUndo() { for (const fn of listeners) fn(); }

// ---------- 参照ヘルパー ----------

export function activeSetlist() {
  return store.setlists.find((s) => s.id === store.activeId) || store.setlists[0];
}

export function songOf(songId) {
  return store.library.find((s) => s.id === songId) || null;
}

// セットリストの行を {item, song} に解決(欠損参照は除外)
export function entriesOf(sl) {
  return sl.items
    .map((item) => ({ item, song: songOf(item.songId) }))
    .filter((e) => e.song);
}

// この曲が使われているセットリスト数
export function usageCount(songId) {
  return store.setlists.filter((sl) => sl.items.some((it) => it.songId === songId)).length;
}

// バックアップ読み込み(検証つき)。成功したら store を置き換える
export function replaceStore(rawJson) {
  const parsed = JSON.parse(rawJson); // 失敗は呼び出し側で捕捉
  const next = sanitize(parsed);
  Object.assign(store, next);
  save();
}

// ---------- 時間ユーティリティ ----------

export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 符号付き "+1:30" / "-0:45"
export function fmtSigned(sec) {
  const sign = sec < 0 ? "−" : "+";
  return sign + fmtTime(Math.abs(sec));
}

// "4:30" / "270" → 秒。無効なら null
export function parseTime(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  if (/^\d{1,4}$/.test(t)) return Math.min(6000, parseInt(t, 10));
  const m = t.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!m) return null;
  return Math.min(6000, parseInt(m[1], 10) * 60 + parseInt(m[2], 10));
}

// "18:00" → 分(0..1439)。無効なら null
export function parseClock(text) {
  const m = String(text || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function fmtClock(totalMin) {
  const m = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

// セットリスト全体の所要時間の内訳
export function setlistDuration(sl) {
  const entries = entriesOf(sl);
  const play = entries.reduce((a, e) => a + (e.song.sec || 0), 0);
  const gaps = Math.max(0, entries.length - 1) * (sl.gapSec || 0);
  const mcCount = entries.filter((e) => e.item.mc).length;
  const mc = mcCount * (sl.mcSec || 0);
  return { play, gaps, mc, mcCount, total: play + gaps + mc };
}
