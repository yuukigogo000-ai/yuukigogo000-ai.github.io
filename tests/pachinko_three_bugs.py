"""Reproduce QA01/02/04 on an isolated Chromium and WebKit profile.
Usage: python tests/pachinko_three_bugs.py <repository-root> <evidence-directory>
Requires Python Playwright; no existing player data is used.
"""
from pathlib import Path
import sys,json,functools,http.server,threading,hashlib
from playwright.sync_api import sync_playwright
repo=Path(sys.argv[1]); out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(repo)))
threading.Thread(target=srv.serve_forever,daemon=True).start(); origin=f'http://127.0.0.1:{srv.server_port}'; results=[]
def record(engine,name,ok,data):
 r=dict(engine=engine,name=name,passed=bool(ok),data=data);results.append(r);print(json.dumps(r,ensure_ascii=True),flush=True)
def setup(p):
 p.goto(origin+'/pachinko/');p.evaluate("startGame('normal');closeModal();setArea('mgmt');save(true)")
try:
 with sync_playwright() as pw:
  for engine in ['chromium','webkit']:
   b=getattr(pw,engine).launch();ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce');p=ctx.new_page();setup(p)
   x=p.evaluate('''()=>{window.savedBefore=localStorage.getItem(SAVE_KEY);state.money+=12345;window.writeOriginal=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('fixture','QuotaExceededError')};document.getElementById('btnSave').click();return {preserved:localStorage.getItem(SAVE_KEY)===savedBefore,live:state.money,saved:JSON.parse(savedBefore).money,text:document.body.innerText,toast:document.querySelector('#toasts .toast:last-child')?.textContent}}''')
   record(engine,'QA01-save-failure',x['preserved'] and 'セーブしました' not in (x['toast'] or '') and '保存できません' in x['text'],x)
   p.reload();x=p.evaluate('({money:state.money,saved:JSON.parse(localStorage.getItem(SAVE_KEY)).money})');record(engine,'QA01-old-save-reload',x['money']==x['saved']==6900000,x)
   p.locator('#launchContinue').click();p.evaluate("closeModal();setArea('mgmt');state.money+=12345");p.locator('#btnSave').click();x=p.evaluate('({money:state.money,saved:JSON.parse(localStorage.getItem(SAVE_KEY)).money,toast:document.querySelector("#toasts .toast:last-child")?.textContent})');p.reload();x['reloaded']=p.evaluate('state.money');record(engine,'QA01-normal-save-reload',x['money']==x['saved']==x['reloaded']==6912345 and x['toast']=='セーブしました',x)
   setup(p);p.evaluate('''()=>{state=newGame('normal');state.cap=20;state.staff=4;state.machines=Array.from({length:13},(_,i)=>({...makeMachine('p1'),uid:i+1,setting:6}));state.money=645570;Math.random=()=>0.999;renderAll();save(true);window.writes=[];const old=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)writes.push(JSON.parse(v));return old.call(this,k,v)}}''')
   p.locator('#btnOpen').click();p.locator('#resAmt').wait_for(state='visible');x=p.evaluate('({day:state.day,money:state.money,debt:state.debt,credit:creditLimit(),bankrupt:isBankrupt(),writes:writes.length,text:document.getElementById("modalBox").innerText})');p.reload();x['reload']=p.evaluate('({money:state.money,debt:state.debt,bankrupt:isBankrupt()})');record(engine,'QA02-upkeep-loan',x['money']==200000 and x['debt']==204919 and not x['bankrupt'] and x['reload']['debt']==204919,x)
   ctx.close();ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='no-preference');p=ctx.new_page();setup(p);p.evaluate('state.day=17;state.money=50000000;renderAll()');p.locator('#btnOpen').click();before=p.evaluate('({money:state.money,debt:state.debt,day:state.day,busy})');route=[]
   for _ in range(12):
    if not p.evaluate('busy'):break
    p.keyboard.press('Shift+Tab');f=p.evaluate('document.activeElement.id');route.append(f)
    if f=='btnBorrow':p.keyboard.press('Enter');break
   after=p.evaluate('({money:state.money,debt:state.debt,day:state.day,busy})');record(engine,'QA04-keyboard',before['busy'] and after['busy'] and before['money']==after['money'] and before['debt']==after['debt'] and 'btnBorrow' not in route,{'before':before,'after':after,'focusRoute':route})
   p.evaluate('''()=>{for(let i=0;i<30;i++){document.getElementById('btnBorrow').click();document.getElementById('btnOpen').click()}}''');x=p.evaluate('({money:state.money,debt:state.debt,day:state.day})');record(engine,'QA04-repeat-background',x['money']==before['money'] and x['debt']==before['debt'] and x['day']==before['day'],x)
   p.evaluate('bdSkip();bdSkip()');p.wait_for_function('() => !busy');p.evaluate('closeModal();closeModal();setArea("mgmt")');x=p.evaluate('''()=>{const old=state.debt;document.getElementById('btnBorrow').click();return {delta:state.debt-old,busy,inert:document.getElementById('app').inert,day:state.day}}''');record(engine,'QA04-resume-controls',x['delta']>0 and not x['busy'] and not x['inert'] and x['day']==before['day'],x)
   p.screenshot(path=str(out/(engine+'-restored.png')));ctx.close();b.close()
finally:
 (out/'results.json').write_text(json.dumps({'source_sha256':hashlib.sha256((repo/'pachinko/index.html').read_bytes()).hexdigest(),'results':results},ensure_ascii=False,indent=2),encoding='utf-8');srv.shutdown()
sys.exit(0 if results and all(x['passed'] for x in results) else 1)
