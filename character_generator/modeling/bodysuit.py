"""Body-derived black technical bodysuit for Astra H-08.

The garment is copied from approved BODY_CONTINUOUS surface polygons, so it
inherits the final anatomical silhouette instead of approximating it with tubes
or a painted body material.  Major exposed skin zones (head, hands and feet) are
excluded and future armor remains a separate shell above this layer.
"""

from __future__ import annotations

from collections.abc import Mapping

import bpy
from mathutils import Vector

from modeling.geometry import assign_material, clear_collection, ensure_collection


COLLECTION_NAME = "ASTRA_BODYSUIT"
BODY_NAME = "BODY_CONTINUOUS"


def _material(materials: Mapping[str, bpy.types.Material] | None, name: str) -> bpy.types.Material | None:
    if materials and name in materials:
        return materials[name]
    return bpy.data.materials.get(name)


def _body_bounds(body: bpy.types.Object) -> tuple[Vector, Vector]:
    corners = [body.matrix_world @ Vector(corner) for corner in body.bound_box]
    minimum = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    maximum = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return minimum, maximum


def _covered_vertex(world_co: Vector, minimum: Vector, maximum: Vector) -> bool:
    """Return whether a body vertex belongs to the close-fitting under-suit.

    Coordinates are normalized against the approved body bounds so regenerated
    anatomy can change within reason without rewriting fixed vertex indices.
    """
    height = max(0.001, maximum.z - minimum.z)
    center_x = 0.5 * (minimum.x + maximum.x)
    nx = abs(world_co.x - center_x) / height
    nz = (world_co.z - minimum.z) / height

    # Torso/neck and full legs are covered.  Arms stop before the fingers; boots
    # later cover the feet.  This selection intentionally overlaps armor anchors.
    if 0.055 <= nz <= 0.855:
        if nz >= 0.49:  # pelvis, torso, neck and arms
            return nx <= 0.235
        return nx <= 0.145  # separated legs, not empty space between them
    return False


def _extract_body_surface(body: bpy.types.Object, collection: bpy.types.Collection) -> bpy.types.Object:
    if body.type != "MESH":
        raise TypeError(f"{body.name} must be a mesh")
    # Preserve the body's exact topology and vertex order. Polygon extraction
    # made open borders that split under poses; the matching shell can copy the
    # body's verified weights index-for-index and moves without independent
    # seams. Exposed regions are hidden with a transparent material below.
    mesh = body.data.copy()
    mesh.name = "BODYSUIT_MESH"
    obj = bpy.data.objects.new("BODYSUIT", mesh)
    collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj["astra_phase"] = "04_bodysuit"
    obj["source_body"] = body.name
    obj["surface_derived"] = True
    obj["topology_matches_body"] = True
    return obj


def _add_fit_modifiers(suit: bpy.types.Object, body: bpy.types.Object) -> None:
    shrinkwrap = suit.modifiers.new("Body_Fit", "SHRINKWRAP")
    shrinkwrap.target = body
    shrinkwrap.wrap_method = "NEAREST_SURFACEPOINT"
    shrinkwrap.wrap_mode = "OUTSIDE_SURFACE"
    # A low offset avoids the inflated second-skin/latex highlight band while
    # retaining enough clearance to prevent z-fighting in animated poses.
    shrinkwrap.offset = 0.00135

    # Do not Solidify a topology-matched full shell: it doubles vertices and the
    # later armature binder cannot copy the body's index-aligned weights.  The
    # shrinkwrap offset alone provides a readable technical-fabric layer.


def _assign_exposed_zones(suit: bpy.types.Object, body: bpy.types.Object) -> None:
    invisible = bpy.data.materials.get("BODYSUIT_INVISIBLE")
    if invisible is None:
        invisible = bpy.data.materials.new("BODYSUIT_INVISIBLE")
        invisible.diffuse_color = (0.0, 0.0, 0.0, 0.0)
        invisible.use_nodes = True
        shader = invisible.node_tree.nodes.get("Principled BSDF")
        if shader is not None:
            alpha = shader.inputs.get("Alpha")
            if alpha is not None:
                alpha.default_value = 0.0
    suit.data.materials.append(invisible)
    minimum, maximum = _body_bounds(body)
    height = max(0.001, maximum.z - minimum.z)
    covered = []
    for vertex in body.data.vertices:
        world_co = body.matrix_world @ vertex.co
        nz = (world_co.z - minimum.z) / height
        # Full suit everywhere except the actual face/head, hands and feet.  Do
        # not expose the torso/hip by X threshold: those zones deform in combat
        # and previously revealed large skin patches in Attack_01/02.
        # The rest hand sits at roughly 43--49% height; the upper bound must not
        # classify outer hips/thighs as hands.
        is_hand = 0.405 <= nz <= 0.505 and abs(world_co.x) > 0.255 * height
        is_foot = nz < 0.085
        is_head = nz > 0.855
        covered.append(not (is_hand or is_foot or is_head))
    for polygon in suit.data.polygons:
        polygon.material_index = 0 if all(covered[index] for index in polygon.vertices) else 1


def _create_seam_curve(
    name: str,
    points: list[tuple[float, float, float]],
    collection: bpy.types.Collection,
    material: bpy.types.Material | None,
    bevel_depth: float = 0.0016,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}_CURVE", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    if material is not None:
        curve.materials.append(material)
    obj["astra_phase"] = "04_bodysuit"
    obj["detail_role"] = "raised_seam"
    return obj


def _build_design_seams(
    collection: bpy.types.Collection,
    materials: Mapping[str, bpy.types.Material] | None,
    scale: float,
) -> list[bpy.types.Object]:
    """Raised panel seams echo the sheet's red/cyan technical line language."""
    objects: list[bpy.types.Object] = []
    panel = _material(materials, "BODYSUIT_PANEL") or _material(materials, "METAL_DARK")
    cyan = _material(materials, "EMISSION_CYAN")
    coral = _material(materials, "ARMOR_RED")
    paths = (
        ("BODYSUIT_SEAM_CENTER", [(0.0, -0.151, 1.39), (0.0, -0.154, 1.21), (0.0, -0.132, 1.03)], panel),
        ("BODYSUIT_SEAM_WAIST_L", [(-0.02, -0.137, 1.13), (-0.09, -0.13, 1.08), (-0.15, -0.105, 1.00)], coral),
        ("BODYSUIT_SEAM_WAIST_R", [(0.02, -0.137, 1.13), (0.09, -0.13, 1.08), (0.15, -0.105, 1.00)], coral),
        ("BODYSUIT_CYAN_PIPING_L", [(-0.155, -0.107, 1.00), (-0.148, -0.102, 0.86), (-0.143, -0.082, 0.73)], cyan),
        ("BODYSUIT_CYAN_PIPING_R", [(0.155, -0.107, 1.00), (0.148, -0.102, 0.86), (0.143, -0.082, 0.73)], cyan),
    )
    for name, points, material in paths:
        scaled = [(x * scale, y * scale, z * scale) for x, y, z in points]
        objects.append(_create_seam_curve(name, scaled, collection, material, 0.0015 * scale))
    return objects


def build_bodysuit(
    body: bpy.types.Object | None = None,
    materials: Mapping[str, bpy.types.Material] | None = None,
) -> list[bpy.types.Object]:
    """Build a non-destructive, body-derived black suit and technical seams."""
    body = body or bpy.data.objects.get(BODY_NAME)
    if body is None:
        raise RuntimeError(f"Required approved body object is missing: {BODY_NAME}")
    collection = ensure_collection(COLLECTION_NAME)
    clear_collection(collection)
    suit = _extract_body_surface(body, collection)
    assign_material(suit, _material(materials, "BODYSUIT_BLACK"))
    _assign_exposed_zones(suit, body)
    _add_fit_modifiers(suit, body)
    minimum, maximum = _body_bounds(body)
    scale = (maximum.z - minimum.z) / 1.70
    objects = [suit, *_build_design_seams(collection, materials, scale)]
    print(f"[04/15] Created body-derived bodysuit: {len(objects)} objects")
    return objects
