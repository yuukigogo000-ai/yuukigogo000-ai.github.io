// Amazon Bedrock アダプタ。
//
// - 制御プレーン(bedrock.{region}.amazonaws.com): モデル一覧・推論プロファイル・保持設定
// - 実行プレーン(bedrock-runtime.{region}.amazonaws.com): Converse API
//
// Converse を使う理由: モデル非依存の共通形式でテキストと画像を渡せるため、
// 「全候補へ同一入力」(§7)を Provider 差分なしに満たせる。
//
// HTTP 層は injectable(fetchImpl)。AWS が無い環境でも contract をテストできる。

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { signRequest } from '../lib/sigv4.mjs';

export class AwsError extends Error {
  constructor(message, { status, code, operation } = {}) {
    super(message);
    this.name = 'AwsError';
    this.status = status; this.code = code; this.operation = operation;
  }
}

/** 環境から資格情報を読む。値はログへ出さない(呼び出し側も出さないこと) */
export function credentialsFromEnv(env = process.env) {
  const accessKeyId = env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey, sessionToken: env.AWS_SESSION_TOKEN || null };
}

/**
 * 資格情報の解決。優先順: 環境変数 → AWS_PROFILE(aws CLI の export-credentials)。
 *
 * - 値は戻り値(メモリ内)にのみ入れる。呼び出し側もログ・成果物へ出さないこと。
 * - 環境変数が優先されるのは AWS SDK の慣例に合わせるため。偽の環境変数が居座る環境では、
 *   呼び出す側が子プロセスから AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN を
 *   取り除いたうえで AWS_PROFILE を指定する(この分離もテストで検査する)。
 * - 失敗時は null。エラー詳細に秘密が混ざり得るため、詳細文字列は返さない。
 */
export function resolveCredentials(env = process.env, { execImpl = execFileSync } = {}) {
  const fromEnv = credentialsFromEnv(env);
  if (fromEnv) return { credentials: fromEnv, source: 'env' };
  const profile = env.AWS_PROFILE;
  if (!profile) return null;
  let out;
  try {
    // --format process は credential_process 互換の JSON(AccessKeyId/SecretAccessKey/SessionToken)。
    // --format json は AWS CLI のバージョンによって存在しない(2.36 で実測)ため使わない。
    out = execImpl('aws', ['configure', 'export-credentials', '--profile', profile, '--format', 'process'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch {
    return null; // aws CLI が無い / プロファイル不明。stderr は握りつぶす(秘密混入防止)
  }
  try {
    const j = JSON.parse(out);
    if (!j.AccessKeyId || !j.SecretAccessKey) return null;
    return {
      credentials: { accessKeyId: j.AccessKeyId, secretAccessKey: j.SecretAccessKey, sessionToken: j.SessionToken || null },
      source: `profile:${profile}`,
    };
  } catch {
    return null;
  }
}

export function createBedrockClient({ region, credentials, fetchImpl = globalThis.fetch, timeoutMs = 120000 }) {
  if (!credentials) throw new AwsError('AWS 資格情報がありません', { code: 'NoCredentials' });

  async function call({ service, host, method, path, query = '', body = null, operation }) {
    const url = `https://${host}${path}${query ? `?${query}` : ''}`;
    const payload = body === null ? '' : JSON.stringify(body);
    const headers = signRequest({
      method, url, body: payload, service, region, credentials,
      headers: body === null ? { accept: 'application/json' } : { 'content-type': 'application/json' },
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(url, { method, headers, body: payload || undefined, signal: ctrl.signal });
    } catch (e) {
      throw new AwsError(`通信失敗: ${e.name}`, { operation, code: e.name === 'AbortError' ? 'Timeout' : 'NetworkError' });
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* 非JSONはそのまま扱う */ }
    if (!res.ok) {
      const code = json?.__type || json?.code || res.headers?.get?.('x-amzn-errortype') || String(res.status);
      throw new AwsError(json?.message || json?.Message || `HTTP ${res.status}`, {
        status: res.status, code: String(code).split('#').pop(), operation,
      });
    }
    return json;
  }

  const cp = (p) => ({ service: 'bedrock', host: `bedrock.${region}.amazonaws.com`, ...p });
  const rt = (p) => ({ service: 'bedrock', host: `bedrock-runtime.${region}.amazonaws.com`, ...p });

  return {
    region,
    /** 基盤モデル一覧(ライフサイクル・モダリティを含む) */
    listFoundationModels: () =>
      call(cp({ method: 'GET', path: '/foundation-models', operation: 'ListFoundationModels' })),
    /** 推論プロファイル一覧(nextToken でページを辿れる。取り漏らすと jp. profile が消える) */
    listInferenceProfiles: (type, nextToken) =>
      call(cp({
        method: 'GET', path: '/inference-profiles',
        query: [
          type ? `typeEquals=${encodeURIComponent(type)}` : '',
          nextToken ? `nextToken=${encodeURIComponent(nextToken)}` : '',
        ].filter(Boolean).join('&'),
        operation: 'ListInferenceProfiles',
      })),
    /** 個別の推論プロファイル(destination 検証に必須。名前から推測しない) */
    getInferenceProfile: (id) =>
      call(cp({
        method: 'GET', path: `/inference-profiles/${encodeURIComponent(id)}`,
        operation: 'GetInferenceProfile',
      })),
    /** 実効データ保持の確認材料: 呼び出しログ設定 */
    getModelInvocationLoggingConfiguration: () =>
      call(cp({ method: 'GET', path: '/logging/modelinvocations', operation: 'GetModelInvocationLoggingConfiguration' })),
    /** Converse(テキスト+画像。全モデル共通形式) */
    converse: (modelOrProfileId, body) =>
      call(rt({
        method: 'POST', path: `/model/${encodeURIComponent(modelOrProfileId)}/converse`,
        body, operation: 'Converse',
      })),
  };
}

/** Converse のリクエストボディを組む(全モデル同一形式) */
export function buildConverseBody({ system, userText, imagePaths, maxTokens, temperature }) {
  const content = [];
  for (const p of imagePaths || []) {
    content.push({
      image: { format: 'png', source: { bytes: readFileSync(p).toString('base64') } },
    });
  }
  content.push({ text: userText });
  return {
    messages: [{ role: 'user', content }],
    system: [{ text: system }],
    inferenceConfig: { maxTokens, temperature },
  };
}

/** Converse 応答から本文と usage を取り出す */
export function extractConverse(res) {
  const blocks = res?.output?.message?.content || [];
  // reasoning は利用者出力へ含めない(§7)。ただしトークンは原価へ含める。
  const text = blocks.filter((b) => typeof b.text === 'string').map((b) => b.text).join('\n');
  const u = res?.usage || {};
  return {
    text,
    stopReason: res?.stopReason ?? null,
    usage: {
      inputTokens: num(u.inputTokens),
      outputTokens: num(u.outputTokens),
      // Provider により名称が異なる。取れないものは null(0 と混同しない)。
      reasoningTokens: num(u.reasoningTokens ?? u.thinkingTokens),
      cacheReadTokens: num(u.cacheReadInputTokens),
      cacheWriteTokens: num(u.cacheWriteInputTokens),
      totalTokens: num(u.totalTokens),
    },
  };
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
