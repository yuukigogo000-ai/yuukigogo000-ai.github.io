// セトリズム — メインオーケストレーション

import {
  store, save, activeSetlist, newSetlist, newSong, replaceStore,
  fmtTime, parseTime, setlistDuration, clampNum,
} from "./store.js";
import {
  initMetronome, metronomeStart, metronomeStop, isMetronomeRunning,
  metronomeLoadSong, renderSongChips,
} from "./metronome.js";
import { initTuner } from "./tuner.js";
import { encodeShare, decodeShare } from "./share.js";

const $ = (id) => document.getElementById(id);

// ---------- toast ----------

let toastTimer = null;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------- タブ ----------

const TABS = ["setlist", "metronome", "tuner"];

function selectTab(name) {
  for (const t of TABS) {
    const selected = t === name;
    $(`tabbtn-${t}`).setAttribute("aria-selected", String(selected));
    $(`tab-${t}`).hidden = !selected;
  }
  if (name === "metronome") renderSongChips(activeSetlist());
}

// ---------- セットリスト選択・CRUD ----------

function renderSetlistSelect() {
  const sel = $("setlistSelect");
  sel.replaceChildren(
    ...store.setlists.map((s) => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = `${s.name}(${s.songs.length}曲)`;
      return o;
    })
  );
  sel.value = store.activeId;
}

function renderAll() {
  renderSetlistSelect();
  renderTimePanel();
  renderSongs();
  renderEnergy();
  if (!$("tab-metronome").hidden) renderSongChips(activeSetlist());
}

// ---------- 持ち時間パネル ----------

function renderTimePanel() {
  const sl = activeSetlist();
  $("targetMin").value = sl.targetMin;
  $("gapSec").value = sl.gapSec;
  $("mcSec").value = sl.mcSec;

  const d = setlistDuration(sl);
  $("totalTime").textContent = fmtTime(d.total);
  $("timeBreakdown").textContent =
    `内訳:演奏 ${fmtTime(d.play)} ＋ 転換 ${fmtTime(d.gaps)} ＋ MC ${fmtTime(d.mc)}(${d.mcCount}回)`;

  const diffEl = $("timeDiff");
  const fill = $("timeBarFill");
  const targetSec = sl.targetMin * 60;
  if (targetSec > 0) {
    const diff = targetSec - d.total;
    if (diff >= 0) {
      diffEl.textContent = `持ち時間まで あと ${fmtTime(diff)}`;
      diffEl.className = "time-diff under";
    } else {
      diffEl.textContent = `${fmtTime(-diff)} オーバー!`;
      diffEl.className = "time-diff over";
    }
    const pct = Math.min(100, (d.total / targetSec) * 100);
    fill.style.width = `${pct}%`;
    fill.classList.toggle("over", d.total > targetSec);
  } else {
    diffEl.textContent = "";
    diffEl.className = "time-diff";
    fill.style.width = "0%";
    fill.classList.remove("over");
  }
}

function bindTimeInputs() {
  const bind = (id, field, min, max) => {
    $(id).addEventListener("change", () => {
      const sl = activeSetlist();
      sl[field] = clampNum($(id).value, min, max, sl[field]);
      save();
      renderTimePanel();
    });
  };
  bind("targetMin", "targetMin", 0, 600);
  bind("gapSec", "gapSec", 0, 600);
  bind("mcSec", "mcSec", 0, 1800);
}

// ---------- 曲リスト ----------

function energyDots(n) {
  const wrap = document.createElement("span");
  wrap.className = "energy-dots";
  wrap.title = `エナジー ${n}/5`;
  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement("i");
    if (i <= n) dot.classList.add("on");
    wrap.appendChild(dot);
  }
  return wrap;
}

function chip(text, cls = "chip") {
  const c = document.createElement("span");
  c.className = cls;
  c.textContent = text;
  return c;
}

function iconBtn(label, title, onClick, cls = "") {
  const b = document.createElement("button");
  b.className = `icon-btn ${cls}`.trim();
  b.textContent = label;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.addEventListener("click", onClick);
  return b;
}

function renderSongs() {
  const sl = activeSetlist();
  const list = $("songList");
  $("emptyHint").hidden = sl.songs.length > 0;

  list.replaceChildren(
    ...sl.songs.map((song, i) => {
      const li = document.createElement("li");
      li.className = "song";
      li.dataset.index = i;

      const handle = document.createElement("span");
      handle.className = "song-handle";
      handle.textContent = "⋮⋮";
      handle.title = "ドラッグで並べ替え";

      const num = document.createElement("span");
      num.className = "song-num";
      num.textContent = i + 1;

      const main = document.createElement("div");
      main.className = "song-main";
      const title = document.createElement("div");
      title.className = "song-title";
      title.textContent = song.title;
      if (song.mc) {
        const badge = document.createElement("span");
        badge.className = "mc-badge";
        badge.textContent = "MC";
        badge.title = "この曲のあとに MC";
        title.appendChild(badge);
      }
      const meta = document.createElement("div");
      meta.className = "song-meta";
      if (song.bpm) {
        const b = document.createElement("button");
        b.className = "chip chip-bpm";
        b.textContent = `♩=${song.bpm}`;
        b.title = "この BPM でメトロノームを開く";
        b.addEventListener("click", () => {
          metronomeLoadSong(song.title, song.bpm);
          selectTab("metronome");
        });
        meta.appendChild(b);
      }
      if (song.key) meta.appendChild(chip(`Key ${song.key}`));
      if (song.tuning) meta.appendChild(chip(song.tuning));
      if (song.sec) meta.appendChild(chip(fmtTime(song.sec)));
      meta.appendChild(energyDots(song.energy));
      main.append(title, meta);
      if (song.memo) {
        const memo = document.createElement("div");
        memo.className = "song-memo";
        memo.textContent = song.memo;
        main.appendChild(memo);
      }

      const actions = document.createElement("div");
      actions.className = "song-actions";
      const row1 = document.createElement("div");
      row1.className = "row2";
      const up = iconBtn("↑", "上へ", () => moveSong(i, -1));
      const down = iconBtn("↓", "下へ", () => moveSong(i, +1));
      up.disabled = i === 0;
      down.disabled = i === sl.songs.length - 1;
      row1.append(up, down);
      const row2 = document.createElement("div");
      row2.className = "row2";
      row2.append(
        iconBtn("✎", "編集", () => openSongDialog(song.id)),
        iconBtn("×", "削除", () => deleteSong(song.id), "danger")
      );
      actions.append(row1, row2);

      li.append(handle, num, main, actions);
      setupDrag(li, handle);
      return li;
    })
  );
}

function moveSong(i, dir) {
  const songs = activeSetlist().songs;
  const j = i + dir;
  if (j < 0 || j >= songs.length) return;
  [songs[i], songs[j]] = [songs[j], songs[i]];
  save();
  renderAll();
}

function deleteSong(id) {
  const sl = activeSetlist();
  const song = sl.songs.find((s) => s.id === id);
  if (!song) return;
  if (!confirm(`「${song.title}」を削除しますか?`)) return;
  sl.songs = sl.songs.filter((s) => s.id !== id);
  save();
  renderAll();
}

// ---- ドラッグ&ドロップ並べ替え(デスクトップ。モバイルは↑↓ボタン) ----

let dragIndex = null;

function setupDrag(li, handle) {
  handle.addEventListener("mousedown", () => { li.draggable = true; });
  li.addEventListener("dragstart", (e) => {
    dragIndex = Number(li.dataset.index);
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    li.draggable = false;
    dragIndex = null;
    for (const el of $("songList").children) el.classList.remove("drag-over");
  });
  li.addEventListener("dragover", (e) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    li.classList.add("drag-over");
  });
  li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    const to = Number(li.dataset.index);
    if (dragIndex === null || dragIndex === to) return;
    const songs = activeSetlist().songs;
    const [moved] = songs.splice(dragIndex, 1);
    songs.splice(to, 0, moved);
    dragIndex = null;
    save();
    renderAll();
  });
}

// ---------- エナジーフロー ----------

function renderEnergy() {
  const sl = activeSetlist();
  const wrap = $("energyChart");
  const songs = sl.songs;

  if (songs.length < 2) {
    wrap.innerHTML =
      '<p class="energy-empty">曲を2曲以上登録すると、セット全体の盛り上がりの流れが表示されます。</p>';
    return;
  }

  const W = 640, H = 170;
  const padL = 36, padR = 18, padT = 18, padB = 26;
  const plotW = W - padL - padR;
  const yOf = (e) => H - padB - ((e - 1) / 4) * (H - padT - padB);
  const xOf = (i) => padL + (i * plotW) / (songs.length - 1);

  const pts = songs.map((s, i) => [xOf(i), yOf(s.energy)]);
  const lineD = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${pts[pts.length - 1][0].toFixed(1)} ${H - padB} L ${padL} ${H - padB} Z`;

  const grid = [];
  for (let e = 1; e <= 5; e++) {
    grid.push(`<line x1="${padL}" y1="${yOf(e)}" x2="${W - padR}" y2="${yOf(e)}" stroke="#ffffff12" stroke-width="1"/>`);
  }

  // MC マーカー(その曲のあとに MC が入る位置)
  const mcMarks = [];
  songs.forEach((s, i) => {
    if (!s.mc) return;
    const x = i < songs.length - 1 ? (xOf(i) + xOf(i + 1)) / 2 : Math.min(xOf(i) + 22, W - padR);
    mcMarks.push(`<line x1="${x.toFixed(1)}" y1="${padT - 4}" x2="${x.toFixed(1)}" y2="${H - padB}"
        stroke="#7d8699" stroke-width="1.5" stroke-dasharray="3 4"/>
      <text x="${x.toFixed(1)}" y="${padT - 7}" fill="#7d8699" font-size="10" font-weight="700"
        text-anchor="middle" letter-spacing="1">MC</text>`);
  });

  const labels = songs
    .map((s, i) => `<text x="${xOf(i).toFixed(1)}" y="${H - 8}" fill="#7d8699" font-size="11"
      text-anchor="middle">${i + 1}</text>`)
    .join("");

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="セットリストのエナジーフロー">
      <defs>
        <linearGradient id="egrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffb454" stop-opacity="0.30"/>
          <stop offset="1" stop-color="#ffb454" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${grid.join("")}
      <text x="${padL - 8}" y="${yOf(5) + 4}" fill="#7d8699" font-size="11" text-anchor="end">爆</text>
      <text x="${padL - 8}" y="${yOf(1) + 4}" fill="#7d8699" font-size="11" text-anchor="end">静</text>
      ${mcMarks.join("")}
      <path d="${areaD}" fill="url(#egrad)"/>
      <path d="${lineD}" fill="none" stroke="#ffb454" stroke-width="2.5"
        stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5"
        fill="#ffb454" stroke="#1a2130" stroke-width="2" data-dot></circle>`).join("")}
      ${labels}
    </svg>
    <div class="chart-tooltip" id="chartTooltip"></div>`;

  const svg = wrap.querySelector("svg");
  const tip = wrap.querySelector("#chartTooltip");
  const dots = svg.querySelectorAll("[data-dot]");
  dots.forEach((dot, i) => {
    const show = () => {
      const song = songs[i];
      tip.textContent = `${i + 1}. ${song.title} — エナジー ${song.energy}/5`;
      const svgRect = svg.getBoundingClientRect();
      const dotRect = dot.getBoundingClientRect();
      tip.style.left = `${dotRect.left - svgRect.left + dotRect.width / 2}px`;
      tip.style.top = `${dotRect.top - svgRect.top}px`;
      tip.classList.add("show");
    };
    dot.addEventListener("pointerenter", show);
    dot.addEventListener("pointerdown", show);
    dot.addEventListener("pointerleave", () => tip.classList.remove("show"));
  });
}

// ---------- 曲ダイアログ ----------

let editingSongId = null;

function openSongDialog(songId = null) {
  editingSongId = songId;
  const sl = activeSetlist();
  const song = songId ? sl.songs.find((s) => s.id === songId) : null;
  $("songDialogTitle").textContent = song ? "曲を編集" : "曲を追加";
  $("f-title").value = song?.title || "";
  $("f-bpm").value = song?.bpm ?? "";
  $("f-key").value = song?.key || "";
  $("f-tuning").value = song?.tuning || "";
  $("f-dur").value = song?.sec ? fmtTime(song.sec) : "";
  $("f-energy").value = song?.energy ?? 3;
  $("f-energyOut").textContent = song?.energy ?? 3;
  $("f-mc").checked = !!song?.mc;
  $("f-memo").value = song?.memo || "";
  $("songDialog").showModal();
  $("f-title").focus();
}

function bindSongDialog() {
  $("f-energy").addEventListener("input", () => {
    $("f-energyOut").textContent = $("f-energy").value;
  });
  $("songCancelBtn").addEventListener("click", () => $("songDialog").close());

  $("songForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("f-title").value.trim();
    if (!title) { $("f-title").reportValidity(); return; }
    const sec = parseTime($("f-dur").value);
    if (sec === null) {
      alert("曲の長さは「4:30」のように 分:秒 で入力してください。");
      return;
    }
    const bpmRaw = $("f-bpm").value.trim();
    const data = {
      title,
      bpm: bpmRaw === "" ? null : clampNum(bpmRaw, 20, 400, null),
      key: $("f-key").value.trim(),
      tuning: $("f-tuning").value.trim(),
      sec,
      energy: clampNum($("f-energy").value, 1, 5, 3),
      mc: $("f-mc").checked,
      memo: $("f-memo").value.trim(),
    };
    const sl = activeSetlist();
    if (editingSongId) {
      const song = sl.songs.find((s) => s.id === editingSongId);
      if (song) Object.assign(song, data);
    } else {
      sl.songs.push(newSong(data));
    }
    save();
    $("songDialog").close();
    renderAll();
  });
}

// ---------- セットリスト操作 ----------

function bindSetlistBar() {
  $("setlistSelect").addEventListener("change", () => {
    store.activeId = $("setlistSelect").value;
    save();
    renderAll();
  });

  $("newSetlistBtn").addEventListener("click", () => {
    const name = prompt("新しいセットリストの名前", `セトリ ${store.setlists.length + 1}`);
    if (name === null) return;
    const sl = newSetlist(name.trim() || "無題のセトリ");
    store.setlists.push(sl);
    store.activeId = sl.id;
    save();
    renderAll();
  });

  $("renameSetlistBtn").addEventListener("click", () => {
    const sl = activeSetlist();
    const name = prompt("セットリストの名前", sl.name);
    if (name === null) return;
    sl.name = name.trim() || sl.name;
    save();
    renderAll();
  });

  $("deleteSetlistBtn").addEventListener("click", () => {
    const sl = activeSetlist();
    if (!confirm(`セットリスト「${sl.name}」を削除しますか?この操作は元に戻せません。`)) return;
    store.setlists = store.setlists.filter((s) => s.id !== sl.id);
    if (!store.setlists.length) store.setlists.push(newSetlist("新しいセトリ"));
    store.activeId = store.setlists[0].id;
    save();
    renderAll();
    toast("削除しました");
  });

  $("addSongBtn").addEventListener("click", () => openSongDialog());
}

// ---------- 共有リンク ----------

function bindShare() {
  $("shareBtn").addEventListener("click", async () => {
    const sl = activeSetlist();
    if (!sl.songs.length) { toast("共有する曲がありません"); return; }
    try {
      const payload = await encodeShare(sl);
      const url = `${location.origin}${location.pathname}#s=${payload}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: `セトリ「${sl.name}」`, url });
          return;
        } catch (e) {
          if (e.name === "AbortError") return; // ユーザーがキャンセル
          // 共有シートが使えなければコピーへフォールバック
        }
      }
      await navigator.clipboard.writeText(url);
      toast("共有リンクをコピーしました。メンバーに送ってください 📋");
    } catch (e) {
      console.warn(e);
      toast("リンクを作成できませんでした");
    }
  });
}

async function checkSharedImport() {
  if (!location.hash.startsWith("#s=")) return;
  const payload = location.hash.slice(3);
  const clearHash = () => history.replaceState(null, "", location.pathname + location.search);
  let shared;
  try {
    shared = await decodeShare(payload);
  } catch (e) {
    console.warn(e);
    toast("共有リンクを読み込めませんでした(リンクが途中で切れている可能性があります)");
    clearHash();
    return;
  }
  const d = setlistDuration(shared);
  $("importSummary").textContent =
    `「${shared.name}」— ${shared.songs.length}曲・合計 ${fmtTime(d.total)}`;
  const dlg = $("importDialog");
  $("importOkBtn").onclick = () => {
    store.setlists.push(shared);
    store.activeId = shared.id;
    save();
    renderAll();
    dlg.close();
    clearHash();
    toast(`「${shared.name}」を読み込みました`);
  };
  $("importCancelBtn").onclick = () => { dlg.close(); clearHash(); };
  dlg.showModal();
}

// ---------- ステージシート印刷 ----------

function buildStageSheet() {
  const sl = activeSetlist();
  const d = setlistDuration(sl);
  const sheet = $("stageSheet");
  sheet.replaceChildren();

  const head = document.createElement("div");
  head.className = "ss-head";
  const title = document.createElement("span");
  title.className = "ss-title";
  title.textContent = sl.name;
  const date = document.createElement("span");
  date.className = "ss-date";
  const now = new Date();
  date.textContent = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  head.append(title, date);
  sheet.appendChild(head);

  sl.songs.forEach((song, i) => {
    const row = document.createElement("div");
    row.className = "ss-song";
    const num = document.createElement("span");
    num.className = "ss-num";
    num.textContent = `${i + 1}.`;
    const t = document.createElement("span");
    t.className = "ss-song-title";
    t.textContent = song.title;
    if (song.memo) {
      const memo = document.createElement("div");
      memo.className = "ss-memo";
      memo.textContent = song.memo;
      t.appendChild(memo);
    }
    const info = document.createElement("span");
    info.className = "ss-song-info";
    info.textContent = [song.tuning, song.key && `Key ${song.key}`, song.bpm && `♩=${song.bpm}`]
      .filter(Boolean).join(" ／ ");
    row.append(num, t, info);
    sheet.appendChild(row);

    if (song.mc) {
      const mc = document.createElement("div");
      mc.className = "ss-mc";
      mc.textContent = "MC";
      sheet.appendChild(mc);
    }
  });

  const foot = document.createElement("div");
  foot.className = "ss-foot";
  const left = document.createElement("span");
  left.textContent = `全${sl.songs.length}曲`;
  const right = document.createElement("span");
  right.textContent = `合計 ${fmtTime(d.total)}(持ち時間 ${sl.targetMin}分)`;
  foot.append(left, right);
  sheet.appendChild(foot);
}

function bindPrint() {
  $("printBtn").addEventListener("click", () => {
    if (!activeSetlist().songs.length) { toast("印刷する曲がありません"); return; }
    buildStageSheet();
    window.print();
  });
  window.addEventListener("beforeprint", buildStageSheet);
}

// ---------- バックアップ ----------

function bindBackup() {
  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    a.href = URL.createObjectURL(blob);
    a.download = `setlism-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast("バックアップを書き出しました");
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async () => {
    const file = $("importFile").files[0];
    $("importFile").value = "";
    if (!file) return;
    if (!confirm("バックアップを読み込むと、現在のデータはすべて置き換えられます。続けますか?")) return;
    try {
      replaceStore(await file.text());
      renderAll();
      toast("バックアップを読み込みました");
    } catch (e) {
      console.warn(e);
      toast("読み込めませんでした。セトリズムのバックアップファイルか確認してください");
    }
  });
}

// ---------- キーボード ----------

function bindKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    if ($("tab-metronome").hidden) return;
    if (e.target !== document.body) return;
    e.preventDefault();
    isMetronomeRunning() ? metronomeStop() : metronomeStart();
  });
}

// ---------- 起動 ----------

function init() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => selectTab(btn.dataset.tab));
  });

  bindTimeInputs();
  bindSongDialog();
  bindSetlistBar();
  bindShare();
  bindPrint();
  bindBackup();
  bindKeyboard();
  initMetronome();
  initTuner();
  renderAll();
  checkSharedImport();
  // すでにページを開いている状態で共有リンクを踏んだ場合(ハッシュのみの遷移)
  window.addEventListener("hashchange", checkSharedImport);

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();
