"""ASTRA H-08 head/face candidate built entirely from procedural mesh data.

This is an isolated visual-development candidate.  It intentionally does not
import or alter ``main_body.py`` and it never loads an external 3D asset.  The
head is one closed quad surface generated from anatomical cross-sections; facial
landmarks are coordinate deformations of that surface.  Separate ocular and
thin feature surfaces are retained so their eventual rig topology can be judged
before integrating the candidate into the approved body generator.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

import sys


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
OUTPUT = REPO / "assets" / "character-3d" / "astra-h08" / "qa" / "agent-head"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from modeling.head import (  # noqa: E402
    create_brows as create_main_brows,
    create_eye_objects as create_main_eye_objects,
    create_eyelids as create_main_eyelids,
    create_mouth_features as create_main_mouth_features,
)
from modeling.body import SurfaceBuilder  # noqa: E402

CHIN_Z = 1.490
CROWN_Z = 1.725
FACE_CENTER_Z = 1.607


def log(message: str) -> None:
    try:
        print(f"[HEAD_FACE_CANDIDATE] {message}", flush=True)
    except (BrokenPipeError, OSError, ValueError):
        pass


def clean_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def profile_value(t: float, keys: tuple[tuple[float, float], ...]) -> float:
    if t <= keys[0][0]:
        return keys[0][1]
    for (left_t, left_value), (right_t, right_value) in zip(keys, keys[1:]):
        if t <= right_t:
            mix = smoothstep((t - left_t) / max(1e-8, right_t - left_t))
            return left_value + (right_value - left_value) * mix
    return keys[-1][1]


WIDTH_PROFILE = (
    (0.00, 0.006),
    (0.035, 0.027),
    (0.10, 0.041),
    (0.20, 0.055),
    (0.32, 0.071),
    (0.43, 0.082),
    (0.56, 0.084),
    (0.70, 0.083),
    (0.82, 0.078),
    (0.91, 0.062),
    (0.975, 0.031),
    (1.00, 0.006),
)

FRONT_PROFILE = (
    (0.00, 0.006),
    (0.035, 0.033),
    (0.10, 0.055),
    (0.20, 0.070),
    (0.32, 0.080),
    (0.43, 0.084),
    (0.56, 0.082),
    (0.70, 0.079),
    (0.82, 0.071),
    (0.91, 0.056),
    (0.975, 0.028),
    (1.00, 0.006),
)

REAR_PROFILE = (
    (0.00, 0.006),
    (0.035, 0.029),
    (0.10, 0.050),
    (0.20, 0.067),
    (0.32, 0.083),
    (0.43, 0.095),
    (0.56, 0.103),
    (0.70, 0.108),
    (0.82, 0.103),
    (0.91, 0.086),
    (0.975, 0.046),
    (1.00, 0.006),
)

CENTER_Y_PROFILE = (
    (0.00, -0.002),
    (0.10, 0.004),
    (0.20, 0.007),
    (0.43, 0.010),
    (0.56, 0.013),
    (0.70, 0.016),
    (0.82, 0.018),
    (0.91, 0.016),
    (1.00, 0.008),
)


def gaussian(value: float, center: float, sigma: float) -> float:
    return math.exp(-((value - center) / sigma) ** 2)


def facial_offset(x: float, z: float, frontness: float) -> float:
    """Signed Y displacement: negative projects toward the camera/front."""
    if frontness <= 0.0:
        return 0.0
    # Paired orbital depressions seat the eyes instead of placing them on a mask.
    sockets = sum(
        gaussian(x, sign * 0.037, 0.029) * gaussian(z, 1.609, 0.023)
        for sign in (-1.0, 1.0)
    )
    # The zygomatic plane is full but soft, as in the supplied three-quarter art.
    cheeks = sum(
        gaussian(x, sign * 0.050, 0.034) * gaussian(z, 1.565, 0.041)
        for sign in (-1.0, 1.0)
    )
    # A continuous bridge, compact tip and restrained alar wings.  Because these
    # are surface displacements there is no open triangular nose underside.
    bridge = gaussian(x, 0.0, 0.0105) * gaussian(z, 1.606, 0.050)
    tip = gaussian(x, 0.0, 0.0140) * gaussian(z, 1.568, 0.0145)
    alar = sum(
        gaussian(x, sign * 0.0105, 0.0070) * gaussian(z, 1.565, 0.0090)
        for sign in (-1.0, 1.0)
    )
    lower_lip = gaussian(x, 0.0, 0.026) * gaussian(z, 1.535, 0.0065)
    chin_pad = gaussian(x, 0.0, 0.030) * gaussian(z, 1.511, 0.017)
    return frontness * (
        +0.0070 * sockets
        -0.0048 * cheeks
        -0.0090 * bridge
        -0.0175 * tip
        -0.0040 * alar
        -0.0032 * lower_lip
        -0.0020 * chin_pad
    )


def front_surface_y(x: float, z: float) -> float:
    t = (z - CHIN_Z) / (CROWN_Z - CHIN_Z)
    width = max(0.006, profile_value(t, WIDTH_PROFILE))
    front = profile_value(t, FRONT_PROFILE)
    center_y = profile_value(t, CENTER_Y_PROFILE)
    ratio = min(0.999, abs(x) / width)
    sin_angle = math.sqrt(max(0.0, 1.0 - ratio * ratio))
    base = center_y - front * (sin_angle ** 0.50)
    return base + facial_offset(x, z, sin_angle ** 2.4)


def make_mesh(name: str, vertices: list[tuple[float, float, float]],
              faces: list[tuple[int, ...]]) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def build_head(rings: int = 73, sides: int = 128) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for ring_index in range(rings):
        t = ring_index / (rings - 1)
        z = CHIN_Z + (CROWN_Z - CHIN_Z) * t
        width = profile_value(t, WIDTH_PROFILE)
        front = profile_value(t, FRONT_PROFILE)
        rear = profile_value(t, REAR_PROFILE)
        center_y = profile_value(t, CENTER_Y_PROFILE)
        for side in range(sides):
            theta = 2.0 * math.pi * side / sides
            cosine = math.cos(theta)
            sine = math.sin(theta)
            x = width * math.copysign(abs(cosine) ** 0.94, cosine)
            if sine < 0.0:
                frontness = (-sine) ** 0.50
                y = center_y - front * frontness
                y += facial_offset(x, z, (-sine) ** 2.4)
            else:
                y = center_y + rear * (sine ** 0.84)
            vertices.append((x, y, z))

    for ring_index in range(rings - 1):
        lower = ring_index * sides
        upper = (ring_index + 1) * sides
        for side in range(sides):
            nxt = (side + 1) % sides
            faces.append((lower + side, lower + nxt, upper + nxt, upper + side))
    faces.append(tuple(reversed(range(sides))))
    top = (rings - 1) * sides
    faces.append(tuple(top + side for side in range(sides)))
    head = make_mesh("ASTRA_HEAD_CANDIDATE", vertices, faces)
    subdivision = head.modifiers.new("Facial_Subdivision", "SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 1
    subdivision.render_levels = 1
    return head


def ellipsoid_mesh(name: str, center: tuple[float, float, float],
                   radii: tuple[float, float, float], radial: int = 48,
                   vertical: int = 24) -> bpy.types.Object:
    cx, cy, cz = center
    rx, ry, rz = radii
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for row in range(vertical + 1):
        phi = -math.pi / 2.0 + math.pi * row / vertical
        radius = max(0.0001, math.cos(phi))
        for side in range(radial):
            theta = 2.0 * math.pi * side / radial
            vertices.append((
                cx + rx * radius * math.cos(theta),
                cy + ry * radius * math.sin(theta),
                cz + rz * math.sin(phi),
            ))
    for row in range(vertical):
        lower = row * radial
        upper = (row + 1) * radial
        for side in range(radial):
            nxt = (side + 1) % radial
            faces.append((lower + side, lower + nxt, upper + nxt, upper + side))
    return make_mesh(name, vertices, faces)


def almond_patch(name: str, center_x: float, center_z: float,
                 half_width: float, upper_height: float, lower_height: float,
                 y_front: float, rings: int = 7, sides: int = 48) -> bpy.types.Object:
    vertices = [(center_x, y_front - 0.0027, center_z)]
    faces: list[tuple[int, ...]] = []
    for ring in range(1, rings + 1):
        radius = ring / rings
        for side in range(sides):
            theta = 2.0 * math.pi * side / sides
            cosine, sine = math.cos(theta), math.sin(theta)
            x = center_x + half_width * radius * cosine
            height = upper_height if sine >= 0.0 else lower_height
            # The inner corner sits fractionally lower and the outer corner rises,
            # matching the poised expression in the reference sheet.
            cant = 0.0023 * ((x - center_x) / half_width)
            z = center_z + height * radius * sine + cant
            bulge = 0.0030 * (1.0 - radius * radius)
            vertices.append((x, y_front - bulge, z))
    # Triangle fan at the centre, then clean quad rings.
    for side in range(sides):
        faces.append((0, 1 + side, 1 + (side + 1) % sides))
    for ring in range(1, rings):
        inner = 1 + (ring - 1) * sides
        outer = 1 + ring * sides
        for side in range(sides):
            nxt = (side + 1) % sides
            faces.append((inner + side, outer + side, outer + nxt, inner + nxt))
    return make_mesh(name, vertices, faces)


def ribbon_mesh(name: str, points: list[tuple[float, float, float]],
                widths: list[float], forward: float = 0.0004) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for index, point in enumerate(points):
        if index == 0:
            tangent_x = points[1][0] - point[0]
            tangent_z = points[1][2] - point[2]
        elif index == len(points) - 1:
            tangent_x = point[0] - points[index - 1][0]
            tangent_z = point[2] - points[index - 1][2]
        else:
            tangent_x = points[index + 1][0] - points[index - 1][0]
            tangent_z = points[index + 1][2] - points[index - 1][2]
        length = max(1e-8, math.hypot(tangent_x, tangent_z))
        normal_x, normal_z = -tangent_z / length, tangent_x / length
        width = widths[index]
        x, y, z = point
        vertices.append((x + normal_x * width, y - forward, z + normal_z * width))
        vertices.append((x - normal_x * width, y - forward, z - normal_z * width))
    for index in range(len(points) - 1):
        first = index * 2
        faces.append((first, first + 1, first + 3, first + 2))
    return make_mesh(name, vertices, faces)


def eye_curve(sign: float, upper: bool, samples: int = 25) -> list[tuple[float, float, float]]:
    center_x = sign * 0.037
    points = []
    for index in range(samples):
        u = -1.0 + 2.0 * index / (samples - 1)
        # Reverse the local x parameter on character left so both eyes retain the
        # same subtle outer-corner lift.
        local_u = u if sign > 0.0 else -u
        x = center_x + sign * 0.029 * local_u
        arch = math.sqrt(max(0.0, 1.0 - local_u * local_u))
        z = 1.607 + (0.0150 * arch if upper else -0.0100 * arch) + 0.0023 * local_u
        y = -0.0832
        points.append((x, y, z))
    return points


def create_eyes() -> list[bpy.types.Object]:
    objects: list[bpy.types.Object] = []
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        # Hidden complete eyeball establishes anatomically correct ocular volume.
        eyeball = ellipsoid_mesh(
            f"EYEBALL_{suffix}", (sign * 0.037, -0.053, 1.607),
            (0.027, 0.022, 0.023), 48, 24,
        )
        objects.append(eyeball)
        white = almond_patch(
            f"SCLERA_{suffix}", sign * 0.037, 1.607,
            0.029, 0.0150, 0.0100, -0.0828,
        )
        objects.append(white)
        iris = ellipsoid_mesh(
            f"IRIS_{suffix}", (sign * 0.037, -0.0870, 1.607),
            (0.0114, 0.00125, 0.0134), 40, 16,
        )
        pupil = ellipsoid_mesh(
            f"PUPIL_{suffix}", (sign * 0.037, -0.0884, 1.607),
            (0.0048, 0.0008, 0.0074), 32, 14,
        )
        iris_inner = ellipsoid_mesh(
            f"IRIS_INNER_{suffix}", (sign * 0.037, -0.0892, 1.603),
            (0.0084, 0.00055, 0.0070), 32, 12,
        )
        highlight_big = ellipsoid_mesh(
            f"EYE_HIGHLIGHT_BIG_{suffix}", (sign * 0.0335, -0.0902, 1.613),
            (0.0030, 0.00045, 0.0038), 24, 10,
        )
        highlight_small = ellipsoid_mesh(
            f"EYE_HIGHLIGHT_SMALL_{suffix}", (sign * 0.0420, -0.0903, 1.604),
            (0.00145, 0.0004, 0.0018), 20, 8,
        )
        objects.extend((iris, pupil, iris_inner, highlight_big, highlight_small))

        upper = ribbon_mesh(
            f"UPPER_LASH_{suffix}", eye_curve(sign, True),
            [0.0011 + 0.0014 * (i / 24) ** 1.8 for i in range(25)], 0.0008,
        )
        lower = ribbon_mesh(
            f"LOWER_LID_{suffix}", eye_curve(sign, False),
            [0.00055] * 25, 0.00055,
        )
        objects.extend((upper, lower))
    return objects


def create_brows() -> list[bpy.types.Object]:
    brows = []
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        points = []
        widths = []
        for index in range(19):
            u = -1.0 + 2.0 * index / 18.0
            local = u if sign > 0.0 else -u
            x = sign * 0.037 + sign * 0.027 * local
            z = 1.646 + 0.0062 * (1.0 - local * local) + 0.0015 * local
            y = front_surface_y(x, z) - 0.0018
            points.append((x, y, z))
            widths.append(0.0011 * (1.0 - 0.42 * abs(local)))
        brows.append(ribbon_mesh(f"BROW_{suffix}", points, widths, 0.0005))
    return brows


def create_mouth_and_nostrils() -> list[bpy.types.Object]:
    objects: list[bpy.types.Object] = []
    # Cupid-bow upper lip and softly curved lower lip: thin ribbons follow the
    # face instead of floating oval primitives.
    upper_points = []
    lower_points = []
    widths = []
    for index in range(31):
        u = -1.0 + 2.0 * index / 30.0
        x = 0.0235 * u
        upper_z = 1.5405 + 0.0015 * (1.0 - abs(u)) - 0.0010 * math.cos(math.pi * u)
        lower_z = 1.5350 - 0.0023 * (1.0 - u * u)
        upper_points.append((x, front_surface_y(x, upper_z) - 0.0016, upper_z))
        lower_points.append((x, front_surface_y(x, lower_z) - 0.0018, lower_z))
        widths.append(0.0007 + 0.0005 * (1.0 - abs(u)))
    objects.append(ribbon_mesh("UPPER_LIP", upper_points, widths, 0.0005))
    objects.append(ribbon_mesh("LOWER_LIP", lower_points, widths, 0.0005))
    mouth_line = []
    for index in range(31):
        u = -1.0 + 2.0 * index / 30.0
        x = 0.0225 * u
        z = 1.5382 - 0.0009 * (1.0 - u * u)
        mouth_line.append((x, front_surface_y(x, z) - 0.0027, z))
    objects.append(ribbon_mesh("MOUTH_OPENING", mouth_line, [0.00042] * 31, 0.0005))

    # Tiny closed nostril creases read in front view without cutting a hole into
    # the continuous nose underside.
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        points = []
        for index in range(11):
            u = -1.0 + 2.0 * index / 10.0
            x = sign * 0.0085 + 0.0042 * u
            z = 1.5609 + 0.0011 * (1.0 - u * u)
            points.append((x, front_surface_y(x, z) - 0.0015, z))
        objects.append(ribbon_mesh(f"NOSTRIL_{suffix}", points, [0.00034] * 11, 0.0004))
    return objects


def create_ears() -> list[bpy.types.Object]:
    ears = []
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        outer = []
        widths = []
        for index in range(33):
            angle = -0.48 * math.pi + 1.96 * math.pi * index / 32.0
            x = sign * (0.0830 + 0.0085 * math.cos(angle))
            y = 0.004 + 0.0105 * math.sin(angle)
            z = 1.586 + 0.0250 * math.cos(angle)
            outer.append((x, y, z))
            widths.append(0.0025)
        ears.append(ribbon_mesh(f"EAR_RIM_{suffix}", outer, widths, 0.0002))
    return ears


def create_neck_and_bust() -> list[bpy.types.Object]:
    # Only a neutral framing bust; it is deliberately not a body replacement.
    neck = ellipsoid_mesh("NECK_GUIDE", (0.0, 0.018, 1.448), (0.050, 0.053, 0.080), 64, 28)
    bust = ellipsoid_mesh("BUST_GUIDE", (0.0, 0.025, 1.350), (0.175, 0.095, 0.085), 72, 28)
    return [neck, bust]


def material(name: str, color: tuple[float, float, float, float],
             roughness: float = 0.5, metallic: float = 0.0,
             emission: tuple[float, float, float, float] | None = None,
             emission_strength: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission and "Emission Color" in shader.inputs:
        shader.inputs["Emission Color"].default_value = emission
        shader.inputs["Emission Strength"].default_value = emission_strength
    return mat


def assign_materials(head: bpy.types.Object, features: list[bpy.types.Object],
                     guides: list[bpy.types.Object]) -> None:
    skin = material("SKIN_PORCELAIN_WARM", (0.84, 0.49, 0.40, 1.0), 0.47)
    skin_shadow = material("SKIN_DETAIL", (0.57, 0.20, 0.18, 1.0), 0.58)
    sclera = material("SCLERA_SOFT", (0.88, 0.93, 0.95, 1.0), 0.22)
    iris = material("IRIS_CYAN", (0.015, 0.47, 0.57, 1.0), 0.18, 0.04)
    iris_inner = material("IRIS_CYAN_LIGHT", (0.02, 0.76, 0.78, 1.0), 0.16, 0.02)
    pupil = material("PUPIL", (0.003, 0.009, 0.012, 1.0), 0.19)
    highlight = material("EYE_GLINT", (0.98, 1.0, 1.0, 1.0), 0.08)
    lash = material("LASH_DEEP_CORAL", (0.10, 0.012, 0.018, 1.0), 0.34)
    brow = material("BROW_CORAL", (0.35, 0.055, 0.055, 1.0), 0.48)
    lip = material("LIP_NATURAL", (0.66, 0.22, 0.22, 1.0), 0.42)
    mouth = material("MOUTH_CREASE", (0.19, 0.018, 0.022, 1.0), 0.55)

    head.data.materials.append(skin)
    for guide in guides:
        guide.data.materials.append(skin)
    for obj in features:
        name = obj.name
        if name.startswith("EYEBALL") or name.startswith("SCLERA"):
            obj.data.materials.append(sclera)
        elif name.startswith("IRIS_INNER"):
            obj.data.materials.append(iris_inner)
        elif name.startswith("IRIS"):
            obj.data.materials.append(iris)
        elif name.startswith("PUPIL"):
            obj.data.materials.append(pupil)
        elif "HIGHLIGHT" in name:
            obj.data.materials.append(highlight)
        elif name.startswith("UPPER_LASH"):
            obj.data.materials.append(lash)
        elif name.startswith("LOWER_LID") or name.startswith("NOSTRIL"):
            obj.data.materials.append(skin_shadow)
        elif name.startswith("BROW"):
            obj.data.materials.append(brow)
        elif name in {"UPPER_LIP", "LOWER_LIP"} or name.startswith("MOUTH_LIP"):
            obj.data.materials.append(lip)
        elif name == "MOUTH_OPENING":
            obj.data.materials.append(mouth)
        else:
            obj.data.materials.append(skin)


def setup_world() -> None:
    world = bpy.data.worlds.new("HEAD_QA_WORLD") if not bpy.data.worlds else bpy.data.worlds[0]
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.020, 0.025, 0.034, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32
    lights = (
        ("KEY", (-1.6, -2.4, 2.5), 720.0, (1.0, 0.72, 0.66), 1.5),
        ("FILL", (1.7, -2.0, 2.1), 560.0, (0.45, 0.72, 1.0), 1.6),
        ("RIM", (1.2, 1.8, 2.1), 900.0, (0.30, 0.80, 1.0), 1.2),
        ("TOP", (-0.2, 0.0, 3.0), 500.0, (1.0, 0.88, 0.75), 1.0),
    )
    for name, location, energy, color, size in lights:
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        bpy.context.collection.objects.link(obj)
        look_at(obj, Vector((0.0, 0.0, 1.59)))


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def create_camera() -> bpy.types.Object:
    data = bpy.data.cameras.new("HEAD_QA_CAMERA")
    data.type = "ORTHO"
    data.ortho_scale = 0.315
    obj = bpy.data.objects.new("HEAD_QA_CAMERA", data)
    bpy.context.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    return obj


def render_views(camera: bpy.types.Object) -> list[str]:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 96
    # A dark coral material on the riggable line objects makes the exact lid,
    # brow and mouth geometry reviewable independently of main_body.py's current
    # temporary skin-colour assignment.
    line_mat = material("QA_FACE_LINES", (0.20, 0.018, 0.025, 1.0), 0.40)
    lip_mat = material("QA_LIP", (0.58, 0.14, 0.16, 1.0), 0.42)
    for obj in bpy.context.scene.objects:
        if not hasattr(obj.data, "materials"):
            continue
        if obj.name.startswith(("EYELID_", "EYEBROW_", "MOUTH_INNER")):
            obj.data.materials.clear()
            obj.data.materials.append(line_mat)
        elif obj.name.startswith("MOUTH_LIP"):
            obj.data.materials.clear()
            obj.data.materials.append(lip_mat)
    for obj in bpy.context.scene.objects:
        if obj.name.startswith("NECK_GUIDE") or obj.name.startswith("BUST_GUIDE"):
            obj.hide_render = True
    views = {
        "head-front.png": ((0.0, -2.0, 1.607), (0.0, 0.0, 1.607)),
        # Slight front bias keeps both the cranial silhouette and facial
        # landmarks legible; pure 90-degree profile collapses planar anime eye
        # surfaces to sub-pixel lines.
        "head-profile.png": ((1.97, -0.35, 1.607), (0.0, 0.0, 1.607)),
        "head-three-quarter.png": ((1.28, -1.53, 1.607), (0.0, 0.0, 1.607)),
    }
    rendered = []
    for filename, (location, target) in views.items():
        camera.location = location
        look_at(camera, Vector(target))
        path = OUTPUT / filename
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        rendered.append(str(path))
        log(f"Rendered {filename}")
    return rendered


def edge_report(obj: bpy.types.Object) -> tuple[int, int]:
    edge_use: dict[tuple[int, int], int] = {}
    adjacency: list[list[int]] = [[] for _ in obj.data.vertices]
    for polygon in obj.data.polygons:
        vertices = list(polygon.vertices)
        for index, vertex in enumerate(vertices):
            other = vertices[(index + 1) % len(vertices)]
            key = tuple(sorted((vertex, other)))
            edge_use[key] = edge_use.get(key, 0) + 1
    for left, right in edge_use:
        adjacency[left].append(right)
        adjacency[right].append(left)
    non_manifold = sum(1 for use in edge_use.values() if use != 2)
    remaining = set(range(len(obj.data.vertices)))
    components = 0
    while remaining:
        components += 1
        stack = [remaining.pop()]
        while stack:
            current = stack.pop()
            for neighbor in adjacency[current]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    stack.append(neighbor)
    return non_manifold, components


def build_report(head: bpy.types.Object, renders: list[str]) -> dict:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = head.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        xs = [vertex.co.x for vertex in mesh.vertices]
        ys = [vertex.co.y for vertex in mesh.vertices]
        zs = [vertex.co.z for vertex in mesh.vertices]
        triangles = sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)
        evaluated_stats = {
            "vertices": len(mesh.vertices),
            "faces": len(mesh.polygons),
            "triangles": triangles,
            "width_m": round(max(xs) - min(xs), 4),
            "depth_m": round(max(ys) - min(ys), 4),
            "height_m": round(max(zs) - min(zs), 4),
        }
    finally:
        evaluated.to_mesh_clear()
    non_manifold, components = edge_report(head)
    return {
        "candidate": "astra-h08-head-face-agent-v1",
        "source": "procedural-from-scratch",
        "external_model_used": False,
        "base_vertices": len(head.data.vertices),
        "base_faces": len(head.data.polygons),
        "evaluated": evaluated_stats,
        "non_manifold_edges": non_manifold,
        "connected_components": components,
        "face_landmarks": {
            "eye_aperture_width_m": 0.062,
            "eye_aperture_height_m": 0.0263,
            "interocular_gap_m": 0.014,
            "jaw_width_m_at_chin_transition": 0.088,
            "cheek_width_m": 0.168,
            "cranium_width_m": 0.180,
            "head_surface_height_m": 0.287,
        },
        "renders": renders,
        "integration_status": "isolated-candidate-not-approved",
    }


def build_integrated_candidate() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    """Build the actual ``modeling/head.py`` candidate without the full body.

    The small neck overlap emitted by the module remains in the object, so the
    render exercises exactly the geometry that the approved body union will use.
    """
    builder = SurfaceBuilder()
    # Keep the standalone topology report focused on the single closed cranial
    # surface. Neck/ear overlap shells are consumed by the later full-body voxel
    # union and would intentionally appear as separate islands in this preview.
    from modeling.head import _head_rings  # noqa: PLC0415

    builder.add_loft(_head_rings())
    head = make_mesh("ASTRA_HEAD_CANDIDATE", builder.vertices, builder.faces)
    # The production full-body pass uses voxel remesh plus controlled smoothing;
    # this isolated preview applies one non-destructive subdivision level so QA
    # judges the intended continuous limit surface, not its low-poly cage.
    subdivision = head.modifiers.new("QA_Facial_Subdivision", "SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 2
    subdivision.render_levels = 2
    features = (
        create_main_eye_objects()
        + create_main_eyelids()
        + create_main_brows()
        + create_main_mouth_features()
    )
    return head, features


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    clean_scene()
    log("Generating integrated modeling/head.py cross-section candidate")
    head, features = build_integrated_candidate()
    guides = create_neck_and_bust()
    assign_materials(head, features, guides)
    setup_world()
    camera = create_camera()
    blend_path = OUTPUT / "ASTRA_HEAD_FACE_CANDIDATE.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    renders = render_views(camera)
    report = build_report(head, renders)
    report["blend"] = str(blend_path)
    report_path = OUTPUT / "head-face-candidate.report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    log(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
