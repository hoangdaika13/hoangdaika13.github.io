"""Read-only material/visibility inspection of the current Astra release blend."""

from pathlib import Path
import json
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BLEND = ROOT / "assets" / "character-3d" / "astra-h08" / "output" / "ASTRA_H08.blend"
OUT = ROOT / "assets" / "character-3d" / "astra-h08" / "qa" / "agent-head-hair"

bpy.ops.wm.open_mainfile(filepath=str(BLEND))
OUT.mkdir(parents=True, exist_ok=True)

def bounds(obj):
    pts = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    return {
        "min": [round(min(p[i] for p in pts), 5) for i in range(3)],
        "max": [round(max(p[i] for p in pts), 5) for i in range(3)],
    }

items = []
for obj in bpy.context.scene.objects:
    if obj.type not in {"MESH", "CURVE"}:
        continue
    if obj.name.startswith(("BODY", "HEAD", "BODYSUIT", "HAIR", "EYE", "IRIS", "PUPIL", "MOUTH")):
        items.append({
            "name": obj.name,
            "type": obj.type,
            "hidden": bool(obj.hide_render),
            "bounds": bounds(obj),
            "materials": [mat.name if mat else None for mat in obj.data.materials],
            "polygonMaterialCounts": {
                str(index): sum(1 for poly in obj.data.polygons if poly.material_index == index)
                for index in range(len(obj.data.materials))
            } if obj.type == "MESH" else {},
            "modifiers": [modifier.type for modifier in obj.modifiers],
        })

(OUT / "scene-inspection.json").write_text(json.dumps(items, indent=2), encoding="utf-8")
print(json.dumps(items, indent=2))
