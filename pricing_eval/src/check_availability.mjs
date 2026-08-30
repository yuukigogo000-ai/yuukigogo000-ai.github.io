// モデル利用可否の読み取り専用確認。
//
// GetFoundationModelAvailability で agreement / authorization / entitlement / region を見る。
// **状態変更は一切しない**(契約・購読・EULA承諾・Marketplace操作のコードはこのリポジトリに存在しない)。
// 権限が無く読めない場合は exit 3(「不可」とは区別する。人間の別経路確認で代替する)。
//
// 使い方:
//   node pricing_eval/src/check_availability.mjs --models=<modelId,...>

import { loadConfig, parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logError } from './lib/log.mjs';
import { createBedrockClient, resolveCredentials } from './adapters/bedrock.mjs';

export function judgeAvailability(a) {
  const row = {
    agreement: a?.agreementAvailability?.status ?? null,
    authorization: a?.authorizationStatus ?? null,
    entitlement: a?.entitlementAvailability?.status ?? a?.entitlementAvailability ?? null,
    region: a?.regionAvailability ?? null,
  };
  row.ok = row.agreement === 'AVAILABLE' && row.authorization === 'AUTHORIZED'
    && row.entitlement === 'AVAILABLE' && row.region === 'AVAILABLE';
  return row;
}

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args);
  const ids = String(args.models || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) throw new Error('--models=<modelId,...> を指定してください');
  const r = resolveCredentials();
  if (!r) throw new Error('資格情報を解決できません(AWS_PROFILE を指定)');
  const client = createBedrockClient({ region: cfg.region, credentials: r.credentials });
  let bad = 0;
  for (const id of ids) {
    let a;
    try {
      a = await client.getFoundationModelAvailability(id);
    } catch (e) {
      logError(`availability を読めません: ${id}`, { code: e.code ?? e.name, status: e.status ?? null, requestId: e.requestId ?? null });
      process.exit(3); // 読めない ≠ 不可。人間の確認(管理者CloudShell等)で代替する
    }
    const row = judgeAvailability(a);
    if (!row.ok) bad++;
    logInfo(`availability ${id}`, row);
  }
  if (bad) { logError(`${bad} 件が AVAILABLE/AUTHORIZED でありません`); process.exit(2); }
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => { logError(e.message); process.exit(1); });
}
