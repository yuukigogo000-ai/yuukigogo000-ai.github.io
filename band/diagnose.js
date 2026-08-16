// セトリ診断・型テンプレート・持ち替え解析。
// すべて純粋関数 — 入力は entriesOf() が返す {item, song} の配列。

import { setlistDuration, fmtTime } from "./store.js";

// ---------- セトリ診断 ----------
// level: "warn"(構成上の注意) / "info"(検討のヒント)

export function diagnose(sl, entries) {
  const out = [];
  const n = entries.length;
  if (n < 2) return out;

  // 1. チューニング替えの連続(間にMCなし)
  let switchRun = 0;
  for (let i = 1; i < n; i++) {
    const prev = entries[i - 1], cur = entries[i];
    const switched = prev.song.tuning && cur.song.tuning && prev.song.tuning !== cur.song.tuning;
    if (switched && !prev.item.mc) {
      switchRun++;
      if (switchRun >= 2) {
        out.push({
          level: "warn",
          text: `${i}〜${i + 1}曲目でチューニング替えが連続しています。転換が伸びやすいので、間にMCを挟むか曲順の見直しを検討してください。`,
        });
        switchRun = 0; // 同じ並びで多重に指摘しない
      }
    } else if (!switched) {
      switchRun = 0;
    }
  }

  // 2. 同じキーが3曲以上連続
  for (let i = 2; i < n; i++) {
    const k = entries[i].song.key;
    if (k && k === entries[i - 1].song.key && k === entries[i - 2].song.key) {
      out.push({
        level: "info",
        text: `${i - 1}〜${i + 1}曲目が同じキー(${k})で3曲続いています。響きが単調に聞こえることがあります。`,
      });
      break;
    }
  }

  // 3. BPMがほぼ同じ曲が3曲以上連続
  for (let i = 2; i < n; i++) {
    const a = entries[i - 2].song.bpm, b = entries[i - 1].song.bpm, c = entries[i].song.bpm;
    if (a && b && c && Math.abs(a - b) < 8 && Math.abs(b - c) < 8) {
      out.push({
        level: "info",
        text: `${i - 1}〜${i + 1}曲目のBPMがほぼ同じ(${a}前後)です。テンポの起伏をつけると流れが生まれます。`,
      });
      break;
    }
  }

  // 4. エナジーの急落(MCを挟まず3段階以上下がる)
  for (let i = 1; i < n; i++) {
    const drop = entries[i - 1].song.energy - entries[i].song.energy;
    if (drop >= 3 && !entries[i - 1].item.mc) {
      out.push({
        level: "info",
        text: `${i}曲目から${i + 1}曲目でエナジーが大きく落ちます(${entries[i - 1].song.energy}→${entries[i].song.energy})。意図的な演出でなければ、間にMCを挟むと自然につながります。`,
      });
    }
  }

  // 5. 最高エナジーの曲が序盤に来ている
  const maxEnergy = Math.max(...entries.map((e) => e.song.energy));
  const firstMaxIdx = entries.findIndex((e) => e.song.energy === maxEnergy);
  if (maxEnergy >= 4 && firstMaxIdx >= 0 && firstMaxIdx < Math.floor(n / 3) && n >= 4) {
    out.push({
      level: "info",
      text: `最高エナジーの「${entries[firstMaxIdx].song.title}」が序盤(${firstMaxIdx + 1}曲目)に来ています。切り札を後半に温存する構成も検討の余地があります。`,
    });
  }

  // 6. 転換・MC時間が演奏時間に対して重い
  const d = setlistDuration(sl);
  if (d.play > 0 && d.gaps + d.mc > d.play * 0.25) {
    out.push({
      level: "warn",
      text: `演奏 ${fmtTime(d.play)} に対して転換+MCが ${fmtTime(d.gaps + d.mc)} あります。持ち時間の4分の1を超えているので、配分を見直すと演奏に時間を回せます。`,
    });
  }

  // 7. 持ち時間オーバー
  const target = sl.targetMin * 60;
  if (target > 0 && d.total > target) {
    out.push({
      level: "warn",
      text: `合計 ${fmtTime(d.total)} で持ち時間(${sl.targetMin}分)を ${fmtTime(d.total - target)} オーバーしています。`,
    });
  }

  return out;
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
// チューニングの並びから「何本必要か」「どこで持ち替えるか」を出す。
// チューニング未設定の曲は「直前のまま弾ける」とみなしてスキップする。
// 戻り値: {needed:[{tuning, label, positions:[1-based...]}],
//          switches:[{fromIdx, toIdx, from, to, hasMC}]}  ※idxは0始まり

export function switchPlan(entries) {
  const seq = entries
    .map((e, idx) => ({ idx, tuning: e.song.tuning }))
    .filter((x) => x.tuning);
  if (!seq.length) return { needed: [], switches: [] };

  const order = [];
  for (const x of seq) {
    if (!order.includes(x.tuning)) order.push(x.tuning);
  }
  const LABELS = "ABCDEFGH";
  const needed = order.map((tuning, i) => ({
    tuning,
    label: LABELS[i] || `#${i + 1}`,
    positions: seq.filter((x) => x.tuning === tuning).map((x) => x.idx + 1),
  }));

  const switches = [];
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    if (a.tuning !== b.tuning) {
      // 2曲の間(未設定の曲を挟む場合も含む)のどこかにMCがあれば余裕あり
      const hasMC = entries.slice(a.idx, b.idx).some((e) => e.item.mc);
      switches.push({ fromIdx: a.idx, toIdx: b.idx, from: a.tuning, to: b.tuning, hasMC });
    }
  }
  return { needed, switches };
}
