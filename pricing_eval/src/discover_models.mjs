// 候補モデルの動的探索(§3・§4)。
//
// 重要: モデル名をコードに埋め込まない。実行時の AWS API から列挙し、Hard Gate で絞る。
// 事前調査で名前が挙がったモデルを allowlist にしない。実行時に条件を満たさなくなったものは落とす。
//
// 使い方: node pricing_eval/src/discover_models.mjs [--out=...] [--region=ap-northeast-1]

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig, parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logWarn, maskAccount } from './lib/log.mjs';
import { createBedrockClient, resolveCredentials, AwsError } from './adapters/bedrock.mjs';
import {
  PASS, FAIL, UNKNOWN, gate, evaluateGates, judgeDestinations, judgeEol,
} from './lib/hardgate.mjs';

/** モダリティから 6・7 番(テキスト+画像 / 6枚)を判定 */
function judgeModalities(m) {
  const inputs = (m.inputModalities || []).map((s) => String(s).toUpperCase());
  const outputs = (m.outputModalities || []).map((s) => String(s).toUpperCase());
  const hasText = inputs.includes('TEXT') && outputs.includes('TEXT');
  const hasImage = inputs.includes('IMAGE');
  const multimodal = hasText && hasImage
    ? gate(PASS, { inputModalities: inputs, outputModalities: outputs })
    : gate(FAIL, { inputModalities: inputs, outputModalities: outputs }, 'テキスト+画像入力に対応していない');
  // 「1リクエストで6枚」は API 仕様書に載らないことが多い。実際に投げるまで UNKNOWN。
  const sixImages = hasImage
    ? gate(UNKNOWN, null, '6枚同時投入は smoke の実呼び出しで確認する(仕様書からは断定しない)')
    : gate(FAIL, null, '画像入力に非対応');
  return { multimodal, six_images: sixImages };
}

function judgeLifecycle(m) {
  const status = m.modelLifecycle?.status || m.lifecycle?.status || null;
  if (!status) return { lifecycle: gate(UNKNOWN, null, 'lifecycle を取得できない'), eol: gate(UNKNOWN, null, 'EOL 不明') };
  const s = String(status).toUpperCase();
  if (s === 'ACTIVE') return { lifecycle: gate(PASS, { status: s }), eol: judgeEol(m.modelLifecycle?.eolDate ?? null) };
  return {
    lifecycle: gate(FAIL, { status: s }, `lifecycle が ACTIVE でない (${s})`),
    eol: judgeEol(m.modelLifecycle?.eolDate ?? null),
  };
}

/** 1モデルぶんの Hard Gate を組む */
export function assessModel({ model, profile, profileDetail, retention, pricingKnown, allowedDestinations }) {
  const life = judgeLifecycle(model);
  const modal = judgeModalities(model);

  // destination は GetInferenceProfile の実データからのみ判定する(jp. の名前で決めない)
  const dest = profileDetail
    ? judgeDestinations(profileDetail.models?.map((x) => regionOfArn(x.modelArn)) ?? profileDetail.destinations ?? [], allowedDestinations)
    : judgeDestinations(null, allowedDestinations);

  const gates = {
    bedrock_available: gate(PASS, { modelId: model.modelId }),
    lifecycle_active: life.lifecycle,
    // 東京から呼べるかは実呼び出しで確認する。列挙できた=呼べる、とは限らない。
    callable_from_tokyo: gate(UNKNOWN, null, 'smoke の実呼び出しで確認する'),
    destinations_japan: dest.destinations_japan,
    destinations_allowed: dest.destinations_allowed,
    multimodal: modal.multimodal,
    six_images: modal.six_images,
    retention_none: retention?.gate ?? gate(UNKNOWN, null, '保持設定を確認できていない'),
    // 以下2つは AWS API では判定できない。規約の読解は人間の仕事(§15)。
    no_provider_sharing: gate(UNKNOWN, null, 'Provider への共有有無は API で判定できない。規約確認(人間)が必要'),
    terms_allow_usecase: gate(UNKNOWN, null, 'Provider 規約上の可否は法務判断(人間)が必要'),
    pricing_obtainable: pricingKnown
      ? gate(PASS, { source: pricingKnown.source })
      : gate(UNKNOWN, null, '価格を機械取得できていない。pricing_override.json への転記が必要'),
    eol_not_near: life.eol,
  };

  const result = evaluateGates(gates);
  return {
    modelId: model.modelId,
    modelName: model.modelName ?? null,
    providerName: model.providerName ?? null,
    inferenceProfileId: profile?.inferenceProfileId ?? null,
    inferenceProfileArn: profile?.inferenceProfileArn ?? null,
    destinations: profileDetail ? (profileDetail.models?.map((x) => regionOfArn(x.modelArn)) ?? null) : null,
    ...result,
  };
}

function regionOfArn(arn) {
  // arn:aws:bedrock:<region>:...
  const parts = String(arn || '').split(':');
  return parts.length > 3 ? parts[3] : null;
}

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args);
  const out = args.out || 'pricing_eval/runs/_discovery/candidate_discovery.json';

  const resolved = resolveCredentials();
  const creds = resolved?.credentials ?? null;
  const evidence = {
    generatedAt: new Date().toISOString(),
    region: cfg.region,
    allowedDestinations: cfg.allowedDestinations,
    aws: { reachable: false, blocker: null, account: null },
    sources: [],
  };

  if (!creds) {
    evidence.aws.blocker = 'AWS 資格情報が無い(環境変数キーも AWS_PROFILE も解決できない)';
    return finish([], evidence, out, cfg);
  }
  evidence.aws.credentialSource = resolved.source;

  const client = createBedrockClient({ region: cfg.region, credentials: creds });

  let models = [];
  try {
    const res = await client.listFoundationModels();
    models = res?.modelSummaries || [];
    evidence.aws.reachable = true;
    evidence.sources.push({ api: 'ListFoundationModels', region: cfg.region, at: new Date().toISOString(), count: models.length });
  } catch (e) {
    evidence.aws.blocker = `ListFoundationModels 失敗: ${e.code || e.name} ${e.status ?? ''}`.trim();
    logWarn('モデル一覧を取得できませんでした', { code: e.code, status: e.status });
    return finish([], evidence, out, cfg);
  }

  // 推論プロファイル(Geo/In-Region)。destination は個別取得で確認する。
  let profiles = [];
  try {
    const res = await client.listInferenceProfiles();
    profiles = res?.inferenceProfileSummaries || [];
    evidence.sources.push({ api: 'ListInferenceProfiles', at: new Date().toISOString(), count: profiles.length });
  } catch (e) {
    logWarn('推論プロファイル一覧を取得できませんでした', { code: e.code });
    evidence.sources.push({ api: 'ListInferenceProfiles', error: e.code || e.name });
  }

  // 保持設定
  let retention = null;
  try {
    const cfgRes = await client.getModelInvocationLoggingConfiguration();
    retention = judgeRetention(cfgRes);
    evidence.sources.push({ api: 'GetModelInvocationLoggingConfiguration', at: new Date().toISOString(), mode: retention.mode });
  } catch (e) {
    retention = { mode: 'unknown', gate: gate(UNKNOWN, null, `保持設定を取得できない (${e.code || e.name})`) };
    evidence.sources.push({ api: 'GetModelInvocationLoggingConfiguration', error: e.code || e.name });
  }

  // モデルごとにプロファイル詳細を引く
  const assessed = [];
  for (const m of models) {
    const prof = profiles.find((p) => (p.models || []).some((x) => String(x.modelArn || '').includes(m.modelId)))
      || profiles.find((p) => String(p.inferenceProfileId || '').includes(m.modelId));
    let detail = null;
    if (prof?.inferenceProfileId) {
      try {
        detail = await client.getInferenceProfile(prof.inferenceProfileId);
      } catch (e) {
        logWarn('推論プロファイル詳細を取得できません', { profile: prof.inferenceProfileId, code: e.code });
      }
    }
    assessed.push(assessModel({
      model: m, profile: prof, profileDetail: detail, retention,
      pricingKnown: null, allowedDestinations: cfg.allowedDestinations,
    }));
  }

  return finish(assessed, evidence, out, cfg);
}

function judgeRetention(loggingConfig) {
  const lc = loggingConfig?.loggingConfig;
  // ログ設定そのものが無い = 呼び出し内容をこちらのアカウントへ保存していない
  if (!lc) return { mode: 'none', gate: gate(PASS, { loggingConfig: null }, 'モデル呼び出しログ設定なし') };
  const sinks = [];
  if (lc.cloudWatchConfig) sinks.push('cloudwatch');
  if (lc.s3Config) sinks.push('s3');
  if (!sinks.length) return { mode: 'none', gate: gate(PASS, { sinks: [] }) };
  return {
    mode: 'logging_enabled',
    gate: gate(FAIL, { sinks }, `呼び出しログが有効 (${sinks.join(',')})。実効保持が none でない`),
  };
}

function finish(assessed, evidence, out, cfg) {
  const evaluable = assessed.filter((a) => a.evaluable);
  const excluded = assessed.filter((a) => !a.evaluable);
  const payload = {
    ...evidence,
    summary: {
      discovered: assessed.length,
      evaluable: evaluable.length,
      excluded: excluded.length,
      adoptionBlocked: assessed.filter((a) => a.adoptionBlocked).length,
    },
    candidates: assessed,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2));

  logInfo('候補探索を書き出しました', { out, ...payload.summary });
  if (evidence.aws.blocker) logWarn(`AWS blocker: ${evidence.aws.blocker}`);
  for (const a of excluded) logInfo(`除外 ${a.modelId}: ${a.fails.join(', ')}`);
  return payload;
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => { console.error('[error]', e.message); process.exit(1); });
}
