"""Small data-API-first geometry helpers for post-body phases."""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence

import bpy
from mathutils import Matrix, Vector


def ensure_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def clear_collection(collection: bpy.types.Collection) -> None:
    """Delete only generated objects owned by one phase, never the human base."""
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def link_object(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def mesh_object(
    name: str,
    vertices: Sequence[Sequence[float]],
    faces: Sequence[Sequence[int]],
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def add_bevel(
    obj: bpy.types.Object,
    width: float = 0.004,
    segments: int = 2,
    angle_degrees: float = 35.0,
) -> bpy.types.BevelModifier:
    modifier = obj.modifiers.new("Edge_Soften", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(angle_degrees)
    return modifier


def add_weighted_normals(obj: bpy.types.Object) -> None:
    """Set Blender 4/5 compatible smooth-by-angle shading without deprecated ops."""
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if hasattr(obj.data, "set_sharp_from_angle"):
        obj.data.set_sharp_from_angle(angle=math.radians(55.0))


def create_ellipsoid(
    name: str,
    center: Sequence[float],
    radii: Sequence[float],
    collection: bpy.types.Collection,
    *,
    radial: int = 24,
    vertical: int = 12,
) -> bpy.types.Object:
    """Create an analytic ellipsoid with from_pydata, not a primitive operator."""
    cx, cy, cz = center
    rx, ry, rz = radii
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for row in range(vertical + 1):
        phi = -math.pi / 2.0 + math.pi * row / vertical
        ring = max(0.0001, math.cos(phi))
        for side in range(radial):
            theta = 2.0 * math.pi * side / radial
            vertices.append((
                cx + rx * ring * math.cos(theta),
                cy + ry * ring * math.sin(theta),
                cz + rz * math.sin(phi),
            ))
    for row in range(vertical):
        first = row * radial
        second = (row + 1) * radial
        for side in range(radial):
            nxt = (side + 1) % radial
            faces.append((first + side, first + nxt, second + nxt, second + side))
    return mesh_object(name, vertices, faces, collection)


def create_tapered_box(
    name: str,
    center: Sequence[float],
    size: Sequence[float],
    collection: bpy.types.Collection,
    *,
    top_scale: tuple[float, float] = (1.0, 1.0),
    front_shift: float = 0.0,
) -> bpy.types.Object:
    """Create an extensively shapeable hard-surface shell from explicit vertices."""
    cx, cy, cz = center
    sx, sy, sz = (component * 0.5 for component in size)
    tx, ty = top_scale
    vertices = [
        (cx - sx, cy - sy, cz - sz),
        (cx + sx, cy - sy, cz - sz),
        (cx + sx, cy + sy, cz - sz),
        (cx - sx, cy + sy, cz - sz),
        (cx - sx * tx, cy - sy * ty + front_shift, cz + sz),
        (cx + sx * tx, cy - sy * ty + front_shift, cz + sz),
        (cx + sx * tx, cy + sy * ty, cz + sz),
        (cx - sx * tx, cy + sy * ty, cz + sz),
    ]
    faces = [
        (0, 3, 2, 1), (4, 5, 6, 7),
        (0, 1, 5, 4), (1, 2, 6, 5),
        (2, 3, 7, 6), (3, 0, 4, 7),
    ]
    return mesh_object(name, vertices, faces, collection)


def create_polyline_tube(
    name: str,
    points: Sequence[Sequence[float]],
    radii: Sequence[float] | float,
    collection: bpy.types.Collection,
    *,
    sides: int = 12,
) -> bpy.types.Object:
    if len(points) < 2:
        raise ValueError("Polyline tube requires at least two points")
    vectors = [Vector(point) for point in points]
    values = [float(radii)] * len(vectors) if isinstance(radii, (int, float)) else list(radii)
    if len(values) != len(vectors):
        raise ValueError("Polyline tube radii must match point count")
    vertices: list[tuple[float, float, float]] = []
    for index, (center, radius) in enumerate(zip(vectors, values)):
        if index == 0:
            tangent = (vectors[1] - center).normalized()
        elif index == len(vectors) - 1:
            tangent = (center - vectors[index - 1]).normalized()
        else:
            tangent = (vectors[index + 1] - vectors[index - 1]).normalized()
        reference = Vector((0.0, 0.0, 1.0))
        if abs(tangent.dot(reference)) > 0.92:
            reference = Vector((0.0, 1.0, 0.0))
        axis_a = tangent.cross(reference).normalized()
        axis_b = tangent.cross(axis_a).normalized()
        for side in range(sides):
            angle = 2.0 * math.pi * side / sides
            vertex = center + axis_a * (radius * math.cos(angle)) + axis_b * (radius * math.sin(angle))
            vertices.append(tuple(vertex))
    faces: list[tuple[int, ...]] = []
    for ring in range(len(vectors) - 1):
        first = ring * sides
        second = (ring + 1) * sides
        for side in range(sides):
            nxt = (side + 1) % sides
            faces.append((first + side, first + nxt, second + nxt, second + side))
    faces.append(tuple(reversed(range(sides))))
    last = (len(vectors) - 1) * sides
    faces.append(tuple(last + side for side in range(sides)))
    return mesh_object(name, vertices, faces, collection)


def assign_material(obj: bpy.types.Object, material: bpy.types.Material | None) -> None:
    if material is None or not hasattr(obj.data, "materials"):
        return
    obj.data.materials.clear()
    obj.data.materials.append(material)


def add_mirror(obj: bpy.types.Object, *, axis: int = 0) -> bpy.types.MirrorModifier:
    modifier = obj.modifiers.new("Design_Symmetry", "MIRROR")
    modifier.use_axis[0] = axis == 0
    modifier.use_axis[1] = axis == 1
    modifier.use_axis[2] = axis == 2
    modifier.use_clip = True
    modifier.use_mirror_merge = True
    return modifier


def point_transform(points: Iterable[Sequence[float]], matrix: Matrix) -> list[tuple[float, float, float]]:
    return [tuple(matrix @ Vector(point)) for point in points]
