"""Verify a signed, internal-TestFlight-only IPA on macOS without uploading."""
from pathlib import Path
import argparse, datetime, hashlib, json, plistlib, subprocess, tempfile, zipfile

MOBILE = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("ipa", type=Path)
args = parser.parse_args()
ipa = args.ipa.resolve()
subprocess.run(["python3", str(MOBILE / "scripts/verify-ios.py"), "--ipa", str(ipa),
                "--report", str(MOBILE / ".evidence/ios-ipa-runtime.json")], check=True)
with tempfile.TemporaryDirectory(prefix="pachinko-ipa-") as temp:
    with zipfile.ZipFile(ipa) as archive:
        for member in archive.infolist():
            target = (Path(temp) / member.filename).resolve()
            if not target.is_relative_to(Path(temp).resolve()):
                raise ValueError("Unsafe IPA path")
        archive.extractall(temp)
    apps = list((Path(temp) / "Payload").glob("*.app"))
    assert len(apps) == 1
    app = apps[0]
    info = plistlib.loads((app / "Info.plist").read_bytes())
    assert info["CFBundleIdentifier"] == "com.yuukigogo000.pachiteikoku"
    assert info["CFBundleDisplayName"] == "パチンコ店経営"
    assert info["ITSAppUsesNonExemptEncryption"] is False
    assert (app / "public/THIRD-PARTY-NOTICES.md").read_bytes() == (MOBILE / "THIRD-PARTY-NOTICES.md").read_bytes()
    subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True, capture_output=True)
    profile = plistlib.loads(subprocess.check_output(["security", "cms", "-D", "-i", str(app / "embedded.mobileprovision")]))
    ent = profile["Entitlements"]
    assert ent["application-identifier"] == "44YHRHUC25.com.yuukigogo000.pachiteikoku"
    assert ent["com.apple.developer.team-identifier"] == "44YHRHUC25"
    assert ent.get("get-task-allow") is not True
    assert not profile.get("ProvisionedDevices") and not profile.get("ProvisionsAllDevices")
    assert profile["ExpirationDate"] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    actual = plistlib.loads(subprocess.check_output(["codesign", "-d", "--entitlements", ":-", str(app)], stderr=subprocess.DEVNULL))
    assert actual["application-identifier"] == ent["application-identifier"]
    assert actual.get("get-task-allow") is not True
    options = plistlib.loads((Path.home() / "export_options.plist").read_bytes())
    assert options.get("testFlightInternalTestingOnly") is True
    report = {"ok": True, "bundle_id": info["CFBundleIdentifier"], "version": info["CFBundleShortVersionString"],
              "build": info["CFBundleVersion"], "ipa_sha256": hashlib.sha256(ipa.read_bytes()).hexdigest(),
              "ipa_bytes": ipa.stat().st_size, "signature_verified": True, "internal_testflight_only": True,
              "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=MOBILE, text=True).strip(),
              "profile_name": profile["Name"], "profile_expiration": profile["ExpirationDate"].isoformat(),
              "real_device_verified": False, "testflight_uploaded": False, "public_release": False}
    (MOBILE / ".evidence/ios-signed-candidate.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))
