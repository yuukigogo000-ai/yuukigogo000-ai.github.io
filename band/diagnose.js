// Deterministic, local-only checks. Style hints are not a quality score.
import { fmtTime } from "./store.js";

const positive = (v) => Number.isFinite(v) && v > 0;
const seconds = (v) => Number.isFinite(v) && v >= 0 ? v : 0;
const tuningOf = (e) => String(e.song.tuning || "").trim();
const songAction = (e, label = "曲を確認") => ({ kind: "song", songId: e.song.id, label });
const timeAction = { kind: "time", label: "時間を調整" };

// Use the supplied entries, never a second lookup in mutable global storage.
export function timingSummary(sl, entries) {
  const missing = entries.map((e, i) => positive(e.song.sec) ? null : i).filter((i) => i !== null);
  const play = entries.reduce((sum, e) => sum + (positive(e.song.sec) ? e.song.sec : 0), 0);
  const gaps = Math.max(0, entries.length - 1) * seconds(sl.gapSec);
  const mcCount = entries.filter((e) => e.item.mc).length;
  const mc = mcCount * seconds(sl.mcSec);
  const target = seconds(sl.targetMin) * 60;
  const total = play + gaps + mc;
  return { play, gaps, mc, mcCount, total, target, missing, margin: target > 0 && !missing.length ? target - total : null };
}

export function diagnose(sl, entries) {
  if (!entries.length) return [];
  const out = [];
  const add = (id, level, category, title, text, suggestion, action) => out.push({ id, level, category, title, text, suggestion, action });
  const d = timingSummary(sl, entries);
  if (d.missing.length) {
    add("missing-duration", "missing", "入力", `${d.missing.length}曲の長さが未入力`,
      `${d.missing.map((i) => `M${i + 1}`).join("・")}の長さが未入力です。現在の合計 ${fmtTime(d.total)} は入力済み分だけです。`,
      "実測した長さを入れてください。未入力の曲を0秒として、時間に収まるとは判定しません。",
      songAction(entries[d.missing[0]], "長さを入力"));
  }
  if (d.target > 0 && d.total > d.target) {
    add("overtime", "warn", "時間", `${d.missing.length ? "少なくとも" : ""}${fmtTime(d.total - d.target)} オーバー`,
      `合計 ${fmtTime(d.total)} ／ 持ち時間 ${fmtTime(d.target)}。演奏 ${fmtTime(d.play)} ＋ 転換 ${fmtTime(d.gaps)} ＋ MC ${fmtTime(d.mc)}。`,
      `${fmtTime(d.total - d.target)}以上短縮が必要です。MC・曲間を見直し、それでも難しければ外す曲を選んで再計算してください。`, timeAction);
  } else if (d.margin !== null && d.margin < 60) {
    add("tight-margin", "warn", "時間", `予備時間は ${fmtTime(d.margin)}`,
      "現在の入力では持ち時間内ですが、1分未満の余白しかありません。",
      "拍手・入退場・機材トラブルの時間を含めた計画か確認してください。1分は確認用の目安です。", timeAction);
  } else if (!d.target) {
    add("missing-target", "missing", "入力", "持ち時間が未設定",
      `入力済みの合計は ${fmtTime(d.total)}。枠内に収まるかは未判定です。`,
      "主催者から指定された持ち時間を設定してください。", timeAction);
  }
  const unknownTuning = entries.map((e, i) => tuningOf(e) ? null : i).filter((i) => i !== null);
  if (unknownTuning.length) {
    add("missing-tuning", "missing", "入力", `${unknownTuning.length}曲の調弦が未入力`,
      `${unknownTuning.map((i) => `M${i + 1}`).join("・")}のチューニングが不明なため、その前後の持ち替えは判定できません。`,
      "使用する楽器のチューニングを入力してください。未入力は「直前と同じ」と扱いません。",
      songAction(entries[unknownTuning[0]], "調弦を入力"));
  }
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1], cur = entries[i];
    const from = tuningOf(prev), to = tuningOf(cur);
    if (from && to && from !== to) {
      const gap = seconds(sl.gapSec), mc = prev.item.mc ? seconds(sl.mcSec) : 0;
      const budget = gap + mc;
      add(`tuning-${i}`, budget < 30 ? "warn" : "info", "持ち替え", `M${i} → M${i + 1} の持ち替えを確認`,
        `${from} → ${to}。設定は転換 ${fmtTime(gap)} ＋ MC ${fmtTime(mc)} = ${fmtTime(budget)}。`,
        `${budget < 30 ? "確認用の目安30秒より短い設定です。" : ""}MC中に実際に交換・再調弦できるか通し練習で計測してください。MCがあるだけでは余裕ありとは判定しません。`,
        songAction(cur));
    }
  }
  if (!d.missing.length && d.total > 0 && (d.gaps + d.mc) / d.total > .25) {
    add("transition-share", "info", "時間", "転換・MCの配分を確認",
      `全体 ${fmtTime(d.total)} のうち、転換・MCは ${fmtTime(d.gaps + d.mc)}（${Math.round(100 * (d.gaps + d.mc) / d.total)}%）です。`,
      "トークを重視するライブなら問題ありません。演奏を増やしたい場合のみ見直してください。", timeAction);
  }
  for (let i = 2; i < entries.length; i++) {
    const es = entries.slice(i - 2, i + 1), key = es[0].song.key;
    if (key && es.every((e) => e.song.key === key)) {
      add("same-key", "info", "演出", `M${i - 1}〜M${i + 1} は同じキー`,
        `3曲が ${key} で続きます。同じ響きによる一体感を作る構成でもあります。`,
        "変化を出したい場合だけ、曲調や編成の違いを聴き比べてください。", songAction(es[1]));
      break;
    }
  }
  for (let i = 2; i < entries.length; i++) {
    const es = entries.slice(i - 2, i + 1), bpms = es.map((e) => e.song.bpm);
    if (bpms.every(positive) && Math.max(...bpms) - Math.min(...bpms) < 8) {
      add("similar-bpm", "info", "演出", `M${i - 1}〜M${i + 1} のテンポが近い`,
        `BPM ${Math.min(...bpms)}〜${Math.max(...bpms)}。数値が近くても、拍子やリズムで体感は変わります。`,
        "連続するグルーヴを狙うならそのままで大丈夫です。変化が必要なら通して聴き比べましょう。", songAction(es[1]));
      break;
    }
  }
  for (let i = 1; i < entries.length; i++) {
    const a = entries[i - 1].song.energy, b = entries[i].song.energy;
    if (positive(a) && positive(b) && a - b >= 3 && !entries[i - 1].item.mc) {
      add(`energy-drop-${i}`, "info", "演出", `M${i} → M${i + 1} に大きな緩急`,
        `入力した盛り上がり度が ${a} → ${b} に変わります。静けさを作る意図的な演出なら問題ありません。`,
        "照明・余韻・短いMCを含め、どのようにつなぐかを決めておきましょう。", songAction(entries[i]));
    }
  }
  // An opener-first template explicitly calls for an early peak.
  const maxEnergy = Math.max(...entries.map((e) => Number(e.song.energy) || 0));
  const firstMax = entries.findIndex((e) => e.song.energy === maxEnergy);
  if (sl.template === "buildup" && entries.length >= 4 && maxEnergy >= 4 && firstMax < Math.floor(entries.length / 3)) {
    add("early-peak", "info", "演出", "選んだ尻上がり型と序盤のピークを確認",
      `最高の盛り上がり度の曲が M${firstMax + 1} にあります。`,
      "最初に強く掴む意図なら、掴み優先型との比較もできます。型に合わせること自体が目的ではありません。", songAction(entries[firstMax]));
  }
  const priority = { warn: 0, missing: 1, info: 2 };
  return out.sort((a, b) => priority[a.level] - priority[b.level]);
}

// ---------- 型テンプレート ----------
// f(t): t∈[0,1](セトリ内の位置) → 理想エナジー 1..5

export const TEMPLATES = [
  { id: "", name: "テンプレートなし", f: null },
  {
    id: "buildup",
    name: "尻上がり型(最後に爆発)",
    f: (t) => 1.5 + 3.5 * t,
  },
  {
    id: "twinPeaks",
    name: "2山型(中盤と終盤にピーク)",
    f: (t) => {
      const peak = (c, w) => Math.exp(-((t - c) ** 2) / (2 * w * w));
      return 1 + 4 * Math.max(peak(0.3, 0.13), peak(0.9, 0.13));
    },
  },
  {
    id: "opener",
    name: "掴み優先型(頭で掴んで再構築)",
    f: (t) => (t < 0.15 ? 5 - 8 * t : 1.8 + 3.2 * ((t - 0.15) / 0.85)),
  },
  {
    id: "ushape",
    name: "U字型(中盤で深く落とす)",
    f: (t) => 1.5 + 3.5 * Math.abs(t - 0.5) * 2 * 0.9 + 0.35,
  },
];

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

// テンプレートを曲位置でサンプリング(曲数 n)
export function sampleTemplate(tpl, n) {
  if (!tpl || !tpl.f || n < 2) return null;
  return Array.from({ length: n }, (_, i) => {
    const v = tpl.f(i / (n - 1));
    return Math.min(5, Math.max(1, v));
  });
}

// 実セトリとテンプレートの一致度(0..100)
export function templateFit(tpl, entries) {
  const ideal = sampleTemplate(tpl, entries.length);
  if (!ideal) return null;
  const se = entries.reduce((a, e, i) => a + (e.song.energy - ideal[i]) ** 2, 0);
  const rmse = Math.sqrt(se / entries.length); // 0..4
  return Math.max(0, Math.round(100 * (1 - rmse / 4)));
}

// ---------- 持ち替えプランナー ----------
// Distinct registered tunings are options for dedicated instruments, not a minimum guitar count.
// Unknown tunings break adjacency: no invented transition across an unknown song.
export function switchPlan(entries) {
  const seq = entries.map((e, idx) => ({ idx, tuning: tuningOf(e) }));
  const known = seq.filter((x) => x.tuning);
  const order = [...new Set(known.map((x) => x.tuning))];
  const needed = order.map((tuning, i) => ({
    tuning, label: "ABCDEFGH"[i] || `#${i + 1}`,
    positions: known.filter((x) => x.tuning === tuning).map((x) => x.idx + 1),
  }));
  const switches = [];
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    if (a.tuning && b.tuning && a.tuning !== b.tuning) {
      switches.push({ fromIdx: a.idx, toIdx: b.idx, from: a.tuning, to: b.tuning, hasMC: !!entries[a.idx].item.mc });
    }
  }
  return { needed, switches, unknownPositions: seq.filter((x) => !x.tuning).map((x) => x.idx + 1) };
}
