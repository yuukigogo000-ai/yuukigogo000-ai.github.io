"""Actual game + billing UI acceptance; store responses are test doubles, never real charges.
Usage: python billing-browser.py REPO OUTPUT
Requires Playwright Chromium and WebKit. No runtime test hook is shipped.
"""
from pathlib import Path
import functools, hashlib, http.server, json, sys, threading, traceback
from playwright.sync_api import sync_playwright
root, out = map(Path, sys.argv[1:3]); out.mkdir(parents=True, exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
results=[]
bridge='''async () => {
 const {installBilling}=await import('/pachinko/mobile/src/billing-ui.js');
 window.qa={owned:false,mode:'success',calls:0,listener:null};
 const state=(extra={})=>({productId:'pachinko_full_version',owned:qa.owned,...extra});
 const store={
  getState:async()=>state(), refresh:async()=>state(),
  getProduct:async()=>({productId:'pachinko_full_version',amount:300,currency:'JPY',price:'￥300'}),
  purchase:async()=>{qa.calls++;if(qa.mode==='error')throw Error('injected');
    if(qa.mode==='cancel')return state({status:'cancelled'});
    if(qa.mode==='pending')return state({pending:true});
    if(qa.mode==='wait')await new Promise(r=>qa.complete=r);
    qa.owned=true;return state({status:'purchased'});},
  restore:async()=>{qa.owned=true;return state({status:'purchased'});},
  addListener:async(_,f)=>{qa.listener=f;return {remove(){}}}
 };
 installBilling(store,window.PachiBillingGame);
}'''
def fresh(browser, native=True, width=390, height=844, install=True):
    ctx=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce',service_workers='block')
    ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
    if native:ctx.add_init_script('window.PachiBillingRequired=true')
    p=ctx.new_page();p.set_default_timeout(12000);p.goto(origin+'/pachinko/')
    if install and native:
        p.evaluate(bridge);p.wait_for_function("() => !document.querySelector('[data-billing=buy]').disabled")
    return ctx,p

def begin(p,day=30):
    p.evaluate("day=>{startGame('normal');closeModal();state.day=day;state.money=30000000;Math.random=()=>0.5;renderAll();save(true)}",day)

def snap(p):return p.evaluate('({state:JSON.stringify(state),save:localStorage.getItem(SAVE_KEY)})')
def finish(p):
    p.wait_for_function('() => !busy')
    for _ in range(4):
        if not p.locator('#modalBg.show').count():break
        p.evaluate('closeModal()')

def check(engine,name,fn,browser):
    if len(sys.argv)>3 and name!=sys.argv[3]:return
    try:
        data=fn(browser);r={'engine':engine,'case':name,'status':'PASS','data':data}
    except Exception as e:r={'engine':engine,'case':name,'status':'FAIL','error':str(e),'traceback':traceback.format_exc()}
    results.append(r);print(json.dumps(r,ensure_ascii=True),flush=True)
    (out/'results.json').write_text(json.dumps({'store':'test double, not real store verification','results':results},ensure_ascii=False,indent=2),encoding='utf-8')

def boundary(b):
    ctx,p=fresh(b)
    try:
        begin(p,29)
        for day in [30,31]:
            p.locator('#btnOpen').click();finish(p);assert p.evaluate('state.day')==day
        before=snap(p);p.locator('#btnOpen').click();assert p.locator('#pachiPurchase').is_visible();assert snap(p)==before
        p.reload();p.evaluate(bridge);p.evaluate('hideLaunch();closeModal()');assert p.evaluate('state.day')==31
        before=snap(p);p.locator('#btnOpen').click();assert snap(p)==before
        assert p.locator('#pachiPurchase').is_visible()
        return {'day29_30_31':True,'blocked_day31_state_and_saved_bytes_unchanged':True,'reload_preserved':True}
    finally:ctx.close()

def legacy(b):
    ctx,p=fresh(b)
    try:
        begin(p,60);before=snap(p)
        p.locator('#btnOpen').click();assert snap(p)==before
        p.locator('[data-billing=restore]').click();p.wait_for_function('() => PachiBilling.canOpen(60)');assert snap(p)==before
        p.locator('[data-billing=close]').click();p.locator('#btnOpen').click();finish(p)
        assert p.evaluate('state.day')==61
        return {'existing_day60_preserved':True,'restore_continue_day61':True}
    finally:ctx.close()

def purchase(b):
    ctx,p=fresh(b)
    try:
        begin(p,31);before=snap(p);p.locator('#btnOpen').click();p.evaluate("qa.mode='wait'")
        p.locator('[data-billing=buy]').click();p.wait_for_function('() => qa.calls===1')
        p.evaluate("for(let i=0;i<10;i++)document.querySelector('[data-billing=buy]').click();document.querySelector('[data-billing=restore]').click()")
        assert p.evaluate('qa.calls')==1 and snap(p)==before
        p.evaluate('qa.complete()');p.wait_for_function('() => PachiBilling.canOpen(31)');assert snap(p)==before
        p.locator('[data-billing=close]').click();p.locator('#btnOpen').click();finish(p);assert p.evaluate('state.day')==32
        p.evaluate("startGame('normal');closeModal()");assert p.evaluate('PachiBilling.canOpen(31)')
        return {'one_purchase_for_repeat_taps':True,'no_automatic_business_day':True,'day32_after_purchase':True,'replay_retains_ownership':True}
    finally:ctx.close()

def failures(b):
    ctx,p=fresh(b)
    try:
        begin(p,31);before=snap(p);p.locator('#btnOpen').click()
        for mode,word in [('cancel','キャンセル'),('error','確認できません'),('pending','承認待ち')]:
            p.evaluate('(mode)=>qa.mode=mode',mode);p.locator('[data-billing=buy]').click()
            p.wait_for_function('(word)=>document.querySelector("[data-billing=status]").textContent.includes(word)',arg=word)
            assert not p.evaluate('PachiBilling.canOpen(31)') and snap(p)==before
        p.evaluate("qa.owned=true;qa.listener({productId:'pachinko_full_version',owned:true})")
        assert p.evaluate('PachiBilling.canOpen(31)') and snap(p)==before
        return {'cancel_error_pending_preserve_save':True,'late_approval_unlocks':True}
    finally:ctx.close()

def keyboard(b):
    ctx,p=fresh(b)
    try:
        begin(p,31);p.evaluate("setArea('mgmt')");before=snap(p);p.locator('#btnOpen').click()
        for _ in range(15):
            p.keyboard.press('Shift+Tab')
            assert p.evaluate('document.getElementById("pachiPurchase").contains(document.activeElement)')
        p.evaluate("for(let i=0;i<15;i++){document.getElementById('btnBorrow').click();document.getElementById('btnOpen').click()}")
        assert snap(p)==before
        p.locator('[data-billing=close]').click();p.wait_for_function("() => !document.getElementById('app').inert")
        debt=p.evaluate('state.debt');p.locator('#btnBorrow').click();assert p.evaluate('state.debt')>debt
        return {'focus_trapped':True,'background_mutation_blocked':True,'normal_controls_restored':True}
    finally:ctx.close()

def missing(b):
    ctx,p=fresh(b,install=False)
    try:
        begin(p,30);p.locator('#btnOpen').click();finish(p);assert p.evaluate('state.day')==31
        before=snap(p);p.locator('#btnOpen').click();assert snap(p)==before
        return {'module_failure_still_allows_day30_and_blocks_day31':True}
    finally:ctx.close()

def web(b):
    ctx,p=fresh(b,native=False)
    try:
        begin(p,31);p.locator('#btnOpen').click();finish(p);assert p.evaluate('state.day')==32
        assert p.locator('#pachiPurchase').count()==0
        return {'web_day31_unrestricted':True}
    finally:ctx.close()

def savefailure(b):
    ctx,p=fresh(b)
    try:
        begin(p,30);old=p.evaluate('localStorage.getItem(SAVE_KEY)')
        p.evaluate("window.orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('injected');return orig.call(this,k,v)}; void 0;")
        p.locator('#btnOpen').click();finish(p);assert p.evaluate('state.day')==31
        assert p.evaluate('localStorage.getItem(SAVE_KEY)')==old
        assert p.locator('#saveWarning').is_visible()
        p.reload();assert p.evaluate('state.day')==30
        return {'day30_save_failure_warns_and_keeps_previous_save':True}
    finally:ctx.close()

def layout(b):
    evidence=[]
    for width,height in [(390,844),(375,667)]:
        ctx,p=fresh(b,width=width,height=height)
        try:
            entry=p.locator('#launchTitle .billing-entry');assert entry.is_visible()
            bb=entry.bounding_box();assert bb['x']>=0 and bb['x']+bb['width']<=width+1
            p.screenshot(path=str(out/f'{engine}-{width}-title.png'))
            entry.click();assert p.locator('#pachiPurchase').is_visible()
            p.locator('[data-billing=buy]').scroll_into_view_if_needed();assert p.locator('[data-billing=buy]').is_visible()
            p.screenshot(path=str(out/f'{engine}-{width}-purchase.png'))
            assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
            p.locator('[data-billing=close]').click()
            p.locator('#launchTitle [data-launch=settings]').last.click()
            settings=p.locator('#launchInfo .billing-entry');assert settings.is_visible()
            settings.click();assert p.locator('#pachiPurchase').is_visible()
            p.keyboard.press('Escape');assert not p.locator('#pachiPurchase').is_visible()
            assert p.locator('#launchInfo').is_visible(), 'Escape closed underlying settings' 
            evidence.append({'width':width,'height':height,'title_entry_box':bb,'settings_entry':True})
        finally:ctx.close()
    return evidence

try:
    with sync_playwright() as pw:
        for engine in ['chromium','webkit']:
            b=getattr(pw,engine).launch()
            for name,fn in [('boundary',boundary),('legacy-save',legacy),('purchase',purchase),('cancel-pending-error',failures),('keyboard-lock',keyboard),('bridge-unavailable',missing),('public-web',web),('save-failure-at-boundary',savefailure),('layout-title-settings',layout)]:check(engine,name,fn,b)
            b.close()
finally:
    server.shutdown()
    hashes={str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in [root/'pachinko/index.html',*(root/'pachinko/mobile/src').glob('*.js')]}
    (out/'results.json').write_text(json.dumps({'store':'test double, not real store verification','source_sha256':hashes,'results':results},ensure_ascii=False,indent=2),encoding='utf-8')
sys.exit(0 if results and all(r['status']=='PASS' for r in results) else 1)
