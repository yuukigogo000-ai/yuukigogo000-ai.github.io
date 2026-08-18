// カラダ日報 スモークテスト
//   node health/tests/smoke.mjs            通常実行
//   node health/tests/smoke.mjs --mutate   自己検査(判定基準をわざと壊して RED になるか確かめる)
//
// 目的: 「テストが緑」を信用する前に、テストが本当に落ちることを確かめる(変異注入)。
// 依存: playwright(AI_WORKSPACE/ui_toolkit/uicheck/node_modules に入っている)

// playwright は共通ツール(ui_toolkit/uicheck)のものを借りる。場所は PW_DIR で上書きできる
const PW_CANDIDATES = [
  process.env.PW_DIR,
  'C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/node_modules/playwright/index.mjs',
  '../../../ui_toolkit/uicheck/node_modules/playwright/index.mjs',
  'playwright'
].filter(Boolean);
let chromium = null, pwErr = null;
for (const c of PW_CANDIDATES) {
  try { ({ chromium } = await import(c.startsWith('.') ? c : (c === 'playwright' ? c : 'file:///' + c))); break; }
  catch (e) { pwErr = e; }
}
if (!chromium) { console.error('playwright が見つかりません。PW_DIR に playwright/index.mjs のパスを指定してください: ' + pwErr); process.exit(2); }
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');          // リポジトリのルート
const FILE = path.join(ROOT, 'health', 'index.html');
const MUTATE = process.argv.includes('--mutate');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

// ---- 変異注入: 判定のしきい値を1つ壊す ----
const original = fs.readFileSync(FILE, 'utf8');
if (MUTATE) {
  const mutated = original.replace('if (w.waist < 85) return', 'if (w.waist < 95) return');
  if (mutated === original) { console.error('変異を注入できません(対象の行が見つからない)'); process.exit(2); }
  fs.writeFileSync(FILE, mutated);
  console.log('== 変異注入モード: メタボ判定の 85cm を 95cm に壊した ==');
}

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, rel.endsWith('/') ? rel + 'index.html' : rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(f);
  res.writeHead(200, { 'content-type': ext === '.html' ? 'text/html; charset=utf-8' : 'text/plain' });
  res.end(fs.readFileSync(f));
});

const seedDay = (over) => ({
  date: over.date, weight: null, waist: null, sys: null, dia: null,
  steps: null, sleep: null, alc: null, memo: null, ...over
});
const iso = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

await new Promise(r => server.listen(0, r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const consoleErrors = [],外部 = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
page.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:')) 外部.push(u); });

async function seed(records, settings = {}, checkups = []) {
  await page.goto(base + '/health/');
  await page.evaluate(([r, s, c]) => {
    localStorage.setItem('ojisan_health_records', JSON.stringify(r));
    localStorage.setItem('ojisan_health_settings', JSON.stringify(s));
    localStorage.setItem('ojisan_health_checkups', JSON.stringify(c));
  }, [records, settings, checkups]);
  await page.reload();
  await page.waitForSelector('#status .card');
}
const statusText = () => page.textContent('#status');

console.log('\n== 1. 空の状態 ==');
await seed([]);
ok('空でも描画され、未記録と出る', (await statusText()).includes('未記録'));
ok('継続0日/見習い', (await statusText()).includes('見習い'));

console.log('\n== 2. 晩酌カウンター ==');
await page.click('[data-drink="b500"]');
await page.click('[data-drink="b500"]');
await page.click('[data-drink="high"]');
let sum = await page.textContent('#drinkSum');
ok('ビール2+ハイボール1 = 3杯 / 54g', sum.includes('3杯') && sum.includes('54g'), sum.trim());
ok('タップ済みボタンに ×2 バッジ', (await page.textContent('[data-drink="b500"]')).includes('×2'));
await page.reload(); await page.waitForSelector('#drinkSum');
ok('リロード後も残る', (await page.textContent('#drinkSum')).includes('54g'));
await page.click('#btnDry');
ok('休肝日で確定 → 休肝日表示', (await page.textContent('#drinkSum')).includes('休肝日'));
ok('ボタンが取り消しに変わる', (await page.textContent('#btnDry')).includes('取り消す'));
await page.click('#btnDry');
ok('取り消すと未記録に戻る', (await page.textContent('#drinkSum')).includes('未記録'));

console.log('\n== 3. 保存(同日マージ) ==');
await seed([]);
await page.fill('#fWeight', '77.2'); await page.fill('#fWaist', '86.5');
await page.fill('#fSys', '132'); await page.fill('#fDia', '86');
await page.click('#btnSave');
ok('保存メッセージ', (await page.textContent('#savedMsg')).includes('保存しました'));
let st = await statusText();
ok('体重タイルが更新', st.includes('77.2'));
await page.fill('#fSteps', '8000');
await page.click('#btnSave');
st = await statusText();
ok('同日再保存で空欄は既存値を温存(体重が消えない)', st.includes('77.2'));

console.log('\n== 4. メタボ判定(特定健診・男性) ==');
await seed([seedDay({ date: iso(0), waist: 86.5, sys: 132, dia: 86 })]);
ok('腹囲86.5+血圧132/86 → メタボ予備群', (await statusText()).includes('メタボ予備群'), (await statusText()).match(/メタボ\S*/)?.[0]);
await seed([seedDay({ date: iso(0), waist: 84.0, sys: 132, dia: 86 })]);
ok('腹囲84 → セーフ', (await statusText()).includes('セーフ'));
await seed([seedDay({ date: iso(0), waist: 90, sys: 135, dia: 88 })],
           {}, [{ date: '2026-06-01', tg: 180, glu: 115 }]);
ok('腹囲90+血圧+脂質+血糖 → メタボ該当', (await statusText()).includes('メタボ該当'));

console.log('\n== 5. 血圧の区分(JSH2019) ==');
for (const [sys, dia, want] of [[118,76,'正常'],[138,88,'高値血圧'],[145,92,'I度高血圧'],[165,100,'II度高血圧']]) {
  await seed([seedDay({ date: iso(0), sys, dia })]);
  ok(`${sys}/${dia} → ${want}`, (await statusText()).includes(want));
}

console.log('\n== 6. 健診の判定 ==');
await seed([], {}, [
  { date: '2025-06-01', ggt: 82, ua: 6.8, hba1c: 5.6, hdl: 45 },
  { date: '2026-06-01', ggt: 68, ua: 7.3, hba1c: 5.7, hdl: 45, ldl: 130 }
]);
const chk = await page.textContent('#checkup');
ok('γ-GTP 68←82 → 改善', chk.includes('改善'));
ok('尿酸 7.3←6.8 → 注意', chk.includes('注意'));
ok('HbA1c 5.7←5.6 → 経過観察', chk.includes('経過観察'));
await seed([], {}, [{ date: '2026-06-01', ggt: 130, hdl: 45 }]);
const chk2 = await page.textContent('#checkup');
ok('γ-GTP 130(前回なし) → 要相談', chk2.includes('要相談'));
ok('HDL 45(前回なし) → 基準内', chk2.includes('基準内'));

console.log('\n== 7. 週の純アルコール ==');
await seed([0,1,2,3,4,5,6].map(i => seedDay({ date: iso(i), alc: { b500: 1 } })));   // 20g×7=140
ok('週140g ちょうど → 適量圏内', (await statusText()).includes('適量圏内'));
await seed([0,1,2,3,4,5,6].map(i => seedDay({ date: iso(i), alc: { b500: 2 } })));   // 280g
ok('週280g → 適量超え', (await statusText()).includes('適量超え'));

console.log('\n== 8. 旧データ互換 ==');
await seed([{ date: iso(0), weight: 77, drinks: 2 }]);
ok('alc 無し・drinks:2 は 40g として集計', (await statusText()).includes('40'));

console.log('\n== 9. 記録継続と役職 ==');
await seed([0,1,2].map(i => seedDay({ date: iso(i), weight: 77 })));
ok('3日連続 → 平社員', (await statusText()).includes('平社員'));
await seed(Array.from({ length: 30 }, (_, i) => seedDay({ date: iso(i), weight: 77 })));
ok('30日連続 → 課長', (await statusText()).includes('課長'));

console.log('\n== 10. 外殻(下タブ・ドロワー・お知らせ) ==');
await page.click('.tab[data-go="sec-checkup"]');
// なめらかスクロールが終わるまで待つ(途中経過で判定しない)
let tabMoved = true;
try {
  await page.waitForFunction(
    () => document.querySelector('.tab[data-go="sec-checkup"]').getAttribute('aria-current') === 'true',
    null, { timeout: 4000 });
} catch { tabMoved = false; }
ok('下タブ「健診」でアクティブが移る', tabMoved);
await page.click('#btnMenu');
ok('ハンバーガーで設定ドロワーが開く', await page.isVisible('#drawer'));
await page.click('#scrim', { position: { x: 370, y: 400 } });   // ドロワーの外側(実際に指が届く場所)
ok('スクリムで閉じる', !(await page.isVisible('#drawer')));
await seed([seedDay({ date: iso(0), weight: 77 })], { checkupDate: iso(-20) });
ok('健診20日後 → ベルに赤ドット', await page.isVisible('#bellDot'));
await page.click('#btnBell');
ok('お知らせに健診カウントダウン', (await page.textContent('#bellPanel')).includes('健康診断まで'));

console.log('\n== 11. CSV 往復 ==');
await seed([seedDay({ date: iso(1), weight: 77.5, waist: 88, sys: 130, dia: 84, steps: 6000, alc: { b500: 2 } }),
            seedDay({ date: iso(0), weight: 77.1, alc: {} })]);
await page.click('#btnMenu');
const dl = await Promise.all([page.waitForEvent('download'), page.click('#btnCsvDay')]).then(a => a[0]);
const csvPath = path.join(os.tmpdir(), 'karada_test.csv');
await dl.saveAs(csvPath);
const csvText = fs.readFileSync(csvPath, 'utf8');
ok('CSVに2行ぶん出る', csvText.trim().split('\n').length === 3, JSON.stringify(csvText.slice(0, 80)));
ok('休肝日は alc_g 0 で出る', /,0,0,/.test(csvText) || csvText.includes(',0,0,'));
await seed([]);
await page.click('#btnMenu');
page.once('dialog', d => d.accept());
await page.setInputFiles('#fileImport', csvPath);
await page.waitForTimeout(400);
ok('インポートで件数が戻る', (await page.textContent('#status')).includes('77.1'));

console.log('\n== 12. 通信と例外 ==');
ok('console エラーゼロ', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' / '));
ok('外部への通信ゼロ', 外部.length === 0, 外部.slice(0, 2).join(' / '));

await browser.close();
server.close();
if (MUTATE) fs.writeFileSync(FILE, original);

console.log(`\n=== ${pass} passed / ${fail} failed ===`);
if (MUTATE) {
  if (fail > 0) { console.log('MUTATION SELF-TEST OK: 仕込んだ欠陥をテストが検出した(' + failures[0] + ')'); process.exit(0); }
  console.log('MUTATION SELF-TEST FAILED: 判定を壊してもテストが緑のまま。テストが機能していない'); process.exit(2);
}
if (fail > 0) { console.log('失敗:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
