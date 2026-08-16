// セトリズム — メインオーケストレーション

import {
  store, save, pushUndo, undo, redo, canUndo, canRedo, onUndoChange,
  activeSetlist, entriesOf, songOf, usageCount,
  newSetlist, newSong, newItem, replaceStore,
  fmtTime, parseTime, setlistDuration, clampNum, uid,
} from "./store.js";
import {
  initMetronome, metronomeStart, metronomeStop, isMetronomeRunning,
  metronomeLoadSong, renderSongChips,
} from "./metronome.js";
import { initTuner } from "./tuner.js";
import { encodeShare, decodeShare } from "./share.js";
import { diagnose, TEMPLATES, templateById, sampleTemplate, templateFit, switchPlan } from "./diagnose.js";
import { initPractice, refreshPracticeTab } from "./practice.js";
import { initLive, refreshLiveTab } from "./live.js";
import qrcode from "./vendor/qrcode.mjs";

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

const TABS = ["setlist", "library", "practice", "metronome", "tuner", "live"];

function selectTab(name) {
  for (const t of TABS) {
    const selected = t === name;
    $(`tabbtn-${t}`).setAttribute("aria-selected", String(selected));
    $(`tab-${t}`).hidden = !selected;
  }
  if (name === "metronome") renderSongChips(entriesOf(activeSetlist()));
  if (name === "library") renderLibrary();
  if (name === "practice") refreshPracticeTab();
  if (name === "live") refreshLiveTab();
}

// ---------- 汎用部品 ----------

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

// ---------- 全体再描画 ----------

let compareId = ""; // A/B比較の相手(永続化しない)

function renderAll() {
  renderSetlistSelect();
  renderTimePanel();
  renderItems();
  renderEnergy();
  renderDiagnosis();
  renderPlanner();
  if (!$("tab-library").hidden) renderLibrary();
  if (!$("tab-metronome").hidden) renderSongChips(entriesOf(activeSetlist()));
  if (!$("tab-practice").hidden) refreshPracticeTab();
  if (!$("tab-live").hidden) refreshLiveTab();
}

// ---------- セットリスト選択・CRUD ----------

function renderSetlistSelect() {
  const sel = $("setlistSelect");
  sel.replaceChildren(
    ...store.setlists.map((s) => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = `${s.name}(${s.items.length}曲)`;
      return o;
    })
  );
  sel.value = store.activeId;

  // 比較セレクトも更新
  const cmp = $("compareSelect");
  const others = store.setlists.filter((s) => s.id !== store.activeId);
  cmp.replaceChildren(
    new Option("比較しない", ""),
    ...others.map((s) => new Option(`比較:${s.name}`, s.id))
  );
  if (!others.some((s) => s.id === compareId)) compareId = "";
  cmp.value = compareId;
  cmp.disabled = !others.length;

  const tpl = $("templateSelect");
  if (!tpl.options.length) {
    tpl.replaceChildren(...TEMPLATES.map((t) => new Option(t.name, t.id)));
  }
  tpl.value = activeSetlist().template || "";
}

function bindSetlistBar() {
  $("setlistSelect").addEventListener("change", () => {
    store.activeId = $("setlistSelect").value;
    compareId = "";
    save();
    renderAll();
  });

  $("newSetlistBtn").addEventListener("click", () => {
    const name = prompt("新しいセットリストの名前", `セトリ ${store.setlists.length + 1}`);
    if (name === null) return;
    pushUndo();
    const sl = newSetlist(name.trim() || "無題のセトリ");
    store.setlists.push(sl);
    store.activeId = sl.id;
    save();
    renderAll();
  });

  $("dupSetlistBtn").addEventListener("click", () => {
    const src = activeSetlist();
    pushUndo();
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid();
    copy.name = `${src.name} (コピー)`;
    copy.items = copy.items.map((it) => ({ ...it, id: uid() }));
    store.setlists.push(copy);
    store.activeId = copy.id;
    save();
    renderAll();
    toast(`「${copy.name}」を作成しました`);
  });

  $("renameSetlistBtn").addEventListener("click", () => {
    const sl = activeSetlist();
    const name = prompt("セットリストの名前", sl.name);
    if (name === null) return;
    pushUndo();
    sl.name = name.trim() || sl.name;
    save();
    renderAll();
  });

  $("deleteSetlistBtn").addEventListener("click", () => {
    const sl = activeSetlist();
    if (!confirm(`セットリスト「${sl.name}」を削除しますか?(曲はライブラリに残ります)`)) return;
    pushUndo();
    store.setlists = store.setlists.filter((s) => s.id !== sl.id);
    if (!store.setlists.length) store.setlists.push(newSetlist("新しいセトリ"));
    store.activeId = store.setlists[0].id;
    save();
    renderAll();
    toast("削除しました");
  });

  $("addSongBtn").addEventListener("click", openPicker);

  // Undo / Redo
  const syncUndoButtons = () => {
    $("undoBtn").disabled = !canUndo();
    $("redoBtn").disabled = !canRedo();
  };
  onUndoChange(syncUndoButtons);
  $("undoBtn").addEventListener("click", () => { if (undo()) { renderAll(); toast("元に戻しました"); } });
  $("redoBtn").addEventListener("click", () => { if (redo()) { renderAll(); toast("やり直しました"); } });
  syncUndoButtons();
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
      pushUndo();
      sl[field] = clampNum($(id).value, min, max, sl[field]);
      save();
      renderTimePanel();
      renderDiagnosis();
    });
  };
  bind("targetMin", "targetMin", 0, 600);
  bind("gapSec", "gapSec", 0, 600);
  bind("mcSec", "mcSec", 0, 1800);
}

// ---------- セトリの曲リスト ----------

function renderItems() {
  const sl = activeSetlist();
  const entries = entriesOf(sl);
  const list = $("songList");
  $("emptyHint").hidden = entries.length > 0;

  list.replaceChildren(
    ...entries.map(({ item, song }, i) => {
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
      if (song.gear.length) meta.appendChild(chip(`✔${song.gear.length}`, "chip chip-gear"));

      // MCトグル(この曲のあとにMC)
      const mcBtn = document.createElement("button");
      mcBtn.className = "chip chip-mc" + (item.mc ? " on" : "");
      mcBtn.textContent = "MC";
      mcBtn.title = item.mc ? "この曲のあとの MC を外す" : "この曲のあとに MC を入れる";
      mcBtn.setAttribute("aria-pressed", String(item.mc));
      mcBtn.addEventListener("click", () => {
        pushUndo();
        item.mc = !item.mc;
        save();
        renderAll();
      });
      meta.appendChild(mcBtn);

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
      const up = iconBtn("↑", "上へ", () => moveItem(i, -1));
      const down = iconBtn("↓", "下へ", () => moveItem(i, +1));
      up.disabled = i === 0;
      down.disabled = i === entries.length - 1;
      row1.append(up, down);
      const row2 = document.createElement("div");
      row2.className = "row2";
      row2.append(
        iconBtn("✎", "曲を編集(全セトリに反映)", () => openSongDialog({ mode: "edit", songId: song.id })),
        iconBtn("×", "セトリから外す(曲はライブラリに残る)", () => removeItem(item.id), "danger")
      );
      actions.append(row1, row2);

      li.append(handle, num, main, actions);
      setupDrag(li, handle);
      return li;
    })
  );
}

function moveItem(i, dir) {
  const items = activeSetlist().items;
  const j = i + dir;
  if (j < 0 || j >= items.length) return;
  pushUndo();
  [items[i], items[j]] = [items[j], items[i]];
  save();
  renderAll();
}

function removeItem(itemId) {
  const sl = activeSetlist();
  pushUndo();
  sl.items = sl.items.filter((it) => it.id !== itemId);
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
    pushUndo();
    const items = activeSetlist().items;
    const [moved] = items.splice(dragIndex, 1);
    items.splice(to, 0, moved);
    dragIndex = null;
    save();
    renderAll();
  });
}

// ---------- エナジーフロー ----------

const CHART = { W: 640, H: 170, padL: 36, padR: 18, padT: 18, padB: 26 };

function chartCoords(n) {
  const { W, H, padL, padR, padT, padB } = CHART;
  return {
    yOf: (e) => H - padB - ((e - 1) / 4) * (H - padT - padB),
    xOf: (i) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1),
  };
}

function pathOf(values, coords) {
  return values
    .map((v, i) => `${i ? "L" : "M"} ${coords.xOf(i).toFixed(1)} ${coords.yOf(v).toFixed(1)}`)
    .join(" ");
}

function renderEnergy() {
  const sl = activeSetlist();
  const wrap = $("energyChart");
  const entries = entriesOf(sl);
  const n = entries.length;

  // テンプレート一致度
  const tpl = templateById(sl.template);
  const fit = templateFit(tpl, entries);
  $("templateFit").textContent = fit !== null ? `一致度 ${fit}%` : "";

  if (n < 2) {
    wrap.innerHTML =
      '<p class="energy-empty">曲を2曲以上登録すると、セット全体の盛り上がりの流れが表示されます。</p>';
    $("chartLegend").replaceChildren();
    return;
  }

  const { W, H, padL, padR, padT, padB } = CHART;
  const coords = chartCoords(n);
  const { xOf, yOf } = coords;

  const values = entries.map((e) => e.song.energy);
  const lineD = pathOf(values, coords);
  const areaD = `${lineD} L ${xOf(n - 1).toFixed(1)} ${H - padB} L ${padL} ${H - padB} Z`;

  const grid = [];
  for (let e = 1; e <= 5; e++) {
    grid.push(`<line x1="${padL}" y1="${yOf(e)}" x2="${W - padR}" y2="${yOf(e)}" stroke="#ffffff12" stroke-width="1"/>`);
  }

  // MC マーカー
  const mcMarks = [];
  entries.forEach((e, i) => {
    if (!e.item.mc) return;
    const x = i < n - 1 ? (xOf(i) + xOf(i + 1)) / 2 : Math.min(xOf(i) + 22, W - padR);
    mcMarks.push(`<line x1="${x.toFixed(1)}" y1="${padT - 4}" x2="${x.toFixed(1)}" y2="${H - padB}"
        stroke="#7d8699" stroke-width="1.5" stroke-dasharray="3 4"/>
      <text x="${x.toFixed(1)}" y="${padT - 7}" fill="#7d8699" font-size="10" font-weight="700"
        text-anchor="middle" letter-spacing="1">MC</text>`);
  });

  // テンプレート(理想カーブ・破線グレー)
  let tplPath = "";
  const ideal = sampleTemplate(tpl, n);
  if (ideal) {
    tplPath = `<path d="${pathOf(ideal, coords)}" fill="none" stroke="#8a93a6" stroke-width="2"
      stroke-dasharray="6 5" stroke-linejoin="round" opacity="0.9"/>`;
  }

  // 比較セトリ(青)— 曲数が違っても同じ幅に正規化して重ねる
  let cmpPath = "";
  const cmpSl = store.setlists.find((s) => s.id === compareId);
  let cmpEntries = null;
  if (cmpSl) {
    cmpEntries = entriesOf(cmpSl);
    if (cmpEntries.length >= 2) {
      const cCoords = chartCoords(cmpEntries.length);
      cmpPath = `<path d="${pathOf(cmpEntries.map((e) => e.song.energy), cCoords)}" fill="none"
        stroke="#7ab8ff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>`;
    }
  }

  const labels = entries
    .map((e, i) => `<text x="${xOf(i).toFixed(1)}" y="${H - 8}" fill="#7d8699" font-size="11"
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
      ${tplPath}
      ${cmpPath}
      <path d="${lineD}" fill="none" stroke="#ffb454" stroke-width="2.5"
        stroke-linejoin="round" stroke-linecap="round"/>
      ${values.map((v, i) => `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="5.5"
        fill="#ffb454" stroke="#1a2130" stroke-width="2" data-dot></circle>`).join("")}
      ${labels}
    </svg>
    <div class="chart-tooltip" id="chartTooltip"></div>`;

  // 凡例(系列が2つ以上のときは必ず出す)
  const legend = $("chartLegend");
  legend.replaceChildren();
  const legendItem = (swatchCls, label) => {
    const span = document.createElement("span");
    span.className = "legend-item";
    const sw = document.createElement("i");
    sw.className = `legend-swatch ${swatchCls}`;
    span.append(sw, label);
    return span;
  };
  if (ideal || cmpPath) {
    legend.append(legendItem("sw-main", sl.name));
    if (ideal) legend.append(legendItem("sw-tpl", `理想:${tpl.name}`));
    if (cmpPath) legend.append(legendItem("sw-cmp", cmpSl.name));
  }

  // 比較サマリー
  const cmpInfo = $("compareInfo");
  if (cmpSl && cmpEntries) {
    const a = setlistDuration(sl), b = setlistDuration(cmpSl);
    const sw = (s, es) => switchPlan(es).switches.length;
    cmpInfo.hidden = false;
    cmpInfo.textContent =
      `${sl.name}:${entries.length}曲 ${fmtTime(a.total)}・持ち替え${sw(sl, entries)}回 ／ ` +
      `${cmpSl.name}:${cmpEntries.length}曲 ${fmtTime(b.total)}・持ち替え${sw(cmpSl, cmpEntries)}回`;
  } else {
    cmpInfo.hidden = true;
  }

  // ホバーツールチップ
  const svg = wrap.querySelector("svg");
  const tip = wrap.querySelector("#chartTooltip");
  svg.querySelectorAll("[data-dot]").forEach((dot, i) => {
    const show = () => {
      const e = entries[i];
      tip.textContent = `${i + 1}. ${e.song.title} — エナジー ${e.song.energy}/5`;
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

function bindChartControls() {
  $("templateSelect").addEventListener("change", () => {
    const sl = activeSetlist();
    sl.template = $("templateSelect").value;
    save();
    renderEnergy();
  });
  $("compareSelect").addEventListener("change", () => {
    compareId = $("compareSelect").value;
    renderEnergy();
  });
}

// ---------- セトリ診断 ----------

function renderDiagnosis() {
  const sl = activeSetlist();
  const entries = entriesOf(sl);
  const listEl = $("diagList");
  const results = diagnose(sl, entries);
  if (entries.length < 2) {
    listEl.innerHTML = '<p class="note">曲が増えると、構成上の注意点をここでお知らせします。</p>';
    return;
  }
  if (!results.length) {
    listEl.innerHTML = '<p class="diag-ok">指摘はありません。流れの良いセトリです 👍</p>';
    return;
  }
  listEl.replaceChildren(
    ...results.map((r) => {
      const div = document.createElement("div");
      div.className = `diag-item diag-${r.level}`;
      const icon = document.createElement("span");
      icon.className = "diag-icon";
      icon.textContent = r.level === "warn" ? "⚠" : "💡";
      const text = document.createElement("span");
      text.textContent = r.text;
      div.append(icon, text);
      return div;
    })
  );
}

// ---------- 持ち替えプランナー ----------

function renderPlanner() {
  const entries = entriesOf(activeSetlist());
  const body = $("plannerBody");
  const plan = switchPlan(entries);

  if (!plan.needed.length) {
    body.innerHTML = '<p class="note">曲にチューニングを登録すると、持ち替えプランが表示されます。</p>';
    return;
  }
  if (plan.needed.length === 1) {
    body.innerHTML = `<p class="note">チューニングは「${plan.needed[0].tuning}」の1種類。持ち替えなしで通せます 👍</p>`;
    return;
  }

  body.replaceChildren();
  const h = document.createElement("p");
  h.className = "planner-head";
  h.textContent = `必要な本数:${plan.needed.length}本`;
  body.appendChild(h);

  for (const g of plan.needed) {
    const div = document.createElement("div");
    div.className = "planner-row";
    div.textContent = `ギター${g.label}(${g.tuning}):${g.positions.map((p) => `M${p}`).join(", ")}`;
    body.appendChild(div);
  }

  if (plan.switches.length) {
    const h2 = document.createElement("p");
    h2.className = "planner-head";
    h2.textContent = `持ち替えタイミング:${plan.switches.length}回`;
    body.appendChild(h2);
    for (const s of plan.switches) {
      const div = document.createElement("div");
      div.className = "planner-row" + (s.hasMC ? "" : " planner-warn");
      div.textContent =
        `M${s.fromIdx + 1}→M${s.toIdx + 1}:${s.from} → ${s.to} ` +
        (s.hasMC ? "(MCあり ✓ 余裕)" : "(MCなし ⚠ 転換が慌ただしくなります)");
      body.appendChild(div);
    }
  }
}

// ---------- 曲ダイアログ(ライブラリの曲を編集/新規) ----------

let songDialogState = null; // {mode: "edit"|"new-library"|"new-add", songId?}

function openSongDialog(state) {
  songDialogState = state;
  const song = state.mode === "edit" ? songOf(state.songId) : null;
  $("songDialogTitle").textContent = song ? "曲を編集" : "曲を追加";
  const usage = song ? usageCount(song.id) : 0;
  $("songDialogNote").hidden = !(song && usage > 1);
  if (song && usage > 1) {
    $("songDialogNote").textContent = `※ この曲は ${usage} 個のセトリで使われています。変更はすべてに反映されます。`;
  }
  $("f-title").value = song?.title || "";
  $("f-bpm").value = song?.bpm ?? "";
  $("f-key").value = song?.key || "";
  $("f-tuning").value = song?.tuning || "";
  $("f-dur").value = song?.sec ? fmtTime(song.sec) : "";
  $("f-energy").value = song?.energy ?? 3;
  $("f-energyOut").textContent = song?.energy ?? 3;
  $("f-gear").value = song?.gear?.join("\n") || "";
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
      memo: $("f-memo").value.trim(),
      gear: $("f-gear").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20),
    };
    pushUndo();
    if (songDialogState.mode === "edit") {
      const song = songOf(songDialogState.songId);
      if (song) Object.assign(song, data);
    } else {
      const song = newSong(data);
      store.library.push(song);
      if (songDialogState.mode === "new-add") {
        activeSetlist().items.push(newItem(song.id));
      }
    }
    save();
    $("songDialog").close();
    renderAll();
    if ($("pickerDialog").open) renderPickerList();
  });
}

// ---------- 曲ピッカー(セトリへ追加) ----------

function openPicker() {
  $("pickerSearch").value = "";
  renderPickerList();
  $("pickerDialog").showModal();
}

function renderPickerList() {
  const q = $("pickerSearch").value.trim().toLowerCase();
  const sl = activeSetlist();
  const listEl = $("pickerList");
  const songs = store.library
    .filter((s) => !q || s.title.toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title, "ja"));

  if (!store.library.length) {
    listEl.innerHTML = '<p class="note">ライブラリが空です。下の「新しい曲を作る」から登録してください。</p>';
    return;
  }
  if (!songs.length) {
    listEl.innerHTML = '<p class="note">見つかりませんでした。</p>';
    return;
  }
  listEl.replaceChildren(
    ...songs.map((song) => {
      const inCount = sl.items.filter((it) => it.songId === song.id).length;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "picker-row";
      const main = document.createElement("span");
      main.className = "picker-title";
      main.textContent = song.title;
      const meta = document.createElement("span");
      meta.className = "picker-meta";
      meta.textContent = [
        song.bpm && `♩=${song.bpm}`, song.key && `Key ${song.key}`,
        song.tuning, song.sec && fmtTime(song.sec),
      ].filter(Boolean).join(" ・ ");
      const badge = document.createElement("span");
      badge.className = "picker-badge";
      badge.textContent = inCount ? `セトリに${inCount}回` : "＋追加";
      b.append(main, meta, badge);
      b.addEventListener("click", () => {
        pushUndo();
        sl.items.push(newItem(song.id));
        save();
        renderAll();
        renderPickerList();
        toast(`「${song.title}」を追加しました`);
      });
      return b;
    })
  );
}

function bindPicker() {
  $("pickerSearch").addEventListener("input", renderPickerList);
  $("pickerNewBtn").addEventListener("click", () => {
    openSongDialog({ mode: "new-add" });
  });
  $("pickerClose").addEventListener("click", () => $("pickerDialog").close());
}

// ---------- ライブラリタブ ----------

function renderLibrary() {
  const q = $("libSearch").value.trim().toLowerCase();
  const listEl = $("libList");
  const songs = store.library
    .filter((s) => !q || s.title.toLowerCase().includes(q) || s.key.toLowerCase().includes(q) || s.tuning.toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title, "ja"));

  $("libCount").textContent = `全 ${store.library.length} 曲`;

  if (!store.library.length) {
    listEl.innerHTML = '<p class="empty-hint">持ち曲をここに登録しておくと、どのセトリからでも呼び出せます。</p>';
    return;
  }
  if (!songs.length) {
    listEl.innerHTML = '<p class="note">見つかりませんでした。</p>';
    return;
  }

  listEl.replaceChildren(
    ...songs.map((song) => {
      const li = document.createElement("li");
      li.className = "song lib-song";

      const main = document.createElement("div");
      main.className = "song-main";
      const title = document.createElement("div");
      title.className = "song-title";
      title.textContent = song.title;
      const meta = document.createElement("div");
      meta.className = "song-meta";
      if (song.bpm) meta.appendChild(chip(`♩=${song.bpm}`));
      if (song.key) meta.appendChild(chip(`Key ${song.key}`));
      if (song.tuning) meta.appendChild(chip(song.tuning));
      if (song.sec) meta.appendChild(chip(fmtTime(song.sec)));
      meta.appendChild(energyDots(song.energy));
      if (song.gear.length) meta.appendChild(chip(`✔${song.gear.length}`, "chip chip-gear"));
      const used = usageCount(song.id);
      meta.appendChild(chip(used ? `${used}セトリで使用` : "未使用"));
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
      row1.append(
        iconBtn("✎", "編集", () => openSongDialog({ mode: "edit", songId: song.id })),
        iconBtn("⧉", "複製", () => {
          pushUndo();
          const copy = newSong({ ...JSON.parse(JSON.stringify(song)), id: uid(), title: `${song.title} (コピー)` });
          store.library.push(copy);
          save();
          renderLibrary();
        })
      );
      const row2 = document.createElement("div");
      row2.className = "row2";
      row2.append(
        iconBtn("×", "ライブラリから削除", () => {
          const used = usageCount(song.id);
          const msg = used
            ? `「${song.title}」は ${used} 個のセトリで使われています。すべてのセトリからも外れます。削除しますか?`
            : `「${song.title}」を削除しますか?`;
          if (!confirm(msg)) return;
          pushUndo();
          store.library = store.library.filter((s) => s.id !== song.id);
          for (const sl of store.setlists) {
            sl.items = sl.items.filter((it) => it.songId !== song.id);
          }
          save();
          renderAll();
        }, "danger")
      );
      actions.append(row1, row2);

      li.append(main, actions);
      return li;
    })
  );
}

function bindLibrary() {
  $("libSearch").addEventListener("input", renderLibrary);
  $("libAddBtn").addEventListener("click", () => openSongDialog({ mode: "new-library" }));
}

// ---------- 共有(リンク・QR・テキスト) ----------

async function buildShareUrl() {
  const sl = activeSetlist();
  const entries = entriesOf(sl);
  if (!entries.length) { toast("共有する曲がありません"); return null; }
  const payload = await encodeShare(sl, entries);
  return `${location.origin}${location.pathname}#s=${payload}`;
}

function setlistText() {
  const sl = activeSetlist();
  const entries = entriesOf(sl);
  const d = setlistDuration(sl);
  const lines = [`【${sl.name}】全${entries.length}曲 合計${fmtTime(d.total)}(持ち時間${sl.targetMin}分)`];
  entries.forEach(({ item, song }, i) => {
    const info = [
      song.key && `Key ${song.key}`, song.tuning, song.bpm && `♩=${song.bpm}`,
      song.sec ? fmtTime(song.sec) : null,
    ].filter(Boolean).join(" / ");
    lines.push(`${i + 1}. ${song.title}${info ? `(${info})` : ""}`);
    if (item.mc) lines.push("― MC ―");
  });
  return lines.join("\n");
}

function bindShare() {
  $("shareBtn").addEventListener("click", () => $("shareDialog").showModal());
  $("shareDialogClose").addEventListener("click", () => $("shareDialog").close());

  $("shareLinkBtn").addEventListener("click", async () => {
    try {
      const url = await buildShareUrl();
      if (!url) return;
      $("shareDialog").close();
      if (navigator.share) {
        try {
          await navigator.share({ title: `セトリ「${activeSetlist().name}」`, url });
          return;
        } catch (e) {
          if (e.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      toast("共有リンクをコピーしました。メンバーに送ってください 📋");
    } catch (e) {
      console.warn(e);
      toast("リンクを作成できませんでした");
    }
  });

  $("shareQrBtn").addEventListener("click", async () => {
    try {
      const url = await buildShareUrl();
      if (!url) return;
      const qr = qrcode(0, "L");
      qr.addData(url, "Byte");
      qr.make();
      $("qrBox").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
      $("qrCaption").textContent = `「${activeSetlist().name}」— カメラで読み取るとセトリが開きます`;
      $("shareDialog").close();
      $("qrDialog").showModal();
    } catch (e) {
      console.warn(e);
      toast("QRコードを作成できませんでした(セトリが大きすぎる可能性があります)");
    }
  });
  $("qrClose").addEventListener("click", () => $("qrDialog").close());

  $("shareTextBtn").addEventListener("click", async () => {
    const entries = entriesOf(activeSetlist());
    if (!entries.length) { toast("共有する曲がありません"); return; }
    try {
      await navigator.clipboard.writeText(setlistText());
      $("shareDialog").close();
      toast("セトリをテキストでコピーしました 📋");
    } catch {
      toast("コピーできませんでした");
    }
  });
}

// ---------- 共有リンクの取り込み ----------

async function checkSharedImport() {
  if (!location.hash.startsWith("#s=")) return;
  const payload = location.hash.slice(3);
  const clearHash = () => history.replaceState(null, "", location.pathname + location.search);
  let bundle;
  try {
    bundle = await decodeShare(payload);
  } catch (e) {
    console.warn(e);
    toast("共有リンクを読み込めませんでした(リンクが途中で切れている可能性があります)");
    clearHash();
    return;
  }
  const totalSec =
    bundle.rows.reduce((a, r) => a + r.song.sec, 0) +
    Math.max(0, bundle.rows.length - 1) * bundle.gapSec +
    bundle.rows.filter((r) => r.mc).length * bundle.mcSec;
  $("importSummary").textContent =
    `「${bundle.name}」— ${bundle.rows.length}曲・合計 ${fmtTime(totalSec)}`;
  const dlg = $("importDialog");
  $("importOkBtn").onclick = () => {
    pushUndo();
    const sl = newSetlist(bundle.name);
    sl.targetMin = bundle.targetMin;
    sl.gapSec = bundle.gapSec;
    sl.mcSec = bundle.mcSec;
    for (const row of bundle.rows) {
      // 同じ曲がライブラリにあれば再利用(タイトル+BPM+キー一致)
      let song = store.library.find(
        (s) => s.title === row.song.title && s.bpm === row.song.bpm && s.key === row.song.key
      );
      if (!song) {
        song = row.song;
        store.library.push(song);
      }
      sl.items.push(newItem(song.id, { mc: row.mc }));
    }
    store.setlists.push(sl);
    store.activeId = sl.id;
    save();
    renderAll();
    dlg.close();
    clearHash();
    toast(`「${bundle.name}」を読み込みました`);
  };
  $("importCancelBtn").onclick = () => { dlg.close(); clearHash(); };
  dlg.showModal();
}

// ---------- ステージシート印刷 ----------

function buildStageSheet() {
  const sl = activeSetlist();
  const entries = entriesOf(sl);
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

  entries.forEach(({ item, song }, i) => {
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
    if (song.gear.length) {
      const gear = document.createElement("div");
      gear.className = "ss-memo";
      gear.textContent = `☐ ${song.gear.join("  ☐ ")}`;
      t.appendChild(gear);
    }
    const info = document.createElement("span");
    info.className = "ss-song-info";
    info.textContent = [song.tuning, song.key && `Key ${song.key}`, song.bpm && `♩=${song.bpm}`]
      .filter(Boolean).join(" ／ ");
    row.append(num, t, info);
    sheet.appendChild(row);

    if (item.mc) {
      const mc = document.createElement("div");
      mc.className = "ss-mc";
      mc.textContent = "MC";
      sheet.appendChild(mc);
    }
  });

  // 持ち替えプラン
  const plan = switchPlan(entries);
  if (plan.needed.length > 1) {
    const pl = document.createElement("div");
    pl.className = "ss-plan";
    const h = document.createElement("div");
    h.className = "ss-plan-head";
    h.textContent = `持ち替え(${plan.needed.length}本)`;
    pl.appendChild(h);
    for (const g of plan.needed) {
      const line = document.createElement("div");
      line.textContent = `ギター${g.label}(${g.tuning}):${g.positions.map((p) => `M${p}`).join(", ")}`;
      pl.appendChild(line);
    }
    sheet.appendChild(pl);
  }

  const foot = document.createElement("div");
  foot.className = "ss-foot";
  const left = document.createElement("span");
  left.textContent = `全${entries.length}曲`;
  const right = document.createElement("span");
  right.textContent = `合計 ${fmtTime(d.total)}(持ち時間 ${sl.targetMin}分)`;
  foot.append(left, right);
  sheet.appendChild(foot);
}

function bindPrint() {
  $("printBtn").addEventListener("click", () => {
    if (!entriesOf(activeSetlist()).length) { toast("印刷する曲がありません"); return; }
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
    toast("バックアップを書き出しました(録音データは含まれません)");
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async () => {
    const file = $("importFile").files[0];
    $("importFile").value = "";
    if (!file) return;
    if (!confirm("バックアップを読み込むと、現在のデータはすべて置き換えられます。続けますか?")) return;
    try {
      pushUndo();
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
    const typing = e.target !== document.body;
    if (e.code === "Space" && !$("tab-metronome").hidden && !typing) {
      e.preventDefault();
      isMetronomeRunning() ? metronomeStop() : metronomeStart();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !typing) {
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (undo()) { renderAll(); toast("元に戻しました"); }
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        if (redo()) { renderAll(); toast("やり直しました"); }
      }
    }
  });
}

// ---------- 起動 ----------

function init() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => selectTab(btn.dataset.tab));
  });

  bindTimeInputs();
  bindSongDialog();
  bindPicker();
  bindLibrary();
  bindSetlistBar();
  bindChartControls();
  bindShare();
  bindPrint();
  bindBackup();
  bindKeyboard();
  initMetronome();
  initTuner();
  initPractice(toast);
  initLive(toast);
  renderAll();
  checkSharedImport();
  // すでにページを開いている状態で共有リンクを踏んだ場合(ハッシュのみの遷移)
  window.addEventListener("hashchange", checkSharedImport);

  // 本番モードが進行中ならそのタブで復帰
  if (store.live) selectTab("live");

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();
