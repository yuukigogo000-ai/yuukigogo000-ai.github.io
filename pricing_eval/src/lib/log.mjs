// 秘匿ログ。会話本文・画像base64・資格情報を絶対に出さない。
//
// テスト(tests/run_tests.mjs)が「危険な値を渡しても出力に出ない」ことを機械検査する。
// 出力を増やすときは必ず redact() を通すこと。

const SECRET_PATTERNS = [
  // AWS / API 資格情報
  [/\b(AKIA|ASIA)[0-9A-Z]{8,}/g, '[REDACTED_AWS_KEY]'],
  [/\bsk-ant-[A-Za-z0-9_\-]{8,}/g, '[REDACTED_API_KEY]'],
  [/\b[A-Za-z0-9/+=]{40}\b/g, '[REDACTED_SECRETLIKE]'], // AWS secret access key 長
  [/(X-Amz-Signature=)[0-9a-f]{16,}/gi, '$1[REDACTED]'],
  [/(X-Amz-Security-Token=)[^&\s]+/gi, '$1[REDACTED]'],
  [/(Authorization"?\s*[:=]\s*"?)[^",\s]+/gi, '$1[REDACTED]'],
];

// data URI / 生base64(画像)は長さだけ残す
function stripBase64(s) {
  return s
    .replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/gi, (m) => `[IMAGE_DATA_URI len=${m.length}]`)
    .replace(/"bytes"\s*:\s*"[A-Za-z0-9+/=]{64,}"/g, '"bytes":"[IMAGE_B64]"')
    .replace(/\b[A-Za-z0-9+/]{200,}={0,2}\b/g, '[B64_BLOB]');
}

export function redact(value) {
  let s = typeof value === 'string' ? value : safeStringify(value);
  s = stripBase64(s);
  for (const [re, rep] of SECRET_PATTERNS) s = s.replace(re, rep);
  return s;
}

function safeStringify(v) {
  try {
    return JSON.stringify(v, (k, val) => {
      // 会話本文・画像・生成結果はログに出さない(ローカル成果物ファイルには別途保存する)
      if (/^(conversation|messages|content|body|text|replies|image|images|bytes|prompt|response|system)$/i.test(k)) {
        if (typeof val === 'string') return `[OMITTED len=${val.length}]`;
        if (Array.isArray(val)) return `[OMITTED array len=${val.length}]`;
        if (val && typeof val === 'object') return '[OMITTED object]';
      }
      if (/(secret|token|password|credential|signature|apikey|api_key|accesskey)/i.test(k)) return '[REDACTED]';
      return val;
    });
  } catch {
    return '[UNSERIALIZABLE]';
  }
}

export function logInfo(msg, meta) {
  process.stdout.write(`[info] ${redact(msg)}${meta ? ' ' + redact(meta) : ''}\n`);
}
export function logWarn(msg, meta) {
  process.stdout.write(`[warn] ${redact(msg)}${meta ? ' ' + redact(meta) : ''}\n`);
}
export function logError(msg, meta) {
  process.stderr.write(`[error] ${redact(msg)}${meta ? ' ' + redact(meta) : ''}\n`);
}

// アカウントID等のマスク
export function maskAccount(id) {
  const s = String(id ?? '');
  return s.length <= 4 ? '****' : `****${s.slice(-4)}`;
}
