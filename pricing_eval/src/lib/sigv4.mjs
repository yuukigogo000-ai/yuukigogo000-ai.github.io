// AWS SigV4 署名(node:crypto のみ。大きなSDKを足さない)。
//
// AWS 公式テストスイート(aws-sig-v4-test-suite)の既知ベクタで検証できるように、
// 署名計算を純関数として切り出してある。tests/run_tests.mjs が known-answer test を回す。

import { createHash, createHmac } from 'node:crypto';

const sha256hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data, 'utf8').digest();

/**
 * 非S3サービスの canonical URI(SigV4 仕様: パスセグメントを二重URIエンコード)。
 * URL.pathname は単エンコード(例: ':' → %3A)なので、各セグメントをもう一度エンコードする。
 * これをしないと ':' を含む推論プロファイルID / モデルID のパス
 * (GetInferenceProfile・Converse)が InvalidSignatureException になる(2026-08-30 実測)。
 */
export function canonicalUriPath(pathname) {
  return String(pathname).split('/').map((s) => encodeURIComponent(s)).join('/');
}

export function canonicalRequest({ method, path, query = '', headers, payloadHash }) {
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  const signedHeaders = Object.keys(lower).sort();
  const canonicalHeaders = signedHeaders.map((h) => `${h}:${lower[h]}\n`).join('');
  return {
    text: [method, path, query, canonicalHeaders, signedHeaders.join(';'), payloadHash].join('\n'),
    signedHeaders: signedHeaders.join(';'),
  };
}

export function stringToSign({ amzDate, scope, canonicalRequestText }) {
  return ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequestText)].join('\n');
}

export function signingKey({ secretKey, dateStamp, region, service }) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

/**
 * 署名済みヘッダを返す。credentials は呼び出し側が渡す(ここでは環境変数を読まない)。
 * 戻り値にシークレットは含めない。
 */
export function signRequest({
  method, url, body = '', service, region, credentials, amzDate, headers = {},
}) {
  const u = new URL(url);
  const date = amzDate || new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = date.slice(0, 8);
  const payloadHash = sha256hex(body);

  const h = {
    host: u.host,
    'x-amz-date': date,
    ...headers,
  };
  if (credentials.sessionToken) h['x-amz-security-token'] = credentials.sessionToken;

  // クエリはキー順に正規化
  const query = [...u.searchParams.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const cr = canonicalRequest({ method, path: canonicalUriPath(u.pathname), query, headers: h, payloadHash });
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const sts = stringToSign({ amzDate: date, scope, canonicalRequestText: cr.text });
  const key = signingKey({ secretKey: credentials.secretAccessKey, dateStamp, region, service });
  const signature = createHmac('sha256', key).update(sts, 'utf8').digest('hex');

  return {
    ...h,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${cr.signedHeaders}, Signature=${signature}`,
  };
}

export { sha256hex };
