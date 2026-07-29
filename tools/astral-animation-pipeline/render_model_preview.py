import math
import sys

import bpy
from mathutils import Vector


def args_after_separator():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def look_at(camera, point):
    camera.rotation_euler = (Vector(point) - camera.location).to_track_quat("-Z", "Y").to_euler()


arguments = args_after_separator()
source, output = arguments[:2]
motion = arguments[2] if len(arguments) > 2 else ""
action_name = arguments[3] if len(arguments) > 3 else "idle_relaxed"
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
before_target = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=source)
target_objects = [obj for obj in bpy.data.objects if obj not in before_target]
target_armature = max((obj for obj in target_objects if obj.type == "ARMATURE"), key=lambda obj: len(obj.data.bones))

if motion:
    before_actions = set(bpy.data.actions)
    before_motion = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=motion)
    imported_actions = [action for action in bpy.data.actions if action not in before_actions]
    selected_action = next((action for action in imported_actions if action.name == action_name), None)
    if selected_action is None:
        raise RuntimeError(f"Animation {action_name} not found")
    target_armature.animation_data_create()
    target_armature.animation_data.action = selected_action
    if getattr(selected_action, "slots", None):
        target_armature.animation_data.action_slot = selected_action.slots[0]
    start, end = selected_action.frame_range
    bpy.context.scene.frame_set(round((start + end) * 0.5))
    for obj in (obj for obj in bpy.data.objects if obj not in before_motion):
        obj.hide_render = True

corners = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
if not corners:
    raise RuntimeError("No mesh found")

minimum = Vector((min(p.x for p in corners), min(p.y for p in corners), min(p.z for p in corners)))
maximum = Vector((max(p.x for p in corners), max(p.y for p in corners), max(p.z for p in corners)))
center = (minimum + maximum) * 0.5
height = max(0.001, maximum.z - minimum.z)

camera_data = bpy.data.cameras.new("QA Camera")
camera = bpy.data.objects.new("QA Camera", camera_data)
bpy.context.scene.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera_data.lens = 55
camera.location = center + Vector((0, -height * 2.3, height * 0.08))
look_at(camera, center + Vector((0, 0, height * 0.03)))

world = bpy.context.scene.world
world.color = (0.035, 0.04, 0.055)
for location, energy, size in [
    ((height * 1.2, -height, maximum.z + height), 1000, height * 2),
    ((-height, -height * 0.5, center.z), 650, height * 1.6),
    ((0, height, maximum.z), 900, height)
]:
    data = bpy.data.lights.new("QA Area", "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new("QA Area", data)
    light.location = location
    bpy.context.scene.collection.objects.link(light)
    look_at(light, center)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.filepath = output
scene.view_settings.look = "AgX - Medium High Contrast"
bpy.ops.render.render(write_still=True)
print(f"Rendered {output}; bounds={minimum[:]},{maximum[:]}")
