# -*- coding: utf-8 -*-
"""Phase 2 VISUAL SANITIZATION.

truth/ の内部用 JSON から、ChatGPT Design Authority へ渡す版を作る。
現行UIの見た目に結びつく記述(CSSセレクタ・CSSプロパティ・構造語・装飾語)を落とし、
WHAT だけを残す。落とし方は明示的な表で行い、取りこぼしは check_leakage.py が落とす。
"""
import io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRUTH = os.path.join(ROOT, "truth")
BRIDGE = os.path.join(ROOT, "bridge")

# 画面IDから、実装がどのファイルにあるか(パスだけ。セレクタは渡さない)
SOURCE_FILE = {
    "ALL": "honmono/*.html(全ページ共通)",
    "HOME": "honmono/index.html",
    "CHECKER": "honmono/checker/index.html + honmono/checker/pixel.js",
    "BADGE": "honmono/badge/index.html",
    "AICHECK": "honmono/aicheck/index.html",
    "CREATORS": "honmono/creators/index.html + honmono/creators/creators.json",
    "DOCS": "honmono/docs/index.html",
    "REPORT": "honmono/report/index.html",
    "BUSINESS": "honmono/business/index.html",
    "LEGAL_PRIVACY": "honmono/legal/privacy.html",
    "LEGAL_TERMS": "honmono/legal/terms.html",
    "LEGAL_CREDITS": "honmono/legal/credits.html",
}

# 語の置き換え表。左=現行UIを指す語 / 右=WHATだけを残した語
REPLACEMENTS = [
    ("解析の結論を1つだけ大きく提示する", "解析の結論を1つに絞って提示する"),
    ("ドロップゾーンの視覚状態が変わる", "受け取り可能であることが視覚的に伝わる"),
    ("ドロップゾーン", "ファイル投入の受け口"),
    ("ファイル投入口の近く", "ファイルを渡す操作の近く"),
    ("画素判定カード内", "画素判定の区画内"),
    ("画素判定カードが出ない", "画素判定の入口が出ない"),
    ("画素判定カードが出る", "画素判定の入口が出る"),
    ("画素判定カード", "画素判定の区画"),
    ("署名カード", "署名検証の区画"),
    ("結果カード内", "結果の区画内"),
    ("結果カード画像", "結果画像"),
    ("募集カード", "募集の区画"),
    ("カード群", "掲載項目の並び"),
    ("各カード", "各掲載項目"),
    ("見本カード", "見本の掲載項目"),
    ("掲載カード", "掲載項目"),
    ("カードより前", "掲載項目より前"),
    ("カードが4件出る", "掲載項目が4件出る"),
    ("カード押下", "この能力の入口を押す"),
    ("時はカードを出さない", "ときは入口を出さない"),
    ("C2PAカードが消えて", "C2PA検証の区画が消えて"),
    ("ヒーロー", "冒頭の主張"),
    ("帯グラフ", "水準の可視化"),
    ("スコアバー", "スコアの可視化"),
    ("+ バー", "+ 水準の可視化"),
    ("バー + ", "水準の可視化 + "),
    ("横並び", "同時提示"),
    ("縦に4カード並んで", "4つの区画が続けて並んで"),
    ("大きめの色付きボックス", "強調された結論"),
    ("絵文字", "記号"),
    ("角丸", "面の丸み"),
    ("罫線", "面の境界"),
    ("position: sticky; bottom:0", "スクロール中も参照可能"),
    ("結果が画面内に留まる", "スクロール中も現在の結果を参照できる"),
    ("長いチェックリストを進めながら、結果を見続けられる",
     "全項目を見終える前でも、その時点の結果を参照できる"),
    ("結果ブロックが視界に残り、内容を隠しすぎないこと",
     "その時点の結果が参照でき、かつ本文の可読性を損なわないこと"),
    ("オレンジ枠", "注意の水準"),
    ("色付き", "状態が区別された"),
]

SELECTORISH = re.compile(
    r"(?:^|\s)(?:#[A-Za-z][\w-]*|\.[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*|[a-z]+\.[a-z][\w-]*)"
)


def strip_source(func):
    """source(ファイル+セレクタ)を、ファイルパスだけに落とす。"""
    out = dict(func)
    out.pop("source", None)
    out["source_file"] = SOURCE_FILE.get(func.get("screen"), "honmono/")
    return out


def apply_words(obj):
    if isinstance(obj, str):
        s = obj
        for a, b in REPLACEMENTS:
            s = s.replace(a, b)
        return s
    if isinstance(obj, list):
        return [apply_words(x) for x in obj]
    if isinstance(obj, dict):
        return {k: apply_words(v) for k, v in obj.items()}
    return obj


def write(name, data):
    p = os.path.join(BRIDGE, name)
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return p


def main():
    os.makedirs(BRIDGE, exist_ok=True)

    # --- PRODUCT_TRUTH ---
    pt = json.load(io.open(os.path.join(TRUTH, "PRODUCT_TRUTH.json"), encoding="utf-8"))
    pt["status_facts"]["image_assets_owned"] = (
        "自作の画像アセットは共有用のOG画像1枚のみ。"
        "ロゴ画像・アイコン画像・イラストは存在しない(必要なら新規に定義する)"
    )
    pt["_sanitized"] = "現行UIの見た目に関する記述は除去済み(Phase 2 VISUAL SANITIZATION)"
    write("PRODUCT_TRUTH.json", apply_words(pt))

    # --- FUNCTION_FREEZE ---
    ff = json.load(io.open(os.path.join(TRUTH, "FUNCTION_FREEZE.json"), encoding="utf-8"))
    ff["functions"] = [strip_source(f) for f in ff["functions"]]
    ff["_sanitized"] = (
        "source(ファイル+CSSセレクタ)は source_file(ファイルパスのみ)に置き換えた。"
        "現行の構造・装飾を示す語は WHAT だけを残す語に置き換えた"
    )
    write("FUNCTION_FREEZE.json", apply_words(ff))

    # --- REQUIRED_COPY: verbatim の値だけは1文字も触らない ---
    rc_src = json.load(io.open(os.path.join(TRUTH, "REQUIRED_COPY.json"), encoding="utf-8"))
    rc = apply_words(rc_src)
    rc["brand"]["product_name"]["value"] = rc_src["brand"]["product_name"]["value"]
    for i, item in enumerate(rc_src["items"]):
        if str(item.get("kind", "")).startswith("verbatim"):
            for key in ("value", "fragments"):
                if key in item:
                    rc["items"][i][key] = item[key]
    for i, w in enumerate(rc_src["forbidden_strings"]):
        rc["forbidden_strings"][i]["value"] = w["value"]
    rc["_verbatim_protected"] = (
        "kind が verbatim で始まる項目の value / fragments は、"
        "自動検査が完全一致で見るため一切加工していない"
    )
    write("REQUIRED_COPY.json", rc)

    # --- そのまま(語の置き換えのみ) ---
    for name in ("SCREEN_STATE_INVENTORY.json",
                 "TECHNICAL_CONSTRAINTS.json", "TRUST_AND_SAFETY_FACTS.json"):
        d = json.load(io.open(os.path.join(TRUTH, name), encoding="utf-8"))
        write(name, apply_words(d))

    print("sanitized ->", BRIDGE)


if __name__ == "__main__":
    main()
