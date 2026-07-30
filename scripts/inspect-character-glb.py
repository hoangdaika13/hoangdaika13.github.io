"""Inspect a downloaded character GLB with Blender without changing the asset."""

import json
import sys
from pathlib import Path

import bpy


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if not args:
        raise RuntimeError("Usage: blender --background --python inspect-character-glb.py -- character.glb report.json")
    source = Path(args[0]).resolve()
    report_path = Path(args[1]).resolve() if len(args) > 1 else source.with_suffix(".qa.json")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    triangles = 0
    vertices = 0
    shape_keys = []
    materials = set()
    for obj in meshes:
        vertices += len(obj.data.vertices)
        triangles += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
        materials.update(slot.material.name for slot in obj.material_slots if slot.material)
        if obj.data.shape_keys:
            shape_keys.extend(key.name for key in obj.data.shape_keys.key_blocks if key.name != "Basis")

    actions = []
    for action in bpy.data.actions:
        actions.append({
            "name": action.name,
            "frameStart": float(action.frame_range[0]),
            "frameEnd": float(action.frame_range[1]),
            "slots": len(getattr(action, "slots", [])),
        })

    dimensions = [0.0, 0.0, 0.0]
    if meshes:
        xs, ys, zs = [], [], []
        for obj in meshes:
            for corner in obj.bound_box:
                world = obj.matrix_world @ __import__("mathutils").Vector(corner)
                xs.append(world.x)
                ys.append(world.y)
                zs.append(world.z)
        dimensions = [max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)]

    report = {
        "source": str(source),
        "bytes": source.stat().st_size,
        "meshes": len(meshes),
        "vertices": vertices,
        "triangles": triangles,
        "armatures": [
            {
                "name": armature.name,
                "bones": len(armature.data.bones),
                "boneNames": [bone.name for bone in armature.data.bones],
            }
            for armature in armatures
        ],
        "actions": actions,
        "shapeKeys": sorted(set(shape_keys)),
        "materials": sorted(materials),
        "images": [
            {"name": image.name, "width": int(image.size[0]), "height": int(image.size[1])}
            for image in bpy.data.images
            if image.size[0] and image.size[1]
        ],
        "dimensions": dimensions,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
