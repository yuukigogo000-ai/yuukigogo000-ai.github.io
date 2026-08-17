// アポ取りAI 破壊的検証(実ブラウザ + モックAPI)
// 実行: npm run build && python3 -m http.server 8778 (リポジトリのルート) && npm test
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8778/reply-ai/';
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const results = [];
const check = (name, cond, extra = '') => results.push({ name, pass: !!cond, extra: String(extra).slice(0, 160) });

const replyResult = (tag) => ({
  stop_reason: 'end_turn',
  content: [
    { type: 'thinking', thinking: '' },
    { type: 'text', text: JSON.stringify({
        situation: `状況分析${tag}`,
        interest_level: 72,
        replies: [
          { bubbles: [`返信案A-${tag}`, `二通目A-${tag}`], why: '理由1' },
          { bubbles: [`返信案B-${tag}`], why: '理由2' },
          { bubbles: [`返信案C-${tag}`], why: '理由3' },
        ],
        advice: `アドバイス${tag}`,
      }) },
  ],
});

const profileResult = () => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify({
    score: 68,
    first_impression: '第一印象テスト',
    strengths: ['強み1', '強み2'],
    weaknesses: ['弱み1', '弱み2', '弱み3'],
    improved_bios: [ { text: 'bio案1', why: '狙い1' }, { text: 'bio案2', why: '狙い2' } ],
    photo_advice: '写真アドバイステスト',
  }) }],
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  // Service Worker はテスト中のリクエスト横取りを避けるため無効化(SW自体の配信は別途検証する)
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));

  let mock = null;
  let lastBody = null;
  let delayMs = 0;
  const apiHandler = async route => {
    lastBody = JSON.parse(route.request().postData());
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    const r = mock ? mock(lastBody) : { status: 500, body: { error: { message: 'no mock configured' } } };
    await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
  };
  await page.route('https://api.anthropic.com/**', apiHandler);

  const openDetails = () => page.evaluate(() => {
    const d = document.querySelector('#tabReply details');
    if (d) d.open = true;
  });

  await page.goto(BASE);
  await page.waitForSelector('#generate');
  check('1. ページ読込時にJSエラーなし', pageErrors.length === 0, pageErrors.join(' | '));

  // --- 2. APIキー未入力で生成 ---
  await page.click('#generate');
  check('2a. キー未入力→エラー表示', (await page.textContent('#error')).includes('APIキー'));
  check('2b. キー未入力なら設定シートが自動で開く', await page.isVisible('#apiKey'));

  // --- 3. キーあり・会話なし ---
  await page.fill('#apiKey', 'sk-ant-test-123');
  await page.check('#rememberKey');
  await page.click('#sheetClose');
  await page.waitForSelector('#apiKey', { state: 'detached' });
  check('3a. 設定シートを閉じられる', !(await page.isVisible('#apiKey')));
  await page.click('#generate');
  check('3b. 会話未入力→エラー表示', (await page.textContent('#error')).includes('貼り付け'));

  // --- 4. 正常系(テキスト会話) ---
  await page.fill('#conversation', '自分: テストやで\n相手: いいね〜');
  mock = () => ({ status: 200, body: replyResult('1') });
  await page.click('#generate');
  await page.waitForSelector('#replyResults .card');
  const cards = await page.$$('#replyResults .card');
  check('4a. 返信カード3枚表示', cards.length === 3, `count=${cards.length}`);
  check('4b. 脈あり度72%表示', (await page.textContent('#meterPct')) === '72%');
  check('4c. アドバイス表示', (await page.textContent('#replyAdvice')).includes('アドバイス1'));
  check('4d. 再生成ボタン出現', await page.isVisible('#regenerate'));
  check('4e. リクエスト: model正しい', lastBody.model === 'claude-opus-5');
  check('4f. リクエスト: 構造化出力指定', lastBody.output_config?.format?.type === 'json_schema');
  check('4g. リクエスト: 会話が含まれる', JSON.stringify(lastBody.messages).includes('テストやで'));
  check('4h. エラー欄が空', (await page.textContent('#error')) === '');

  // --- 5. 再生成: 既出案が渡るか ---
  mock = () => ({ status: 200, body: replyResult('2') });
  await page.click('#regenerate');
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイス2'));
  const msgStr = JSON.stringify(lastBody.messages);
  check('5a. 再生成: 既出案リスト送信', msgStr.includes('既に提示済みの案') && msgStr.includes('返信案A-1'));

  // --- 6. 文体サンプルがプロンプトに入るか ---
  await page.click('#tabReply summary');
  check('6a. 詳細設定がsummaryクリックで開く', await page.isVisible('#styleSample'));
  await page.fill('#styleSample', 'おつかれ〜今日どうだった');
  mock = () => ({ status: 200, body: replyResult('3') });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイス3'));
  check('6b. 文体サンプル送信', JSON.stringify(lastBody.messages).includes('おつかれ〜今日どうだった'));

  // --- 7. APIエラー(401) ---
  mock = () => ({ status: 401, body: { error: { type: 'authentication_error', message: 'invalid x-api-key' } } });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#error').textContent.length > 0);
  check('7a. 401→エラー表示', (await page.textContent('#error')).includes('invalid x-api-key'));
  check('7b. 401後ボタン復活', !(await page.isDisabled('#generate')));

  // --- 8. refusal ---
  mock = () => ({ status: 200, body: { stop_reason: 'refusal', content: [] } });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#error').textContent.includes('回答'));
  check('8. refusal→丁寧なエラー', (await page.textContent('#error')).includes('回答できませんでした'));

  // --- 9. max_tokens途中切断(壊れたJSON) ---
  mock = () => ({ status: 200, body: { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"situation":"途中で切れ' }] } });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#error').textContent.length > 0);
  check('9. 途中切断→分かるエラー文言', (await page.textContent('#error')).includes('長すぎ') || (await page.textContent('#error')).includes('もう一度'),
        await page.textContent('#error'));

  // --- 10. 画像アップロード ---
  const png = { name: 's.png', mimeType: 'image/png', buffer: PNG_1x1 };
  await page.setInputFiles('#convFile', [png]);
  await page.waitForSelector('#convThumbs .thumb');
  check('10a. サムネイル表示', (await page.$$('#convThumbs .thumb')).length === 1);
  // 7枚追加 → 上限エラー
  await page.setInputFiles('#convFile', Array(7).fill(png));
  await page.waitForTimeout(500);
  check('10b. 6枚上限で停止+エラー', (await page.$$('#convThumbs .thumb')).length === 6 &&
        (await page.textContent('#error')).includes('6枚'));
  // 削除
  await page.click('#convThumbs .thumb .del');
  check('10c. サムネ削除できる', (await page.$$('#convThumbs .thumb')).length === 5);
  // 画像つき送信
  mock = () => ({ status: 200, body: replyResult('4') });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイス4'));
  const imgBlocks = lastBody.messages[0].content.filter(b => b.type === 'image');
  check('10d. 画像ブロック送信(5枚)', imgBlocks.length === 5, `count=${imgBlocks.length}`);
  check('10e. 画像はJPEGに変換済み', imgBlocks.every(b => b.source.media_type === 'image/jpeg'));

  // --- 11. 壊れた画像ファイル ---
  const before = pageErrors.length + consoleErrors.length;
  await page.setInputFiles('#convFile', [{ name: 'evil.png', mimeType: 'image/png', buffer: Buffer.from('this is not an image at all') }]);
  await page.waitForTimeout(800);
  const errText = await page.textContent('#error');
  check('11. 壊れた画像→ユーザーに見えるエラー(黙って失敗しない)', errText.includes('読み込め'), `error="${errText}" uncaught=${pageErrors.length + consoleErrors.length - before}`);

  // --- 12. XSS: AI応答に悪意あるHTML ---
  mock = () => ({ status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({
    situation: '<img src=x onerror="window.__xss=1">', interest_level: 50,
    replies: [{ bubbles: ['<script>window.__xss=2<\/script>案'], why: '<b onclick=1>理由' }, { bubbles: ['a'], why: 'b' }, { bubbles: ['c'], why: 'd' }],
    advice: '<svg onload="window.__xss=3">' }) }] } });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#situation').textContent.includes('img'));
  await page.waitForTimeout(300);
  const xss = await page.evaluate(() => window.__xss);
  check('12. XSS耐性(HTMLがそのまま文字として表示)', xss === undefined, `__xss=${xss}`);

  // --- 13. プロフィールタブ ---
  await page.click('#tabBtnProfile');
  check('13a. タブ切替でプロフ画面表示', await page.isVisible('#profGenerate') && !(await page.isVisible('#generate')));
  await page.click('#profGenerate');
  check('13b. 入力なし診断→エラー', (await page.textContent('#error')).length > 0);
  await page.click('label[for="pm2"]'); // ゼロから作成
  await page.click('#profGenerate');
  check('13c. 基本情報なし→エラー', (await page.textContent('#error')).includes('基本情報'));
  await page.fill('#basicInfo', '29歳 会社員 サウナ好き');
  mock = () => ({ status: 200, body: profileResult() });
  await page.click('#profGenerate');
  await page.waitForSelector('#profResults .card');
  check('13d. 得点表示', (await page.textContent('#profMeterPct')) === '68点');
  check('13e. 強み/弱みリスト', (await page.$$('#profStrengths li')).length === 2 && (await page.$$('#profWeaknesses li')).length === 3);
  check('13f. bio改善案2枚', (await page.$$('#profResults .card')).length === 2);
  check('13g. 写真アドバイス表示', (await page.textContent('#profPhotoAdvice')).includes('写真アドバイステスト'));
  check('13h. プロフ用プロンプト送信', JSON.stringify(lastBody.system).includes('プロフィール'));
  check('13i. システムプロンプトにキャッシュ指定', Array.isArray(lastBody.system) && lastBody.system[0].cache_control?.type === 'ephemeral');

  // --- 16. サンプル会話ローダー ---
  await page.click('#tabBtnReply');
  const optCount = await page.$$eval('#sampleSelect option', o => o.length);
  check('16a. サンプル8件が選択肢に出る', optCount === 9, `options=${optCount}`);
  await page.selectOption('#sampleSelect', '1'); // ②カフェ・デートに誘う
  check('16b. 会話が自動入力', (await page.inputValue('#conversation')).includes('中目黒'));
  check('16c. プロフィールが自動入力', (await page.inputValue('#partnerProfile')).includes('看護師'));
  check('16d. 文体サンプルが自動入力', (await page.inputValue('#styleSample')).length > 0);
  check('16e. ゴールが「デートに誘う」に切替', await page.isChecked('#g2'));
  await page.selectOption('#sampleSelect', '3'); // ④初回メッセージ(会話空)
  check('16f. 初回メッセ例は会話欄が空+ゴール初回', (await page.inputValue('#conversation')) === '' && await page.isChecked('#g4'));
  mock = () => ({ status: 200, body: replyResult('S') });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイスS'));
  check('16g. 会話空でも文体サンプル+プロフで生成できる', JSON.stringify(lastBody.messages).includes('ラーメンなら任せて'));

  // --- 17. 吹き出し分割・採用学習・新ゴール ---
  const optCount2 = await page.$$eval('#sampleSelect option', o => o.length);
  check('17a. サンプル8件に増加', optCount2 === 9, `options=${optCount2}`);
  check('17b. 新ゴール(日程調整/前日/お礼/LINE交換)が存在', await page.$('#g5') && await page.$('#g6') && await page.$('#g7') && await page.$('#g8'));
  check('17b2. 指示書に実データ既定値セクション', JSON.stringify(lastBody.system).includes('本物の文体'));
  await page.evaluate(() => localStorage.removeItem('reply_ai_adopted'));
  await page.reload();
  await page.waitForSelector('#generate');
  await page.fill('#conversation', '自分: テストやで\n相手: いいね〜');
  await page.selectOption('#sampleSelect', '5'); // ⑥日程調整
  check('17c. サンプル⑥でゴール日程調整に切替', await page.isChecked('#g5'));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  mock = () => ({ status: 200, body: replyResult('B') });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイスB'));
  const bubbleCounts = await page.$$eval('#replyResults .card', cs => cs.map(c => c.querySelectorAll('.bubble').length));
  check('17d. 案Aは2吹き出し・B/Cは1吹き出しで描画', JSON.stringify(bubbleCounts) === '[2,1,1]', JSON.stringify(bubbleCounts));
  check('17e. 2通案には「2通に分けて送る」表示', (await page.textContent('#replyResults .card .num')).includes('2通'));
  check('17f. 送信スキーマがbubbles', JSON.stringify(lastBody.output_config.format.schema).includes('"bubbles"'));
  check('17g. 採用履歴0件のときプロンプトに含まれない', !JSON.stringify(lastBody.messages).includes('過去に採用した返信'));
  // 案Bのコピー → 採用履歴に入る
  const copyBtns = await page.$$('#replyResults .card > button');
  await copyBtns[1].click();
  await page.waitForTimeout(200);
  const adopted = await page.evaluate(() => JSON.parse(localStorage.getItem('reply_ai_adopted') || '[]'));
  check('17h. コピーで採用履歴に保存', adopted.length === 1 && adopted[0] === '返信案B-B', JSON.stringify(adopted));
  await openDetails();
  check('17i. 採用履歴の件数表示', (await page.textContent('#adoptedNote')).includes('1件'));
  // 次の生成でプロンプトに載る
  mock = () => ({ status: 200, body: replyResult('C') });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイスC'));
  check('17j. 次回生成のプロンプトに採用履歴が載る', JSON.stringify(lastBody.messages).includes('過去に採用した返信') && JSON.stringify(lastBody.messages).includes('返信案B-B'));
  // 再生成の既出案は吹き出しを結合した文字列
  mock = () => ({ status: 200, body: replyResult('D') });
  await page.click('#regenerate');
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイスD'));
  check('17k. 既出案は吹き出し結合で送信', JSON.stringify(lastBody.messages).includes('二通目A-C'));
  // クリア
  await openDetails();
  await page.click('#adoptedNote button');
  const cleared = await page.evaluate(() => localStorage.getItem('reply_ai_adopted'));
  check('17l. 採用履歴クリアできる', cleared === null);
  // 旧形式(text)の応答でも壊れない(後方互換)
  mock = () => ({ status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ situation: 's', interest_level: 40,
    replies: [{ text: '旧形式1', why: 'w' }, { text: '旧形式2', why: 'w' }, { text: '旧形式3', why: 'w' }], advice: 'アドバイスOLD' }) }] } });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイスOLD'));
  check('17m. 旧形式(text)応答でも3案描画', (await page.$$('#replyResults .card')).length === 3 && (await page.textContent('#replyResults')).includes('旧形式1'));
  // 4案以上返っても3案に丸める(「3案」という約束を壊さない)
  mock = () => ({ status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ situation: 's', interest_level: 40,
    replies: [1,2,3,4,5].map(n => ({ bubbles: [`多すぎ${n}`], why: 'w' })), advice: 'アドバイスOVER' }) }] } });
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイスOVER'));
  check('17n. 4案以上でも3案までに丸める', (await page.$$('#replyResults .card')).length === 3, String((await page.$$('#replyResults .card')).length));

  // --- 18. PWA(アプリとして入る) ---
  const man = await page.request.get(new URL('manifest.webmanifest', BASE).href);
  const manJson = man.ok() ? await man.json() : {};
  check('18a. manifest配信', man.ok() && manJson.display === 'standalone' && manJson.start_url === '/reply-ai/', JSON.stringify(manJson).slice(0, 120));
  check('18b. manifestにmaskableアイコン', (manJson.icons || []).some(i => i.purpose === 'maskable'));
  check('18c. Service Worker配信', (await page.request.get(new URL('sw.js', BASE).href)).ok());
  check('18d. アイコン画像配信', (await page.request.get(new URL('icons/icon-512.png', BASE).href)).ok()
        && (await page.request.get(new URL('icons/apple-touch-icon.png', BASE).href)).ok());
  check('18e. manifestとapple-touch-iconがHTMLから参照', await page.$('link[rel=manifest]') !== null && await page.$('link[rel=apple-touch-icon]') !== null);
  check('18f. theme-color指定', (await page.$$('meta[name=theme-color]')).length >= 1);

  // --- 19. UIの品質(見た目・状態・アクセシビリティ) ---
  const uiText = await page.$$eval('header, [role=tablist], button, label, summary, h2, h3', els => els.map(e => e.textContent).join(' '));
  const emoji = uiText.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}]/gu);
  check('19a. UIの文言に絵文字を使っていない', emoji === null, `found=${emoji && emoji.join('')}`);
  check('19b. タブのaria-selectedが正しい', (await page.getAttribute('#tabBtnReply', 'aria-selected')) === 'true'
        && (await page.getAttribute('#tabBtnProfile', 'aria-selected')) === 'false');
  // 生成中の段階表示とスケルトン
  delayMs = 900;
  mock = () => ({ status: 200, body: replyResult('T') });
  const pending = page.click('#generate');
  await page.waitForTimeout(350);
  const btnText = await page.textContent('#generate');
  check('19c. 生成中はボタンが進行状況を出す', btnText.includes('読み取') || btnText.includes('分析') || btnText.includes('作って'), btnText);
  check('19d. 生成中は前回結果を隠す', !(await page.isVisible('#replyResults')));
  check('19e. 生成中はボタンが無効', await page.isDisabled('#generate'));
  await pending;
  await page.waitForFunction(() => document.querySelector('#replyAdvice').textContent.includes('アドバイスT'));
  delayMs = 0;
  check('19f. 完了後に結果が戻る', await page.isVisible('#replyResults'));
  // コピーでトースト
  const copyBtn = (await page.$$('#replyResults .card > button'))[0];
  await copyBtn.click();
  await page.waitForTimeout(150);
  check('19g. コピーでトースト表示', await page.isVisible('#toast') && (await page.textContent('#toast')).includes('コピー'));
  // 設定シートはEscで閉じる
  await page.click('#btnSettings');
  await page.waitForSelector('#apiKey');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#apiKey', { state: 'detached' });
  check('19h. 設定シートはEscで閉じる', !(await page.isVisible('#apiKey')));
  // 商標・免責の注記
  await page.click('#btnSettings');
  await page.waitForSelector('#apiKey');
  const sheetText = await page.textContent('[role=dialog]');
  check('19i. 商標注記と方針の明記', sheetText.includes('LINEヤフー') && sheetText.includes('自動送信はしない'));
  await page.keyboard.press('Escape');
  await page.waitForSelector('#apiKey', { state: 'detached' });
  // ダークモード
  await page.emulateMedia({ colorScheme: 'dark' });
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const darkLum = (darkBg.match(/\d+/g) || [255, 255, 255]).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3;
  check('19j. ダークモードで背景が暗い', darkLum < 70, darkBg);
  await page.emulateMedia({ colorScheme: 'light' });
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const lightLum = (lightBg.match(/\d+/g) || [0, 0, 0]).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3;
  check('19k. ライトモードで背景が明るい', lightLum > 200, lightBg);

  // --- 14. localStorage永続化 ---
  await page.reload();
  await page.waitForSelector('#generate');
  await page.click('#btnSettings');
  await page.waitForSelector('#apiKey');
  check('14. リロード後もキー復元', (await page.inputValue('#apiKey')) === 'sk-ant-test-123');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#apiKey', { state: 'detached' });

  // --- 15. ネットワーク断 ---
  await page.unroute('https://api.anthropic.com/**');
  await page.route('https://api.anthropic.com/**', route => route.abort('internetdisconnected'));
  await page.fill('#conversation', '自分: a\n相手: b');
  await page.click('#generate');
  await page.waitForFunction(() => document.querySelector('#error').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
  check('15. ネットワーク断→エラー表示+ボタン復活', (await page.textContent('#error')).length > 0 && !(await page.isDisabled('#generate')),
        await page.textContent('#error'));

  check('X. コンソールエラーなし(想定内のfetch失敗以外)', consoleErrors.filter(e => !e.includes('Failed to load resource') && !e.includes('ERR_INTERNET')).length === 0,
        consoleErrors.join(' | '));
  check('Y. 未捕捉例外なし', pageErrors.length === 0, pageErrors.join(' | '));

  await browser.close();
  let failed = 0;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '   [' + r.extra + ']'}`);
    if (!r.pass) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(2); });
