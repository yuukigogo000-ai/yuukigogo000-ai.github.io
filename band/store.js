// データ層:localStorage への保存・読み込みとモデル定義

const STORE_KEY = "setlism:v1";

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

export function newSong(partial = {}) {
  return {
    id: uid(),
    title: "",
    bpm: null,      // number | null
    key: "",
    tuning: "",
    sec: 0,         // 曲の長さ(秒)
    energy: 3,      // 1..5
    mc: false,      // この曲のあとに MC
    memo: "",
    ...partial,
  };
}

export function newSetlist(name) {
  return {
    id: uid(),
    name,
    targetMin: 30,  // 持ち時間(分)
    gapSec: 15,     // 曲間の転換(秒)
    mcSec: 90,      // MC 1回あたり(秒)
    songs: [],
  };
}

function sampleSetlist() {
  const s = newSetlist("サンプル・ワンマン");
  s.targetMin = 30;
  s.songs = [
    newSong({ title: "シグナル",       bpm: 182, key: "E",   tuning: "レギュラー", sec: 200, energy: 4 }),
    newSong({ title: "夜間飛行",       bpm: 128, key: "Am",  tuning: "レギュラー", sec: 252, energy: 3, mc: true }),
    newSong({ title: "ブルーアワー",   bpm: 76,  key: "C",   tuning: "半音下げ",   sec: 300, energy: 1 }),
    newSong({ title: "灯火",           bpm: 140, key: "G",   tuning: "半音下げ",   sec: 235, energy: 3 }),
    newSong({ title: "ラストスパート", bpm: 196, key: "Bm",  tuning: "ドロップD",  sec: 210, energy: 5, mc: true,
              memo: "ラスト、キメ4回に変更" }),
    newSong({ title: "アンコールの前に", bpm: 92, key: "D",  tuning: "レギュラー", sec: 268, energy: 2 }),
  ];
  return s;
}

function defaults() {
  const first = sampleSetlist();
  return {
    v: 1,
    activeId: first.id,
    setlists: [first],
    metro: { bpm: 120, beats: 4, sub: 1, vol: 70, accent: true },
    tuner: { a4: 440 },
  };
}

function sanitize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.setlists)) return d;
  const setlists = raw.setlists
    .filter((s) => s && typeof s === "object")
    .map((s) => ({
      ...newSetlist(String(s.name || "無題のセトリ")),
      id: String(s.id || uid()),
      targetMin: clampNum(s.targetMin, 0, 600, 30),
      gapSec: clampNum(s.gapSec, 0, 600, 15),
      mcSec: clampNum(s.mcSec, 0, 1800, 90),
      songs: (Array.isArray(s.songs) ? s.songs : [])
        .filter((t) => t && typeof t === "object")
        .map((t) =>
          newSong({
            id: String(t.id || uid()),
            title: String(t.title || "").slice(0, 80),
            bpm: t.bpm == null || t.bpm === "" ? null : clampNum(t.bpm, 20, 400, null),
            key: String(t.key || "").slice(0, 10),
            tuning: String(t.tuning || "").slice(0, 20),
            sec: clampNum(t.sec, 0, 6000, 0),
            energy: clampNum(t.energy, 1, 5, 3),
            mc: !!t.mc,
            memo: String(t.memo || "").slice(0, 500),
          })
        ),
    }));
  if (!setlists.length) return d;
  const activeId = setlists.some((s) => s.id === raw.activeId) ? raw.activeId : setlists[0].id;
  const m = raw.metro || {};
  const t = raw.tuner || {};
  return {
    v: 1,
    activeId,
    setlists,
    metro: {
      bpm: clampNum(m.bpm, 30, 260, 120),
      beats: clampNum(m.beats, 1, 7, 4),
      sub: clampNum(m.sub, 1, 4, 1),
      vol: clampNum(m.vol, 0, 100, 70),
      accent: m.accent !== false,
    },
    tuner: { a4: clampNum(t.a4, 415, 466, 440) },
  };
}

export function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function load() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORE_KEY)));
  } catch {
    return defaults();
  }
}

export const store = load();

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

export function activeSetlist() {
  return store.setlists.find((s) => s.id === store.activeId) || store.setlists[0];
}

// バックアップ読み込み(検証つき)。成功したら store を置き換える
export function replaceStore(rawJson) {
  const parsed = JSON.parse(rawJson); // 失敗は呼び出し側で捕捉
  const next = sanitize(parsed);
  store.activeId = next.activeId;
  store.setlists = next.setlists;
  store.metro = next.metro;
  store.tuner = next.tuner;
  save();
}

// ---------- 時間ユーティリティ ----------

export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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

// セットリスト全体の所要時間の内訳
export function setlistDuration(sl) {
  const play = sl.songs.reduce((a, s) => a + (s.sec || 0), 0);
  const gaps = Math.max(0, sl.songs.length - 1) * (sl.gapSec || 0);
  const mcCount = sl.songs.filter((s) => s.mc).length;
  const mc = mcCount * (sl.mcSec || 0);
  return { play, gaps, mc, mcCount, total: play + gaps + mc };
}
