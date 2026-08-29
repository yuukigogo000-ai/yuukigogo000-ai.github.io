// データ保持・AWS環境の Preflight(§5)。
//
// これが PASS しない限り、モデル評価(実呼び出し)を実行してはいけない。
// 設定を勝手に書き換えることはしない。read-only の確認だけを行い、blocker を報告する。
//
// 使い方: node pricing_eval/src/retention_preflight.mjs [--region=ap-northeast-1]

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig, parseArgs } from './lib/config.mjs';
import { logInfo, logWarn, logError, maskAccount } from './lib/log.mjs';
import { createBedrockClient, credentialsFromEnv } from './adapters/bedrock.mjs';
import { signRequest } from './lib/sigv4.mjs';

/** STS GetCallerIdentity(read-only)。アカウントIDはマスクして扱う。 */
export async function getCallerIdentity({ region, credentials, fetchImpl = globalThis.fetch }) {
  const url = `https://sts.${region}.amazonaws.com/`;
  const body = 'Action=GetCallerIdentity&Version=2011-06-15';
  const headers = signRequest({
    method: 'POST', url, body, service: 'sts', region, credentials,
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8', accept: 'application/json' },
  });
  const res = await fetchImpl(url, { method: 'POST', headers, body });
  const text = await res.text();
  if (!res.ok) {
    const code = (text.match(/<Code>([^<]+)<\/Code>/) || [])[1] || `HTTP ${res.status}`;
    const err = new Error(code); err.code = code; err.status = res.status; throw err;
  }
  let json = null; try { json = JSON.parse(text); } catch { /* XML の場合 */ }
  const r = json?.GetCallerIdentityResponse?.GetCallerIdentityResult || {};
  const account = r.Account || (text.match(/<Account>([^<]+)<\/Account>/) || [])[1] || null;
  const arn = r.Arn || (text.match(/<Arn>([^<]+)<\/Arn>/) || [])[1] || null;
  return { account, arn };
}

/** 呼び出しログ設定から実効保持モードを判定 */
export function effectiveRetention(loggingConfig) {
  const lc = loggingConfig?.loggingConfig;
  if (!lc) return { mode: 'none', ok: true, detail: 'モデル呼び出しログ設定なし' };
  const sinks = [];
  if (lc.cloudWatchConfig) sinks.push('cloudwatch');
  if (lc.s3Config) sinks.push('s3');
  if (lc.textDataDeliveryEnabled === false && lc.imageDataDeliveryEnabled === false && !sinks.length) {
    return { mode: 'none', ok: true, detail: '本文・画像の配信が無効' };
  }
  if (!sinks.length) return { mode: 'none', ok: true, detail: '配信先なし' };
  return { mode: 'logging_enabled', ok: false, detail: `呼び出しログが有効 (${sinks.join(',')})` };
}

export async function runPreflight(cfg, { fetchImpl } = {}) {
  const report = {
    at: new Date().toISOString(),
    region: cfg.region,
    identity: { account: null, arnTail: null },
    retention: { mode: 'unknown', ok: false, detail: null },
    environmentSeparation: null,
    blockers: [],
    allowModelEvaluation: false,
  };

  const creds = credentialsFromEnv();
  if (!creds) {
    report.blockers.push('AWS 資格情報が無い(AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY が未設定)');
    return report;
  }

  try {
    const id = await getCallerIdentity({ region: cfg.region, credentials: creds, fetchImpl });
    report.identity.account = maskAccount(id.account);        // 生のアカウントIDは残さない
    report.identity.arnTail = id.arn ? `...${String(id.arn).slice(-28)}` : null;
  } catch (e) {
    report.blockers.push(`STS GetCallerIdentity 失敗: ${e.code || e.name}`);
    return report;
  }

  // 本番と評価の分離。ここは人間が宣言する項目で、推測しない。
  report.environmentSeparation = cfg.evalEnvironmentDeclared === true
    ? 'declared'
    : 'undeclared(評価用アカウント/ロールであることが設定で宣言されていない)';
  if (report.environmentSeparation !== 'declared') {
    report.blockers.push('本番環境と評価環境の分離が宣言されていない(config の evalEnvironmentDeclared)');
  }

  try {
    const client = createBedrockClient({ region: cfg.region, credentials: creds, fetchImpl });
    const lc = await client.getModelInvocationLoggingConfiguration();
    report.retention = effectiveRetention(lc);
  } catch (e) {
    // 設定が無い場合 AWS は ResourceNotFound を返すことがある = ログ無効とみなせる
    if (/ResourceNotFound/i.test(e.code || '')) {
      report.retention = { mode: 'none', ok: true, detail: 'ログ設定が存在しない (ResourceNotFound)' };
    } else {
      report.retention = { mode: 'unknown', ok: false, detail: `取得失敗 (${e.code || e.name})` };
      report.blockers.push(`保持設定を確認できない: ${e.code || e.name}`);
    }
  }

  if (!report.retention.ok) {
    report.blockers.push(`実効データ保持が none でない/不明 (${report.retention.mode})。評価を実行しない。`);
  }

  report.allowModelEvaluation = report.blockers.length === 0;
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  const cfg = loadConfig(args);
  const out = args.out || 'pricing_eval/runs/_discovery/preflight.json';
  runPreflight(cfg).then((r) => {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(r, null, 2));
    logInfo('preflight を書き出しました', { out, allowModelEvaluation: r.allowModelEvaluation, region: r.region });
    for (const b of r.blockers) logWarn(`blocker: ${b}`);
    if (!r.allowModelEvaluation) {
      logError('保持・環境の条件を満たしていないため、モデル評価は実行できません。');
      process.exitCode = 2;
    }
  }).catch((e) => { logError(e.message); process.exit(1); });
}
