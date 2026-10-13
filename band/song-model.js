// Pure song model shared by the viewer and the previous editor. No browser storage.

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

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
