"""Isolated Astra head/hair/material integration render.

Loads the locally generated HUMAN_BASE, rebuilds only procedural hair and the
body-derived suit using repository code, and writes four neutral QA views.  It
does not build or alter rigging/weights and it imports no external 3D asset.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
BASE = ROOT / "output" / "HUMAN_BASE.blend"
OUTPUT = REPO / "assets" / "character-3d" / "astra-h08" / "qa" / "agent-head-hair"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from materials.materials import assign_character_materials, build_materials  # noqa: E402
from modeling.bodysuit import build_bodysuit  # noqa: E402


def load_hair_module():
    path = ROOT / "03_hair.py"
    spec = importlib.util.spec_from_file_location("astra_hair_candidate", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area_light(name: str, location: tuple[float, float, float], energy: float,
               color: tuple[float, float, float], size: float) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    look_at(obj, (0.0, 0.0, 1.58))


def setup_scene() -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.018, 0.024, 0.034, 1.0)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32
    for name in ("GROUND", "KEY", "FILL", "RIM", "TOP", "Camera_FullBody"):
        item = bpy.data.objects.get(name)
        if item is not None:
            item.hide_render = True
    area_light("INTEGRATION_KEY", (-1.2, -1.8, 2.2), 760.0, (1.0, 0.72, 0.65), 1.25)
    area_light("INTEGRATION_FILL", (1.3, -1.5, 1.95), 510.0, (0.43, 0.68, 1.0), 1.45)
    area_light("INTEGRATION_RIM", (1.0, 1.4, 2.1), 820.0, (0.33, 0.78, 1.0), 1.10)
    data = bpy.data.cameras.new("HEAD_HAIR_QA_CAMERA")
    data.type = "ORTHO"
    data.ortho_scale = 0.46
    camera = bpy.data.objects.new("HEAD_HAIR_QA_CAMERA", data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    return camera


def visibility_metrics(objects: tuple[bpy.types.Object, ...], fit) -> dict[str, object]:
    eye_z = fit.crown_z - 0.115 * fit.scale
    eye_band = (
        eye_z - 0.025 * fit.scale,
        eye_z + 0.025 * fit.scale,
    )
    central_limit = 0.073 * fit.scale
    frontal_limit = fit.front_y + 0.016 * fit.scale
    blockers = []
    for obj in objects:
        if obj.type != "MESH" or not obj.name.startswith("HAIR_"):
            continue
        count = 0
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            if (
                eye_band[0] <= point.z <= eye_band[1]
                and abs(point.x - fit.center_x) <= central_limit
                and point.y <= frontal_limit
            ):
                count += 1
        if count:
            blockers.append({"object": obj.name, "vertices": count})
    return {
        "headHalfWidth": round(fit.head_half_width, 5),
        "frontY": round(fit.front_y, 5),
        "eyeBand": [round(value, 5) for value in eye_band],
        "centralEyeBlockers": blockers,
    }


def main() -> None:
    if not BASE.is_file():
        raise RuntimeError(f"Missing procedural base: {BASE}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(BASE))
    body = bpy.data.objects.get("BODY_CONTINUOUS")
    if body is None:
        raise RuntimeError("BODY_CONTINUOUS is missing")
    body["HUMAN_BASE_APPROVED"] = True
    bpy.context.scene["HUMAN_BASE_APPROVED"] = True

    hair_module = load_hair_module()
    hair = hair_module.build_hair(body=body)
    materials = build_materials()
    suit_objects = build_bodysuit(body, materials)
    assignments = assign_character_materials(materials)
    body.data.materials.clear()
    body.data.materials.append(materials["FACE_SKIN"])

    camera = setup_scene()
    views = {
        "integrated-front.png": (0.0, -2.0, 1.59),
        "integrated-three-quarter.png": (1.28, -1.54, 1.59),
        "integrated-profile.png": (2.0, -0.15, 1.59),
        "integrated-back.png": (0.0, 2.0, 1.59),
    }
    renders = []
    for filename, location in views.items():
        camera.location = location
        look_at(camera, (0.0, 0.0, 1.58))
        path = OUTPUT / filename
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        renders.append(str(path))

    blend = OUTPUT / "ASTRA_HEAD_HAIR_INTEGRATION.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
    report = {
        "source": str(BASE),
        "externalModelUsed": False,
        "rigOrWeightsBuilt": False,
        "hairObjects": [obj.name for obj in hair.objects],
        "suitObjects": [obj.name for obj in suit_objects],
        "materialAssignments": assignments,
        "visibility": visibility_metrics(hair.objects, hair.fit),
        "renders": renders,
        "blend": str(blend),
        "status": "candidate-awaiting-independent-visual-review",
    }
    (OUTPUT / "head-hair-integration.report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
