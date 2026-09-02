# HONMONO サイトの静的検査。
#   1) 内部リンクが全部実在するか
#   2) HTML が壊れていないか(タグ対応・重複id)
#   3) 外部CDN読み込みを新たに増やしていないか(プロジェクト規則)
#   4) 直してはいけない虚偽表現が残っていないか(禁止語)
#   5) 必須の表示(ライセンス・免責の限定)が入っているか
#
# --selftest を付けると、わざと壊した写しを検査して「本当に落ちるか」を確かめる。
import os, re, sys, html, shutil, tempfile
from html.parser import HTMLParser

sys.stdout.reconfigure(encoding="utf-8")

VOID = {"area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"}

class Checker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.ids = {}
        self.errors = []
        self.hrefs = []
        self.srcs = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            if a["id"] in self.ids:
                self.errors.append("id重複: " + a["id"])
            self.ids[a["id"]] = True
        if "href" in a: self.hrefs.append(a["href"])
        if "src" in a: self.srcs.append(a["src"])
        if tag not in VOID:
            self.stack.append(tag)
    def handle_endtag(self, tag):
        if tag in VOID: return
        if not self.stack:
            self.errors.append("閉じタグが多い: </%s>" % tag); return
        if self.stack[-1] != tag:
            # よくある省略(li/p)は許容し、それ以外は報告
            if self.stack[-1] in ("li","p","dt","dd","tr","td","th","option"):
                while self.stack and self.stack[-1] != tag:
                    self.stack.pop()
                if self.stack: self.stack.pop()
                return
            self.errors.append("タグの対応がずれている: 開<%s> 閉</%s>" % (self.stack[-1], tag))
            return
        self.stack.pop()

ALLOWED_EXTERNAL_HOSTS = {
    # 既存で使っている外部“リンク先”(読み込みではない)
    "github.com","docs.github.com","contentcredentials.org","verify.contentauthenticity.org",
    "www.npa.go.jp","x.com","www.instagram.com","www.youtube.com","www.google.com","www.bing.com",
    "yandex.com","tineye.com","lens.google.com","images.google.com","storage.googleapis.com",
    "unsplash.com","www.pexels.com","www.w3.org","cv.iptc.org","ns.adobe.com","www.apache.org",
    "lodash.com","underscorejs.org","openjsf.org","npms.io","web.dev","img.shields.io",
    "yuukigogo000-ai.github.io","developers.cloudflare.com","www.cloudflare.com",
}

# 出てはいけない表現(過去の虚偽・断定)
FORBIDDEN = [
    ("オフラインでも動作します", "虚偽: Service Worker が無い"),
    ("なぜ偽造できない", "断定: 相互リンクは破られうる"),
    ("いかなる損害についても、運営者は責任を負いません", "無効条項: 消費者契約法8条"),
    ("(サンプル)葉山", "架空の人物名が残っている"),
    ("(サンプル)如月", "架空の人物名が残っている"),
    ("(サンプル)真田", "架空の人物名が残っている"),
    ("(サンプル)音無", "架空の人物名が残っている"),
]

# 各ページに必ず入っているべきもの
REQUIRED = {
    "honmono/index.html":          ["legal/terms.html", "report/", "business/"],
    "honmono/docs/index.html":     ["../legal/terms.html", "故意または重大な過失"],
    "honmono/legal/credits.html":  ["MIT License", "Copyright (c) Microsoft Corporation", "Copyright 2021 Adobe"],
    "honmono/legal/terms.html":    ["故意または重大な過失", "名誉毀損"],
    "honmono/legal/privacy.html":  ["Cache Storage", "shields.io"],
    "honmono/report/index.html":   ["CDLA-Permissive-2.0", "CC BY 2.0", "Unsplash License", "Pexels License"],
    "honmono/business/index.html": ["4割近く見逃します"],
    "honmono/aicheck/index.html":  ["名誉毀損"],
}

def check(site):
    problems = []
    pages = []
    for root, dirs, files in os.walk(os.path.join(site, "honmono")):
        # design/ はサイトの一部ではない(_config.yml で配信停止)。
        # 中にある組み立て用のHTML断片まで検査すると、断片単体のリンク切れで落ちてしまう。
        dirs[:] = [d for d in dirs if d not in (".git", "vendor", "design")]
        for f in files:
            if f.endswith(".html"):
                pages.append(os.path.join(root, f))

    for path in sorted(pages):
        rel = os.path.relpath(path, site).replace("\\", "/")
        src = open(path, encoding="utf-8").read()

        c = Checker()
        try:
            c.feed(src)
        except Exception as e:
            problems.append("%s: HTML解析で例外 %s" % (rel, e))
            continue
        for e in c.errors:
            problems.append("%s: %s" % (rel, e))
        if c.stack:
            problems.append("%s: 閉じられていないタグ %s" % (rel, c.stack))

        # 禁止語
        for word, why in FORBIDDEN:
            if word in src:
                problems.append("%s: 禁止表現「%s」 (%s)" % (rel, word, why))

        # 必須語
        for word in REQUIRED.get(rel, []):
            if word not in src:
                problems.append("%s: 必須の記載が無い「%s」" % (rel, word))

        base = os.path.dirname(path)
        # 内部リンク
        for href in c.hrefs:
            h = href.strip()
            if not h or h.startswith(("#", "mailto:", "javascript:", "data:")): continue
            if h.startswith(("http://", "https://")):
                host = h.split("/")[2]
                if host not in ALLOWED_EXTERNAL_HOSTS:
                    problems.append("%s: 未登録の外部ホスト %s" % (rel, host))
                continue
            target = h.split("#")[0].split("?")[0]
            if not target: continue
            p = os.path.normpath(os.path.join(base, target))
            if os.path.isdir(p): p = os.path.join(p, "index.html")
            if not os.path.exists(p):
                problems.append("%s: リンク切れ %s" % (rel, href))
        # 読み込み(src)は外部禁止
        for s in c.srcs:
            if s.startswith(("http://", "https://")):
                problems.append("%s: 外部からの読み込み %s (プロジェクト規則で禁止)" % (rel, s))

    # モデルとライセンスの実在
    for must in ["honmono/vendor/c2pa/LICENSE", "honmono/vendor/ort/LICENSE",
                 "honmono/vendor/models/LICENSE.md",
                 "honmono/vendor/models/honmono_v31_int8.onnx.part1",
                 "honmono/vendor/models/honmono_v31_int8.onnx.part2"]:
        if not os.path.exists(os.path.join(site, must)):
            problems.append("必須ファイルが無い: " + must)

    # creators.json に人名が残っていないか
    cj = os.path.join(site, "honmono/creators/creators.json")
    if os.path.exists(cj):
        t = open(cj, encoding="utf-8").read()
        for w in ["葉山", "如月", "真田", "音無"]:
            if w in t:
                problems.append("creators.json に架空の人名が残っている: " + w)
    return problems, len(pages)

def main():
    # 検査対象のサイトルート。既定はこのファイルから見たリポジトリ直下。
    # (以前は特定セッションの一時ディレクトリを直書きしていて、そのフォルダが消えた時点で
    #  この検査器は実行不能になっていた。SITE_ROOT で差し替えられるようにした)
    site = os.path.abspath(os.environ.get(
        "SITE_ROOT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")))
    if "--selftest" in sys.argv:
        # 写しを作ってわざと壊し、検査器が本当に落ちるか確かめる
        tmp = tempfile.mkdtemp(prefix="honmono_selftest_")
        dst = os.path.join(tmp, "site")
        shutil.copytree(os.path.join(site, "honmono"), os.path.join(dst, "honmono"),
                        ignore=shutil.ignore_patterns("*.part1", "*.part2"))
        # 重みは中身不要なので空ファイルで置く(存在検査だけのため)
        for n in ("honmono_v31_int8.onnx.part1", "honmono_v31_int8.onnx.part2"):
            open(os.path.join(dst, "honmono", "vendor", "models", n), "w").close()
        base, _ = check(dst)
        if base:
            print("!! 写しが壊れていない状態で既に問題あり:", base[:5]); sys.exit(1)
        print("自己テスト: 健全な写しでは 0件 … OK")

        # count=None なら全部置き換える。「必須の記載が消えた」を仕込むには、
        # 同じ語がページ内の複数箇所(本文とフッター等)にあると1か所だけでは足りない。
        cases = [
            ("リンク切れ",     "honmono/index.html",        'href="report/"',            'href="repooort/"'),
            ("禁止表現の復活", "honmono/docs/index.html",   "ページを閉じれば何も残りません", "ページを閉じれば何も残りません(オフラインでも動作します)"),
            ("必須記載の欠落", "honmono/legal/terms.html",  "故意または重大な過失",       "ぜんぶ", None),
            ("外部読み込み",   "honmono/index.html",        '<link rel="stylesheet" href="honmono.css">',
                                                            '<link rel="stylesheet" href="honmono.css"><script src="https://evil.example.com/x.js"></script>'),
            ("タグ崩れ",       "honmono/business/index.html", "</main>",                 "</main></div>"),
            ("架空の人名",     "honmono/creators/creators.json", "掲載カードの見本 ①",   "(サンプル)葉山みお"),
        ]
        ok = 0
        for case in cases:
            name, relpath, old, new = case[:4]
            count = case[4] if len(case) > 4 else 1
            p = os.path.join(dst, relpath.replace("/", os.sep))
            orig = open(p, encoding="utf-8").read()
            if old not in orig:
                print("  [%s] 仕込む場所が見つからない → 検査不能" % name); continue
            open(p, "w", encoding="utf-8", newline="").write(
                orig.replace(old, new) if count is None else orig.replace(old, new, count))
            probs, _ = check(dst)
            open(p, "w", encoding="utf-8", newline="").write(orig)
            if probs:
                print("  [%s] 検出 → OK (%s)" % (name, probs[0][:80])); ok += 1
            else:
                print("  [%s] ★見逃した★" % name)
        print("自己テスト: %d/%d の仕込みを検出" % (ok, len(cases)))
        shutil.rmtree(tmp, ignore_errors=True)
        sys.exit(0 if ok == len(cases) else 1)

    problems, n = check(site)
    print("検査したHTML: %d ページ" % n)
    if problems:
        print("問題 %d件:" % len(problems))
        for p in problems: print("  -", p)
        sys.exit(1)
    print("VERIFY PASS — 問題なし")

main()
