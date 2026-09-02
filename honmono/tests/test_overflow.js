// 新規ページがスマホ幅で横に溢れていないかだけを機械的に見る(見た目の良し悪しは判定しない)。
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path'); const http = require('http');
// 検査対象のサイトルート。既定はこのファイルから見たリポジトリ直下(SITE_ROOT で差し替え可)。
const REPO = path.resolve(process.env.SITE_ROOT || path.join(__dirname, '..', '..'));
const PORT = 8772;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml' };
function findBrowser(){
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const cands = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'];
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (dir && fs.existsSync(dir)) for (const d of fs.readdirSync(dir)) for (const rel of ['chrome-linux/chrome','chrome-linux/headless_shell']) cands.push(path.join(dir,d,rel));
  cands.push('/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser');
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error('no browser (CHROME_PATH で指定してください)');
}
function serve(){ return new Promise(res=>{ const s=http.createServer((q,p)=>{ let u=decodeURIComponent(q.url.split('?')[0]); if(u.endsWith('/'))u+='index.html'; const f=path.join(REPO,u); if(!f.startsWith(REPO)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);p.end();return;} p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(p); }); s.listen(PORT,()=>res(s)); }); }

const URLS = ['/honmono/','/honmono/report/','/honmono/business/','/honmono/legal/privacy.html','/honmono/legal/terms.html','/honmono/legal/credits.html','/honmono/creators/','/honmono/docs/','/honmono/aicheck/'];
const SIZES = [[360,800],[390,844]];

(async () => {
  const server = await serve();
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  const bad = [];
  for (const [w,h] of SIZES) {
    const ctx = await browser.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:3 });
    for (const u of URLS) {
      const page = await ctx.newPage();
      await page.goto('http://127.0.0.1:'+PORT+u, { waitUntil:'networkidle' });
      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const over = [];
        // 溢れている要素を特定する(スクロール容器 overflow-x:auto の中は除く)
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > de.clientWidth + 1) {
            let p = el.parentElement, inScroll = false;
            while (p) { if (getComputedStyle(p).overflowX === 'auto' || getComputedStyle(p).overflowX === 'scroll') { inScroll = true; break; } p = p.parentElement; }
            if (!inScroll) over.push(el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : '') + ' right=' + Math.round(rect.right));
          }
        });
        return { pageScroll: de.scrollWidth > de.clientWidth, w: de.clientWidth, sw: de.scrollWidth, over: over.slice(0,4) };
      });
      if (r.pageScroll) bad.push(w+'px '+u+' : ページ全体が横スクロール ('+r.sw+' > '+r.w+') '+r.over.join(' / '));
      await page.close();
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  if (bad.length) { console.log('横溢れ '+bad.length+'件:'); bad.forEach(b=>console.log('  - '+b)); process.exit(1); }
  console.log('OVERFLOW PASS — 360/390px とも横スクロールなし ('+URLS.length*SIZES.length+'通り)');
})();
