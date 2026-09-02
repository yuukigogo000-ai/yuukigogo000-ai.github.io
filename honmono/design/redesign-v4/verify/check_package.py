# -*- coding: utf-8 -*-
"""Phase 4 SELF VALIDATION — CHATGPT_DESIGN_REQUEST の自己検査.

見ているもの:
  1) Function Truth coverage  — F-ID / S-ID / capability が1つも欠けていないか
  2) no current screenshot     — 画像ファイルが混ざっていないか
  3) no current CSS            — CSS / HTML が混ざっていないか
  4) no visual layout leakage  — 現行UIの色・CSS・構造語が残っていないか
  5) required copy included    — verbatim の文言が1文字も変わっていないか
  6) binding valid             — 必須ファイルの存在とハッシュが合っているか

--mutate を付けると、わざと6種類壊して、全部検出できるかを確かめる。
検査器を直したら必ず --mutate を通してから信用すること。
"""
import hashlib, io, json, os, re, shutil, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRUTH = os.path.join(ROOT, "truth")

REQUIRED_FILES = [
    "PRODUCT_TRUTH.json",
    "FUNCTION_FREEZE.json",
    "SCREEN_STATE_INVENTORY.json",
    "REQUIRED_COPY.json",
    "TECHNICAL_CONSTRAINTS.json",
    "TRUST_AND_SAFETY_FACTS.json",
    "BLIND_DESIGN_BRIEF.md",
    "FUNCTION_PRESENCE_CONTRACT.json",
    "DESIGN_RETURN_SCHEMA.json",
    "DESIGN_RETURN_BINDING.json",
    "CHATGPT_INSTRUCTIONS.md",
]

# 現行UIの見た目そのもの。1件でもあれば漏洩
CSSISH = [
    (re.compile(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b"), "現行の色値(16進)"),
    (re.compile(r"\b(?:rgba?|hsla?)\s*\("), "現行の色値(rgb/hsl)"),
    (re.compile(r"\b(?:font-size|font-family|font-weight|border-radius|box-shadow|line-height|"
                r"letter-spacing|z-index|flex-wrap|flex-direction|grid-template|"
                r"text-align|vertical-align|white-space|word-break)\b"), "CSSプロパティ"),
    (re.compile(r"\b(?:position|background|border|padding|margin|opacity|transition|display)\s*:"), "CSS宣言"),
    (re.compile(r"(?<![\w.])\d{1,3}px\b"), "現行のピクセル値"),
    (re.compile(r"(?:^|[\s\"'(])\.[a-z][\w-]*(?:\s|[\"',)]|$)"), "CSSクラスセレクタ"),
]

# 現行UIの構造・装飾を指す語
STRUCTURAL = [
    "カード", "グリッド", "ヒーロー", "横並び", "角丸", "罫線", "絵文字",
    "ティール", "帯グラフ", "ドロップシャドウ", "サイドバー", "タブバー",
    "アコーディオン", "パンくず", "ハンバーガー", "トースト", "モーダル",
    "現在の配色", "現行の見た目", "既存の見た目", "現在のデザイン",
    "点線枠", "白背景", "1px",
]

# 意図して入れている語(理由つき)
ALLOWED_PHRASES = {
    "#9110": "警察相談専用電話の番号。色値ではない",
    "360px": "検証幅の指定。現行UIの寸法ではない",
    "390px": "検証幅の指定",
    "430px": "検証幅の指定",
    "折りたたみ": "『警告を折りたたみに隠すな』という安全要件(否定形の制約)",
    "prefers-color-scheme": "実装制約(テーマの取得方法)",
    "prefers-reduced-motion": "実装制約(必須対応)",
    "color-scheme": "実装制約",
    "style-src": "CSPの値(実装制約)",
    "img-src": "CSPの値",
    "font-src": "CSPの値",
    "object-src": "CSPの値",
    "base-uri": "CSPの値",
    "form-action": "CSPの値",
    "script-src": "CSPの値",
    "media-src": "CSPの値",
    "connect-src": "CSPの値",
    "worker-src": "CSPの値",
    "frame-src": "CSPの値",
    "default-src": "CSPの値",
}

# REQUIRED_COPY の中で、製品の実文言そのものを保持しているキー
COPY_KEYS = {"value", "fragments", "current"}

BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff",
              ".pdf", ".psd", ".fig", ".sketch"}
FORBIDDEN_EXT = BINARY_EXT | {".css", ".scss", ".less", ".html", ".htm", ".svg"}


def mask_allowed(text):
    for phrase in ALLOWED_PHRASES:
        text = text.replace(phrase, " " * len(phrase))
    return text


def scan_text(name, text, structural=True, problems=None):
    masked = mask_allowed(text)
    for rx, why in CSSISH:
        m = rx.search(masked)
        if m:
            problems.append("%s: 見た目の漏洩(%s)「%s」" % (name, why, m.group(0).strip()))
    if structural:
        for w in STRUCTURAL:
            if w in masked:
                problems.append("%s: 現行UIの構造語「%s」が残っている" % (name, w))


def scan_required_copy(name, path, problems):
    """製品の実文言(value / fragments / current)は構造語の検査から外す。"""
    raw = io.open(path, encoding="utf-8").read()
    scan_text(name, raw, structural=False, problems=problems)
    data = json.loads(raw)

    def walk(node, in_copy):
        if isinstance(node, str):
            if not in_copy:
                scan_text(name, node, structural=True, problems=problems)
        elif isinstance(node, list):
            for v in node:
                walk(v, in_copy)
        elif isinstance(node, dict):
            for k, v in node.items():
                walk(v, in_copy or k in COPY_KEYS)

    walk(data, False)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def check(pkg):
    problems = []
    names = sorted(os.listdir(pkg))

    # (2)(3) 混入してはいけないファイル
    for n in names:
        ext = os.path.splitext(n)[1].lower()
        if ext in FORBIDDEN_EXT:
            problems.append("同梱不可のファイルが入っている: %s(現行のスクリーンショット/CSS/マークアップは渡さない)" % n)

    # (6) 必須ファイル
    for n in REQUIRED_FILES:
        if not os.path.exists(os.path.join(pkg, n)):
            problems.append("必須ファイルが無い: " + n)
    if problems and any(p.startswith("必須ファイルが無い") for p in problems):
        return problems

    # (4) 漏洩スキャン
    for n in names:
        p = os.path.join(pkg, n)
        if not os.path.isfile(p):
            continue
        if os.path.splitext(n)[1].lower() in FORBIDDEN_EXT:
            continue
        if n == "REQUIRED_COPY.json":
            scan_required_copy(n, p, problems)
        else:
            scan_text(n, io.open(p, encoding="utf-8").read(), True, problems)

    tr_ff = json.load(io.open(os.path.join(TRUTH, "FUNCTION_FREEZE.json"), encoding="utf-8"))
    tr_si = json.load(io.open(os.path.join(TRUTH, "SCREEN_STATE_INVENTORY.json"), encoding="utf-8"))
    tr_rc = json.load(io.open(os.path.join(TRUTH, "REQUIRED_COPY.json"), encoding="utf-8"))
    pk_ff = json.load(io.open(os.path.join(pkg, "FUNCTION_FREEZE.json"), encoding="utf-8"))
    pk_si = json.load(io.open(os.path.join(pkg, "SCREEN_STATE_INVENTORY.json"), encoding="utf-8"))
    pk_rc = json.load(io.open(os.path.join(pkg, "REQUIRED_COPY.json"), encoding="utf-8"))
    pk_pc = json.load(io.open(os.path.join(pkg, "FUNCTION_PRESENCE_CONTRACT.json"), encoding="utf-8"))

    # (1) Function Truth coverage
    tf = {f["id"] for f in tr_ff["functions"]}
    pf = {f["id"] for f in pk_ff["functions"]}
    for miss in sorted(tf - pf):
        problems.append("Function Truth の欠落: " + miss)

    def sids(doc):
        s = {x["id"] for x in doc["global_states"]}
        for sc in doc["screens"]:
            s |= {x["id"] for x in sc["states"]}
        return s

    for miss in sorted(sids(tr_si) - sids(pk_si)):
        problems.append("State Truth の欠落: " + miss)

    covf, covs = set(), set()
    for cap in pk_pc["capabilities"]:
        covf |= set(cap["function_ids"])
        covs |= set(cap["state_ids"])
    for miss in sorted(tf - covf):
        problems.append("FUNCTION_PRESENCE_CONTRACT が扱っていない機能: " + miss)
    for miss in sorted(sids(tr_si) - covs):
        problems.append("FUNCTION_PRESENCE_CONTRACT が扱っていない状態: " + miss)

    # (5) verbatim の文言が変わっていないか
    want = {}
    for it in tr_rc["items"]:
        if str(it.get("kind", "")).startswith("verbatim"):
            if "value" in it:
                want[it["id"]] = [it["value"]]
            if "fragments" in it:
                want[it["id"]] = it["fragments"]
    got = {it["id"]: it for it in pk_rc["items"]}
    for k, vals in want.items():
        if k not in got:
            problems.append("必須文言の項目が消えている: " + k)
            continue
        have = got[k].get("fragments") or [got[k].get("value")]
        for v in vals:
            if v not in have:
                problems.append("必須文言が改変されている: %s 「%s」" % (k, v))

    # (6) binding
    bd = json.load(io.open(os.path.join(pkg, "DESIGN_RETURN_BINDING.json"), encoding="utf-8"))
    for key in ("request_id", "created_at", "file_hashes", "expects_return_schema"):
        if key not in bd:
            problems.append("DESIGN_RETURN_BINDING.json に %s が無い" % key)
    for n, want_hash in bd.get("file_hashes", {}).items():
        p = os.path.join(pkg, n)
        if not os.path.exists(p):
            problems.append("binding が存在しないファイルを指している: " + n)
        elif sha256(p) != want_hash:
            problems.append("binding のハッシュが一致しない: " + n)
    for n in REQUIRED_FILES:
        if n not in ("DESIGN_RETURN_BINDING.json",) and n not in bd.get("file_hashes", {}):
            problems.append("binding にハッシュが無い: " + n)

    return problems


MUTATIONS = [
    ("現行の色値の混入", "BLIND_DESIGN_BRIEF.md",
     lambda s: s + "\n\nアクセントは #0e7490 を維持してください。\n"),
    ("現行の構造語の混入", "BLIND_DESIGN_BRIEF.md",
     lambda s: s + "\n\n4機能はカードで横並びに表示してください。\n"),
    ("機能の欠落", "FUNCTION_FREEZE.json",
     lambda s: json.dumps(
         (lambda d: (d["functions"].pop(0), d)[1])(json.loads(s)), ensure_ascii=False, indent=2)),
    ("必須文言の改変", "REQUIRED_COPY.json",
     lambda s: s.replace("不可能ではありません", "偽造できません")),
    ("スクリーンショットの混入", "__new__:current_home.png", lambda s: "PNG"),
    ("bindingのハッシュ不一致", "PRODUCT_TRUTH.json", lambda s: s + "\n"),
]


def main():
    pkg = os.path.join(ROOT, "bridge")
    if "--mutate" not in sys.argv:
        probs = check(pkg)
        print("検査対象: %s" % pkg)
        if probs:
            print("SELF VALIDATION: FAIL — 問題 %d件" % len(probs))
            for p in probs:
                print("  -", p)
            sys.exit(1)
        print("SELF VALIDATION: PASS(漏洩0 / 欠落0 / 文言改変0 / binding一致)")
        return

    tmp = tempfile.mkdtemp(prefix="honmono_pkg_")
    dst = os.path.join(tmp, "bridge")
    shutil.copytree(pkg, dst)
    base = check(dst)
    if base:
        print("!! 健全な写しで既に問題あり:", base[:5])
        sys.exit(1)
    print("自己テスト: 健全な写しでは 0件 … OK")

    ok = 0
    for name, target, mutate in MUTATIONS:
        if target.startswith("__new__:"):
            p = os.path.join(dst, target.split(":", 1)[1])
            io.open(p, "w", encoding="utf-8").write(mutate(""))
            probs = check(dst)
            os.remove(p)
        else:
            p = os.path.join(dst, target)
            orig = io.open(p, encoding="utf-8").read()
            io.open(p, "w", encoding="utf-8", newline="\n").write(mutate(orig))
            probs = check(dst)
            io.open(p, "w", encoding="utf-8", newline="\n").write(orig)
        if probs:
            print("  [%s] 検出 → OK (%s)" % (name, probs[0][:70]))
            ok += 1
        else:
            print("  [%s] ★見逃した★" % name)
    print("自己テスト: %d/%d の仕込みを検出" % (ok, len(MUTATIONS)))
    shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(0 if ok == len(MUTATIONS) else 1)


if __name__ == "__main__":
    main()
