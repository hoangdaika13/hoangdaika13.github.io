"""Prepare a licensed Sketchfab humanoid GLB for the Astral web runtime.

The operation is intentionally offline.  It cleans exporter-generated bone
suffixes, keeps skin weights bound to the renamed bones, normalizes the native
walk clip name, records attribution inside the GLB, and exports a deterministic
web-ready file.  No runtime retargeting is performed by the browser.
"""

import argparse
import json
import re
import sys
from pathlib import Path

import bpy


def parse_args():
    raw = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--model-id", default="sketchfab-miss-galaxy")
    parser.add_argument("--title", default="Miss Galaxy")
    parser.add_argument("--author", default="Loves_Art")
    parser.add_argument("--source-page", required=True)
    parser.add_argument("--license", default="CC-BY-4.0")
    return parser.parse_args(raw)


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.actions, bpy.data.armatures, bpy.data.meshes):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def clean_bone_name(name):
    value = re.sub(r"_\d+$", "", str(name))
    value = re.sub(r"^mixamorig\d+:", "mixamorig:", value, flags=re.I)
    if value == "_rootJoint" or value.lower().endswith("_rootjoint"):
        return "Root"
    return value


def rename_bones(armature, meshes):
    rename_map = {}
    occupied = {bone.name for bone in armature.data.bones}
    for bone in armature.data.bones:
        old_name = bone.name
        new_name = clean_bone_name(old_name)
        if new_name == old_name:
            continue
        if new_name in occupied and new_name not in rename_map:
            raise RuntimeError(f"Bone rename collision: {old_name} -> {new_name}")
        rename_map[old_name] = new_name

    for old_name, new_name in rename_map.items():
        bone = armature.data.bones.get(old_name)
        if bone:
            bone.name = new_name

    # Blender follows Bone.name changes for the usual Armature modifier. The
    # explicit fallback below only handles exporters that left a detached group
    # name, avoiding duplicate target groups and rename-collision warnings.
    for mesh in meshes:
        for old_name, new_name in rename_map.items():
            old_group = mesh.vertex_groups.get(old_name)
            new_group = mesh.vertex_groups.get(new_name)
            if old_group and not new_group:
                old_group.name = new_name

    return rename_map


def normalize_actions():
    canonical = {
        "walking": "walk_f",
        "walk": "walk_f",
        "walk_loop": "walk_f",
        "offensiveidle": "idle_alert",
        "warrioridle": "idle_relaxed",
        "facialexpressions": "face_performance",
        "idle": "idle_relaxed",
        "jump": "jump_start",
    }
    actions = []
    for action in bpy.data.actions:
        original = action.name
        normalized = re.sub(r"[^a-z0-9]", "", original.lower())
        if normalized in canonical:
            action.name = canonical[normalized]
        action.use_fake_user = True
        actions.append({
            "sourceName": original,
            "name": action.name,
            "frameStart": float(action.frame_range[0]),
            "frameEnd": float(action.frame_range[1]),
        })
    return actions


def export_glb(output):
    bpy.ops.object.select_all(action="SELECT")
    supported = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    options = {
        "filepath": str(output),
        "export_format": "GLB",
        "use_selection": True,
        "export_animations": True,
        "export_animation_mode": "ACTIONS",
        "export_force_sampling": False,
        "export_def_bones": True,
        "export_optimize_animation_size": True,
        "export_reset_pose_bones": False,
        "export_skins": True,
        "export_morph": True,
        "export_materials": "EXPORT",
        "export_image_format": "AUTO",
        "export_yup": True,
    }
    bpy.ops.export_scene.gltf(**{key: value for key, value in options.items() if key in supported})


def main():
    args = parse_args()
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    if not source.is_file():
        raise RuntimeError(f"Missing input GLB: {source}")
    output.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    clean_scene()
    bpy.ops.import_scene.gltf(filepath=str(source))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(armatures) != 1 or not meshes:
        raise RuntimeError(f"Expected one armature and at least one mesh; got {len(armatures)} armatures/{len(meshes)} meshes")

    armature = armatures[0]
    armature.name = "HHCharacterArmature"
    armature.data.name = "HHCharacterSkeleton"
    rename_map = rename_bones(armature, meshes)
    actions = normalize_actions()

    attribution = {
        "modelId": args.model_id,
        "author": args.author,
        "sourcePage": args.source_page,
        "license": args.license,
        "attribution": f"{args.title} by {args.author}, licensed under {args.license}",
    }
    for key, value in attribution.items():
        armature[f"hh_{key}"] = value

    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = max(1, int(max((action["frameEnd"] for action in actions), default=30)))
    export_glb(output)

    triangles = sum(sum(max(0, len(poly.vertices) - 2) for poly in mesh.data.polygons) for mesh in meshes)
    report = {
        **attribution,
        "input": str(source),
        "output": str(output),
        "renamedBones": len(rename_map),
        "bones": len(armature.data.bones),
        "boneNames": [bone.name for bone in armature.data.bones],
        "meshes": len(meshes),
        "triangles": triangles,
        "actions": actions,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
