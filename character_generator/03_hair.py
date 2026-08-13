"""Phase 3 procedural hair builder for Astra H-08.

This module creates the coral layered hairstyle directly from vertices, faces,
and Blender curves.  It never imports a model or image.  The supplied 2D
character sheet is a design reference only.

Coordinate contract
-------------------
The approved HUMAN_BASE stands on +Z and faces -Y, matching the phase-one body
generator.  Hair is fitted from the body object's world-space bounds and is
created in world space with identity transforms.  No body or head datablock is
modified.

Approval gate
-------------
``build_hair`` deliberately refuses to run until the immutable HUMAN_BASE
technical report and manual visual review both approve the next phase.  A
legacy scene/body approval flag is retained as an additional provenance marker,
but it can never override the disk review gate.  This module does not decide
that the base is visually acceptable.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterable, Mapping, Sequence

import bpy
from mathutils import Vector

from pipeline_gate import HumanBaseGateError, require_human_base_approved


GENERATOR_ID = "astra_h08.03_hair"
COLLECTION_NAME = "ASTRA_HAIR"
APPROVAL_KEYS = (
    "HUMAN_BASE_APPROVED",
    "human_base_approved",
    "astra_human_base_approved",
)


class HairBuildError(RuntimeError):
    """Base error for deterministic hair build failures."""


class HumanBaseApprovalError(HairBuildError):
    """Raised before mutation when the HUMAN_BASE visual gate is not approved."""


@dataclass(frozen=True)
class HairFit:
    """World-space anchors inferred without changing the approved body."""

    center_x: float
    center_y: float
    crown_z: float
    front_y: float
    rear_y: float
    head_half_width: float
    character_height: float
    scale: float


@dataclass(frozen=True)
class ClumpSpec:
    """A tapered closed clump following a Catmull-Rom centerline."""

    points: tuple[tuple[float, float, float], ...]
    widths: tuple[float, ...]
    thicknesses: tuple[float, ...]
    samples_per_span: int = 4
    ring_segments: int = 8

    def __post_init__(self) -> None:
        count = len(self.points)
        if count < 2:
            raise ValueError("A hair clump needs at least two control points")
        if len(self.widths) != count or len(self.thicknesses) != count:
            raise ValueError("Clump points, widths, and thicknesses must match")
        if self.samples_per_span < 1 or self.ring_segments < 4:
            raise ValueError("Clump sampling is below the supported minimum")


@dataclass
class MeshAccumulator:
    """One from_pydata payload containing any number of closed clump islands."""

    vertices: list[tuple[float, float, float]] = field(default_factory=list)
    faces: list[tuple[int, ...]] = field(default_factory=list)
    face_materials: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class HairBuildResult:
    collection: bpy.types.Collection
    objects: tuple[bpy.types.Object, ...]
    materials: Mapping[str, bpy.types.Material]
    fit: HairFit

    @property
    def mesh_objects(self) -> tuple[bpy.types.Object, ...]:
        return tuple(obj for obj in self.objects if obj.type == "MESH")


def _log(message: str) -> None:
    try:
        print(f"[HAIR 03] {message}", flush=True)
    except (BrokenPipeError, OSError, ValueError):
        pass


def _approved_value(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value == 1
    if isinstance(value, str):
        return value.strip().casefold() in {"1", "true", "pass", "passed", "approved"}
    return False


def _approval_source(context: bpy.types.Context, body: bpy.types.Object) -> str | None:
    sources = (("body object", body), ("body mesh", body.data), ("scene", context.scene))
    for label, datablock in sources:
        for key in APPROVAL_KEYS:
            try:
                if _approved_value(datablock.get(key)):
                    return f"{label}.{key}"
            except (AttributeError, TypeError):
                continue
    return None


def _resolve_body(body: bpy.types.Object | str | None) -> bpy.types.Object:
    if isinstance(body, str):
        body = bpy.data.objects.get(body)
    if body is None:
        for name in ("BODY_CONTINUOUS", "HUMAN_BASE", "BODY"):
            candidate = bpy.data.objects.get(name)
            if candidate is not None:
                body = candidate
                break
    if body is None:
        raise HairBuildError(
            "No body was supplied. Pass the approved mesh object to build_hair(body=...)."
        )
    if body.type != "MESH" or body.data is None or len(body.data.vertices) < 8:
        raise HairBuildError(f"{body.name!r} is not a usable HUMAN_BASE mesh")
    return body


def _fit_from_body(body: bpy.types.Object) -> HairFit:
    points = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
    z_min = min(point.z for point in points)
    z_max = max(point.z for point in points)
    height = z_max - z_min
    if height <= 0.5:
        raise HairBuildError("HUMAN_BASE height is invalid; expected a meter-scale character")

    # The upper 20.5% covers the anime head while excluding shoulders.  Clamp the
    # inferred width so an outlier vertex cannot turn the hairstyle into a helmet.
    head_floor = z_max - height * 0.205
    head_points = [point for point in points if point.z >= head_floor]
    if len(head_points) < 8:
        raise HairBuildError("Not enough head-region vertices to fit procedural hair")

    x_min = min(point.x for point in head_points)
    x_max = max(point.x for point in head_points)
    y_min = min(point.y for point in head_points)
    y_max = max(point.y for point in head_points)
    scale = height / 1.70
    measured_half_width = 0.5 * (x_max - x_min)
    half_width = min(max(measured_half_width, 0.082 * scale), 0.135 * scale)
    return HairFit(
        center_x=0.5 * (x_min + x_max),
        center_y=0.5 * (y_min + y_max),
        crown_z=z_max,
        front_y=y_min,
        rear_y=y_max,
        head_half_width=half_width,
        character_height=height,
        scale=scale,
    )


def _ensure_collection(context: bpy.types.Context) -> bpy.types.Collection:
    collection = bpy.data.collections.get(COLLECTION_NAME)
    if collection is None:
        collection = bpy.data.collections.new(COLLECTION_NAME)
        context.scene.collection.children.link(collection)
    elif collection.name not in {child.name for child in context.scene.collection.children}:
        context.scene.collection.children.link(collection)
    collection["astra.generator"] = GENERATOR_ID
    collection["astra.phase"] = 3
    collection["astra.reference_policy"] = "supplied_2d_sheet_only"
    return collection


def _remove_previous_build(collection: bpy.types.Collection) -> None:
    """Remove only objects previously authored by this module."""
    for obj in list(collection.objects):
        if obj.get("astra.generator") != GENERATOR_ID:
            continue
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is None or data.users:
            continue
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
        elif isinstance(data, bpy.types.Curve):
            bpy.data.curves.remove(data)


def _assert_object_name_available(name: str) -> None:
    existing = bpy.data.objects.get(name)
    if existing is not None:
        raise HairBuildError(
            f"Object name {name!r} is already owned by another datablock; "
            "rename it before rebuilding procedural hair"
        )


def _set_node_input(node: bpy.types.Node, names: Iterable[str], value: object) -> None:
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            socket.default_value = value
            return


def _material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float,
    metallic: float = 0.0,
    emission_color: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    material["astra.generator"] = GENERATOR_ID
    material["astra.material_role"] = name
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        _set_node_input(principled, ("Base Color",), color)
        _set_node_input(principled, ("Roughness",), roughness)
        _set_node_input(principled, ("Metallic",), metallic)
        _set_node_input(principled, ("Coat Weight", "Clearcoat"), 0.16 if name.startswith("HAIR_") else 0.08)
        if emission_color is not None:
            _set_node_input(principled, ("Emission Color", "Emission"), emission_color)
            _set_node_input(principled, ("Emission Strength",), emission_strength)
    return material


def _build_materials(
    overrides: Mapping[str, bpy.types.Material] | None,
) -> dict[str, bpy.types.Material]:
    definitions = {
        "HAIR_CORAL_DARK": ((0.30, 0.025, 0.045, 1.0), 0.38, 0.0, None, 0.0),
        "HAIR_CORAL": ((0.82, 0.13, 0.16, 1.0), 0.34, 0.0, None, 0.0),
        "HAIR_CORAL_TIP": ((1.00, 0.34, 0.31, 1.0), 0.31, 0.0, None, 0.0),
        "HAIR_ACCESSORY_IVORY": ((0.78, 0.76, 0.69, 1.0), 0.27, 0.10, None, 0.0),
        "HAIR_ACCESSORY_DARK": ((0.025, 0.034, 0.043, 1.0), 0.22, 0.72, None, 0.0),
        "HAIR_ACCESSORY_RED": ((0.50, 0.035, 0.045, 1.0), 0.30, 0.35, None, 0.0),
        "HAIR_ACCESSORY_CYAN": (
            (0.01, 0.48, 0.58, 1.0),
            0.19,
            0.18,
            (0.00, 0.90, 1.00, 1.0),
            2.2,
        ),
    }
    result: dict[str, bpy.types.Material] = {}
    for name, values in definitions.items():
        if overrides and name in overrides:
            result[name] = overrides[name]
            continue
        existing = bpy.data.materials.get(name)
        # Phase 06 may own the canonical material names.  Reuse any pre-existing
        # material without changing its shader graph; this keeps phase 03
        # composable and avoids silently overwriting a later PBR pass when hair is
        # rebuilt.  Materials created by this module are still refreshed by
        # ``_material`` above when their names are absent from the override map.
        if existing is not None and existing.get("astra.generator") != GENERATOR_ID:
            result[name] = existing
            continue
        color, roughness, metallic, emission, strength = values
        result[name] = _material(
            name,
            color,
            roughness=roughness,
            metallic=metallic,
            emission_color=emission,
            emission_strength=strength,
        )
    return result


def _catmull_rom_scalar(a: float, b: float, c: float, d: float, t: float) -> float:
    t2 = t * t
    t3 = t2 * t
    return 0.5 * (
        2.0 * b
        + (-a + c) * t
        + (2.0 * a - 5.0 * b + 4.0 * c - d) * t2
        + (-a + 3.0 * b - 3.0 * c + d) * t3
    )


def _catmull_rom_vector(a: Vector, b: Vector, c: Vector, d: Vector, t: float) -> Vector:
    return Vector(
        (
            _catmull_rom_scalar(a.x, b.x, c.x, d.x, t),
            _catmull_rom_scalar(a.y, b.y, c.y, d.y, t),
            _catmull_rom_scalar(a.z, b.z, c.z, d.z, t),
        )
    )


def _sample_clump(spec: ClumpSpec) -> tuple[list[Vector], list[float], list[float]]:
    controls = [Vector(point) for point in spec.points]
    result_points: list[Vector] = []
    result_widths: list[float] = []
    result_thicknesses: list[float] = []
    last_span = len(controls) - 1
    for span in range(last_span):
        p0 = controls[max(0, span - 1)]
        p1 = controls[span]
        p2 = controls[span + 1]
        p3 = controls[min(len(controls) - 1, span + 2)]
        w0 = spec.widths[max(0, span - 1)]
        w1 = spec.widths[span]
        w2 = spec.widths[span + 1]
        w3 = spec.widths[min(len(spec.widths) - 1, span + 2)]
        h0 = spec.thicknesses[max(0, span - 1)]
        h1 = spec.thicknesses[span]
        h2 = spec.thicknesses[span + 1]
        h3 = spec.thicknesses[min(len(spec.thicknesses) - 1, span + 2)]
        for step in range(spec.samples_per_span):
            t = step / spec.samples_per_span
            result_points.append(_catmull_rom_vector(p0, p1, p2, p3, t))
            result_widths.append(max(0.00005, _catmull_rom_scalar(w0, w1, w2, w3, t)))
            result_thicknesses.append(max(0.00005, _catmull_rom_scalar(h0, h1, h2, h3, t)))
    result_points.append(controls[-1])
    result_widths.append(max(0.00005, spec.widths[-1]))
    result_thicknesses.append(max(0.00005, spec.thicknesses[-1]))
    return result_points, result_widths, result_thicknesses


def _append_clump(
    accumulator: MeshAccumulator,
    spec: ClumpSpec,
    fit: HairFit,
) -> tuple[int, int]:
    """Append a watertight flattened clump and return its vertex interval."""
    path, widths, thicknesses = _sample_clump(spec)
    start_vertex = len(accumulator.vertices)
    ring_starts: list[int] = []
    previous_side: Vector | None = None

    for index, center in enumerate(path):
        before = path[max(0, index - 1)]
        after = path[min(len(path) - 1, index + 1)]
        tangent = after - before
        if tangent.length_squared < 1e-12:
            tangent = Vector((0.0, 0.0, -1.0))
        tangent.normalize()

        preferred = Vector((center.x - fit.center_x, center.y - fit.center_y, 0.0))
        if preferred.length_squared < 1e-10:
            preferred = Vector((0.0, 1.0, 0.0))
        preferred.normalize()
        outward = preferred - tangent * preferred.dot(tangent)
        if outward.length_squared < 1e-10:
            outward = Vector((0.0, 1.0, 0.0)) - tangent * tangent.y
        outward.normalize()
        side = tangent.cross(outward)
        if side.length_squared < 1e-10:
            side = Vector((1.0, 0.0, 0.0))
        side.normalize()
        if previous_side is not None and side.dot(previous_side) < 0.0:
            side.negate()
        outward = side.cross(tangent).normalized()
        previous_side = side.copy()

        ring_starts.append(len(accumulator.vertices))
        for ring_index in range(spec.ring_segments):
            angle = 2.0 * math.pi * ring_index / spec.ring_segments
            cosine = math.cos(angle)
            sine = math.sin(angle)
            # The scalp-facing half is flatter; the outward half catches a clean
            # highlight and reads as an anime hair plane instead of a noodle.
            normal_scale = thicknesses[index] * (1.0 if sine >= 0.0 else 0.48)
            point = center + side * (widths[index] * cosine) + outward * (normal_scale * sine)
            accumulator.vertices.append(tuple(point))

    ring_count = len(ring_starts)
    for ring_index in range(ring_count - 1):
        current = ring_starts[ring_index]
        following = ring_starts[ring_index + 1]
        progress = (ring_index + 0.5) / max(1, ring_count - 1)
        material_index = 0 if progress < 0.17 else (2 if progress > 0.78 else 1)
        for side_index in range(spec.ring_segments):
            nxt = (side_index + 1) % spec.ring_segments
            accumulator.faces.append(
                (current + side_index, current + nxt, following + nxt, following + side_index)
            )
            accumulator.face_materials.append(material_index)

    root_center = len(accumulator.vertices)
    accumulator.vertices.append(tuple(path[0]))
    first_ring = ring_starts[0]
    for side_index in range(spec.ring_segments):
        nxt = (side_index + 1) % spec.ring_segments
        accumulator.faces.append((root_center, first_ring + nxt, first_ring + side_index))
        accumulator.face_materials.append(0)

    tip_center = len(accumulator.vertices)
    accumulator.vertices.append(tuple(path[-1]))
    last_ring = ring_starts[-1]
    for side_index in range(spec.ring_segments):
        nxt = (side_index + 1) % spec.ring_segments
        accumulator.faces.append((tip_center, last_ring + side_index, last_ring + nxt))
        accumulator.face_materials.append(2)
    return start_vertex, len(accumulator.vertices)


def _add_planar_uv(mesh: bpy.types.Mesh) -> None:
    if not mesh.vertices or not mesh.loops:
        return
    xs = [vertex.co.x for vertex in mesh.vertices]
    zs = [vertex.co.z for vertex in mesh.vertices]
    x_min, x_span = min(xs), max(max(xs) - min(xs), 1e-6)
    z_min, z_span = min(zs), max(max(zs) - min(zs), 1e-6)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        co = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = ((co.x - x_min) / x_span, (co.z - z_min) / z_span)


def _tag_object(obj: bpy.types.Object, role: str) -> None:
    obj["astra.generator"] = GENERATOR_ID
    obj["astra.phase"] = 3
    obj["astra.hair_role"] = role
    obj["astra.reference_policy"] = "supplied_2d_sheet_only"


def _mesh_object(
    name: str,
    specs: Sequence[ClumpSpec],
    fit: HairFit,
    collection: bpy.types.Collection,
    hair_materials: Sequence[bpy.types.Material],
    role: str,
    *,
    group_specs: Sequence[tuple[str, Sequence[int]]] | None = None,
) -> tuple[bpy.types.Object, list[tuple[int, int]]]:
    _assert_object_name_available(name)
    accumulator = MeshAccumulator()
    intervals = [_append_clump(accumulator, spec, fit) for spec in specs]
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(accumulator.vertices, [], accumulator.faces)
    mesh.update(calc_edges=True)
    for material in hair_materials:
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, accumulator.face_materials):
        polygon.material_index = material_index
        polygon.use_smooth = True
    _add_planar_uv(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    _tag_object(obj, role)
    obj["astra.hair_clump_count"] = len(specs)
    if group_specs:
        for group_name, clump_indices in group_specs:
            group = obj.vertex_groups.new(name=group_name)
            vertex_indices: list[int] = []
            for clump_index in clump_indices:
                start, end = intervals[clump_index]
                vertex_indices.extend(range(start, end))
            if vertex_indices:
                group.add(vertex_indices, 1.0, "REPLACE")
    return obj, intervals


def _scalp_shell(
    fit: HairFit,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Create a thin coral skull shell beneath layered clumps.

    It closes the white scalp gaps visible in profile/back while stopping above
    the eyebrows so the face and both eyes stay open.
    """
    radial, rings = 48, 12
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    top = fit.crown_z + 0.008 * fit.scale
    rx = min(fit.head_half_width + 0.006 * fit.scale, 0.104 * fit.scale)
    # Facial feature planes inflate y_min.  Use a compact skull envelope so the
    # shell reads as a rounded bob in profile, never a visor.
    front = min(max(0.086 * fit.scale, fit.center_y - fit.front_y), 0.104 * fit.scale)
    rear = min(max(0.096 * fit.scale, fit.rear_y - fit.center_y), 0.116 * fit.scale)
    for row in range(rings + 1):
        phi = (math.pi * 0.5) * row / rings
        horizontal = math.sin(phi)
        for side in range(radial):
            theta = 2.0 * math.pi * side / radial
            ca, sa = math.cos(theta), math.sin(theta)
            depth = rear if sa >= 0.0 else front
            # Forehead shell stops above the brows; side/rear descend to ears
            # and nape. This keeps continuous hair mass without creating a mask.
            drop = (0.155 + 0.075 * max(0.0, sa) - 0.105 * max(0.0, -sa)) * fit.scale
            vertices.append((
                fit.center_x + rx * horizontal * ca,
                fit.center_y + depth * horizontal * sa,
                top - drop * (1.0 - math.cos(phi)),
            ))
    for row in range(rings):
        a, b = row * radial, (row + 1) * radial
        for side in range(radial):
            nxt = (side + 1) % radial
            mid_angle = 2.0 * math.pi * (side + 0.5) / radial
            # Keep the upper half of the front crown closed, then open the lower
            # forehead for the authored fringe.  Removing the entire forward
            # wedge exposed a white triangular scalp hole in profile/back QA.
            forward = max(0.0, -math.sin(mid_angle))
            if row >= rings // 2 and forward > 0.22 and abs(math.cos(mid_angle)) < 0.92:
                continue
            faces.append((a + side, a + nxt, b + nxt, b + side))
    mesh = bpy.data.meshes.new("HAIR_SCALP_SHELL_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new("HAIR_SCALP_SHELL", mesh)
    collection.objects.link(obj)
    _tag_object(obj, "continuous_scalp_shell")
    group = obj.vertex_groups.new(name="hair_back_01")
    group.add(list(range(len(mesh.vertices))), 1.0, "REPLACE")
    return obj


def _spec(
    points: Sequence[tuple[float, float, float]],
    widths: Sequence[float],
    thicknesses: Sequence[float],
    *,
    samples: int = 4,
    sides: int = 8,
) -> ClumpSpec:
    return ClumpSpec(tuple(points), tuple(widths), tuple(thicknesses), samples, sides)


def _layout_specs(fit: HairFit) -> dict[str, list[ClumpSpec]]:
    """Lay out layered clumps around the approved head, not a solid cap."""
    s = fit.scale
    cx, cy, top = fit.center_x, fit.center_y, fit.crown_z
    hw = fit.head_half_width

    def c(x: float, y: float, dz: float) -> tuple[float, float, float]:
        return (cx + x * s, cy + y * s, top + dz * s)

    def f(x: float, extra: float, dz: float) -> tuple[float, float, float]:
        return (cx + x * s, fit.front_y + extra * s, top + dz * s)

    def b(x: float, extra: float, dz: float) -> tuple[float, float, float]:
        return (cx + x * s, fit.rear_y + extra * s, top + dz * s)

    def side(sign: float, extra: float, y: float, dz: float) -> tuple[float, float, float]:
        return (cx + sign * (hw + extra * s), cy + y * s, top + dz * s)

    def clump(
        points: Sequence[tuple[float, float, float]],
        widths: Sequence[float],
        thicknesses: Sequence[float] | float,
        *,
        samples: int = 4,
    ) -> ClumpSpec:
        scaled_widths = [value * s for value in widths]
        if isinstance(thicknesses, (int, float)):
            scaled_thicknesses = [float(thicknesses) * s] * len(points)
        else:
            scaled_thicknesses = [value * s for value in thicknesses]
        return _spec(points, scaled_widths, scaled_thicknesses, samples=samples)

    crown = [
        clump([c(-0.006, -0.002, 0.008), c(-0.044, -0.020, -0.004), f(-0.072, 0.004, -0.052), side(-1, -0.002, -0.014, -0.118)], [0.016, 0.028, 0.025, 0.001], [0.005, 0.008, 0.007, 0.001]),
        clump([c(0.010, -0.001, 0.008), c(0.046, -0.018, -0.005), f(0.074, 0.004, -0.050), side(1, -0.002, -0.010, -0.116)], [0.016, 0.028, 0.025, 0.001], [0.005, 0.008, 0.007, 0.001]),
        clump([c(-0.012, 0.006, 0.009), c(-0.040, 0.036, -0.002), b(-0.068, 0.002, -0.060), side(-1, 0.000, 0.030, -0.142)], [0.017, 0.031, 0.028, 0.001], [0.005, 0.009, 0.008, 0.001]),
        clump([c(0.012, 0.006, 0.009), c(0.040, 0.036, -0.002), b(0.068, 0.002, -0.060), side(1, 0.000, 0.030, -0.142)], [0.017, 0.031, 0.028, 0.001], [0.005, 0.009, 0.008, 0.001]),
    ]

    # Asymmetric swept fringe follows the sheet's strong side part.  Keep the
    # upper volume rooted in the crown, but terminate the central panels above
    # the pupils so both eyes remain readable in front/profile release renders.
    front = [
        # One broad side-part sweep replaces the former row of vertical petals.
        clump([c(0.052, -0.004, 0.006), c(0.028, -0.032, -0.010), f(-0.004, 0.006, -0.044), f(-0.042, 0.012, -0.082), f(-0.082, 0.018, -0.118)], [0.018, 0.034, 0.031, 0.018, 0.001], [0.005, 0.009, 0.008, 0.005, 0.001]),
        clump([c(0.075, 0.000, -0.003), c(0.068, -0.025, -0.022), f(0.052, 0.010, -0.052), f(0.034, 0.016, -0.092), f(0.020, 0.020, -0.118)], [0.014, 0.025, 0.022, 0.012, 0.001], [0.0045, 0.007, 0.006, 0.004, 0.001]),
        clump([c(0.018, -0.008, 0.004), c(-0.012, -0.030, -0.012), f(-0.044, 0.010, -0.050), f(-0.078, 0.016, -0.092), f(-0.106, 0.020, -0.126)], [0.015, 0.028, 0.024, 0.013, 0.001], [0.005, 0.008, 0.0065, 0.004, 0.001]),
        clump([c(-0.040, 0.000, -0.002), c(-0.070, -0.020, -0.026), f(-0.095, 0.012, -0.068), side(-1, 0.002, -0.018, -0.132)], [0.013, 0.023, 0.016, 0.001], [0.004, 0.0065, 0.005, 0.001]),
        clump([c(0.090, 0.008, -0.012), c(0.098, -0.010, -0.042), side(1, 0.000, -0.018, -0.082), side(1, 0.004, -0.008, -0.120)], [0.010, 0.018, 0.012, 0.001], [0.0035, 0.0055, 0.004, 0.001]),
    ]

    temples: dict[str, list[ClumpSpec]] = {"TEMPLE_L": [], "TEMPLE_R": []}
    sides: dict[str, list[ClumpSpec]] = {"SIDE_L": [], "SIDE_R": []}
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        temples[f"TEMPLE_{suffix}"] = [
            # Keep locks outside the cheek plane.  Earlier roots moved inward to
            # f(x, front_y) and covered the eye/nose silhouette from profile.
            clump([side(sign, -0.002, -0.016, -0.085), side(sign, 0.004, -0.020, -0.132), side(sign, 0.006, -0.014, -0.190), side(sign, 0.002, -0.006, -0.250)], [0.012, 0.016, 0.011, 0.001], [0.004, 0.0055, 0.004, 0.001]),
            clump([side(sign, 0.002, 0.004, -0.108), side(sign, 0.009, 0.002, -0.155), side(sign, 0.011, 0.010, -0.205), side(sign, 0.004, 0.018, -0.265)], [0.011, 0.015, 0.010, 0.001], [0.0035, 0.005, 0.0038, 0.001]),
        ]
        sides[f"SIDE_{suffix}"] = [
            clump([side(sign, -0.008, 0.015, -0.095), side(sign, 0.020, 0.030, -0.115), side(sign, 0.065, 0.015, -0.105)], [0.015, 0.023, 0.001], [0.005, 0.008, 0.001]),
            clump([side(sign, -0.004, 0.025, -0.130), side(sign, 0.025, 0.045, -0.150), side(sign, 0.075, 0.052, -0.165)], [0.016, 0.025, 0.001], [0.005, 0.008, 0.001]),
            clump([side(sign, -0.002, 0.035, -0.170), side(sign, 0.024, 0.055, -0.195), side(sign, 0.062, 0.060, -0.225)], [0.015, 0.023, 0.001], [0.005, 0.007, 0.001]),
            clump([side(sign, -0.010, 0.045, -0.200), side(sign, 0.018, 0.070, -0.235), side(sign, 0.045, 0.075, -0.275)], [0.014, 0.021, 0.001], [0.004, 0.007, 0.001]),
        ]

    rear: list[ClumpSpec] = []
    # Two overlapping fans keep visible panel breaks around the skull and nape.
    for u in (-1.0, -0.67, -0.34, 0.0, 0.34, 0.67, 1.0):
        root_x = 0.018 * u
        mid_x = (0.070 * u) + (0.006 * math.sin(u * math.pi))
        tip_x = (hw / s + 0.018 + 0.020 * abs(u)) * u
        rear.append(
            clump(
                [c(root_x, 0.018, 0.006), b(mid_x, 0.005, -0.075), b(tip_x, 0.018, -0.165 - 0.020 * abs(u))],
                [0.015, 0.032 - 0.005 * abs(u), 0.001],
                [0.005, 0.010, 0.001],
            )
        )
    for u in (-1.0, -0.60, -0.20, 0.20, 0.60, 1.0):
        rear.append(
            clump(
                [c(0.025 * u, 0.028, -0.020), b(0.075 * u, 0.016, -0.130), b((hw / s + 0.035) * u, 0.026, -0.245 - 0.020 * abs(u))],
                [0.016, 0.031 - 0.004 * abs(u), 0.001],
                [0.005, 0.010, 0.001],
            )
        )
    for u in (-0.72, -0.36, 0.0, 0.36, 0.72):
        rear.append(
            clump(
                [b(0.070 * u, 0.012, -0.110), b(0.090 * u, 0.030, -0.205), b((0.105 + 0.018 * abs(u)) * u, 0.022, -0.310)],
                [0.017, 0.025, 0.001],
                [0.005, 0.008, 0.001],
            )
        )

    gather_root = b(0.0, 0.042, -0.205)
    gather = [
        clump([b(-0.090, 0.016, -0.115), b(-0.055, 0.035, -0.160), gather_root], [0.020, 0.025, 0.004], [0.006, 0.009, 0.003]),
        clump([b(0.090, 0.016, -0.115), b(0.055, 0.035, -0.160), gather_root], [0.020, 0.025, 0.004], [0.006, 0.009, 0.003]),
        clump([b(-0.040, 0.020, -0.095), b(-0.025, 0.044, -0.160), gather_root], [0.018, 0.022, 0.004], [0.006, 0.008, 0.003]),
        clump([b(0.040, 0.020, -0.095), b(0.025, 0.044, -0.160), gather_root], [0.018, 0.022, 0.004], [0.006, 0.008, 0.003]),
    ]

    return {
        "CROWN": crown,
        "FRONT": front,
        "TEMPLE_L": temples["TEMPLE_L"],
        "TEMPLE_R": temples["TEMPLE_R"],
        "SIDE_L": sides["SIDE_L"],
        "SIDE_R": sides["SIDE_R"],
        "BACK": rear,
        "BRAID_GATHER": gather,
    }


def _braid_specs(fit: HairFit, segment_count: int = 14) -> tuple[list[ClumpSpec], list[list[int]], Vector]:
    """Create three continuous interwoven strands fitted close to the back."""
    s = fit.scale
    start_z = fit.crown_z - 0.220 * s
    segment_length = 0.034 * s
    base_y = fit.rear_y + 0.031 * s
    specs: list[ClumpSpec] = []
    # The export skeleton deliberately carries five braid bones.  Distribute
    # all twelve visual weave segments across those supported groups so no
    # vertex group is silently ignored or falls back to braid_01 at bind time.
    groups: list[list[int]] = [[] for _ in range(5)]
    for strand in range(3):
        phase = strand * (2.0 * math.pi / 3.0)
        points: list[tuple[float, float, float]] = []
        widths: list[float] = []
        thicknesses: list[float] = []
        for index in range(segment_count + 1):
            progress = index / segment_count
            amplitude = (0.020 - 0.007 * progress) * s
            angle = phase + index * (2.0 * math.pi / 3.0)
            points.append((
                fit.center_x + math.cos(angle) * amplitude,
                base_y + math.sin(angle) * 0.005 * s,
                start_z - segment_length * index,
            ))
            widths.append((0.011 - 0.004 * progress) * s)
            thicknesses.append((0.0065 - 0.0025 * progress) * s)
        specs.append(_spec(points, widths, thicknesses, samples=3, sides=8))
    groups[0].extend(range(len(specs)))
    tail_anchor = Vector(
        (
            fit.center_x,
            base_y,
            start_z - segment_length * segment_count,
        )
    )
    return specs, groups, tail_anchor


def _tail_specs(fit: HairFit, anchor: Vector) -> list[ClumpSpec]:
    s = fit.scale
    result: list[ClumpSpec] = []
    for index, lateral in enumerate((-1.0, 0.0, 1.0)):
        start = anchor + Vector((lateral * 0.006 * s, 0.0, 0.004 * s))
        result.append(
            _spec(
                (
                    tuple(start),
                    tuple(start + Vector((lateral * 0.012 * s, 0.004 * s, -0.035 * s))),
                    tuple(start + Vector((lateral * 0.025 * s, -0.002 * s, -0.085 * s))),
                    tuple(start + Vector((lateral * 0.034 * s, 0.003 * s, -0.125 * s))),
                ),
                (0.008 * s, 0.013 * s, 0.009 * s, 0.001 * s),
                (0.004 * s, 0.006 * s, 0.004 * s, 0.001 * s),
                samples=4,
            )
        )
    return result


def _curve_object(
    name: str,
    paths: Sequence[Sequence[tuple[tuple[float, float, float], float]]],
    bevel_depth: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    role: str,
) -> bpy.types.Object:
    _assert_object_name_available(name)
    data = bpy.data.curves.new(f"{name}_CURVE", "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 5
    data.render_resolution_u = 5
    data.bevel_depth = bevel_depth
    data.bevel_resolution = 3
    data.resolution_v = 3
    data.use_fill_caps = True
    data.materials.append(material)
    for path in paths:
        spline = data.splines.new("BEZIER")
        spline.bezier_points.add(len(path) - 1)
        for point, (coordinate, radius) in zip(spline.bezier_points, path):
            point.co = coordinate
            point.radius = max(0.03, radius)
            point.handle_left_type = "AUTO"
            point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    _tag_object(obj, role)
    obj["astra.hair_clump_count"] = len(paths)
    return obj


def _loose_curve_paths(fit: HairFit) -> dict[str, list[list[tuple[tuple[float, float, float], float]]]]:
    s = fit.scale
    cx, cy, top = fit.center_x, fit.center_y, fit.crown_z

    def point(x: float, y: float, z: float) -> tuple[float, float, float]:
        return (cx + x * s, cy + y * s, top + z * s)

    ahoge = [
        [
            (point(0.005, 0.000, 0.010), 1.00),
            (point(0.012, -0.002, 0.065), 0.90),
            (point(-0.010, -0.003, 0.105), 0.70),
            (point(-0.040, 0.000, 0.112), 0.35),
            (point(-0.056, 0.006, 0.090), 0.08),
        ]
    ]
    loose = [
        [(point(-0.092, -0.055, -0.100), 1.0), (point(-0.120, -0.067, -0.190), 0.65), (point(-0.105, -0.050, -0.285), 0.08)],
        [(point(0.096, -0.050, -0.120), 1.0), (point(0.124, -0.060, -0.205), 0.58), (point(0.108, -0.042, -0.305), 0.08)],
        [(point(-0.088, 0.070, -0.135), 1.0), (point(-0.130, 0.100, -0.205), 0.55), (point(-0.155, 0.095, -0.245), 0.08)],
        [(point(0.086, 0.072, -0.145), 1.0), (point(0.132, 0.105, -0.210), 0.55), (point(0.160, 0.095, -0.255), 0.08)],
        [(point(-0.020, 0.108, -0.185), 1.0), (point(-0.040, 0.140, -0.300), 0.50), (point(-0.025, 0.132, -0.390), 0.08)],
        [(point(0.025, 0.108, -0.190), 1.0), (point(0.047, 0.142, -0.300), 0.50), (point(0.030, 0.133, -0.385), 0.08)],
    ]
    return {"AHOGE": ahoge, "LOOSE": loose}


def _prism_object(
    name: str,
    outline: Sequence[tuple[float, float]],
    center: Vector,
    axis_u: Vector,
    axis_v: Vector,
    thickness: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    role: str,
    bevel_width: float,
) -> bpy.types.Object:
    _assert_object_name_available(name)
    u = axis_u.normalized()
    v = axis_v.normalized()
    normal = u.cross(v).normalized()
    half = thickness * 0.5
    front = [center + u * x + v * y + normal * half for x, y in outline]
    back = [center + u * x + v * y - normal * half for x, y in outline]
    vertices = [tuple(point) for point in front + back]
    count = len(outline)
    faces: list[tuple[int, ...]] = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    mesh.materials.append(material)
    _add_planar_uv(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    _tag_object(obj, role)
    bevel = obj.modifiers.new(name="EDGE_BEVEL", type="BEVEL")
    bevel.width = bevel_width
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    return obj


def _torus_object(
    name: str,
    center: Vector,
    major_radius: float,
    minor_radius: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    role: str,
    major_segments: int = 24,
    minor_segments: int = 8,
) -> bpy.types.Object:
    """Direct from_pydata torus around a vertical braid; no primitive operator."""
    _assert_object_name_available(name)
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for major_index in range(major_segments):
        major_angle = 2.0 * math.pi * major_index / major_segments
        ca, sa = math.cos(major_angle), math.sin(major_angle)
        for minor_index in range(minor_segments):
            minor_angle = 2.0 * math.pi * minor_index / minor_segments
            radial = major_radius + minor_radius * math.cos(minor_angle)
            vertices.append(
                (
                    center.x + radial * ca,
                    center.y + radial * sa,
                    center.z + minor_radius * math.sin(minor_angle),
                )
            )
    for major_index in range(major_segments):
        next_major = (major_index + 1) % major_segments
        for minor_index in range(minor_segments):
            next_minor = (minor_index + 1) % minor_segments
            a = major_index * minor_segments + minor_index
            b = next_major * minor_segments + minor_index
            c = next_major * minor_segments + next_minor
            d = major_index * minor_segments + next_minor
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    _add_planar_uv(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    _tag_object(obj, role)
    return obj


def _mechanical_accessories(
    fit: HairFit,
    collection: bpy.types.Collection,
    materials: Mapping[str, bpy.types.Material],
    braid_anchor: Vector,
    tail_anchor: Vector,
) -> list[bpy.types.Object]:
    s = fit.scale
    # Character-left temple clip.  +U points toward the face (-Y), +V points up,
    # so U cross V points outward from the left side of the head (-X).
    axis_u = Vector((0.0, -1.0, 0.0))
    axis_v = Vector((0.0, 0.0, 1.0))
    outward = axis_u.cross(axis_v).normalized()
    center = Vector(
        (
            fit.center_x - fit.head_half_width - 0.010 * s,
            fit.center_y - 0.025 * s,
            fit.crown_z - 0.105 * s,
        )
    )
    frame_outline = [
        (-0.014 * s, 0.034 * s),
        (0.008 * s, 0.031 * s),
        (0.021 * s, 0.017 * s),
        (0.013 * s, 0.003 * s),
        (0.022 * s, -0.012 * s),
        (0.006 * s, -0.034 * s),
        (-0.013 * s, -0.028 * s),
        (-0.020 * s, -0.010 * s),
        (-0.012 * s, 0.004 * s),
        (-0.022 * s, 0.017 * s),
    ]
    objects = [
        _prism_object(
            "HAIR_ACCESSORY_FRAME_L",
            frame_outline,
            center,
            axis_u,
            axis_v,
            0.007 * s,
            collection,
            materials["HAIR_ACCESSORY_IVORY"],
            "mechanical_temple_clip_frame",
            0.0015 * s,
        )
    ]
    dark_outline = [(-0.010 * s, 0.023 * s), (0.010 * s, 0.018 * s), (0.012 * s, -0.005 * s), (0.000, -0.022 * s), (-0.012 * s, -0.006 * s)]
    objects.append(
        _prism_object(
            "HAIR_ACCESSORY_CORE_L",
            dark_outline,
            center + outward * 0.006 * s,
            axis_u,
            axis_v,
            0.0035 * s,
            collection,
            materials["HAIR_ACCESSORY_DARK"],
            "mechanical_temple_clip_core",
            0.0008 * s,
        )
    )
    cyan_outline = [(-0.004 * s, 0.013 * s), (0.004 * s, 0.017 * s), (0.006 * s, 0.002 * s), (0.000, -0.009 * s), (-0.006 * s, 0.002 * s)]
    objects.append(
        _prism_object(
            "HAIR_ACCESSORY_CYAN_L",
            cyan_outline,
            center + outward * 0.0085 * s + axis_v * 0.002 * s,
            axis_u,
            axis_v,
            0.002 * s,
            collection,
            materials["HAIR_ACCESSORY_CYAN"],
            "mechanical_temple_clip_emissive",
            0.00045 * s,
        )
    )
    pin_outline = [(-0.004 * s, 0.007 * s), (0.004 * s, 0.007 * s), (0.005 * s, -0.007 * s), (-0.005 * s, -0.007 * s)]
    objects.append(
        _prism_object(
            "HAIR_ACCESSORY_RED_PIN_L",
            pin_outline,
            center + outward * 0.008 * s + axis_u * 0.014 * s - axis_v * 0.019 * s,
            axis_u,
            axis_v,
            0.002 * s,
            collection,
            materials["HAIR_ACCESSORY_RED"],
            "mechanical_temple_clip_accent",
            0.00045 * s,
        )
    )
    objects.append(
        _torus_object(
            "HAIR_BRAID_CLASP_TOP",
            braid_anchor,
            0.027 * s,
            0.004 * s,
            collection,
            materials["HAIR_ACCESSORY_DARK"],
            "braid_top_clasp",
        )
    )
    objects.append(
        _torus_object(
            "HAIR_BRAID_CLASP_END",
            tail_anchor + Vector((0.0, 0.0, 0.004 * s)),
            0.015 * s,
            0.0032 * s,
            collection,
            materials["HAIR_ACCESSORY_RED"],
            "braid_end_clasp",
            major_segments=20,
            minor_segments=8,
        )
    )
    return objects


def build_hair(
    context: bpy.types.Context | None = None,
    body: bpy.types.Object | str | None = None,
    *,
    replace_existing: bool = True,
    material_overrides: Mapping[str, bpy.types.Material] | None = None,
) -> HairBuildResult:
    """Build all phase-three hair geometry after explicit HUMAN_BASE approval.

    Parameters
    ----------
    context:
        Blender context; defaults to ``bpy.context``.
    body:
        Approved body mesh or its object name.  If omitted, deterministic base
        names are searched.
    replace_existing:
        Rebuild only objects tagged as authored by this module.
    material_overrides:
        Optional materials supplied by phase 06, keyed by the canonical names
        returned in ``HairBuildResult.materials``.

    The approval check happens before collection, object, or material mutation.
    """
    context = context or bpy.context
    # Validate the review record before resolving or mutating any generated
    # collection/material.  A scene custom property alone is not approval.
    try:
        require_human_base_approved()
    except HumanBaseGateError as exc:
        raise HumanBaseApprovalError(str(exc)) from exc
    resolved_body = _resolve_body(body)
    approval = _approval_source(context, resolved_body)
    if approval is None:
        raise HumanBaseApprovalError(
            "Hair generation is gated: HUMAN_BASE has not been visually approved. "
            "After front/side/back/3-4 QA passes, set HUMAN_BASE_APPROVED=True on "
            "the body object or scene, then call build_hair again."
        )

    _log(f"Gate accepted from {approval}; fitting hair to {resolved_body.name}")
    fit = _fit_from_body(resolved_body)
    collection = _ensure_collection(context)
    if replace_existing:
        _remove_previous_build(collection)
    materials = _build_materials(material_overrides)
    hair_materials = (
        materials["HAIR_CORAL_DARK"],
        materials["HAIR_CORAL"],
        materials["HAIR_CORAL_TIP"],
    )

    layouts = _layout_specs(fit)
    created: list[bpy.types.Object] = [
        _scalp_shell(fit, collection, materials["HAIR_CORAL"])
    ]
    region_names = (
        ("HAIR_CROWN_LAYERS", "CROWN", "layered_crown"),
        ("HAIR_FRONT", "FRONT", "swept_bangs"),
        ("HAIR_TEMPLE_L", "TEMPLE_L", "temple_lock_left"),
        ("HAIR_TEMPLE_R", "TEMPLE_R", "temple_lock_right"),
        ("HAIR_SIDE_L", "SIDE_L", "side_wings_left"),
        ("HAIR_SIDE_R", "SIDE_R", "side_wings_right"),
        ("HAIR_BACK", "BACK", "rear_coral_layers"),
        ("HAIR_BRAID_GATHER", "BRAID_GATHER", "braid_gather"),
    )
    for object_name, layout_name, role in region_names:
        obj, _ = _mesh_object(
            object_name,
            layouts[layout_name],
            fit,
            collection,
            hair_materials,
            role,
        )
        created.append(obj)

    braid_specs, braid_groups, tail_anchor = _braid_specs(fit)
    group_specs = [(f"braid_{index + 1:02d}", indices) for index, indices in enumerate(braid_groups)]
    braid, _ = _mesh_object(
        "HAIR_BRAID",
        braid_specs,
        fit,
        collection,
        hair_materials,
        "long_interwoven_braid",
        group_specs=group_specs,
    )
    braid["astra.rig_chain"] = ",".join(name for name, _ in group_specs)
    created.append(braid)

    tail, _ = _mesh_object(
        "HAIR_BRAID_TAIL",
        _tail_specs(fit, tail_anchor),
        fit,
        collection,
        hair_materials,
        "braid_loose_tail",
    )
    tail.vertex_groups.new(name=f"braid_{len(braid_groups):02d}").add(
        list(range(len(tail.data.vertices))), 1.0, "REPLACE"
    )
    created.append(tail)

    curves = _loose_curve_paths(fit)
    created.append(
        _curve_object(
            "HAIR_AHOGE",
            curves["AHOGE"],
            0.0032 * fit.scale,
            collection,
            materials["HAIR_CORAL_TIP"],
            "ahoge_curve",
        )
    )
    created.append(
        _curve_object(
            "HAIR_LOOSE_STRANDS",
            curves["LOOSE"],
            0.0021 * fit.scale,
            collection,
            materials["HAIR_CORAL"],
            "loose_secondary_curves",
        )
    )

    braid_anchor = Vector((fit.center_x, fit.rear_y + 0.042 * fit.scale, fit.crown_z - 0.205 * fit.scale))
    created.extend(
        _mechanical_accessories(
            fit,
            collection,
            materials,
            braid_anchor,
            tail_anchor,
        )
    )
    collection["astra.body_source"] = resolved_body.name
    collection["astra.approval_source"] = approval
    collection["astra.hair_object_count"] = len(created)
    _log(
        f"Created {len(created)} named hair/accessory objects, "
        f"{sum(len(obj.data.vertices) for obj in created if obj.type == 'MESH')} mesh vertices"
    )
    return HairBuildResult(collection, tuple(created), materials, fit)


def main() -> HairBuildResult:
    """Blender script entry point; the same HUMAN_BASE approval gate applies."""
    _log("[03/15] Checking HUMAN_BASE approval before hair generation")
    result = build_hair(bpy.context)
    _log("[03/15] Coral layered hair, braid, and mechanical clip complete")
    return result


if __name__ == "__main__":
    main()
