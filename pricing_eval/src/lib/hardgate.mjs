// Hard Gate(§4)。12条件を PASS / FAIL / UNKNOWN の3値で判定する。
//
// 判定ルール(この3値設計が全体の安全弁):
//   FAIL    … 1つでもあれば候補から即除外。Full Run へ進めない。
//   UNKNOWN … 実行時に検証できなかった項目。候補としての評価は進めてよいが、
//             最終採用(selected)はブロックする。推測で PASS にしない(§指示の大原則)。
//   PASS    … AWS API か公式情報で実際に確認できたものだけ。
//
// モデル名・Provider名からの推測で PASS を付けることを禁止する。

export const GATE_IDS = [
  'bedrock_available',      // 1. Amazon Bedrock で利用可能
  'lifecycle_active',       // 2. ライフサイクルが Active
  'callable_from_tokyo',    // 3. 東京 ap-northeast-1 から呼び出せる
  'destinations_japan',     // 4. Geo/In-Region 推論の全 destination が日本国内
  'destinations_allowed',   // 5. destination は原則 ap-northeast-1 / ap-northeast-3 のみ
  'multimodal',             // 6. テキスト入力と画像入力に対応
  'six_images',             // 7. 最大6枚を1リクエストで処理可能
  'retention_none',         // 8. 実効データ保持モード none で呼び出せる
  'no_provider_sharing',    // 9. 入出力が Provider へ共有されない
  'terms_allow_usecase',    // 10. Replier の用途が Provider 規約上禁止されていない
  'pricing_obtainable',     // 11. 価格情報または使用量情報を取得できる
  'eol_not_near',           // 12. EOL が近くない(不明は UNKNOWN)
];

export const PASS = 'PASS';
export const FAIL = 'FAIL';
export const UNKNOWN = 'UNKNOWN';

/** 1項目の判定 */
export function gate(status, evidence, note) {
  if (![PASS, FAIL, UNKNOWN].includes(status)) throw new Error(`不正なgate status: ${status}`);
  return { status, evidence: evidence ?? null, note: note ?? null };
}

/**
 * gates: { [gateId]: {status, evidence, note} }
 * 返り値: { verdict, fails, unknowns, evaluable, adoptionBlocked }
 *   evaluable        … Smoke/Full Run に進めてよいか
 *   adoptionBlocked  … 最終採用をブロックすべきか
 */
export function evaluateGates(gates) {
  const missing = GATE_IDS.filter((id) => !gates[id]);
  const normalized = { ...gates };
  // 未評価の項目は UNKNOWN 扱い。黙って通さない。
  for (const id of missing) normalized[id] = gate(UNKNOWN, null, '未評価');

  const fails = GATE_IDS.filter((id) => normalized[id].status === FAIL);
  const unknowns = GATE_IDS.filter((id) => normalized[id].status === UNKNOWN);

  const verdict = fails.length ? FAIL : unknowns.length ? UNKNOWN : PASS;
  return {
    verdict,
    fails,
    unknowns,
    gates: normalized,
    evaluable: fails.length === 0,        // FAIL があれば Full Run しない
    adoptionBlocked: fails.length > 0 || unknowns.length > 0,
  };
}

/** destination の配列から 4・5 番の判定を作る */
export function judgeDestinations(destinations, allowed) {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    const g = gate(UNKNOWN, null, 'destination を取得できなかった。jp. などの名前から推測しない。');
    return { destinations_japan: g, destinations_allowed: g };
  }
  const regions = destinations.map((d) => (typeof d === 'string' ? d : d.region)).filter(Boolean);
  if (regions.length !== destinations.length) {
    const g = gate(UNKNOWN, { destinations }, 'destination の形式を解釈できない');
    return { destinations_japan: g, destinations_allowed: g };
  }
  const nonJapan = regions.filter((r) => !r.startsWith('ap-northeast-'));
  const outsideAllowed = regions.filter((r) => !allowed.includes(r));
  return {
    destinations_japan:
      nonJapan.length === 0
        ? gate(PASS, { destinations: regions })
        : gate(FAIL, { destinations: regions, nonJapan }, '国外 destination が含まれる'),
    destinations_allowed:
      outsideAllowed.length === 0
        ? gate(PASS, { destinations: regions })
        : gate(FAIL, { destinations: regions, outsideAllowed }, '許可外リージョンが含まれる'),
  };
}

/** EOL 日から 12 番の判定を作る。閾値内・不明は採用保留。 */
export function judgeEol(eolDate, now = new Date(), warnDays = 180) {
  if (!eolDate) return gate(UNKNOWN, null, 'EOL 日が不明。最終採用は保留する。');
  const d = new Date(eolDate);
  if (Number.isNaN(d.getTime())) return gate(UNKNOWN, { eolDate }, 'EOL 日を解釈できない');
  const days = Math.floor((d - now) / 86400000);
  if (days < 0) return gate(FAIL, { eolDate, days }, 'EOL 済み');
  if (days < warnDays) return gate(FAIL, { eolDate, days }, `EOL まで ${days} 日で近い`);
  return gate(PASS, { eolDate, days });
}
