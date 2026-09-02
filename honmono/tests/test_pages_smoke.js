// 全ページを実際のブラウザで開き、JSエラー・404・肝心の描画を確かめる。
// 「開けた」で終わらせず、各ページに必ず出ているはずの文字列を確認する。
// --mutate を付けると、わざと壊した状態で検査が落ちるかを確かめる。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

// 検査対象のサイトルート。既定はこのファイルから見たリポジトリ直下。
// (以前は特定セッションの一時ディレクトリを直書きしていて、そのフォルダが消えた時点で
//  この検査器は実行不能になっていた。SITE_ROOT で差し替えられるようにした)
const REPO = path.resolve(process.env.SITE_ROOT || path.join(__dirname, '..', '..'));
const PORT = 8771;

// システムにあるブラウザ本体を使う(playwright のダウンロードはしない)。
// CHROME_PATH で明示指定でき、無ければ Windows / Linux の定番の場所を順に見る。
function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const cands = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (dir && fs.existsSync(dir)) {
    for (const d of fs.readdirSync(dir)) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        cands.push(path.join(dir, d, rel));
      }
    }
  }
  cands.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error('no chromium-based browser found (CHROME_PATH で指定してください)');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.mjs': 'text/javascript' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(REPO, p);
      if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        rep.writeHead(404); rep.end('nf'); return;
      }
      rep.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rep);
    });
    s.listen(PORT, () => res(s));
  });
}

// ページ -> 描画後に本文へ必ず現れているべき文字列
const PAGES = [
  ['/honmono/',                    ['実測レポートを読む', '法人・開発者の方へ', 'クレジット']],
  // 画素判定カードは画像を読み込むまで隠れているので、可視文字列ではなくDOMで確認する(下の LINKS)
  ['/honmono/checker/',            ['来歴チェッカー', 'クレジット']],
  ['/honmono/badge/',              ['不可能ではありません']],
  ['/honmono/aicheck/',            ['名誉毀損', '断定して晒す使い方はしないでください']],
  ['/honmono/creators/',           ['掲載カードの見本 ①', 'まだ0件', '見本']],
  ['/honmono/docs/',               ['故意または重大な過失', 'オフラインでは開けません']],
  ['/honmono/report/',             ['CDLA-Permissive-2.0', '訂正の履歴', '4割近く見逃します']],
  ['/honmono/business/',           ['30〜100万円', '4割近く見逃します', 'お引き受けしないこと']],
  ['/honmono/legal/privacy.html',  ['Cache Storage', 'shields.io']],
  ['/honmono/legal/terms.html',    ['第8条(免責)', '故意または重大な過失']],
  ['/honmono/legal/credits.html',  ['Copyright (c) Microsoft Corporation', 'Copyright 2021 Adobe', 'CC BY 2.0']],
];

// 隠れていてもDOMに必ず存在すべきリンク(法的な表示義務にあたるもの)
const LINKS = {
  '/honmono/checker/': [
    ['a[href$="vendor/models/LICENSE.md"]', 'モデルの利用条件'],
    ['a[href="../report/"]', '実測レポート'],
    ['a[href="../legal/credits.html"]', 'クレジット'],
  ],
  '/honmono/': [
    ['a[href="legal/credits.html"]', 'クレジット'],
    ['a[href="legal/privacy.html"]', 'プライバシー'],
    ['a[href="legal/terms.html"]', '利用規約'],
  ],
};

(async () => {
  const mutate = process.argv.includes('--mutate');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  const fails = [];
  let checks = 0;

  for (const [url, musts] of PAGES) {
    const page = await browser.newPage();
    const consoleErrors = [];
    const bad = [];
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text()); });
    page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });

    await page.goto('http://127.0.0.1:' + PORT + url, { waitUntil: 'networkidle' });
    const text = await page.evaluate(() => document.body.innerText);

    // 隠れている要素も含めて、必ず存在すべきリンク(法的表示)を確認する
    for (const [sel, why] of (LINKS[url] || [])) {
      checks++;
      const want = mutate ? sel + '[data-mutant]' : sel;
      const n = await page.evaluate(s => document.querySelectorAll(s).length, want);
      if (!n) fails.push(url + ' : ' + why + ' のリンクが無い (' + want + ')');
    }

    for (const m of musts) {
      checks++;
      const want = mutate ? m + 'ZZZ_MUTANT' : m;
      if (!text.includes(want)) fails.push(url + ' : 本文に「' + want + '」が無い');
    }
    // 90MBモデルは押さないと読み込まれないので、それ以外の404だけ見る
    const real404 = bad.filter(b => !b.includes('.onnx'));
    if (real404.length) fails.push(url + ' : 404 → ' + real404.join(', '));
    if (consoleErrors.length) fails.push(url + ' : JSエラー → ' + consoleErrors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();

  console.log('検査: ' + PAGES.length + 'ページ / ' + checks + '項目');
  if (mutate) {
    console.log(fails.length >= checks
      ? 'MUTATE OK — 仕込んだ ' + checks + ' 件すべてを検出(検査器は本当に落ちる)'
      : '★MUTATE FAIL — ' + fails.length + '/' + checks + ' しか落ちない');
    process.exit(fails.length >= checks ? 0 : 1);
  }
  if (fails.length) { console.log('失敗 ' + fails.length + '件:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('SMOKE PASS — JSエラー0・404なし・必須表示すべて確認');
})();
