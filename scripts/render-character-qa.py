"""Render studio QA stills for a prepared character and baked motion GLB."""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    raw = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--motion")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--prefix", default="character")
    return parser.parse_args(raw)


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(Path(path).resolve()))
    return [obj for obj in bpy.data.objects if obj not in before]


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def world_bounds(objects):
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    return (
        Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points))),
        Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points))),
    )


def add_area(name, location, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return obj


def setup_studio(model_objects):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.008, 0.012, 0.022)

    low, high = world_bounds(model_objects)
    center = (low + high) * 0.5
    height = max(0.1, high.z - low.z)

    camera_data = bpy.data.cameras.new("QACamera")
    camera_data.lens = 58
    camera = bpy.data.objects.new("QACamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (center.x + height * 0.22, low.y - height * 1.85, center.z + height * 0.03)
    look_at(camera, (center.x, center.y, center.z + height * 0.02))
    scene.camera = camera

    key = add_area("QAKey", (center.x - height * 0.65, center.y - height * 0.65, high.z + height * 0.3), 1250, height * 0.65, (1.0, 0.86, 0.76))
    fill = add_area("QAFill", (center.x + height * 0.75, center.y - height * 0.25, center.z + height * 0.1), 760, height * 0.7, (0.62, 0.78, 1.0))
    rim = add_area("QARim", (center.x, high.y + height * 0.55, high.z), 1000, height * 0.55, (0.48, 0.68, 1.0))
    look_at(key, center)
    look_at(fill, center)
    look_at(rim, center)

    floor_data = bpy.data.meshes.new("QAFloor")
    floor = bpy.data.objects.new("QAFloor", floor_data)
    bpy.context.collection.objects.link(floor)
    vertices = [(-8, -8, 0), (8, -8, 0), (8, 8, 0), (-8, 8, 0)]
    floor_data.from_pydata(vertices, [], [(0, 1, 2, 3)])
    floor.location.z = low.z - 0.01
    material = bpy.data.materials.new("QAFloorMaterial")
    material.diffuse_color = (0.012, 0.018, 0.032, 1.0)
    material.metallic = 0.18
    material.roughness = 0.32
    floor.data.materials.append(material)


def render_action(scene, armature, action_name, frame_ratio, output):
    action = bpy.data.actions.get(action_name)
    if not action:
        raise RuntimeError(f"Missing QA action: {action_name}")
    armature.animation_data_create()
    armature.animation_data.action = action
    if getattr(action, "slots", None):
        armature.animation_data.action_slot = action.slots[0]
    start, end = action.frame_range
    frame = int(round(start + (end - start) * frame_ratio))
    scene.frame_set(frame)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    model_objects = import_gltf(args.model)
    model_armatures = [obj for obj in model_objects if obj.type == "ARMATURE"]
    if len(model_armatures) != 1:
        raise RuntimeError("Prepared model must contain exactly one armature")
    target = model_armatures[0]

    if args.motion:
        native_actions = set(bpy.data.actions)
        motion_objects = import_gltf(args.motion)
        motion_actions = [action for action in bpy.data.actions if action not in native_actions]
        for action in motion_actions:
            action.use_fake_user = True
        for obj in motion_objects:
            bpy.data.objects.remove(obj, do_unlink=True)

    setup_studio(model_objects)
    scene = bpy.context.scene
    target.animation_data_clear()
    scene.frame_set(0)
    scene.render.filepath = str(output_dir / f"{args.prefix}-rest.png")
    bpy.ops.render.render(write_still=True)
    if bpy.data.actions.get("idle_relaxed"):
        render_action(scene, target, "idle_relaxed", 0.42, output_dir / f"{args.prefix}-idle.png")
    if bpy.data.actions.get("attack_1"):
        render_action(scene, target, "attack_1", 0.52, output_dir / f"{args.prefix}-attack.png")


if __name__ == "__main__":
    main()
