"""Render the current final blend head with debug visibility variants."""

from pathlib import Path
import json
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BLEND = ROOT / "assets" / "character-3d" / "astra-h08" / "output" / "ASTRA_H08.blend"
OUT = ROOT / "assets" / "character-3d" / "astra-h08" / "qa" / "agent-head-hair"

def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.wm.open_mainfile(filepath=str(BLEND))
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = False
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.38
for name in ("GROUND", "Camera_FullBody"):
    obj = bpy.data.objects.get(name)
    if obj:
        obj.hide_render = True

# The saved build intentionally hides its construction lights.  This QA script
# needs an independent portrait rig so material and fit can be judged, rather
# than mistaking an unlit warm skin shader for black geometry.
def add_area(name, location, energy, color, size):
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.color = color
    light_data.shape = "DISK"
    light_data.size = size
    light = bpy.data.objects.new(name, light_data)
    light.location = location
    bpy.context.collection.objects.link(light)
    look_at(light, (0.0, 0.0, 1.59))

add_area("QA_KEY", (-1.0, -1.8, 2.15), 700.0, (1.0, 0.74, 0.68), 1.3)
add_area("QA_FILL", (1.2, -1.5, 1.90), 520.0, (0.46, 0.70, 1.0), 1.5)
add_area("QA_RIM", (1.0, 1.4, 2.05), 760.0, (0.38, 0.78, 1.0), 1.1)

rig = bpy.data.objects.get("ASTRA_RIG")
if rig and bpy.data.actions.get("Idle"):
    rig.animation_data_create().action = bpy.data.actions["Idle"]
    scene.frame_set(1)

data = bpy.data.cameras.new("AGENT_HEAD_HAIR_CAMERA")
data.type = "ORTHO"
camera = bpy.data.objects.new("AGENT_HEAD_HAIR_CAMERA", data)
bpy.context.collection.objects.link(camera)
scene.camera = camera

views = {
    "front": ((0.0, -2.0, 1.59), 0.43),
    "three-quarter": ((1.30, -1.52, 1.59), 0.43),
    "profile": ((2.0, -0.18, 1.59), 0.43),
    "back": ((0.0, 2.0, 1.59), 0.48),
}

outputs = []
for variant in ("full", "no-suit", "no-hair"):
    suit = bpy.data.objects.get("BODYSUIT")
    if suit:
        suit.hide_render = variant == "no-suit"
    for obj in scene.objects:
        if obj.name.startswith("HAIR_"):
            obj.hide_render = variant == "no-hair"
    for view, (location, scale) in views.items():
        camera.location = location
        data.ortho_scale = scale
        look_at(camera, (0.0, 0.0, 1.59))
        path = OUT / f"current-{variant}-{view}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(path))

(OUT / "current-render.report.json").write_text(json.dumps({"renders": outputs}, indent=2), encoding="utf-8")
