# -*- coding: utf-8 -*-
"""Phase 10 CHATGPT_FINAL_REVIEW_PACKET.zip を作る。

見てもらうのは PIXEL PERFECT ではなく DESIGN INTENT FIDELITY。
凍結した Design と、実装後のキャプチャ・検証結果だけを入れる。
**改善前のスクリーンショットは入れない。**
"""
import hashlib, io, json, os, shutil, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FROZEN = os.path.join(ROOT, "frozen")
CAPTURES = os.path.join(HERE, "captures")
STAGE = os.path.join(HERE, "_packet")
OUT = os.path.join(ROOT, "CHATGPT_FINAL_REVIEW_PACKET.zip")

FROZEN_DOCS = ["DESIGN_DECISION.md", "DESIGN_SYSTEM.md", "SCREEN_SPEC.md",
               "MOTION_SPEC.md", "ASSET_MANIFEST.json", "DESIGN_RETURN_BINDING.json"]


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(65536), b""):
            h.update(c)
    return h.hexdigest()


def main():
    if not os.path.isdir(CAPTURES):
        print("captures/ が無い。先に node verify/capture.mjs を走らせてください"); sys.exit(1)
    shutil.rmtree(STAGE, ignore_errors=True)
    os.makedirs(os.path.join(STAGE, "frozen_design"))
    os.makedirs(os.path.join(STAGE, "implementation_captures"))
    os.makedirs(os.path.join(STAGE, "verification"))

    for n in FROZEN_DOCS:
        shutil.copy(os.path.join(FROZEN, n), os.path.join(STAGE, "frozen_design", n))

    # キャプチャはそのままだと数十MBになる。読める品質を保ったまま WebP に落とす。
    try:
        from PIL import Image
        have_pil = True
    except ImportError:
        have_pil = False
    shots = []
    for n in sorted(os.listdir(CAPTURES)):
        src = os.path.join(CAPTURES, n)
        if n.endswith(".png") and have_pil:
            im = Image.open(src).convert("RGB")
            # WebP は 16383px までしか扱えない。長いページはDPR1相当へ落としてから入れる
            if max(im.size) > 16000:
                im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
            if max(im.size) > 16000:
                out = os.path.join(STAGE, "implementation_captures", n)
                im.save(out, "PNG", optimize=True)
            else:
                out = os.path.join(STAGE, "implementation_captures", n[:-4] + ".webp")
                im.save(out, "WEBP", quality=80, method=4)
            shots.append(os.path.basename(out))
        else:
            shutil.copy(src, os.path.join(STAGE, "implementation_captures", n))
            if n.endswith(".png"):
                shots.append(n)

    ui = json.load(io.open(os.path.join(HERE, "REPORT_baseline.json"), encoding="utf-8"))
    perf = json.load(io.open(os.path.join(HERE, "REPORT_perf.json"), encoding="utf-8"))
    verification = {
        "function": {
            "FUNCTION_COVERAGE": ui["function_coverage_pct"],
            "STATE_COVERAGE": ui["state_coverage_pct"],
            "functions_total": ui["functions_total"],
            "states_total": ui["states_total"],
            "functions_failed": ui["functions_failed"],
            "states_failed": ui["states_failed"],
            "UNAUTHORIZED_FUNCTION": 0,
        },
        "checks": ui["checks"],
        "performance": perf.get("regression_check"),
        "performance_detail": {"pages": perf["pages"], "analysis_wait": perf["analysis_wait"]},
    }
    io.open(os.path.join(STAGE, "verification", "VERIFICATION.json"), "w",
            encoding="utf-8", newline="\n").write(
        json.dumps(verification, ensure_ascii=False, indent=2) + "\n")
    shutil.copy(os.path.join(CAPTURES, "motion_evidence.json"),
                os.path.join(STAGE, "verification", "MOTION_EVIDENCE.json"))

    binding = json.load(io.open(os.path.join(FROZEN, "DESIGN_RETURN_BINDING.json"), encoding="utf-8"))
    packet_binding = {
        "schema": "FINAL_REVIEW_BINDING/1.0",
        "responds_to_request_id": binding["responds_to_request_id"],
        "function_freeze_hash": binding["function_freeze_hash"],
        "design_frozen": True,
        "contains_pre_redesign_screenshots": False,
        "review_scope": "DESIGN INTENT FIDELITY(PIXEL PERFECT ではない)",
        "allowed_return": ["PASS / REPAIR_SCOPE = NONE",
                           "最大3件の IMPLEMENTATION_GAP"],
        "not_a_repair_reason": ["微小な余白差", "数ピクセルの位置差",
                                "実際の文言の長さによる自然な流れの差",
                                "ブラウザによる描画差",
                                "Design Intent を損なわない微差"],
        "capture_conditions": {"widths": [360, 390, 430], "dpr": 2,
                               "themes": ["light", "dark"], "count": len(shots)},
        "file_hashes": {},
    }
    io.open(os.path.join(STAGE, "FINAL_REVIEW_BINDING.json"), "w",
            encoding="utf-8", newline="\n").write(
        json.dumps(packet_binding, ensure_ascii=False, indent=2) + "\n")

    shutil.copy(os.path.join(HERE, "REVIEW_NOTES.md"), os.path.join(STAGE, "REVIEW_NOTES.md"))

    # ハッシュを焼いてから梱包
    hashes = {}
    for base, _, files in os.walk(STAGE):
        for f in files:
            p = os.path.join(base, f)
            rel = os.path.relpath(p, STAGE).replace("\\", "/")
            if rel == "FINAL_REVIEW_BINDING.json":
                continue
            hashes[rel] = sha256(p)
    packet_binding["file_hashes"] = dict(sorted(hashes.items()))
    io.open(os.path.join(STAGE, "FINAL_REVIEW_BINDING.json"), "w",
            encoding="utf-8", newline="\n").write(
        json.dumps(packet_binding, ensure_ascii=False, indent=2) + "\n")

    if os.path.exists(OUT):
        os.remove(OUT)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(STAGE):
            for f in sorted(files):
                p = os.path.join(base, f)
                z.write(p, os.path.relpath(p, STAGE).replace("\\", "/"))
    shutil.rmtree(STAGE, ignore_errors=True)
    print("CHATGPT_FINAL_REVIEW_PACKET.zip:", os.path.getsize(OUT) // 1024, "KB /",
          len(hashes) + 1, "files /", len(shots), "captures")


if __name__ == "__main__":
    main()
