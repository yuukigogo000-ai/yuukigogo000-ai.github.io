"""Launch guide/settings regression. Run with Python + Playwright; optional public URL."""
import functools, http.server, threading, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
KEY = "pachi-teikoku-preferences-v1"
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
srv = None
if len(sys.argv) > 1: url = sys.argv[1]
else:
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_port}/pachinko/"
def until(p, expression):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if p.evaluate(expression): return
        p.wait_for_timeout(50)
    raise AssertionError("Timed out: " + expression + " " + str(p.evaluate("({rm:reduced(),media:matchMedia(\"(prefers-reduced-motion: reduce)\").matches,classes:document.documentElement.className,prefs:localStorage.getItem(\"pachi-teikoku-preferences-v1\")})")))
def fits(p):
    assert p.evaluate("document.querySelector('#launchInfo').scrollWidth <= innerWidth")
    assert p.locator(".pi-back").bounding_box()["y"] >= 0
    assert p.locator(".pi-back").bounding_box()["height"] >= 44
def settings(p):
    p.locator('[data-launch="settings"]').first.click()
    assert p.locator("#pachiInfoTitle").inner_text() == "設定"
def pref(p, name, value):
    p.locator(f'input[data-pref="{name}"][value="{value}"]').check()
with sync_playwright() as pw:
    for engine, width, height, scheme in [("chromium",360,800,"dark"), ("webkit",390,844,"light")]:
        browser = getattr(pw, engine).launch()
        ctx = browser.new_context(viewport={"width":width,"height":height}, device_scale_factor=3, is_mobile=True, has_touch=True, color_scheme=scheme, reduced_motion="no-preference", service_workers="block")
        p = ctx.new_page(); errors = []
        p.on("pageerror", lambda e: errors.append(str(e)))
        p.goto(url, wait_until="networkidle")
        original = p.evaluate("localStorage.getItem(SAVE_KEY)")
        p.locator('[data-launch="help"]').click(); fits(p)
        assert "1日の流れ" in p.locator("#piGuideBody").inner_text()
        p.locator('[data-guide-tab="strategy"]').click()
        assert p.locator(".pi-tip").count() == 6
        p.locator(".pi-tip summary").nth(1).click()
        assert p.locator(".pi-tip").nth(1).get_attribute("open") is not None
        p.locator('[data-guide-tab="difficulty"]').click()
        for diff in ["easy","normal","hard","hardx"]:
            card = p.locator(".pi-diff." + diff)
            assert p.evaluate("d=>yen(DIFFS[d].money)",diff) in card.inner_text()
            assert str(p.evaluate("d=>LIMIT_DAYS[d]",diff))+"日" in card.inner_text()
        assert p.evaluate("localStorage.getItem(SAVE_KEY)") == original
        p.locator('[data-info="difficulty"]').click()
        assert p.locator("#launchInfo").is_hidden()
        assert p.locator("#launchDifficulty").evaluate("n=>n.classList.contains('on')")
        p.locator('[data-launch="back-title"]').click()
        settings(p); fits(p)
        assert p.locator('input[value="auto"]').is_checked()
        pref(p,"motion","reduce"); pref(p,"business","quick")
        assert p.evaluate("reduced() && pachiShortBusiness()")
        assert p.evaluate("localStorage.getItem(SAVE_KEY)") == original
        p.reload(wait_until="networkidle"); settings(p)
        assert p.locator('input[value="reduce"]').is_checked()
        assert p.locator('input[value="quick"]').is_checked()
        pref(p,"motion","auto")
        assert not p.evaluate("reduced()")
        p.emulate_media(reduced_motion="reduce")
        until(p,"reduced() && parseFloat(getComputedStyle(document.querySelector('.pi-back')).animationDuration) < 0.001")
        p.emulate_media(reduced_motion="no-preference")
        until(p,"!reduced()")
        p.locator('[data-info="reset-prefs"]').click()
        assert not p.evaluate("pachiShortBusiness() || reduced()")
        p.locator('[data-info="close"]').click()
        assert p.locator("#launchInfo").is_hidden()
        assert p.evaluate("document.activeElement.dataset.launch") == "settings"
        p.locator('[data-launch="settings"]').last.click()
        p.locator('[data-info="close"]').click()
        assert p.locator('[data-launch="settings"]').last.evaluate("n=>n===document.activeElement")
        p.locator('[data-launch="begin"]').click()
        p.locator('[data-launch-diff="hard"]').click()
        p.locator('[data-launch="start-selected"]').click()
        assert p.locator("#launchDrawer").is_visible()
        p.locator('[data-launch="hard-expert"]').click()
        p.evaluate("closeModal()")
        assert p.evaluate("state.diff") == "hardx"
        p.reload(wait_until="networkidle"); p.evaluate("closeModal()"); settings(p)
        saved = p.evaluate("localStorage.getItem(SAVE_KEY)")
        assert "続きから遊べるデータがあります" in p.locator("#launchInfo").inner_text()
        pref(p,"business","quick"); p.locator('[data-info="reset-prefs"]').click()
        assert p.evaluate("localStorage.getItem(SAVE_KEY)") == saved
        p.locator('[data-info="continue"]').click()
        assert p.locator("#launchLayer").is_hidden()
        p.evaluate("startGame('easy');closeModal();window.guideDurations=[];const originalPlay=bdPlayDay;bdPlayDay=(s,done)=>{const t=performance.now();return originalPlay(s,()=>{guideDurations.push(performance.now()-t);done();});};void 0;")
        for i, mode in enumerate(["normal","quick"]):
            p.evaluate("closeModal();showLaunchTitle()"); settings(p); pref(p,"business",mode)
            p.locator('[data-info="continue"]').click()
            before = p.evaluate("state.day")
            p.locator("#btnOpen").click()
            until(p,f"guideDurations.length === {i+1}")
            assert p.evaluate("state.day") == before+1
            assert p.evaluate("JSON.parse(localStorage.getItem(SAVE_KEY)).day") == before+1
            assert p.locator("#dayVizBlocker").is_hidden()
        timings = p.evaluate("guideDurations")
        assert timings[0] >= 1000 and timings[1] < 1000, timings
        p.evaluate("closeModal();showLaunchTitle()"); settings(p)
        p.set_viewport_size({"width":844,"height":390}); fits(p)
        p.set_viewport_size({"width":width,"height":height}); fits(p)
        p.locator('[data-info="close"]').click()
        p.locator('[data-launch="help"]').click()
        p.locator('[data-guide-tab="basics"]').focus()
        p.keyboard.press("ArrowRight")
        assert p.locator('[data-guide-tab="strategy"]').get_attribute("aria-selected") == "true"
        p.keyboard.press("Escape")
        assert p.locator("#launchInfo").is_hidden()
        assert not errors, errors
        print("PASS",engine,"guide/navigation/preferences/save/real business day",timings,flush=True)
        ctx.close()
        # Invalid stored preferences and storage failures must remain usable.
        c = browser.new_context(service_workers="block")
        q = c.new_page()
        q.add_init_script(f"localStorage.setItem('{KEY}','{{broken-json')")
        q.goto(url,wait_until="networkidle"); settings(q)
        assert q.locator('input[value="auto"]').is_checked()
        q.evaluate("const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='pachi-teikoku-preferences-v1')throw new DOMException('Full','QuotaExceededError');return write.call(this,k,v)};void 0;")
        pref(q,"motion","reduce")
        assert q.evaluate("reduced()")
        assert "保存できませんでした" in q.locator("#piPrefsStatus").inner_text()
        print("PASS",engine,"invalid preferences and storage refusal",flush=True)
        c.close(); browser.close()
    # One installed service worker must serve the two new pages offline.
    browser = pw.chromium.launch()
    c = browser.new_context()
    p = c.new_page(); p.goto(url,wait_until="networkidle")
    p.evaluate("navigator.serviceWorker.ready")
    until(p,"navigator.serviceWorker.controller !== null")
    c.set_offline(True); p.reload(wait_until="load")
    p.locator('[data-launch="help"]').click()
    assert p.locator("#piGuideBody").is_visible()
    p.locator('[data-info="close"]').click(); settings(p)
    pref(p,"business","quick")
    assert p.evaluate("pachiShortBusiness()")
    print("PASS offline guide and settings",flush=True)
    c.close();browser.close()
if srv: srv.shutdown()
print("GUIDE_SETTINGS_COMPLETE",flush=True)
