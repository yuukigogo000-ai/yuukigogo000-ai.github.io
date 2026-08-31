// 確証run の全件を「人間確認用」に1ページへ並べる(自動評価だけで捏造ゼロと断定しないための工程)。
//
// 使い方: node pricing_eval/src/human_review_page.mjs --run-id=<runId> [--out=<path>]
// 出力: pricing_eval/runs/_summary/human_review_<runId>.html(既定)
//  - 入力(ゴール・相手プロフィール・文体サンプル・会話テキスト・スクショは ../../screenshots/ への相対リンク)
//  - 出力(いまの状況・3案の吹き出しと理由・次の一手)
//  - 自動評価(初回違反→再生成の有無・最終違反・構造/文体フラグ・遅延・requestId)
//  - 確認欄: 「入力に無い固有名詞・体験談・プレースホルダが無いか」を人が見てチェックする(結果はこのページに保存しない。紙/別ファイルで)
// モデル名は単一候補なので伏せない。会話本文は合成データ(cases.json)なので掲載してよい。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, isCliEntry } from './lib/config.mjs';
import { readResults } from './run_eval.mjs';
import { evaluateConfirmCriteria } from './fidelity_eval.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function renderHumanReview({ runId, rows, cases, screenshotsRel = '../../screenshots' }) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const criteria = evaluateConfirmCriteria(rows, { expectedCases: rows.length });
  const head = `<!doctype html><meta charset="utf-8"><title>人間確認 ${esc(runId)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;color:#222}
.case{border:1px solid #ccc;border-radius:8px;padding:14px;margin:18px 0}.case h2{margin:0 0 8px;font-size:16px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.box{background:#f7f7f7;border-radius:6px;padding:10px;font-size:13px;white-space:pre-wrap}
.bub{display:inline-block;background:#dff2e1;border-radius:14px;padding:6px 10px;margin:3px 0;max-width:90%}.why{color:#555;font-size:12px;margin:2px 0 8px}
.flag{display:inline-block;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:4px}.bad{background:#fde2e2}.warn{background:#fff3cd}.ok{background:#e6f4ea}
img{max-height:260px;margin:4px;border:1px solid #ddd}.check{border:2px dashed #999;padding:8px;margin-top:8px;font-size:13px}
table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px;font-size:13px}</style>`;
  const summary = `<h1>人間確認: ${esc(runId)}(${rows.length}件)</h1>
<p>自動評価の要約(<b>捏造ゼロの断定ではない</b>。検出器はカタカナ語・施設接尾辞・例文名・プレースホルダしか見ていない。漢字の地名・人名・作品名・体験談は人が確認する):</p>
<table><tr><th>最終成功</th><th>最終schema違反</th><th>placeholder</th><th>捏造候補(検出器)</th><th>初回違反→再生成</th><th>120秒timeout</th><th>latency p50/p90/p95/max(ms)</th></tr>
<tr><td>${criteria.finalSuccess}/${criteria.cases}</td><td>${criteria.finalSchemaViolations}</td><td>${criteria.placeholder}</td><td>${criteria.fabrication}</td><td>${criteria.regenerated}</td><td>${criteria.timeouts}</td><td>${criteria.latency.p50}/${criteria.latency.p90}/${criteria.latency.p95}/${criteria.latency.max}</td></tr></table>
<p>確認の観点(各ケースの下のチェック欄): ①入力に無い固有名詞(地名・店名・人物・作品)が無いか ②「行った/食べた/読んだ」等の自分の体験談を作っていないか ③○○などの穴埋めが無いか ④そのまま送れる文か ⑤相手の発言と噛み合っているか</p>`;
  const body = rows.map((r, idx) => {
    const c = byId.get(r.caseId) || {};
    const prod = r.production || r.invalidOutput || {};
    const conv = (c.conversation || []).map((t) => `${t.speaker === 'self' || t.role === 'self' ? '自分' : '相手'}: ${t.text}`).join('\n');
    const imgs = (c.images || []).map((f) => `<img src="${esc(screenshotsRel)}/${esc(f)}" alt="${esc(f)}">`).join('');
    const flags = [];
    if (r.firstAttemptViolation) flags.push(`<span class="flag warn">初回違反→再生成: ${esc(r.firstAttemptViolation.kind)} ${esc(String(r.firstAttemptViolation.detail).slice(0, 80))}</span>`);
    if (r.finalViolation) flags.push(`<span class="flag bad">最終違反: ${esc(r.finalViolation.kind)} ${esc(String(r.finalViolation.detail).slice(0, 80))}</span>`);
    if (!r.success) flags.push(`<span class="flag bad">最終失敗: ${esc(r.failureKind)}</span>`);
    if (r.timeoutCount) flags.push(`<span class="flag bad">timeout ${r.timeoutCount}</span>`);
    for (const v of (r.fidelity?.violations || [])) flags.push(`<span class="flag ${['placeholder', 'ungrounded_name'].includes(v.rule) ? 'bad' : 'warn'}">${esc(v.rule)}: ${esc(v.detail)}</span>`);
    if (!flags.length) flags.push('<span class="flag ok">自動評価: フラグなし</span>');
    const replies = (prod.replies || []).map((p, i) => `<div><b>案${i + 1}</b><br>${(p.bubbles || []).map((b) => `<div class="bub">${esc(b)}</div>`).join('<br>')}<div class="why">理由: ${esc(p.why)}</div></div>`).join('');
    const lat = (r.attempts || []).map((a) => `g${a.generation ?? 1}#${a.attemptNo}:${a.latencyMs}ms${a.failureKind ? `(${a.failureKind})` : ''}`).join(' / ');
    const reqs = (r.attempts || []).map((a) => a.requestId).filter(Boolean).join(', ');
    return `<div class="case"><h2>${idx + 1}. ${esc(r.caseId)}${r.repeatNo && r.repeatNo > 1 ? ` (repeat ${r.repeatNo})` : ''} — ${esc(r.category)} — 画像${r.imageCount}枚</h2>
<div>${flags.join(' ')}</div>
<div class="grid"><div><h3>入力</h3><div class="box"><b>ゴール:</b> ${esc(c.goal)}
<b>相手プロフィール:</b> ${esc(c.partner_profile ? `${c.partner_profile.nickname || ''} ${c.partner_profile.note || ''}` : '(なし)')}
<b>文体サンプル:</b> ${esc(c.style_sample || '(なし)')}
<b>会話:</b>
${esc(conv || '(スクショのみ)')}</div>${imgs}</div>
<div><h3>出力</h3><div class="box"><b>いまの状況:</b> ${esc(prod.situation)}</div>${replies}<div class="box"><b>次の一手:</b> ${esc(prod.advice)}</div></div></div>
<div style="font-size:12px;color:#666">latency: ${esc(lat)} | requestId: ${esc(reqs)}</div>
<div class="check">人間確認: □ 固有名詞OK □ 体験談OK □ 穴埋めなし □ そのまま送れる □ 噛み合っている　メモ: ______________________</div></div>`;
  }).join('\n');
  return head + summary + body;
}

if (isCliEntry(import.meta.url)) {
  const args = parseArgs();
  const runId = args['run-id'];
  if (!runId) { console.error('--run-id が必要'); process.exit(1); }
  const { rows } = readResults(join('pricing_eval/runs', runId, 'results.jsonl'));
  const cases = JSON.parse(readFileSync('pricing_eval/cases.json', 'utf8')).cases;
  const out = args.out || join('pricing_eval/runs/_summary', `human_review_${runId}.html`);
  mkdirSync(join('pricing_eval/runs/_summary'), { recursive: true });
  writeFileSync(out, renderHumanReview({ runId, rows, cases }));
  console.log(`human review page: ${out} (${rows.length} cases)`);
}
