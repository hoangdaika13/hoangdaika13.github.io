"""Export an already-built, independently QA-approved Astra H-08 release.

Run only after the full build has produced the final scene in Blender:
  blender --background ASTRA_H08.blend --python character_generator/export_release.py

The script deliberately fails closed while the visual gate is pending. It does
not open/import an external model and never manufactures placeholder geometry.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from export.common import (  # noqa: E402
    BLEND_PATH,
    FBX_PATH,
    GLB_PATH,
    MANIFEST_PATH,
    PENDING_REPORT_PATH,
    REPORT_PATH,
    ReleaseGateError,
    begin_release,
    write_report,
)
from export.export_fbx import export_fbx  # noqa: E402
from export.export_gltf import export_glb  # noqa: E402


def log(message: str) -> None:
    try:
        print(f"[ASTRA_EXPORT] {message}", flush=True)
    except (BrokenPipeError, OSError, ValueError):
        pass


def main() -> None:
    log("[01/06] Reading the independent visual release gate")
    review, inventory, validation = begin_release()
    log("[02/06] Saving the editable release .blend")
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
    log("[03/06] Exporting local website GLB with armature, actions and morphs")
    export_glb(GLB_PATH)
    log("[04/06] Exporting FBX interchange copy")
    export_fbx(FBX_PATH)
    log("[05/06] Writing hashes, scene inventory and release manifest")
    report = write_report(
        review,
        inventory,
        validation,
        {"blend": BLEND_PATH, "glb": GLB_PATH, "fbx": FBX_PATH},
    )
    log("[06/06] CHARACTER BUILD COMPLETE")
    log(json.dumps({
        "Triangles": report["scene"]["triangles"],
        "Vertices": report["scene"]["vertices"],
        "Objects": report["scene"]["objects"],
        "Bones": report["scene"]["bones"],
        "Shape Keys": report["scene"]["shapeKeyCount"],
        "Materials": report["scene"]["materialCount"],
        "Animation Actions": report["scene"]["actionCount"],
        "Output File": str(GLB_PATH),
        "Report": str(REPORT_PATH),
        "Manifest": str(MANIFEST_PATH),
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except ReleaseGateError as exc:
        log(f"BLOCKED: {exc} Pending report: {PENDING_REPORT_PATH}")
        raise SystemExit(2) from exc
    except Exception as exc:
        # A failed Blender operator or post-export check must never leave an
        # apparently publishable partial release behind.
        from export.common import write_pending_report

        for path in (GLB_PATH, FBX_PATH, MANIFEST_PATH):
            path.unlink(missing_ok=True)
        write_pending_report(f"Release export failed: {exc}")
        log(f"FAILED: {exc} Partial release outputs were removed.")
        raise SystemExit(1) from exc
