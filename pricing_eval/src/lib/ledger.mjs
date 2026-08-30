// 実行台帳(重複実行防止)。
//
// 一意キー = modelId × caseId × datasetHash × promptHash × configHash。
// 同一キーで成功済みのケースは再実行しない(実費の二重支出を構造的に防ぐ)。
// ハッシュのどれか1つでも違えば別キー = 再実行対象(過去の成功を流用しない)。
//
// 台帳は runs/ledger.jsonl(gitignore 対象・生応答は含めない=usage と検証集計のみ)。

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';

export const LEDGER_PATH = 'pricing_eval/runs/ledger.jsonl';

const sha = (s) => createHash('sha256').update(s).digest('hex');

/** cases.json の生バイト列に対するハッシュ */
export function datasetHashOf(casesRaw) {
  return sha(casesRaw);
}

/**
 * system instruction + ユーザー入力 + 添付画像ファイル名列。どれか変われば別プロンプト。
 * JSON.stringify で構造ごと直列化する(区切り文字の衝突で別入力が同一ハッシュにならない)。
 */
export function promptHashOf({ system, userText, imageFiles }) {
  return sha(JSON.stringify({ system, userText, imageFiles: imageFiles || [] }));
}

/** 生成条件。呼び出し先・出力上限・temperature・region が変われば別条件 */
export function configHashOf({ region, invocationTarget, outputMaxTokens, temperature, maxImages }) {
  return sha(JSON.stringify({ region, invocationTarget, outputMaxTokens, temperature, maxImages }));
}

export function ledgerKey(e) {
  for (const k of ['modelId', 'caseId', 'datasetHash', 'promptHash', 'configHash']) {
    if (!e[k]) throw new Error(`台帳キーに ${k} がありません(不完全なキーで照合しない)`);
  }
  return [e.modelId, e.caseId, e.datasetHash, e.promptHash, e.configHash].join('|');
}

/** 成功エントリだけを Map(key→entry) で返す。壊れた行は再利用しない(安全側) */
export function loadLedger(path = LEDGER_PATH) {
  const map = new Map();
  if (!existsSync(path)) return map;
  for (const ln of readFileSync(path, 'utf8').split('\n')) {
    const s = ln.trim();
    if (!s) continue;
    try {
      const e = JSON.parse(s);
      if (e.success === true) map.set(ledgerKey(e), e);
    } catch { /* 壊れた行 = 流用不可 */ }
  }
  return map;
}

export function appendLedger(entry, path = LEDGER_PATH) {
  ledgerKey(entry); // キー完全性の検査(欠損キーの行を書かない)
  appendFileSync(path, JSON.stringify(entry) + '\n');
}
