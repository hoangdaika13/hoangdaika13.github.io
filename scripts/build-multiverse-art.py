"""Package approved built-in ImageGen outputs; no content retouching or generation.

Usage: python scripts/build-multiverse-art.py .study-local/multiverse-art-input.json
The input with absolute source paths stays ignored. Only WebP assets, hashes and
the generation prompt set are published. Originals stay at their tool location.
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "multiverse"


def main():
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    DEST.mkdir(parents=True, exist_ok=True)
    manifest_path = DEST / "artwork-manifest-v1.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"items": []}
    previous = {row["id"]: row for row in old["items"]}
    output = []
    for item in data["items"]:
        asset_id = item["id"]
        if not asset_id or any(c not in "abcdefghijklmnopqrstuvwxyz-0123456789" for c in asset_id):
            raise ValueError("Invalid asset ID")
        source = Path(item["source"])
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        known = previous.get(asset_id)
        if known and known["sourceSha256"] != digest:
            raise ValueError(f"Use a new versioned name instead of replacing {asset_id}")
        with Image.open(source) as raw:
            art = ImageOps.exif_transpose(raw).convert("RGB")
            portrait = asset_id.startswith("portrait-")
            widths = [160, 400, 960] if portrait else [320, 640, 1280]
            if asset_id == "hero":
                widths.append(1600)
            variants = []
            for width in widths:
                width = min(width, art.width)
                height = round(art.height * width / art.width)
                name = f"{asset_id}-v1-{width}.webp"
                target = DEST / name
                if not target.exists():
                    scaled = art.resize((width, height), Image.Resampling.LANCZOS)
                    scaled.save(target, format="WEBP", quality=78 if width < 1000 else 81, method=6)
                variants.append({"file": name, "width": width, "height": height, "bytes": target.stat().st_size})
        output.append({"id": asset_id, "kind": "portrait" if portrait else "landscape", "sourceSha256": digest,
                       "generation": "built-in image_gen", "prompt": item["prompt"], "variants": variants})
    manifest = {"version": 1, "created": "2026-11-02", "purpose": "Original fictional concept illustrations for HH Multiverse; not simulated world-state evidence.", "items": output}
    manifest_path.write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(json.dumps({"artworks": len(output), "files": sum(len(x["variants"]) for x in output),
                      "bytes": sum(v["bytes"] for x in output for v in x["variants"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
