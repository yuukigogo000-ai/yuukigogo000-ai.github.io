"""Package the owner-selected neon-hall artwork into existing app assets.
Requires Pillow; no image generation or network access. Run from any directory.
"""
from pathlib import Path
from io import BytesIO
import argparse, hashlib, json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
MOBILE = ROOT / "pachinko/mobile"
SOURCE = MOBILE / "assets/icon-neon-source.png"
SOURCE_SHA = "a7763cb01e2f09adb955e35f596b3e1d411aeb1b0e5b63d0aba578a93735afb8"
BACKGROUND = (4, 5, 10)
RESAMPLE = Image.Resampling.LANCZOS

def digest(data):
    return hashlib.sha256(data).hexdigest()

def assets(source):
    for size in (192, 512):
        yield ROOT / f"pachinko/icon-{size}.png", source.resize((size, size), RESAMPLE)
    yield MOBILE / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", source.resize((1024, 1024), RESAMPLE)
    resources = MOBILE / "android/app/src/main/res"
    for density, size, foreground_size in [
        ("mdpi",48,108), ("hdpi",72,162), ("xhdpi",96,216),
        ("xxhdpi",144,324), ("xxxhdpi",192,432)
    ]:
        folder = resources / ("mipmap-" + density)
        icon = source.resize((size, size), RESAMPLE)
        yield folder / "ic_launcher.png", icon
        # The OS clips adaptive icons. Keep the complete artwork in its central
        # 72/108 viewport instead of enlarging/cropping the silver ball.
        foreground = Image.new("RGB", (foreground_size, foreground_size), BACKGROUND)
        inner = foreground_size * 2 // 3
        inset = (foreground_size - inner) // 2
        foreground.paste(source.resize((inner, inner), RESAMPLE), (inset, inset))
        yield folder / "ic_launcher_foreground.png", foreground
        mask = Image.new("L", (size * 4, size * 4))
        ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        rounded = icon.convert("RGBA")
        rounded.putalpha(mask.resize((size, size), RESAMPLE))
        yield folder / "ic_launcher_round.png", rounded
    # Replace the old crown mark on existing splash canvases, keeping all sizes.
    splash_files = sorted(resources.glob("drawable*/splash.png"))
    splash_files += sorted((MOBILE / "ios/App/App/Assets.xcassets/Splash.imageset").glob("*.png"))
    for path in splash_files:
        with Image.open(path) as current:
            width, height = current.size
        canvas = Image.new("RGB", (width, height), BACKGROUND)
        size = round(min(width, height) * 0.42)
        canvas.paste(source.resize((size, size), RESAMPLE), ((width-size)//2, (height-size)//2))
        yield path, canvas

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Check packaged pixels without changing files")
    args = parser.parse_args()
    raw = SOURCE.read_bytes()
    assert digest(raw) == SOURCE_SHA, "Selected source artwork changed"
    with Image.open(BytesIO(raw)) as image:
        source = image.convert("RGB")
    assert source.width == source.height
    records = []
    for path, rendered in assets(source):
        if args.check:
            with Image.open(path) as actual:
                assert actual.size == rendered.size and actual.mode == rendered.mode, str(path)
                assert actual.tobytes() == rendered.tobytes(), str(path)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            rendered.save(path, "PNG", optimize=True)
        records.append({"path":path.relative_to(ROOT).as_posix(), "size":list(rendered.size),
                        "mode":rendered.mode, "sha256":digest(path.read_bytes())})
    report = {"source":SOURCE.relative_to(ROOT).as_posix(), "source_sha256":SOURCE_SHA,
              "selection":"Owner selected concept 8, neon hall, 2026-10-04",
              "artwork_changed":False, "outputs":records}
    manifest = MOBILE / "assets/icon-neon-manifest.json"
    if args.check:
        assert json.loads(manifest.read_text(encoding="utf-8")) == report, "Manifest differs"
    else:
        manifest.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok":True,"checked":args.check,"outputs":len(records),"source_sha256":SOURCE_SHA}))

if __name__ == "__main__":
    main()
