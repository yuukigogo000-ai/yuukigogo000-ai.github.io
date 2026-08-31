// Anthropic Messages API アダプタ(アプリ本来の呼び方 = reply-ai-app/src/lib/api.ts と同一形)。
//
// 目的: Opus 5 を「本番と同じ経路・同じ schema 縛り(output_config json_schema)・同じキャッシュ指定」で評価する。
// Bedrock 経由(Converse+toolConfig)とは schema の縛り方が違うので、manifest に schemaDelivery を明記する。
//
// 秘密の扱い: API キーは環境変数 ANTHROPIC_API_KEY か、リポジトリ外のキーファイル(既定 ~/.anthropic/replier_eval.key)
// から読む。値はメモリ内にのみ置き、戻り値の source(出所の種別)以外は外に出さない。エラー文からも sk- 系の文字列を落とす。
//
// データ保持: この経路は Anthropic 標準の保持(retention none ではない)。合成データ限定で、実行側が
// --accept-provider-retention を明示したときだけ動かす(fidelity_eval 側で検査)。

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_KEY_FILE = join(homedir(), '.anthropic', 'replier_eval.key');
export const ANTHROPIC_API = 'https://api.anthropic.com';
export const ANTHROPIC_VERSION = '2023-06-01'; // api.ts と同一

export class AnthropicError extends Error {
  constructor(message, { status, code, operation, requestId } = {}) {
    super(message);
    this.name = 'AnthropicError';
    this.status = status; this.code = code; this.operation = operation;
    this.requestId = requestId ?? null;
  }
}

/** エラー文から API キー様の文字列を落とす(sk-ant-… / Bearer / x-api-key) */
export function sanitizeAnthropicMessage(message, maxLen = 500) {
  let s = String(message ?? '');
  s = s
    .replace(/sk-ant-[A-Za-z0-9_-]{6,}/g, '[REDACTED_ANTHROPIC_KEY]')
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, '[REDACTED_KEY]')
    .replace(/(x-api-key[:=]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/(Authorization[:=]\s*)\S+/gi, '$1[REDACTED]');
  return s.length > maxLen ? `${s.slice(0, maxLen)}…[truncated]` : s;
}

/**
 * API キーの解決。優先: 環境変数 ANTHROPIC_API_KEY → キーファイル。値はログに出さない。
 * @returns {{apiKey:string, source:'env'|'file'}|null}
 */
export function loadAnthropicApiKey({ env = process.env, keyFile = DEFAULT_KEY_FILE } = {}) {
  const fromEnv = (env.ANTHROPIC_API_KEY || '').trim();
  if (fromEnv) return { apiKey: fromEnv, source: 'env' };
  if (keyFile && existsSync(keyFile)) {
    const v = readFileSync(keyFile, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)[0]?.trim() || '';
    if (v) return { apiKey: v, source: 'file' };
  }
  return null;
}

/** Messages API クライアント。requestId(request-id ヘッダ)と HTTP status を $ 接頭辞で併載する */
export function createAnthropicClient({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = 120000, baseUrl = ANTHROPIC_API }) {
  if (!apiKey) throw new AnthropicError('Anthropic API キーがありません', { code: 'NoCredentials' });
  async function callRaw({ method, path, body = null, operation }) {
    const url = `${baseUrl}${path}`;
    const payload = body === null ? undefined : JSON.stringify(body);
    const headers = { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, accept: 'application/json' };
    if (payload !== undefined) headers['content-type'] = 'application/json';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(url, { method, headers, body: payload, signal: ctrl.signal });
    } catch (e) {
      throw new AnthropicError(`通信失敗: ${e.name}`, { operation, code: e.name === 'AbortError' ? 'Timeout' : 'NetworkError' });
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* 非JSON */ }
    const requestId = res.headers?.get?.('request-id') || res.headers?.get?.('x-request-id') || null;
    if (!res.ok) {
      throw new AnthropicError(sanitizeAnthropicMessage(json?.error?.message || `HTTP ${res.status}`), {
        status: res.status, code: json?.error?.type || String(res.status), operation, requestId,
      });
    }
    return { data: json, requestId, status: res.status };
  }
  return {
    /** モデルの存在確認(GET /v1/models/{id}。無課金。キーとモデルの両方を実地で確かめる) */
    getModel: async (id) => (await callRaw({ method: 'GET', path: `/v1/models/${encodeURIComponent(id)}`, operation: 'GetModel' })).data,
    messages: async (body) => {
      const r = await callRaw({ method: 'POST', path: '/v1/messages', body, operation: 'Messages' });
      return { ...r.data, $requestId: r.requestId, $httpStatus: r.status };
    },
  };
}

/**
 * api.ts と同じ形のリクエストボディ。違いは max_tokens(評価は cfg.outputMaxTokens・本番は16000)と
 * 画像の media_type(評価のスクショは png・本番は jpeg)だけ。temperature は null で省略(Opus 5 は非対応)。
 */
export function buildMessagesBody({ model, system, userText, imagePaths, maxTokens, temperature, schema }) {
  const content = [];
  for (const p of imagePaths || []) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: readFileSync(p).toString('base64') } });
  }
  content.push({ type: 'text', text: userText });
  const body = {
    model,
    max_tokens: maxTokens,
    output_config: { format: { type: 'json_schema', schema } },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  };
  // Claude 5 系は temperature 非対応(400)。null/undefined なら送らない(本番 api.ts も送らない)
  if (temperature != null) body.temperature = temperature;
  return body;
}

/** 応答から本文と usage。input_tokens はキャッシュ分を含まない(Anthropic 仕様)ので cache 列を別に持つ */
export function extractMessages(res) {
  const blocks = res?.content || [];
  const text = blocks.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  const u = res?.usage || {};
  return {
    text,
    stopReason: res?.stop_reason ?? null,
    usage: {
      inputTokens: num(u.input_tokens),
      outputTokens: num(u.output_tokens),
      reasoningTokens: null,
      cacheReadTokens: num(u.cache_read_input_tokens),
      cacheWriteTokens: num(u.cache_creation_input_tokens),
      totalTokens: null,
    },
  };
}

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
