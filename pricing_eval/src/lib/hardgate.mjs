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
  'destinations_japan',     // 4. 処理 destination がすべて日本国内(東京/大阪)。direct In-Region Tokyo か jp geo profile の2経路
  'destinations_allowed',   // 5. destination は原則 ap-northeast-1 / ap-northeast-3 のみ
  'multimodal',             // 6. テキスト入力と画像入力に対応
  'six_image_structural',   // 7a. 6枚同時の構造的対応(Image入力+Converse対応+既定上限内。公式仕様で判定)
  'six_image_runtime_verified', // 7b. 6枚同時の実呼び出し成功(smoke まで UNKNOWN。構造対応と混同しない)
  'retention_none',         // 8. 実効データ保持モード none で呼び出せる(opt-in保持を要求するモデルは FAIL)
  'no_prompt_output_sharing_with_model_provider', // 9a. プロンプト・出力が Provider へ共有されない(retention none + 公式仕様の証拠で PASS 可)
  'no_noncontent_usage_metadata_sharing',         // 9b. 非コンテンツ利用情報も共有されない(AWS Service Terms 50.12.5 により自動 PASS 不可)
  'terms_allow_usecase',    // 10. Replier の用途が Provider 規約上禁止されていない(常に人間判断)
  'pricing_obtainable',     // 11. 価格情報または使用量情報を取得できる
  'eol_not_near',           // 12. EOL までの猶予が minimumEolHeadroomDays 以上(未告知は none_announced 証拠つき PASS / 不明は UNKNOWN)
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

// 「日本国内」とみなすリージョン。ap-northeast-2 はソウル(国外)なので前方一致で判定しない。
export const JAPAN_REGIONS = ['ap-northeast-1', 'ap-northeast-3'];

/** destination の配列から 4・5 番の判定を作る(jp geo profile 経路)。空集合は PASS にしない。 */
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
  const nonJapan = regions.filter((r) => !JAPAN_REGIONS.includes(r));
  const outsideAllowed = regions.filter((r) => !allowed.includes(r));
  return {
    destinations_japan:
      nonJapan.length === 0
        ? gate(PASS, { destinations: regions, path: 'jp_geo_profile' })
        : gate(FAIL, { destinations: regions, nonJapan }, '国外(東京/大阪以外の) destination が含まれる'),
    destinations_allowed:
      outsideAllowed.length === 0
        ? gate(PASS, { destinations: regions })
        : gate(FAIL, { destinations: regions, outsideAllowed }, '許可外リージョンが含まれる'),
  };
}

/**
 * direct In-Region Tokyo 経路の 4・5 番判定。
 * 根拠は「東京エンドポイントの ListFoundationModels が ON_DEMAND を返した」という AWS API の実データ
 * (+ あればモデルカードの Tokyo In-Region 記載)。実行アダプタは endpoint を
 * bedrock-runtime.<region>.amazonaws.com に固定しており他リージョンへのフォールバック経路を持たない。
 */
export function judgeDirectTokyo({ inferenceTypes, region, cardEvidence }) {
  const onDemand = Array.isArray(inferenceTypes) && inferenceTypes.includes('ON_DEMAND');
  if (!onDemand || region !== 'ap-northeast-1') return null; // この経路では判定できない
  const evidence = {
    path: 'direct_in_region_tokyo',
    endpoint: `bedrock-runtime.${region}.amazonaws.com`,
    sourceRegion: region,
    destinations: [region],
    api: 'ListFoundationModels(inferenceTypesSupported=ON_DEMAND)',
    adapterFallback: 'none(エンドポイント固定・他リージョンへのフォールバック実装なし)',
    modelCard: cardEvidence?.tokyoInRegion === true
      ? { url: cardEvidence.url, fetchedAt: cardEvidence.fetchedAt, tokyoInRegion: true }
      : null,
  };
  return {
    destinations_japan: gate(PASS, evidence),
    destinations_allowed: gate(PASS, evidence),
  };
}

export const DEFAULT_MIN_EOL_HEADROOM_DAYS = 90;

/**
 * EOL 日から 12 番の判定を作る。
 * - eolDate 不明(証拠なし) → UNKNOWN(採用保留)
 * - 'none_announced'(公式カードに EOL date: N/A と明記) → PASS(証拠つき)
 * - 猶予 < minHeadroomDays → FAIL(production candidate から外す。benchmark-only 扱いは呼び出し側)
 * 猶予の基準は黙って固定せず minimumEolHeadroomDays 設定から渡す。
 */
export function judgeEol(eolDate, now = new Date(), minHeadroomDays = DEFAULT_MIN_EOL_HEADROOM_DAYS) {
  if (!eolDate) return gate(UNKNOWN, null, 'EOL 日が不明。最終採用は保留する。');
  if (eolDate === 'none_announced') {
    // 「EOL date: N/A」は EOL 未公表であって「無期限」でも「90日以上の保証」でもない。
    // PASS 扱いは誤り(2026-08-31 発注者指摘で修正): smoke には進めるが、
    // production 採用は人間によるサポート終了リスク受容が必要(CONDITIONAL)。
    return gate(UNKNOWN, {
      eolFloor: 'none_announced', minHeadroomDays,
      eligible_for_smoke: true, eligible_for_production: 'CONDITIONAL',
    }, 'EOL 未公表(カード表記 N/A)。無期限保証ではない。production は人間のサポート終了リスク受容が必要');
  }
  const d = new Date(eolDate);
  if (Number.isNaN(d.getTime())) return gate(UNKNOWN, { eolDate }, 'EOL 日を解釈できない');
  const days = Math.floor((d - now) / 86400000);
  if (days < 0) return gate(FAIL, { eolDate, headroomDays: days, minHeadroomDays }, 'EOL 済み');
  if (days < minHeadroomDays) {
    return gate(FAIL, { eolDate, headroomDays: days, minHeadroomDays },
      `EOL 猶予 ${days} 日 < 基準 ${minHeadroomDays} 日。production candidate から外す(benchmark-only 候補)`);
  }
  return gate(PASS, { eolDate, headroomDays: days, minHeadroomDays });
}
