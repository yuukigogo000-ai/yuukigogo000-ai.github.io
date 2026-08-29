// dataset の検証(§8 Stage0 / §12)。
// 使い方: node pricing_eval/src/validate_dataset.mjs

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CASES = 'pricing_eval/cases.json';
const SHOTS = 'pricing_eval/screenshots';

// 実在ブランド・実サービス名の持ち込み禁止(§6)
const BANNED_BRANDS = [
  'LINE', 'Tinder', 'Pairs', 'ペアーズ', 'with', 'Omiai', 'Bumble', 'Hinge', 'タップル', 'ゼクシィ',
  'Instagram', 'インスタ', 'Twitter', 'X.com', 'Facebook', 'TikTok', 'マッチドットコム',
];
const EXPECTED = { text_short: 20, text_long: 20, screenshot_1_3: 20, screenshot_4_6: 20, style: 20, edge: 20 };

export function validateDataset() {
  const errors = [];
  const warnings = [];
  if (!existsSync(CASES)) return { ok: false, errors: [`${CASES} がありません`], warnings, stats: null };
  const data = JSON.parse(readFileSync(CASES, 'utf8'));
  const cases = data.cases || [];

  // 件数・区分
  if (cases.length !== 120) errors.push(`ケース数が 120 でない: ${cases.length}`);
  const byCat = {};
  for (const c of cases) byCat[c.category] = (byCat[c.category] || 0) + 1;
  for (const [cat, n] of Object.entries(EXPECTED)) {
    if (byCat[cat] !== n) errors.push(`区分 ${cat} が ${n} 件でない: ${byCat[cat] ?? 0}`);
  }

  // ID 一意
  const ids = cases.map((c) => c.id);
  if (new Set(ids).size !== ids.length) errors.push('case ID が一意でない');

  // 画像
  let imgTotal = 0;
  const missingImages = [];
  for (const c of cases) {
    const n = (c.images || []).length;
    imgTotal += n;
    if (n > 6) errors.push(`${c.id}: 1ケース最大6枚を超えている (${n})`);
    if (c.image_plan && c.image_plan.count !== n) errors.push(`${c.id}: manifest(${c.image_plan.count})と実画像数(${n})が不一致`);
    for (const f of c.images || []) {
      if (!existsSync(join(SHOTS, f))) missingImages.push(`${c.id}: ${f}`);
    }
    // 最後は相手の発言(返信を作る対象が必要)
    if (!c.conversation?.length) errors.push(`${c.id}: 会話が空`);
    else if (c.conversation.at(-1).from !== 'partner') errors.push(`${c.id}: 最後が相手の発言でない`);
    // 期待・禁止条件
    if (!c.expects?.length) errors.push(`${c.id}: expects が無い`);
    if (!c.forbids?.length) errors.push(`${c.id}: forbids が無い`);
  }

  // 画像はリポジトリに含めない(決定論的に再生成できるため)。まとめて1件の案内にする。
  if (missingImages.length) {
    errors.push(
      `スクリーンショットが ${missingImages.length} 枚ありません。` +
        '先に `node pricing_eval/src/render_screenshots.mjs` を実行してください' +
        `(例: ${missingImages[0]})`,
    );
  }

  // 実在ブランド・実サービス名。
  // 走査対象は「利用者に見えるテキスト欄」だけにする。内部のルールキー名(例: forbids の識別子)は
  // 英単語を含むため、JSON 全体を舐めると誤検知する。
  const corpus = cases
    .flatMap((c) => [
      c.goal,
      c.style_sample,
      c.style_note,
      c.edge_reason,
      c.partner_profile ? `${c.partner_profile.nickname} ${c.partner_profile.note}` : '',
      ...(c.conversation || []).map((t) => t.text),
    ])
    .filter(Boolean)
    .join('\n');
  for (const b of BANNED_BRANDS) {
    if (new RegExp(`(^|[^A-Za-z])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`, 'i').test(corpus)) {
      errors.push(`実在ブランド名が含まれている: ${b}`);
    }
  }
  // 電話番号・メール・URL(架空でも入れない)
  if (/0\d{1,4}-\d{1,4}-\d{3,4}/.test(corpus)) errors.push('電話番号らしき文字列が含まれている');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(corpus)) errors.push('メールアドレスらしき文字列が含まれている');
  if (/https?:\/\//.test(corpus)) errors.push('URL が含まれている');

  return {
    ok: errors.length === 0,
    errors, warnings,
    stats: { cases: cases.length, byCategory: byCat, images: imgTotal, seed: data.seed },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = validateDataset();
  console.log(JSON.stringify(r.stats, null, 2));
  for (const w of r.warnings) console.log('[warn]', w);
  for (const e of r.errors) console.error('[error]', e);
  console.log(r.ok ? '✅ dataset OK' : `❌ ${r.errors.length} 件の問題`);
  process.exit(r.ok ? 0 : 1);
}
