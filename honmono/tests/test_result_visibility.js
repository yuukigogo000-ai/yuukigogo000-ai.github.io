'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium,webkit}=require('playwright-core');
const ROOT=path.resolve(process.env.SITE_ROOT||path.join(__dirname,'../..'));
const OUT=process.env.EVIDENCE_DIR||path.join(require('os').tmpdir(),'honmono-result-visibility');
fs.mkdirSync(OUT,{recursive:true});
const records=[],errors=[],requests=[]; let server;
function check(name,pass,detail){records.push({name,pass:!!pass,detail});if(!pass)console.error('FAIL',name,JSON.stringify(detail));}
async function origin(){
 if(process.env.BASE_URL)return process.env.BASE_URL.replace(/\/$/,'');
 const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
 server=http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const p=path.resolve(ROOT,'.'+u);
 if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){s.writeHead(404);return s.end();}
 s.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(s);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;
}
async function snapshot(page){return page.evaluate(()=>{const box=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,display:getComputedStyle(e).display,text:e.innerText};};
return {y:scrollY,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,result:box('pixelResult'),score:box('pixelScore'),note:box('pixelNote'),label:box('pixelLabel')};});}
function readable(s){return s.result.display!=='none'&&s.score.top>=0&&s.score.bottom<=s.height&&s.note.top>=0&&s.note.bottom<=s.height;}
(async()=>{const base=await origin();try{
 for(const engine of ['edge','webkit']){
  const browser=engine==='edge'?await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}):await webkit.launch();
  try{for(const width of [390,430,768,1280,1440]){
   const ctx=await browser.newContext({viewport:{width,height:width<500?844:1000},deviceScaleFactor:width<500?3:2,isMobile:width<500,hasTouch:width<500});
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
   await page.goto(base+'/honmono/checker/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(()=>{window.__calls=0;HonmonoPixel.predict=async()=>{window.__calls++;await new Promise(r=>setTimeout(r,60));return {pAI:.95,backend:'ui-fixture',ms:60};};});
   const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
   await page.locator('#file').setInputFiles({name:'retention.png',mimeType:'image/png',buffer:png});
   await page.waitForFunction(()=>document.getElementById('pixelResult').style.display==='block');
   if(width>600)await page.locator('#pixelQuickRun').click();
   let s=await snapshot(page);const tag=engine+'/'+width;
   check(tag+'/completed-score-and-warning-in-viewport',readable(s),s);
   check(tag+'/no-horizontal-scroll',s.scrollWidth<=s.width,s.scrollWidth);
   await page.screenshot({path:path.join(OUT,engine+'-'+width+'-result.png')});
   if(width===390){
    await page.waitForTimeout(process.env.FAST==='1'?1500:30000);const later=await snapshot(page);
    check(tag+'/result-remains-without-moving',readable(later)&&later.score.text===s.score.text&&Math.abs(later.y-s.y)<2,{initial:s,later});
    await page.screenshot({path:path.join(OUT,engine+'-390-retained.png')});
   }
   await page.evaluate(()=>scrollTo(0,0));await page.locator('#pixelQuickRun').click();s=await snapshot(page);
   check(tag+'/details-button-reopens-same-result',readable(s)&&(await page.evaluate(()=>__calls))===1,s);
   await page.locator('#file').setInputFiles({name:'replacement.txt',mimeType:'text/plain',buffer:Buffer.from('not image')});
   await page.waitForFunction(()=>document.getElementById('fileMeta').textContent.includes('不明'));
   check(tag+'/new-file-clears-previous-score',!(await page.locator('#pixelResult').isVisible()));
   await ctx.close();
  }}finally{await browser.close();}
 }
 check('no-js-errors',errors.length===0,errors);
 check('no-external-or-write-request',requests.every(r=>['GET','HEAD'].includes(r.method)&&(!r.url.startsWith('http')||new URL(r.url).origin===base)),requests.filter(r=>r.url.startsWith('http')&&new URL(r.url).origin!==base));
}finally{if(server)await new Promise(r=>server.close(r));}
const result={at:new Date().toISOString(),target:base,fixture:'UI-only deterministic 95/100; real WASM tested separately',hold_seconds:process.env.FAST==='1'?1.5:30,checks:records.length,passed:records.filter(x=>x.pass).length,failed:records.filter(x=>!x.pass),records};
fs.writeFileSync(path.join(OUT,'result-visibility.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:result.checks,passed:result.passed,failed:result.failed.length}));process.exitCode=result.failed.length?1:0;
})().catch(e=>{console.error(e);if(server)server.close();process.exitCode=1;});

