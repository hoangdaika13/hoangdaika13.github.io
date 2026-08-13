"""Procedural humanoid armature and practical FK/IK controls for Astra H-08.

This module only describes and builds Blender armature data.  Importing it has no
side effects: callers must explicitly invoke :func:`build_humanoid_rig` after the
body has passed visual approval.  No model, rig, or animation data is imported.

Coordinate convention used by the project:

* Z is up and the character faces negative Y.
* Anatomical left is positive X; right is negative X.
* Required deformation bones retain the ``*_L`` / ``*_R`` names from the brief.
* ``*_fk_*`` bones are animator controls, ``*_ik_*`` limb bones are hidden
  mechanisms, and hand/foot/pole bones are visible IK controls.

The builder targets Blender 4.x.  Armature edit bones necessarily require Edit
Mode, so that one operation is wrapped in an explicit active-object override.
Everything else (objects, constraints, drivers, properties, and validation) uses
the Blender data API.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

import bpy


RIG_NAME = "ASTRA_RIG"
RIG_VERSION = 1
IK_FK_PROPERTY = "ik_fk"

SIDES: tuple[str, str] = ("L", "R")
FINGERS: tuple[str, ...] = ("thumb", "index", "middle", "ring", "pinky")
PHALANGES: tuple[str, str, str] = ("01", "02", "03")

CENTER_DEFORM_BONES: tuple[str, ...] = (
    "pelvis",
    "spine_01",
    "spine_02",
    "spine_03",
    "chest",
    "neck",
    "head",
)

SIDE_DEFORM_BONES: tuple[str, ...] = (
    "clavicle_{side}",
    "upper_arm_{side}",
    "forearm_{side}",
    "hand_{side}",
    "thigh_{side}",
    "shin_{side}",
    "foot_{side}",
    "toe_{side}",
)

FINGER_DEFORM_BONES: tuple[str, ...] = tuple(
    f"{finger}_{segment}_{{side}}"
    for finger in FINGERS
    for segment in PHALANGES
)

REQUIRED_DEFORM_BONES: tuple[str, ...] = (
    CENTER_DEFORM_BONES
    + tuple(name.format(side=side) for side in SIDES for name in SIDE_DEFORM_BONES)
    + tuple(name.format(side=side) for side in SIDES for name in FINGER_DEFORM_BONES)
)

REQUIRED_CONTROL_BONES: tuple[str, ...] = (
    "root",
    *tuple(
        name
        for side in SIDES
        for name in (
            f"upper_arm_fk_{side}",
            f"forearm_fk_{side}",
            f"hand_fk_{side}",
            f"hand_ik_{side}",
            f"elbow_pole_{side}",
            f"thigh_fk_{side}",
            f"shin_fk_{side}",
            f"foot_fk_{side}",
            f"toe_fk_{side}",
            f"foot_ik_{side}",
            f"toe_ik_{side}",
            f"knee_pole_{side}",
        )
    ),
)

REQUIRED_MECHANISM_BONES: tuple[str, ...] = tuple(
    name
    for side in SIDES
    for name in (
        f"upper_arm_ik_{side}",
        f"forearm_ik_{side}",
        f"thigh_ik_{side}",
        f"shin_ik_{side}",
    )
)


class RigBuildError(RuntimeError):
    """Raised when a deterministic rig build cannot be completed safely."""


class RigValidationError(RigBuildError):
    """Raised when a built armature does not satisfy the rig contract."""


def _require_approved_body_stage() -> None:
    """Honor the repository's fail-closed visual gate before scene mutation."""

    try:
        from ..pipeline_gate import HumanBaseGateError, require_human_base_approved
    except ImportError:  # Blender script-directory imports are not package imports.
        try:
            from pipeline_gate import HumanBaseGateError, require_human_base_approved
        except ImportError as exc:
            raise RigBuildError(
                "The HUMAN_BASE approval gate could not be imported; refusing to build a rig"
            ) from exc
    try:
        require_human_base_approved()
    except HumanBaseGateError as exc:
        raise RigBuildError(str(exc)) from exc


@dataclass(frozen=True)
class BoneSpec:
    """One rest-pose bone declaration in armature-local coordinates."""

    name: str
    head: tuple[float, float, float]
    tail: tuple[float, float, float]
    parent: str | None = None
    connected: bool = False
    deform: bool = True
    roll: float = 0.0
    group: str = "Deform"


@dataclass(frozen=True)
class _ContextState:
    active: object | None
    selected: tuple[object, ...]
    mode: str


def _point(
    x: float,
    y: float,
    z: float,
    scale: float,
) -> tuple[float, float, float]:
    return (x * scale, y * scale, z * scale)


def _bone_specs(scale: float = 1.0) -> tuple[BoneSpec, ...]:
    """Return the complete, ordered rest-pose schema.

    The coordinates match the procedural 1.70 m body in ``modeling/body.py``.
    The function is intentionally pure so naming/parenting can be audited without
    mutating a Blender file.
    """

    if not isinstance(scale, (int, float)) or not math.isfinite(scale) or scale <= 0.0:
        raise ValueError("scale must be a finite number greater than zero")

    p = lambda x, y, z: _point(x, y, z, float(scale))
    specs: list[BoneSpec] = [
        BoneSpec("root", p(0.0, 0.0, 0.0), p(0.0, 0.0, 0.14), deform=False, group="Root"),
        BoneSpec("pelvis", p(0.0, 0.010, 0.88), p(0.0, 0.006, 0.99), "root"),
        BoneSpec("spine_01", p(0.0, 0.006, 0.99), p(0.0, 0.000, 1.10), "pelvis", True),
        BoneSpec("spine_02", p(0.0, 0.000, 1.10), p(0.0, 0.000, 1.21), "spine_01", True),
        BoneSpec("spine_03", p(0.0, 0.000, 1.21), p(0.0, 0.003, 1.32), "spine_02", True),
        BoneSpec("chest", p(0.0, 0.003, 1.32), p(0.0, 0.006, 1.40), "spine_03", True),
        BoneSpec("neck", p(0.0, 0.006, 1.40), p(0.0, 0.008, 1.49), "chest", True),
        BoneSpec("head", p(0.0, 0.008, 1.49), p(0.0, 0.010, 1.71), "neck", True),
    ]

    for side in SIDES:
        sign = 1.0 if side == "L" else -1.0
        shoulder = p(sign * 0.185, 0.004, 1.36)
        elbow = p(sign * 0.266, -0.004, 1.09)
        wrist = p(sign * 0.344, -0.018, 0.825)
        palm_end = p(sign * 0.355, -0.028, 0.745)
        hip = p(sign * 0.125, 0.010, 0.925)
        knee = p(sign * 0.138, -0.026, 0.475)
        ankle = p(sign * 0.136, -0.004, 0.095)
        foot_end = p(sign * 0.136, -0.170, 0.040)
        toe_end = p(sign * 0.136, -0.235, 0.032)

        # Required deformation arm and leg chains.
        specs.extend(
            (
                BoneSpec(
                    f"clavicle_{side}",
                    p(0.0, 0.006, 1.40),
                    shoulder,
                    "chest",
                    True,
                ),
                BoneSpec(f"upper_arm_{side}", shoulder, elbow, f"clavicle_{side}", True),
                BoneSpec(f"forearm_{side}", elbow, wrist, f"upper_arm_{side}", True),
                BoneSpec(f"hand_{side}", wrist, palm_end, f"forearm_{side}", True),
                BoneSpec(f"thigh_{side}", hip, knee, "pelvis"),
                BoneSpec(f"shin_{side}", knee, ankle, f"thigh_{side}", True),
                BoneSpec(f"foot_{side}", ankle, foot_end, f"shin_{side}", True),
                BoneSpec(f"toe_{side}", foot_end, toe_end, f"foot_{side}", True),
            )
        )

        # Animator-facing FK arm controls.  The independent duplicate chain is
        # intentional: animation modules key these controls, while deform bones
        # remain driven output bones for export/weighting.
        specs.extend(
            (
                BoneSpec(
                    f"upper_arm_fk_{side}", shoulder, elbow, f"clavicle_{side}", True,
                    False, group="FK Controls",
                ),
                BoneSpec(
                    f"forearm_fk_{side}", elbow, wrist, f"upper_arm_fk_{side}", True,
                    False, group="FK Controls",
                ),
                BoneSpec(
                    f"hand_fk_{side}", wrist, palm_end, f"forearm_fk_{side}", True,
                    False, group="FK Controls",
                ),
            )
        )

        # Hidden two-bone arm IK mechanism plus hand and pole controls.
        specs.extend(
            (
                BoneSpec(
                    f"upper_arm_ik_{side}", shoulder, elbow, f"clavicle_{side}", True,
                    False, group="Mechanism",
                ),
                BoneSpec(
                    f"forearm_ik_{side}", elbow, wrist, f"upper_arm_ik_{side}", True,
                    False, group="Mechanism",
                ),
                BoneSpec(
                    f"hand_ik_{side}", wrist, palm_end, "root", False,
                    False, group="IK Controls",
                ),
                BoneSpec(
                    f"elbow_pole_{side}",
                    p(sign * 0.264, -0.365, 1.09),
                    p(sign * 0.264, -0.365, 1.18),
                    "root",
                    False,
                    False,
                    group="IK Controls",
                ),
            )
        )

        # Animator-facing FK leg controls.
        specs.extend(
            (
                BoneSpec(
                    f"thigh_fk_{side}", hip, knee, "pelvis", False,
                    False, group="FK Controls",
                ),
                BoneSpec(
                    f"shin_fk_{side}", knee, ankle, f"thigh_fk_{side}", True,
                    False, group="FK Controls",
                ),
                BoneSpec(
                    f"foot_fk_{side}", ankle, foot_end, f"shin_fk_{side}", True,
                    False, group="FK Controls",
                ),
                BoneSpec(
                    f"toe_fk_{side}", foot_end, toe_end, f"foot_fk_{side}", True,
                    False, group="FK Controls",
                ),
            )
        )

        # Hidden two-bone leg IK mechanism plus foot, toe, and knee controls.
        specs.extend(
            (
                BoneSpec(
                    f"thigh_ik_{side}", hip, knee, "pelvis", False,
                    False, group="Mechanism",
                ),
                BoneSpec(
                    f"shin_ik_{side}", knee, ankle, f"thigh_ik_{side}", True,
                    False, group="Mechanism",
                ),
                BoneSpec(
                    f"foot_ik_{side}", ankle, foot_end, "root", False,
                    False, group="IK Controls",
                ),
                BoneSpec(
                    f"toe_ik_{side}", foot_end, toe_end, f"foot_ik_{side}", True,
                    False, group="IK Controls",
                ),
                BoneSpec(
                    f"knee_pole_{side}",
                    p(sign * 0.138, -0.365, 0.475),
                    p(sign * 0.138, -0.365, 0.565),
                    "root",
                    False,
                    False,
                    group="IK Controls",
                ),
            )
        )

        # Each digit has exactly three named deformation phalanges.  First bones
        # are offset from the palm and intentionally not connected to the hand.
        # ``body.py`` lays the four fingers by absolute X from the pinky side to
        # the thumb side.  Anatomically, index is adjacent to the thumb (largest
        # absolute X), then middle, ring, and pinky; retain that mapping on both
        # mirrored hands so weighting follows the generated vertices.
        finger_layout = {
            "index": (0.341, -0.029, 0.746, 0.070),
            "middle": (0.324, -0.028, 0.746, 0.085),
            "ring": (0.306, -0.028, 0.746, 0.080),
            "pinky": (0.289, -0.027, 0.746, 0.066),
        }
        for finger in ("index", "middle", "ring", "pinky"):
            abs_x, base_y, base_z, length = finger_layout[finger]
            splay = {
                "index": 0.004,
                "middle": 0.001,
                "ring": -0.001,
                "pinky": -0.004,
            }[finger]
            joints = tuple(
                p(
                    sign * (abs_x + splay * fraction),
                    base_y - 0.006 * fraction,
                    base_z - length * fraction,
                )
                for fraction in (0.0, 0.35, 0.68, 1.0)
            )
            for segment_index, segment in enumerate(PHALANGES):
                specs.append(
                    BoneSpec(
                        f"{finger}_{segment}_{side}",
                        joints[segment_index],
                        joints[segment_index + 1],
                        f"hand_{side}" if segment_index == 0 else f"{finger}_{PHALANGES[segment_index - 1]}_{side}",
                        segment_index > 0,
                    )
                )

        thumb_joints = (
            p(sign * 0.338, -0.024, 0.800),
            p(sign * 0.347, -0.030, 0.781),
            p(sign * 0.356, -0.036, 0.760),
            p(sign * 0.365, -0.040, 0.740),
        )
        for segment_index, segment in enumerate(PHALANGES):
            specs.append(
                BoneSpec(
                    f"thumb_{segment}_{side}",
                    thumb_joints[segment_index],
                    thumb_joints[segment_index + 1],
                    f"hand_{side}" if segment_index == 0 else f"thumb_{PHALANGES[segment_index - 1]}_{side}",
                    segment_index > 0,
                )
            )

    _validate_specs(specs)
    return tuple(specs)


def _validate_specs(specs: Sequence[BoneSpec]) -> None:
    names = [spec.name for spec in specs]
    duplicates = sorted(name for name in set(names) if names.count(name) > 1)
    if duplicates:
        raise RigBuildError(f"Duplicate bone declarations: {', '.join(duplicates)}")
    known: set[str] = set()
    for spec in specs:
        if spec.parent is not None and spec.parent not in known:
            raise RigBuildError(f"Bone {spec.name!r} references undeclared parent {spec.parent!r}")
        length_squared = sum((tail - head) ** 2 for head, tail in zip(spec.head, spec.tail))
        if length_squared <= 1.0e-12:
            raise RigBuildError(f"Bone {spec.name!r} has zero rest length")
        if spec.connected and spec.parent is None:
            raise RigBuildError(f"Connected bone {spec.name!r} has no parent")
        known.add(spec.name)


def _capture_context() -> _ContextState:
    view_layer = bpy.context.view_layer
    active = view_layer.objects.active
    return _ContextState(
        active=active,
        selected=tuple(obj for obj in view_layer.objects if obj.select_get()),
        mode=active.mode if active is not None else "OBJECT",
    )


def _is_live_object(value: object | None) -> bool:
    if value is None:
        return False


def _is_in_view_layer(value: object | None) -> bool:
    if not _is_live_object(value):
        return False
    try:
        return bpy.context.view_layer.objects.get(value.name) is value
    except (AttributeError, ReferenceError):
        return False
    try:
        return bpy.data.objects.get(value.name) is value
    except (AttributeError, ReferenceError):
        return False


def _set_mode(obj: bpy.types.Object, mode: str) -> None:
    """Set mode with an explicit Blender context override."""

    if obj.mode == mode:
        return
    try:
        view_layer = bpy.context.view_layer
        view_layer.objects.active = obj
        if not obj.select_get():
            obj.select_set(True)
        override = {
            "active_object": obj,
            "object": obj,
            "selected_objects": [obj],
            "selected_editable_objects": [obj],
        }
        with bpy.context.temp_override(**override):
            result = bpy.ops.object.mode_set(mode=mode)
    except (AttributeError, ReferenceError, RuntimeError, TypeError) as exc:
        raise RigBuildError(f"Could not put {obj.name!r} in {mode} mode: {exc}") from exc
    if "FINISHED" not in result:
        raise RigBuildError(f"Blender rejected {mode} mode for {obj.name!r}: {result}")


def _ensure_object_mode() -> None:
    active = bpy.context.view_layer.objects.active
    if active is not None and active.mode != "OBJECT":
        _set_mode(active, "OBJECT")


def _select_only(obj: bpy.types.Object) -> None:
    _ensure_object_mode()
    view_layer = bpy.context.view_layer
    for candidate in view_layer.objects:
        if candidate.select_get():
            candidate.select_set(False)
    obj.hide_set(False)
    obj.select_set(True)
    view_layer.objects.active = obj


def _restore_context(state: _ContextState) -> None:
    """Best-effort restoration that never masks the original build exception."""

    try:
        _ensure_object_mode()
        view_layer = bpy.context.view_layer
        for candidate in view_layer.objects:
            if candidate.select_get():
                candidate.select_set(False)
        for selected in state.selected:
            if _is_in_view_layer(selected):
                try:
                    selected.select_set(True)
                except RuntimeError:
                    pass
        if _is_in_view_layer(state.active):
            view_layer.objects.active = state.active
            if not state.active.select_get():
                state.active.select_set(True)
            if state.mode != "OBJECT":
                _set_mode(state.active, state.mode)
        else:
            view_layer.objects.active = None
    except (ReferenceError, RigBuildError, RuntimeError):
        # Context restoration is deliberately best effort.  The rig itself has
        # already been built or its original datablock restored transactionally.
        pass


def _resolve_collection(collection: bpy.types.Collection | str | None) -> bpy.types.Collection:
    if collection is None:
        return bpy.context.scene.collection
    if isinstance(collection, str):
        resolved = bpy.data.collections.get(collection)
        if resolved is None:
            raise RigBuildError(f"Collection {collection!r} does not exist")
        return resolved
    if not isinstance(collection, bpy.types.Collection):
        raise TypeError("collection must be a Blender Collection, its name, or None")
    return collection


def _build_edit_bones(rig: bpy.types.Object, specs: Sequence[BoneSpec]) -> None:
    _select_only(rig)
    _set_mode(rig, "EDIT")
    edit_bones = rig.data.edit_bones
    for old_bone in tuple(edit_bones):
        edit_bones.remove(old_bone)
    created: dict[str, bpy.types.EditBone] = {}
    for spec in specs:
        bone = edit_bones.new(spec.name)
        bone.head = spec.head
        bone.tail = spec.tail
        bone.roll = spec.roll
        bone.use_deform = spec.deform
        if spec.parent is not None:
            bone.parent = created[spec.parent]
            bone.use_connect = spec.connected
        created[spec.name] = bone
    _set_mode(rig, "OBJECT")


def _ensure_bone_collection(armature: bpy.types.Armature, name: str):
    collection = armature.collections.get(name)
    if collection is None:
        collection = armature.collections.new(name)
    return collection


def _organize_bones(rig: bpy.types.Object, specs: Sequence[BoneSpec]) -> None:
    """Use Blender 4 bone collections and hide only mechanism bones."""

    groups = {spec.group for spec in specs}
    collections = {name: _ensure_bone_collection(rig.data, name) for name in groups}
    for spec in specs:
        bone = rig.data.bones.get(spec.name)
        if bone is None:
            raise RigBuildError(f"Bone {spec.name!r} disappeared after Edit Mode")
        target_collection = collections[spec.group]
        # Blender creates a default bone collection on new armatures.  Unassign
        # first so mechanism visibility is not accidentally overridden by that
        # collection; ``collections`` is a read-only tuple of memberships.
        for current_collection in tuple(getattr(bone, "collections", ())):
            if current_collection != target_collection:
                try:
                    current_collection.unassign(bone)
                except (AttributeError, RuntimeError):
                    pass
        memberships = tuple(getattr(bone, "collections", ()))
        if target_collection not in memberships:
            try:
                target_collection.assign(bone)
            except (AttributeError, RuntimeError) as exc:
                raise RigBuildError(
                    f"Could not assign bone {spec.name!r} to collection {spec.group!r}: {exc}"
                ) from exc
        bone.hide = spec.group == "Mechanism"
    mechanism_collection = collections.get("Mechanism")
    if mechanism_collection is not None:
        try:
            mechanism_collection.is_visible = False
        except (AttributeError, RuntimeError, TypeError):
            # Per-bone ``hide`` above remains the fallback on Blender builds where
            # collection visibility is read-only or unavailable.
            pass


def _clear_generated_drivers(rig: bpy.types.Object) -> None:
    animation_data = rig.animation_data
    if animation_data is None:
        return
    for fcurve in tuple(animation_data.drivers):
        if '.constraints["ASTRA_' in fcurve.data_path:
            animation_data.drivers.remove(fcurve)


def _generated_constraint_drivers(rig: bpy.types.Object) -> tuple[bpy.types.FCurve, ...]:
    animation_data = rig.animation_data
    if animation_data is None:
        return ()
    return tuple(
        fcurve
        for fcurve in animation_data.drivers
        if '.constraints["ASTRA_' in fcurve.data_path
    )


def _clear_generated_constraints(pose_bone: bpy.types.PoseBone) -> None:
    for constraint in tuple(pose_bone.constraints):
        if constraint.name.startswith("ASTRA_"):
            pose_bone.constraints.remove(constraint)


def _set_blend_property(pose_bone: bpy.types.PoseBone, description: str) -> None:
    # FK is the neutral authoring mode: direct rotations on the animator-facing
    # FK chains work immediately, while switching to IK remains an explicit act.
    pose_bone[IK_FK_PROPERTY] = 0.0
    try:
        pose_bone.id_properties_ui(IK_FK_PROPERTY).update(
            default=0.0,
            min=0.0,
            max=1.0,
            soft_min=0.0,
            soft_max=1.0,
            description=description,
        )
    except (AttributeError, TypeError):
        # Blender 4.x supports the UI metadata API.  Keeping the numeric custom
        # property still leaves the rig functional if a reduced API build omits it.
        pass


def _rna_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _drive_constraint_influence(
    constraint: bpy.types.Constraint,
    rig: bpy.types.Object,
    control_name: str,
    inverse: bool,
) -> None:
    fcurve = constraint.driver_add("influence")
    driver = fcurve.driver
    driver.type = "SCRIPTED"
    variable = driver.variables.new()
    variable.name = "blend"
    variable.type = "SINGLE_PROP"
    target = variable.targets[0]
    target.id_type = "OBJECT"
    target.id = rig
    target.data_path = (
        f'pose.bones["{_rna_string(control_name)}"]'
        f'["{_rna_string(IK_FK_PROPERTY)}"]'
    )
    driver.expression = "1.0 - blend" if inverse else "blend"


def _copy_transforms(
    owner: bpy.types.PoseBone,
    rig: bpy.types.Object,
    subtarget: str,
    name: str,
    blend_control: str,
    inverse: bool,
) -> bpy.types.Constraint:
    constraint = owner.constraints.new("COPY_TRANSFORMS")
    constraint.name = name
    constraint.target = rig
    constraint.subtarget = subtarget
    constraint.target_space = "LOCAL"
    constraint.owner_space = "LOCAL"
    constraint.influence = 1.0 if inverse else 0.0
    if hasattr(constraint, "mix_mode"):
        constraint.mix_mode = "REPLACE"
    # FK is active when blend=0, IK when blend=1.
    _drive_constraint_influence(constraint, rig, blend_control, inverse)
    return constraint


def _ik_constraint(
    owner: bpy.types.PoseBone,
    rig: bpy.types.Object,
    target_name: str,
    pole_name: str,
    pole_angle: float,
) -> bpy.types.Constraint:
    constraint = owner.constraints.new("IK")
    constraint.name = "ASTRA_LIMB_IK"
    constraint.target = rig
    constraint.subtarget = target_name
    constraint.pole_target = rig
    constraint.pole_subtarget = pole_name
    constraint.chain_count = 2
    constraint.pole_angle = pole_angle
    # These RNA fields are present in Blender 4.x, but probing keeps the module
    # importable/testable against reduced Blender Python stubs and future builds.
    for property_name, value in (
        # The IK control head is authored at the wrist/ankle, matching the tail
        # of the constrained forearm/shin.  Include that tail as the effector.
        ("use_tail", True),
        ("use_stretch", False),
        ("use_rotation", True),
    ):
        if hasattr(constraint, property_name):
            try:
                setattr(constraint, property_name, value)
            except (AttributeError, RuntimeError, TypeError):
                pass
    return constraint


def _configure_pose(rig: bpy.types.Object) -> None:
    _clear_generated_drivers(rig)
    for pose_bone in rig.pose.bones:
        _clear_generated_constraints(pose_bone)
        pose_bone.rotation_mode = "QUATERNION"

    for side in SIDES:
        hand_control = rig.pose.bones.get(f"hand_ik_{side}")
        foot_control = rig.pose.bones.get(f"foot_ik_{side}")
        if hand_control is None or foot_control is None:
            raise RigBuildError(f"Missing IK blend control for side {side}")
        _set_blend_property(hand_control, "Arm FK (0.0) to IK (1.0) blend")
        _set_blend_property(foot_control, "Leg FK (0.0) to IK (1.0) blend")

        # Side-dependent pole angles preserve mirrored limb roll.
        arm_pole_angle = -math.pi * 0.5 if side == "L" else math.pi * 0.5
        leg_pole_angle = 0.0
        _ik_constraint(
            rig.pose.bones[f"forearm_ik_{side}"],
            rig,
            f"hand_ik_{side}",
            f"elbow_pole_{side}",
            arm_pole_angle,
        )
        _ik_constraint(
            rig.pose.bones[f"shin_ik_{side}"],
            rig,
            f"foot_ik_{side}",
            f"knee_pole_{side}",
            leg_pole_angle,
        )

        for deform, fk, ik in (
            (f"upper_arm_{side}", f"upper_arm_fk_{side}", f"upper_arm_ik_{side}"),
            (f"forearm_{side}", f"forearm_fk_{side}", f"forearm_ik_{side}"),
            (f"hand_{side}", f"hand_fk_{side}", f"hand_ik_{side}"),
        ):
            owner = rig.pose.bones[deform]
            _copy_transforms(owner, rig, fk, "ASTRA_FK_COPY", f"hand_ik_{side}", True)
            _copy_transforms(owner, rig, ik, "ASTRA_IK_COPY", f"hand_ik_{side}", False)

        for deform, fk, ik in (
            (f"thigh_{side}", f"thigh_fk_{side}", f"thigh_ik_{side}"),
            (f"shin_{side}", f"shin_fk_{side}", f"shin_ik_{side}"),
            (f"foot_{side}", f"foot_fk_{side}", f"foot_ik_{side}"),
            (f"toe_{side}", f"toe_fk_{side}", f"toe_ik_{side}"),
        ):
            owner = rig.pose.bones[deform]
            _copy_transforms(owner, rig, fk, "ASTRA_FK_COPY", f"foot_ik_{side}", True)
            _copy_transforms(owner, rig, ik, "ASTRA_IK_COPY", f"foot_ik_{side}", False)

    rig["astra_rig_version"] = RIG_VERSION
    rig["astra_rig_coordinate_system"] = "Z-up; facing -Y; L=+X"
    rig["astra_rig_fps"] = 60
    rig["astra_rig_extension_parent"] = "head"
    rig["astra_rig_extension_policy"] = "Hair/secondary bones may extend this armature"
    rig.data["astra_generated"] = True


def _new_build_object() -> bpy.types.Object:
    data = bpy.data.armatures.new(f".{RIG_NAME}_BUILD_DATA")
    data.display_type = "OCTAHEDRAL"
    data["astra_generated"] = True
    obj = bpy.data.objects.new(f".{RIG_NAME}_BUILD_OBJECT", data)
    bpy.context.scene.collection.objects.link(obj)
    obj.show_in_front = True
    return obj


def _remove_object_and_orphan_data(obj: bpy.types.Object | None) -> None:
    if not _is_live_object(obj):
        return
    data = obj.data if obj.type == "ARMATURE" else None
    bpy.data.objects.remove(obj, do_unlink=True)
    if data is not None and data.users == 0:
        bpy.data.armatures.remove(data)


def _prepare_destination(
    build_object: bpy.types.Object,
    name: str,
    collection: bpy.types.Collection,
    rebuild: bool,
) -> tuple[bpy.types.Object, bpy.types.Armature | None, bool]:
    existing = bpy.data.objects.get(name)
    if existing is not None and existing.type != "ARMATURE":
        raise RigBuildError(
            f"Object {name!r} exists but is {existing.type}, not an armature; refusing to replace it"
        )
    if existing is not None and not rebuild:
        return existing, None, False

    if existing is None:
        build_object.name = name
        build_object.data.name = f"{name}_ARMATURE"
        if collection not in build_object.users_collection:
            collection.objects.link(build_object)
        for owner_collection in tuple(build_object.users_collection):
            if owner_collection != collection:
                owner_collection.objects.unlink(build_object)
        return build_object, None, True

    old_data = existing.data
    existing.data = build_object.data
    existing.data.name = f"{name}_ARMATURE"
    bpy.data.objects.remove(build_object, do_unlink=True)
    if collection not in existing.users_collection:
        collection.objects.link(existing)
    return existing, old_data, False


def _rollback_destination(
    rig: bpy.types.Object | None,
    old_data: bpy.types.Armature | None,
    was_new: bool,
) -> None:
    if rig is None or not _is_live_object(rig):
        return
    failed_data = rig.data if rig.type == "ARMATURE" else None
    if old_data is not None:
        rig.data = old_data
        if failed_data is not None and failed_data.users == 0:
            bpy.data.armatures.remove(failed_data)
    elif was_new:
        _remove_object_and_orphan_data(rig)


def build_humanoid_rig(
    name: str = RIG_NAME,
    *,
    collection: bpy.types.Collection | str | None = None,
    scale: float = 1.0,
    rebuild: bool = False,
    validate: bool = True,
    require_approval: bool = True,
) -> bpy.types.Object:
    """Create or transactionally rebuild the complete humanoid armature.

    Parameters
    ----------
    name:
        Destination armature object name.  An existing non-armature is never
        deleted or renamed.
    collection:
        Existing Blender collection (or its name).  Defaults to the scene root.
    scale:
        Uniform multiplier for the authored 1.70 m rest coordinates.
    rebuild:
        If false and a same-named armature exists, validate and return it without
        mutation.  If true, preserve the object identity and atomically replace
        its armature datablock, keeping mesh modifiers and object references valid.
        For safety, only an armature datablock tagged by this generator may be
        rebuilt; a same-named user armature is left untouched.  The safe default
        also preserves hair/secondary bones that later phases add to this rig.
    validate:
        Raise :class:`RigValidationError` if the result fails the contract.
    require_approval:
        Require the repository's explicit HUMAN_BASE visual approval record
        before any Blender datablock is created.  Disable only for isolated rig
        schema tests in an empty disposable scene, never for the character build.

    The function does not bind meshes, create animations, set the scene frame
    rate, save, render, or run on import.  Those are explicit later pipeline steps.
    """

    if not isinstance(name, str) or not name.strip():
        raise ValueError("name must be a non-empty string")
    if require_approval:
        _require_approved_body_stage()
    destination_collection = _resolve_collection(collection)
    specs = _bone_specs(scale)
    state = _capture_context()
    build_object: bpy.types.Object | None = None
    rig: bpy.types.Object | None = None
    old_data: bpy.types.Armature | None = None
    was_new = False
    destination_preexisted = bpy.data.objects.get(name) is not None

    try:
        _ensure_object_mode()
        existing = bpy.data.objects.get(name)
        if existing is not None and existing.type != "ARMATURE":
            raise RigBuildError(
                f"Object {name!r} exists but is {existing.type}, not an armature"
            )
        if (
            existing is not None
            and rebuild
            and not existing.data.get("astra_generated", False)
        ):
            raise RigBuildError(
                f"Armature {name!r} is not tagged as Astra-generated; refusing "
                "a destructive datablock rebuild. Use a distinct name instead."
            )
        if existing is not None and not rebuild:
            if validate:
                validate_humanoid_rig(existing, raise_on_error=True)
            print(f"[RIG] Reusing validated armature {existing.name}; no datablocks changed")
            return existing

        build_object = _new_build_object()
        _build_edit_bones(build_object, specs)
        _organize_bones(build_object, specs)
        rig, old_data, was_new = _prepare_destination(
            build_object, name, destination_collection, rebuild
        )
        build_object = None
        _select_only(rig)
        _configure_pose(rig)
        if validate:
            validate_humanoid_rig(rig, raise_on_error=True)

        # Remove only an obsolete, generator-owned datablock after success.
        if old_data is not None and old_data.users == 0 and old_data.get("astra_generated", False):
            bpy.data.armatures.remove(old_data)
        print(
            f"[RIG] Built {rig.name}: {len(rig.data.bones)} bones, "
            f"{len(REQUIRED_DEFORM_BONES)} required deform bones, FK/IK ready"
        )
        return rig
    except Exception:
        if rig is not None:
            _rollback_destination(rig, old_data, was_new and not destination_preexisted)
        if build_object is not None:
            _remove_object_and_orphan_data(build_object)
        raise
    finally:
        _restore_context(state)


def _resolve_rig(rig: bpy.types.Object | str | None) -> bpy.types.Object | None:
    if rig is None:
        return bpy.data.objects.get(RIG_NAME)
    if isinstance(rig, str):
        return bpy.data.objects.get(rig)
    return rig


def _constraint_matches(
    pose_bone: bpy.types.PoseBone | None,
    constraint_type: str,
    subtarget: str,
    pole_subtarget: str | None = None,
) -> bool:
    if pose_bone is None:
        return False
    for constraint in pose_bone.constraints:
        if constraint.type != constraint_type or constraint.subtarget != subtarget:
            continue
        if pole_subtarget is not None and getattr(constraint, "pole_subtarget", "") != pole_subtarget:
            continue
        return True
    return False


def validate_humanoid_rig(
    rig: bpy.types.Object | str | None = None,
    *,
    raise_on_error: bool = False,
) -> dict[str, object]:
    """Return a detailed validation report for an Astra humanoid armature."""

    resolved = _resolve_rig(rig)
    issues: list[str] = []
    if resolved is None:
        issues.append("Rig object does not exist")
        report = {
            "ok": False,
            "rig": None,
            "bone_count": 0,
            "deform_bone_count": 0,
            "missing_bones": list(REQUIRED_DEFORM_BONES + REQUIRED_CONTROL_BONES + REQUIRED_MECHANISM_BONES),
            "issues": issues,
        }
        if raise_on_error:
            raise RigValidationError("Rig validation failed: Rig object does not exist")
        return report
    if resolved.type != "ARMATURE":
        issues.append(f"Object {resolved.name!r} is {resolved.type}, not ARMATURE")
        report = {
            "ok": False,
            "rig": resolved.name,
            "bone_count": 0,
            "deform_bone_count": 0,
            "missing_bones": [],
            "issues": issues,
        }
        if raise_on_error:
            raise RigValidationError("Rig validation failed: " + "; ".join(issues))
        return report

    all_required = REQUIRED_DEFORM_BONES + REQUIRED_CONTROL_BONES + REQUIRED_MECHANISM_BONES
    missing = sorted(name for name in all_required if resolved.data.bones.get(name) is None)
    if missing:
        issues.append("Missing bones: " + ", ".join(missing))

    zero_length = sorted(
        bone.name for bone in resolved.data.bones if bone.length <= 1.0e-7
    )
    if zero_length:
        issues.append("Zero-length bones: " + ", ".join(zero_length))

    incorrect_deform = sorted(
        name
        for name in REQUIRED_DEFORM_BONES
        if resolved.data.bones.get(name) is not None and not resolved.data.bones[name].use_deform
    )
    nondeform_controls = REQUIRED_CONTROL_BONES + REQUIRED_MECHANISM_BONES
    incorrect_controls = sorted(
        name
        for name in nondeform_controls
        if resolved.data.bones.get(name) is not None and resolved.data.bones[name].use_deform
    )
    if incorrect_deform:
        issues.append("Required deform bones disabled: " + ", ".join(incorrect_deform))
    if incorrect_controls:
        issues.append("Control/mechanism bones incorrectly deform: " + ", ".join(incorrect_controls))

    # Validate the core hierarchy but deliberately tolerate extension bones added
    # later by hair/accessory rig modules.
    expected_parents = {spec.name: spec.parent for spec in _bone_specs(1.0)}
    parent_mismatches: list[str] = []
    for name, expected in expected_parents.items():
        bone = resolved.data.bones.get(name)
        if bone is None:
            continue
        actual = bone.parent.name if bone.parent is not None else None
        if actual != expected:
            parent_mismatches.append(f"{name} ({actual!r} != {expected!r})")
    if parent_mismatches:
        issues.append("Parent mismatches: " + ", ".join(parent_mismatches))

    missing_constraints: list[str] = []
    invalid_constraints: list[str] = []
    for side in SIDES:
        arm_ik_owner = resolved.pose.bones.get(f"forearm_ik_{side}")
        leg_ik_owner = resolved.pose.bones.get(f"shin_ik_{side}")
        if not _constraint_matches(
            arm_ik_owner,
            "IK",
            f"hand_ik_{side}",
            f"elbow_pole_{side}",
        ):
            missing_constraints.append(f"arm IK {side}")
        if not _constraint_matches(
            leg_ik_owner,
            "IK",
            f"foot_ik_{side}",
            f"knee_pole_{side}",
        ):
            missing_constraints.append(f"leg IK {side}")
        for label, owner in ((f"arm IK {side}", arm_ik_owner), (f"leg IK {side}", leg_ik_owner)):
            if owner is None:
                continue
            for constraint in owner.constraints:
                if constraint.type == "IK" and constraint.name == "ASTRA_LIMB_IK":
                    if constraint.chain_count != 2:
                        invalid_constraints.append(f"{label} chain_count={constraint.chain_count}")
                    if getattr(constraint, "pole_target", None) is not resolved:
                        invalid_constraints.append(f"{label} pole target")
        for owner, fk, ik in (
            (f"upper_arm_{side}", f"upper_arm_fk_{side}", f"upper_arm_ik_{side}"),
            (f"forearm_{side}", f"forearm_fk_{side}", f"forearm_ik_{side}"),
            (f"hand_{side}", f"hand_fk_{side}", f"hand_ik_{side}"),
            (f"thigh_{side}", f"thigh_fk_{side}", f"thigh_ik_{side}"),
            (f"shin_{side}", f"shin_fk_{side}", f"shin_ik_{side}"),
            (f"foot_{side}", f"foot_fk_{side}", f"foot_ik_{side}"),
            (f"toe_{side}", f"toe_fk_{side}", f"toe_ik_{side}"),
        ):
            pose_bone = resolved.pose.bones.get(owner)
            if not _constraint_matches(pose_bone, "COPY_TRANSFORMS", fk):
                missing_constraints.append(f"{owner} FK copy")
            if not _constraint_matches(pose_bone, "COPY_TRANSFORMS", ik):
                missing_constraints.append(f"{owner} IK copy")
        for control_name in (f"hand_ik_{side}", f"foot_ik_{side}"):
            control = resolved.pose.bones.get(control_name)
            if control is None or IK_FK_PROPERTY not in control:
                missing_constraints.append(f"{control_name}.{IK_FK_PROPERTY}")
    if missing_constraints:
        issues.append("Missing rig behavior: " + ", ".join(missing_constraints))

    for owner_name in (
        *(f"forearm_ik_{side}" for side in SIDES),
        *(f"shin_ik_{side}" for side in SIDES),
        *(
            name
            for side in SIDES
            for name in (
                f"upper_arm_{side}", f"forearm_{side}", f"hand_{side}",
                f"thigh_{side}", f"shin_{side}", f"foot_{side}", f"toe_{side}",
            )
        ),
    ):
        pose_bone = resolved.pose.bones.get(owner_name)
        if pose_bone is None:
            continue
        for constraint in pose_bone.constraints:
            if not constraint.name.startswith("ASTRA_"):
                continue
            target = getattr(constraint, "target", None)
            if target is not resolved:
                invalid_constraints.append(f"{owner_name}.{constraint.name} target")
            if hasattr(constraint, "is_valid") and not constraint.is_valid:
                invalid_constraints.append(f"{owner_name}.{constraint.name} invalid")
    if invalid_constraints:
        issues.append("Invalid constraints: " + ", ".join(sorted(set(invalid_constraints))))

    generated_drivers = _generated_constraint_drivers(resolved)
    expected_driver_count = 28  # FK + IK copies on 7 deform bones per side.
    if len(generated_drivers) != expected_driver_count:
        issues.append(
            f"Expected {expected_driver_count} FK/IK influence drivers, "
            f"found {len(generated_drivers)}"
        )

    finger_count = sum(
        1
        for side in SIDES
        for finger in FINGERS
        for segment in PHALANGES
        if resolved.data.bones.get(f"{finger}_{segment}_{side}") is not None
    )
    if finger_count != 30:
        issues.append(f"Expected 30 finger phalanges, found {finger_count}")

    deform_bone_count = sum(1 for bone in resolved.data.bones if bone.use_deform)
    report: dict[str, object] = {
        "ok": not issues,
        "rig": resolved.name,
        "rig_version": resolved.get("astra_rig_version"),
        "bone_count": len(resolved.data.bones),
        "deform_bone_count": deform_bone_count,
        "finger_phalange_count": finger_count,
        "missing_bones": missing,
        "issues": issues,
    }
    if raise_on_error and issues:
        raise RigValidationError("Rig validation failed: " + "; ".join(issues))
    return report


def set_ik_fk_blend(
    rig: bpy.types.Object | str,
    *,
    side: str,
    arm: float | None = None,
    leg: float | None = None,
) -> None:
    """Set arm/leg FK-to-IK blends without relying on UI context.

    ``0.0`` is FK and ``1.0`` is IK.  This helper deliberately does not snap the
    controls; animation code can keyframe the same properties explicitly.
    """

    resolved = _resolve_rig(rig)
    if resolved is None or resolved.type != "ARMATURE":
        raise RigBuildError("set_ik_fk_blend requires an existing armature")
    normalized_side = side.upper()
    if normalized_side not in SIDES:
        raise ValueError("side must be 'L' or 'R'")
    values = (
        (arm, f"hand_ik_{normalized_side}"),
        (leg, f"foot_ik_{normalized_side}"),
    )
    for value, control_name in values:
        if value is None:
            continue
        numeric = float(value)
        if not math.isfinite(numeric):
            raise ValueError("IK/FK blend values must be finite")
        control = resolved.pose.bones.get(control_name)
        if control is None:
            raise RigBuildError(f"Missing blend control {control_name!r}")
        control[IK_FK_PROPERTY] = min(1.0, max(0.0, numeric))


def required_bone_names() -> tuple[str, ...]:
    """Return the stable full rig contract for skinning/animation modules."""

    return REQUIRED_DEFORM_BONES + REQUIRED_CONTROL_BONES + REQUIRED_MECHANISM_BONES


__all__ = (
    "BoneSpec",
    "FINGERS",
    "IK_FK_PROPERTY",
    "PHALANGES",
    "REQUIRED_CONTROL_BONES",
    "REQUIRED_DEFORM_BONES",
    "REQUIRED_MECHANISM_BONES",
    "RIG_NAME",
    "RIG_VERSION",
    "RigBuildError",
    "RigValidationError",
    "build_humanoid_rig",
    "required_bone_names",
    "set_ik_fk_blend",
    "validate_humanoid_rig",
)
