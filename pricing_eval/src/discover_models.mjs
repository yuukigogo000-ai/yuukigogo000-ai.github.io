// 候補モデルの動的探索(§3・§4)。
//
// 重要: モデル名をコードに埋め込まない。実行時の AWS API から列挙し、Hard Gate で絞る。
// 事前調査で名前が挙がったモデルを allowlist にしない。実行時に条件を満たさなくなったものは落とす。
//
// 使い方: node pricing_eval/src/discover_models.mjs [--out=...] [--region=ap-northeast-1]

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig, parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logWarn, maskAccount } from './lib/log.mjs';
import { createBedrockClient, resolveCredentials, AwsError } from './adapters/bedrock.mjs';
import {
  PASS, FAIL, UNKNOWN, gate, evaluateGates, judgeDestinations, judgeDirectTokyo, judgeEol,
} from './lib/hardgate.mjs';

// Converse Message API の公式上限(1メッセージ最大20画像)。6枚の構造的対応の根拠。
const CONVERSE_IMAGE_LIMIT = 20;
const CONVERSE_API_REF = 'https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Message.html';

const MODEL_CARDS_PATH = 'pricing_eval/evidence/model_cards.json';
const DATA_POLICY_PATH = 'pricing_eval/evidence/data_sharing_policy.json';
const PROVIDER_TERMS_PATH = 'pricing_eval/evidence/provider_terms.json';

export function loadEvidenceFiles({ cardsPath = MODEL_CARDS_PATH, policyPath = DATA_POLICY_PATH, termsPath = PROVIDER_TERMS_PATH } = {}) {
  const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
  return { cards: read(cardsPath)?.models ?? {}, policy: read(policyPath), terms: read(termsPath) };
}

/** モダリティから 6 番(テキスト+画像)と 7a/7b(6枚: 構造/実測)を判定 */
function judgeModalities(m, card) {
  const inputs = (m.inputModalities || []).map((s) => String(s).toUpperCase());
  const outputs = (m.outputModalities || []).map((s) => String(s).toUpperCase());
  const hasText = inputs.includes('TEXT') && outputs.includes('TEXT');
  const hasImage = inputs.includes('IMAGE');
  const multimodal = hasText && hasImage
    ? gate(PASS, { inputModalities: inputs, outputModalities: outputs })
    : gate(FAIL, { inputModalities: inputs, outputModalities: outputs }, 'テキスト+画像入力に対応していない');

  // 7a: 構造的対応 = Image入力(API証拠) + Converse対応(モデルカード証拠) + Converseの既定上限(20枚)≥6
  let structural;
  if (!hasImage) {
    structural = gate(FAIL, null, '画像入力に非対応');
  } else if (card?.converse === true) {
    structural = gate(PASS, {
      converseImageLimit: CONVERSE_IMAGE_LIMIT,
      limitSource: CONVERSE_API_REF,
      converseCard: { url: card.url, fetchedAt: card.fetchedAt },
      maxImagePayloadMB: card.maxImagePayloadMB ?? null,
    }, 'Converse Message API は最大20画像を許容(公式仕様)。6枚は既定上限内');
  } else {
    structural = gate(UNKNOWN, null, 'Converse 対応のモデルカード証拠が未転記(evidence/model_cards.json)');
  }
  // 7b: 実呼び出しでの6枚成功は smoke まで UNKNOWN。構造的対応と混同しない。
  const runtime = hasImage
    ? gate(UNKNOWN, null, '6枚同時の実呼び出し成功は smoke で確認する(構造的対応 7a とは別項目)')
    : gate(FAIL, null, '画像入力に非対応');
  return { multimodal, six_image_structural: structural, six_image_runtime_verified: runtime };
}

function judgeLifecycle(m, card) {
  const status = m.modelLifecycle?.status || m.lifecycle?.status || null;
  if (!status) return gate(UNKNOWN, null, 'lifecycle を取得できない');
  const s = String(status).toUpperCase();
  const evidence = { status: s, modelCard: card ? { lifecycle: card.lifecycle, url: card.url, fetchedAt: card.fetchedAt } : null };
  if (s === 'ACTIVE') return gate(PASS, evidence);
  return gate(FAIL, evidence, `lifecycle が ACTIVE でない (${s})`);
}

/** 1モデルぶんの Hard Gate を組む */
export function assessModel({
  model, profile, profileDetail, retention, pricingKnown, allowedDestinations,
  card = null, policy = null, terms = null, region = 'ap-northeast-1',
  now = new Date(), minEolHeadroomDays = 90,
}) {
  const lifecycle = judgeLifecycle(model, card);
  const modal = judgeModalities(model, card);

  // 国内処理は2経路。A: direct In-Region Tokyo(ON_DEMAND を東京の API が返した実データ)
  //               B: jp geo profile(GetInferenceProfile の destination 実データが東京/大阪の部分集合)
  // global. / apac. / 国外destination / destination不明 はどちらの経路でも PASS しない。
  const profileDestinations = profileDetail
    ? (profileDetail.models?.map((x) => regionOfArn(x.modelArn)) ?? profileDetail.destinations ?? [])
    : null;
  const direct = judgeDirectTokyo({ inferenceTypes: model.inferenceTypesSupported, region, cardEvidence: card });
  const viaProfile = judgeDestinations(profileDestinations, allowedDestinations);
  const profileDomestic = viaProfile.destinations_japan.status === PASS && viaProfile.destinations_allowed.status === PASS;
  const dest = direct ?? viaProfile;
  const domesticPath = direct ? 'direct_in_region_tokyo' : (profileDomestic ? 'jp_geo_profile' : null);
  // 呼び出し先: direct 経路は base model ID(profile を使わない)。jp geo 経路は当該 profile ID。
  const invocationTarget = direct
    ? model.modelId
    : (profileDomestic ? profile?.inferenceProfileId : (profile?.inferenceProfileId ?? model.modelId));

  // EOL: 公式モデルカードの転記(evidence/model_cards.json)を優先し、無ければ API の eolDate。
  const eolSource = card?.eolFloor ?? m2(model);
  const eol = judgeEol(eolSource, now, minEolHeadroomDays);
  if (card?.eolFloor && card.eolFloor !== 'none_announced') {
    eol.evidence = { ...(eol.evidence || {}), modelCard: { url: card.url, fetchedAt: card.fetchedAt, eolFloorText: card.eolFloorText ?? null } };
  }

  // 保持: モデルカードが opt-in 保持(provider_data_share 等)を要求するモデルは、
  // アカウントの retention none では利用できない = FAIL。none を別モードへ変更する選択肢は無い。
  let retentionGate = retention?.gate ?? gate(UNKNOWN, null, '保持設定を確認できていない');
  let promptSharing;
  if (card?.retentionRequirement === 'provider_data_share') {
    const ev = { modelCard: { url: card.url, fetchedAt: card.fetchedAt }, quote: card.retentionRequirementQuote ?? null };
    retentionGate = gate(FAIL, ev, '公式カードが provider data sharing への opt-in(retention mode 変更)を要求。retention none では利用不可');
    promptSharing = gate(FAIL, ev, 'Provider へのデータ共有 opt-in がモデルの利用条件');
  } else if (retentionGate.status === PASS && policy?.promptOutputSharing) {
    promptSharing = gate(PASS, {
      basis: policy.promptOutputSharing.basis,
      sources: policy.promptOutputSharing.sources,
      fetchedAt: policy.fetchedAt,
      accountRetention: 'none',
    }, 'retention none ではプロンプト・出力は永続保存されず Provider にも共有されない(AWS公式仕様)');
  } else {
    promptSharing = gate(UNKNOWN, null, 'retention none の確認か公式仕様の証拠が不足');
  }
  // 非コンテンツ利用情報の共有は AWS Service Terms 50.12.5 により起こり得る。自動 PASS 禁止。
  const nonContent = gate(UNKNOWN, {
    basis: policy?.nonContentUsageMetadataSharing?.basis ?? null,
    sources: policy?.nonContentUsageMetadataSharing?.sources ?? ['https://aws.amazon.com/service-terms/'],
    resolution: 'HUMAN_REQUIRED',
  }, 'Replier の要件が「非コンテンツ利用情報を含む一切の非共有」を意味するかは人間が決める');

  // 規約: 自動 PASS しない。公式規約 URL と Replier 固有チェックリストを添えて人間へ渡す。
  const providerTerm = terms?.providers?.[model.providerName] ?? null;
  const termsGate = gate(UNKNOWN, {
    resolution: providerTerm?.resolution ?? 'HUMAN_REQUIRED',
    termsUrl: providerTerm?.termsUrl ?? card?.eulaUrl ?? null,
    fetchedAt: providerTerm?.fetchedAt ?? null,
    notes: providerTerm?.notes ?? null,
    checklist: terms?.replierChecklist ?? null,
  }, 'Provider 規約上の可否は法務判断(人間)。証拠なしで PASS にしない');

  const gates = {
    bedrock_available: gate(PASS, { modelId: model.modelId }),
    lifecycle_active: lifecycle,
    // 東京から呼べるかは実呼び出しで確認する。列挙できた=呼べる、とは限らない。
    callable_from_tokyo: gate(UNKNOWN, null, 'smoke の実呼び出しで確認する'),
    destinations_japan: dest.destinations_japan,
    destinations_allowed: dest.destinations_allowed,
    multimodal: modal.multimodal,
    six_image_structural: modal.six_image_structural,
    six_image_runtime_verified: modal.six_image_runtime_verified,
    retention_none: retentionGate,
    no_prompt_output_sharing_with_model_provider: promptSharing,
    no_noncontent_usage_metadata_sharing: nonContent,
    terms_allow_usecase: termsGate,
    pricing_obtainable: pricingKnown
      ? gate(PASS, { source: pricingKnown.source })
      : gate(UNKNOWN, null, '価格を機械取得できていない。pricing_override.json への転記が必要'),
    eol_not_near: eol,
  };

  const result = evaluateGates(gates);
  // EOL 猶予不足「だけ」で落ちたモデルは benchmark-only として別表示できる(採用も Full Run もしない)
  const benchmarkOnly = result.fails.length > 0 && result.fails.every((f) => f === 'eol_not_near');
  return {
    modelId: model.modelId,
    modelName: model.modelName ?? null,
    providerName: model.providerName ?? null,
    inferenceProfileId: profile?.inferenceProfileId ?? null,
    inferenceProfileArn: profile?.inferenceProfileArn ?? null,
    destinations: profileDestinations,
    domesticPath,
    invocationTarget,
    productionCandidate: result.fails.length === 0,
    benchmarkOnly,
    // EOL 意味論(2026-08-31): verified=PASS のみ「90日以上の公表EOL」。UNKNOWN(未公表)は
    // smoke 可・production は CONDITIONAL(人間のリスク受容必要)。FAIL は production 不可。
    eolAssessment: {
      eol_headroom_verified: eol.status,
      headroomDays: eol.evidence?.headroomDays ?? null,
      eligible_for_smoke: eol.status !== FAIL,
      eligible_for_production: eol.status === PASS ? 'YES' : (eol.status === UNKNOWN ? 'CONDITIONAL' : 'NO'),
    },
    modelCardEvidence: card ? { url: card.url, fetchedAt: card.fetchedAt, eolFloor: card.eolFloor ?? null, lifecycle: card.lifecycle ?? null } : null,
    ...result,
  };
}

function m2(model) {
  // 実APIのフィールド名は endOfLifeTime(2026-08-30 実測)。旧想定の eolDate も後方互換で見る。
  return model.modelLifecycle?.endOfLifeTime ?? model.modelLifecycle?.eolDate ?? null;
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

  // 推論プロファイル(Geo/In-Region)。destination は個別取得で確認する。nextToken を辿り取り漏らさない。
  let profiles = [];
  try {
    let token = null;
    do {
      const res = await client.listInferenceProfiles(undefined, token);
      profiles.push(...(res?.inferenceProfileSummaries || []));
      token = res?.nextToken ?? null;
    } while (token);
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

  // 証拠ファイル(公式モデルカード転記・データ共有ポリシー・規約レジストリ)
  const ev = loadEvidenceFiles();
  evidence.evidenceFiles = {
    modelCards: Object.keys(ev.cards).length,
    dataSharingPolicy: !!ev.policy,
    providerTerms: !!ev.terms,
  };

  // モデルごとにプロファイル詳細を引く。複数プロファイルが該当する場合は
  // 「destination が国内(許可リストの部分集合)と実証できたもの」を優先して選ぶ
  // (global. を先に拾って jp. を捨てる、という取り違えを防ぐ)。
  const detailCache = new Map();
  const getDetail = async (id) => {
    if (detailCache.has(id)) return detailCache.get(id);
    let d = null;
    try { d = await client.getInferenceProfile(id); } catch (e) {
      logWarn('推論プロファイル詳細を取得できません', { profile: id, code: e.code });
    }
    detailCache.set(id, d);
    return d;
  };
  const destsOf = (detail) => detail ? (detail.models?.map((x) => regionOfArn(x.modelArn)) ?? detail.destinations ?? []) : null;
  const isDomestic = (detail) => {
    const ds = destsOf(detail);
    return Array.isArray(ds) && ds.length > 0 && ds.every((r) => r && cfg.allowedDestinations.includes(r));
  };

  const assessed = [];
  for (const m of models) {
    const matches = profiles.filter((p) =>
      (p.models || []).some((x) => String(x.modelArn || '').includes(m.modelId))
      || String(p.inferenceProfileId || '').includes(m.modelId));
    let prof = null, detail = null;
    for (const p of matches) {
      if (!p.inferenceProfileId) continue;
      const d = await getDetail(p.inferenceProfileId);
      if (isDomestic(d)) { prof = p; detail = d; break; } // 国内実証プロファイルを最優先
      if (!prof) { prof = p; detail = d; }
    }
    assessed.push(assessModel({
      model: m, profile: prof, profileDetail: detail, retention,
      pricingKnown: null, allowedDestinations: cfg.allowedDestinations,
      card: ev.cards[m.modelId] ?? null, policy: ev.policy, terms: ev.terms,
      region: cfg.region, minEolHeadroomDays: cfg.minimumEolHeadroomDays,
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
  const domestic = assessed.filter((a) => a.domesticPath);
  const payload = {
    ...evidence,
    summary: {
      discovered: assessed.length,
      evaluable: evaluable.length,
      excluded: excluded.length,
      adoptionBlocked: assessed.filter((a) => a.adoptionBlocked).length,
      domesticTechnicalCandidates: domestic.length,
      domesticByPath: {
        direct_in_region_tokyo: domestic.filter((a) => a.domesticPath === 'direct_in_region_tokyo').length,
        jp_geo_profile: domestic.filter((a) => a.domesticPath === 'jp_geo_profile').length,
      },
      benchmarkOnly: assessed.filter((a) => a.benchmarkOnly).length,
      minimumEolHeadroomDays: cfg.minimumEolHeadroomDays,
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
