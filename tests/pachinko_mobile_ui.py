"""Mobile UI regression checks. Requires Python Playwright + Chromium/WebKit.
Run: python tests/pachinko_mobile_ui.py --evidence <directory>
Use --url <published /pachinko/ URL> to verify the deployed app in isolated contexts.
No existing browser profile or player save is opened by this test.
"""
import argparse
import functools
import http.server
import json
import re
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

CHECKS = []
def check(name, value):
    CHECKS.append({"name": name, "pass": bool(value)})
    assert value, name

def exercise(browser, url, width, evidence, label):
    ctx = browser.new_context(viewport={"width": width, "height": 844},
        is_mobile=True, has_touch=True, reduced_motion="reduce", service_workers="block")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url, wait_until="load")
    page.evaluate("startGame('normal');ceInit();renderAll();save(true)")
    for outcome in ["min", "small", "win", "top"]:
        page.evaluate("o => ceShowResult(ceOf('evt11'),o,{tx:ceOf('evt11').minor.tx})", outcome)
        before = page.evaluate("JSON.stringify(state)")
        saved = page.evaluate("localStorage.getItem(SAVE_KEY)")
        page.locator('[data-tile="closemodal"]').tap()
        check(f"{label}: bottom close {outcome}", not page.locator('#modalBg').is_visible())
        check(f"{label}: close keeps state {outcome}", page.evaluate("JSON.stringify(state)") == before)
        check(f"{label}: close keeps save {outcome}", page.evaluate("localStorage.getItem(SAVE_KEY)") == saved)
    for event in ["evt01", "evt11"]:
        page.evaluate("id => {const C=ceState();C.act=id;C.stage=0;C.due=0;ceOpen();}", event)
        for _ in range(3):
            page.locator('[data-cec="1"]').tap()
        check(f"{label}: event finishes {event}", page.evaluate("ceState().act === null"))
        before = page.evaluate("JSON.stringify(state)")
        page.locator('[data-tile="closemodal"]').tap()
        check(f"{label}: actual event closes {event}", not page.locator('#modalBg').is_visible())
        check(f"{label}: no double reward {event}", page.evaluate("JSON.stringify(state)") == before)
    page.evaluate("ceShowResult(ceOf('evt11'),'min',{tx:ceOf('evt11').minor.tx})")
    if width == 390:
        page.locator('#modalBox').screenshot(path=str(evidence / f'{label}-result.png'))
    page.locator('#modalBox .x').tap()
    check(f"{label}: header X", not page.locator('#modalBg').is_visible())
    page.evaluate("setArea('mgmt')")
    for ad, arrow, cost in [("none", "→", None), ("flyer", "↑", "¥3万"),
                             ("sns", "↑↑", "¥8万"), ("tv", "↑↑↑", "¥25万")]:
        button = page.locator(f'#adButtons [data-ad="{ad}"]')
        if cost:
            check(f"{label}: price retained {ad}", cost in button.inner_text())
        button.tap()
        text = page.locator('#adCurrent').inner_text()
        check(f"{label}: qualitative effect {ad}", not re.search(r'[0-9%％]', text))
        check(f"{label}: arrow {ad}", page.locator('#adCurrent [role="img"]').inner_text() == arrow)
        check(f"{label}: ad selection {ad}", page.evaluate("state.ad") == ad)
    page.locator('#adButtons [data-ad="sns"]').tap()
    if width == 390:
        page.locator('#adButtons').locator('..').locator('..').screenshot(path=str(evidence / f'{label}-advertising.png'))
    page.evaluate("lrState().ids=['R09','R10','R01'];lrApplyNames();renderMgmt();save(true)")
    for unlocked in [False, True]:
        page.evaluate("v => {state.day=v?15:1;renderAll();}", unlocked)
        text = page.locator('#lrCard').inner_text()
        check(f"{label}: no rival spoilers {unlocked}", all(word not in text for word in
              ['強敵', '王者型', '最も警戒すべき相手', '10人の候補', '顔ぶれはやり直すまで']))
        check(f"{label}: uniform rival classes {unlocked}", page.locator('#lrCard .boss, #lrCard .lr-boss').count() == 0)
        widths = page.locator('#lrCard .lr-pic').evaluate_all("es=>es.map(e=>getComputedStyle(e).borderLeftWidth)")
        check(f"{label}: uniform frame width {unlocked}", len(set(widths)) == 1)
        for i in range(3):
            page.locator(f'#lrCard [data-lr="{i}"]').tap()
            check(f"{label}: detail no badge {unlocked}-{i}", page.locator('#modalBox .boss, #modalBox .lr-boss').count() == 0)
            check(f"{label}: detail no strong label {unlocked}-{i}", '強敵' not in page.locator('#modalBox').inner_text())
            page.locator('#modalBox .x').tap()
    page.evaluate("showModal(mh('flag','地元のライバル',true)+lrIntroHtml())")
    check(f"{label}: intro no badge", page.locator('#modalBox .boss, #modalBox .lr-boss').count() == 0)
    check(f"{label}: neutral intro artwork", 'three-challengers.webp' in page.locator('.lr-introwrap > img').get_attribute('src'))
    page.locator('#modalBox .x').tap()
    page.evaluate("state.day=1;renderAll();save(true)")
    if width == 390:
        page.locator('#lrCard').screenshot(path=str(evidence / f'{label}-rivals.png'))
    check(f"{label}: internal rivals unchanged", page.evaluate("lrProf('R09').boss && lrProf('R09').capMul===1.17 && lrProf('R10').boss && lrProf('R10').capMul===1.14"))
    page.evaluate("setArea('hall')")
    day = page.evaluate("state.day")
    page.locator('#btnOpen').tap()
    page.locator('#resAmt').wait_for(state='visible')
    check(f"{label}: next business day works", page.evaluate("state.day") == day + 1)
    page.locator('#modalBox .rowbtns button').last.tap()
    snapshot = page.evaluate("({day:state.day,money:state.money,ad:state.ad,ids:lrState().ids})")
    page.reload(wait_until='load')
    check(f"{label}: reload preserves player progress", snapshot == page.evaluate("({day:state.day,money:state.money,ad:state.ad,ids:lrState().ids})"))
    page.evaluate("state.day=LIMIT_DAYS[state.diff]+1;ceShowResult(ceOf('evt11'),'min',{tx:'test'})")
    page.locator('[data-tile="closemodal"]').tap()
    check(f"{label}: expired-game guard retained", '期限切れ' in page.locator('#modalBox').inner_text())
    check(f"{label}: no JavaScript exceptions", not errors)
    ctx.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url')
    parser.add_argument('--evidence', required=True)
    args = parser.parse_args()
    evidence = Path(args.evidence)
    evidence.mkdir(parents=True, exist_ok=True)
    server = None
    if args.url:
        url = args.url
    else:
        root = Path(__file__).resolve().parent.parent
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(root)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_port}/pachinko/'
    try:
        with sync_playwright() as pw:
            for name in ['chromium', 'webkit']:
                browser = getattr(pw, name).launch(headless=True)
                try:
                    for width in [390, 375]:
                        label = f'{name}-{width}'
                        exercise(browser, url, width, evidence, label)
                        print(f'PASS {label}', flush=True)
                finally:
                    browser.close()
    finally:
        if server:
            server.shutdown()
        (evidence / 'results.json').write_text(json.dumps(CHECKS, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{len(CHECKS)} checks passed')

if __name__ == '__main__':
    main()
