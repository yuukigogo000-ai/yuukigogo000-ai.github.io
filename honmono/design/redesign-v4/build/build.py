# -*- coding: utf-8 -*-
"""11ページの静的HTMLを書き出す。

    python3 honmono/design/redesign-v4/build/build.py

サイトにビルド工程は無い。ここで書き出したHTMLがそのまま配信される。
このスクリプトの役割は、ヘッダー・メニュー・フッター・アイコンを
11ページで人手同期させないことだけ。
"""
import io, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shell  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(HERE, "pages")
SITE = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))  # リポジトリ直下


def read(name):
    p = os.path.join(PAGES, name)
    return io.open(p, encoding="utf-8").read() if os.path.exists(p) else ""


def expand(html):
    """__ICO_XXX__ をインラインSVGに差し替える。"""
    for key, svg in shell.ICO.items():
        html = html.replace("__ICO_%s__" % key.upper(), svg)
    for key, svg in shell.GLYPH.items():
        html = html.replace("__GLYPH_%s__" % key.upper(), svg)
    return html


# route, out, current(メニューの現在地), title, desc, og_desc, wide, scripts, foot_note
MANIFEST = [
    dict(key="home", route="", out="honmono/index.html", current=None, wide=True,
         title="HONMONO — 実在性を証明するツール群",
         desc="AI生成コンテンツが溢れる時代に「本物の人間であること」を価値に変える無料ツール群。画像来歴チェッカー、実在証明バッジ、AIアカウント鑑定、実在クリエイター名鑑。",
         og_desc="AIが「美女」を無限に作る時代、いちばん希少なのは本物の人間。実在を証明し、見分け、価値に変える無料ツール群。",
         foot_note="HONMONO プロジェクト — すべての処理はあなたのブラウザ内で完結します。画像やフォーム入力が外部に送信されることはありません。ページの読み込みそのものには通信が必要です。"),

    dict(key="checker", route="checker/", out="honmono/checker/index.html", current="checker/",
         title="画像来歴チェッカー — HONMONO",
         desc="画像のC2PA(コンテンツ来歴)・EXIF・XMP・生成AIツールの痕跡をブラウザ内で解析。AI生成画像かカメラ撮影かの判定材料を提示します。",
         og_desc="画像をドロップするだけで、AI生成の痕跡・C2PA来歴・カメラEXIFをブラウザ内で解析。アップロード不要・無料。",
         scripts=[], foot_note="HONMONO プロジェクト — 画像はブラウザ外に送信されません。ページの読み込みには通信が必要です。"),

    dict(key="aicheck", route="aicheck/", out="honmono/aicheck/index.html", current="aicheck/",
         title="AIアカウント鑑定 — HONMONO",
         desc="SNS・マッチングアプリのアカウントがAI製・なりすましでないかをチェックリストでリスク診断。ロマンス詐欺対策にも。",
         og_desc="そのアカウント、実在する人間ですか? AI製・なりすまし・ロマンス詐欺のリスクを無料でチェックリスト診断。",
         foot_note="HONMONO プロジェクト — チェック内容はブラウザ外に送信されません。ページの読み込みには通信が必要です。"),

    dict(key="badge", route="badge/", out="honmono/badge/index.html", current="badge/",
         title="実在証明バッジ — HONMONO",
         desc="クリエイター向け。「私はAIではなく実在の人間です」を相互リンク方式で証明するページとバッジを無料生成。",
         og_desc="「私はAIではなく実在の人間です」を相互リンク方式で証明。証明ページとバッジを無料生成。",
         foot_note="HONMONO プロジェクト — 入力内容はブラウザ外に送信されません。ページの読み込みには通信が必要です。"),

    dict(key="creators", route="creators/", out="honmono/creators/index.html", current="creators/",
         title="実在クリエイター名鑑 — HONMONO",
         desc="「AI不使用・実在証明済み」を掲げるクリエイターのディレクトリ。本物の人間に仕事を頼みたい企業・ファンのための検索台帳。",
         og_desc="実在を証明したクリエイターだけを載せる無料ディレクトリ。本物の人間に仕事を頼みたい企業・応援したいファンのために。",
         foot_note="HONMONO プロジェクト — 掲載料・審査料はいただきません。"),

    dict(key="docs", route="docs/", out="honmono/docs/index.html", current="docs/",
         title="説明書 — HONMONO",
         desc="HONMONOプロジェクトの目的、各ツールの使い方、制限事項をまとめた公式ドキュメント。",
         foot_note="HONMONO プロジェクト — 最終更新: 2026-09-02"),

    dict(key="report", route="report/", out="honmono/report/index.html", current="report/",
         title="実測レポート — HONMONO",
         desc="AI画像判定モデルの実測値・弱点・学習データの出典・訂正の履歴を全部公開しています。",
         foot_note="HONMONO プロジェクト — 数字は実測値のみ。都合の悪い数字も消していません。"),

    dict(key="business", route="business/", out="honmono/business/index.html", current="business/",
         title="法人・開発者向け — HONMONO",
         desc="画像を自社サーバーに送らずにAI生成かどうかを判定するモデルのライセンス提供。実測値と弱点を先に開示しています。",
         foot_note="HONMONO プロジェクト — 先に弱点をお伝えします。"),

    dict(key="privacy", route="legal/privacy.html", out="honmono/legal/privacy.html", current=None,
         prefix="../",
         title="プライバシーポリシー — HONMONO",
         desc="HONMONOがあなたの情報をどう扱うかを、外部に伝わりうる情報まで含めて正確に書いています。",
         foot_note="HONMONO プロジェクト — 送信しないものと、端末に残るものを正確に書いています。"),

    dict(key="terms", route="legal/terms.html", out="honmono/legal/terms.html", current=None,
         prefix="../",
         title="利用規約 — HONMONO",
         desc="HONMONOのツール群をお使いになる方に守っていただきたいことと、運営者が負う責任の範囲。",
         foot_note="HONMONO プロジェクト — 免責は故意または重大な過失を除く範囲に限定しています。"),

    dict(key="credits", route="legal/credits.html", out="honmono/legal/credits.html", current=None,
         prefix="../",
         title="クレジット・ライセンス — HONMONO",
         desc="同梱しているオープンソースソフトウェアと、判定モデルの学習に使ったデータの出典・ライセンス。",
         foot_note="HONMONO プロジェクト — 他の人が公開してくれたソフトウェアとデータの上に成り立っています。"),
]


def assemble_checker_scripts():
    """checker のスクリプトを部品から組み直す。
    checker_core.js は解析ロジック(触らない)、checker_ui.js は表示だけ。"""
    tpl = read("checker_scripts.tpl")
    if not tpl:
        return
    out = tpl.replace("__CHECKER_CORE__", read("checker_core.js"))
    out = out.replace("__CHECKER_UI__", read("checker_ui.js"))
    io.open(os.path.join(PAGES, "checker_scripts.html"), "w",
            encoding="utf-8", newline="\n").write(out)


def main():
    assemble_checker_scripts()
    written = []
    for page in MANIFEST:
        key = page["key"]
        page.setdefault("prefix", "" if key == "home" else "../")
        page["style"] = read(key + ".css")
        main_html = read(key + ".html")
        if not main_html:
            print("  ! 本文が無いので飛ばした:", key)
            continue
        main_html = main_html.replace("__RENDER_LEDGER__", read(key + "_ledger.html"))
        page["main"] = expand(main_html)

        extra = read(key + "_scripts.html")
        html = shell.render(page)
        if extra:
            html = html.replace("</body>", expand(extra) + "\n</body>")

        out = os.path.join(SITE, page["out"])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        io.open(out, "w", encoding="utf-8", newline="\n").write(html)
        written.append(page["out"])
        print("  書き出し:", page["out"], len(html), "bytes")
    print("%d ページ" % len(written))


if __name__ == "__main__":
    main()
