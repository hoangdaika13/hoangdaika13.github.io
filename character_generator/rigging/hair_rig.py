"""Bone-based secondary motion rig for authored hair objects.

No hair geometry is generated here.  The builder resolves existing hair
objects, adds a small deterministic bone schema to an approved humanoid
armature, and adds light parent-follow constraints suitable for game export.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import bpy
from mathutils import Vector

try:
    from ..pipeline_gate import HumanBaseGateError, require_human_base_approved
except ImportError:  # pragma: no cover
    from pipeline_gate import HumanBaseGateError, require_human_base_approved


HAIR_CHAINS: dict[str, tuple[str, ...]] = {
    "front": ("hair_front_01", "hair_front_02", "hair_front_03"),
    "side_L": ("hair_side_L_01", "hair_side_L_02", "hair_side_L_03"),
    "side_R": ("hair_side_R_01", "hair_side_R_02", "hair_side_R_03"),
    "back": ("hair_back_01", "hair_back_02", "hair_back_03"),
    "braid": ("braid_01", "braid_02", "braid_03", "braid_04", "braid_05"),
}
HAIR_BONES = (
    "hair_front_01", "hair_front_02", "hair_front_03",
    "hair_side_L_01", "hair_side_L_02", "hair_side_L_03",
    "hair_side_R_01", "hair_side_R_02", "hair_side_R_03",
    "hair_back_01", "hair_back_02", "hair_back_03",
    "braid_01", "braid_02", "braid_03", "braid_04", "braid_05",
)


class HairRigError(RuntimeError):
    """Raised when the hair rig cannot be added safely."""


@dataclass(frozen=True)
class HairRigReport:
    rig: str
    bones: tuple[str, ...]
    bound_objects: tuple[str, ...]
    warnings: tuple[str, ...]


def _resolve_rig(rig: bpy.types.Object | str | None) -> bpy.types.Object:
    if isinstance(rig, str):
        rig = bpy.data.objects.get(rig)
    if rig is None:
        rig = bpy.data.objects.get("ASTRA_RIG")
    if rig is None or rig.type != "ARMATURE":
        raise HairRigError("An existing humanoid armature is required")
    for required in ("head", "neck"):
        if rig.data.bones.get(required) is None:
            raise HairRigError(f"Humanoid armature is missing {required!r}")
    return rig


def _resolve_hair_objects(objects: Iterable[bpy.types.Object | str] | None) -> list[bpy.types.Object]:
    if objects is None:
        candidates = [obj for obj in bpy.data.objects if obj.name.startswith("HAIR_")]
    else:
        requested = list(objects)
        candidates = [bpy.data.objects.get(item) if isinstance(item, str) else item for item in requested]
        missing = [item for item, resolved in zip(requested, candidates) if resolved is None]
        if missing:
            raise HairRigError("Requested hair objects do not exist: " + ", ".join(map(str, missing)))
    unsupported = [obj.name for obj in candidates if obj is not None and obj.type not in {"MESH", "CURVE"}]
    if unsupported:
        raise HairRigError("Unsupported hair object types: " + ", ".join(unsupported))
    return [obj for obj in candidates if obj is not None]


def _normalize_braid_groups(objects: list[bpy.types.Object]) -> None:
    """Guarantee one supported deform group per braid vertex.

    Old scenes can retain twelve procedural segment groups even though the
    release skeleton owns five braid bones.  Rebanding by world-space height
    makes neutral/profile and animated output deterministic without changing
    the authored braid silhouette.
    """
    braid = next((obj for obj in objects if obj.name == "HAIR_BRAID" and obj.type == "MESH"), None)
    if braid is None or not braid.data.vertices:
        return
    supported = HAIR_CHAINS["braid"]
    for group in tuple(braid.vertex_groups):
        if group.name.startswith("braid_") and group.name not in supported:
            braid.vertex_groups.remove(group)
    groups = [braid.vertex_groups.get(name) or braid.vertex_groups.new(name=name) for name in supported]
    vertex_indices = list(range(len(braid.data.vertices)))
    for group in groups:
        group.remove(vertex_indices)
    heights = [(braid.matrix_world @ vertex.co).z for vertex in braid.data.vertices]
    high, low = max(heights), min(heights)
    span = max(high - low, 1.0e-6)
    weighted: list[list[tuple[int, float]]] = [[] for _ in groups]
    for index, height in enumerate(heights):
        coordinate = min(len(groups) - 1.0, ((high - height) / span) * (len(groups) - 1))
        lower = int(coordinate)
        upper = min(len(groups) - 1, lower + 1)
        blend = coordinate - lower
        weighted[lower].append((index, 1.0 - blend))
        if upper != lower and blend > 1.0e-4:
            weighted[upper].append((index, blend))
    for group, assignments in zip(groups, weighted):
        # Blender's vertex-group API accepts one weight per add call; grouping
        # rounded weights keeps the build deterministic without thousands of
        # individual calls and provides smooth bend continuity at bone seams.
        buckets: dict[float, list[int]] = {}
        for index, weight in assignments:
            rounded = round(max(0.0, min(1.0, weight)), 3)
            if rounded > 0.0:
                buckets.setdefault(rounded, []).append(index)
        for weight, indices in buckets.items():
            group.add(indices, weight, "REPLACE")


def _bounds(objects: list[bpy.types.Object], rig: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    if not points:
        head = rig.data.bones.get("head")
        if head is None:
            raise HairRigError("No hair objects or head bone anchors available")
        points = [rig.matrix_world @ head.head, rig.matrix_world @ head.tail]
    return Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points))), Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))


def _set_edit_mode(rig: bpy.types.Object, enabled: bool) -> None:
    view_layer = bpy.context.view_layer
    view_layer.objects.active = rig
    rig.select_set(True)
    override = {"active_object": rig, "object": rig, "selected_objects": [rig], "selected_editable_objects": [rig]}
    with bpy.context.temp_override(**override):
        bpy.ops.object.mode_set(mode="EDIT" if enabled else "OBJECT")


def _capture_context() -> tuple[bpy.types.Object | None, tuple[bpy.types.Object, ...], str]:
    active = bpy.context.view_layer.objects.active
    selected = tuple(obj for obj in bpy.context.view_layer.objects if obj.select_get())
    return active, selected, active.mode if active is not None else "OBJECT"


def _restore_context(state: tuple[bpy.types.Object | None, tuple[bpy.types.Object, ...], str]) -> None:
    active, selected, mode = state
    try:
        current = bpy.context.view_layer.objects.active
        if current is not None and current.mode != "OBJECT":
            _set_edit_mode(current, False)
        for obj in bpy.context.view_layer.objects:
            if obj.select_get():
                obj.select_set(False)
        for obj in selected:
            if bpy.data.objects.get(obj.name) is obj:
                obj.select_set(True)
        if active is not None and bpy.data.objects.get(active.name) is active:
            bpy.context.view_layer.objects.active = active
            if mode == "EDIT" and active.type == "ARMATURE":
                _set_edit_mode(active, True)
    except (ReferenceError, RuntimeError, TypeError):
        pass


def build_hair_rig(rig: bpy.types.Object | str | None = None, hair_objects: Iterable[bpy.types.Object | str] | None = None) -> HairRigReport:
    try:
        require_human_base_approved()
    except HumanBaseGateError as exc:
        raise HairRigError(str(exc)) from exc
    resolved = _resolve_rig(rig)
    objects = _resolve_hair_objects(hair_objects)
    _normalize_braid_groups(objects)
    ungrouped = [
        obj.name
        for obj in objects
        if not any(obj.vertex_groups.get(name) is not None for name in HAIR_BONES)
    ]
    if ungrouped:
        raise HairRigError(
            "Hair meshes need explicit vertex groups matching HAIR_BONES before binding; "
            "refusing an all-or-nothing deformation guess for: " + ", ".join(ungrouped)
        )
    low, high = _bounds(objects, resolved)
    center = (low + high) * 0.5
    height = max(high.z - low.z, 0.18)
    head = resolved.data.bones["head"]
    specs: list[tuple[str, Vector, Vector, str | None]] = []
    for chain_name, names in HAIR_CHAINS.items():
        if chain_name == "front":
            anchor = Vector((center.x, low.y, high.z - height * 0.08)); direction = Vector((0.0, -0.02, -height * 0.12))
        elif chain_name == "back":
            anchor = Vector((center.x, high.y, high.z - height * 0.10)); direction = Vector((0.0, 0.03, -height * 0.16))
        elif chain_name == "braid":
            anchor = Vector((center.x, high.y + height * 0.08, high.z - height * 0.20)); direction = Vector((0.0, 0.015, -height * 0.17))
        else:
            sign = 1.0 if chain_name.endswith("L") else -1.0
            anchor = Vector((center.x + sign * max((high.x - low.x) * 0.45, 0.07), center.y, high.z - height * 0.12)); direction = Vector((sign * 0.015, 0.0, -height * 0.15))
        parent = "head"
        for index, bone_name in enumerate(names):
            h = anchor + direction * index
            t = h + direction * 0.92
            specs.append((bone_name, h, t, parent))
            parent = bone_name
    context_state = _capture_context()
    created: list[str] = []
    try:
        _set_edit_mode(resolved, True)
        try:
            for name, h, t, parent in specs:
                bone = resolved.data.edit_bones.get(name) or resolved.data.edit_bones.new(name)
                bone.head = resolved.matrix_world.inverted() @ h
                bone.tail = resolved.matrix_world.inverted() @ t
                bone.use_deform = True
                bone.parent = resolved.data.edit_bones.get(parent) if parent else None
                bone.use_connect = False
                if name not in created:
                    created.append(name)
        finally:
            _set_edit_mode(resolved, False)
        warnings: list[str] = []
        for name, _, _, parent in specs:
            pose = resolved.pose.bones.get(name)
            if pose is None:
                warnings.append(f"Missing pose bone after creation: {name}")
                continue
            if parent and parent in resolved.pose.bones:
                constraint = pose.constraints.get("ASTRA_HAIR_FOLLOW") or pose.constraints.new("COPY_ROTATION")
                constraint.name = "ASTRA_HAIR_FOLLOW"
                constraint.target = resolved
                constraint.subtarget = parent
                constraint.influence = 0.18
                if hasattr(constraint, "mix_mode"):
                    constraint.mix_mode = "ADD"
        bound: list[str] = []
        for obj in objects:
            modifier = next((m for m in obj.modifiers if m.type == "ARMATURE" and m.object == resolved), None)
            if modifier is None:
                modifier = obj.modifiers.new("ASTRA_HAIR_ARMATURE", "ARMATURE")
                modifier.object = resolved
            bound.append(obj.name)
        resolved["astra_hair_bones"] = ",".join(HAIR_BONES)
        return HairRigReport(resolved.name, tuple(created), tuple(bound), tuple(warnings))
    finally:
        _restore_context(context_state)


def validate_hair_rig(rig: bpy.types.Object | str | None = None) -> dict[str, object]:
    try:
        resolved = _resolve_rig(rig)
    except HairRigError as exc:
        return {
            "ok": False,
            "status": "target-rig-absent-or-incomplete",
            "rig": None,
            "missing": list(HAIR_BONES),
            "bones": [],
            "issues": [str(exc)],
        }
    missing = [name for name in HAIR_BONES if resolved.data.bones.get(name) is None]
    return {
        "ok": not missing,
        "status": "valid" if not missing else "hair-bones-missing",
        "rig": resolved.name,
        "missing": missing,
        "bones": [name for name in HAIR_BONES if name not in missing],
        "issues": [] if not missing else ["Missing hair bones: " + ", ".join(missing)],
    }


__all__ = ("HAIR_CHAINS", "HAIR_BONES", "HairRigError", "HairRigReport", "build_hair_rig", "validate_hair_rig")
