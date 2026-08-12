"""Safe, explicit armature binding helpers.

Automatic weights are deliberately opt-in.  The helper only adds an armature
modifier and missing deform vertex-group names; it never edits body geometry.
"""

from __future__ import annotations

from typing import Iterable

import bpy

try:
    from ..pipeline_gate import HumanBaseGateError, require_human_base_approved
    from .armature import REQUIRED_DEFORM_BONES
except ImportError:  # pragma: no cover
    from pipeline_gate import HumanBaseGateError, require_human_base_approved
    from rigging.armature import REQUIRED_DEFORM_BONES


class WeightingError(RuntimeError):
    pass


def bind_meshes_to_rig(rig: bpy.types.Object | str, meshes: Iterable[bpy.types.Object | str], *, create_groups: bool = True) -> dict[str, object]:
    try:
        require_human_base_approved()
    except HumanBaseGateError as exc:
        raise WeightingError(str(exc)) from exc
    if isinstance(rig, str):
        rig = bpy.data.objects.get(rig)
    if rig is None or rig.type != "ARMATURE":
        raise WeightingError("An ARMATURE object is required")
    resolved = [bpy.data.objects.get(item) if isinstance(item, str) else item for item in meshes]
    resolved = [obj for obj in resolved if obj is not None and obj.type == "MESH"]
    if not resolved:
        raise WeightingError("No mesh objects were supplied")
    bound: list[str] = []
    for obj in resolved:
        modifier = next((item for item in obj.modifiers if item.type == "ARMATURE" and item.object == rig), None)
        if modifier is None:
            modifier = obj.modifiers.new("ASTRA_ARMATURE", "ARMATURE")
            modifier.object = rig
        if create_groups:
            for bone in REQUIRED_DEFORM_BONES:
                if rig.data.bones.get(bone) is not None and obj.vertex_groups.get(bone) is None:
                    obj.vertex_groups.new(name=bone)
        bound.append(obj.name)
    return {"rig": rig.name, "bound_meshes": bound, "groups_created": create_groups}


__all__ = ("WeightingError", "bind_meshes_to_rig")
