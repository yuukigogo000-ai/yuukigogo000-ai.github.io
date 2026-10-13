// Real-browser regression for the public shared setlist page. Synthetic data only.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const before = '7b31bb1b46479b25ee5e4ed370229069c9225fb8';
let old = false;
const oldFiles = new Map();
const server = createServer((req,res) => {
  let path = new URL(req.url, 'http://local').pathname;
  if (path.endsWith('/')) path += 'index.html';
  const full = resolve(root, '.' + path);
  if (!full.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    let body;
    if (old && /^\/band\/(index.html|app.js|store.js|share.js|sw.js|manifest.webmanifest)$/.test(path)) {
      if (!oldFiles.has(path)) oldFiles.set(path, execFileSync('git',['-C',root,'show',before+':'+path.slice(1)]));
      body=oldFiles.get(path);
    } else body=readFileSync(full);
    res.writeHead(200, {'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[extname(full)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(0,'127.0.0.2',r));
const base = `http://127.0.0.2:${server.address().port}/band/`;
const bundle = {n:'週末リハーサル',t:30,g:15,m:90,s:[
  ['Opening',128,'E','Standard',180,3,1,'合図でスタート\n最後は全員で止める','カポなし\n同期を確認'],
  ['Night Walk',96,'Am','Drop D',245,2,0,'2番は静かに','ギター持ち替え'],
  ['Last Song',160,'G','Standard',210,5,0,'最後のキメは4回',''],
]};
const encode=(b,compressed=true)=>(compressed?'1.':'0.')+(compressed?deflateRawSync(Buffer.from(JSON.stringify(b))):Buffer.from(JSON.stringify(b))).toString('base64url');
const results=[];
const pass=s=>{results.push(s);console.log('PASS',s);};
const browser=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : process.platform==='win32'?{channel:'msedge'}:{});
try {
  const ctx=await browser.newContext({locale:'ja-JP'});
  const page=await ctx.newPage();const errors=[];
  const openShared=async value=>{await page.goto('about:blank');await page.goto(base+'#s='+value);};
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('BANDHUBから'));
  assert.equal(await page.locator('.song-row').count(),0);
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  pass('bare URL shows instructions, no sample songs or storage writes');
  const saved=JSON.stringify({v:2,activeId:'keep',library:[{id:'song',title:'Saved locally',memo:'Private old memo',sec:180}],setlists:[{id:'keep',name:'My saved setlist',items:[{id:'item',songId:'song',mc:false}]}]});
  await page.evaluate(v=>localStorage.setItem('setlism:v1',v),saved);
  await page.addInitScript(()=>{
    window.storageCalls=[];
    for(const key of ['getItem','setItem','removeItem','clear']) {
      const original=Storage.prototype[key];
      Storage.prototype[key]=function(...args){window.storageCalls.push(key);return original.apply(this,args);};
    }
  });
  for(const compressed of [false,true]) {
    await openShared(encode(bundle,compressed));
    await page.waitForFunction(()=>document.querySelectorAll('.song-row').length===3);
    assert.deepEqual(await page.locator('.song-row h2').allTextContents(),bundle.s.map(s=>s[0]));
    assert.equal(await page.locator('.song-memo').first().textContent(),bundle.s[0][7]);
    assert.match(await page.locator('.song-gear').first().textContent(),/同期を確認/);
    assert.equal(await page.locator('.mc-note').count(),1);
    assert.deepEqual(await page.evaluate(()=>window.storageCalls),[]);
    assert.equal(await page.evaluate(()=>localStorage.getItem('setlism:v1')),saved);
  }
  pass('plain and compressed mobile-format links display order, memo, gear and MC without reading/writing saved data');
  await page.click('#language');assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#summary').textContent(),'3 songs');
  await page.click('#language');
  pass('Japanese and English switch without changing shared contents');
  const v1={...bundle,s:bundle.s.map(s=>s.slice(0,8))};
  await openShared(encode(v1));await page.waitForFunction(()=>document.querySelectorAll('.song-row').length===3);
  assert.equal(await page.locator('.song-gear').count(),0);pass('older 8-field links remain readable');
  const hostile={...bundle,n:'<img src=x onerror="window.pwned=1">',s:[['<script>pwned=1</script>',120,'C','',10,3,0,'<img src=x onerror="window.pwned=1">','<iframe>']]};
  await openShared(encode(hostile));await page.waitForFunction(()=>document.querySelectorAll('.song-row').length===1);
  assert.equal(await page.locator('#title').textContent(),hostile.n);
  assert.equal(await page.locator('#songs img, #songs script, #songs iframe, #title img').count(),0);
  assert.equal(await page.evaluate(()=>window.pwned),undefined);pass('HTML-shaped song names and notes remain inert text');
  for(const p of ['1.invalid','2.e30',encode({...bundle,n:'X'.repeat(2*1024*1024+64)})]) {
    await openShared(p);
    await page.waitForFunction(()=>document.querySelector('#title').textContent.includes('開けません'));
    assert.equal(await page.locator('.song-row').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('setlism:v1')),saved);
  }
  pass('malformed and oversized compressed inputs show an error and preserve old data');
  await openShared(encode({...bundle,s:[]}));await page.waitForFunction(()=>document.querySelector('#summary').textContent==='0曲');
  assert.match(await page.locator('#status').textContent(),/まだ曲がありません/);
  await page.evaluate(()=>location.hash='');await page.waitForFunction(()=>document.querySelector('#title').textContent==='セットリストを受け取る');
  pass('empty setlist and removed link clear earlier content');
  await openShared(encode(bundle));await page.waitForFunction(()=>document.querySelectorAll('.song-row').length===3);
  for(const width of [360,390]) for(const scheme of ['light','dark']) {
    await page.setViewportSize({width,height:width===360?800:844});await page.emulateMedia({colorScheme:scheme});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(process.env.VIEWER_QA_OUT) await page.screenshot({path:resolve(process.env.VIEWER_QA_OUT,`viewer-${width}-${scheme}.png`),fullPage:true});
  }
  pass('360 and 390 pixel layouts in light/dark do not overflow');
  await page.click('#legacyLink');await page.waitForSelector('#songList .song');
  assert.match(await page.locator('#songList').textContent(),/Saved locally/);
  await page.evaluate(async()=>{const m=await import('./store.js');m.save();});await page.reload();
  assert.match(await page.locator('#songList').textContent(),/Saved locally/);
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async x=>{window.testLink=x.url;}}));
  await page.click('#moreBtn');await page.click('#shareBtn');await page.click('#shareLinkBtn');await page.waitForFunction(()=>!!window.testLink);
  const link=await page.evaluate(()=>window.testLink);assert(link.startsWith(base+'#s='));
  await page.goto(link);await page.waitForSelector('.song-row');assert.equal(await page.locator('.song-row h2').textContent(),'Saved locally');
  pass('previous editor opens and saves old data, and creates links to the new viewer');
  assert.deepEqual(errors,[]);await ctx.close();
  pass('no uncaught browser errors during viewer and legacy flows');
  // Install the actual previous public worker, then upgrade using a fresh context.
  old=true;
  const upgrade=await browser.newContext({locale:'ja-JP'});const up=await upgrade.newPage();
  await up.goto(base);await up.waitForSelector('#songList');
  await up.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
  await up.reload();await up.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await up.evaluate(async()=>{await caches.open('other-app-keep');localStorage.setItem('unrelated','keep');});
  old=false;
  await up.evaluate(async()=>{window.oldController=navigator.serviceWorker.controller;await(await navigator.serviceWorker.getRegistration()).update();});
  await up.waitForFunction(()=>navigator.serviceWorker.controller!==window.oldController);
  await up.reload();await up.waitForSelector('#title');
  const cacheKeys=await up.evaluate(()=>caches.keys());
  assert(cacheKeys.includes('setlism-v4-viewer-20261013'));assert(!cacheKeys.includes('setlism-v3-security-20261013'));assert(cacheKeys.includes('other-app-keep'));
  assert.equal(await up.evaluate(()=>localStorage.getItem('unrelated')),'keep');
  await upgrade.setOffline(true);await up.goto(base+'#s='+encode(bundle));await up.waitForSelector('.song-row');
  assert.equal(await up.locator('.song-row').count(),3);await upgrade.close();
  pass('previous public cache upgrades to viewer; unrelated cache/storage and offline links preserved');
  if(process.env.VIEWER_QA_OUT) writeFileSync(resolve(process.env.VIEWER_QA_OUT,'results.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:browser.version(),results},null,2));
} finally { await browser.close();await new Promise(r=>server.close(r)); }
