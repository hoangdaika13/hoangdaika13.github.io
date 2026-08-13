"""Procedural hard-surface armor for Astra H-08.

This phase deliberately owns only objects in :data:`ASTRA_ARMOR`.  It reads the
approved humanoid bounds to place a fitted 1.70 m design, but never duplicates,
edits, remeshes, or adds modifiers to ``BODY_CONTINUOUS``.  Every armor part is
constructed from explicit vertices/faces; no external model or primitive mesh
operator is used.

The design follows the supplied Astra sheet: layered ivory shells over a black
technical suit, coral structural accents, charcoal joints/vents, and restrained
cyan luminous details.  Major regions stay separate and meaningfully named so a
later rigging phase can give armor rigid weights where appropriate.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

import bpy
from mathutils import Vector

from modeling.geometry import (
    add_bevel,
    add_weighted_normals,
    assign_material,
    clear_collection,
    create_tapered_box,
    ensure_collection,
    mesh_object,
)


COLLECTION_NAME = "ASTRA_ARMOR"
BODY_NAME = "BODY_CONTINUOUS"
REFERENCE_HEIGHT = 1.70


@dataclass(frozen=True)
class _DesignFrame:
    """Uniform, upright design frame measured from the approved body bounds."""

    origin: Vector
    scale: float

    def point(self, coordinate: Sequence[float]) -> tuple[float, float, float]:
        return tuple(self.origin + Vector(coordinate) * self.scale)

    def distance(self, value: float) -> float:
        return value * self.scale


def _body_frame(body: bpy.types.Object) -> _DesignFrame:
    if body.type != "MESH":
        raise TypeError(f"{body.name} must be a mesh")
    corners = [body.matrix_world @ Vector(corner) for corner in body.bound_box]
    minimum = Vector((min(p.x for p in corners), min(p.y for p in corners), min(p.z for p in corners)))
    maximum = Vector((max(p.x for p in corners), max(p.y for p in corners), max(p.z for p in corners)))
    height = maximum.z - minimum.z
    if height <= 0.001:
        raise RuntimeError(f"{body.name} has invalid bounds for armor fitting")

    # Feet extend forward and gluteal volume extends back, so a whole-body Y
    # midpoint is a poor torso anchor.  Read a central rib/waist slice instead;
    # this is measurement only and never mutates the mesh.
    center_x = 0.5 * (minimum.x + maximum.x)
    torso_samples: list[Vector] = []
    for vertex in body.data.vertices:
        point = body.matrix_world @ vertex.co
        nz = (point.z - minimum.z) / height
        if 0.57 <= nz <= 0.84 and abs(point.x - center_x) <= height * 0.15:
            torso_samples.append(point)
    if torso_samples:
        center_y = 0.5 * (min(p.y for p in torso_samples) + max(p.y for p in torso_samples))
    else:
        center_y = 0.5 * (minimum.y + maximum.y)
    return _DesignFrame(Vector((center_x, center_y, minimum.z)), height / REFERENCE_HEIGHT)


def _material(
    materials: Mapping[str, bpy.types.Material] | None,
    name: str,
) -> bpy.types.Material | None:
    if materials and name in materials:
        return materials[name]
    return bpy.data.materials.get(name)


def _decorate(
    obj: bpy.types.Object,
    material: bpy.types.Material | None,
    *,
    region: str,
    material_role: str,
    source_body: str,
    bevel: float,
) -> bpy.types.Object:
    assign_material(obj, material)
    if bevel > 0.0:
        add_bevel(obj, width=bevel, segments=3, angle_degrees=28.0)
    add_weighted_normals(obj)
    obj["astra_phase"] = "05_armor"
    obj["armor_region"] = region
    obj["material_role"] = material_role
    obj["source_body"] = source_body
    obj["procedural_geometry"] = True
    return obj


def _polygon_normal(points: Sequence[Vector]) -> Vector:
    zero = Vector((0.0, 0.0, 0.0))
    center = sum(points, zero) / len(points)
    normal = Vector((0.0, 0.0, 0.0))
    for index, point in enumerate(points):
        normal += (point - center).cross(points[(index + 1) % len(points)] - center)
    return normal.normalized() if normal.length > 1.0e-8 else Vector((0.0, 0.0, 0.0))


def _panel(
    name: str,
    outline: Sequence[Sequence[float]],
    outward_normal: Sequence[float],
    thickness: float,
    frame: _DesignFrame,
    collection: bpy.types.Collection,
    material: bpy.types.Material | None,
    *,
    region: str,
    material_role: str,
    source_body: str,
    bevel: float = 0.003,
) -> bpy.types.Object:
    """Create a closed, beveled plate from an arbitrary planar polygon."""
    if len(outline) < 3:
        raise ValueError(f"{name} panel needs at least three outline points")
    outer = [Vector(frame.point(point)) for point in outline]
    normal = Vector(outward_normal).normalized()
    if _polygon_normal(outer).dot(normal) < 0.0:
        outer.reverse()
    inner = [point - normal * frame.distance(thickness) for point in outer]
    vertices = [tuple(point) for point in (*outer, *inner)]
    count = len(outer)
    faces: list[tuple[int, ...]] = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    obj = mesh_object(name, vertices, faces, collection)
    return _decorate(
        obj,
        material,
        region=region,
        material_role=material_role,
        source_body=source_body,
        bevel=frame.distance(bevel),
    )


def _box(
    name: str,
    center: Sequence[float],
    size: Sequence[float],
    frame: _DesignFrame,
    collection: bpy.types.Collection,
    material: bpy.types.Material | None,
    *,
    region: str,
    material_role: str,
    source_body: str,
    top_scale: tuple[float, float] = (1.0, 1.0),
    front_shift: float = 0.0,
    bevel: float = 0.003,
) -> bpy.types.Object:
    obj = create_tapered_box(
        name,
        frame.point(center),
        tuple(frame.distance(component) for component in size),
        collection,
        top_scale=top_scale,
        front_shift=frame.distance(front_shift),
    )
    return _decorate(
        obj,
        material,
        region=region,
        material_role=material_role,
        source_body=source_body,
        bevel=frame.distance(bevel),
    )


def _badge(
    name: str,
    center: Sequence[float],
    outward_normal: Sequence[float],
    radius: float,
    thickness: float,
    frame: _DesignFrame,
    collection: bpy.types.Collection,
    material: bpy.types.Material | None,
    *,
    region: str,
    material_role: str,
    source_body: str,
    sides: int = 6,
    bevel: float = 0.0015,
) -> bpy.types.Object:
    normal = Vector(outward_normal).normalized()
    reference = Vector((0.0, 0.0, 1.0))
    if abs(normal.dot(reference)) > 0.92:
        reference = Vector((0.0, 1.0, 0.0))
    axis_a = reference.cross(normal).normalized()
    axis_b = normal.cross(axis_a).normalized()
    center_vector = Vector(center)
    outline = []
    for index in range(sides):
        angle = 2.0 * math.pi * index / sides + math.pi / sides
        point = center_vector + axis_a * (radius * math.cos(angle)) + axis_b * (radius * math.sin(angle))
        outline.append(tuple(point))
    return _panel(
        name,
        outline,
        outward_normal,
        thickness,
        frame,
        collection,
        material,
        region=region,
        material_role=material_role,
        source_body=source_body,
        bevel=bevel,
    )


def _swept_shell(
    name: str,
    centers: Sequence[Sequence[float]],
    radii: Sequence[tuple[float, float]],
    thickness: float,
    frame: _DesignFrame,
    collection: bpy.types.Collection,
    material: bpy.types.Material | None,
    *,
    region: str,
    material_role: str,
    source_body: str,
    angle_start: float = 0.0,
    angle_end: float = 2.0 * math.pi,
    sides: int = 16,
    closed: bool = True,
    bevel: float = 0.0025,
) -> bpy.types.Object:
    """Build a hollow loft used for collars, belts, straps, cuffs and bracers."""
    if len(centers) < 2 or len(centers) != len(radii):
        raise ValueError(f"{name} shell requires matching center/radius sections")
    points = [Vector(frame.point(point)) for point in centers]
    scaled_radii = [(frame.distance(rx), frame.distance(ry)) for rx, ry in radii]
    wall = frame.distance(thickness)
    sample_count = max(6, sides)
    if closed:
        angles = [2.0 * math.pi * index / sample_count for index in range(sample_count)]
    else:
        angles = [
            angle_start + (angle_end - angle_start) * index / (sample_count - 1)
            for index in range(sample_count)
        ]

    outer: list[tuple[float, float, float]] = []
    inner: list[tuple[float, float, float]] = []
    for section, (center, (radius_u, radius_v)) in enumerate(zip(points, scaled_radii)):
        if section == 0:
            tangent = (points[1] - center).normalized()
        elif section == len(points) - 1:
            tangent = (center - points[section - 1]).normalized()
        else:
            tangent = (points[section + 1] - points[section - 1]).normalized()
        reference = Vector((0.0, 1.0, 0.0))
        if abs(tangent.dot(reference)) > 0.92:
            reference = Vector((1.0, 0.0, 0.0))
        axis_u = reference.cross(tangent).normalized()
        axis_v = tangent.cross(axis_u).normalized()
        inner_u = max(frame.distance(0.002), radius_u - wall)
        inner_v = max(frame.distance(0.002), radius_v - wall)
        for angle in angles:
            outer.append(tuple(center + axis_u * (radius_u * math.cos(angle)) + axis_v * (radius_v * math.sin(angle))))
            inner.append(tuple(center + axis_u * (inner_u * math.cos(angle)) + axis_v * (inner_v * math.sin(angle))))

    ring = len(angles)
    section_count = len(points)
    vertices = [*outer, *inner]
    inner_offset = len(outer)
    faces: list[tuple[int, ...]] = []
    radial_edges = ring if closed else ring - 1
    for section in range(section_count - 1):
        for radial in range(radial_edges):
            nxt = (radial + 1) % ring
            a = section * ring + radial
            b = section * ring + nxt
            c = (section + 1) * ring + nxt
            d = (section + 1) * ring + radial
            faces.append((a, b, c, d))
            faces.append((inner_offset + d, inner_offset + c, inner_offset + b, inner_offset + a))

    if not closed:
        for radial in (0, ring - 1):
            for section in range(section_count - 1):
                a = section * ring + radial
                b = (section + 1) * ring + radial
                faces.append((a, b, inner_offset + b, inner_offset + a))

    for radial in range(radial_edges):
        nxt = (radial + 1) % ring
        a, b = radial, nxt
        faces.append((a, inner_offset + a, inner_offset + b, b))
        a = (section_count - 1) * ring + radial
        b = (section_count - 1) * ring + nxt
        faces.append((a, b, inner_offset + b, inner_offset + a))

    obj = mesh_object(name, vertices, faces, collection)
    return _decorate(
        obj,
        material,
        region=region,
        material_role=material_role,
        source_body=source_body,
        bevel=frame.distance(bevel),
    )


def _signed_power(value: float, exponent: float) -> float:
    return math.copysign(abs(value) ** exponent, value)


def _boot_volume(
    name: str,
    center_x: float,
    sections: Sequence[tuple[float, float, float, float]],
    frame: _DesignFrame,
    collection: bpy.types.Collection,
    material: bpy.types.Material | None,
    *,
    region: str,
    material_role: str,
    source_body: str,
    bevel: float,
    sides: int = 12,
) -> bpy.types.Object:
    """Loft angular x/z rings along Y for a tapered heel, arch and toe box."""
    rings: list[list[tuple[float, float, float]]] = []
    for y, z, half_width, half_height in sections:
        ring = []
        for index in range(sides):
            angle = 2.0 * math.pi * index / sides
            x = center_x + half_width * _signed_power(math.cos(angle), 0.72)
            rz = half_height * _signed_power(math.sin(angle), 0.72)
            ring.append(frame.point((x, y, z + rz)))
        rings.append(ring)
    vertices = [vertex for ring in rings for vertex in ring]
    faces: list[tuple[int, ...]] = []
    for section in range(len(rings) - 1):
        first = section * sides
        second = (section + 1) * sides
        for radial in range(sides):
            nxt = (radial + 1) % sides
            faces.append((first + radial, first + nxt, second + nxt, second + radial))
    faces.append(tuple(reversed(range(sides))))
    last = (len(rings) - 1) * sides
    faces.append(tuple(last + index for index in range(sides)))
    obj = mesh_object(name, vertices, faces, collection)
    return _decorate(
        obj,
        material,
        region=region,
        material_role=material_role,
        source_body=source_body,
        bevel=frame.distance(bevel),
    )


def _side_pairs() -> tuple[tuple[str, float], tuple[str, float]]:
    return (("L", -1.0), ("R", 1.0))


def _build_chest(
    frame: _DesignFrame,
    collection: bpy.types.Collection,
    materials: Mapping[str, bpy.types.Material] | None,
    source_body: str,
) -> list[bpy.types.Object]:
    white = _material(materials, "ARMOR_WHITE")
    red = _material(materials, "ARMOR_RED")
    dark = _material(materials, "METAL_DARK")
    cyan = _material(materials, "EMISSION_CYAN")
    objects: list[bpy.types.Object] = []

    # High rear collar protects the neck while preserving the open black front.
    objects.append(_swept_shell(
        "NECK_ARMOR_COLLAR",
        [(0.0, 0.008, 1.425), (0.0, 0.009, 1.493)],
        [(0.102, 0.090), (0.107, 0.096)],
        0.012,
        frame,
        collection,
        white,
        region="neck_collar",
        material_role="ARMOR_WHITE",
        source_body=source_body,
        angle_start=math.radians(-20.0),
        angle_end=math.radians(200.0),
        sides=18,
        closed=False,
        bevel=0.003,
    ))
    objects.append(_swept_shell(
        "NECK_ARMOR_DARK_GASKET",
        [(0.0, 0.006, 1.421), (0.0, 0.007, 1.455)],
        [(0.094, 0.083), (0.096, 0.085)],
        0.008,
        frame,
        collection,
        dark,
        region="neck_collar",
        material_role="METAL_DARK",
        source_body=source_body,
        angle_start=math.radians(-42.0),
        angle_end=math.radians(222.0),
        sides=18,
        closed=False,
        bevel=0.0015,
    ))

    for side, sign in _side_pairs():
        # Breast/side shell leaves the sternum black, matching the sheet's strong
        # central bodysuit column and layered ivory cups.
        shell = [
            (sign * 0.036, -0.151, 1.194),
            (sign * 0.083, -0.166, 1.170),
            (sign * 0.157, -0.158, 1.199),
            (sign * 0.176, -0.128, 1.286),
            (sign * 0.162, -0.125, 1.371),
            (sign * 0.111, -0.139, 1.406),
            (sign * 0.061, -0.150, 1.389),
        ]
        objects.append(_panel(
            f"CHEST_ARMOR_SIDE_{side}", shell, (0.0, -1.0, 0.0), 0.014,
            frame, collection, white,
            region="chest_side", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.004,
        ))
        objects.append(_panel(
            f"CHEST_ARMOR_RED_RAIL_{side}",
            [
                (sign * 0.043, -0.169, 1.205),
                (sign * 0.058, -0.170, 1.205),
                (sign * 0.075, -0.169, 1.374),
                (sign * 0.060, -0.169, 1.389),
            ],
            (0.0, -1.0, 0.0), 0.006,
            frame, collection, red,
            region="chest_accent", material_role="ARMOR_RED", source_body=source_body,
            bevel=0.0018,
        ))
        objects.append(_panel(
            f"CLAVICLE_ARMOR_{side}",
            [
                (sign * 0.057, -0.132, 1.390),
                (sign * 0.116, -0.130, 1.423),
                (sign * 0.172, -0.103, 1.397),
                (sign * 0.166, -0.112, 1.358),
                (sign * 0.112, -0.142, 1.372),
            ],
            (0.0, -1.0, 0.15), 0.012,
            frame, collection, white,
            region="clavicle", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.0035,
        ))
        objects.append(_panel(
            f"RIB_ARMOR_SIDE_{side}",
            [
                (sign * 0.205, -0.104, 1.172),
                (sign * 0.215, -0.066, 1.145),
                (sign * 0.218, 0.054, 1.185),
                (sign * 0.214, 0.082, 1.282),
                (sign * 0.205, -0.031, 1.318),
            ],
            (sign, 0.0, 0.0), 0.012,
            frame, collection, white,
            region="chest_side", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.003,
        ))
        objects.append(_panel(
            f"RIB_DARK_VENT_{side}",
            [
                (sign * 0.220, -0.020, 1.200),
                (sign * 0.221, 0.032, 1.216),
                (sign * 0.221, 0.041, 1.249),
                (sign * 0.220, -0.015, 1.236),
            ],
            (sign, 0.0, 0.0), 0.005,
            frame, collection, dark,
            region="chest_vent", material_role="METAL_DARK", source_body=source_body,
            bevel=0.0015,
        ))
        objects.append(_panel(
            f"BACK_SCAPULA_ARMOR_{side}",
            [
                (sign * 0.044, 0.142, 1.225),
                (sign * 0.119, 0.153, 1.204),
                (sign * 0.194, 0.132, 1.274),
                (sign * 0.183, 0.126, 1.376),
                (sign * 0.095, 0.137, 1.406),
            ],
            (0.0, 1.0, 0.0), 0.011,
            frame, collection, white,
            region="upper_back", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.003,
        ))
        objects.append(_badge(
            f"COLLAR_CYAN_NODE_{side}",
            (sign * 0.082, -0.158, 1.399), (0.0, -1.0, 0.0), 0.014, 0.005,
            frame, collection, cyan,
            region="chest_light", material_role="EMISSION_CYAN", source_body=source_body,
            sides=5,
        ))

    objects.append(_badge(
        "CHEST_REACTOR_HOUSING", (0.0, -0.164, 1.390), (0.0, -1.0, 0.0), 0.031, 0.009,
        frame, collection, dark,
        region="chest_device", material_role="METAL_DARK", source_body=source_body,
        sides=6, bevel=0.002,
    ))
    objects.append(_badge(
        "CHEST_REACTOR_CYAN", (0.0, -0.176, 1.390), (0.0, -1.0, 0.0), 0.016, 0.004,
        frame, collection, cyan,
        region="chest_light", material_role="EMISSION_CYAN", source_body=source_body,
        sides=6, bevel=0.001,
    ))
    return objects


def _build_arms(
    frame: _DesignFrame,
    collection: bpy.types.Collection,
    materials: Mapping[str, bpy.types.Material] | None,
    source_body: str,
) -> list[bpy.types.Object]:
    white = _material(materials, "ARMOR_WHITE")
    red = _material(materials, "ARMOR_RED")
    dark = _material(materials, "METAL_DARK")
    cyan = _material(materials, "EMISSION_CYAN")
    objects: list[bpy.types.Object] = []

    for side, sign in _side_pairs():
        # The pauldron is a two-plane wrap, not a rounded primitive: a broad front
        # plate and a deeper outer plate meet along a beveled mechanical ridge.
        objects.append(_panel(
            f"SHOULDER_ARMOR_FRONT_{side}",
            [
                (sign * 0.168, -0.078, 1.360),
                (sign * 0.195, -0.086, 1.380),
                (sign * 0.242, -0.073, 1.342),
                (sign * 0.242, -0.077, 1.270),
                (sign * 0.218, -0.083, 1.225),
                (sign * 0.190, -0.076, 1.247),
            ],
            (0.0, -1.0, 0.0), 0.014,
            frame, collection, white,
            region="shoulder", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.004,
        ))
        objects.append(_panel(
            f"SHOULDER_ARMOR_OUTER_{side}",
            [
                (sign * 0.243, -0.067, 1.342),
                (sign * 0.252, -0.026, 1.314),
                (sign * 0.247, 0.067, 1.302),
                (sign * 0.231, 0.080, 1.239),
                (sign * 0.216, -0.070, 1.222),
            ],
            (sign, 0.0, 0.0), 0.014,
            frame, collection, white,
            region="shoulder", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.004,
        ))
        objects.append(_panel(
            f"SHOULDER_RED_EDGE_{side}",
            [
                (sign * 0.235, -0.095, 1.218),
                (sign * 0.254, -0.091, 1.232),
                (sign * 0.264, -0.088, 1.311),
                (sign * 0.251, -0.090, 1.318),
            ],
            (0.0, -1.0, 0.0), 0.006,
            frame, collection, red,
            region="shoulder_accent", material_role="ARMOR_RED", source_body=source_body,
            bevel=0.0015,
        ))
        objects.append(_panel(
            f"SHOULDER_DARK_VENT_{side}",
            [
                (sign * 0.279, -0.025, 1.274),
                (sign * 0.280, 0.030, 1.278),
                (sign * 0.278, 0.038, 1.300),
                (sign * 0.279, -0.020, 1.299),
            ],
            (sign, 0.0, 0.0), 0.005,
            frame, collection, dark,
            region="shoulder_vent", material_role="METAL_DARK", source_body=source_body,
            bevel=0.001,
        ))
        objects.append(_badge(
            f"SHOULDER_CYAN_STATUS_{side}",
            (sign * 0.282, -0.042, 1.328), (sign, 0.0, 0.0), 0.010, 0.004,
            frame, collection, cyan,
            region="shoulder_light", material_role="EMISSION_CYAN", source_body=source_body,
            sides=4, bevel=0.001,
        ))

        # Charcoal bracer wraps the forearm. Ivory and coral rails are separate
        # hard plates so they can be assigned rigid weights later.
        arm_centers = [
            (sign * 0.264, -0.006, 1.090),
            (sign * 0.279, -0.011, 1.020),
            (sign * 0.294, -0.016, 0.940),
            (sign * 0.303, -0.019, 0.865),
        ]
        objects.append(_swept_shell(
            f"FOREARM_GUARD_DARK_{side}", arm_centers,
            [(0.059, 0.062), (0.057, 0.059), (0.050, 0.052), (0.043, 0.045)],
            0.010,
            frame, collection, dark,
            region="forearm", material_role="METAL_DARK", source_body=source_body,
            sides=16, closed=True, bevel=0.002,
        ))
        objects.append(_panel(
            f"ARM_ARMOR_FOREARM_OUTER_{side}",
            [
                (sign * 0.322, -0.035, 1.074),
                (sign * 0.330, 0.027, 1.048),
                (sign * 0.337, 0.024, 0.912),
                (sign * 0.322, -0.038, 0.858),
                (sign * 0.299, -0.052, 0.890),
                (sign * 0.294, -0.050, 1.028),
            ],
            (sign, -0.08, 0.0), 0.012,
            frame, collection, white,
            region="forearm", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.003,
        ))
        objects.append(_panel(
            f"FOREARM_RED_RAIL_{side}",
            [
                (sign * 0.276, -0.075, 1.045),
                (sign * 0.291, -0.073, 1.047),
                (sign * 0.319, -0.064, 0.885),
                (sign * 0.304, -0.066, 0.875),
            ],
            (0.0, -1.0, 0.0), 0.006,
            frame, collection, red,
            region="forearm_accent", material_role="ARMOR_RED", source_body=source_body,
            bevel=0.0015,
        ))
        objects.append(_badge(
            f"ELBOW_ARMOR_CAP_{side}",
            (sign * 0.330, 0.0, 1.075), (sign, 0.0, 0.0), 0.035, 0.010,
            frame, collection, white,
            region="elbow", material_role="ARMOR_WHITE", source_body=source_body,
            sides=6, bevel=0.0025,
        ))
        objects.append(_badge(
            f"FOREARM_CYAN_STATUS_{side}",
            (sign * 0.339, -0.018, 0.952), (sign, 0.0, 0.0), 0.010, 0.004,
            frame, collection, cyan,
            region="forearm_light", material_role="EMISSION_CYAN", source_body=source_body,
            sides=4, bevel=0.001,
        ))

        hand_centers = [
            (sign * 0.304, -0.019, 0.847),
            (sign * 0.309, -0.023, 0.793),
            (sign * 0.314, -0.027, 0.742),
        ]
        objects.append(_swept_shell(
            f"GLOVES_SHELL_{side}", hand_centers,
            [(0.039, 0.040), (0.042, 0.037), (0.039, 0.032)],
            0.008,
            frame, collection, dark,
            region="glove", material_role="METAL_DARK", source_body=source_body,
            sides=14, closed=True, bevel=0.0015,
        ))
        objects.append(_swept_shell(
            f"GLOVES_RED_CUFF_{side}",
            [hand_centers[0], hand_centers[1]],
            [(0.044, 0.044), (0.044, 0.041)],
            0.006,
            frame, collection, red,
            region="glove_cuff", material_role="ARMOR_RED", source_body=source_body,
            sides=14, closed=True, bevel=0.0015,
        ))
        objects.append(_panel(
            f"HAND_GUARD_{side}",
            [
                (sign * 0.281, -0.063, 0.815),
                (sign * 0.337, -0.064, 0.810),
                (sign * 0.346, -0.058, 0.753),
                (sign * 0.315, -0.058, 0.724),
                (sign * 0.283, -0.059, 0.752),
            ],
            (0.0, -1.0, 0.0), 0.009,
            frame, collection, white,
            region="hand_guard", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.0025,
        ))
        objects.append(_badge(
            f"HAND_GUARD_CYAN_{side}",
            (sign * 0.314, -0.074, 0.772), (0.0, -1.0, 0.0), 0.010, 0.003,
            frame, collection, cyan,
            region="hand_light", material_role="EMISSION_CYAN", source_body=source_body,
            sides=3, bevel=0.0008,
        ))
    return objects


def _build_waist_and_thighs(
    frame: _DesignFrame,
    collection: bpy.types.Collection,
    materials: Mapping[str, bpy.types.Material] | None,
    source_body: str,
) -> list[bpy.types.Object]:
    white = _material(materials, "ARMOR_WHITE")
    red = _material(materials, "ARMOR_RED")
    dark = _material(materials, "METAL_DARK")
    cyan = _material(materials, "EMISSION_CYAN")
    objects: list[bpy.types.Object] = []

    objects.append(_swept_shell(
        "WAIST_ARMOR_BELT_DARK_BASE",
        [(0.0, 0.008, 0.982), (0.0, 0.004, 1.030)],
        [(0.204, 0.144), (0.184, 0.130)],
        0.012,
        frame, collection, dark,
        region="waist_belt", material_role="METAL_DARK", source_body=source_body,
        sides=24, closed=True, bevel=0.002,
    ))
    objects.append(_swept_shell(
        "WAIST_ARMOR_BELT_RED_FRONT",
        [(0.0, 0.005, 0.997), (0.0, 0.004, 1.021)],
        [(0.210, 0.151), (0.193, 0.138)],
        0.006,
        frame, collection, red,
        region="waist_belt", material_role="ARMOR_RED", source_body=source_body,
        angle_start=math.radians(-151.0), angle_end=math.radians(-29.0),
        sides=14, closed=False, bevel=0.0015,
    ))
    objects.append(_box(
        "BELT_BUCKLE_HOUSING", (0.0, -0.159, 1.010), (0.064, 0.020, 0.050),
        frame, collection, dark,
        region="waist_buckle", material_role="METAL_DARK", source_body=source_body,
        top_scale=(0.82, 0.95), bevel=0.003,
    ))
    objects.append(_badge(
        "BELT_BUCKLE_CYAN", (0.0, -0.172, 1.011), (0.0, -1.0, 0.0), 0.014, 0.004,
        frame, collection, cyan,
        region="waist_light", material_role="EMISSION_CYAN", source_body=source_body,
        sides=4, bevel=0.001,
    ))

    for side, sign in _side_pairs():
        objects.append(_box(
            f"WAIST_ARMOR_POD_{side}", (sign * 0.202, -0.018, 1.001), (0.070, 0.075, 0.083),
            frame, collection, white,
            region="waist_pod", material_role="ARMOR_WHITE", source_body=source_body,
            top_scale=(0.78, 0.86), front_shift=-0.004, bevel=0.004,
        ))
        objects.append(_badge(
            f"WAIST_POD_CYAN_{side}",
            (sign * 0.239, -0.052, 1.004), (sign, -0.2, 0.0), 0.009, 0.003,
            frame, collection, cyan,
            region="waist_light", material_role="EMISSION_CYAN", source_body=source_body,
            sides=4, bevel=0.0008,
        ))
        objects.append(_panel(
            f"HIP_ARMOR_FRONT_{side}",
            [
                (sign * 0.115, -0.143, 0.972),
                (sign * 0.196, -0.139, 0.955),
                (sign * 0.227, -0.112, 0.856),
                (sign * 0.210, -0.105, 0.782),
                (sign * 0.165, -0.117, 0.805),
                (sign * 0.135, -0.134, 0.888),
            ],
            (0.0, -1.0, 0.0), 0.014,
            frame, collection, white,
            region="hip", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.004,
        ))
        objects.append(_panel(
            f"HIP_ARMOR_OUTER_{side}",
            [
                (sign * 0.224, -0.103, 0.947),
                (sign * 0.236, -0.050, 0.925),
                (sign * 0.237, 0.073, 0.866),
                (sign * 0.222, 0.083, 0.776),
                (sign * 0.207, -0.103, 0.782),
            ],
            (sign, 0.0, 0.0), 0.013,
            frame, collection, white,
            region="hip", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.004,
        ))
        objects.append(_panel(
            f"HIP_RED_EDGE_{side}",
            [
                (sign * 0.128, -0.158, 0.955),
                (sign * 0.143, -0.157, 0.959),
                (sign * 0.184, -0.145, 0.819),
                (sign * 0.168, -0.147, 0.810),
            ],
            (0.0, -1.0, 0.0), 0.005,
            frame, collection, red,
            region="hip_accent", material_role="ARMOR_RED", source_body=source_body,
            bevel=0.0013,
        ))
        objects.append(_panel(
            f"LEG_ARMOR_THIGH_OUTER_{side}",
            [
                (sign * 0.225, -0.055, 0.778),
                (sign * 0.235, -0.012, 0.742),
                (sign * 0.226, 0.055, 0.620),
                (sign * 0.204, 0.063, 0.596),
                (sign * 0.194, -0.059, 0.655),
            ],
            (sign, 0.0, 0.0), 0.010,
            frame, collection, white,
            region="thigh_panel", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.003,
        ))
        leg_x = sign * 0.141
        objects.append(_swept_shell(
            f"THIGH_STRAP_DARK_{side}",
            [(leg_x, 0.002, 0.692), (leg_x, 0.002, 0.735)],
            [(0.101, 0.110), (0.102, 0.111)],
            0.008,
            frame, collection, dark,
            region="thigh_strap", material_role="METAL_DARK", source_body=source_body,
            sides=18, closed=True, bevel=0.0015,
        ))
        objects.append(_swept_shell(
            f"THIGH_STRAP_RED_FRONT_{side}",
            [(leg_x, 0.0, 0.699), (leg_x, 0.0, 0.724)],
            [(0.106, 0.116), (0.106, 0.116)],
            0.005,
            frame, collection, red,
            region="thigh_strap", material_role="ARMOR_RED", source_body=source_body,
            angle_start=math.radians(-148.0), angle_end=math.radians(-32.0),
            sides=12, closed=False, bevel=0.001,
        ))
        objects.append(_badge(
            f"THIGH_STRAP_BUCKLE_{side}",
            (sign * 0.239, -0.038, 0.711), (sign, -0.1, 0.0), 0.013, 0.006,
            frame, collection, white,
            region="thigh_buckle", material_role="ARMOR_WHITE", source_body=source_body,
            sides=4, bevel=0.0015,
        ))
        objects.append(_panel(
            f"HIP_CYAN_CHANNEL_{side}",
            [
                (sign * 0.199, -0.130, 0.895),
                (sign * 0.207, -0.128, 0.894),
                (sign * 0.211, -0.121, 0.831),
                (sign * 0.203, -0.123, 0.828),
            ],
            (0.0, -1.0, 0.0), 0.004,
            frame, collection, cyan,
            region="hip_light", material_role="EMISSION_CYAN", source_body=source_body,
            bevel=0.001,
        ))

    # Back utility mount and one asymmetrical hanging coral service strap echo the
    # sheet without requiring a downloaded pouch or kitbash asset.
    objects.append(_box(
        "ACCESSORIES_UTILITY_BACK_MODULE", (0.0, 0.160, 0.987), (0.100, 0.040, 0.072),
        frame, collection, white,
        region="utility_accessory", material_role="ARMOR_WHITE", source_body=source_body,
        top_scale=(0.82, 0.90), bevel=0.004,
    ))
    objects.append(_box(
        "ACCESSORIES_UTILITY_DROP_STRAP_R", (0.205, 0.113, 0.785), (0.027, 0.018, 0.225),
        frame, collection, red,
        region="utility_accessory", material_role="ARMOR_RED", source_body=source_body,
        top_scale=(0.86, 1.0), bevel=0.002,
    ))
    objects.append(_badge(
        "ACCESSORIES_UTILITY_BACK_CYAN", (0.0, 0.183, 0.989), (0.0, 1.0, 0.0), 0.012, 0.004,
        frame, collection, cyan,
        region="utility_light", material_role="EMISSION_CYAN", source_body=source_body,
        sides=4, bevel=0.001,
    ))
    return objects


def _build_legs_and_boots(
    frame: _DesignFrame,
    collection: bpy.types.Collection,
    materials: Mapping[str, bpy.types.Material] | None,
    source_body: str,
) -> list[bpy.types.Object]:
    white = _material(materials, "ARMOR_WHITE")
    red = _material(materials, "ARMOR_RED")
    dark = _material(materials, "METAL_DARK")
    cyan = _material(materials, "EMISSION_CYAN")
    objects: list[bpy.types.Object] = []

    for side, sign in _side_pairs():
        leg_x = sign * 0.139
        objects.append(_swept_shell(
            f"KNEE_JOINT_DARK_{side}",
            [(leg_x, -0.003, 0.438), (leg_x, -0.004, 0.498)],
            [(0.071, 0.078), (0.073, 0.081)],
            0.008,
            frame, collection, dark,
            region="knee", material_role="METAL_DARK", source_body=source_body,
            sides=16, closed=True, bevel=0.0015,
        ))
        objects.append(_panel(
            f"KNEE_ARMOR_CAP_{side}",
            [
                (sign * 0.090, -0.092, 0.474),
                (sign * 0.108, -0.096, 0.515),
                (sign * 0.167, -0.096, 0.522),
                (sign * 0.190, -0.091, 0.477),
                (sign * 0.171, -0.094, 0.430),
                (sign * 0.110, -0.094, 0.430),
            ],
            (0.0, -1.0, 0.0), 0.012,
            frame, collection, white,
            region="knee", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.0035,
        ))
        objects.append(_badge(
            f"KNEE_CYAN_MARKER_{side}",
            (leg_x, -0.108, 0.472), (0.0, -1.0, 0.0), 0.011, 0.004,
            frame, collection, cyan,
            region="knee_light", material_role="EMISSION_CYAN", source_body=source_body,
            sides=3, bevel=0.0008,
        ))
        objects.append(_panel(
            f"LEG_ARMOR_SHIN_FRONT_{side}",
            [
                (sign * 0.093, -0.087, 0.397),
                (sign * 0.111, -0.092, 0.424),
                (sign * 0.179, -0.092, 0.418),
                (sign * 0.199, -0.080, 0.332),
                (sign * 0.181, -0.071, 0.156),
                (sign * 0.143, -0.075, 0.128),
                (sign * 0.104, -0.073, 0.165),
            ],
            (0.0, -1.0, 0.0), 0.012,
            frame, collection, white,
            region="shin", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.0035,
        ))
        objects.append(_panel(
            f"LEG_ARMOR_SHIN_OUTER_{side}",
            [
                (sign * 0.202, -0.065, 0.387),
                (sign * 0.210, -0.008, 0.360),
                (sign * 0.198, 0.076, 0.291),
                (sign * 0.179, 0.065, 0.151),
                (sign * 0.177, -0.067, 0.148),
            ],
            (sign, 0.0, 0.0), 0.011,
            frame, collection, white,
            region="shin", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.003,
        ))
        objects.append(_panel(
            f"SHIN_RED_RAIL_{side}",
            [
                (sign * 0.111, -0.107, 0.386),
                (sign * 0.124, -0.108, 0.394),
                (sign * 0.154, -0.088, 0.157),
                (sign * 0.140, -0.089, 0.153),
            ],
            (0.0, -1.0, 0.0), 0.005,
            frame, collection, red,
            region="shin_accent", material_role="ARMOR_RED", source_body=source_body,
            bevel=0.0013,
        ))
        objects.append(_panel(
            f"SHIN_DARK_VENT_{side}",
            [
                (sign * 0.155, -0.104, 0.343),
                (sign * 0.181, -0.100, 0.333),
                (sign * 0.178, -0.097, 0.300),
                (sign * 0.153, -0.100, 0.306),
            ],
            (0.0, -1.0, 0.0), 0.004,
            frame, collection, dark,
            region="shin_vent", material_role="METAL_DARK", source_body=source_body,
            bevel=0.001,
        ))

        # The ankle cuff is a true hollow loft.  Toe and sole are separate angular
        # volumes, creating the layered sci-fi boot silhouette seen in all views.
        objects.append(_swept_shell(
            f"BOOTS_ANKLE_CUFF_{side}",
            [(sign * 0.136, -0.004, 0.075), (sign * 0.138, 0.004, 0.245)],
            [(0.066, 0.068), (0.070, 0.076)],
            0.012,
            frame, collection, white,
            region="boot", material_role="ARMOR_WHITE", source_body=source_body,
            sides=16, closed=True, bevel=0.003,
        ))
        objects.append(_boot_volume(
            f"BOOTS_SHELL_{side}", sign * 0.136,
            [
                (0.055, 0.083, 0.062, 0.068),
                (0.010, 0.078, 0.069, 0.064),
                (-0.070, 0.071, 0.074, 0.054),
                (-0.155, 0.060, 0.071, 0.043),
                (-0.225, 0.051, 0.054, 0.030),
            ],
            frame, collection, white,
            region="boot", material_role="ARMOR_WHITE", source_body=source_body,
            bevel=0.004,
        ))
        objects.append(_boot_volume(
            f"BOOTS_SOLE_{side}", sign * 0.136,
            [
                (0.060, 0.022, 0.067, 0.023),
                (-0.020, 0.020, 0.074, 0.021),
                (-0.125, 0.018, 0.077, 0.019),
                (-0.235, 0.016, 0.059, 0.016),
            ],
            frame, collection, dark,
            region="boot_sole", material_role="METAL_DARK", source_body=source_body,
            bevel=0.003,
        ))
        objects.append(_panel(
            f"BOOTS_INSTEP_RED_STRAP_{side}",
            [
                (sign * 0.077, -0.089, 0.134),
                (sign * 0.191, -0.089, 0.134),
                (sign * 0.196, -0.054, 0.177),
                (sign * 0.081, -0.054, 0.177),
            ],
            (0.0, -0.72, 0.69), 0.007,
            frame, collection, red,
            region="boot_strap", material_role="ARMOR_RED", source_body=source_body,
            bevel=0.002,
        ))
        objects.append(_box(
            f"BOOTS_SIDE_BUCKLE_{side}", (sign * 0.205, -0.026, 0.157), (0.028, 0.050, 0.055),
            frame, collection, dark,
            region="boot_accessory", material_role="METAL_DARK", source_body=source_body,
            top_scale=(0.78, 0.85), bevel=0.002,
        ))
        objects.append(_panel(
            f"BOOTS_HEEL_CYAN_{side}",
            [
                (sign * 0.092, 0.086, 0.026),
                (sign * 0.180, 0.086, 0.026),
                (sign * 0.172, 0.082, 0.047),
                (sign * 0.100, 0.082, 0.047),
            ],
            (0.0, 1.0, 0.0), 0.005,
            frame, collection, cyan,
            region="boot_light", material_role="EMISSION_CYAN", source_body=source_body,
            bevel=0.001,
        ))
        objects.append(_panel(
            f"BOOTS_TOE_DARK_GUARD_{side}",
            [
                (sign * 0.087, -0.244, 0.041),
                (sign * 0.185, -0.244, 0.041),
                (sign * 0.184, -0.232, 0.071),
                (sign * 0.088, -0.232, 0.071),
            ],
            (0.0, -1.0, 0.0), 0.010,
            frame, collection, dark,
            region="boot_toe", material_role="METAL_DARK", source_body=source_body,
            bevel=0.002,
        ))
        objects.append(_badge(
            f"BOOTS_BUCKLE_CYAN_{side}",
            (sign * 0.221, -0.040, 0.159), (sign, -0.1, 0.0), 0.009, 0.004,
            frame, collection, cyan,
            region="boot_light", material_role="EMISSION_CYAN", source_body=source_body,
            sides=4, bevel=0.0008,
        ))
    return objects


def build_armor(
    body: bpy.types.Object | None = None,
    materials: Mapping[str, bpy.types.Material] | None = None,
) -> list[bpy.types.Object]:
    """Build idempotent Astra hard-surface armor around an approved body.

    ``body`` is read only.  Calling this function repeatedly clears and rebuilds
    only ``ASTRA_ARMOR``; it never deletes or changes ``BODY_CONTINUOUS``.
    """
    body = body or bpy.data.objects.get(BODY_NAME)
    if body is None:
        raise RuntimeError(f"Required approved body object is missing: {BODY_NAME}")
    frame = _body_frame(body)
    collection = ensure_collection(COLLECTION_NAME)
    clear_collection(collection)

    objects: list[bpy.types.Object] = []
    objects.extend(_build_chest(frame, collection, materials, body.name))
    objects.extend(_build_arms(frame, collection, materials, body.name))
    objects.extend(_build_waist_and_thighs(frame, collection, materials, body.name))
    objects.extend(_build_legs_and_boots(frame, collection, materials, body.name))

    print(
        "[05/15] Created procedural hard-surface armor: "
        f"{len(objects)} objects in {COLLECTION_NAME} (scale={frame.scale:.4f})"
    )
    return objects


__all__ = ["build_armor"]
