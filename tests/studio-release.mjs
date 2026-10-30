import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { join, extname } from 'node:path';
const root=fileURLToPath(new URL('../band/',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp'};
test('studio responsive inputs, distinct install identity and offline reload',async()=>{
 let oldHtmlOnce=false;
 const oldHtml=execFileSync('git',['show','3ffe9e4c9039de595af39e3b9cd3ef179b1f0fd0:band/legacy.html'],{cwd:root});
 const server=createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const b=oldHtmlOnce && p==='/legacy.html' ? oldHtml : await readFile(join(root,p)); if(p==='/legacy.html')oldHtmlOnce=false;res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://localhost:${server.address().port}`;
 let browser;
 try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  // Force an old cached shell + current JS, then a coherent current shell reload.
  const upgrade=await browser.newContext();const oldPage=await upgrade.newPage();const oldErrors=[];
  oldPage.on('pageerror',e=>oldErrors.push(e.message));oldHtmlOnce=true;
  await oldPage.goto(base+'/legacy.html');await oldPage.locator('#songList .song').first().waitFor();
  assert.equal(await oldPage.locator('#totalTime').innerText(),'28:40');
  await oldPage.click('#addSongBtn');assert(await oldPage.locator('#pickerDialog').isVisible());await oldPage.click('#pickerClose');
  await oldPage.locator('#songList .song').first().locator('.song-actions button').click();
  await oldPage.locator('#rowMenuList button[title="MC の入り切り"]').click();
  await oldPage.waitForFunction(()=>localStorage.getItem('setlism:v1')!==null);
  const saved=await oldPage.evaluate(()=>localStorage.getItem('setlism:v1'));
  assert(saved && JSON.parse(saved).setlists.length>0);
  await oldPage.reload();await oldPage.locator('#studioPlay').waitFor();
  assert.equal(await oldPage.evaluate(()=>localStorage.getItem('setlism:v1')),saved);assert.deepEqual(oldErrors,[]);await upgrade.close();
  for(const width of [360,390]) for(const colorScheme of ['light','dark']) {
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,colorScheme});
   const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/legacy.html'); await page.locator('#songList .song').first().waitFor();
   assert.equal(await page.locator('link[rel=manifest]').getAttribute('href'),'setlism.webmanifest');
   assert.equal(await page.locator('a[href="privacy.html"]').count(),1);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
   await page.click('#studioTimeBtn');assert(await page.locator('#timeDialog').isVisible());await page.click('#timeCloseBtn');
   await page.locator('.studio-chart-settings > summary').click();await page.selectOption('#templateSelect','buildup');
   assert(await page.locator('#templateFit').innerText());
   await page.locator('.studio-chart-settings > summary').click();
   await page.locator('.diag-warn .diag-detail > summary').first().click();await page.locator('.diag-warn button').first().click();
   assert.equal(await page.locator('#f-title').inputValue(),'ラストスパート');await page.click('#songCancelBtn');
   await page.click('#studioAddBtn');assert(await page.locator('#pickerDialog').isVisible());await page.click('#pickerClose');
   await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
   await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   const manifest=await page.evaluate(async()=> (await fetch('setlism.webmanifest')).json());
   assert.equal(manifest.start_url,'./legacy.html');assert.equal(manifest.id,'./legacy.html');
   const viewer=await page.evaluate(async()=> (await fetch('manifest.webmanifest')).json());assert.equal(viewer.start_url,'.');
   const app=await page.evaluate(async()=> (await fetch('app.js')).text());assert.equal(app,await readFile(join(root,'app.js'),'utf8'));
   await context.setOffline(true);await page.reload();await page.locator('#songList .song').first().waitFor();
   assert.equal(await page.locator('#studioPlay').innerText(),'24:25');
   await page.goto(base+'/privacy.html');assert(await page.locator('h1').innerText());
   assert.deepEqual(errors,[]);await context.close();
  }
 } finally {await browser?.close();await new Promise(r=>server.close(r));}
});
