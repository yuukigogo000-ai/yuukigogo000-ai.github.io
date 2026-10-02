"""Pachislot iOS structural and bundle verification.

This checker never claims Xcode/device/TestFlight success unless a built app/IPA is
explicitly supplied. It verifies the synced runtime against build-manifest.json.
"""
from __future__ import annotations
from pathlib import Path
import argparse, hashlib, json, plistlib, re, struct, sys, zipfile

ROOT=Path(__file__).resolve().parents[3]
MOBILE=ROOT/"pachinko"/"mobile"
APP=MOBILE/"ios/App/App"
RESULTS=[]

def check(name, condition):
    RESULTS.append({"name":name,"pass":bool(condition)})
    if not condition: raise ValueError(name)

def text(path): return path.read_text(encoding="utf-8-sig")
def digest(data): return hashlib.sha256(data).hexdigest()

def runtime(read,names,label):
    manifest=json.loads(text(MOBILE/"www/build-manifest.json"))["files"]
    expected={"public/"+name for name in manifest}|{"public/build-manifest.json"}
    shims={n for n in names if n in ("public/cordova.js","public/cordova_plugins.js")}
    check(label+" generated Cordova shims empty",all(read(n)==b"" for n in shims))
    expected|=shims
    check(label+" runtime allowlist",{n for n in names if n.startswith("public/")}==expected)
    check(label+" runtime hashes",all(
        len(read("public/"+n))==v["bytes"] and digest(read("public/"+n))==v["sha256"]
        for n,v in manifest.items()
    ))
    check(label+" build manifest matches",json.loads(read("public/build-manifest.json"))["files"]==manifest)
    check(label+" service worker excluded","public/sw.js" not in names)
    check(label+" no secret-bearing files",not any(
        n.lower().endswith((".storekit",".p8",".jks",".p12",".pem",".key")) for n in names
    ))

def run(args):
    project=text(MOBILE/"ios/App/App.xcodeproj/project.pbxproj")
    bundle="com.yuukigogo000.pachiteikoku"
    check("stable iOS bundle id",project.count("PRODUCT_BUNDLE_IDENTIFIER = "+bundle+";")==2)
    versions=set(re.findall(r"MARKETING_VERSION = ([^;]+);",project))
    builds=set(re.findall(r"CURRENT_PROJECT_VERSION = ([^;]+);",project))
    check("one consistent iOS version/build",len(versions)==len(builds)==1)
    version=next(iter(versions)).strip('"'); build=next(iter(builds)).strip('"')
    check("numeric iOS build number",build.isdigit() and int(build)>=1)
    info=plistlib.loads((APP/"Info.plist").read_bytes())
    check("display name",info["CFBundleDisplayName"]=="パチンコ店経営")
    check("version keys use build settings",info["CFBundleShortVersionString"]=="$(MARKETING_VERSION)" and info["CFBundleVersion"]=="$(CURRENT_PROJECT_VERSION)")
    check("non-exempt encryption declaration false",info.get("ITSAppUsesNonExemptEncryption") is False)
    config=json.loads(text(MOBILE/"capacitor.config.json"))
    check("Capacitor app id matches iOS bundle",config["appId"]==bundle)
    check("Capacitor app name matches",config["appName"]=="パチンコ店経営")
    check("no cleartext server",config.get("server",{}).get("cleartext") is False)
    package=json.loads(text(MOBILE/"package-lock.json"))
    cap=package["packages"]["node_modules/@capacitor/ios"]["version"]
    spm=text(MOBILE/"ios/App/CapApp-SPM/Package.swift")
    check("SPM and npm Capacitor iOS versions agree",'exact: "'+cap+'"' in spm)
    for rel in re.findall(r'path: "([^"]+)"',spm):
        check("SPM local dependency "+rel,(MOBILE/"ios/App/CapApp-SPM"/rel/"Package.swift").is_file())
    icon=(APP/"Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png").read_bytes()
    check("opaque 1024px app icon",icon[:8]==b"\x89PNG\r\n\x1a\n" and struct.unpack(">II",icon[16:24])==(1024,1024) and icon[25]==2 and b"tRNS" not in icon)
    if args.synced:
        names=[p.relative_to(APP).as_posix() for p in (APP/"public").rglob("*") if p.is_file()]
        runtime(lambda n:(APP/n).read_bytes(),names,"iOS synced")
    if args.app:
        app=Path(args.app)
        names=[p.relative_to(app).as_posix() for p in app.rglob("*") if p.is_file()]
        built=plistlib.loads((app/"Info.plist").read_bytes())
        check("built identity/version",built["CFBundleIdentifier"]==bundle and built["CFBundleShortVersionString"]==version and built["CFBundleVersion"]==build)
        check("built native executable",built["CFBundleExecutable"] in names)
        runtime(lambda n:(app/n).read_bytes(),names,"compiled bundle")
    if args.ipa:
        with zipfile.ZipFile(args.ipa) as z:
            roots=[n[:-len("Info.plist")] for n in z.namelist() if re.fullmatch(r"Payload/[^/]+\.app/Info.plist",n)]
            check("exactly one IPA app",len(roots)==1)
            prefix=roots[0]
            names=[n[len(prefix):] for n in z.namelist() if n.startswith(prefix) and not n.endswith("/")]
            built=plistlib.loads(z.read(prefix+"Info.plist"))
            check("IPA identity/version",built["CFBundleIdentifier"]==bundle and built["CFBundleShortVersionString"]==version and built["CFBundleVersion"]==build)
            runtime(lambda n:z.read(prefix+n),names,"IPA bundle")
            check("IPA signed/provisioned","embedded.mobileprovision" in names and "_CodeSignature/CodeResources" in names)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--synced",action="store_true")
    group=parser.add_mutually_exclusive_group()
    group.add_argument("--app"); group.add_argument("--ipa")
    parser.add_argument("--report")
    args=parser.parse_args()
    error=None
    try: run(args)
    except Exception as exc: error=str(exc)
    report={
        "scope":"static/source plus supplied bundle" if args.app or args.ipa else "static source and optional synced assets",
        "xcode_executed_by_this_check":False,
        "real_device_verified":False,
        "testflight_uploaded":False,
        "ok":error is None,
        "checks":RESULTS,
        "error":error,
    }
    rendered=json.dumps(report,ensure_ascii=True,indent=2)
    if args.report:
        p=Path(args.report); p.parent.mkdir(parents=True,exist_ok=True); p.write_text(rendered+"\n",encoding="utf-8")
    print(rendered)
    sys.exit(0 if report["ok"] else 1)
