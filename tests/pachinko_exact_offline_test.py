"""Offline launch verification in an isolated profile. Run from any directory."""
import functools,http.server,threading,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True);ctx=b.new_context(viewport={'width':390,'height':844});p=ctx.new_page()
    p.goto(f'http://127.0.0.1:{srv.server_port}/pachinko/',wait_until='networkidle')
    p.evaluate('''async()=>{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('SW timeout')),45000))]);if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));}''')
    p.evaluate('startGame("normal");closeModal();state.money+=789;save(true)')
    saved=p.evaluate('localStorage.getItem(SAVE_KEY)')
    ctx.set_offline(True);p.reload(wait_until='load')
    assert p.locator('#launchTitle.on').is_visible()
    assert saved==p.evaluate('localStorage.getItem(SAVE_KEY)')
    assets=p.evaluate('''async()=>{let names=['title-hall','difficulty-easy','difficulty-normal','difficulty-hard','crown','gear','divider','panel-dark'];for(let n of names){const im=new Image();im.src='./art/launch-exact/'+n+'.webp';await im.decode();if(!im.naturalWidth)throw Error(n);}return names.length}''')
    p.locator('[data-launch="begin"]').click();assert p.locator('#launchDifficulty.on').is_visible()
    p.locator('[data-launch="back-title"]').click();p.locator('#launchContinue').click()
    assert p.evaluate('state.money')==json.loads(saved)['money']
    print('PASS offline title, difficulty, '+str(assets)+' assets, save bytes and continue',flush=True)
    b.close()
srv.shutdown()
