'use strict';
// Actual browser tests. Synthetic fixtures test behavior; REAL_SAMPLES uses unchanged WASM.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {chromium,webkit}=require('playwright-core');
const ROOT=path.resolve(process.env.SITE_ROOT||path.join(__dirname,'../..'));
const OUT=process.env.EVIDENCE_DIR||path.join(require('os').tmpdir(),'honmono-reaction');
fs.mkdirSync(OUT,{recursive:true});
const records=[],errors=[],requests=[],real=[];let server;
function check(name,pass,detail){records.push({name,pass:!!pass,detail});if(!pass)console.error('FAIL',name,JSON.stringify(detail));}
async function origin(){
 if(process.env.BASE_URL)return process.env.BASE_URL.replace(/\/$/,'');
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
 server=http.createServer((q,s)=>{try{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const p=path.resolve(ROOT,'.'+u);
 if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){s.writeHead(404);return s.end();}
 s.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(s);}catch{s.writeHead(400);s.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;
}
function watch(page){page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:!!r.postData()}));}
async function fixture(page){return Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');const d=g.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){d.data[i]=(i/4)%256;d.data[i+1]=Math.floor(i/1024);d.data[i+2]=(i*7)%256;d.data[i+3]=255;}g.putImageData(d,0,0);return c.toDataURL('image/png').split(',')[1];}),'base64');}
async function stub(page){await page.evaluate(()=>{
 window.__calls=0;window.__maskCalls=0;window.__mode='normal';window.__delay=0;
 HonmonoPixel.predict=async file=>{window.__calls++;if(file instanceof File)return {pAI:.95,ms:1,backend:'fixture'};
 const n=window.__maskCalls++;await new Promise(r=>setTimeout(r,window.__delay));
 if(window.__mode==='error'&&n===1)throw Error('fixture inference failure');
 const p=window.__mode==='mismatch'&&n===0?.2:n===0?.95:window.__mode==='flat'?.95:([.60,.65,.99,.999,.80,.99][n-1]??.945);
 return {pAI:p,ms:1,backend:'fixture'};};
});}
async function select(page,buffer,name='fixture.png'){await page.locator('#file').setInputFiles({name,mimeType:'image/png',buffer});await page.waitForFunction(()=>document.getElementById('pixelResult').style.display==='block');}
async function done(page,state='complete'){await page.waitForFunction(s=>document.getElementById('reactionPanel').dataset.state===s,state,{timeout:180000});}
async function start(page){await page.locator('#reactionRun').click();}
async function snapshot(page){return page.evaluate(()=>({score:document.getElementById('pixelScore').textContent,status:document.getElementById('reactionStatus').textContent,range:document.getElementById('reactionRange').textContent,selected:document.getElementById('reactionSelected').textContent,rows:[...document.querySelectorAll('#reactionRows tr')].map(r=>r.innerText),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,calls:window.__calls,maskCalls:window.__maskCalls}));}
(async()=>{const base=await origin();try{
 for(const filename of ['index.html','reaction.js']){const local=fs.readFileSync(path.join(ROOT,'honmono/checker',filename));const res=await fetch(base+'/honmono/checker/'+filename);const remote=Buffer.from(await res.arrayBuffer());check('served-current-'+filename,local.equals(remote),crypto.createHash('sha256').update(remote).digest('hex'));}
 for(const engine of ['edge','webkit']){
 const browser=engine==='edge'?await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}):await webkit.launch();
 try{const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();watch(page);
 await page.goto(base+'/honmono/checker/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 const unit=await page.evaluate(async()=>{
   const A=HonmonoReaction,raw=new Uint8ClampedArray(256*256*4);for(let i=0;i<raw.length;i++)raw[i]=i%251;
   const covered=new Uint8Array(256*256);let outside=true,changed=true,alpha=true;
   for(let n=0;n<9;n++){const r=A.rect(n,256);for(let y=r.y0;y<r.y1;y++)for(let x=r.x0;x<r.x1;x++)covered[y*256+x]++;
     for(const kind of ['flat','coarse']){const d=A.altered(raw,256,n,kind).data;let any=false;
       for(let y=0;y<256;y++)for(let x=0;x<256;x++)for(let c=0;c<4;c++){const at=(y*256+x)*4+c,inside=x>=r.x0&&x<r.x1&&y>=r.y0&&y<r.y1;
         if(!inside&&d[at]!==raw[at])outside=false;if(c===3&&d[at]!==raw[at])alpha=false;if(inside&&d[at]!==raw[at])any=true;}changed=changed&&any;}}
   let abort=false;const ac=new AbortController();ac.abort();try{await A.analyze(new Blob(),.95,{signal:ac.signal});}catch(e){abort=e.name==='AbortError';}
   return {coverage:covered.every(n=>n===1),outside,changed,alpha,abort,
     positive:A.summarize(.95,.6,.7,0).direction,negative:A.summarize(.5,.8,.9,0).direction,mixed:A.summarize(.5,.2,.8,0).direction,small:A.summarize(.5,.49,.49,0).direction};
 });
 for(const k of ['coverage','outside','changed','alpha','abort'])check(engine+'/engine/'+k,unit[k],unit);
 check(engine+'/direction-and-disagreement',unit.positive==='down'&&unit.negative==='up'&&unit.mixed==='mixed'&&unit.small==='mixed',unit);
 await stub(page);const bytes=await fixture(page);
 const roundtrip=await page.evaluate(async b64=>{
   const file=new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'image/png'});
   const original=HonmonoPixel.predict;HonmonoPixel.predict=async()=>({pAI:.801});let blocked=false;
   try{await HonmonoReaction.analyze(file,.799);}catch(e){blocked=e.message.includes('元のスコア');}
   HonmonoPixel.predict=async()=>({pAI:.95});const r=await HonmonoReaction.analyze(file,.95);
   HonmonoPixel.predict=original;return {blocked,evaluations:r.evaluations};
 },bytes.toString('base64'));
 check(engine+'/roundtrip-cannot-cross-threshold',roundtrip.blocked,roundtrip);
 check(engine+'/count-without-progress-callback',roundtrip.evaluations===19,roundtrip);
 await select(page,bytes);
 check(engine+'/optional-analysis-does-not-run-automatically',await page.evaluate(()=>__maskCalls===0&&document.getElementById('reactionPanel').hidden===false));
 check(engine+'/metadata-separated',(await page.locator('[data-capability-id="F022"]').first().innerText()).includes('別の検査'));
 await start(page);await done(page);let state=await snapshot(page);
 check(engine+'/measured-values-and-primary-preserved',state.score==='95 / 100'&&state.rows.length===9&&state.selected.includes('95.0→60.0')&&state.selected.includes('95.0→65.0')&&state.maskCalls===19,state);
 check(engine+'/range-and-limit',(await page.locator('#reactionResults').innerText()).includes('AIで作られた場所を示すものではありません')&&state.range.includes('60.0〜99.9'),state);
 await page.locator('#reactionGrid button').nth(2).click();check(engine+'/mixed-region-not-claimed',(await page.locator('#reactionSelected').innerText()).includes('特定できません'));
 await page.locator('#reactionGrid button').nth(1).click();check(engine+'/opposing-effect-not-AI-evidence',(await page.locator('#reactionSelected').innerText()).includes('AI判定の根拠とは説明できません'));
 for(const width of [360,390,430,768,1280,1440]){await page.setViewportSize({width,height:width<500?844:1000});
 const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#reactionGrid button')].map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height};})}));
 check(engine+'/layout/'+width,!layout.overflow&&layout.buttons.every(b=>b.w>=44&&b.h>=44),layout);
 if([390,1440].includes(width))await page.locator('#reactionPanel').screenshot({path:path.join(OUT,engine+'-'+width+'-reaction.png')});}
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{__mode='flat';__maskCalls=0;});await start(page);await done(page);
 check(engine+'/no-location-does-not-invent-reason',(await page.locator('#reactionStatus').innerText()).includes('特定できません')&&(await page.locator('#reactionStability').innerText()).includes('独立した18個の証拠でも'));
 await page.evaluate(()=>{__mode='mismatch';__maskCalls=0;});await start(page);await done(page,'error');
 check(engine+'/baseline-mismatch-blocked',await page.evaluate(()=>__maskCalls===1&&document.getElementById('reactionResults').hidden&&document.getElementById('pixelScore').textContent==='95 / 100'));
 await page.evaluate(()=>{__mode='error';__maskCalls=0;});await start(page);await done(page,'error');
 check(engine+'/error-retains-score-and-retry',await page.locator('#reactionRun').isEnabled()&&(await page.locator('#pixelScore').innerText())==='95 / 100');
 await page.evaluate(()=>{__mode='normal';__maskCalls=0;});await start(page);await done(page);
 check(engine+'/retry-completes',await page.locator('#reactionResults').isVisible());
 await page.evaluate(()=>{__maskCalls=0;__delay=120;});await start(page);await page.locator('#reactionCancel').click();await done(page,'canceled');
 check(engine+'/cancel-preserves-original',!(await page.locator('#reactionResults').isVisible())&&(await page.locator('#pixelScore').innerText())==='95 / 100');
 await page.evaluate(()=>{__maskCalls=0;});await start(page);await select(page,bytes,'replacement.png');await page.waitForTimeout(300);
 check(engine+'/file-replacement-cancels-stale-result',await page.evaluate(()=>document.getElementById('reactionPanel').dataset.state==='ready'&&document.getElementById('reactionResults').hidden&&document.getElementById('reactionImage').getAttribute('src')===null&&document.getElementById('fileName').textContent==='replacement.png'));
 await page.locator('#file').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});await page.waitForFunction(()=>document.getElementById('fileMeta').textContent.includes('不明'));
 check(engine+'/invalid-file-clears-explanation',!(await page.locator('#reactionPanel').isVisible()));
 await context.close();
 if(process.env.REAL_SAMPLES){const samples=JSON.parse(fs.readFileSync(process.env.REAL_SAMPLES,'utf8'));
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const live=await ctx.newPage();watch(live);
 await live.goto(base+'/honmono/checker/',{waitUntil:'networkidle'});
 await live.evaluate(()=>{const original=HonmonoPixel.predict;window.__realPredictions=[];HonmonoPixel.predict=async(...a)=>{const r=await original(...a);__realPredictions.push(r);return r;};});
 for(const sample of samples){await live.evaluate(()=>window.__realPredictions=[]);await live.locator('#file').setInputFiles(sample.path);await live.waitForFunction(()=>document.getElementById('pixelResult').style.display==='block',null,{timeout:180000});
 const before=await live.locator('#pixelScore').innerText();await start(live);await done(live);
 const stats=await snapshot(live),predictions=await live.evaluate(()=>__realPredictions);real.push({engine,name:sample.name,source:sample.source,label:sample.label,stats,predictions});
 check(engine+'/real/'+sample.name,predictions.length===20&&predictions.every(r=>r.backend==='wasm'&&Number.isFinite(r.pAI))&&Math.abs(predictions[0].pAI-predictions[1].pAI)<=.005&&stats.score===before&&stats.rows.length===9,stats);
 await live.locator('#reactionPanel').screenshot({path:path.join(OUT,engine+'-real-'+sample.name+'.png')});
 if(sample.name==='user-jpeg') { await live.locator('#reactionTitle').scrollIntoViewIfNeeded(); await live.screenshot({path:path.join(OUT,engine+'-390-user-viewport.png')}); }
 console.log('REAL',engine,sample.name,stats.score);}
 await ctx.close();}
 }finally{await browser.close();}
 }
 check('no-page-errors',errors.length===0,errors);
 check('no-image-upload-or-external-request',requests.every(r=>!r.body&&['GET','HEAD'].includes(r.method)&&(!r.url.startsWith('http')||new URL(r.url).origin===base)),requests.filter(r=>r.body));
}finally{if(server)await new Promise(r=>server.close(r));}
const result={at:new Date().toISOString(),target:base,checks:records.length,passed:records.filter(r=>r.pass).length,failed:records.filter(r=>!r.pass),records,real};
fs.writeFileSync(path.join(OUT,'reaction-results.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(OUT,'network-requests.json'),JSON.stringify(requests,null,2));console.log(JSON.stringify({checks:result.checks,passed:result.passed,failed:result.failed.length,real:real.length}));process.exitCode=result.failed.length?1:0;
})().catch(e=>{console.error(e);if(server)server.close();process.exitCode=1;});
