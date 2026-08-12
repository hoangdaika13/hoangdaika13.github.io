"""Fail-closed post-body rig/facial/hair/animation orchestration.

The entrypoint is deliberately callable only after manual four-view approval.
Importing this module never opens a blend file, changes a scene, or runs a
builder.  Optional face/hair stages report skips instead of touching unrelated
geometry when their authored objects are not present yet.
"""

from __future__ import annotations

from typing import Any, Iterable

import bpy

try:
    from .pipeline_gate import HumanBaseGateError, require_human_base_approved
    from .rigging.armature import build_humanoid_rig
    from .rigging.facial_rig import build_facial_rig, create_facial_demo_action
    from .rigging.hair_rig import build_hair_rig
    from .rigging.weights import bind_meshes_to_rig
    from .animation.core import build_action_library, validate_actions
except ImportError:  # Blender's text-editor/script-directory execution.
    from pipeline_gate import HumanBaseGateError, require_human_base_approved
    from rigging.armature import build_humanoid_rig
    from rigging.facial_rig import build_facial_rig, create_facial_demo_action
    from rigging.hair_rig import build_hair_rig
    from rigging.weights import bind_meshes_to_rig
    from animation.core import build_action_library, validate_actions


class RigAnimationPipelineError(RuntimeError):
    pass


def build_rig_animation_stack(*, context: bpy.types.Context | None = None, rig_name: str = "ASTRA_RIG", face: bpy.types.Object | str | None = None, hair_objects: Iterable[bpy.types.Object | str] | None = None, meshes: Iterable[bpy.types.Object | str] = ()) -> dict[str, Any]:
    """Build all post-body systems transactionally behind the visual gate."""
    try:
        approval = require_human_base_approved()
    except HumanBaseGateError as exc:
        raise RigAnimationPipelineError(str(exc)) from exc
    context = context or bpy.context
    rig = build_humanoid_rig(rig_name, validate=True, require_approval=False)
    report: dict[str, Any] = {"gate": {"status": approval.review.get("status"), "review": str(approval.review_path)}, "rig": rig.name, "skipped": [], "warnings": []}
    mesh_list = list(meshes)
    if mesh_list:
        report["weights"] = bind_meshes_to_rig(rig, mesh_list)
    else:
        report["skipped"].append("weights: no meshes supplied")
    if face is not None or bpy.data.objects.get("HEAD") is not None:
        try:
            report["facial"] = build_facial_rig(face, rig=rig)
            report["facial_demo"] = create_facial_demo_action(face).name
        except Exception as exc:
            # An existing authored face is not optional: the release contract
            # requires its full expression/viseme set.
            raise RigAnimationPipelineError(f"Facial rig failed: {exc}") from exc
    else:
        report["skipped"].append("facial: no head mesh supplied")
    if hair_objects is not None or any(obj.name.startswith("HAIR_") for obj in bpy.data.objects):
        try:
            hair_report = build_hair_rig(rig, hair_objects)
            report["hair"] = {"rig": hair_report.rig, "bones": list(hair_report.bones), "bound_objects": list(hair_report.bound_objects), "warnings": list(hair_report.warnings)}
        except Exception as exc:
            # Existing hair is not optional: silently continuing would create a
            # final action library without the required secondary channels.
            raise RigAnimationPipelineError(f"Hair rig failed: {exc}") from exc
    else:
        report["skipped"].append("hair: no authored hair objects supplied")
    try:
        # Hair must precede actions so Idle/Walk/Run can include their secondary
        # channels on the same deterministic build.
        action_result = build_action_library(
            rig,
            scene=context.scene,
            require_approval=False,
            mutate_scene_timing=True,
        )
        report["actions"] = {name: action.name for name, action in action_result.actions.items()}
        report["animation_validation"] = validate_actions(rig, scene=context.scene)
    except Exception as exc:
        raise RigAnimationPipelineError(f"Animation build failed: {exc}") from exc
    return report


__all__ = ("RigAnimationPipelineError", "build_rig_animation_stack")
