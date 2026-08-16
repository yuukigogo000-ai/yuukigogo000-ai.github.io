// 共有リンク:セットリストを URL ハッシュに載せられるサイズへ圧縮エンコードする。
// サーバー不要 — データはリンクそのものに入る。
// 形式: "1." + base64url(deflate-raw(JSON))  /  フォールバック "0." + base64url(JSON)

import { newSetlist, newSong, clampNum } from "./store.js";

function toCompact(sl) {
  return {
    n: sl.name,
    t: sl.targetMin,
    g: sl.gapSec,
    m: sl.mcSec,
    s: sl.songs.map((x) => [
      x.title, x.bpm ?? "", x.key, x.tuning, x.sec, x.energy, x.mc ? 1 : 0, x.memo,
    ]),
  };
}

function fromCompact(c) {
  if (!c || typeof c !== "object" || !Array.isArray(c.s)) throw new Error("bad payload");
  const sl = newSetlist(String(c.n || "共有されたセトリ").slice(0, 60));
  sl.targetMin = clampNum(c.t, 0, 600, 30);
  sl.gapSec = clampNum(c.g, 0, 600, 15);
  sl.mcSec = clampNum(c.m, 0, 1800, 90);
  sl.songs = c.s.slice(0, 200).map((a) =>
    newSong({
      title: String(a[0] || "").slice(0, 80),
      bpm: a[1] === "" || a[1] == null ? null : clampNum(a[1], 20, 400, null),
      key: String(a[2] || "").slice(0, 10),
      tuning: String(a[3] || "").slice(0, 20),
      sec: clampNum(a[4], 0, 6000, 0),
      energy: clampNum(a[5], 1, 5, 3),
      mc: a[6] === 1,
      memo: String(a[7] || "").slice(0, 500),
    })
  );
  return sl;
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

export async function encodeShare(setlist) {
  const json = JSON.stringify(toCompact(setlist));
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

// 戻り値: セットリスト。壊れたリンクは例外を投げる
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
