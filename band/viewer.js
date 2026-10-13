import { decodeShare } from "./share.js";

const copy = {
  ja: {
    label: "共有されたセットリスト", heading: "セットリストを受け取る",
    intro: "BANDHUBから届いた共有リンクを開くと、ここに曲順・曲名・メモが表示されます。アプリのインストールは不要です。",
    empty: "このセットリストには、まだ曲がありません。",
    loading: "セットリストを開いています…",
    error: "この共有リンクを開けませんでした。", help: "リンクが途中で切れていないか確認し、送った人にもう一度送ってもらってください。圧縮されたリンクは、新しいSafariやChromeなどでお試しください。",
    count: n => `${n}曲`, untitled: "曲名なし", key: "キー", tuning: "チューニング",
    gear: "準備・持ち替え", mc: "この曲のあとにMC", privacy: "このリンクを知っている人は、内容を見ることができます。",
    readOnly: "閲覧用のページです。内容の変更は、送り主のBANDHUBで行ってください。",
    legacy: "以前のWeb版・保存データを開く", legacyNote: "以前このブラウザで作ったセットリストは、こちらから開けます。",
    language: "English", list: "演奏する曲順",
  },
  en: {
    label: "SHARED SETLIST", heading: "A setlist, ready to share",
    intro: "Open a shared link from BANDHUB to see the song order, titles and notes here. No app installation needed.",
    empty: "There are no songs in this setlist yet.", loading: "Opening the setlist…",
    error: "This shared link could not be opened.", help: "Check that the entire link was copied, or ask the sender to share it again. For compressed links, try a recent version of Safari or Chrome.",
    count: n => `${n} ${n === 1 ? "song" : "songs"}`, untitled: "Untitled song", key: "Key", tuning: "Tuning",
    gear: "Gear & changes", mc: "MC after this song", privacy: "Anyone with this link can view its contents.",
    readOnly: "This page is for viewing. Ask the sender to make changes in BANDHUB.",
    legacy: "Open the previous Web app & saved data", legacyNote: "Setlists previously created in this browser are available here.",
    language: "日本語", list: "Song order",
  },
};
let language = navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en";
let state = { kind: "loading" };
let revision = 0;
const el = id => document.getElementById(id);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
};

function render() {
  const t = copy[language];
  document.documentElement.lang = language;
  el("language").textContent = t.language;
  el("eyebrow").textContent = t.label;
  el("legacyLink").textContent = t.legacy;
  el("legacyNote").textContent = t.legacyNote;
  el("privacy").textContent = t.privacy;
  el("readOnly").textContent = t.readOnly;
  const ready = state.kind === "ready";
  el("sharedNotes").hidden = !ready;
  el("songs").replaceChildren();
  el("songs").setAttribute("aria-label", t.list);
  el("songs").hidden = !ready || !state.bundle.rows.length;
  el("summary").textContent = ready ? t.count(state.bundle.rows.length) : "";
  el("title").textContent = ready ? state.bundle.name : state.kind === "error" ? t.error : t.heading;
  document.title = "BANDHUB | " + el("title").textContent;
  el("status").textContent = state.kind === "loading" ? t.loading : state.kind === "empty" ? t.intro : state.kind === "error" ? t.help : state.bundle.rows.length ? "" : t.empty;
  el("status").hidden = !el("status").textContent;
  if (!ready) return;
  for (const [i, { song, mc }] of state.bundle.rows.entries()) {
    const row = document.createElement("li");
    row.className = "song-row";
    const number = node("span", String(i + 1).padStart(2, "0"), "song-number");
    number.setAttribute("aria-hidden", "true");
    const content = document.createElement("div");
    content.className = "song-content";
    content.append(node("h2", song.title || t.untitled));
    const details = [];
    if (song.bpm) details.push(`${song.bpm} BPM`);
    if (song.key) details.push(`${t.key}: ${song.key}`);
    if (song.tuning) details.push(`${t.tuning}: ${song.tuning}`);
    if (song.sec) details.push(`${Math.floor(song.sec / 60)}:${String(song.sec % 60).padStart(2, "0")}`);
    if (details.length) content.append(node("p", details.join(" · "), "song-details"));
    if (song.memo) content.append(node("p", song.memo, "song-memo"));
    if (song.gear.length) content.append(node("p", `${t.gear}: ${song.gear.join(" / ")}`, "song-gear"));
    if (mc) content.append(node("p", t.mc, "mc-note"));
    row.append(number, content);
    el("songs").append(row);
  }
}

async function openLink() {
  const current = ++revision;
  const hash = location.hash;
  if (!hash || hash === "#") {
    state = { kind: "empty" };
    render();
    return;
  }
  state = { kind: "loading" };
  render();
  try {
    // Bound input before parsing. Never load or save the previous app's data.
    if (hash.length > 2800000) throw new Error("Link too large");
    const payload = new URLSearchParams(hash.slice(1)).get("s");
    if (!payload) throw new Error("Missing setlist");
    const bundle = await decodeShare(payload);
    if (current !== revision) return;
    state = { kind: "ready", bundle };
  } catch {
    if (current !== revision) return;
    state = { kind: "error" };
  }
  render();
}

el("language").addEventListener("click", () => {
  language = language === "ja" ? "en" : "ja";
  render();
});
window.addEventListener("hashchange", openLink);
openLink();
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
