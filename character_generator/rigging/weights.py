"""Deterministic procedural skinning helpers for Astra H-08.

No external rig or weight data is used.  Humanoid weights are derived from the
locally generated rest skeleton and the mesh coordinates.  The same field can
be copied to a body-derived garment, which is important for a close-fitting suit:
binding that garment rigidly to ``chest`` leaves a second pair of arms and legs
behind whenever an action plays.
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from dataclasses import dataclass

import bpy
from mathutils import Vector

try:
    from ..pipeline_gate import HumanBaseGateError, require_human_base_approved
    from .armature import REQUIRED_DEFORM_BONES
except ImportError:  # pragma: no cover
    from pipeline_gate import HumanBaseGateError, require_human_base_approved
    from rigging.armature import REQUIRED_DEFORM_BONES


class WeightingError(RuntimeError):
    pass


@dataclass(frozen=True)
class WeightProfile:
    """One evaluated vertex-weight profile, ready for a deform mesh."""

    weights: tuple[tuple[tuple[str, float], ...], ...]
    vertex_count: int
    max_influences: int


_TRUNK_BONES: tuple[str, ...] = (
    "pelvis", "spine_01", "spine_02", "spine_03", "chest", "neck", "head",
)
_LIMB_BONES: tuple[str, ...] = (
    "clavicle_{side}", "upper_arm_{side}", "forearm_{side}", "hand_{side}",
    "thigh_{side}", "shin_{side}", "foot_{side}", "toe_{side}",
)


def _resolve_rig(rig: bpy.types.Object | str) -> bpy.types.Object:
    resolved = bpy.data.objects.get(rig) if isinstance(rig, str) else rig
    if resolved is None or resolved.type != "ARMATURE":
        raise WeightingError("An ARMATURE object is required")
    return resolved


def _resolve_mesh(mesh: bpy.types.Object | str, label: str = "mesh") -> bpy.types.Object:
    resolved = bpy.data.objects.get(mesh) if isinstance(mesh, str) else mesh
    if resolved is None or resolved.type != "MESH":
        raise WeightingError(f"A MESH object is required for {label}")
    return resolved


def _distance_to_segment(point: Vector, start: Vector, end: Vector) -> float:
    segment = end - start
    length_squared = segment.length_squared
    if length_squared <= 1.0e-12:
        return (point - start).length
    amount = max(0.0, min(1.0, (point - start).dot(segment) / length_squared))
    return (point - (start + segment * amount)).length


def _candidate_bones(point: Vector) -> tuple[str, ...]:
    """Restrict candidates only where body surfaces are physically separated.

    The shoulder/axilla is one continuous junction and therefore shares a single
    torso/arm field. Below it, the hanging arms and torso/hips have a real air gap;
    a conservative envelope keeps the spatially nearby but disconnected chains
    from stealing one another's four available influences.
    """

    side = "L" if point.x >= 0.0 else "R"
    arm = tuple(name.format(side=side) for name in _LIMB_BONES[:4])
    leg = tuple(name.format(side=side) for name in _LIMB_BONES[4:])
    if point.z >= 1.46:
        return ("head", "neck")
    if point.z >= 1.31 and abs(point.x) < 0.155:
        return ("neck", "chest", "spine_03", f"clavicle_{side}")
    if point.z >= 1.20:
        return _TRUNK_BONES[:5] + arm
    if point.z >= 0.60:
        return _TRUNK_BONES[:5] + arm + leg
    return ("pelvis",) + leg


def build_anatomical_weight_profile(
    rig: bpy.types.Object | str,
    mesh: bpy.types.Object | str,
    *,
    max_influences: int = 4,
    falloff_power: float = 2.35,
) -> WeightProfile:
    """Calculate smooth deform weights from rest-bone line segments.

    Point-to-segment distance follows an entire limb instead of only a bone
    centre, avoiding abrupt midpoint switches.  Results are normalized and
    limited to four influences for real-time export.
    """

    resolved_rig = _resolve_rig(rig)
    resolved_mesh = _resolve_mesh(mesh)
    if max_influences < 1:
        raise ValueError("max_influences must be at least one")
    if not math.isfinite(falloff_power) or falloff_power <= 0.0:
        raise ValueError("falloff_power must be finite and greater than zero")
    inverse_rig = resolved_rig.matrix_world.inverted_safe()
    mesh_to_rig = inverse_rig @ resolved_mesh.matrix_world
    segments = {
        bone.name: (Vector(bone.head_local), Vector(bone.tail_local))
        for bone in resolved_rig.data.bones
        if bone.use_deform
    }
    profiles: list[tuple[tuple[str, float], ...]] = []
    for vertex in resolved_mesh.data.vertices:
        point = mesh_to_rig @ vertex.co
        ranked: list[tuple[str, float]] = []
        candidates = _candidate_bones(point)
        if 0.60 <= point.z < 1.20:
            side = "L" if point.x >= 0.0 else "R"
            arm = tuple(name.format(side=side) for name in _LIMB_BONES[:4])
            leg = tuple(name.format(side=side) for name in _LIMB_BONES[4:])
            trunk = _TRUNK_BONES[:5]
            nearest_arm = min(
                _distance_to_segment(point, *segments[name])
                for name in arm
                if name in segments
            )
            # The authored forearm/hand surface stays within 9.5 cm of its rest
            # chain, while the closest torso/hip samples reach roughly 11.5 cm.
            # This geometric envelope separates the disconnected hanging arm
            # without introducing X/Z seams across either surface.
            if abs(point.x) >= 0.255 or (
                abs(point.x) >= 0.180 and nearest_arm <= 0.095
            ):
                candidates = arm + ("chest", "spine_03")
            else:
                candidates = trunk + (f"clavicle_{side}",) + leg
        for name in candidates:
            segment = segments.get(name)
            if segment is None:
                continue
            distance = _distance_to_segment(point, *segment)
            ranked.append((name, distance))
        ranked.sort(key=lambda item: item[1])
        ranked = ranked[:max_influences]
        raw = [1.0 / max(distance, 0.012) ** falloff_power for _name, distance in ranked]
        total = sum(raw)
        if total <= 0.0 or not ranked:
            raise WeightingError(f"Could not find a deform bone for vertex {vertex.index}")
        normalized = tuple(
            (name, value / total) for (name, _distance), value in zip(ranked, raw)
            if value / total >= 0.002
        )
        remainder = sum(value for _name, value in normalized)
        profiles.append(tuple((name, value / remainder) for name, value in normalized))
    adjacency: list[list[int]] = [[] for _vertex in resolved_mesh.data.vertices]
    for edge in resolved_mesh.data.edges:
        a, b = edge.vertices
        adjacency[a].append(b)
        adjacency[b].append(a)
    # Distance fields identify the correct anatomical region, while a short
    # topology-aware relaxation removes four-influence ranking seams at axilla,
    # wrist and hip. Keep the blend local so joint definition is retained.
    for _pass in range(24):
        smoothed: list[tuple[tuple[str, float], ...]] = []
        for index, influences in enumerate(profiles):
            neighbours = adjacency[index]
            if not neighbours:
                smoothed.append(influences)
                continue
            accumulated: dict[str, float] = {}
            for name, value in influences:
                accumulated[name] = accumulated.get(name, 0.0) + value * 0.55
            neighbour_scale = 0.45 / len(neighbours)
            for neighbour in neighbours:
                for name, value in profiles[neighbour]:
                    accumulated[name] = accumulated.get(name, 0.0) + value * neighbour_scale
            ranked_weights = sorted(
                accumulated.items(), key=lambda item: item[1], reverse=True
            )[:max_influences]
            total_weight = sum(value for _name, value in ranked_weights)
            smoothed.append(tuple(
                (name, value / total_weight) for name, value in ranked_weights
            ))
        profiles = smoothed
    return WeightProfile(tuple(profiles), len(profiles), max_influences)


def apply_weight_profile(
    rig: bpy.types.Object | str,
    mesh: bpy.types.Object | str,
    profile: WeightProfile,
    *,
    clear_deform_groups: bool = True,
) -> dict[str, object]:
    """Apply a previously evaluated profile and ensure one armature modifier."""

    resolved_rig = _resolve_rig(rig)
    resolved_mesh = _resolve_mesh(mesh)
    if profile.vertex_count != len(resolved_mesh.data.vertices):
        raise WeightingError(
            f"Weight profile has {profile.vertex_count} vertices but {resolved_mesh.name} "
            f"has {len(resolved_mesh.data.vertices)}"
        )
    deform_names = {bone.name for bone in resolved_rig.data.bones if bone.use_deform}
    if clear_deform_groups:
        for group in tuple(resolved_mesh.vertex_groups):
            if group.name in deform_names:
                resolved_mesh.vertex_groups.remove(group)
    groups: dict[str, bpy.types.VertexGroup] = {}
    for influences in profile.weights:
        for name, _value in influences:
            groups[name] = resolved_mesh.vertex_groups.get(name) or resolved_mesh.vertex_groups.new(name=name)
    for index, influences in enumerate(profile.weights):
        for name, value in influences:
            groups[name].add([index], float(value), "REPLACE")
    modifier = next(
        (item for item in resolved_mesh.modifiers if item.type == "ARMATURE" and item.object == resolved_rig),
        None,
    )
    if modifier is None:
        modifier = resolved_mesh.modifiers.new("ASTRA_ARMATURE", "ARMATURE")
        modifier.object = resolved_rig
    modifier.use_deform_preserve_volume = True
    return {
        "rig": resolved_rig.name,
        "mesh": resolved_mesh.name,
        "vertices": profile.vertex_count,
        "max_influences": profile.max_influences,
        "groups": sorted(groups),
    }


def copy_weight_profile(
    rig: bpy.types.Object | str,
    source: bpy.types.Object | str,
    target: bpy.types.Object | str,
) -> dict[str, object]:
    """Copy weights by matching vertex index for a body-derived mesh shell."""

    resolved_rig = _resolve_rig(rig)
    resolved_source = _resolve_mesh(source, "source")
    resolved_target = _resolve_mesh(target, "target")
    if len(resolved_source.data.vertices) != len(resolved_target.data.vertices):
        raise WeightingError(
            "Index weight transfer requires matching topology: "
            f"{resolved_source.name}={len(resolved_source.data.vertices)}, "
            f"{resolved_target.name}={len(resolved_target.data.vertices)}"
        )
    deform_names = {bone.name for bone in resolved_rig.data.bones if bone.use_deform}
    weights: list[tuple[tuple[str, float], ...]] = []
    for vertex in resolved_source.data.vertices:
        influences = tuple(
            (resolved_source.vertex_groups[item.group].name, float(item.weight))
            for item in vertex.groups
            if resolved_source.vertex_groups[item.group].name in deform_names and item.weight > 0.0
        )
        weights.append(influences)
    if not weights or any(not influences for influences in weights):
        raise WeightingError(f"{resolved_source.name} does not have complete deform weights")
    maximum = max(len(influences) for influences in weights)
    return apply_weight_profile(
        resolved_rig,
        resolved_target,
        WeightProfile(tuple(weights), len(weights), maximum),
    )


def assign_rigid_bone(
    rig: bpy.types.Object | str,
    mesh: bpy.types.Object | str,
    bone_name: str,
) -> dict[str, object]:
    """Bind a hard-surface part to exactly one verified deform bone."""

    resolved_rig = _resolve_rig(rig)
    resolved_mesh = _resolve_mesh(mesh)
    bone = resolved_rig.data.bones.get(bone_name)
    if bone is None or not bone.use_deform:
        raise WeightingError(f"Rigid target is not a deform bone: {bone_name}")
    profile = WeightProfile(
        tuple(((bone_name, 1.0),) for _vertex in resolved_mesh.data.vertices),
        len(resolved_mesh.data.vertices),
        1,
    )
    return apply_weight_profile(resolved_rig, resolved_mesh, profile)


def bind_meshes_to_rig(
    rig: bpy.types.Object | str,
    meshes: Iterable[bpy.types.Object | str],
    *,
    create_groups: bool = True,
    anatomical_weights: bool = False,
) -> dict[str, object]:
    try:
        require_human_base_approved()
    except HumanBaseGateError as exc:
        raise WeightingError(str(exc)) from exc
    rig = _resolve_rig(rig)
    resolved = [bpy.data.objects.get(item) if isinstance(item, str) else item for item in meshes]
    resolved = [obj for obj in resolved if obj is not None and obj.type == "MESH"]
    if not resolved:
        raise WeightingError("No mesh objects were supplied")
    bound: list[str] = []
    for obj in resolved:
        if anatomical_weights:
            profile = build_anatomical_weight_profile(rig, obj)
            apply_weight_profile(rig, obj, profile)
            bound.append(obj.name)
            continue
        modifier = next((item for item in obj.modifiers if item.type == "ARMATURE" and item.object == rig), None)
        if modifier is None:
            modifier = obj.modifiers.new("ASTRA_ARMATURE", "ARMATURE")
            modifier.object = rig
        if create_groups:
            for bone in REQUIRED_DEFORM_BONES:
                if rig.data.bones.get(bone) is not None and obj.vertex_groups.get(bone) is None:
                    obj.vertex_groups.new(name=bone)
        bound.append(obj.name)
    return {
        "rig": rig.name,
        "bound_meshes": bound,
        "groups_created": create_groups,
        "anatomical_weights": anatomical_weights,
    }


__all__ = (
    "WeightProfile",
    "WeightingError",
    "apply_weight_profile",
    "assign_rigid_bone",
    "bind_meshes_to_rig",
    "build_anatomical_weight_profile",
    "copy_weight_profile",
)
