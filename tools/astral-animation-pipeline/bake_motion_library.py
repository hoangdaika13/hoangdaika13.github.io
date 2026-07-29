"""Bake humanoid animation clips onto the HH VALID rig with Blender.

The script never downloads assets and never treats a missing clip as available.
It accepts authored GLB/FBX sources, transfers rest-space bone rotation, removes
unsafe root translation, and exports one animation-only GLB for the web runtime.
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def parse_args():
    raw = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--source", action="append", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--fps", type=int, default=30)
    return parser.parse_args(raw)


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.actions, bpy.data.armatures, bpy.data.meshes, bpy.data.materials):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def import_asset(path):
    path = Path(path).resolve()
    before = set(bpy.data.objects)
    suffix = path.suffix.lower()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path), automatic_bone_orientation=False)
    elif suffix == ".bvh":
        bpy.ops.import_anim.bvh(filepath=str(path), axis_forward="-Z", axis_up="Y")
    else:
        raise RuntimeError(f"Định dạng animation chưa hỗ trợ: {suffix}")
    return [obj for obj in bpy.data.objects if obj not in before]


def primary_armature(objects):
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    if not armatures:
        raise RuntimeError("Asset không có Armature")
    return max(armatures, key=lambda obj: len(obj.data.bones))


def normalize_bone(name):
    value = re.sub(r"^(mixamorig|armature)[_:.\-]*", "", str(name), flags=re.I)
    return re.sub(r"[^a-z0-9]", "", value.lower())


def canonical_bone(name):
    """Resolve common Mixamo, VALID and Rigify/Quaternius names to one key.

    Runtime never performs this translation. It exists only in Blender so every
    exported track targets the authored VALID skeleton by its final bone name.
    """
    raw = str(name).strip()
    lowered = raw.lower()
    lowered = re.sub(r"^(mixamorig|armature|def|org|mch)[_:.\-]*", "", lowered)
    side = ""
    if re.search(r"(?:^|[_.\-])l$", lowered) or "left" in lowered:
        side = "l"
    elif re.search(r"(?:^|[_.\-])r$", lowered) or "right" in lowered:
        side = "r"
    compact = re.sub(r"[^a-z0-9]", "", lowered)

    if compact in {"root", "rootbone"}:
        return "root"
    if "hips" in compact or "pelvis" in compact:
        return "hips"
    if compact in {"spine", "spine0", "spine001", "spine01"}:
        return "spine0"
    if compact in {"spine1", "spine002", "spine02"}:
        return "spine1"
    if compact in {"spine2", "spine003", "spine03", "chest", "upperchest"}:
        return "spine2"
    if compact == "neck" or compact.startswith("neck0"):
        return "neck"
    if compact == "head" or compact.startswith("head0"):
        return "head"

    sided_patterns = (
        (("shoulder", "clavicle"), "shoulder"),
        (("forearm", "lowerarm"), "forearm"),
        (("upperarm", "arm"), "upperarm"),
        (("hand",), "hand"),
        (("upleg", "thigh"), "thigh"),
        (("leg", "shin", "calf"), "shin"),
        (("foot",), "foot"),
        (("toebase", "toe", "ball"), "toe"),
    )
    if side:
        for aliases, key in sided_patterns:
            if any(alias in compact for alias in aliases):
                # Finger names also contain "hand"; let the specific matcher below win.
                if key == "hand" and any(finger in compact for finger in ("thumb", "index", "middle", "ring", "pinky")):
                    continue
                return f"{key}_{side}"

        finger_match = re.search(r"(?:f)?(thumb|index|middle|ring|pinky)(?:hand)?0*([1-4])", compact)
        if finger_match:
            return f"{finger_match.group(1)}{int(finger_match.group(2))}_{side}"

    return normalize_bone(name)


def action_name(value):
    value = re.sub(r"[^A-Za-z0-9]+", "_", str(value)).strip("_")
    return value or "Motion"


def bone_depth(pose_bone):
    depth = 0
    parent = pose_bone.parent
    while parent:
        depth += 1
        parent = parent.parent
    return depth


def source_actions(armature):
    actions = []
    animation = armature.animation_data
    if animation and animation.action:
        actions.append(animation.action)
    if animation:
        for track in animation.nla_tracks:
            for strip in track.strips:
                if strip.action and strip.action not in actions:
                    actions.append(strip.action)
    if not actions:
        actions = [action for action in bpy.data.actions if action.frame_range[1] > action.frame_range[0]]
    return actions


def resolve_plan_clip(plan, source_name):
    normalized = action_name(source_name).lower()
    for item in plan.get("clips", []):
        aliases = [item.get("id", ""), *item.get("aliases", [])]
        if normalized in {action_name(alias).lower() for alias in aliases}:
            return item
    return None


def set_action(armature, action):
    armature.animation_data_create()
    armature.animation_data.action = action


def clear_pose(armature):
    for bone in armature.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)


def height_between(armature, low="hips", high="head"):
    by_name = {canonical_bone(bone.name): bone for bone in armature.pose.bones}
    if low not in by_name or high not in by_name:
        return 1.0
    a = armature.matrix_world @ by_name[low].bone.matrix_local
    b = armature.matrix_world @ by_name[high].bone.matrix_local
    return max(0.001, (b.translation - a.translation).length)


def rig_basis_rotation(by_name):
    hips = by_name.get("hips")
    head = by_name.get("head")
    left = by_name.get("leftarm") or by_name.get("leftshoulder")
    right = by_name.get("rightarm") or by_name.get("rightshoulder")
    if not all((hips, head, left, right)):
        return Matrix.Identity(3).to_quaternion()
    hips_position = hips.bone.matrix_local.translation
    up = (head.bone.matrix_local.translation - hips_position).normalized()
    side = (right.bone.matrix_local.translation - left.bone.matrix_local.translation).normalized()
    forward = side.cross(up).normalized()
    side = up.cross(forward).normalized()
    return Matrix((side, forward, up)).transposed().to_quaternion()


def bake_action(scene, source, target, source_action, target_name, fps):
    source_by_name = {}
    target_by_name = {}
    for bone in source.pose.bones:
        source_by_name.setdefault(canonical_bone(bone.name), bone)
    for bone in target.pose.bones:
        target_by_name.setdefault(canonical_bone(bone.name), bone)
    mapped = [(source_by_name[name], target_by_name[name]) for name in target_by_name if name in source_by_name]
    mapped.sort(key=lambda pair: bone_depth(pair[1]))
    if len(mapped) < 18:
        raise RuntimeError(f"{source_action.name}: chỉ ánh xạ được {len(mapped)} bone")

    set_action(source, source_action)
    clear_pose(target)
    source_basis = rig_basis_rotation(source_by_name)
    target_basis = rig_basis_rotation(target_by_name)
    rig_alignment = target_basis @ source_basis.inverted()
    baked = bpy.data.actions.new(name=target_name)
    set_action(target, baked)
    scene.render.fps = fps
    start = int(math.floor(source_action.frame_range[0]))
    end = int(math.ceil(source_action.frame_range[1]))

    for frame in range(start, end + 1):
        scene.frame_set(frame)
        for source_bone, target_bone in mapped:
            source_rest_rotation = source_bone.bone.matrix_local.to_quaternion()
            target_rest_rotation = target_bone.bone.matrix_local.to_quaternion()
            source_pose_rotation = source_bone.matrix.to_quaternion()
            delta_rotation = source_pose_rotation @ source_rest_rotation.inverted()
            aligned_delta = rig_alignment @ delta_rotation @ rig_alignment.inverted()
            desired_rotation = aligned_delta @ target_rest_rotation
            current = target_bone.matrix.copy()
            desired = desired_rotation.to_matrix().to_4x4()
            desired.translation = current.translation
            target_bone.matrix = desired
            target_bone.rotation_mode = "QUATERNION"
            target_bone.keyframe_insert("rotation_quaternion", frame=frame, group=target_bone.name)

        # Intentionally do not key PoseBone.location. VALID source avatars use
        # a centimeter-scale joint rest hierarchy under a normalized mesh;
        # exporting a keyed Hips location can magnify a harmless bob into tens
        # of metres. Runtime owns vertical travel, pelvis weight transfer and
        # foot planting, while this in-place library carries rotations only.

    baked.use_fake_user = True
    target.animation_data.action = None
    track = target.animation_data.nla_tracks.new()
    track.name = target_name
    strip = track.strips.new(target_name, start, baked)
    strip.action_frame_start = start
    strip.action_frame_end = end
    return {
        "name": target_name,
        "source": source_action.name,
        "frames": end - start + 1,
        "duration": round((end - start) / max(1, fps), 4),
        "mappedBones": len(mapped),
    }


def export_animation_glb(target, output):
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    supported = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    options = {
        "filepath": str(Path(output).resolve()),
        "export_format": "GLB",
        "use_selection": True,
        "export_animations": True,
        "export_animation_mode": "ACTIONS",
        "export_force_sampling": False,
        "export_def_bones": True,
        "export_optimize_animation_size": True,
        "export_reset_pose_bones": False,
        "export_skins": True,
        "export_morph": False,
        "export_materials": "NONE",
    }
    bpy.ops.export_scene.gltf(**{key: value for key, value in options.items() if key in supported})


def main():
    args = parse_args()
    output = Path(args.output).resolve()
    manifest_path = Path(args.manifest).resolve()
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    clean_scene()

    target_objects = import_asset(args.target)
    target = primary_armature(target_objects)
    target.name = "HHMotionArmatureV13"
    for obj in target_objects:
        if obj != target:
            bpy.data.objects.remove(obj, do_unlink=True)

    baked_clips = []
    missing = []
    for source_path in args.source:
        imported = import_asset(source_path)
        source = primary_armature(imported)
        imported_actions = source_actions(source)
        for action in imported_actions:
            clip_plan = resolve_plan_clip(plan, action.name)
            if not clip_plan:
                continue
            clip_id = clip_plan["id"]
            if any(item["name"] == clip_id for item in baked_clips):
                continue
            baked = bake_action(bpy.context.scene, source, target, action, clip_id, args.fps)
            baked.update({
                "sourceAsset": Path(source_path).name,
                "category": clip_plan.get("category", ""),
                "loop": clip_plan.get("loop", True),
                "speed": clip_plan.get("speed", 0),
                "direction": clip_plan.get("direction", 0),
            })
            baked_clips.append(baked)
        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)
        for action in imported_actions:
            if action.name in bpy.data.actions:
                bpy.data.actions.remove(action)

    if not baked_clips:
        raise RuntimeError("Không tìm thấy clip hợp lệ để bake; không tạo output giả")

    export_animation_glb(target, output)
    available = {item["name"] for item in baked_clips}
    for item in plan.get("clips", []):
        if item["id"] not in available:
            missing.append(item["id"])
    manifest = {
        "version": 13,
        "status": "ready" if not missing else "partial",
        "rig": plan.get("rig"),
        "fps": args.fps,
        "inPlace": True,
        "asset": output.name,
        "clips": baked_clips,
        "missing": missing,
        "footMarkers": plan.get("footMarkers", {}),
        "provenance": plan.get("provenance", []),
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
