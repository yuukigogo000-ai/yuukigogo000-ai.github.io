// Converse toolConfig(JSON強制)の確認プローブ。
//
// 問い: 本番の tool-use 相当(REPLY_SCHEMA を toolConfig で強制)を Qwen / Kimi が受けるか。
// 受けるなら fidelity テストで出た schema 事故(テキストschema渡しでのJSON崩れ)は本番形式では消える見込み。
//
// 少数呼び出しの診断のみ: モデルごとに数ケース・再試行なし・toolChoice.tool → 不受理なら auto で1回だけ追試。
// AccessDenied / 契約系は即停止。結果は runs/<run-id>/probe_results.jsonl。
//
// 使い方:
//   node pricing_eval/src/toolconfig_probe.mjs --models=<id,id> --cases=<caseId,caseId> \
//     --usd-jpy=160 --max-budget-jpy=10000 --prior-spent-usd=<usd> --run-id=<id>

import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logError } from './lib/log.mjs';
import { createBedrockClient, resolveCredentials, buildConverseBody, sanitizeAwsMessage } from './adapters/bedrock.mjs';
import { costUsdForAttempt, loadPricing, formatUsd } from './calculate_cost.mjs';
import { parseProductionReply, checkStyleRules } from './lib/fidelity_checks.mjs';
import { loadProductionPrompts, buildProductionUserPrompt } from './fidelity_eval.mjs';

const RUNS_DIR = 'pricing_eval/runs';

/** Converse 応答から toolUse 入力を取り出す(無ければ null) */
export function extractToolUse(res, toolName) {
  const blocks = res?.output?.message?.content || [];
  const tu = blocks.find((b) => b.toolUse && (!toolName || b.toolUse.name === toolName));
  return tu ? tu.toolUse.input : null;
}

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args);
  const runId = args['run-id'] || 'toolconfig_probe';
  const wanted = String(args.models || '').split(',').map((s) => s.trim()).filter(Boolean);
  const caseIds = String(args.cases || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!wanted.length || !caseIds.length) throw new Error('--models と --cases を指定してください');
  const priorSpentUsd = Number(args['prior-spent-usd']) || 0;

  const { REPLY_SYSTEM, REPLY_SCHEMA } = await loadProductionPrompts();
  const cases = JSON.parse(readFileSync('pricing_eval/cases.json', 'utf8')).cases;
  const discovery = JSON.parse(readFileSync(join(RUNS_DIR, '_discovery', 'candidate_discovery.json'), 'utf8'));
  const pricing = loadPricing();

  const creds = resolveCredentials()?.credentials ?? null;
  const client = createBedrockClient({ region: cfg.region, credentials: creds });
  const dir = join(RUNS_DIR, runId);
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, 'probe_results.jsonl');

  let spentUsd = priorSpentUsd;
  for (const id of wanted) {
    const cand = (discovery.candidates || []).find((x) => x.modelId === id);
    if (!cand?.evaluable) throw new Error(`${id} が実行不可`);
    const price = pricing.models[id] || pricing.models[cand.invocationTarget] || pricing.models[cand.modelName] || null;
    if (!price) throw new Error(`${id} の official 価格が無い`);

    for (const caseId of caseIds) {
      const c = cases.find((x) => x.id === caseId);
      if (!c) throw new Error(`ケース ${caseId} が無い`);
      const baseBody = buildConverseBody({
        system: REPLY_SYSTEM,
        userText: buildProductionUserPrompt(c, null), // tool-use なので schema テキストは付けない(本番と同じ)
        imagePaths: c.images.map((f) => join('pricing_eval/screenshots', f)),
        maxTokens: cfg.outputMaxTokens,
        temperature: cfg.temperature,
      });
      const toolCfg = (choice) => ({
        tools: [{ toolSpec: { name: 'reply_result', description: '返信案・脈あり度・アドバイスの出力', inputSchema: { json: REPLY_SCHEMA } } }],
        toolChoice: choice,
      });

      for (const [mode, choice] of [['tool_choice_tool', { tool: { name: 'reply_result' } }], ['tool_choice_auto', { auto: {} }]]) {
        // 予算の呼び出し前検査
        const perCallWorst = (16000 / 1e6) * price.inputPerMTokUsd + (cfg.outputMaxTokens / 1e6) * price.outputPerMTokUsd;
        if (cfg.usdJpy && (spentUsd + perCallWorst) * cfg.usdJpy > cfg.maxBudgetJpy) throw new Error('予算上限のため停止');

        const t0 = Date.now();
        let row;
        try {
          const res = await client.converse(cand.invocationTarget || id, { ...baseBody, toolConfig: toolCfg(choice) });
          const input = extractToolUse(res, 'reply_result');
          const usage = res.usage || null;
          const cost = costUsdForAttempt({ inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null }, price);
          if (cost != null) spentUsd += cost;
          const parsed = input ? parseProductionReply(JSON.stringify(input)) : { ok: false, failureKind: 'no_tool_use_block', error: 'toolUse ブロックが無い' };
          row = {
            runId, modelId: id, caseId, mode, accepted: true,
            toolUseReturned: !!input, schemaOk: parsed.ok,
            failureKind: parsed.ok ? null : parsed.failureKind,
            violations: parsed.ok ? checkStyleRules(parsed.data).violations.length : null,
            interestLevel: parsed.ok ? parsed.data.interest_level : null,
            stopReason: res.stopReason ?? null, latencyMs: Date.now() - t0,
            inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null,
            calculatedCostUsd: formatUsd(cost), requestId: res.$requestId ?? null,
            production: parsed.ok ? parsed.data : null,
            at: new Date().toISOString(),
          };
        } catch (e) {
          if (/AccessDenied|NotAuthorized|Subscription|Marketplace/i.test(e.code || '')) {
            throw new Error(`契約/権限系エラーのため停止: ${e.code} [requestId: ${e.requestId ?? '不明'}]`);
          }
          row = {
            runId, modelId: id, caseId, mode, accepted: false,
            errorCode: e.code ?? e.name, httpStatus: e.status ?? null,
            sanitizedErrorMessage: sanitizeAwsMessage(e.message), requestId: e.requestId ?? null,
            latencyMs: Date.now() - t0, at: new Date().toISOString(),
          };
        }
        appendFileSync(outPath, JSON.stringify(row) + '\n');
        logInfo(`probe ${id} ${caseId} ${mode}`, {
          accepted: row.accepted, toolUse: row.toolUseReturned ?? null, schemaOk: row.schemaOk ?? null,
          error: row.errorCode ?? null,
        });
        // toolChoice.tool が受理されたら auto の追試は不要
        if (mode === 'tool_choice_tool' && row.accepted) break;
      }
    }
  }
  logInfo('probe 完了', { spentThisRunUsd: formatUsd(spentUsd - priorSpentUsd), cumulativeUsd: formatUsd(spentUsd) });
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => { logError(e.message); process.exit(1); });
}
