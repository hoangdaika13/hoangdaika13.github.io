"""Isolated deformation/animation QA for the generated Astra H-08 scene.

This candidate never imports or downloads geometry.  It opens the locally built
project, applies procedural weights through the public rigging helpers, rebuilds
selected 60 FPS actions, checks mesh coherence, and can render compact proof
frames without changing the release blend.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = ROOT.parent
ASSET_ROOT = REPOSITORY_ROOT / "assets" / "character-3d" / "astra-h08"
SOURCE_BLEND = ASSET_ROOT / "output" / "ASTRA_H08.blend"
QA_ROOT = ASSET_ROOT / "qa" / "agent-rig-animation"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from animation import build_action_library, validate_actions  # noqa: E402
from rigging.weights import (  # noqa: E402
    apply_weight_profile,
    assign_rigid_bone,
    build_anatomical_weight_profile,
    copy_weight_profile,
)


_HEAD_FEATURE_PREFIXES = (
    "EYE_", "IRIS_", "PUPIL_", "EYELID_", "EYEBROW_", "MOUTH_",
)


def _object_center(obj: bpy.types.Object) -> Vector:
    if not obj.bound_box:
        return obj.matrix_world.translation.copy()
    return sum((obj.matrix_world @ Vector(corner) for corner in obj.bound_box), Vector()) / 8.0


def _rigid_bone_for(obj: bpy.types.Object) -> str:
    """Map authored L/R labels to anatomical coordinates safely.

    Armor source names are mirrored from the builder's construction side and do
    not consistently match the armature's anatomical L=+X convention.  World X
    is therefore authoritative; names only choose the limb region.
    """

    point = _object_center(obj)
    side = "L" if point.x >= 0.0 else "R"
    name = obj.name.upper()
    if any(token in name for token in ("BOOT", "SOLE", "INSTEP", "TOE", "ANKLE", "HEEL")):
        return f"foot_{side}"
    if any(token in name for token in ("SHIN", "KNEE")):
        return f"shin_{side}"
    if any(token in name for token in ("THIGH", "HIP")):
        return f"thigh_{side}"
    if any(token in name for token in ("HAND", "GLOVE")):
        return f"hand_{side}"
    if any(token in name for token in ("FOREARM", "ELBOW")):
        return f"forearm_{side}"
    if any(token in name for token in ("SHOULDER", "UPPER_ARM")):
        return f"upper_arm_{side}"
    if any(token in name for token in ("WAIST", "BELT", "UTILITY")):
        return "pelvis"
    return "chest"


def _bind_candidate(rig: bpy.types.Object) -> dict[str, object]:
    body = bpy.data.objects.get("BODY_CONTINUOUS")
    suit = bpy.data.objects.get("BODYSUIT")
    if body is None or suit is None:
        raise RuntimeError("BODY_CONTINUOUS and BODYSUIT are required")
    body_profile = build_anatomical_weight_profile(rig, body)
    body_report = apply_weight_profile(rig, body, body_profile)
    if len(body.data.vertices) == len(suit.data.vertices):
        suit_report = copy_weight_profile(rig, body, suit)
    else:
        suit_report = apply_weight_profile(
            rig, suit, build_anatomical_weight_profile(rig, suit)
        )

    rigid: dict[str, str] = {}
    skipped: list[str] = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj in {body, suit} or obj.name == "GROUND":
            continue
        if obj.name.startswith("HAIR_"):
            skipped.append(obj.name)
            continue
        if obj.name.startswith(_HEAD_FEATURE_PREFIXES):
            target = "head"
        elif obj.get("astra.release_role_witness"):
            skipped.append(obj.name)
            continue
        else:
            target = _rigid_bone_for(obj)
        assign_rigid_bone(rig, obj, target)
        rigid[obj.name] = target
    return {
        "body": body_report,
        "suit": suit_report,
        "rigid": rigid,
        "skipped": skipped,
    }


def _evaluated_bounds(obj: bpy.types.Object, depsgraph: bpy.types.Depsgraph) -> tuple[Vector, Vector]:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        return (
            Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
            Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
        )
    finally:
        evaluated.to_mesh_clear()


def _pose_metrics(rig: bpy.types.Object, actions: tuple[str, ...]) -> dict[str, object]:
    body = bpy.data.objects["BODY_CONTINUOUS"]
    suit = bpy.data.objects["BODYSUIT"]
    rig.animation_data_create()
    result: dict[str, object] = {}
    for action_name in actions:
        action = bpy.data.actions[action_name]
        rig.animation_data.action = action
        start = int(action.get("astra.frame_start", 1))
        end = int(action.get("astra.frame_end", start))
        frames = sorted({start, (start + end) // 2, end})
        samples = []
        for frame in frames:
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            depsgraph = bpy.context.evaluated_depsgraph_get()
            body_min, body_max = _evaluated_bounds(body, depsgraph)
            suit_min, suit_max = _evaluated_bounds(suit, depsgraph)
            delta = max(
                abs(body_min[axis] - suit_min[axis]) for axis in range(3)
            ) + max(abs(body_max[axis] - suit_max[axis]) for axis in range(3))
            samples.append({
                "frame": frame,
                "bodyHeight": round(body_max.z - body_min.z, 5),
                "suitBodyBoundsDelta": round(delta, 5),
            })
        result[action_name] = samples
    return result


def _look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def _render(rig: bpy.types.Object, action_name: str, frame: int) -> str:
    scene = bpy.context.scene
    rig.animation_data.action = bpy.data.actions[action_name]
    scene.frame_set(frame)
    data = bpy.data.cameras.get("ASTRA_RIG_QA_CAMERA") or bpy.data.cameras.new("ASTRA_RIG_QA_CAMERA")
    data.type = "ORTHO"
    data.ortho_scale = 1.95
    camera = bpy.data.objects.get("ASTRA_RIG_QA_CAMERA")
    if camera is None:
        camera = bpy.data.objects.new("ASTRA_RIG_QA_CAMERA", data)
        scene.collection.objects.link(camera)
    camera.location = (2.8, -2.8, 0.92)
    _look_at(camera, Vector((0.0, 0.0, 0.92)))
    scene.camera = camera
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 540
    scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    world = scene.world
    if world is not None and world.use_nodes:
        background = world.node_tree.nodes.get("Background")
        if background is not None:
            background.inputs["Strength"].default_value = 0.42
    lights = (
        ("ASTRA_RIG_KEY", (2.4, -3.0, 3.1), 1000.0, (1.0, 0.72, 0.62), 2.2),
        ("ASTRA_RIG_FILL", (-2.2, -2.0, 2.3), 760.0, (0.45, 0.72, 1.0), 2.5),
        ("ASTRA_RIG_RIM", (1.5, 2.5, 2.8), 950.0, (0.35, 0.75, 1.0), 2.0),
    )
    for name, location, energy, color, size in lights:
        light_data = bpy.data.lights.get(name) or bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.color = color
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.get(name)
        if light is None:
            light = bpy.data.objects.new(name, light_data)
            scene.collection.objects.link(light)
        light.location = location
        _look_at(light, Vector((0.0, 0.0, 0.92)))
    for name in ("GROUND",):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_render = True
    output = QA_ROOT / f"{action_name.lower()}-{frame:03d}.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return str(output)


def main() -> None:
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND))
    rig = bpy.data.objects.get("ASTRA_RIG")
    if rig is None:
        raise RuntimeError("ASTRA_RIG is missing")
    binding = _bind_candidate(rig)
    names = (
        "Walk", "Run", "Jump_Start", "Jump_Loop", "Jump_Land",
        "Attack_01", "Attack_02", "Wave", "Look_Around",
    )
    built = build_action_library(
        rig,
        action_names=names,
        include_hair=True,
        include_fingers=True,
        require_approval=True,
        mutate_scene_timing=True,
    )
    validation = validate_actions(rig)
    metrics = _pose_metrics(rig, names)
    proofs = []
    for name, frame in (("Walk", 16), ("Run", 12), ("Jump_Land", 20),
                        ("Attack_01", 24), ("Attack_02", 34), ("Wave", 60)):
        proofs.append(_render(rig, name, frame))
    report = {
        "source": str(SOURCE_BLEND),
        "externalModelUsed": False,
        "binding": binding,
        "actions": built.report(),
        "validation": validation,
        "poseMetrics": metrics,
        "proofs": proofs,
    }
    (QA_ROOT / "rig-animation.report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    bpy.ops.wm.save_as_mainfile(
        filepath=str(QA_ROOT / "ASTRA_RIG_ANIMATION_CANDIDATE.blend"),
        check_existing=False,
    )


if __name__ == "__main__":
    main()
