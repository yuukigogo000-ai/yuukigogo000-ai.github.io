// 内部6候補 → 最終3案の人間確認ページ(2026-09-01 §12)。
//
// 表示: 入力 / 内部6候補 / 各候補の lane / hard reject 理由 / soft risk / 選抜された最終3案 /
//       fallback 使用有無 / 人間が付ける欄(自然さ・事実整合・そのまま送れるか・コメント)
// **自動判定と人間判定を混ぜない**。自動側は「検査器の範囲での判定」であって捏造ゼロの証明ではない。
//
// 使い方(モデル呼び出しなし):
//   node pricing_eval/src/candidate_review_page.mjs --fixture=pricing_eval/fixtures/saved_problem_outputs.json
//   → runs/_summary/candidate_review_<name>.html
//
// 注意: fixture は「保存済みの実出力を候補に見立てた再生」であり、モデルが6候補形式で返したものではない。
// ページ冒頭にもその旨を出す(実測でないものを実測に見せない)。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseArgs, isCliEntry } from './lib/config.mjs';
import { deriveLane, validateCandidate, finalizeReplies, selectionMetrics, LANES } from '../../reply-ai-app/src/lib/candidate_select.mjs';
import { BANNED_RULES } from './validate_output.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** cases.json / cases_fab10.json からケースを引き、検査の文脈を作る */
export function buildContext(caseObj, extra = {}) {
  const conv = (caseObj.conversation || []).map((x) => x.text);
  return {
    conversationText: [caseObj.goal, caseObj.style_sample || '', caseObj.partner_profile ? `${caseObj.partner_profile.nickname} ${caseObj.partner_profile.note}` : '', ...conv].join(' '),
    selfMessages: (caseObj.conversation || []).filter((x) => x.from === 'self').map((x) => x.text),
    bannedRules: BANNED_RULES,
    idempotencyKey: `review-${caseObj.id}`,
    ...extra,
  };
}

/** §5 集計指標。率は分母0のとき null(「—」と出す)。件数と率を混ぜて書かない */
export function renderMetrics(m) {
  const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
  const rows = [
    ['リクエスト数(requestCount)', m.requestCount],
    ['生成された候補(generatedCandidateCount)', m.generatedCandidateCount],
    ['候補 ok(okCandidateCount)', m.okCandidateCount],
    ['候補 soft_risk(softRiskCandidateCount)', m.softRiskCandidateCount],
    ['候補 hard_reject(hardRejectCandidateCount)', m.hardRejectCandidateCount],
    ['採用 ok(selectedOkCount)', m.selectedOkCount],
    ['採用 soft_risk(selectedSoftRiskCount)', m.selectedSoftRiskCount],
    ['採用 fallback(selectedFallbackCount)', m.selectedFallbackCount],
    ['fallback を使ったリクエスト(requestsWithFallback)', m.requestsWithFallback],
    ['soft_risk を含むリクエスト(requestsWithSoftRisk)', m.requestsWithSoftRisk],
    ['再生成の回数(regenerationCount)', m.regenerationCount],
    ['最終返信の総数(finalReplyCount)', m.finalReplyCount],
    ['fallback reply rate(= 採用fallback ÷ 返信総数)', pct(m.fallbackReplyRate)],
    ['fallback request rate(= fallbackを使ったリクエスト ÷ リクエスト数)', pct(m.fallbackRequestRate)],
    ['soft-risk reply rate(= 採用soft_risk ÷ 返信総数)', pct(m.softRiskReplyRate)],
    ['regeneration rate(= 再生成回数 ÷ リクエスト数)', pct(m.regenerationRate)],
  ];
  return `<h2>集計(この再生ぶん)</h2><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(String(v))}</b></td></tr>`).join('')}</table>
<p class="lane">率の分母を取り違えないこと: reply 系は<b>返信総数</b>、request 系は<b>リクエスト数</b>。分母0のときは「—」(0 とは書かない)。</p>`;
}

export function renderCandidateReview({ title, groups, note, metrics = null }) {
  const head = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;color:#222}
.case{border:1px solid #ccc;border-radius:8px;padding:14px;margin:18px 0}
.box{background:#f7f7f7;border-radius:6px;padding:10px;font-size:13px;white-space:pre-wrap}
table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border:1px solid #ccc;padding:5px 8px;font-size:13px;vertical-align:top}
.hard{background:#fde2e2}.soft{background:#fff3cd}.ok{background:#e6f4ea}
.final{background:#eef6ff;border-left:3px solid #4a86c8;padding:8px;margin-top:8px}
.check{border:2px dashed #999;padding:8px;margin-top:8px;font-size:13px}
.lane{font-size:12px;color:#555}</style>`;
  const intro = `<h1>${esc(title)}</h1>
<p><b>これは自動評価の途中経過であって「捏造ゼロ」の証明ではありません。</b>検査器は明示的な言い回ししか見ておらず、
未知の固有名詞・暗黙の個人事実・スクリーンショット内の文字は独立に照合できません。最終判定は人が読んで行ってください。</p>
<p style="background:#fff3cd;padding:8px;border-radius:6px">${esc(note)}</p>${metrics ? renderMetrics(metrics) : ''}`;
  const body = groups.map((g, gi) => {
    const rows = g.candidates.map((c, i) => {
      const v = g.validations[i];
      const cls = v.verdict === 'hard_reject' ? 'hard' : v.verdict === 'soft_risk' ? 'soft' : 'ok';
      const reasons = v.reasons.length ? v.reasons.map((r) => `${r.level === 'hard_reject' ? '⛔' : '⚠'} ${esc(r.detail)}`).join('<br>') : '—';
      return `<tr class="${cls}"><td>${i + 1}</td><td>${esc(c.text)}</td><td class="lane">申告 ${esc(c.lane)}<br>導出 ${esc(v.derivedLane ?? '-')}</td><td>${esc(v.verdict)}</td><td>${reasons}</td></tr>`;
    }).join('');
    const finals = g.final.picked.map((p, i) => `<div>案${i + 1} <span class="lane">[${esc(p.lane)}${p.source === 'fallback' ? ' / テンプレート' : ''}]</span> ${esc(p.text)}</div>`).join('');
    return `<div class="case"><h2>${gi + 1}. ${esc(g.caseId)}</h2>
<div class="box"><b>入力(会話):</b>\n${esc(g.conversation)}</div>
<table><tr><th>#</th><th>内部候補</th><th>lane</th><th>判定</th><th>理由(自動)</th></tr>${rows}</table>
<div class="final"><b>選抜された最終3案</b>${finals}
<div class="lane">fallback: ${g.final.fallbackLanes.length ? esc(g.final.fallbackLanes.join(', ')) : 'なし'} / 再生成: ${g.final.regenerated ? 'あり' : 'なし'} / hard reject ${g.final.rejected.length}件・soft risk ${g.final.softRisks.length}件</div></div>
<div class="check">人間確認: □ 自然さ(本人が打った文に見えるか) □ 事実整合(入力に無い自分の事実が無いか) □ そのまま送れるか □ 相手の発言と噛み合っているか<br>コメント: ______________________________</div></div>`;
  }).join('\n');
  return head + intro + body;
}

if (isCliEntry(import.meta.url)) {
  const args = parseArgs();
  const fixturePath = args.fixture || 'pricing_eval/fixtures/saved_problem_outputs.json';
  const fx = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const cases = [
    ...JSON.parse(readFileSync('pricing_eval/cases.json', 'utf8')).cases,
    ...JSON.parse(readFileSync('pricing_eval/cases_fab10.json', 'utf8')).cases,
  ];
  // 保存済み出力を caseId ごとにまとめ、6件ずつの「候補セット」に見立てる
  const byCase = new Map();
  for (const f of fx.cases) {
    if (!byCase.has(f.caseId)) byCase.set(f.caseId, []);
    byCase.get(f.caseId).push(f);
  }
  const groups = [];
  for (const [caseId, list] of byCase) {
    const c = cases.find((x) => x.id === caseId);
    if (!c) continue;
    const ctx = buildContext(c);
    for (let i = 0; i < list.length; i += 6) {
      const chunk = list.slice(i, i + 6);
      if (chunk.length < 3) continue;
      const candidates = chunk.map((f) => ({ text: f.text, lane: deriveLane(f.text), usedFactIds: [] }));
      const validations = candidates.map((cd) => validateCandidate(cd, ctx));
      const final = finalizeReplies({ firstPass: candidates, ctx });
      groups.push({
        caseId: `${caseId}(${chunk[0].src})`,
        conversation: (c.conversation || []).map((x) => `${x.from === 'self' ? '自分' : '相手'}: ${x.text}`).join('\n'),
        candidates, validations, final,
      });
    }
  }
  const out = args.out || join('pricing_eval/runs/_summary', `candidate_review_${basename(fixturePath).replace(/\.json$/, '')}.html`);
  mkdirSync('pricing_eval/runs/_summary', { recursive: true });
  const metrics = selectionMetrics(groups.map((g) => g.final));
  writeFileSync(join('pricing_eval/runs/_summary', 'candidate_selection_metrics.json'), JSON.stringify({
    at: new Date().toISOString(), source: fixturePath,
    note: 'これは保存済み出力を候補に見立てた再生の集計。新方式でのモデル実測ではない',
    metrics,
  }, null, 2) + '\n');
  writeFileSync(out, renderCandidateReview({
    title: '内部6候補 → 最終3案(事実ファイアウォール)人間確認',
    groups, metrics,
    note: 'この候補は「保存済みの実出力(Kimi / Qwen3 VL / Opus 5)を候補に見立てた再生」です。モデルが6候補形式で返したものではありません。新方式でのモデル実測は未実施(発注者の GO 待ち)。',
  }));
  console.log(`candidate review page: ${out} (${groups.length} セット)`);
  console.log(`集計: リクエスト ${metrics.requestCount} / 候補 ${metrics.generatedCandidateCount}(ok ${metrics.okCandidateCount} / soft ${metrics.softRiskCandidateCount} / hard ${metrics.hardRejectCandidateCount})`);
  console.log(`      採用 ok ${metrics.selectedOkCount} / soft ${metrics.selectedSoftRiskCount} / fallback ${metrics.selectedFallbackCount}`
    + ` / fallback reply rate ${metrics.fallbackReplyRate == null ? '—' : (metrics.fallbackReplyRate * 100).toFixed(1) + '%'}`
    + ` / soft-risk reply rate ${metrics.softRiskReplyRate == null ? '—' : (metrics.softRiskReplyRate * 100).toFixed(1) + '%'}`);
}
