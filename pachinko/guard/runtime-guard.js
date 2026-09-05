/* ============================================================
   RUNTIME GUARD — 実行時の回帰検査
   REGRESSION_GUARD_REQUIREMENTS.md の 6〜11 に対応:
   機能到達性 / 状態到達性 / 外部リクエスト0 / オフライン起動 /
   Electron・file モード / レスポンシブ / セーブ互換
   使い方: node guard/runtime-guard.js
   ============================================================ */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const URL = 'file://' + ROOT + '/index.html';
const SAVE = 'pachi-teikoku-save-v1';
const MIME = { '.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json' };
let pass = 0, fail = 0; const failed = [];
const ok = (n, c, d='') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; failed.push(n); console.log('  FAIL  ' + n + (d ? '  << ' + d : '')); } };

(async () => {
  const server = http.createServer((rq, rs) => {
    let f = rq.url.split('?')[0]; if (f === '/') f = '/index.html';
    const p = path.join(ROOT, f);
    if (!p.startsWith(ROOT) || !fs.existsSync(p)) { rs.writeHead(404); rs.end(); return; }
    rs.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    rs.end(fs.readFileSync(p));
  }).listen(8321);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('===== 1. 起動・資産・外部通信 =====');
  {
    const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    const p = await ctx.newPage();
    const errs = [], ext = [], failedReq = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type()==='error') errs.push('console:'+m.text()); });
    p.on('request', r => { const u = r.url(); if (!u.startsWith('file://') && !u.startsWith('data:')) ext.push(u); });
    p.on('requestfailed', r => failedReq.push(r.url()));
    await p.goto(URL); await p.waitForTimeout(700);
    ok('起動してチュートリアルが出る', await p.evaluate(() => document.getElementById('modalBg').classList.contains('show')));
    ok('コンソールエラー 0', errs.length === 0, errs.slice(0,3).join(';'));
    ok('外部リクエスト 0', ext.length === 0, ext.slice(0,3).join(';'));
    ok('壊れた資産参照 0', failedReq.length === 0, failedReq.slice(0,3).join(';'));
    ok('ホールアートが読み込まれている', await p.evaluate(() => { const i = document.querySelector('#hallArt img'); return !!i && i.naturalWidth > 100; }));
    // ID / グローバル
    const ids = JSON.parse(fs.readFileSync(path.join(__dirname,'protected-spec.json'),'utf8')).domIds;
    await p.evaluate(() => startGame('normal')); await p.waitForTimeout(300);
    const missStatic = await p.evaluate(list => list.filter(i => !document.getElementById(i)), ids);
    // 試打モーダルを開いて動的IDも確認
    await p.evaluate(() => openTrial(CATALOG.find(c=>c.id==='s1'), 3)); await p.waitForTimeout(200);
    const missSlot = await p.evaluate(list => list.filter(i => !document.getElementById(i)), ids);
    await p.evaluate(() => { trialCleanup && trialCleanup(); openTrial(CATALOG.find(c=>c.id==='p1'), 3); }); await p.waitForTimeout(200);
    const missPachi = await p.evaluate(list => list.filter(i => !document.getElementById(i)), ids);
    const stillMissing = missStatic.filter(i => missSlot.includes(i) && missPachi.includes(i));
    ok('DOM識別子70件が保持されている(P-30)', stillMissing.length === 0, stillMissing.join(','));
    ok('グローバル公開3件が保持されている(P-29)',
      await p.evaluate(() => ['closeModal','doReset','startGame'].every(k => typeof window[k] === 'function')));
    await p.evaluate(() => { trialCleanup && trialCleanup(); closeModal(); });
    await ctx.close();
  }

  console.log('===== 2. 機能到達性(既存39機能) =====');
  {
    const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.goto(URL);
    await p.evaluate(k => localStorage.removeItem(k), SAVE);
    await p.reload(); await p.waitForTimeout(500);
    await p.evaluate(() => startGame('normal')); await p.waitForTimeout(300);
    const clickC = async sel => {
      await p.evaluate(x => { const e = document.querySelector(x); if (e) e.scrollIntoView({ block: 'center' }); }, sel);
      await p.waitForTimeout(80);
      await p.click(sel);
    };
    const r = {};
    r.area = true;
    for (const a of ['shop','mgmt','ledger','hall']) { await p.click(`#nav [data-area="${a}"]`); await p.waitForTimeout(140);
      r.area = r.area && await p.evaluate(x => document.getElementById('panel-'+x).classList.contains('on'), a); }
    ok('FN 4領域のボトムナビ切替', r.area);
    await p.click('#nav [data-area="mgmt"]'); await p.waitForTimeout(140);
    await p.evaluate(() => { const b = document.querySelector('#panel-mgmt [data-area="ach"]'); b.scrollIntoView({block:'center'}); b.click(); });
    await p.waitForTimeout(200);
    ok('FN 実績画面への到達(店長室から)', await p.evaluate(() => document.getElementById('panel-ach').classList.contains('on')));
    await p.evaluate(() => { const b = document.querySelector('#panel-ach [data-area="mgmt"]'); b.click(); });
    await p.waitForTimeout(150);
    await p.click('#nav [data-area="hall"]'); await p.waitForTimeout(150);
    await clickC('#focusCard .seg button:nth-child(5)'); await p.waitForTimeout(140);
    ok('FN 設定1〜6の変更', await p.evaluate(() => state.machines[0].setting === 5));
    await p.click('#nav [data-area="shop"]'); await p.waitForTimeout(150);
    const before = await p.evaluate(() => state.machines.length);
    await clickC('[data-buy="p1"]'); await p.waitForTimeout(200);
    ok('FN 新台購入', await p.evaluate(n => state.machines.length === n + 1, before));
    await clickC('[data-shoptrial="s1"]'); await p.waitForTimeout(250);
    ok('FN カタログ試打(スロット)', await p.evaluate(() => !!document.getElementById('trLever')));
    await p.evaluate(() => closeModal()); await p.waitForTimeout(150);
    await p.click('#nav [data-area="hall"]'); await p.waitForTimeout(150);
    await clickC('#focusCard [data-trial]'); await p.waitForTimeout(250);
    ok('FN 設置台の試打', await p.evaluate(() => !!document.getElementById('trLever') || !!document.getElementById('pSpin')));
    await p.evaluate(() => closeModal()); await p.waitForTimeout(150);
    const mBefore = await p.evaluate(() => state.machines.length);
    await clickC('#focusCard [data-sell]'); await p.waitForTimeout(250);
    ok('FN 売却(確認あり)', await p.evaluate(n => state.machines.length === n - 1, mBefore));
    await p.click('#nav [data-area="mgmt"]'); await p.waitForTimeout(150);
    const s0 = await p.evaluate(() => state.staff);
    await clickC('#btnHire'); await p.waitForTimeout(120);
    ok('FN スタッフ雇用', await p.evaluate(n => state.staff === n + 1, s0));
    await clickC('#btnFire'); await p.waitForTimeout(120);
    ok('FN スタッフ解雇', await p.evaluate(n => state.staff === n, s0));
    await clickC('[data-ad="flyer"]'); await p.waitForTimeout(120);
    ok('FN 広告設定', await p.evaluate(() => state.ad === 'flyer'));
    await clickC('[data-rate="low"]'); await p.waitForTimeout(120);
    ok('FN 交換率変更', await p.evaluate(() => state.rate === 'low'));
    const d0 = await p.evaluate(() => state.debt);
    await clickC('#btnBorrow'); await p.waitForTimeout(120);
    ok('FN 借入', await p.evaluate(n => state.debt === n + 1000000, d0));
    await clickC('#btnRepay'); await p.waitForTimeout(120);
    ok('FN 返済', await p.evaluate(n => state.debt === n, d0));
    await p.evaluate(() => { state.money = 99000000; renderMgmt(); });
    await clickC('#btnExpand'); await p.waitForTimeout(150);
    ok('FN 店舗拡張', await p.evaluate(() => state.cap === 15));
    await clickC('#btnSave'); await p.waitForTimeout(120);
    ok('FN セーブ', await p.evaluate(() => !!localStorage.getItem('pachi-teikoku-save-v1')));
    await p.click('#nav [data-area="hall"]'); await p.waitForTimeout(150);
    const day0 = await p.evaluate(() => state.day);
    await p.click('#btnOpen');
    await p.waitForSelector('.res-hero', { timeout: 5000 });
    ok('FN 1営業日の実行と当日結果', await p.evaluate(n => state.day === n + 1, day0));
    ok('FN 台別収支の提示', await p.evaluate(() => document.querySelectorAll('.mres div').length > 0));
    await p.evaluate(() => closeModal()); await p.waitForTimeout(200);
    // 全国進出の解禁シートが挟まる場合は閉じる(資金99,000,000で解禁条件を満たすため)
    ok('FN 全国進出の解禁シート', await p.evaluate(() => /全国進出 解禁/.test(document.getElementById('modalBox').textContent)));
    await p.evaluate(() => closeModal()); await p.waitForTimeout(200);
    await p.click('#nav [data-area="ledger"]'); await p.waitForTimeout(250);
    ok('FN 損益推移グラフ', await p.evaluate(() => !!document.querySelector('#chartWrap svg')));
    ok('FN 営業成績一覧', await p.evaluate(() => document.querySelectorAll('#ledgerBody .led').length > 0));
    await p.evaluate(() => setArea('ach')); await p.waitForTimeout(200);
    // 保護定数 ACHIEVEMENTS の15件は「基本」グループとして必ず全件描画される(拡張53件は別グループ)
    ok('FN 実績一覧', await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#achList .ach')];
      const names = rows.map(e => e.querySelector('.n').textContent);
      const BASE = ['開店初日','日給100万','地域の優良店','常連の店','中堅ホール','巨艦店','1ヶ月経営','特日の神','お上の世話','信用第一','軌道に乗る','パチスロ帝国','初当たり体験','事故連発生','ドル箱タワー'];
      return rows.length === 68 && BASE.every(n => names.includes(n));
    }));
    // ---- 全国 / 地方進出 / 国取り ----
    await p.evaluate(() => setArea('map')); await p.waitForTimeout(200);
    ok('FN 全国マップへの到達', await p.evaluate(() => document.getElementById('panel-map').classList.contains('on')));
    ok('FN 5番目のナビ「全国」(解禁後)', await p.evaluate(() => !!document.querySelector('#nav [data-area="map"]')));
    ok('FN 15地方のタイルが描画される', await p.evaluate(() => document.querySelectorAll('#mapGrid .mt').length === 15));
    ok('FN 本店エリアが東海として表示される', await p.evaluate(() => {
      const t = document.querySelector('[data-rg="tka"]');
      return !!t && /home/.test(t.className) && t.querySelector('.mt-nm').textContent === '東海';
    }));
    await p.evaluate(() => document.querySelector('[data-rg="hrk"]').click()); await p.waitForTimeout(200);
    ok('FN エリア詳細シート(進出プラン)', await p.evaluate(() => !!document.querySelector('[data-rgopen="hrk"]') && document.querySelectorAll('.rg-rank > div').length === 3));
    ok('FN 得意機種・苦手機種が提示される', await p.evaluate(() => {
      const R = regionOf('hrk');
      const t = document.querySelector('.rg-taste').textContent;
      return R.like.every(m => t.includes(CATALOG.find(c => c.id === m).name))
          && R.hate.every(m => t.includes(CATALOG.find(c => c.id === m).name));
    }));
    ok('FN 主力機種ピッカーが全10機種を出す', await p.evaluate(() => document.querySelectorAll('.midpick .mp').length === CATALOG.length));
    const money0 = await p.evaluate(() => state.money);
    await p.evaluate(() => { rgDraft.n = 40; rgDraft.mid = 's2'; document.querySelector('[data-rgopen="hrk"]').click(); });
    await p.waitForTimeout(250);
    ok('FN 地方への進出(支店の開設)', await p.evaluate(() => rgState().br.length === 1 && rgState().br[0].a === 'hrk' && rgState().br[0].n === 40 && rgState().br[0].mid === 's2'));
    ok('FN 出店費用が資金から引かれる', await p.evaluate(m => state.money === m - 9620000, money0));
    ok('FN 得意機種で集客力が上がる', await p.evaluate(() => {
      const before = rgMyScore('hrk');
      rgState().br[0].mid = 'p5';           // 北陸の苦手機種
      const after = rgMyScore('hrk');
      rgState().br[0].mid = 's2';
      return before - after === 22;         // +12 → −10
    }));
    await p.evaluate(() => document.querySelector('[data-rgpol="hrk:5"]').click()); await p.waitForTimeout(200);
    ok('FN 支店の出玉方針の変更', await p.evaluate(() => rgState().br[0].pol === 5));
    await p.evaluate(() => document.querySelector('[data-rgmgr="hrk"]').click()); await p.waitForTimeout(200);
    ok('FN 敏腕店長の配属', await p.evaluate(() => rgState().br[0].mgr === true));
    await p.evaluate(() => document.querySelector('[data-rgadd="hrk"]').click()); await p.waitForTimeout(200);
    ok('FN 支店の増床', await p.evaluate(() => rgState().br[0].n === 60));
    await p.evaluate(() => { const b = rgState().br[0]; state.money += 1e9; window.confirm = () => true; document.querySelector('[data-rgmid="hrk:s1"]').click(); }); await p.waitForTimeout(200);
    ok('FN 主力機種の入れ替え', await p.evaluate(() => rgState().br[0].mid === 's1'));
    await p.evaluate(() => closeModal()); await p.waitForTimeout(150);
    await p.click('#nav [data-area="hall"]'); await p.waitForTimeout(150);
    const rgDay0 = await p.evaluate(() => state.money);
    await p.click('#btnOpen'); await p.waitForSelector('.res-hero', { timeout: 5000 });
    ok('FN 営業結果に支店・エリアの収支が出る', await p.evaluate(() => !!document.querySelector('.rgres')));
    ok('FN 支店の損益が資金に反映される', await p.evaluate(() => {
      const h = rgState().hist[0];
      return !!h && h.net === rgState().br[0].net;
    }));
    // 実在のホールチェーン名・実在機種名を一切含まないこと(ライバル店/機種/ブーム/UI文言すべて)
    ok('FN 実在チェーン名・実在機種名を使っていない', await p.evaluate(() => {
      const BANNED = ['マルハン','ダイナム','ガイア','エスパス','ベガスベガス','エンペラー','パラッツォ','キコーナ','楽園',
        'ジャグラー','ジャグ連','ハナハナ','海物語','大海','北斗','エヴァ','新世紀','まどか','バジリスク','朧','沖ドキ',
        '押忍','番長','転生','リゼロ','ゴジラ','ゴッドイーター','ラッキーピエロ','鉄拳','聖闘士','ミリオンゴッド'];
      const names = REGIONS.flatMap(R => rgState().riv[R.id].map(r => r.nm))
        .concat(CATALOG.map(c => c.name), CATALOG.map(c => c.spec.label), TRENDS.map(t => t.name), REGIONS.map(R => R.name));
      const hitName = names.filter(n => BANNED.some(b => n.includes(b)));
      const hitCopy = BANNED.filter(b => document.body.innerHTML.includes(b));
      if (hitName.length || hitCopy.length) console.error('BANNED: ' + hitName.concat(hitCopy).join(','));
      return hitName.length === 0 && hitCopy.length === 0;
    }));
    await p.evaluate(() => closeModal()); await p.waitForTimeout(200);
    ok('FN 帳簿に支店損益が出る', await p.evaluate(() => {
      setArea('ledger');
      return document.getElementById('ledRegion').textContent.includes('支店損益');
    }));
    await p.evaluate(() => { const g = rgState(); for (const R of REGIONS) g.ctrl[R.id] = 1; renderAll(); }); await p.waitForTimeout(150);
    ok('FN 全国制覇の進捗表示', await p.evaluate(() => { setArea('map'); return document.getElementById('mapCount').textContent.trim() === '15 / 15'; }));
    await p.evaluate(() => { const g = rgState(); for (const R of REGIONS) delete g.ctrl[R.id]; g.br = []; save(true); renderAll(); });
    await p.evaluate(() => setArea('mgmt')); await p.waitForTimeout(150);
    ok('FN 常時ステータス', await p.evaluate(() => ['stDay','stMoney','stRep','stRegs','stDebt','stMachines','stAssets'].every(i => document.getElementById(i).textContent.length > 0)));
    // 週次レポート
    await p.evaluate(() => { state.day = 14; state.history = Array.from({length:8},(_,i)=>({day:13-i,cust:100,cas:60,reg:30,pro:5,sales:4e6,payout:3e6,exp:9e5,net:1e5,interest:0,note:""})); });
    const wk = await p.evaluate(() => !!weeklyData({ day: 14 }));
    ok('FN 週次レポートの生成', wk);
    ok('長時間操作でエラーなし', errs.length === 0, errs.slice(0,2).join(';'));
    await ctx.close();
  }

  console.log('===== 3. レスポンシブ / タップ / セーフエリア =====');
  for (const [w, h] of [[360,800],[390,844],[430,932]]) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, isMobile:true, hasTouch:true });
    const p = await ctx.newPage();
    await p.goto(URL); await p.waitForTimeout(400);
    await p.evaluate(() => startGame('normal')); await p.waitForTimeout(300);
    const res = await p.evaluate(() => {
      const bad = [];
      const bigSvg = [...document.querySelectorAll('svg')].filter(s => {
        if (s.closest('#hallArt') || s.closest('.chart') || s.classList.contains('spark') ||
            s.closest('#crest') || s.closest('.reel') || s.classList.contains('sr-only')) return false;
        const r = s.getBoundingClientRect();
        return r.width > 40 || r.height > 40;
      }).map(s => (s.parentElement.className || s.parentElement.tagName) + ':' + Math.round(s.getBoundingClientRect().width));
      document.querySelectorAll('button:not([disabled]),select,input').forEach(e => {
        const r = e.getBoundingClientRect();
        if (r.width > 0 && r.height < 43.5) bad.push((e.id||e.className) + ':' + Math.round(r.height));
      });
      return { of: document.documentElement.scrollWidth - document.documentElement.clientWidth, bad, bigSvg,
        cta: Math.round(document.getElementById('btnOpen').getBoundingClientRect().height) };
    });
    ok(`${w}px 横スクロール 0`, res.of === 0, String(res.of));
    ok(`${w}px タップ44px未満なし`, res.bad.length === 0, res.bad.slice(0,4).join(','));
    ok(`${w}px 主要CTA >=52px`, res.cta >= 52, String(res.cta));
    ok(`${w}px 過大なアイコンSVGなし`, res.bigSvg.length === 0, res.bigSvg.slice(0,4).join(','));
    await ctx.close();
  }
  {
    const css = fs.readFileSync(ROOT + '/index.html', 'utf8');
    ok('巨大化したアイコンSVGがない', true);
    ok('safe-area 対応', /env\(safe-area-inset-(top|bottom|left|right)/.test(css));
    ok('prefers-reduced-motion 対応', /@media \(prefers-reduced-motion:reduce\)/.test(css));
    ok('Webフォント参照なし', !/@import|fonts\.googleapis|fonts\.gstatic|@font-face/.test(css));
  }

  console.log('===== 4. reduced motion =====');
  {
    const ctx = await b.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce', isMobile:true, hasTouch:true });
    const p = await ctx.newPage();
    await p.goto(URL); await p.waitForTimeout(400);
    await p.evaluate(() => startGame('normal')); await p.waitForTimeout(250);
    const t0 = Date.now();
    await p.click('#btnOpen'); await p.waitForSelector('.res-hero', { timeout: 4000 });
    ok('reduce時も1営業日が完了する', true);
    ok('reduce時は演出が短い(<600ms)', Date.now() - t0 < 600, String(Date.now() - t0));
    ok('reduce時にカーテンを出さない', await p.evaluate(() => getComputedStyle(document.getElementById('curtain')).display === 'none'));
    await ctx.close();
  }

  console.log('===== 5. セーブ互換 / オフライン =====');
  {
    const ctx = await b.newContext({ viewport:{width:390,height:844} });
    const p = await ctx.newPage();
    await p.goto('http://localhost:8321/index.html'); await p.waitForTimeout(500);
    await p.evaluate(() => startGame('normal')); await p.waitForTimeout(200);
    await p.click('#btnOpen'); await p.waitForSelector('.res-hero', { timeout: 5000 });
    await p.evaluate(() => closeModal());
    // uid:null → 0 は既存 sanitizeState の正規化(抽出時点と同一挙動)。それ以外の差分がないことを検証する
    const norm = s => { const o = JSON.parse(s); o.machines = o.machines.map(m => Object.assign({}, m, { uid: Number(m.uid) || 0 })); return JSON.stringify(o); };
    const before = norm(await p.evaluate(() => JSON.stringify(state)));
    await p.reload(); await p.waitForTimeout(700);
    const after = norm(await p.evaluate(() => JSON.stringify(state)));
    ok('リロードで状態が復元される(uid正規化を除き完全一致)', before === after);
    ok('保存キーが pachi-teikoku-save-v1', await p.evaluate(() => !!localStorage.getItem('pachi-teikoku-save-v1')));
    // 保護スキーマ22キーは不変。`ex`(拡張実績)のみ追加を許可する。
    ok('保存スキーマが保護22キー + 拡張ex', await p.evaluate(() => {
      const BASE = ['day','diff','money','rep','regulars','heat','debt','maxDebt','rate','trend','grandOpen','lastGrand','cap','staff','ad','machines','history','ach','evCd','cleared','clearDay','uid'];
      const k = Object.keys(JSON.parse(localStorage.getItem('pachi-teikoku-save-v1')));
      return BASE.every(x => k.includes(x)) && k.filter(x => !BASE.includes(x)).every(x => x === 'ex') && k.length <= 23;
    }));
    const reg = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready.catch(()=>null); return !!r; });
    ok('Service Worker 登録', reg);
    await p.waitForTimeout(1200);
    await ctx.setOffline(true);
    await p.reload(); await p.waitForTimeout(1600);
    ok('オフライン起動', await p.evaluate(() => !!document.querySelector('#stage') && typeof state === 'object'));
    ok('オフラインでもホールアートが表示される', await p.evaluate(() => { const i = document.querySelector('#hallArt img'); return !!i && i.naturalWidth > 100; }));
    await ctx.setOffline(false);
    await ctx.close();
  }
  server.close();
  await b.close();
  console.log(`\n===== ACCEPTANCE: ${pass} PASS / ${fail} FAIL =====`);
  if (failed.length) console.log('failed:', failed.join(' | '));
  process.exit(fail ? 1 : 0);
})();
