# -*- coding: utf-8 -*-
"""DESIGN_RETURN_BINDING.json(依頼側)を生成する。
同梱ファイルの sha256 を焼き込み、返却時に改変の有無を照合できるようにする。"""
import hashlib, io, json, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRIDGE = os.path.join(ROOT, "bridge")
FILES = [
    "PRODUCT_TRUTH.json", "FUNCTION_FREEZE.json", "SCREEN_STATE_INVENTORY.json",
    "REQUIRED_COPY.json", "TECHNICAL_CONSTRAINTS.json", "TRUST_AND_SAFETY_FACTS.json",
    "BLIND_DESIGN_BRIEF.md", "FUNCTION_PRESENCE_CONTRACT.json",
    "DESIGN_RETURN_SCHEMA.json", "CHATGPT_INSTRUCTIONS.md",
]


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(65536), b""):
            h.update(c)
    return h.hexdigest()


hashes = {n: sha256(os.path.join(BRIDGE, n)) for n in FILES}
req_id = "HONMONO-UI-REDESIGN-v4-" + hashlib.sha256(
    "".join(hashes[n] for n in FILES).encode()).hexdigest()[:12]

binding = {
    "schema": "DESIGN_RETURN_BINDING/1.0 (request side)",
    "request_id": req_id,
    "product": "HONMONO",
    "pipeline": "UI_REDESIGN_PIPELINE_v4.0",
    "phase": "PHASE 4 — CHATGPT DESIGN REQUEST",
    "created_at": datetime.date.today().isoformat(),
    "requested_by": "Claude Code (implementer / NOT design authority)",
    "design_authority": "ChatGPT",
    "expects_return_schema": "DESIGN_RETURN_SCHEMA.json",
    "file_hashes": hashes,
    "hash_algorithm": "sha256",
    "contains_current_visual_assets": False,
    "product_asset_fixed": [],
    "notes": [
        "現行UIのスクリーンショット・CSS・レイアウトは意図的に同梱していない(Phase 2 VISUAL SANITIZATION)",
        "製品identityとして固定のビジュアルアセットは存在しない。固定なのは製品名の表記 HONMONO のみ",
        "返却時は DESIGN_RETURN_BINDING.json の responds_to_request_id にこの request_id を、"
        "function_freeze_hash に上記 FUNCTION_FREEZE.json のハッシュを入れること",
    ],
}
p = os.path.join(BRIDGE, "DESIGN_RETURN_BINDING.json")
with io.open(p, "w", encoding="utf-8", newline="\n") as f:
    json.dump(binding, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("request_id:", req_id)
