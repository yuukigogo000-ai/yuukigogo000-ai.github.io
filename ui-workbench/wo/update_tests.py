# update_tests.py — WO UI-band-setlistedit に伴うテストの「操作経路」更新。
#
# 何を変えたか: UI が変わって操作の入口が変わった箇所だけを書き換える。
#   - セトリ操作(新規/複製/名前変更/共有/印刷/undo/redo/削除) … 上部の ⋯(#moreBtn → #moreDialog)を開いてから押す
#   - 曲の操作(MC の入り切り/編集/削除/上下) … 行の ⋯(.song-actions button → #rowMenu)を開いてから押す
# 何を変えていないか: 検査している内容(期待値・件数・時間)は1つも変えていない。
#
# 実行: python ui-workbench/wo/update_tests.py   (リポジトリのルートで)

import io, re

HELPERS = '''
// --- 操作経路のヘルパー(2026-08-17 WO UI-band-setlistedit で UI の入口が変わったため追加)---
// セトリ操作は上部の ⋯ メニュー、曲の操作は行の ⋯ メニューの中に移った。検査内容は変えていない。
async function openMore(p) {
  if (!(await p.locator("#moreDialog").isVisible())) await p.click("#moreBtn");
}
async function openRowMenu(p, nth = 0) {
  await p.locator("#songList .song").nth(nth).locator(".song-actions button").click();
}
async function openRowMenuLast(p) {
  await p.locator("#songList .song").last().locator(".song-actions button").click();
}
async function rowMenuClick(p, titleSubstr) {
  await p.locator(`#rowMenuList button[title*="${titleSubstr}"]`).click();
}
'''

MORE_IDS = "undoBtn|redoBtn|shareBtn|printBtn|newSetlistBtn|dupSetlistBtn|renameSetlistBtn|deleteSetlistBtn"

for path in ("tests/smoke.mjs", "tests/torture.mjs"):
    s = io.open(path, encoding="utf-8").read()
    if "async function openMore(" not in s:
        # import 群の直後(最初の空行区切り)にヘルパーを差し込む
        m = list(re.finditer(r"^import .*$", s, flags=re.M))
        pos = m[-1].end() if m else 0
        s = s[:pos] + "\n" + HELPERS + s[pos:]

    # 1) セトリ操作: page/bp.click("#xxx") の前にメニューを開く
    def more_click(m):
        obj, bid = m.group(1), m.group(2)
        return f'await openMore({obj}); await {obj}.click("#{bid}")'
    s = re.sub(rf'(?<!openMore\(p\); )(?<!openMore\(page\); )(?<!openMore\(bp\); )await (\w+)\.click\("#({MORE_IDS})"\)', more_click, s)
    s = re.sub(r'(?:await openMore\((\w+)\);\s*){2,}', r'await openMore(); ', s)  # 二度流しても増やさない

    # 2) 曲の操作: MC チップ(表示専用になった)→ 行 ⋯ メニューの「MC の入り切り」
    s = s.replace(
        'await page.locator("#songList .song").last().locator(".chip-mc").click();',
        'await openRowMenuLast(page); await rowMenuClick(page, "MC の入り切り");'
    )
    s = s.replace(
        'await page.locator("#songList .song .chip-mc").first().click();',
        'await openRowMenu(page, 0); await rowMenuClick(page, "MC の入り切り");'
    )
    # evaluate 内の DOM 直叩き(55回連打)は、行メニューを1度開いて中のボタンを叩く形にする
    s = s.replace(
        '''  await page.evaluate(async () => {
    for (let i = 0; i < 55; i++) {
      document.querySelector("#songList .song .chip-mc").click();
      await new Promise((r) => setTimeout(r, 5));
    }
  });''',
        '''  await openRowMenu(page, 0);
  await page.evaluate(async () => {
    // MC の入り切りは行の ⋯ メニューに移った。連打の検査内容(55回)は変えていない。
    for (let i = 0; i < 55; i++) {
      const b = [...document.querySelectorAll("#rowMenuList button")].find((x) => x.title === "MC の入り切り");
      if (!b) break;
      b.click();
      await new Promise((r) => setTimeout(r, 5));
      if (!document.getElementById("rowMenu").open) {
        document.querySelector("#songList .song .song-actions button").click();
      }
    }
    document.getElementById("rowMenu").close();
  });'''
    )
    # 3) 曲の編集: 行内ボタン → 行 ⋯ メニュー
    s = s.replace(
        '''await page.locator("#songList .song").first().locator('button[title*="曲を編集"]').click();''',
        '''await openRowMenu(page, 0); await rowMenuClick(page, "曲を編集");'''
    )

    io.open(path, "w", encoding="utf-8", newline="\n").write(s)
    print(path + ": openMore " + str(s.count("openMore(")) + " / rowMenu " + str(s.count("openRowMenu")))
