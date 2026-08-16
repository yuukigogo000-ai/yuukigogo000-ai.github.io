// 本番タブ:Now Playing(ライブ進行+押し巻き表示)とイベントタイムテーブル

import {
  store, save, pushUndo, activeSetlist, entriesOf, songOf,
  fmtTime, fmtSigned, fmtClock, parseClock, setlistDuration,
  newEvent, newAct, uid,
} from "./store.js";
import { requestWakeLock, releaseWakeLock } from "./metronome.js";

const $ = (id) => document.getElementById(id);
let toast = () => {};
let liveTimer = null;

// ============================================================
// Now Playing
// ============================================================

function buildLiveSteps(sl) {
  const entries = entriesOf(sl);
  const steps = [];
  let t = 0;
  entries.forEach((e, i) => {
    steps.push({
      type: "song",
      songId: e.song.id,
      label: e.song.title,
      planStart: t,
      planSec: e.song.sec,
      index: i + 1,
      total: entries.length,
    });
    t += e.song.sec;
    if (e.item.mc) {
      steps.push({ type: "mc", label: "MC", planStart: t, planSec: sl.mcSec || 0 });
      t += sl.mcSec || 0;
    }
    if (i < entries.length - 1) t += sl.gapSec || 0; // 転換は次のステップ開始に吸収
  });
  return steps;
}

function liveStart() {
  const sl = activeSetlist();
  const steps = buildLiveSteps(sl);
  if (!steps.length) { toast("セトリに曲がありません"); return; }
  store.live = {
    setlistId: sl.id,
    setlistName: sl.name,
    steps,
    idx: 0,
    startedAt: Date.now(),
    stepStartedAt: Date.now(),
    log: [],
  };
  save();
  renderLive();
}

function liveAdvance(dir) {
  const live = store.live;
  if (!live) return;
  if (dir > 0) {
    const step = live.steps[live.idx];
    live.log.push({
      label: step.label,
      type: step.type,
      planSec: step.planSec,
      actualSec: Math.round((Date.now() - live.stepStartedAt) / 1000),
    });
    if (live.idx + 1 >= live.steps.length) {
      liveFinish();
      return;
    }
    live.idx++;
  } else {
    if (live.idx === 0) return;
    live.idx--;
    live.log.pop();
  }
  live.stepStartedAt = Date.now();
  save();
  renderLive();
}

function liveFinish() {
  const live = store.live;
  if (!live) return;
  // まとめを表示
  const dlg = $("liveSummaryDialog");
  const body = $("liveSummaryBody");
  body.replaceChildren();
  let planTotal = 0, actualTotal = 0;
  for (const row of live.log) {
    planTotal += row.planSec;
    actualTotal += row.actualSec;
    const div = document.createElement("div");
    div.className = "summary-row";
    const name = document.createElement("span");
    name.textContent = row.type === "mc" ? "─ MC ─" : row.label;
    const nums = document.createElement("span");
    nums.className = "summary-nums";
    const diff = row.actualSec - row.planSec;
    nums.textContent = `予定 ${fmtTime(row.planSec)} → 実際 ${fmtTime(row.actualSec)}(${fmtSigned(diff)})`;
    nums.classList.toggle("over", diff > 30);
    div.append(name, nums);
    body.appendChild(div);
  }
  const total = document.createElement("div");
  total.className = "summary-row summary-total";
  total.innerHTML = "";
  const tName = document.createElement("span");
  tName.textContent = "合計";
  const tNums = document.createElement("span");
  tNums.className = "summary-nums";
  tNums.textContent = `予定 ${fmtTime(planTotal)} → 実際 ${fmtTime(actualTotal)}(${fmtSigned(actualTotal - planTotal)})`;
  total.append(tName, tNums);
  body.appendChild(total);

  store.live = null;
  save();
  releaseWakeLock();
  clearInterval(liveTimer);
  liveTimer = null;
  renderLive();
  dlg.showModal();
}

function liveAbort() {
  if (!confirm("本番モードを終了しますか?(記録は破棄されます)")) return;
  store.live = null;
  save();
  releaseWakeLock();
  clearInterval(liveTimer);
  liveTimer = null;
  renderLive();
}

// 押し(+)/巻き(−) 秒数
function liveDelta() {
  const live = store.live;
  const step = live.steps[live.idx];
  const base = (live.stepStartedAt - live.startedAt) / 1000 - step.planStart;
  const stepElapsed = (Date.now() - live.stepStartedAt) / 1000;
  const over = step.planSec > 0 ? Math.max(0, stepElapsed - step.planSec) : 0;
  return Math.round(base + over);
}

function liveTick() {
  const live = store.live;
  if (!live) return;
  const step = live.steps[live.idx];
  const stepElapsed = (Date.now() - live.stepStartedAt) / 1000;
  $("liveStepTime").textContent =
    step.planSec > 0
      ? `${fmtTime(stepElapsed)} / ${fmtTime(step.planSec)}`
      : fmtTime(stepElapsed);

  const delta = liveDelta();
  const deltaEl = $("liveDelta");
  if (Math.abs(delta) < 15) {
    deltaEl.textContent = "オンタイム";
    deltaEl.className = "live-delta ontime";
  } else if (delta > 0) {
    deltaEl.textContent = `${fmtTime(delta)} 押し`;
    deltaEl.className = "live-delta over";
  } else {
    deltaEl.textContent = `${fmtTime(-delta)} 巻き`;
    deltaEl.className = "live-delta under";
  }

  const pct = step.planSec > 0 ? Math.min(100, (stepElapsed / step.planSec) * 100) : 0;
  $("liveProgressFill").style.width = `${pct}%`;
}

export function renderLive() {
  const live = store.live;
  $("liveIdle").hidden = !!live;
  $("liveView").hidden = !live;
  if (!live) {
    clearInterval(liveTimer);
    liveTimer = null;
    const sl = activeSetlist();
    const d = setlistDuration(sl);
    $("liveIdleInfo").textContent =
      `対象:「${sl.name}」(${entriesOf(sl).length}曲・予定 ${fmtTime(d.total)})`;
    return;
  }

  const step = live.steps[live.idx];
  $("liveSetlistName").textContent = live.setlistName;
  $("liveStepType").textContent =
    step.type === "mc" ? "MC" : `${step.index} / ${step.total} 曲目`;
  $("liveTitle").textContent = step.type === "mc" ? "MC" : step.label;

  const song = step.songId ? songOf(step.songId) : null;
  const meta = $("liveMeta");
  meta.replaceChildren();
  if (song) {
    const addChip = (text) => {
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = text;
      meta.appendChild(c);
    };
    if (song.bpm) addChip(`♩=${song.bpm}`);
    if (song.key) addChip(`Key ${song.key}`);
    if (song.tuning) addChip(song.tuning);
  }

  // 次のステップと、次の曲の転換チェックリスト
  const next = live.steps[live.idx + 1];
  $("liveNext").textContent = next
    ? `次:${next.type === "mc" ? "MC" : next.label}`
    : "ラストです!";

  const checkWrap = $("liveChecklist");
  checkWrap.replaceChildren();
  const nextSong = next?.songId ? songOf(next.songId) : null;
  if (nextSong?.gear?.length) {
    const h = document.createElement("p");
    h.className = "note";
    h.textContent = `次の曲の準備(${nextSong.title}):`;
    checkWrap.appendChild(h);
    for (const g of nextSong.gear) {
      const label = document.createElement("label");
      label.className = "check-label gear-check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      label.append(cb, ` ${g}`);
      checkWrap.appendChild(label);
    }
  }

  $("livePrevBtn").disabled = live.idx === 0;
  $("liveNextBtn").textContent =
    live.idx + 1 >= live.steps.length ? "本番終了(まとめ)" : "次へ ▸";

  if (!liveTimer) liveTimer = setInterval(liveTick, 500);
  liveTick();
  requestWakeLock();
}

// ============================================================
// イベントタイムテーブル
// ============================================================

let activeEventId = null;

function activeEvent() {
  return store.events.find((e) => e.id === activeEventId) || store.events[0] || null;
}

// 各バンドの予定開始(分)を計算
function actPlans(ev) {
  const start = parseClock(ev.startTime) ?? 18 * 60;
  let t = start;
  return ev.acts.map((a) => {
    const plan = { act: a, startMin: t, endMin: t + a.min };
    t += a.min + ev.changeoverMin;
    return plan;
  });
}

// 直近の打刻から現在の押し(分)を出す
function eventDelta(ev, plans) {
  let delta = null;
  for (const p of plans) {
    if (p.act.actualStart != null) {
      const d = new Date(p.act.actualStart);
      const actualMin = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
      delta = actualMin - p.startMin;
    }
  }
  return delta;
}

function renderEvents() {
  const sel = $("eventSelect");
  if (!store.events.length) {
    sel.replaceChildren();
    $("eventEditor").hidden = true;
    $("eventEmpty").hidden = false;
    return;
  }
  $("eventEditor").hidden = false;
  $("eventEmpty").hidden = true;

  if (!store.events.some((e) => e.id === activeEventId)) {
    activeEventId = store.events[0].id;
  }
  sel.replaceChildren(
    ...store.events.map((e) => {
      const o = document.createElement("option");
      o.value = e.id;
      o.textContent = e.name;
      return o;
    })
  );
  sel.value = activeEventId;

  const ev = activeEvent();
  $("eventStart").value = ev.startTime;
  $("eventChangeover").value = ev.changeoverMin;

  const plans = actPlans(ev);
  const delta = eventDelta(ev, plans);
  const deltaEl = $("eventDelta");
  if (delta === null) {
    deltaEl.textContent = "";
  } else if (Math.abs(delta) < 3) {
    deltaEl.textContent = "ほぼオンタイム進行中";
    deltaEl.className = "time-diff under";
  } else if (delta > 0) {
    deltaEl.textContent = `現在 約${Math.round(delta)}分 押し(以降の予想時刻に反映済み)`;
    deltaEl.className = "time-diff over";
  } else {
    deltaEl.textContent = `現在 約${Math.round(-delta)}分 巻き(以降の予想時刻に反映済み)`;
    deltaEl.className = "time-diff under";
  }

  const list = $("actList");
  list.replaceChildren(
    ...plans.map((p, i) => {
      const a = p.act;
      const row = document.createElement("div");
      row.className = "act-row";
      if (a.setlistId) row.classList.add("is-us");

      const time = document.createElement("div");
      time.className = "act-time";
      const shift = delta !== null && a.actualStart == null ? delta : 0;
      time.textContent = `${fmtClock(p.startMin + shift)}〜${fmtClock(p.endMin + shift)}`;
      if (a.actualStart != null) {
        const d = new Date(a.actualStart);
        const stamped = document.createElement("span");
        stamped.className = "act-stamped";
        stamped.textContent = `実開始 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
        time.appendChild(stamped);
      }

      const main = document.createElement("div");
      main.className = "act-main";
      const name = document.createElement("div");
      name.className = "act-name";
      name.textContent = a.name;
      if (a.setlistId) {
        const badge = document.createElement("span");
        badge.className = "mc-badge";
        badge.textContent = "セトリ連動";
        name.appendChild(badge);
      }
      const sub = document.createElement("div");
      sub.className = "note";
      sub.textContent = `${a.min}分`;
      main.append(name, sub);

      const actions = document.createElement("div");
      actions.className = "act-actions";
      const mk = (label, title, fn, cls = "") => {
        const b = document.createElement("button");
        b.className = `icon-btn ${cls}`.trim();
        b.textContent = label;
        b.title = title;
        b.addEventListener("click", fn);
        return b;
      };
      const row1 = document.createElement("div");
      row1.className = "row2";
      const up = mk("↑", "上へ", () => moveAct(i, -1));
      const down = mk("↓", "下へ", () => moveAct(i, +1));
      up.disabled = i === 0;
      down.disabled = i === ev.acts.length - 1;
      row1.append(up, down);
      const row2 = document.createElement("div");
      row2.className = "row2";
      row2.append(
        mk("✎", "編集", () => editAct(a)),
        mk("×", "削除", () => {
          if (!confirm(`「${a.name}」を削除しますか?`)) return;
          pushUndo();
          ev.acts = ev.acts.filter((x) => x.id !== a.id);
          save(); renderEvents();
        }, "danger")
      );
      actions.append(row1, row2);

      const stampBtn = document.createElement("button");
      stampBtn.className = "ghost small stamp-btn";
      if (a.actualStart == null) {
        stampBtn.textContent = "開始を打刻";
        stampBtn.addEventListener("click", () => {
          a.actualStart = Date.now();
          save(); renderEvents();
        });
      } else {
        stampBtn.textContent = "打刻を取消";
        stampBtn.addEventListener("click", () => {
          a.actualStart = null;
          save(); renderEvents();
        });
      }

      row.append(time, main, actions, stampBtn);
      return row;
    })
  );

  const last = plans[plans.length - 1];
  $("eventEnd").textContent = last
    ? `終演予定:${fmtClock(last.endMin + (delta ?? 0))}`
    : "";
}

function moveAct(i, dir) {
  const ev = activeEvent();
  const j = i + dir;
  if (j < 0 || j >= ev.acts.length) return;
  pushUndo();
  [ev.acts[i], ev.acts[j]] = [ev.acts[j], ev.acts[i]];
  save(); renderEvents();
}

function editAct(act) {
  const name = prompt("バンド名", act.name);
  if (name === null) return;
  const minStr = prompt("持ち時間(分)", act.min);
  if (minStr === null) return;
  const min = Number(minStr);
  pushUndo();
  act.name = name.trim() || act.name;
  if (Number.isFinite(min) && min >= 1 && min <= 300) act.min = Math.round(min);
  save(); renderEvents();
}

function eventTimetableText() {
  const ev = activeEvent();
  if (!ev) return "";
  const plans = actPlans(ev);
  const lines = [`【${ev.name}】開演 ${ev.startTime}(転換${ev.changeoverMin}分)`];
  for (const p of plans) {
    lines.push(`${fmtClock(p.startMin)}〜${fmtClock(p.endMin)} ${p.act.name}`);
  }
  const last = plans[plans.length - 1];
  if (last) lines.push(`終演予定 ${fmtClock(last.endMin)}`);
  return lines.join("\n");
}

function initEvents() {
  $("eventSelect").addEventListener("change", () => {
    activeEventId = $("eventSelect").value;
    renderEvents();
  });

  const createEvent = () => {
    const name = prompt("イベント名", "自主企画");
    if (name === null) return;
    pushUndo();
    const ev = newEvent(name.trim() || "イベント");
    store.events.push(ev);
    activeEventId = ev.id;
    save(); renderEvents();
  };
  $("newEventBtn").addEventListener("click", createEvent);
  $("newEventBtn2").addEventListener("click", createEvent);

  $("renameEventBtn").addEventListener("click", () => {
    const ev = activeEvent();
    if (!ev) return;
    const name = prompt("イベント名", ev.name);
    if (name === null) return;
    pushUndo();
    ev.name = name.trim() || ev.name;
    save(); renderEvents();
  });

  $("deleteEventBtn").addEventListener("click", () => {
    const ev = activeEvent();
    if (!ev) return;
    if (!confirm(`イベント「${ev.name}」を削除しますか?`)) return;
    pushUndo();
    store.events = store.events.filter((e) => e.id !== ev.id);
    save(); renderEvents();
  });

  $("eventStart").addEventListener("change", () => {
    const ev = activeEvent();
    if (!ev) return;
    const v = $("eventStart").value;
    if (parseClock(v) !== null) {
      pushUndo();
      ev.startTime = v;
      save(); renderEvents();
    }
  });

  $("eventChangeover").addEventListener("change", () => {
    const ev = activeEvent();
    if (!ev) return;
    const n = Number($("eventChangeover").value);
    if (Number.isFinite(n) && n >= 0 && n <= 120) {
      pushUndo();
      ev.changeoverMin = Math.round(n);
      save(); renderEvents();
    }
  });

  $("addActBtn").addEventListener("click", () => {
    const ev = activeEvent();
    if (!ev) return;
    const name = prompt("バンド名", "");
    if (name === null || !name.trim()) return;
    pushUndo();
    ev.acts.push(newAct(name.trim()));
    save(); renderEvents();
  });

  $("addUsBtn").addEventListener("click", () => {
    const ev = activeEvent();
    if (!ev) return;
    const sl = activeSetlist();
    const d = setlistDuration(sl);
    pushUndo();
    const act = newAct(`自分たち(${sl.name})`);
    act.setlistId = sl.id;
    act.min = Math.max(1, Math.ceil(d.total / 60));
    ev.acts.push(act);
    save(); renderEvents();
    toast(`セトリの合計 ${fmtTime(d.total)} から持ち時間 ${act.min}分 で追加しました`);
  });

  $("copyTimetableBtn").addEventListener("click", async () => {
    const text = eventTimetableText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("タイムテーブルをコピーしました 📋");
    } catch {
      toast("コピーできませんでした");
    }
  });
}

// ============================================================

export function refreshLiveTab() {
  renderLive();
  renderEvents();
}

export function initLive(toastFn) {
  toast = toastFn;
  $("liveStartBtn").addEventListener("click", liveStart);
  $("liveNextBtn").addEventListener("click", () => liveAdvance(+1));
  $("livePrevBtn").addEventListener("click", () => liveAdvance(-1));
  $("liveAbortBtn").addEventListener("click", liveAbort);
  $("liveSummaryClose").addEventListener("click", () => $("liveSummaryDialog").close());
  initEvents();
  // 前回クラッシュ・リロードからの復帰
  if (store.live) renderLive();
}
