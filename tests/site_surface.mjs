// 公開面の検査器 — 「何が他人から見えるか」を実物のサイトに対して確かめる。
//
// 使い方: node tests/site_surface.mjs [ベースURL]
//   既定は https://yuukigogo000-ai.github.io
//
// この検査器は「開いていてほしいもの」と「閉じていてほしいもの」の両方を見る。
// 片方だけだと、サイトが丸ごと落ちても緑になってしまう。
//
// 検査器自身の妥当性(実測 2026-08-25): この整理を行う「前」のサイトに対して実行すると
// 55件中30件が不合格になり exit 1 で終わった(閉じるべきものが21件開いていた/中身8件/開くべきもの1件)。
// つまりこの検査器は「NO」と言える。緑を信用してよいのはこれを確認したあと。

const BASE = process.argv[2] || 'https://yuukigogo000-ai.github.io';

// 開いていてほしいもの(公開が目的のページ・アプリの実行に必要なファイル)
const MUST_BE_OPEN = [
  ['/', 'サイトの入口'],
  ['/honmono/', 'HONMONO トップ'],
  ['/honmono/checker/', 'HONMONO 来歴チェッカー'],
  ['/honmono/badge/', 'HONMONO バッジ生成'],
  ['/honmono/aicheck/', 'HONMONO AI判定'],
  ['/honmono/creators/', 'HONMONO クリエイター一覧'],
  ['/honmono/docs/', 'HONMONO 説明'],
  ['/honmono/report/', 'HONMONO レポート'],
  ['/honmono/business/', 'HONMONO 事業説明'],
  ['/honmono/legal/privacy.html', 'プライバシーポリシー'],
  ['/honmono/legal/terms.html', '利用規約'],
  ['/honmono/legal/credits.html', 'クレジット'],
  ['/honmono/design/AI_DETECTOR_EVAL.md', '実測レポート(公開ページからリンクあり)'],
  ['/honmono/design/dataset_licenses.json', '学習データのライセンス一覧(同上)'],
  ['/honmono/vendor/models/honmono_v31_int8.onnx.part1', '判定モデル本体'],
  ['/band/', 'セトリズム'],
  ['/pachinko/', 'パチスロ帝国'],
  ['/line-auto-reply/', 'LINE自動返信ボット 手順'],
  ['/surf/', '波チェック 公開停止の告知'],
  ['/reply-ai/', 'Replier 公開停止の告知'],
  ['/reply-ai/sw.js', 'Replier の墓標ServiceWorker'],
  ['/robots.txt', 'robots'],
  ['/sitemap.xml', 'sitemap'],
];

// 閉じていてほしいもの(他人に見せる必要がない開発用ファイル)
const MUST_BE_CLOSED = [
  ['/tools/jan/', '個人用JAN→楽天ツール(公開オリジンから降ろした)'],
  ['/tools/jan/index.html', '同上・直リンク'],
  ['/reply-ai-app/', 'Replier 開発用ソース'],
  ['/reply-ai-app/REVIEW_LOG.md', 'レビュー記録'],
  ['/reply-ai-app/REVIEW_REQUEST.md', 'レビュー依頼'],
  ['/reply-ai-app/CODEX_REPLIER_PROMPT.txt', 'レビュー用プロンプト'],
  ['/reply-ai-app/DESIGN.md', '設計書'],
  ['/tests/', 'テスト一式'],
  ['/tests/torture.mjs', 'テスト本体'],
  ['/tests/README.md', 'テスト説明'],
  ['/honmono/tests/', 'HONMONO テスト'],
  ['/honmono/tests/verify_site.py', 'HONMONO テスト本体'],
  ['/CLAUDE.md', '作業ルール'],
  ['/honmono/design/PLAN_RELEASE_PREP.md', '公開準備の内部メモ(法務の穴が列挙されている)'],
  ['/honmono/design/UI_REVIEW_BRIEF.md', 'UIレビュー依頼'],
  ['/honmono/design/IMAGE_BRIEF.md', '画像制作指示書'],
  ['/pachinko/DESIGN.md', 'パチスロ帝国 設計書'],
  ['/pachinko/ASSET_BRIEF.md', 'パチスロ帝国 素材指示書'],
  ['/desktop/main.js', 'デスクトップ版ソース'],
  ['/desktop/package.json', 'デスクトップ版定義'],
  ['/pachinko/desktop/main.js', 'パチスロ帝国 デスクトップ版'],
  ['/ui-workbench/', '撤去済みのUIワークベンチ'],
  ['/reply-ai/manifest.webmanifest', 'Replier のPWA定義(消したはず)'],
  ['/reply-ai/assets/index-DFuEpde7.js', 'Replier のアプリ本体(消したはず)'],
];

// 中身の検査 — ステータスだけでは「別の何かが200を返している」を見抜けない
const CONTENT = [
  ['/', 'includes', 'つくったもの置き場', '入口が新しいページになっている'],
  ['/', 'excludes', '楽天', '入口に個人用ツールが残っていない'],
  ['/', 'excludes', 'accessKey', '入口にAPIキー入力欄が残っていない'],
  ['/reply-ai/', 'includes', '公開を停止', 'Replier が告知ページになっている'],
  ['/reply-ai/', 'excludes', 'assets/index-', 'Replier が旧アプリ本体を読み込んでいない'],
  ['/reply-ai/sw.js', 'includes', 'unregister', '墓標SWが自分を解除する'],
  ['/robots.txt', 'includes', 'Disallow: /tools/', 'robots が個人用ツールを除外'],
  ['/surf/', 'includes', '公開を停止', '波チェックの告知が生きている'],
  ['/', 'includes', 'Content-Security-Policy', '入口にCSPが入っている'],
  ['/band/', 'includes', "base-uri 'none'", 'セトリズムのCSPが base 注入を封じている'],
  ['/honmono/checker/', 'includes', "connect-src 'self'", 'チェッカーのCSPが外部送信を封じている'],
  ['/pachinko/', 'includes', 'Content-Security-Policy', 'パチスロ帝国にCSPが入っている'],
];

async function head(path) {
  const res = await fetch(BASE + path, { redirect: 'follow' });
  return res.status;
}

async function body(path) {
  const res = await fetch(BASE + path, { redirect: 'follow' });
  return { status: res.status, text: await res.text() };
}

const fails = [];
const passes = [];

function record(ok, label) {
  if (ok) passes.push(label);
  else fails.push(label);
}

console.log('対象: ' + BASE + '\n');

console.log('[1] 開いていてほしいもの');
for (const [p, why] of MUST_BE_OPEN) {
  let status;
  try { status = await head(p); } catch (e) { status = 'ERR ' + e.message; }
  const ok = status === 200;
  record(ok, `OPEN   ${p} (${why}) -> ${status}`);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${status}  ${p}  — ${why}`);
}

console.log('\n[2] 閉じていてほしいもの');
for (const [p, why] of MUST_BE_CLOSED) {
  let status;
  try { status = await head(p); } catch (e) { status = 'ERR ' + e.message; }
  const ok = status === 404;
  record(ok, `CLOSED ${p} (${why}) -> ${status}`);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${status}  ${p}  — ${why}`);
}

console.log('\n[3] 中身');
for (const [p, mode, needle, why] of CONTENT) {
  let ok, detail;
  try {
    const r = await body(p);
    if (r.status !== 200) { ok = false; detail = 'status ' + r.status; }
    else {
      const has = r.text.includes(needle);
      ok = mode === 'includes' ? has : !has;
      detail = mode === 'includes'
        ? (has ? '含む' : '含まない')
        : (has ? '含んでしまっている' : '含まない');
    }
  } catch (e) { ok = false; detail = 'ERR ' + e.message; }
  record(ok, `CONTENT ${p} ${mode} "${needle}" -> ${detail}`);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${p}  ${mode} "${needle}"  (${detail})  — ${why}`);
}

console.log(`\n合計 ${passes.length + fails.length} 件 / 合格 ${passes.length} / 不合格 ${fails.length}`);
if (fails.length) {
  console.log('\n不合格の一覧:');
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}
console.log('すべて期待どおり。');
