"""Exact supplied artwork + launch-only scope and browser regression checks.
Uses isolated browser contexts; never opens a real player profile.
Run: python tests/pachinko_exact_assets_test.py --evidence <dir> [--url <published-url>]
"""
import argparse, functools, hashlib, http.server, json, re, subprocess, threading
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CHECKS = []
def check(name, value):
    CHECKS.append({'name':name,'pass':bool(value)})
    if not value: raise AssertionError(name)

def unchanged_game(before, after):
    scripts = lambda s: re.findall(r'<script\b[^>]*>.*?</script>',s,re.S)
    return scripts(before)==scripts(after) and before.split('<div id="app">',1)[1]==after.split('<div id="app">',1)[1]

def static_checks():
    before=subprocess.check_output(['git','show','452f9fe:pachinko/index.html'],cwd=ROOT).decode('utf-8')
    after=(ROOT/'pachinko/index.html').read_text(encoding='utf-8')
    check('All executable scripts and the complete game document unchanged',unchanged_game(before,after))
    check('Scope guard rejects injected game change',not unchanged_game(before,after.replace('state = newGame(diff);','state = newGame("easy");',1)))
    css=(ROOT/'pachinko/launch-v2.css').read_text(encoding='utf-8')
    refs=re.findall(r'url\("([^\"]+)"\)',css)
    check('No regenerated backgrounds referenced',all('/launch-v2/' not in p or p.endswith('.woff2') for p in refs))
    check('No screenshot used as full UI',all(not n in css for n in ['F368BB12','AF5F804B','7178D5CB']))
    assets=ROOT/'pachinko/art/launch-exact'
    manifest=json.loads((assets/'manifest.json').read_text(encoding='utf-8'))
    for item in manifest['assets']:
        p=assets/item['file'];im=Image.open(p);im.load()
        check('Decoded asset '+p.name,im.size==tuple(item['size']))
        check('Asset digest '+p.name,hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'])
    oldsw=subprocess.check_output(['git','show','452f9fe:pachinko/sw.js'],cwd=ROOT).decode('utf-8')
    newsw=(ROOT/'pachinko/sw.js').read_text(encoding='utf-8')
    check('Service worker handlers unchanged',oldsw.split('self.addEventListener',1)[1]==newsw.split('self.addEventListener',1)[1])

def layout_check(p,label):
    boxes=p.locator('#launchLayer .launch-screen.on button').evaluate_all('''es=>es.filter(e=>e.getClientRects().length).map(e=>({label:e.textContent||e.getAttribute('aria-label'),r:e.getBoundingClientRect().toJSON()}))''')
    width=p.viewport_size['width']
    check(label+' all touch targets >=44px',all(v['r']['height']>=43.9 for v in boxes))
    check(label+' no horizontal overflow',all(v['r']['left']>=-1 and v['r']['right']<=width+1 for v in boxes))
    check(label+' page width',p.evaluate('document.documentElement.scrollWidth <= innerWidth+1'))

def exercise(browser,url,w,h,label,out):
    ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=2,
        is_mobile=True,has_touch=True,service_workers='block',reduced_motion='reduce')
    p=ctx.new_page();errors=[];failures=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('response',lambda r:failures.append(str(r.status)+' '+r.url) if r.status>=400 else None)
    p.goto(url,wait_until='networkidle');p.evaluate('document.fonts.ready')
    check(label+' title visible',p.locator('#launchTitle.on').is_visible())
    check(label+' exact title scene', 'launch-exact/title-hall.webp' in p.locator('.launch-bg').evaluate('e=>getComputedStyle(e).backgroundImage'))
    check(label+' continue disabled without save',p.locator('#launchContinue').is_disabled())
    layout_check(p,label+' title')
    if w==390: p.screenshot(path=str(out/(label+'-title.png')))
    for action in ['settings','help']:
        p.locator('#launchTitle .launch-menu [data-launch="'+action+'"]').click()
        check(label+' '+action+' opens',p.locator('#launchDrawer').is_visible())
        p.locator('#launchDrawerContent [data-launch="close-drawer"]').click()
    p.locator('[data-launch="begin"]').click()
    check(label+' difficulty visible',p.locator('#launchDifficulty.on').is_visible())
    check(label+' four rules retained',p.locator('.launch-rule').count()==4)
    layout_check(p,label+' difficulty')
    check(label+' scroller clears heading',p.locator('.launch-diff-scroll').bounding_box()['y']>=p.locator('.launch-diff-head').bounding_box()['height'])
    for d in ['easy','normal','hard']:
        b=p.locator('[data-launch-diff="'+d+'"]');b.click()
        check(label+' selection '+d,b.get_attribute('aria-pressed')=='true' and p.locator('[data-launch-diff][aria-pressed="true"]').count()==1)
        bg=b.evaluate('e=>getComputedStyle(e,"::before").backgroundImage')
        check(label+' exact card '+d,'launch-exact/difficulty-'+d+'.webp' in bg)
    p.locator('.launch-diff-scroll').evaluate('e=>e.scrollTop=e.scrollHeight')
    if w==390:p.screenshot(path=str(out/(label+'-difficulty.png')))
    check(label+' hard card reachable',p.locator('[data-launch-diff="hard"]').bounding_box()['y']>=130)
    p.locator('[data-launch="back-title"]').click()
    check(label+' back returns to title',p.locator('#launchTitle.on').is_visible())
    p.locator('[data-launch="begin"]').click()
    p.locator('[data-launch-diff="normal"]').click()
    p.locator('[data-launch="start-selected"]').click()
    check(label+' normal game starts',p.evaluate('state.diff==="normal" && document.getElementById("launchLayer").hidden'))
    p.evaluate('closeModal();state.money+=12345;save(true)')
    saved=p.evaluate('localStorage.getItem(SAVE_KEY)')
    p.reload(wait_until='networkidle')
    p.locator('#launchTitle .launch-menu [data-launch="settings"]').click()
    p.locator('#launchDrawerContent [data-launch="close-drawer"]').click()
    p.locator('[data-launch="begin"]').click();p.locator('[data-launch="back-title"]').click()
    check(label+' menus preserve save bytes',saved==p.evaluate('localStorage.getItem(SAVE_KEY)'))
    p.locator('#launchContinue').click()
    check(label+' continue restores money',p.evaluate('state.money')==json.loads(saved)['money'])
    check(label+' no JS errors',not errors)
    check(label+' no failed resources',not failures)
    ctx.close()

def all_modes(browser,url):
    for mode,action in [('easy',None),('normal',None),('hard','hard-normal'),('hardx','hard-expert')]:
        ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
        p=ctx.new_page();p.goto(url,wait_until='load')
        p.locator('[data-launch="begin"]').click()
        p.locator('[data-launch-diff="'+('hard' if action else mode)+'"]').click()
        p.locator('[data-launch="start-selected"]').click()
        if action:p.locator('[data-launch="'+action+'"]').click()
        check('Start route '+mode,p.evaluate('state.diff')==mode)
        ctx.close()

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_args):pass

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--evidence',required=True);ap.add_argument('--url');args=ap.parse_args()
    out=Path(args.evidence);out.mkdir(parents=True,exist_ok=True);srv=None
    try:
        static_checks()
        if args.url:url=args.url
        else:
            srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
            threading.Thread(target=srv.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{srv.server_port}/pachinko/'
        with sync_playwright() as pw:
            for engine in ['chromium','webkit']:
                b=getattr(pw,engine).launch(headless=True)
                sizes=[(360,800),(390,844)]
                if engine=='chromium':sizes+=[(320,568),(430,932),(560,900),(844,390)]
                for w,h in sizes:
                    label=f'{engine}-{w}x{h}';exercise(b,url,w,h,label,out);print('PASS '+label,flush=True)
                if engine=='chromium':all_modes(b,url)
                b.close()
    finally:
        if srv:srv.shutdown()
        (out/'results.json').write_text(json.dumps(CHECKS,indent=2),encoding='utf-8')
    print(str(len(CHECKS))+' checks passed',flush=True)
if __name__=='__main__':main()
