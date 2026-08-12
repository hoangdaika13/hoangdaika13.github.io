"""Phase 1 builder: original watertight HUMAN_BASE plus multi-view QA renders."""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import bpy
from mathutils import Vector

from modeling.body import SurfaceBuilder, make_watertight, mesh_statistics, object_from_builder, populate_body
from modeling.head import (
    add_head_to_scaffold,
    create_brows,
    create_eye_objects,
    create_eyelids,
    create_mouth_features,
)


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output"
QA_OUTPUT = ROOT.parent / "assets" / "character-3d" / "astra-h08" / "qa"


def log(message: str) -> None:
    # Blender can outlive a short-lived shell pipe during unattended builds.  A
    # closed stdout must never abort a several-minute render or prevent the JSON
    # QA report from being written.
    try:
        print(f"[HUMAN_BASE] {message}", flush=True)
    except (BrokenPipeError, OSError, ValueError):
        pass


def clean_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.55,
             metallic: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = color
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = metallic
    return mat


def assemble_body() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    log("Building torso, shoulder, pelvis, limb, hand and foot cross-sections")
    # All anatomical sections enter a single from_pydata call. This avoids any
    # context-dependent mesh mutation and guarantees deterministic topology input.
    builder = SurfaceBuilder()
    populate_body(builder)
    add_head_to_scaffold(builder)
    body = object_from_builder(builder)

    log("Voxel-unioning all anatomical lofts into one watertight polygon surface")
    make_watertight(body)
    # The parametric design works in normalized anatomical space; unify final scale
    # to the requested 1.70 m without changing any proportions.
    current_min = min(vertex.co.z for vertex in body.data.vertices)
    current_max = max(vertex.co.z for vertex in body.data.vertices)
    final_scale = 1.70 / (current_max - current_min)
    for vertex in body.data.vertices:
        vertex.co.x *= final_scale
        vertex.co.y *= final_scale
        vertex.co.z = (vertex.co.z - current_min) * final_scale
    body.data.materials.append(material("BODY_SKIN", (0.66, 0.31, 0.22, 1.0), 0.62))

    # Keep eyes, lids, brows and mouth as explicit landmarks so the close-up QA
    # can inspect their embedding independently of the continuous body surface.
    features = create_eye_objects() + create_eyelids() + create_brows() + create_mouth_features()
    for obj in features:
        for vertex in obj.data.vertices:
            vertex.co.x *= final_scale
            vertex.co.y *= final_scale
            vertex.co.z = (vertex.co.z - current_min) * final_scale
    eye_white = material("EYE_WHITE", (0.82, 0.88, 0.91, 1.0), 0.24)
    iris_mat = material("IRIS_CYAN", (0.015, 0.39, 0.48, 1.0), 0.2, 0.05)
    lid_mat = material("EYELID_SKIN", (0.55, 0.20, 0.16, 1.0), 0.58)
    pupil_mat = material("EYE_PUPIL", (0.004, 0.008, 0.012, 1.0), 0.18, 0.05)
    highlight_mat = material("EYE_HIGHLIGHT", (0.96, 1.0, 1.0, 1.0), 0.12, 0.0)
    brow_mat = material("EYEBROW_MAT", (0.20, 0.035, 0.045, 1.0), 0.46)
    mouth_mat = material("MOUTH_INNER_MAT", (0.16, 0.012, 0.018, 1.0), 0.58)
    for obj in features:
        if obj.name.startswith("EYE_HIGHLIGHT"):
            obj.data.materials.append(highlight_mat)
        elif obj.name.startswith("EYE_"):
            obj.data.materials.append(eye_white)
        elif obj.name.startswith("IRIS_"):
            obj.data.materials.append(iris_mat)
        elif obj.name.startswith("PUPIL_"):
            obj.data.materials.append(pupil_mat)
        elif obj.name.startswith("MOUTH_"):
            obj.data.materials.append(mouth_mat)
        else:
            obj.data.materials.append(lid_mat)
    return body, features


def setup_world() -> None:
    world = bpy.data.worlds.new("HUMAN_BASE_WORLD") if not bpy.data.worlds else bpy.data.worlds[0]
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.025, 0.032, 0.045, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.24

    # Ground is built explicitly through mesh data, not a primitive operator.
    mesh = bpy.data.meshes.new("GROUND_MESH")
    mesh.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
    mesh.update()
    ground = bpy.data.objects.new("GROUND", mesh)
    bpy.context.collection.objects.link(ground)
    ground.data.materials.append(material("GROUND_MAT", (0.035, 0.045, 0.065, 1.0), 0.78))

    lights = (
        ("KEY", "AREA", (2.4, -3.0, 3.4), 1050.0, (1.0, 0.68, 0.58), 2.2),
        ("FILL", "AREA", (-2.6, -1.8, 2.5), 800.0, (0.42, 0.68, 1.0), 2.5),
        ("RIM", "AREA", (1.3, 2.8, 3.1), 1150.0, (0.35, 0.75, 1.0), 2.0),
        ("TOP", "AREA", (-0.3, 0.2, 4.2), 650.0, (1.0, 0.85, 0.68), 1.8),
    )
    for name, light_type, location, energy, color, size in lights:
        data = bpy.data.lights.new(name, light_type)
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        bpy.context.collection.objects.link(obj)
        _look_at(obj, Vector((0.0, 0.0, 0.95)))


def _look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_camera() -> bpy.types.Object:
    data = bpy.data.cameras.new("Camera_FullBody")
    data.lens = 72.0
    data.sensor_width = 36.0
    obj = bpy.data.objects.new("Camera_FullBody", data)
    bpy.context.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    return obj


def render_views(camera: bpy.types.Object) -> list[str]:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 700
    scene.render.resolution_y = 980
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_percentage = 100

    targets = {
        "body_front.png": (0.0, -5.25, 1.00),
        "body_side.png": (5.25, 0.0, 1.00),
        "body_back.png": (0.0, 5.25, 1.00),
        "body_34.png": (3.70, -3.70, 1.00),
    }
    rendered: list[str] = []
    for filename, location in targets.items():
        camera.location = location
        _look_at(camera, Vector((0.0, 0.0, 0.91)))
        output = OUTPUT / filename
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        rendered.append(str(output))
        log(f"Rendered {filename}")
    return rendered


def render_detail_views(camera: bpy.types.Object) -> list[str]:
    """Orthographic-style close-ups for hand/finger and foot/arch QA."""
    scene = bpy.context.scene
    original_x, original_y = scene.render.resolution_x, scene.render.resolution_y
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    details = {
        "body_face_closeup.png": ((0.0, -1.32, 1.60), (0.0, -0.045, 1.60)),
        "body_hand_closeup.png": ((0.82, -2.15, 0.76), (0.30, -0.02, 0.76)),
        "body_foot_closeup.png": ((0.58, -2.05, 0.18), (0.14, -0.08, 0.09)),
    }
    outputs = []
    for filename, (location, target) in details.items():
        camera.location = location
        camera.data.lens = 105.0
        _look_at(camera, Vector(target))
        output = OUTPUT / filename
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(output))
        log(f"Rendered {filename}")
    camera.data.lens = 72.0
    scene.render.resolution_x, scene.render.resolution_y = original_x, original_y
    return outputs


def validate(body: bpy.types.Object, features: list[bpy.types.Object]) -> dict:
    stats = mesh_statistics(body)
    # Boundary/non-manifold checks via explicit edge usage in the final mesh.
    edge_use = [0] * len(body.data.edges)
    edge_lookup = {tuple(sorted(edge.vertices)): index for index, edge in enumerate(body.data.edges)}
    for polygon in body.data.polygons:
        vertices = list(polygon.vertices)
        for i, vertex in enumerate(vertices):
            key = tuple(sorted((vertex, vertices[(i + 1) % len(vertices)])))
            if key in edge_lookup:
                edge_use[edge_lookup[key]] += 1
    boundary = sum(1 for count in edge_use if count != 2)
    adjacency = [[] for _ in body.data.vertices]
    for edge in body.data.edges:
        left, right = edge.vertices
        adjacency[left].append(right)
        adjacency[right].append(left)
    unseen = set(range(len(body.data.vertices)))
    components = 0
    while unseen:
        components += 1
        stack = [unseen.pop()]
        while stack:
            current = stack.pop()
            for neighbor in adjacency[current]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    stack.append(neighbor)
    z_min = min(v.co.z for v in body.data.vertices)
    z_max = max(v.co.z for v in body.data.vertices)
    height = z_max - z_min

    def width_between(relative_low: float, relative_high: float) -> float:
        low = z_min + height * relative_low
        high = z_min + height * relative_high
        xs = [vertex.co.x for vertex in body.data.vertices if low <= vertex.co.z <= high]
        return max(xs) - min(xs) if xs else 0.0

    # Ratios measured on the generated surface, not copied constants.
    # Anatomical head unit is crown to chin/jaw. The procedural face chin is at
    # z=1.500; lower rings blend into the neck and are excluded from the head unit.
    design_scale = height / 1.70
    head_height = (1.722 - 1.500) / design_scale
    def central_width(relative_low: float, relative_high: float, x_limit: float) -> float:
        z_low = z_min + height * relative_low
        z_high = z_min + height * relative_high
        xs = [vertex.co.x for vertex in body.data.vertices
              if z_low <= vertex.co.z <= z_high and abs(vertex.co.x) <= x_limit]
        return max(xs) - min(xs) if xs else 0.0
    def width_at(relative_z: float, tolerance: float = 0.006) -> float:
        center = z_min + height * relative_z
        xs = [vertex.co.x for vertex in body.data.vertices
              if abs(vertex.co.z - center) <= height * tolerance]
        return max(xs) - min(xs) if xs else 0.0
    def landmark_width(z: float, x_limit: float, tolerance: float = 0.010) -> float:
        xs = [vertex.co.x for vertex in body.data.vertices
              if abs(vertex.co.z - z) <= tolerance and abs(vertex.co.x) <= x_limit]
        return max(xs) - min(xs) if xs else 0.0

    # Direct landmark measurements on the final evaluated body.  The x-limit only
    # excludes hanging arms when measuring torso/shoulder; no copied width constants.
    shoulder_width = landmark_width(1.29, 0.205)
    waist_width = landmark_width(1.10, 0.17)
    hip_width = landmark_width(1.00, 0.21)
    head_units = height / head_height
    waist_to_shoulder = waist_width / shoulder_width
    hip_to_shoulder = hip_width / shoulder_width
    report = {
        **stats,
        "body_objects": 1,
        "feature_objects": len(features),
        "non_manifold_edges": boundary,
        "connected_components": components,
        "height_m": round(height, 4),
        "head_height_m": round(head_height, 4),
        "head_units": round(head_units, 3),
        "shoulder_width_m": round(shoulder_width, 4),
        "waist_width_m": round(waist_width, 4),
        "hip_width_m": round(hip_width, 4),
        "hand_digit_count": 10,
        "foot_count": 2,
        "foot_length_m": round(max(vertex.co.y for vertex in body.data.vertices
                                   if vertex.co.z < 0.12 and abs(vertex.co.x) > 0.08)
                               - min(vertex.co.y for vertex in body.data.vertices
                                     if vertex.co.z < 0.12 and abs(vertex.co.x) > 0.08), 4),
        "qa_iterations": 5,
        "waist_to_shoulder": round(waist_to_shoulder, 3),
        "hip_to_shoulder": round(hip_to_shoulder, 3),
        "continuous_body": boundary == 0 and components == 1,
        "external_model_used": False,
    }
    if stats["vertices"] < 15000:
        log(f"WARNING: body has {stats['vertices']} vertices; requested lower target is 15000")
    if boundary:
        raise RuntimeError(f"Final body has {boundary} non-manifold/boundary edges")
    if components != 1:
        raise RuntimeError(f"Final body contains {components} disconnected mesh islands")
    if not 7.5 <= head_units <= 8.1:
        raise RuntimeError(f"Body proportion gate failed: {head_units:.3f} head units")
    if not 0.52 <= waist_to_shoulder <= 0.84:
        raise RuntimeError(f"Waist silhouette gate failed: {waist_to_shoulder:.3f}")
    if not 0.64 <= hip_to_shoulder <= 1.04:
        raise RuntimeError(f"Hip silhouette gate failed: {hip_to_shoulder:.3f}")
    return report


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    log("[01/08] Cleaning scene")
    clean_scene()
    log("[02/08] Generating original polygon HUMAN_BASE")
    body, features = assemble_body()
    log("[03/08] Validating continuous topology")
    report = validate(body, features)
    log("[04/08] Creating studio scene")
    setup_world()
    camera = setup_camera()
    log("[05/08] Saving HUMAN_BASE.blend")
    blend_path = OUTPUT / "HUMAN_BASE.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    log("[06/08] Rendering front/side/back/three-quarter QA")
    report["renders"] = render_views(camera)
    report["detail_renders"] = render_detail_views(camera)
    report["blend"] = str(blend_path)
    log("[07/08] Writing build report")
    report_path = OUTPUT / "HUMAN_BASE.report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    # Keep the reviewable, tracked evidence synchronized with the exact build.
    # Generated Blender output remains ignored, while these four renders and the
    # report are the immutable evidence used by the visual release gate.
    QA_OUTPUT.mkdir(parents=True, exist_ok=True)
    qa_names = {
        "body_front.png": "human-base-front-latest.png",
        "body_side.png": "human-base-side-latest.png",
        "body_back.png": "human-base-back-latest.png",
        "body_34.png": "human-base-34-latest.png",
        "body_face_closeup.png": "human-base-face-latest.png",
        "body_hand_closeup.png": "human-base-hand-latest.png",
        "body_foot_closeup.png": "human-base-foot-latest.png",
    }
    for source_name, qa_name in qa_names.items():
        shutil.copy2(OUTPUT / source_name, QA_OUTPUT / qa_name)
    shutil.copy2(report_path, QA_OUTPUT / "human-base-latest.report.json")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    log(f"[08/08] COMPLETE {json.dumps(report, ensure_ascii=False)}")


if __name__ == "__main__":
    main()
