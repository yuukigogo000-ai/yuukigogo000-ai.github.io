'use strict';
// Real browser integration; all images remain in the browser. Evidence outside the public tree.
const { chromium } = require('playwright-core');
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),crypto=require('crypto');
const ROOT=path.resolve(process.env.SITE_ROOT||path.join(__dirname,'..','..'));
const OUT=path.resolve(process.env.EVIDENCE_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'honmono-evidence-')));
fs.mkdirSync(OUT,{recursive:true});
const records=[],errors=[],requests=[]; let server,browser;
function check(name,ok,detail=''){records.push({name,pass:!!ok,detail}); if(!ok)console.error('FAIL',name,detail);}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
async function origin(){
  if(process.env.BASE_URL)return process.env.BASE_URL.replace(/\/$/,'');
  server=http.createServer((q,s)=>{
    try{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';
      const p=path.resolve(ROOT,'.'+u);if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){s.writeHead(404);s.end();return;}
      s.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(s);
    }catch{ s.writeHead(400);s.end(); }
  });
  await new Promise((resolve,reject)=>{server.on('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return 'http://127.0.0.1:'+server.address().port;
}
function edge(){for(const p of ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'])if(fs.existsSync(p))return p;throw Error('Edge not found');}
function watch(page){page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({method:r.method(),url:r.url(),post:!!r.postData()}));}
async function main(){
 const base=await origin(); browser=await chromium.launch({executablePath:edge(),headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 const page=await ctx.newPage();watch(page);
 await page.goto(base+'/honmono/',{waitUntil:'networkidle'});
 check('home legal/report navigation',(await page.locator('a[href="legal/terms.html"]').count())>0&&(await page.locator('a[href="report/"]').count())>0);
 await page.screenshot({path:path.join(OUT,'home-390.png'),fullPage:true});
 await page.goto(base+'/honmono/report/',{waitUntil:'networkidle'});
 check('report uses integrated header',await page.locator('.site-header .nav').count()===1);
 await page.screenshot({path:path.join(OUT,'report-390.png'),fullPage:true});
 await page.goto(base+'/honmono/badge/',{waitUntil:'networkidle'});
 await page.locator('#generate').click();check('empty name focus',await page.locator('#name').evaluate(e=>e===document.activeElement));
 const malicious='https://example.org/" onmouseover="window.__xss=1';
 await page.locator('#name').fill('<img src=x onerror=window.__xss=1>');
 await page.locator('#proofUrl').fill(malicious);await page.locator('#links').fill('javascript:window.__xss=1\nhttps://example.org/profile');
 await page.locator('#statement').fill('<script>window.__xss=1</script>');await page.locator('#generate').click();
 check('badge parent injection rejected',await page.evaluate(()=>!window.__xss));
 check('badge output has no injected attributes',await page.evaluate(()=>{const d=new DOMParser().parseFromString(document.getElementById('snippetHtml').textContent,'text/html');return !d.querySelector('[onmouseover],[onerror],script');}));
 check('proof preview sandboxed',await page.locator('#previewFrame').getAttribute('sandbox')!==null);
 const proof=await page.locator('#previewFrame').getAttribute('srcdoc');
 check('proof name escaped',proof.includes('&lt;img')&&!proof.includes('<script>'));
 check('dangerous URL omitted',!proof.includes('href="javascript:'));
 await page.locator('#name').fill('HONMONO TEST');await page.locator('#proofUrl').fill('https://example.org/proof?a=1&b=2');await page.locator('#generate').click();
 check('HTML snippet attribute escaped',(await page.locator('#snippetHtml').innerText()).includes('a=1&amp;b=2'));
 const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const dl=await downloadPromise;
 check('proof HTML downloadable',dl.suggestedFilename()==='honmono-proof.html');await dl.saveAs(path.join(OUT,'generated-proof-test.html'));
 await page.goto(base+'/honmono/creators/',{waitUntil:'networkidle'});
 check('creators remain anonymous samples',(await page.locator('body').innerText()).includes('まだ0件')&&!(await page.locator('#list').innerText()).match(/葉山|如月|真田|音無/));
 await page.locator('#q').fill('NO_MATCH_20260917');check('creator empty state',await page.locator('#empty').isVisible());
 await page.goto(base+'/honmono/aicheck/',{waitUntil:'networkidle'});
 const before=Number(await page.locator('#scoreNum').innerText());await page.locator('#r0').check();
 check('account risk score responds',Number(await page.locator('#scoreNum').innerText())>before);
 await page.locator('#r0').uncheck();check('account risk score resets',Number(await page.locator('#scoreNum').innerText())===before);
 await page.goto(base+'/honmono/checker/',{waitUntil:'networkidle'});
 const cfg=await page.evaluate(()=>({available:HonmonoPixel.available(),...HonmonoPixel.cfg}));
 check('pixel detector enabled',cfg.available===true&&cfg.enabled===true&&cfg.parts.length===2);
 check('model configuration declared',cfg.totalBytes>80e6&&cfg.totalBytes<120e6&&cfg.threshold>0&&cfg.threshold<1,JSON.stringify({version:cfg.version,threshold:cfg.threshold}));
 function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
 function chunk(type,b){const tag=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(b.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,b])));return Buffer.concat([len,tag,b,crc]);}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6;
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('tEXt',Buffer.from('parameters\0<img src=x onerror=window.__xss=1>')),chunk('IDAT',require('zlib').deflateSync(Buffer.from([0,22,40,60,255]))),chunk('IEND',Buffer.alloc(0))]);
 await page.locator('#file').setInputFiles({name:'<script>alert(1)</script>.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>document.getElementById('fileMeta').textContent.includes('PNG'));
 check('AI metadata recognized',(await page.locator('#verdict').innerText()).includes('AI生成'));
 check('metadata injection escaped',await page.evaluate(()=>!window.__xss&&document.querySelectorAll('#findings img,#findings script').length===0));
 check('pixel card visible for valid image',await page.locator('#pixelCard').isVisible());
 await page.locator('#file').setInputFiles({name:'unsupported.txt',mimeType:'application/octet-stream',buffer:Buffer.from('not an image')});await page.waitForFunction(()=>document.getElementById('fileMeta').textContent.includes('不明'));
 check('unsupported file clears pixel state',!(await page.locator('#pixelCard').isVisible()));
 const oversized=await page.evaluate(async()=>{await handle({name:'oversized.jpg',size:301*1024*1024});return document.getElementById('fileMeta').textContent.includes('大きすぎ')&&document.getElementById('pixelCard').style.display==='none';});
 check('oversized file rejected before decoding',oversized);
 const race=await page.evaluate(async()=>{
  const original=analyze;analyze=async file=>{await new Promise(r=>setTimeout(r,file.name==='old.png'?80:1));return {format:'JPEG',findings:[],meta:{source:file.name},xmp:'',verdict:'unknown',hasC2PA:false};};
  try{await Promise.all([handle(new File(['old'],'old.png',{type:'image/png'})),handle(new File(['new'],'new.png',{type:'image/png'}))]);return document.getElementById('metaTable').textContent.includes('new.png');}finally{analyze=original;}
 });check('late old-file result cannot overwrite new-file result',race);
 if(!process.env.REFERENCE_PREDICTIONS||!process.env.IMAGE_DIR)throw Error('REFERENCE_PREDICTIONS and IMAGE_DIR required for real inference');
 const reference=JSON.parse(fs.readFileSync(process.env.REFERENCE_PREDICTIONS,'utf8'));
 const samples=[];for(let i=0;i<10;i++)for(const set of ['mj6','tellif','eddy','faces'])for(const label of ['ai','real']){const m=reference.filter(x=>x.set===set&&x.label===label)[i];if(m)samples.push(m);}
 const chosen=(process.env.ALL_REFERENCE_SAMPLES==='1'?reference:samples).slice(0,Number(process.env.MAX_SAMPLES||80));const first=chosen[0];
 await page.locator('#file').setInputFiles(path.join(process.env.IMAGE_DIR,first.file));await page.waitForFunction(()=>document.getElementById('pixelCard').style.display==='block');
 await page.route('**/honmono/vendor/models/*.onnx.part*',r=>r.abort('failed'));
 await page.locator('#pixelRun').click();await page.waitForFunction(()=>document.getElementById('pixelProgress').textContent.includes('実行できませんでした'),null,{timeout:45000});
 check('model download failure is visible and retryable',await page.locator('#pixelRun').isVisible());
 await page.unroute('**/honmono/vendor/models/*.onnx.part*');
 await page.evaluate(()=>{const original=HonmonoPixel.predict;HonmonoPixel.predict=async(...args)=>{const r=await original(...args);window.__lastPixel=r;return r;};});
 await page.locator('#pixelRun').click();await page.waitForFunction(()=>document.getElementById('pixelResult').style.display==='block',null,{timeout:180000});
 check('real pixel inference via UI',await page.evaluate(()=>Number.isFinite(window.__lastPixel.pAI)));
 check('score is not presented as calibrated probability',(await page.locator('#pixelMeta').innerText()).includes('確率ではありません'));
 await page.screenshot({path:path.join(OUT,'checker-inference-390.png'),fullPage:true});
 const measured=[];
 for(const m of chosen){
   const encoded=fs.readFileSync(path.join(process.env.IMAGE_DIR,m.file)).toString('base64');
   const r=await page.evaluate(async({encoded,name})=>{const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));return await HonmonoPixel.predict(new File([bytes],name,{type:'image/jpeg'}));},{encoded,name:m.file});
   measured.push({file:m.file,label:m.label,set:m.set,reference:m.p,browser:r.pAI,backend:r.backend,ms:r.ms});
   if(measured.length%10===0)console.log('INFERENCE',measured.length,chosen.length);
 }
 const agree=measured.filter(m=>(m.reference>=cfg.threshold)===(m.browser>=cfg.threshold)).length;
 const mae=measured.reduce((sum,m)=>sum+Math.abs(m.reference-m.browser),0)/measured.length;
 check('browser/native classification parity',agree/measured.length>=.95,`${agree}/${measured.length}`);
 check('browser/native mean absolute score error',mae<.05,String(mae));
 fs.writeFileSync(path.join(OUT,'browser-predictions.json'),JSON.stringify({version:cfg.version,threshold:cfg.threshold,n:measured.length,agreement:agree/measured.length,mae,measured},null,2));
 const batchInputs=chosen.slice(0,2).map(m=>({name:m.file,data:fs.readFileSync(path.join(process.env.IMAGE_DIR,m.file)).toString('base64')}));
 const parallel=await page.evaluate(async inputs=>Promise.all(inputs.map(x=>HonmonoPixel.predict(new File([Uint8Array.from(atob(x.data),c=>c.charCodeAt(0))],x.name,{type:'image/jpeg'})))),batchInputs);
 check('concurrent callers complete with finite results',parallel.length===2&&parallel.every(x=>Number.isFinite(x.pAI)));
 check('concurrent inference preserves each image result',parallel.every((x,i)=>Math.abs(x.pAI-measured[i].browser)<.00001));
 const damaged=await ctx.newPage();watch(damaged);
 await damaged.goto(base+'/honmono/checker/',{waitUntil:'networkidle'});
 await damaged.evaluate(async()=>{const c=await caches.open(HonmonoPixel.cfg.cacheName);await c.put(new URL(HonmonoPixel.cfg.parts[1],location.href).href,new Response(new Uint8Array([1,2,3])));});
 await damaged.locator('#file').setInputFiles(path.join(process.env.IMAGE_DIR,first.file));await damaged.locator('#pixelRun').click();
 await damaged.waitForFunction(()=>document.getElementById('pixelProgress').textContent.includes('整合性'),null,{timeout:90000});
 check('corrupt cached weights fail integrity verification',await damaged.locator('#pixelRun').isVisible());
 const cleared=await damaged.evaluate(async()=>{const c=await caches.open(HonmonoPixel.cfg.cacheName);for(const u of HonmonoPixel.cfg.parts){if(await c.match(new URL(u,location.href).href))return false;}return true;});
 check('invalid cached parts are removed together',cleared);
 await damaged.locator('#pixelRun').click();await damaged.waitForFunction(()=>document.getElementById('pixelResult').style.display==='block',null,{timeout:180000});
 check('integrity error is recoverable by explicit retry',await damaged.locator('#pixelResult').isVisible());await damaged.close();
 const stale=await page.evaluate(async()=>{
  const original=HonmonoPixel.predict;HonmonoPixel.predict=async()=>{await new Promise(r=>setTimeout(r,80));return {pAI:.99,ms:80,backend:'fault-injection'};};
  try{const pending=runPixel();await handle(new File(['unsupported'],'new.txt',{type:'text/plain'}));await pending;return document.getElementById('pixelCard').style.display==='none'&&document.getElementById('pixelResult').style.display==='none';}finally{HonmonoPixel.predict=original;}
 });check('late pixel result cleared after unsupported replacement',stale);
 const denied=await ctx.newPage();watch(denied);
 await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new DOMException('denied','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('denied','SecurityError');};});
 await denied.goto(base+'/honmono/checker/',{waitUntil:'networkidle'});await denied.locator('#file').setInputFiles({name:'test.png',mimeType:'image/png',buffer:png});
 await denied.waitForFunction(()=>document.getElementById('pixelCard').style.display==='block');check('storage denial does not break analysis',await denied.locator('#pixelCard').isVisible());await denied.close();
 check('no image or form uploads',requests.every(r=>!r.post&&['GET','HEAD'].includes(r.method)));
 const external=requests.filter(r=>r.url.startsWith('http')&&new URL(r.url).origin!==new URL(base).origin);
 check('no unrequested external requests',external.length===0,JSON.stringify(external));
 check('no JavaScript exceptions',errors.length===0,errors.join(' | '));
 await ctx.close();
}
(async()=>{
 try{await main();}catch(e){check('uncaught integration failure',false,e.stack||String(e));}
 finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
 const result={testedAt:new Date().toISOString(),target:process.env.BASE_URL||'local isolated worktree',checks:records.length,passed:records.filter(r=>r.pass).length,failed:records.filter(r=>!r.pass),records};
 fs.writeFileSync(path.join(OUT,'integration-results.json'),JSON.stringify(result,null,2));
 console.log('INTEGRATION_RESULT',JSON.stringify({checks:result.checks,passed:result.passed,failed:result.failed}));
 process.exitCode=result.failed.length?1:0;
})();
