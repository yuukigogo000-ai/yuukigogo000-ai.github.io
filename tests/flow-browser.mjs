import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,extname} from 'node:path';
const root=fileURLToPath(new URL('../band/',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp'};
test('flow draft isolation, reset, apply, undo, offline, responsive and injection',async()=>{
 const server=createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const b=await readFile(join(root,p));res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://localhost:${server.address().port}/legacy.html`;
 let browser;try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
 for(const width of [360,390])for(const colorScheme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,colorScheme});const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#energyChart .btn').click();
  const saved=()=>page.evaluate(()=>localStorage.getItem('setlism:v1'));
  const original=await saved();const titles=await page.locator('.flow-song').allTextContents();
  await page.getByRole('button',{name:'シグナルを後ろへ',exact:true}).click();await page.selectOption('#flowGoal','afterglow');
  assert.equal(await saved(),original,'draft never writes storage');assert.match(await page.locator('#flowSummary').innerText(),/28:40/);
  assert(await page.getByText('最後の余韻',{exact:false}).count());assert.equal(await page.locator('.flow-baseline').count(),1);
  assert.equal(await page.locator('#flowDialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  assert.equal(await page.locator('#flowGoal').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),true);
  assert.equal(await page.locator('#flowDialog button').evaluateAll(es=>es.filter(e=>!e.disabled).every(e=>e.getBoundingClientRect().height>=44)),true);
  await page.getByRole('button',{name:'元の案に戻す',exact:true}).click();assert.deepEqual(await page.locator('.flow-song').allTextContents(),titles);assert(await page.locator('#flowApply').isDisabled());
  await page.getByRole('button',{name:'シグナルを後ろへ',exact:true}).click();await page.getByRole('button',{name:'閉じる',exact:true}).click();assert.equal(await saved(),original);
  await page.locator('#energyChart .btn').click();assert.deepEqual(await page.locator('.flow-song').allTextContents(),titles);
  await page.getByRole('button',{name:'シグナルを後ろへ',exact:true}).click();await page.selectOption('#flowGoal','afterglow');await page.locator('#flowApply').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('setlism:v1'))?.setlists[0].template==='afterglow');
  const applied=JSON.parse(await saved());assert.equal(applied.setlists[0].template,'afterglow');assert.match(await page.locator('#songList .song').first().innerText(),/夜間飛行/);
  await page.locator('#moreBtn').click();await page.locator('#undoBtn').click();assert.match(await page.locator('#songList .song').first().innerText(),/シグナル/);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('setlism:v1'))?.setlists[0].template!=='afterglow');
  console.log('flow adopted/undo',width,colorScheme);
  await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Service worker not ready')),10000))]));await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.setOffline(true);await page.reload();await page.locator('#energyChart .btn').click();assert(await page.locator('#flowDialog').isVisible());
  assert.deepEqual(errors,[]);await ctx.close();
 }
 const ctx=await browser.newContext();const page=await ctx.newPage();page.setDefaultTimeout(10000);await page.goto(url);
 // Persist sample with a legitimate UI operation, then test imported malicious labels and missing timings.
 await page.locator('#energyChart .btn').click();await page.getByRole('button',{name:'シグナルを後ろへ',exact:true}).click();await page.locator('#flowApply').click();
 await page.waitForFunction(()=>!!localStorage.getItem('setlism:v1'));
 await page.evaluate(()=>{const k='setlism:v1',s=JSON.parse(localStorage.getItem(k));s.library[0].title='<img src=x onerror="window.injected=1">';s.library[0].sec=0;localStorage.setItem(k,JSON.stringify(s));});await page.reload();await page.locator('#energyChart .btn').click();
 assert.equal(await page.locator('#flowDialog img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);assert.match(await page.locator('.flow-body').innerText(),/時間未入力/);assert.equal(await page.locator('.flow-body svg').count(),0);
 await ctx.close();
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
