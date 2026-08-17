# apply_tokens.py — WO UI-band-setlistedit の G3。
# band/style.css の生値(font-size 33種・角丸10種・:root外の生16進25個)を、
# Stitch 見本 B から実測したトークンへ機械的に置換する。手で1つずつ直すと必ず取りこぼすため。
#
# 実行: python ui-workbench/wo/apply_tokens.py   (リポジトリのルートで)
# 冪等: 既に var(--…) になっている箇所は触らない。

import io, re, sys

CSS = "band/style.css"
s = io.open(CSS, encoding="utf-8").read()

# ---------- 1) :root を M3 ロール + トークンに差し替え ----------
NEW_ROOT = """:root {
  color-scheme: dark;

  /* --- 色: Material Design 3 ロール(Stitch 見本 B の computed 値から実測) --- */
  --bg: #10131a;                    /* background / surface */
  --surface: #191b23;               /* surface-container-low : 入力欄・チップの地 */
  --card: #0b0e15;                  /* surface-container-lowest : 曲行・カードの地 */
  --surface-2: #1d2027;             /* surface-container : 下部バー */
  --surface-3: #272a32;             /* surface-container-high : 押し出したい行 */
  --card-border: #32353d;           /* surface-variant : 枠線 */
  --ink: #e0e2ec;                   /* on-surface */
  --ink-2: #ddc1ae;                 /* on-surface-variant : 副文・アイコン */
  --muted: #a48c7a;                 /* outline : 補助文・枠 */
  --accent: #ff8c00;                /* primary-container : 主操作の面 */
  --accent-2: #ffb77d;              /* primary : 文字・線のアクセント */
  --accent-deep: #ff8c00;
  --accent-ink: #1c0e00;            /* on-primary(見本の #623200 はコントラスト 4.46 で不足 → 暗くして 8.0 以上を確保) */
  --danger: #ffb4ab;                /* error */
  --danger-ink: #690005;
  --ok: #6fd899;
  --focus: #7ab8ff;
  --info: #7ab8ff;

  /* --- 文字階層(M3 型スケール。画面ごとの実測は 5 種以内に収める) --- */
  --fs-display: 57px;   /* BPM・チューナーの巨大数値 */
  --fs-headline: 32px;  /* 本番モードの曲名 */
  --fs-title-lg: 22px;  /* 画面タイトル・合計時間 */
  --fs-title: 16px;     /* 見出し・曲名・本文の主 */
  --fs-body: 14px;      /* ボタン・入力・本文の副 */
  --fs-label: 12px;     /* メタ・注記 */

  /* --- 形 --- */
  --r-1: 8px;
  --r-2: 12px;
  --r-3: 999px;
  --radius: 12px;       /* 旧名(既存セレクタ互換) */

  /* --- 余白(8dp グリッド) --- */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --sp-6: 32px;

  /* --- タップ領域 --- */
  --tap: 44px;          /* HIG 44pt(M3 48dp より厳しい側の共通床) */

  --shadow: 0 8px 28px #00000059;
}"""
s = re.sub(r":root \{.*?\n\}", NEW_ROOT, s, count=1, flags=re.S)

# ---------- 2) font-size をトークンへ(画面用のみ。print は pt のまま) ----------
FS = {
    "4rem": "var(--fs-display)", "3.2rem": "var(--fs-display)", "3.1rem": "var(--fs-display)",
    "2.4rem": "var(--fs-headline)", "2rem": "var(--fs-headline)",
    "1.9rem": "var(--fs-title-lg)", "1.35rem": "var(--fs-title-lg)",
    "1.2rem": "var(--fs-title)", "1.15rem": "var(--fs-title)", "1.1rem": "var(--fs-title)",
    "1.05rem": "var(--fs-title)", "1.02rem": "var(--fs-title)",
    ".95rem": "var(--fs-body)", ".9rem": "var(--fs-body)", ".88rem": "var(--fs-body)",
    ".85rem": "var(--fs-body)", ".82rem": "var(--fs-body)",
    ".8rem": "var(--fs-label)", ".78rem": "var(--fs-label)", ".76rem": "var(--fs-label)",
    ".75rem": "var(--fs-label)", ".74rem": "var(--fs-label)", ".72rem": "var(--fs-label)",
    ".7rem": "var(--fs-label)", ".68rem": "var(--fs-label)", ".66rem": "var(--fs-label)",
}
def fs_sub(m):
    v = m.group(1).strip()
    return f"font-size: {FS[v]}" if v in FS else m.group(0)
s = re.sub(r"font-size:\s*([^;]+)", fs_sub, s)

# ---------- 3) 角丸をトークンへ ----------
RAD = {"2px": "var(--r-1)", "6px": "var(--r-1)", "8px": "var(--r-1)", "9px": "var(--r-1)", "10px": "var(--r-1)",
       "12px": "var(--r-2)", "14px": "var(--r-2)", "var(--radius)": "var(--r-2)",
       "99px": "var(--r-3)", "999px": "var(--r-3)", "50%": "var(--r-3)"}
def rad_sub(m):
    v = m.group(1).strip()
    return f"border-radius: {RAD[v]}" if v in RAD else m.group(0)
s = re.sub(r"border-radius:\s*([^;]+)", rad_sub, s)

# ---------- 4) :root 外の生16進をトークンへ ----------
HEX = {
    "#7ab8ff": "var(--info)", "#8a93a6": "var(--muted)", "#333": "var(--muted)", "#999": "var(--muted)",
    "#0b0e14f0": "var(--surface-2)", "#05070bd0": "#000000d0",
    "#ffb45455": "var(--accent-2)", "#ffb45466": "var(--accent-2)", "#ffb45418": "transparent",
    "#ff7b7255": "var(--danger)", "#6fd89944": "var(--ok)",
}
for k, v in HEX.items():
    s = re.sub(re.escape(k) + r"\b", v, s)
# 背景のグラデーション(生値)は撤去 — 見本 B は単色。グラデ上はコントラスト判定不能にもなる
s = s.replace("""  background:
    radial-gradient(1100px 500px at 50% -180px, #23304a66, transparent 70%),
    var(--bg);""", "  background: var(--bg);")

# ---------- 5) タップ領域 44px 未満を底上げ ----------
TAP = [
    ("min-height: 42px;", "min-height: var(--tap);"),
    ("min-height: 34px; padding: 5px 10px;", "min-height: var(--tap); padding: 8px 12px;"),
    ("min-height: 38px;", "min-height: var(--tap);"),
    ("width: 34px; height: 30px;", "width: var(--tap); height: var(--tap);"),
    ("min-height: 26px;", "min-height: var(--tap);"),
    ("min-width: 46px; min-height: 46px;", "min-width: var(--tap); min-height: var(--tap);"),
]
for a, b in TAP:
    s = s.replace(a, b)

# ---------- 6) 入力欄は 16px 以上(iOS の自動ズーム回避)= HARD ----------
s = s.replace(
    'input[type="text"], input[type="number"], textarea, select {\n  width: 100%;',
    'input[type="text"], input[type="number"], textarea, select {\n  font-size: var(--fs-title); /* 16px 未満にしない(iOS が勝手に拡大する) */\n  width: 100%;'
)
s = s.replace(".chart-controls select { flex: 1 1 160px; width: auto; font-size: var(--fs-body); min-height: var(--tap); }",
              ".chart-controls select { flex: 1 1 160px; width: auto; min-height: var(--tap); }")
s = s.replace(".rec-song { margin-top: 6px; font-size: var(--fs-label); min-height: var(--tap); padding: 4px 8px; width: auto; max-width: 100%; }",
              ".rec-song { margin-top: 6px; min-height: var(--tap); padding: 4px 8px; width: auto; max-width: 100%; }")
s = s.replace(".tuner-settings input { width: 90px; }", ".tuner-settings input { width: 110px; }")

io.open(CSS, "w", encoding="utf-8", newline="\n").write(s)

# ---------- 検算 ----------
body = re.sub(r":root \{.*?\n\}", "", s, flags=re.S)
print("font-size 宣言の種類:", len(set(re.findall(r"font-size:\s*([^;!}]+)", s))))
print("border-radius 宣言の種類:", len(set(re.findall(r"border-radius:\s*([^;!}]+)", s))))
print(":root 外の生16進:", len(re.findall(r"#[0-9a-fA-F]{3,8}\b", body)), sorted(set(re.findall(r"#[0-9a-fA-F]{3,8}\b", body))))
print("残る 42px/34px/26px/38px:", len(re.findall(r"(?:min-height|height|min-width):\s*(?:42|34|26|38|30)px", body)))
