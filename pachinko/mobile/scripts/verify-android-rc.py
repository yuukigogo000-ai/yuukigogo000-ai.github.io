from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path


WORKTREE = Path(__file__).resolve().parents[3]
MOBILE = WORKTREE / "pachinko" / "mobile"
WWW = MOBILE / "www"
ANDROID = MOBILE / "android"
EVIDENCE = MOBILE / ".evidence"
SDK = WORKTREE.parent / "_tools" / "android-sdk"
JAVA = WORKTREE.parent / "_tools" / "jdk-21.0.12.1+1"
ARTIFACTS = {
    "debug_apk": (ANDROID / "app/build/outputs/apk/debug/app-debug.apk", "assets/public/"),
    "release_apk_unsigned": (ANDROID / "app/build/outputs/apk/release/app-release-unsigned.apk", "assets/public/"),
    "release_aab_unsigned": (ANDROID / "app/build/outputs/bundle/release/app-release.aab", "base/assets/public/"),
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git(*args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(WORKTREE), *args], check=True, capture_output=True,
        text=True, encoding="utf-8",
    ).stdout.strip()


def verify_tree(root: Path, manifest: dict[str, dict]) -> None:
    actual = sorted(
        item.relative_to(root).as_posix() for item in root.rglob("*")
        if item.is_file() and item.name != "build-manifest.json"
    )
    if actual != sorted(manifest):
        raise AssertionError("runtime file list differs from build manifest")
    for name in actual:
        data = (root / name).read_bytes()
        if len(data) != manifest[name]["bytes"] or sha256(data) != manifest[name]["sha256"]:
            raise AssertionError(f"runtime bytes/hash differs: {name}")


def apksigner_verify(path: Path) -> dict:
    result = subprocess.run(
        [str(SDK / "build-tools/36.0.0/apksigner.bat"), "verify", "--verbose", str(path)],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        env={**os.environ, "JAVA_HOME": str(JAVA)},
    )
    return {"verified": result.returncode == 0, "exit_code": result.returncode,
            "output": (result.stdout + result.stderr).strip()}


manifest_bytes = (WWW / "build-manifest.json").read_bytes()
manifest = json.loads(manifest_bytes)["files"]
verify_tree(WWW, manifest)

source_art_root = WORKTREE / "pachinko" / "art"
source_art = {
    "art/" + item.relative_to(source_art_root).as_posix(): {
        "bytes": len(data := item.read_bytes()),
        "sha256": sha256(data),
    }
    for item in source_art_root.rglob("*")
    if item.is_file()
}
manifest_art = {name: manifest[name] for name in manifest if name.startswith("art/")}
assert manifest_art == source_art, "runtime art differs from current source art"
art_files = len(source_art)
art_bytes = sum(item["bytes"] for item in source_art.values())

assert "sw.js" not in manifest
assert "試打" not in (WWW / "manifest.webmanifest").read_text(encoding="utf-8")
native_entry = (WWW / "native-entry.js").read_text(encoding="utf-8")
assert "from \"@capacitor/app\"" not in native_entry
assert "minimizeApp" in native_entry

mutation_detection = {}
with tempfile.TemporaryDirectory() as tmp:
    probe = Path(tmp) / "www"
    shutil.copytree(WWW, probe)
    (probe / "icon-192.png").write_bytes((probe / "icon-192.png").read_bytes() + b"x")
    try:
        verify_tree(probe, manifest)
    except AssertionError as error:
        reason = str(error)
        assert reason == "runtime bytes/hash differs: icon-192.png"
        mutation_detection["modified_file"] = reason
    else:
        raise AssertionError("modified-file mutation was not detected")
with tempfile.TemporaryDirectory() as tmp:
    probe = Path(tmp) / "www"
    shutil.copytree(WWW, probe)
    (probe / "icon-512.png").unlink()
    try:
        verify_tree(probe, manifest)
    except AssertionError as error:
        reason = str(error)
        assert reason == "runtime file list differs from build manifest"
        mutation_detection["missing_file"] = reason
    else:
        raise AssertionError("missing-file mutation was not detected")

report = {
    "schema": 1,
    "verified_at": datetime.now(timezone.utc).isoformat(),
    "source": {
        "head": git("rev-parse", "HEAD"),
        "branch": git("branch", "--show-current"),
        "status_short": git("status", "--short"),
        "www_manifest_sha256": sha256(manifest_bytes),
        "runtime_files": len(manifest),
        "art_files": art_files,
        "art_bytes": art_bytes,
    },
    "mutation_detection": mutation_detection,
    "artifacts": {},
}

for label, (artifact, prefix) in ARTIFACTS.items():
    assert artifact.is_file(), f"missing artifact: {artifact}"
    artifact_bytes = artifact.read_bytes()
    with zipfile.ZipFile(artifact) as archive:
        assert archive.testzip() is None, f"corrupt archive: {label}"
        names = set(archive.namelist())
        assert archive.read(prefix + "build-manifest.json") == manifest_bytes
        for name, expected in manifest.items():
            data = archive.read(prefix + name)
            assert len(data) == expected["bytes"], f"{label} byte count: {name}"
            assert sha256(data) == expected["sha256"], f"{label} hash: {name}"
        assert prefix + "sw.js" not in names
        cert_entries = sorted(name for name in names if name.upper().startswith("META-INF/")
                              and name.upper().endswith((".RSA", ".DSA", ".EC")))
    item = {
        "path": str(artifact), "bytes": len(artifact_bytes), "sha256": sha256(artifact_bytes),
        "runtime_files_checked": len(manifest), "runtime_bytes_and_hashes_match": True,
        "jar_certificate_entries": cert_entries,
    }
    if artifact.suffix == ".apk":
        item["apk_signature"] = apksigner_verify(artifact)
    else:
        item["unsigned_confirmed"] = not cert_entries
    report["artifacts"][label] = item

assert report["artifacts"]["debug_apk"]["apk_signature"]["verified"]
assert not report["artifacts"]["release_apk_unsigned"]["apk_signature"]["verified"]
assert report["artifacts"]["release_aab_unsigned"]["unsigned_confirmed"]
EVIDENCE.mkdir(parents=True, exist_ok=True)
output = EVIDENCE / "android-rc-verification.json"
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "ok": True,
    "runtime_files_checked_per_artifact": len(manifest),
    "artifacts": {label: {"bytes": item["bytes"], "sha256": item["sha256"]}
                  for label, item in report["artifacts"].items()},
    "mutation_detection": sorted(mutation_detection),
    "evidence": str(output),
}, ensure_ascii=False))
