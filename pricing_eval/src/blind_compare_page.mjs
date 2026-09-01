// ブラインド比較ページ(§9)。最終3案だけを左右に並べ、**モデル名・価格・遅延・fallback・自動判定を出さない**。
//
// - 各ケースで A/B の表示順を固定 seed で入れ替える(A が常に同じモデルにならない)
// - モデル対応表は別ファイル(このページを開いても分からない)
// - raw6候補はこのページに出さない(技術確認用ページに別途出す)
//
// 使い方: node pricing_eval/src/blind_compare_page.mjs --experiment=<experimentId>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntry, parseArgs } from './lib/config.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 決定的な32bitハッシュ(FNV-1a) */
export function stableHash(s) {
  let h = 0x811c9dc5;
  const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/**
 * ケースごとの左右割り当て。seed とケースIDから決定的に決める。
 * 全ケースで同じ並びにならないよう、偏った場合は後ろから交互に入れ替える。
 */
export function sideAssignment(caseIds, seed, [m1, m2]) {
  const map = new Map();
  caseIds.forEach((id, i) => {
    // seed のハッシュに並び順を混ぜる = 隣り合うケースで必ず入れ替わるので、A が一方に固定されない
    const first = (stableHash(`${seed}|${id}`) + i) % 2 === 0;
    map.set(id, { A: first ? m1 : m2, B: first ? m2 : m1 });
  });
  return map;
}

/** 割り当てが偏っていないか(自己検査) */
export function checkAssignment(assignment, [m1, m2]) {
  const problems = [];
  const asA = [...assignment.values()].map((v) => v.A);
  if (new Set(asA).size < 2) problems.push('A が常に同じモデルになっている');
  const n1 = asA.filter((x) => x === m1).length;
  if (n1 === 0 || n1 === asA.length) problems.push(`A 側の偏り: ${m1} が ${n1}/${asA.length}`);
  for (const [caseId, v] of assignment) if (v.A === v.B) problems.push(`${caseId}: A と B が同じモデル`);
  return problems;
}

/** ページ本文にモデル名・モデルIDが混ざっていないか(自己検査) */
export function containsModelIdentity(html, modelIds) {
  const hay = String(html).toLowerCase();
  const words = new Set();
  for (const id of modelIds) {
    words.add(id.toLowerCase());
    for (const part of id.toLowerCase().split(/[.\-_]/)) if (part.length >= 4) words.add(part);
  }
  return [...words].filter((w) => hay.includes(w));
}

/**
 * ブラインドページ本文。price/latency/fallback/自動判定は入れない。
 * @param {{experimentId:string, cases:{id:string, conversation:string, goal:string}[],
 *          repliesByModel:Record<string, Record<string,string[]>>, assignment:Map}} args
 */
export function renderBlindPage({ experimentId, cases, repliesByModel, assignment }) {
  const head = `<!doctype html><meta charset="utf-8"><title>返信案 ブラインド比較</title>
<style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;color:#222;line-height:1.6}
.case{border:1px solid #ccc;border-radius:8px;padding:14px;margin:20px 0}
.conv{background:#f7f7f7;border-radius:6px;padding:10px;font-size:13px;white-space:pre-wrap}
.cols{display:flex;gap:14px;margin-top:10px;flex-wrap:wrap}
.col{flex:1 1 320px;border:1px solid #ddd;border-radius:6px;padding:10px}
.col h4{margin:0 0 8px}
.reply{border-top:1px solid #eee;padding:8px 0;font-size:14px}
.q{font-size:12px;color:#444;margin-top:4px}
.verdict{margin-top:10px;padding:8px;border:2px dashed #999;border-radius:6px;font-size:13px}
textarea{width:100%;min-height:40px}
</style>
<h1>返信案 ブラインド比較(どちらが良いか)</h1>
<p>2つの作り方(左=A / 右=B)で作った返信案です。<b>どちらがどの仕組みかは伏せています。</b>
先入観を避けるため、費用・速度・内部の自動判定はこのページに出していません。</p>
<p><b>見るところ</b>: そのまま送れるか / 作り話の個人事実が混ざっていないか / 不自然でないか / 相手の発言と噛み合っているか。
最後に「Aが良い・Bが良い・引き分け・両方不合格」を選んでください。</p>
<p style="background:#fff3cd;padding:8px;border-radius:6px">AIによる返信案です。内容が事実と合っているか確認してから使用してください。</p>`;

  const body = cases.map((c, i) => {
    const side = assignment.get(c.id);
    const col = (label, modelId) => {
      const replies = (repliesByModel[modelId] || {})[c.id] || [];
      return `<div class="col"><h4>${label}</h4>${replies.map((t, k) => `<div class="reply"><b>${label}-${k + 1}.</b> ${esc(t)}
<div class="q">□ そのまま送れる(はい/いいえ)　□ 明確な架空の個人事実(あり/なし)　□ 不自然・ロボット的(あり/なし)　□ 相手の発言との不整合(あり/なし)　会話を続ける価値: 1 2 3 4 5</div></div>`).join('')}</div>`;
    };
    return `<div class="case"><h3>ケース ${i + 1}</h3>
<div class="conv"><b>会話:</b>\n${esc(c.conversation)}</div>
<div class="cols">${col('A', side.A)}${col('B', side.B)}</div>
<div class="verdict">このケースの判定: □ Aが良い　□ Bが良い　□ 引き分け　□ 両方不合格<br>コメント: <textarea></textarea></div></div>`;
  }).join('\n');

  return head + body + `<p style="font-size:12px;color:#666">experiment: ${esc(experimentId)}</p>`;
}

/** モデル対応表(別ファイル。ブラインド評価が終わるまで開かない) */
export function buildMapping({ experimentId, assignment, runIds }) {
  return {
    experimentId,
    note: 'ブラインド評価が終わるまで開かないこと。開いた時点でブラインドではなくなる',
    createdAt: new Date().toISOString(),
    runIds,
    cases: [...assignment.entries()].map(([caseId, v]) => ({ caseId, A: v.A, B: v.B })),
  };
}

if (isCliEntry(import.meta.url)) {
  const args = parseArgs();
  const expId = String(args.experiment || '');
  if (!expId) throw new Error('--experiment=<experimentId> が必要');
  const dir = join('pricing_eval/runs', '_summary');
  const src = join(dir, `compare_${expId}.json`);
  if (!existsSync(src)) throw new Error(`比較結果が無い: ${src}`);
  const data = JSON.parse(readFileSync(src, 'utf8'));
  const modelIds = data.models.map((m) => m.modelId);
  const assignment = sideAssignment(data.cases.map((c) => c.id), data.blindSeed, modelIds);
  const problems = checkAssignment(assignment, modelIds);
  if (problems.length) throw new Error(`ブラインド割り当てが不正: ${problems.join(' / ')}`);
  const html = renderBlindPage({ experimentId: expId, cases: data.cases, repliesByModel: data.repliesByModel, assignment });
  const leaked = containsModelIdentity(html, modelIds);
  if (leaked.length) throw new Error(`ブラインドページにモデル情報が漏れている: ${leaked.join(',')}`);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `blind_compare_${expId}.html`);
  const mapOut = join(dir, `blind_mapping_${expId}.json`);
  writeFileSync(out, html);
  writeFileSync(mapOut, JSON.stringify(buildMapping({ experimentId: expId, assignment, runIds: data.runIds }), null, 2) + '\n');
  console.log(`blind page: ${out}`);
  console.log(`mapping   : ${mapOut}(ブラインド評価が終わるまで開かない)`);
}
