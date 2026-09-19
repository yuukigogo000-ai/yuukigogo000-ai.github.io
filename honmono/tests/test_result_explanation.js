'use strict';
// Presentation regression: synthetic inputs and stub scores; real WASM is covered separately.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),zlib=require('zlib');
const {chromium,webkit}=require('playwright-core');
const ROOT=path.resolve(process.env.SITE_ROOT||path.join(__dirname,'../..'));
const OUT=process.env.EVIDENCE_DIR||path.join(require('os').tmpdir(),'honmono-explanation');
fs.mkdirSync(OUT,{recursive:true});
const records=[],errors=[],requests=[];let server;
function check(name,pass,detail){records.push({name,pass:!!pass,detail});if(!pass)console.error('FAIL',name,JSON.stringify(detail));}
async function origin(){
 if(process.env.BASE_URL)return process.env.BASE_URL.replace(/\/$/,'');
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
 server=http.createServer((q,s)=>{try{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const p=path.resolve(ROOT,'.'+u);
 if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){s.writeHead(404);return s.end();}
 s.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(s);}catch{s.writeHead(400);s.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;
}
function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,b){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(b.length);crc.writeUInt32BE(crc32(Buffer.concat([t,b])));return Buffer.concat([len,t,b,crc]);}
function png(ai=false){const h=Buffer.alloc(13);h.writeUInt32BE(1,0);h.writeUInt32BE(1,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),...(ai?[chunk('tEXt',Buffer.from('parameters\0synthetic AI metadata fixture'))]:[]),chunk('IDAT',zlib.deflateSync(Buffer.from([0,22,40,60,255]))),chunk('IEND',Buffer.alloc(0))]);}
async function cameraJpeg(page){
 const b=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=24;c.height=18;return c.toDataURL('image/jpeg').split(',')[1];}),'base64');
 const t=Buffer.alloc(54);t.write('II');t.writeUInt16LE(42,2);t.writeUInt32LE(8,4);t.writeUInt16LE(2,8);
 for(const [at,tag,count,offset] of [[10,0x010f,6,38],[22,0x0110,10,44]]){t.writeUInt16LE(tag,at);t.writeUInt16LE(2,at+2);t.writeUInt32LE(count,at+4);t.writeUInt32LE(offset,at+8);}
 t.write('Apple\0',38);t.write('iPhone 16\0',44);const ex=Buffer.concat([Buffer.from('Exif\0\0'),t]),head=Buffer.alloc(4);head.writeUInt16BE(0xffe1);head.writeUInt16BE(ex.length+2,2);return Buffer.concat([b.subarray(0,2),head,ex,b.subarray(2)]);
}
async function state(page){return page.evaluate(()=>{const get=id=>document.getElementById(id);const box=id=>{const e=get(id);if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,text:e.innerText,visible:getComputedStyle(e).display!=='none'};};return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,score:box('pixelScore'),basis:box('pixelBasis'),note:box('pixelNote'),label:box('pixelLabel'),quick:get('pixelQuickTitle').textContent,details:!!get('pixelExplanation'),color:get('pixelScore').style.color,calls:window.__calls};});}
async function select(page,buffer,name='fixture.png',mimeType='image/png'){await page.locator('#file').setInputFiles({name,mimeType,buffer});await page.waitForFunction(()=>document.getElementById('pixelResult').style.display==='block');}
(async()=>{const base=await origin();try{
 const served=await fetch(base+'/honmono/checker/').then(r=>r.text()),expected=fs.readFileSync(path.join(ROOT,'honmono/checker/index.html'),'utf8');
 check('tested-html-is-current-source',served===expected,{served:crypto.createHash('sha256').update(served).digest('hex')});
 for(const engine of ['edge','webkit']){
  const browser=engine==='edge'?await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}):await webkit.launch();
  try{for(const [width,scheme] of [[360,'dark'],[360,'light'],[390,'dark'],[430,'dark'],[768,'dark'],[1280,'dark'],[1440,'dark']]){
   const ctx=await browser.newContext({viewport:{width,height:width===360?800:width<500?844:1000},deviceScaleFactor:width<500?3:2,isMobile:width<500,hasTouch:width<500,colorScheme:scheme});
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
   await page.goto(base+'/honmono/checker/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(()=>{window.__p=.01;window.__calls=0;HonmonoPixel.predict=async()=>{window.__calls++;await new Promise(r=>setTimeout(r,30));return {pAI:window.__p,backend:'ui-fixture',ms:30};};});
   await select(page,png());if(width>600)await page.locator('#pixelQuickRun').click();
   const tag=engine+'/'+width+'/'+scheme;let s=await state(page);
   check(tag+'/completed-low-score-is-not-human-proof',s.quick.includes('完了')&&s.label.text.includes('真偽不明')&&s.basis&&s.basis.text.includes('検査は完了')&&s.note.text.includes('見逃し'),s);
   check(tag+'/score-and-limit-readable',s.score.top>=0&&s.note.bottom<=s.height&&s.note.top>=0&&s.scrollWidth<=width,s);
   await page.screenshot({path:path.join(OUT,engine+'-'+width+'-'+scheme+'-low.png')});
   if(!s.details){check(tag+'/explanation-available',false);await ctx.close();continue;}
   const calls=s.calls;await page.locator('#pixelExplanation summary').click();
   const explain=await page.locator('#pixelExplanation').innerText();
   check(tag+'/basis-is-clear-and-does-not-invent-attribution',['256×256','メタデータ','真偽の確率ではありません','82枚','専用評価は示していません','部位は示しません'].every(x=>explain.includes(x))&&(await page.evaluate(()=>__calls))===calls,explain);
   check(tag+'/expanded-explanation-no-overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390)await page.locator('#pixelExplanation').screenshot({path:path.join(OUT,engine+'-390-explanation.png')});
   await page.locator('#pixelExplanation summary').click();
   await page.evaluate(()=>scrollTo(0,0));await page.locator('#pixelQuickRun').click();s=await state(page);
   check(tag+'/details-button-keeps-same-result',s.score.top>=0&&s.note.bottom<=s.height&&s.calls===calls,s);
   if(width===390){
    for(const [p,expectedLabel] of [[.02,'真偽不明'],[.4999,'真偽不明'],[.5,'基準未満'],[.7999,'基準未満'],[.8,'可能性が高い'],[.95,'可能性が高い']]){
     await page.evaluate(v=>window.__p=v,p);await select(page,png(),p+'.png');const v=await state(page);
     check(engine+'/threshold/'+p,v.label.text.includes(expectedLabel)&&v.quick.includes('完了')&&v.score.text===Math.round(p*100)+' / 100',v);
     if(p===.95){check(engine+'/high-warning-in-view',v.note.bottom<=v.height&&v.score.top>=0,v);await page.screenshot({path:path.join(OUT,engine+'-390-high.png')});}
    }
    await page.evaluate(()=>window.__p=.01);await select(page,png(true),'ai-metadata.png');
    check(engine+'/low-score-does-not-overrule-AI-metadata',(await page.locator('#verdict').innerText()).includes('AI生成')&&(await page.locator('#pixelProvenance').textContent()).includes('否定されるわけではありません'));
    await select(page,await cameraJpeg(page),'camera.jpg','image/jpeg');
    check(engine+'/camera-record-is-not-proof',(await page.locator('#metaTable').innerText()).includes('iPhone 16')&&(await page.locator('#pixelProvenance').textContent()).includes('証明にはなりません')&&(await page.locator('#findings').innerText()).includes('撮影記録'));
    await page.locator('#pixelExplanation summary').click();await select(page,png(),'next.png');
    check(engine+'/new-file-resets-explanation',(await page.locator('#pixelExplanation').evaluate(e=>!e.open))&&(await page.locator('#pixelProvenance').textContent()).includes('見つかりませんでした'));
    await page.locator('#file').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
    await page.waitForFunction(()=>document.getElementById('fileMeta').textContent.includes('不明'));
    check(engine+'/invalid-replacement-hides-result',!(await page.locator('#pixelResult').isVisible())&&!(await page.locator('#pixelExplanation').isVisible()));
   }
   await ctx.close();
  }}finally{await browser.close();}
 }
 check('no-js-errors',errors.length===0,errors);
 check('no-external-or-write-request',requests.every(r=>['GET','HEAD'].includes(r.method)&&(!r.url.startsWith('http')||new URL(r.url).origin===base)));
}finally{if(server)await new Promise(r=>server.close(r));}
const result={at:new Date().toISOString(),target:base,fixture:'Synthetic image/metadata and deterministic scores; no original user image, no model accuracy claim',checks:records.length,passed:records.filter(r=>r.pass).length,failed:records.filter(r=>!r.pass),records};
fs.writeFileSync(path.join(OUT,'explanation-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:result.checks,passed:result.passed,failed:result.failed.length}));process.exitCode=result.failed.length?1:0;
})().catch(e=>{console.error(e);if(server)server.close();process.exitCode=1;});
