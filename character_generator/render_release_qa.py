"""Render final Astra H-08 turnaround, detail, and animation proof frames."""

from __future__ import annotations

import json
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
ASSET_ROOT = ROOT.parent / "assets" / "character-3d" / "astra-h08"
BLEND_PATH = ASSET_ROOT / "output" / "ASTRA_H08.blend"
QA_ROOT = ASSET_ROOT / "qa" / "release-candidate"


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def camera() -> bpy.types.Object:
    data = bpy.data.cameras.new("ASTRA_QA_CAMERA")
    data.type = "ORTHO"
    data.ortho_scale = 1.92
    obj = bpy.data.objects.new("ASTRA_QA_CAMERA", data)
    bpy.context.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    return obj


def render(obj: bpy.types.Object, filename: str, location: tuple[float, float, float],
           target: tuple[float, float, float], scale: float) -> str:
    obj.location = location
    obj.data.ortho_scale = scale
    look_at(obj, target)
    path = QA_ROOT / filename
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return str(path)


def set_action(name: str, frame: int) -> None:
    rig = bpy.data.objects.get("ASTRA_RIG")
    if rig is None:
        raise RuntimeError("ASTRA_RIG is missing")
    rig.animation_data_create().action = bpy.data.actions[name]
    bpy.context.scene.frame_set(frame)


def restore_scene() -> None:
    """Force a clean dependency-graph evaluation before every proof frame."""
    bpy.context.view_layer.update()
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.hide_render = bool(obj.get("astra.release_role_witness"))


def main() -> None:
    if not BLEND_PATH.is_file():
        raise RuntimeError(f"Missing final Blender project: {BLEND_PATH}")
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.44
    for name in ("GROUND", "KEY", "FILL", "RIM", "TOP"):
        item = bpy.data.objects.get(name)
        if item is not None:
            item.hide_render = name == "GROUND"
    proof_camera = camera()
    outputs: list[str] = []
    set_action("Idle", 1)
    views = {
        "astra-front.png": ((0.0, -4.0, 0.92), (0.0, 0.0, 0.92), 1.92),
        "astra-left-profile.png": ((4.0, 0.0, 0.92), (0.0, 0.0, 0.92), 1.92),
        "astra-back.png": ((0.0, 4.0, 0.92), (0.0, 0.0, 0.92), 1.92),
        "astra-three-quarter.png": ((2.8, -2.8, 0.92), (0.0, 0.0, 0.92), 1.92),
        "astra-face.png": ((0.0, -2.0, 1.61), (0.0, 0.0, 1.61), 0.39),
        "astra-face-profile.png": ((2.0, 0.0, 1.61), (0.0, 0.0, 1.61), 0.39),
        "astra-hand.png": ((0.70, -2.0, 0.78), (0.30, 0.0, 0.78), 0.33),
        "astra-boots.png": ((0.55, -2.0, 0.18), (0.14, 0.0, 0.16), 0.42),
    }
    for filename, (location, target, scale) in views.items():
        outputs.append(render(proof_camera, filename, location, target, scale))
    for action, frame in (("Walk", 16), ("Run", 12), ("Jump_Land", 20),
                          ("Attack_01", 24), ("Attack_02", 34), ("Wave", 60)):
        set_action(action, frame)
        restore_scene()
        outputs.append(render(
            proof_camera,
            f"animation-{action.lower()}.png",
            (2.8, -2.8, 0.92),
            (0.0, 0.0, 0.92),
            1.92,
        ))
    report = {
        "status": "rendered-awaiting-independent-qa",
        "sourceBlend": str(BLEND_PATH),
        "renders": outputs,
        "actionsProved": ["Walk", "Run", "Jump_Land", "Attack_01", "Attack_02", "Wave"],
    }
    (QA_ROOT / "release-candidate.report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
