# -*- coding: utf-8 -*-
"""Phase 5 DESIGN RETURN VERIFY.

Design Quality は評価しない。機械的な整合性だけを見る。
  - binding(request_id / function_freeze_hash)
  - 必須ファイルとビジュアル
  - Function Freeze との矛盾(capability / state / 必須文言 / 配置制約 PL-1..7)
  - 実装不能な指示(外部フォント・外部CDN・新規ランタイム・サーバー処理・Service Worker)
  - 捏造された製品主張(実測値に無い数値・存在しない実績)
  - DESIGN_SYSTEM の上限(文字階層5・面の丸み3)
  - MOTION の目的と reduced-motion

--mutate で、わざと壊して本当に落ちるか確かめる。
"""
import hashlib, io, json, os, re, shutil, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRUTH = os.path.join(ROOT, "truth")
BRIDGE = os.path.join(ROOT, "bridge")
DEFAULT_RETURN = os.path.join(ROOT, "return", "HONMONO_DESIGN_RETURN_v4_1")

REQUIRED_DOCS = ["DESIGN_DECISION.md", "DESIGN_SYSTEM.md", "SCREEN_SPEC.md",
                 "MOTION_SPEC.md", "ASSET_MANIFEST.json", "DESIGN_RETURN_BINDING.json"]
REQUIRED_VISUALS = ["HOME_MASTER_light.png", "HOME_MASTER_dark.png",
                    "TASK_MASTER_light.png", "TASK_MASTER_dark.png",
                    "STATE_VISUALS_light.png"]
SCREENS = ["HOME", "CHECKER", "AICHECK", "BADGE", "CREATORS", "REPORT",
           "BUSINESS", "DOCS", "LEGAL_PRIVACY", "LEGAL_TERMS", "LEGAL_CREDITS"]
PL = ["PL-1", "PL-2", "PL-3", "PL-4", "PL-5", "PL-6", "PL-7"]

# 実装できない指示(CSP / プロジェクト規則で必ず壊れるもの)
IMPOSSIBLE = [
    (re.compile(r"fonts\.googleapis\.com|fonts\.gstatic\.com|@import\s+url\(\s*['\"]?https", re.I), "外部Webフォント"),
    (re.compile(r"cdnjs\.cloudflare|cdn\.jsdelivr|unpkg\.com|cdn\.tailwindcss", re.I), "外部CDN"),
    (re.compile(r"font[-\s]?awesome|material\s?symbols|material\s?icons|lucide|feather\s?icons", re.I), "外部アイコンライブラリ"),
    (re.compile(r"\b(gsap|framer[-\s]?motion|lottie|three\.js|anime\.js|tailwind|bootstrap)\b", re.I), "新規ランタイム依存"),
    (re.compile(r"service\s?worker|オフラインでも動作", re.I), "Service Worker / オフライン前提"),
    (re.compile(r"サーバー(側|で)(処理|保存|生成)|バックエンド|ログイン機能|データベース", re.I), "サーバー処理前提"),
    (re.compile(r"backdrop-filter", re.I), "ガラスモーフィズム(自ら禁止と宣言)"),
]

# 捏造してはいけない主張
INVENTED = [
    (re.compile(r"(利用者|ユーザー|導入)(数|実績)[^\n]{0,12}[0-9,]+"), "存在しない利用者数・導入実績"),
    (re.compile(r"受賞|アワード|表彰"), "存在しない受賞歴"),
    (re.compile(r"第三者(による)?(監査|認証|検証済)"), "第三者監査(行われていない)"),
    (re.compile(r"(月額|年額|税込|税抜)\s*[0-9]"), "存在しない課金"),
    (re.compile(r"無料トライアル|フリートライアル"), "存在しないトライアル"),
    (re.compile(r"(判定|検出|精度)[^\n]{0,8}(100%|確実に|必ず)"), "断定表現"),
    (re.compile(r"AI(生成)?で(は)?ない(こと)?を(証明|保証)でき"), "『AIではない証明』の主張"),
]


def load(p):
    return io.open(p, encoding="utf-8").read()


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(65536), b""):
            h.update(c)
    return h.hexdigest()


def check(rdir):
    problems = []
    names = set(os.listdir(rdir))

    for n in REQUIRED_DOCS + REQUIRED_VISUALS:
        if n not in names:
            problems.append("必須ファイルが無い: " + n)
    if any(p.startswith("必須ファイルが無い") for p in problems):
        return problems

    binding = json.loads(load(os.path.join(rdir, "DESIGN_RETURN_BINDING.json")))
    req = json.loads(load(os.path.join(BRIDGE, "DESIGN_RETURN_BINDING.json")))
    ff = json.loads(load(os.path.join(TRUTH, "FUNCTION_FREEZE.json")))
    si = json.loads(load(os.path.join(TRUTH, "SCREEN_STATE_INVENTORY.json")))
    pc = json.loads(load(os.path.join(BRIDGE, "FUNCTION_PRESENCE_CONTRACT.json")))
    rc = json.loads(load(os.path.join(TRUTH, "REQUIRED_COPY.json")))
    ts = json.loads(load(os.path.join(TRUTH, "TRUST_AND_SAFETY_FACTS.json")))

    # --- binding ---
    if binding.get("responds_to_request_id") != req["request_id"]:
        problems.append("request_id が一致しない: %s != %s"
                        % (binding.get("responds_to_request_id"), req["request_id"]))
    if binding.get("function_freeze_hash") != req["file_hashes"]["FUNCTION_FREEZE.json"]:
        problems.append("function_freeze_hash が一致しない(Freeze が改変された可能性)")
    for k in ("declared_no_function_change", "declared_no_copy_meaning_change",
              "declared_no_external_dependency", "declared_no_human_depiction"):
        if binding.get(k) is not True:
            problems.append("宣言が true でない: " + k)

    # --- capability / state の網羅 ---
    want_caps = {c["capability_id"] for c in pc["capabilities"]}
    got_caps = set(binding.get("covered_capability_ids") or [])
    for m in sorted(want_caps - got_caps):
        problems.append("扱われていない capability: " + m)

    want_states = {s["id"] for s in si["global_states"]}
    for sc in si["screens"]:
        want_states |= {s["id"] for s in sc["states"]}
    got_states = set(binding.get("covered_state_ids") or [])
    for m in sorted(want_states - got_states):
        problems.append("扱われていない state: " + m)

    spec = load(os.path.join(rdir, "SCREEN_SPEC.md"))
    for sid in sorted(want_states):
        if sid not in spec:
            problems.append("SCREEN_SPEC が見せ方を書いていない state: " + sid)

    # --- 11画面 ---
    for s in SCREENS:
        if not re.search(r"^##\s+" + re.escape(s) + r"\s*$", spec, re.M):
            problems.append("SCREEN_SPEC が扱っていない画面: " + s)

    # --- 配置制約 ---
    for p in PL:
        if p not in spec:
            problems.append("配置制約が扱われていない: " + p)

    # --- 必須文言(verbatim)が SCREEN_SPEC に載っているか ---
    for it in rc["items"]:
        if not str(it.get("kind", "")).startswith("verbatim"):
            continue
        vals = it.get("fragments") or [it.get("value")]
        for v in vals:
            if v and v not in spec:
                problems.append("必須文言が SCREEN_SPEC に無い: %s 「%s」" % (it["id"], v))

    # --- 実装不能な指示 / 捏造 ---
    docs = {n: load(os.path.join(rdir, n)) for n in REQUIRED_DOCS}
    for n, body in docs.items():
        for rx, why in IMPOSSIBLE:
            m = rx.search(body)
            if m:
                problems.append("%s: 実装不能な指示(%s)「%s」" % (n, why, m.group(0)[:40]))
        for rx, why in INVENTED:
            m = rx.search(body)
            if m:
                problems.append("%s: 捏造の疑い(%s)「%s」" % (n, why, m.group(0)[:40]))

    # --- 数値: 実測値に無い精度の数字を持ち込んでいないか ---
    known = set()
    for v in ts["measured_numbers"]["values"]:
        known |= set(re.findall(r"\d+(?:\.\d+)?%", v["value"]))
    known |= {"100%", "0%", "50%", "80%", "35%", "55%", "40%", "52%", "56%", "92%", "65%", "76%"}
    for n, body in docs.items():
        for pct in set(re.findall(r"\d+\.\d+%", body)):
            if pct not in known:
                problems.append("%s: 実測値に無い数値「%s」" % (n, pct))

    # --- DESIGN_SYSTEM の上限 ---
    ds = docs["DESIGN_SYSTEM.md"]
    levels = len(set(re.findall(r"--type-[a-z]+", ds)))
    if levels > 5:
        problems.append("文字階層が5段を超えている: %d" % levels)
    radii = len(set(re.findall(r"--r-\d+", ds)))
    if radii > 3:
        problems.append("面の丸みが3種を超えている: %d" % radii)

    # --- MOTION ---
    ms = docs["MOTION_SPEC.md"]
    blocks = re.split(r"^##\s+M-", ms, flags=re.M)[1:]
    if not blocks:
        problems.append("MOTION_SPEC にモーション定義が無い")
    for b in blocks:
        mid = "M-" + b.split("\n", 1)[0].strip()
        purpose = re.search(r"\*\*PURPOSE:\*\*\s*(.+)", b)
        if not purpose:
            problems.append("%s: PURPOSE が無い" % mid)
        elif not re.search(r"Feedback|State Transition|Brand Motion", purpose.group(1)):
            problems.append("%s: PURPOSE が3目的のどれでもない「%s」" % (mid, purpose.group(1).strip()))
        if "REDUCED_MOTION:" not in b:
            problems.append("%s: REDUCED_MOTION が無い" % mid)
        props = re.search(r"\*\*PROPERTIES:\*\*\s*(.+)", b)
        if props and re.search(r"\b(width|height|top|left|margin|padding)\b", props.group(1)):
            problems.append("%s: レイアウトを動かすプロパティを指定している" % mid)

    # --- ASSET_MANIFEST ---
    am = json.loads(docs["ASSET_MANIFEST.json"])
    for a in am["assets"]:
        if a.get("external_dependency"):
            problems.append("外部依存のアセット: " + a["id"])
        if a.get("human_depiction"):
            problems.append("人物を描いたアセット: " + a["id"])
        if a.get("source") == "authored_by_design_authority":
            rel = re.search(r"assets/[\w.-]+", a.get("spec", "") + " " + a.get("usage", ""))
            if rel and not os.path.exists(os.path.join(rdir, rel.group(0))):
                problems.append("同梱されていないアセット: %s (%s)" % (a["id"], rel.group(0)))

    # --- Function Freeze との矛盾(機能削除の宣言が無いか) ---
    for word in ["機能を削除", "機能は削除", "state を削除", "状態を削除", "廃止する"]:
        for n, body in docs.items():
            if word in body:
                problems.append("%s: Function Freeze と矛盾する指示「%s」" % (n, word))

    return problems


MUTATIONS = [
    ("request_id の不一致", "DESIGN_RETURN_BINDING.json",
     lambda s: s.replace("HONMONO-UI-REDESIGN-v4-", "HONMONO-UI-REDESIGN-v4-XXXX")),
    ("Freeze ハッシュの改変", "DESIGN_RETURN_BINDING.json",
     lambda s: json.dumps({**json.loads(s), "function_freeze_hash": "0" * 64}, ensure_ascii=False)),
    ("state の取りこぼし", "DESIGN_RETURN_BINDING.json",
     lambda s: json.dumps({**json.loads(s),
                           "covered_state_ids": json.loads(s)["covered_state_ids"][:-1]}, ensure_ascii=False)),
    ("必須文言の欠落", "SCREEN_SPEC.md", lambda s: s.replace("不可能ではありません", "偽造できません")),
    ("配置制約の欠落", "SCREEN_SPEC.md", lambda s: s.replace("PL-1", "___")),
    ("画面の欠落", "SCREEN_SPEC.md", lambda s: s.replace("\n## CREATORS\n", "\n## _CREATORS_\n")),
    ("外部フォントの指定", "DESIGN_SYSTEM.md", lambda s: s + "\n@import url('https://fonts.googleapis.com/css2?family=Noto');\n"),
    ("新規ランタイム依存", "MOTION_SPEC.md", lambda s: s + "\nUse GSAP for the hero timeline.\n"),
    ("捏造の実績", "DESIGN_DECISION.md", lambda s: s + "\n第三者による監査を受けています。\n"),
    ("目的の無いモーション", "MOTION_SPEC.md", lambda s: s.replace("**PURPOSE:** Brand Motion", "**PURPOSE:** 見た目のため")),
    ("reduced-motion の欠落", "MOTION_SPEC.md", lambda s: s.replace("- **REDUCED_MOTION:** no transform; artwork/headline visible immediately", "")),
    ("人物アセットの混入", "ASSET_MANIFEST.json",
     lambda s: json.dumps({"assets": [{**json.loads(s)["assets"][0], "human_depiction": True}]}, ensure_ascii=False)),
]


def main():
    rdir = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else DEFAULT_RETURN
    if "--mutate" not in sys.argv:
        probs = check(rdir)
        print("検査対象:", rdir)
        if probs:
            print("DESIGN RETURN: FAIL — 問題 %d件" % len(probs))
            for p in probs:
                print("  -", p)
            sys.exit(1)
        print("DESIGN RETURN: VERIFIED"
              "(binding一致 / 必須ファイル揃い / capability 0欠落 / state 0欠落 /"
              " 必須文言0欠落 / 配置制約0欠落 / 実装不能0 / 捏造0)")
        return

    tmp = tempfile.mkdtemp(prefix="honmono_ret_")
    dst = os.path.join(tmp, "ret")
    shutil.copytree(rdir, dst)
    base = check(dst)
    if base:
        print("!! 健全な写しで既に問題あり:", base[:5]); sys.exit(1)
    print("自己テスト: 健全な写しでは 0件 … OK")
    ok = 0
    for name, target, mut in MUTATIONS:
        p = os.path.join(dst, target)
        orig = load(p)
        io.open(p, "w", encoding="utf-8", newline="\n").write(mut(orig))
        probs = check(dst)
        io.open(p, "w", encoding="utf-8", newline="\n").write(orig)
        if probs:
            print("  [%s] 検出 → OK (%s)" % (name, probs[0][:66])); ok += 1
        else:
            print("  [%s] ★見逃した★" % name)
    print("自己テスト: %d/%d の仕込みを検出" % (ok, len(MUTATIONS)))
    shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(0 if ok == len(MUTATIONS) else 1)


if __name__ == "__main__":
    main()
