// 共有リンク:セットリストを URL ハッシュに載せられるサイズへ圧縮エンコードする。
// サーバー不要 — データはリンクそのものに入る。
// 形式: "1." + base64url(deflate-raw(JSON))  /  フォールバック "0." + base64url(JSON)
// 曲データは配列 [title,bpm,key,tuning,sec,energy,mc,memo,gear] で運ぶ
// (v1リンクは gear なしの8要素 — 後方互換で読める)。

import { sanitizeSong, clampNum } from "./store.js";

export function toShareBundle(sl, entries) {
  return {
    n: sl.name,
    t: sl.targetMin,
    g: sl.gapSec,
    m: sl.mcSec,
    s: entries.map(({ item, song }) => [
      song.title, song.bpm ?? "", song.key, song.tuning, song.sec, song.energy,
      item.mc ? 1 : 0, song.memo, song.gear.join("\n"),
    ]),
  };
}

// 戻り値: {name, targetMin, gapSec, mcSec, rows:[{song(未登録), mc}]}
function fromCompact(c) {
  if (!c || typeof c !== "object" || !Array.isArray(c.s)) throw new Error("bad payload");
  return {
    name: String(c.n || "共有されたセトリ").slice(0, 60),
    targetMin: clampNum(c.t, 0, 600, 30),
    gapSec: clampNum(c.g, 0, 600, 15),
    mcSec: clampNum(c.m, 0, 1800, 90),
    rows: c.s.slice(0, 200).map((a) => ({
      song: sanitizeSong({
        title: a[0], bpm: a[1] === "" ? null : a[1], key: a[2], tuning: a[3],
        sec: a[4], energy: a[5], memo: a[7],
        gear: typeof a[8] === "string" && a[8] ? a[8].split("\n") : [],
      }),
      mc: a[6] === 1,
    })),
  };
}

function b64urlEncode(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deflate(bytes) {
  const cs = new CompressionStream("deflate-raw");
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(buf);
}

async function inflate(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

export async function encodeShare(sl, entries) {
  const json = JSON.stringify(toShareBundle(sl, entries));
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== "undefined") {
    try {
      return "1." + b64urlEncode(await deflate(bytes));
    } catch {
      // 圧縮に失敗したら非圧縮で続行
    }
  }
  return "0." + b64urlEncode(bytes);
}

// 戻り値: 共有バンドル(fromCompact 参照)。壊れたリンクは例外を投げる
export async function decodeShare(payload) {
  const dot = payload.indexOf(".");
  if (dot !== 1) throw new Error("bad format");
  const mode = payload.slice(0, 1);
  const body = payload.slice(2);
  let bytes = b64urlDecode(body);
  if (mode === "1") {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("このブラウザは圧縮リンクに対応していません");
    }
    bytes = await inflate(bytes);
  } else if (mode !== "0") {
    throw new Error("bad format");
  }
  const json = new TextDecoder().decode(bytes);
  return fromCompact(JSON.parse(json));
}
