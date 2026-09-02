# -*- coding: utf-8 -*-
"""HONMONO の共通シェル(head / header / menu / footer)を1か所で持つ。

ここで組み立てた静的HTMLを honmono/ 以下へ書き出す。
**サイト自体にビルド工程は無い**(書き出したHTMLがそのまま配信される)。
このスクリプトは「11ページのヘッダーとフッターを人手で同期させない」ためだけのもの。

実装元: honmono/design/redesign-v4/frozen/(Design Freeze 済み)
"""

CSP = ("default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; "
       "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; "
       "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
       "media-src 'self' data: blob:; font-src 'self' data:; "
       "connect-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self'")

FAVICON = ("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
           "<path d='M32 3 55 16.5v31L32 61 9 47.5v-31L32 3Z' fill='none' stroke='%237F5A23' stroke-width='3'/>"
           "<text x='32' y='42' font-size='26' text-anchor='middle' fill='%237F5A23' font-family='serif'>本</text></svg>")

# ---- アイコン(すべてインラインSVG・単色線画・stroke=currentColor 1.75) ----
ICO = {
    "seal": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">'
             '<path d="M32 3 55 16.5v31L32 61 9 47.5v-31L32 3Z" stroke="currentColor" stroke-width="2"/>'
             '<path d="M32 9 49 19v26L32 55 15 45V19L32 9Z" stroke="currentColor" stroke-width="1" opacity=".55"/>'
             '<text x="32" y="40" text-anchor="middle" font-size="24" font-family="serif" fill="currentColor">本</text></svg>'),
    "menu": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="1.75" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>'),
    "close": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
              'stroke-width="1.75" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'),
    "checker": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v10H4z"/>'
                '<path d="m6 12 3.5-4 2.5 3 2-2 4 3"/><circle cx="16.5" cy="17.5" r="3.5"/>'
                '<path d="m19.5 20.5 1.8 1.8"/></svg>'),
    "account": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="3.5"/>'
                '<path d="M3.5 20a6.5 6.5 0 0 1 11-4.7"/><circle cx="17.5" cy="17.5" r="3.5"/>'
                '<path d="M16 17.5h3"/></svg>'),
    "badge": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
              'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'
              '<path d="M12 3l7 4v6.5c0 3.4-2.9 6-7 7.5-4.1-1.5-7-4.1-7-7.5V7z"/>'
              '<path d="m9 12 2.2 2.2L15.5 10"/></svg>'),
    "creators": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                 'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"/>'
                 '<path d="M4 9h16M8 13h8M8 16h5"/></svg>'),
    "docs": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'
             '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5z"/>'
             '<path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5z"/></svg>'),
    "report": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
               'stroke-width="1.75" stroke-linecap="round"><path d="M6 18V9M12 18V4M18 18v-6"/></svg>'),
    "business": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                 'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V6l7-3v17"/>'
                 '<path d="M11 9h9v11"/><path d="M7 9h.01M7 13h.01M15 13h.01M15 17h.01"/></svg>'),
    "lock": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'
             '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'),
    "arrow": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
              'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15m-5-6 6 6-6 6"/></svg>'),
}

# 状態グリフ(色だけに頼らないための形)
GLYPH = {
    "bad": ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" '
            'stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5 14.5 8 8 14.5 1.5 8z"/>'
            '<path d="M8 5v3.5M8 11h.01"/></svg>'),
    "warn": ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" '
             'stroke-linecap="round"><path d="M11 2 5 14"/></svg>'),
    "ok": ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" '
           'stroke-linecap="round" stroke-linejoin="round"><path d="M4 2H2v12h2M12 2h2v12h-2"/>'
           '<path d="m5.5 8 1.8 2L10.5 6"/></svg>'),
    "info": ('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">'
             '<circle cx="8" cy="8" r="5.5"/></svg>'),
}

# メニュー(目的でまとめる。順序は Design Freeze の INFORMATION_ARCHITECTURE のとおり)
MENU = [
    ("調べる", [("checker/", "checker", "画像来歴チェッカー"),
                ("aicheck/", "account", "AIアカウント鑑定")]),
    ("証明・探す", [("badge/", "badge", "実在証明バッジ"),
                    ("creators/", "creators", "実在クリエイター名鑑")]),
    ("理解する", [("docs/", "docs", "説明書")]),
]
MENU_SUB = [("report/", "report", "実測レポートを読む"),
            ("business/", "business", "法人・開発者の方へ")]

FOOT_LINKS = [("", "HONMONO"), ("docs/", "説明書"), ("report/", "実測レポート"),
              ("business/", "法人向け"), ("legal/privacy.html", "プライバシー"),
              ("legal/terms.html", "利用規約"), ("legal/credits.html", "クレジット")]


def head(page):
    """<head> と <body> 開始まで。"""
    p = page["prefix"]
    og = page.get("og_desc", page["desc"])
    style = page.get("style", "")
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{page['title']}</title>
<meta name="description" content="{page['desc']}">
<link rel="icon" href="{FAVICON}">
<meta property="og:type" content="website">
<meta property="og:title" content="{page['title']}">
<meta property="og:description" content="{og}">
<meta property="og:url" content="https://yuukigogo000-ai.github.io/honmono/{page['route']}">
<meta property="og:image" content="https://yuukigogo000-ai.github.io/honmono/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="{p}honmono.css">
<style>
{style}</style>
</head>
<body>
"""


def header(page):
    p = page["prefix"]
    wide = " wrap-wide" if page.get("wide") else ""
    return f"""
<header class="site-head"><div class="wrap{wide}">
  <a class="brand" href="{p or './'}">
    <span class="seal" aria-hidden="true">{ICO['seal']}</span>
    <span class="word">HONMONO</span>
  </a>
  <button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="siteMenu" aria-label="メニューを開く">
    <span class="ico-open" aria-hidden="true">{ICO['menu']}</span>
    <span class="ico-close" aria-hidden="true">{ICO['close']}</span>
  </button>
</div></header>
"""


def menu(page):
    p = page["prefix"]
    wide = " wrap-wide" if page.get("wide") else ""
    out = [f'\n<nav class="site-menu" id="siteMenu" hidden aria-label="サイト内の移動"><div class="wrap{wide}">']
    for title, items in MENU:
        out.append('  <div class="menu-group">')
        out.append(f"    <h2>{title}</h2>")
        out.append('    <ul class="menu-list">')
        for href, icon, label in items:
            cur = ' aria-current="page"' if page.get("current") == href else ""
            out.append(f'      <li><a href="{p}{href}"{cur}>'
                       f'<span class="ico" aria-hidden="true">{ICO[icon]}</span>{label}</a></li>')
        out.append("    </ul>")
        out.append("  </div>")
    out.append('  <div class="menu-group menu-sub">')
    out.append('    <ul class="menu-list">')
    for href, icon, label in MENU_SUB:
        cur = ' aria-current="page"' if page.get("current") == href else ""
        out.append(f'      <li><a href="{p}{href}"{cur}>'
                   f'<span class="ico" aria-hidden="true">{ICO[icon]}</span>{label}</a></li>')
    out.append("    </ul>")
    out.append("  </div>")
    out.append("</div></nav>\n")
    return "\n".join(out)


def footer(page):
    p = page["prefix"]
    wide = " wrap-wide" if page.get("wide") else ""
    links = "\n".join(
        f'    <a href="{p}{href}">{label}</a>' for href, label in FOOT_LINKS)
    note = page.get("foot_note",
                    "HONMONO プロジェクト — 処理はブラウザ内で完結します。ページの読み込みには通信が必要です。")
    scripts = "".join(f'\n<script src="{s}"></script>' for s in page.get("scripts", []))
    return f"""
<footer class="site-foot"><div class="wrap{wide}">
  <div class="foot-links">
{links}
  </div>
  <p style="margin:0">{note}</p>
</div></footer>

<script src="{p}shell.js"></script>{scripts}
</body>
</html>
"""


def render(page):
    return head(page) + header(page) + menu(page) + page["main"] + footer(page)
