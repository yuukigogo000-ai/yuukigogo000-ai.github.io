/* 破壊的検証スイート: expectation-explorer.html
   回し方(Playwright は ui_toolkit/uicheck に入っているものを借りる):
     cd <repo> && NODE_PATH=C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/node_modules node tests/destructive.mjs
   目的: 計算コアの数値・XSS・壊れた保存データ・極端値・状態遷移が壊れていないことを毎回機械で確かめる。
   UI を作り変えても「JS が結線する ID とロジック」は不変(UI_PLAYBOOK §1)なので、このスイートはそのまま通るはず。 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Playwright は共通ツール(ui_toolkit/uicheck)のものを借りる。PW_DIR で差し替え可。
const PW_DIR = process.env.PW_DIR || 'C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/';
const { chromium } = createRequire(pathToFileURL(PW_DIR.replace(/\/?$/, '/')).href)('playwright');

const URL = pathToFileURL(path.resolve('expectation-explorer.html')).href;
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('  OK  ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  NG  ' + name + '  ' + detail); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

async function freshPage(preScript) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.addInitScript(`
    if (!sessionStorage.getItem('__t')) { localStorage.clear(); sessionStorage.setItem('__t','1');
      ${preScript || ''} }`);
  await page.goto(URL);
  await page.waitForTimeout(150);
  return { page, errors };
}

/* ========== 1. 計算コアの数値検証 ========== */
console.log('\n[1] 計算コアの数値検証');
{
  const { page, errors } = await freshPage();
  const r = await page.evaluate(() => {
    const res = {};
    res.annuity10 = annuity(10, 0.03);
    res.annuity0r = annuity(10, 0);
    res.annuityNeg = annuity(-5, 0.03);
    const opt = { initialCost: 0, monthlyCost: 0, monthlyHours: 10, effortYears: 0.5,
      scenarios: [{prob:20,effect:-50,years:10},{prob:50,effect:50,years:10},{prob:30,effect:150,years:10}] };
    const prof = { lumpSumMax:100, monthlyBudget:3, monthlyHours:30, activeYears:30, maxLoss:200, discountRate:3, parallelMax:2 };
    const m = calc(opt, prof);
    res.ev = m.ev; res.worst = m.worst; res.breakeven = m.breakeven; res.verdict = m.verdict;
    const m2 = calc({ ...opt, scenarios: [{prob:100,effect:-50,years:10},{prob:0,effect:50,years:10},{prob:0,effect:150,years:10}] }, prof);
    res.allPessEv = m2.ev; res.allPessVerdict = m2.verdict;
    res.bePos = calc({ ...opt, scenarios: [{prob:20,effect:10,years:10},{prob:50,effect:50,years:10},{prob:30,effect:150,years:10}] }, prof).breakeven;
    res.beNeg = calc({ ...opt, initialCost: 500, scenarios: [{prob:20,effect:-50,years:10},{prob:50,effect:-20,years:10},{prob:30,effect:-10,years:10}] }, prof).breakeven;
    res.perHourNull = calc({ ...opt, monthlyHours: 0 }, prof).perHour;
    return res;
  });
  check('annuity(10,3%) ≈ 8.5302', Math.abs(r.annuity10 - 8.530203) < 1e-4, String(r.annuity10));
  check('annuity(10,0%) = 10', r.annuity0r === 10);
  check('annuity(負の年数) = 0', r.annuityNeg === 0);
  check('転職サンプル EV ≈ +512万', Math.abs(r.ev - 511.8) < 1.0, String(r.ev));
  check('worst ≈ −427万', Math.abs(r.worst + 426.5) < 1.0, String(r.worst));
  check('breakeven ≈ 25%', Math.abs(r.breakeven - 0.25) < 0.005, String(r.breakeven));
  check('EV≤0 なら見送り', r.allPessEv < 0 && r.allPessVerdict === '見送り');
  check('全シナリオ正 → breakeven 0', r.bePos === 0);
  check('全シナリオ負 → breakeven 1', r.beNeg === 1);
  check('時間0 → perHour は null', r.perHourNull === null);
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 2. XSS: フォーム経由 ========== */
console.log('\n[2] XSS（フォーム経由）');
{
  const { page, errors } = await freshPage();
  const payload = `<img src=x onerror="window.__xss=1"><script>window.__xss=2<\/script>"'><svg onload=window.__xss=3>`;
  await page.click('nav button[data-tab="editor"]');
  await page.fill('#o-name', payload);
  await page.fill('#o-note', payload);
  await page.click('#saveOption');
  await page.waitForTimeout(200);
  await page.click('nav button[data-tab="overview"]');
  await page.waitForTimeout(300);
  await page.hover('#scatter g.pt').catch(() => {});
  await page.waitForTimeout(200);
  const xss = await page.evaluate(() => window.__xss);
  const imgCount = await page.evaluate(() => document.querySelectorAll('img').length);
  check('XSSが発火しない', xss === undefined, 'window.__xss=' + xss);
  check('imgタグが注入されない', imgCount === 0, String(imgCount));
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 3. 壊れた localStorage ========== */
console.log('\n[3] 壊れた localStorage からの復帰');
const badStores = [
  ['不正JSON', '{', '{'],
  ['配列でないoptions', '{"a":1}', '{"broken":true}'],
  ['scenarios欠損', '{}', '[{"id":"x1","name":"欠損"}]'],
  ['scenariosが文字列', '{}', '[{"id":"x2","name":"型不正","scenarios":"abc"}]'],
  ['数値が文字列/NaN', '{"lumpSumMax":"abc","discountRate":null,"activeYears":-5}',
    '[{"id":"x3","name":"NaN値","initialCost":"xyz","effortYears":1e999,"scenarios":[{"prob":"a","effect":null,"years":{}},{"prob":50,"effect":30,"years":10},{"prob":50,"effect":100,"years":"z"}]}]'],
  ['idに属性突破文字列', '{}', '[{"id":"\\" onmouseover=\\"window.__xss=9","name":"id注入","scenarios":[{"prob":30,"effect":0,"years":5},{"prob":50,"effect":10,"years":5},{"prob":20,"effect":50,"years":5}]}]'],
];
for (const [label, prof, opts] of badStores) {
  const { page, errors } = await freshPage(
    `localStorage.setItem('ee_profile_v1', ${JSON.stringify(prof)});
     localStorage.setItem('ee_options_v1', ${JSON.stringify(opts)});`);
  await page.click('nav button[data-tab="overview"]');
  await page.waitForTimeout(250);
  await page.click('nav button[data-tab="sense"]');
  await page.waitForTimeout(250);
  await page.click('nav button[data-tab="profile"]');
  await page.waitForTimeout(200);
  const xss = await page.evaluate(() => window.__xss);
  const tiles = await page.evaluate(() => document.querySelectorAll('.tile').length);
  check(`${label}: クラッシュせず描画`, errors.length === 0 && tiles === 3, errors.join(' | ') + ' tiles=' + tiles);
  if (label === 'idに属性突破文字列') check('id注入が無効化される', xss === undefined, 'window.__xss=' + xss);
  await page.close();
}

/* ========== 4. 極端な入力値 ========== */
console.log('\n[4] 極端な入力値');
{
  const { page, errors } = await freshPage();
  await page.click('nav button[data-tab="editor"]');
  await page.fill('#o-name', '極端テスト');
  await page.fill('#o-initialCost', '-100');
  await page.fill('#o-monthlyCost', '1e15');
  await page.fill('#o-effortYears', '9999');
  await page.fill('#s0-effect', '-1e15');
  await page.fill('#s2-effect', '1e15');
  await page.fill('#s0-years', '0');
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const o = readEditor(); const m = calc(o, profile);
    return { initialCost: o.initialCost, monthlyCost: o.monthlyCost, effortYears: o.effortYears,
             e0: o.scenarios[0].effect, e2: o.scenarios[2].effect,
             evFinite: isFinite(m.ev), evText: document.getElementById('e-ev').textContent };
  });
  check('負の初期コストは0にクランプ', r.initialCost === 0, String(r.initialCost));
  check('月コストは上限1e9にクランプ', r.monthlyCost === 1e9, String(r.monthlyCost));
  check('投入期間は200年にクランプ', r.effortYears === 200, String(r.effortYears));
  check('効果額は±1e9にクランプ', r.e0 === -1e9 && r.e2 === 1e9, `${r.e0}, ${r.e2}`);
  check('EVが有限値', r.evFinite);
  check('表示にNaN/Infinityが出ない', !/NaN|Infinity/.test(r.evText), r.evText);
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 5. 確率の浮動小数点と合計チェック ========== */
console.log('\n[5] 確率まわり');
{
  const { page, errors } = await freshPage();
  await page.click('nav button[data-tab="editor"]');
  await page.fill('#o-name', '33.3テスト');
  await page.fill('#s0-prob', '33.3');
  await page.fill('#s1-prob', '33.3');
  await page.fill('#s2-prob', '33.4');
  await page.click('#saveOption');
  await page.waitForTimeout(200);
  check('33.3+33.3+33.4 が保存できる', await page.evaluate(() => options.length) === 1);
  await page.fill('#o-name', '合計90');
  await page.fill('#s2-prob', '23.4');
  await page.click('#saveOption');
  await page.waitForTimeout(200);
  check('合計≠100% は保存ブロック', await page.evaluate(() => options.length) === 1);
  check('警告文が出る', (await page.textContent('#probWarn')).includes('100%'));
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 6. 感度スライダーのクランプ ========== */
console.log('\n[6] 感度スライダー');
{
  const { page, errors } = await freshPage();
  await page.click('#loadSample');
  await page.waitForTimeout(250);
  await page.click('nav button[data-tab="sense"]');
  await page.waitForTimeout(250);
  await page.locator('#sl-p0').fill('100');
  await page.waitForTimeout(100);
  const r1 = await page.evaluate(() => Number(document.getElementById('sl-p0').value) + Number(document.getElementById('sl-p2').value));
  check('悲観100% → 合計が100%を超えない', r1 <= 100, String(r1));
  await page.locator('#sl-p2').fill('100');
  await page.waitForTimeout(100);
  const r2 = await page.evaluate(() => Number(document.getElementById('sl-p0').value) + Number(document.getElementById('sl-p2').value));
  check('楽観100% → 合計が100%を超えない', r2 <= 100, String(r2));
  await page.click('#applySense');
  await page.waitForTimeout(150);
  const probs = await page.evaluate(() => options.find(o => o.id === senseId).scenarios.map(s => s.prob));
  check('書き戻し後も合計100%', Math.abs(probs.reduce((a, b) => a + b, 0) - 100) < 0.01, JSON.stringify(probs));
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 6b.「もしも」チップ ========== */
console.log('\n[6b] もしもチップ');
{
  const { page, errors } = await freshPage();
  await page.click('#loadSample');
  await page.waitForTimeout(250);
  await page.click('nav button[data-tab="sense"]');
  await page.waitForTimeout(250);
  const n = await page.locator('#whatIfChips button').count();
  check('チップが5つある', n === 5, String(n));
  for (let i = 0; i < n; i++) {
    await page.locator('#whatIfChips button').nth(i).click();
    await page.waitForTimeout(80);
  }
  const s = await page.evaluate(() => ({
    p: Number(document.getElementById('sl-p0').value) + Number(document.getElementById('sl-p2').value),
    ev: document.getElementById('s-ev').textContent,
  }));
  check('全チップ適用後も確率合計が100%以内', s.p <= 100, String(s.p));
  check('期待値がNaNにならない', !/NaN|Infinity/.test(s.ev), s.ev);
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 7. 削除・空状態の遷移 ========== */
console.log('\n[7] 削除と空状態');
{
  const { page, errors } = await freshPage();
  await page.click('#loadSample');
  await page.waitForTimeout(250);
  const boxes = await page.locator('[data-combo]').count();
  for (let i = 0; i < boxes; i++) { await page.locator('[data-combo]').nth(i).click(); await page.waitForTimeout(60); }
  check('組合せに全件入る', await page.evaluate(() => comboChecked.size) === boxes, String(boxes));
  await page.click('nav button[data-tab="editor"]');
  await page.waitForTimeout(200);
  while (await page.locator('[data-del]').count() > 0) {
    await page.locator('[data-del]').first().click();
    await page.waitForTimeout(120);
  }
  await page.click('nav button[data-tab="overview"]');
  await page.waitForTimeout(250);
  await page.click('nav button[data-tab="sense"]');
  await page.waitForTimeout(250);
  const e = await page.evaluate(() => ({
    opts: options.length,
    senseEmpty: document.getElementById('senseEmpty').style.display !== 'none',
    table: document.getElementById('overviewTable').textContent.includes('まだありません'),
  }));
  check('全削除後、俯瞰は空状態表示', e.opts === 0 && e.table, JSON.stringify(e));
  check('全削除後、感度は空状態表示', e.senseEmpty);
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 8. 永続化ラウンドトリップ ========== */
console.log('\n[8] 永続化ラウンドトリップ');
{
  const { page, errors } = await freshPage();
  await page.click('#loadSample');
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => JSON.stringify(options));
  await page.reload();
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => JSON.stringify(options));
  check('リロード後もデータが同一', before === after);
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 9. 散布図の縮退ケース ========== */
console.log('\n[9] 散布図の縮退ケース');
{
  const { page, errors } = await freshPage(
    `localStorage.setItem('ee_options_v1', JSON.stringify([
      {id:'a1',name:'ゼロ点',scenarios:[{prob:100,effect:0,years:0},{prob:0,effect:0,years:0},{prob:0,effect:0,years:0}],initialCost:0,monthlyCost:0,monthlyHours:0,effortYears:0,domain:'その他',note:''},
      {id:'a2',name:'同一座標',scenarios:[{prob:100,effect:0,years:0},{prob:0,effect:0,years:0},{prob:0,effect:0,years:0}],initialCost:0,monthlyCost:0,monthlyHours:0,effortYears:0,domain:'その他',note:''}
    ]));`);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const svg = document.getElementById('scatter');
    return { points: svg.querySelectorAll('g.pt').length, bad: /NaN|Infinity/.test(svg.innerHTML) };
  });
  check('EV=0/最悪=0 の点が2つ描画される', r.points === 2, String(r.points));
  check('SVG属性にNaN/Infinityがない', !r.bad);
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 10. インポートの破壊ファイル ========== */
console.log('\n[10] 破壊的インポート');
{
  const { page, errors } = await freshPage();
  await page.click('nav button[data-tab="profile"]');
  await page.waitForTimeout(150);
  for (const [name, content] of [
    ['not-json.json', 'これはJSONではない{{{'],
    ['null.json', 'null'],
    ['array.json', '[1,2,3]'],
    ['nested-garbage.json', '{"profile":{"lumpSumMax":{"a":1}},"options":[null,42,"str",{"name":123,"scenarios":[null]}]}'],
  ]) {
    await page.setInputFiles('#importFile', { name, mimeType: 'application/json', buffer: Buffer.from(content) });
    await page.waitForTimeout(200);
  }
  const st = await page.evaluate(() => ({
    arr: Array.isArray(options),
    okProfile: typeof profile.lumpSumMax === 'number' && isFinite(profile.lumpSumMax),
    tiles: document.querySelectorAll('.tile').length,
  }));
  check('破壊ファイル連投後も状態が健全', st.arr && st.okProfile && st.tiles === 3, JSON.stringify(st));
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ========== 11. 状態再現フックが本物のデータを壊さない ========== */
console.log('\n[11] 状態再現フックの隔離');
{
  const { page, errors } = await freshPage();
  await page.click('#loadSample');
  await page.waitForTimeout(250);
  const real = await page.evaluate(() => localStorage.getItem('ee_options_v1'));
  await page.goto(URL + '?state=long');
  await page.waitForTimeout(300);
  const shown = await page.evaluate(() => options.length);
  const stored = await page.evaluate(() => localStorage.getItem('ee_options_v1'));
  check('state=long で8件表示される', shown === 8, String(shown));
  check('state 付きURLは保存を書き換えない', stored === real);
  await page.goto(URL);
  await page.waitForTimeout(250);
  check('通常URLに戻すと元データのまま', await page.evaluate(() => options.length) === 3);
  check('JSエラーなし', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
console.log(`\n===== 結果: ${pass} passed / ${fail} failed =====`);
if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
