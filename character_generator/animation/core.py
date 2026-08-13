"""Deterministic Blender data-API builders for Astra H-08 actions.

The library is authored from scratch and never imports animation data.  Importing
this module is inert.  :func:`build_action_library` is the only mutating entry
point and is fail-closed behind the HUMAN_BASE approval record.

Blender 4.4 introduced layered actions and Blender 5 removed the legacy
``Action.fcurves`` API.  The small adapter below writes both representations,
allowing the same source to run on Blender 4.x and 5.x without context-sensitive
keyframe operators.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

import bpy
from mathutils import Euler

try:
    from ..pipeline_gate import HumanBaseGateError, require_human_base_approved
except ImportError:  # pragma: no cover - Blender script-directory imports.
    from pipeline_gate import HumanBaseGateError, require_human_base_approved

from .manifest import (
    ACTION_NAMES,
    ACTION_SPECS,
    ACTION_SPEC_BY_NAME,
    ANIMATION_BONE_CONTRACT,
    FPS,
    GENERATOR_ID,
    LOOPING_ACTIONS,
    ActionSpec,
)


ANIMATION_FPS = FPS
LOOP_ACTIONS = frozenset(LOOPING_ACTIONS)
FACIAL_CONTROL_DEFAULTS: dict[str, float] = {
    "face_blink_l": 0.0,
    "face_blink_r": 0.0,
    "face_blink_both": 0.0,
    "face_smile": 0.0,
    "face_angry": 0.0,
    "face_sad": 0.0,
    "face_surprised": 0.0,
    "face_mouth_open": 0.0,
}


class AnimationBuildError(RuntimeError):
    """Raised when an action cannot be authored without guessing rig state."""


@dataclass(frozen=True)
class BonePose:
    """One bone transform in pose-local space.

    Rotation values are XYZ radians and are converted to quaternions at write
    time.  Scale is intentionally absent: game actions never animate rest scale.
    """

    rotation: tuple[float, float, float] | None = None
    location: tuple[float, float, float] | None = None


@dataclass(frozen=True)
class PoseSample:
    frame: int
    bones: Mapping[str, BonePose]


@dataclass(frozen=True)
class ActionBuildResult:
    ok: bool
    status: str
    rig: str | None
    fps: int
    actions: Mapping[str, bpy.types.Action]
    created: tuple[str, ...]
    rebuilt: tuple[str, ...]
    missing_bones: tuple[str, ...]
    warnings: tuple[str, ...]

    def report(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "status": self.status,
            "rig": self.rig,
            "fps": self.fps,
            "actions": tuple(self.actions),
            "created": self.created,
            "rebuilt": self.rebuilt,
            "missing_bones": self.missing_bones,
            "warnings": self.warnings,
        }


@dataclass
class _BuildTransaction:
    """Rollback state for action-library construction."""

    created_actions: list[bpy.types.Action]
    action_backups: dict[str, bpy.types.Action]
    rig_properties: dict[str, object]
    timing: tuple[int, float]


def _backup_action(action: bpy.types.Action) -> bpy.types.Action:
    backup = action.copy()
    backup.name = f".{action.name}_ASTRA_ROLLBACK"
    backup.use_fake_user = False
    return backup


def _discard_action(action: bpy.types.Action) -> None:
    if action.users == 0:
        bpy.data.actions.remove(action)


def _rollback_action_build(
    rig: bpy.types.Object,
    scene: bpy.types.Scene,
    transaction: _BuildTransaction,
) -> None:
    for action in transaction.created_actions:
        if bpy.data.actions.get(action.name) is action and action.users == 0:
            bpy.data.actions.remove(action)
    for name, backup in transaction.action_backups.items():
        current = bpy.data.actions.get(name)
        if current is not None and current.users == 0:
            bpy.data.actions.remove(current)
        backup.name = name
        backup.use_fake_user = True
    for key, value in transaction.rig_properties.items():
        if value is _MISSING_PROPERTY:
            try:
                del rig[key]
            except KeyError:
                pass
        else:
            rig[key] = value
    scene.render.fps, scene.render.fps_base = transaction.timing


def _commit_action_build(transaction: _BuildTransaction) -> None:
    for backup in transaction.action_backups.values():
        _discard_action(backup)


_MISSING_PROPERTY = object()


def inspect_animation_target(
    rig: bpy.types.Object | str | None = None,
) -> dict[str, Any]:
    """Read-only target inspection with a useful absent-rig status."""

    resolved = bpy.data.objects.get(rig) if isinstance(rig, str) else rig
    if resolved is None:
        resolved = bpy.data.objects.get("ASTRA_RIG")
    if resolved is None:
        return {
            "ok": False,
            "status": "target-rig-absent",
            "rig": None,
            "missing_bones": list(ANIMATION_BONE_CONTRACT),
            "issues": ["ASTRA_RIG does not exist in the open scene"],
        }
    if resolved.type != "ARMATURE":
        return {
            "ok": False,
            "status": "target-is-not-armature",
            "rig": resolved.name,
            "missing_bones": [],
            "issues": [f"{resolved.name!r} is {resolved.type}, not ARMATURE"],
        }
    available = {bone.name for bone in resolved.data.bones}
    missing = sorted(set(ANIMATION_BONE_CONTRACT) - available)
    return {
        "ok": not missing,
        "status": "ready" if not missing else "rig-contract-incomplete",
        "rig": resolved.name,
        "missing_bones": missing,
        "issues": [] if not missing else ["Missing animation bones: " + ", ".join(missing)],
    }


def _require_rig(rig: bpy.types.Object | str | None) -> bpy.types.Object:
    inspection = inspect_animation_target(rig)
    if not inspection["ok"]:
        raise AnimationBuildError("; ".join(inspection["issues"]))
    resolved = bpy.data.objects.get(inspection["rig"])
    if resolved is None:  # Defensive against datablock mutation between checks.
        raise AnimationBuildError("Target armature disappeared during validation")
    return resolved


def _escape(name: str) -> str:
    return name.replace("\\", "\\\\").replace('"', '\\"')


def _pose_path(bone: str, property_name: str) -> str:
    return f'pose.bones["{_escape(bone)}"].{property_name}'


def _clear_action(action: bpy.types.Action) -> None:
    """Remove all authored channels while preserving action identity."""

    if hasattr(action, "layers"):
        for layer in tuple(action.layers):
            action.layers.remove(layer)
        for slot in tuple(action.slots):
            action.slots.remove(slot)
    elif hasattr(action, "fcurves"):
        for curve in tuple(action.fcurves):
            action.fcurves.remove(curve)
    for marker in tuple(action.pose_markers):
        action.pose_markers.remove(marker)


class _ActionWriter:
    """Version-adaptive F-Curve writer that never assigns the action to a rig."""

    def __init__(self, action: bpy.types.Action, rig_name: str) -> None:
        self.action = action
        self._curves: dict[tuple[str, int], bpy.types.FCurve] = {}
        self._layered = hasattr(action, "layers")
        if self._layered:
            slot = action.slots.new(id_type="OBJECT", name=rig_name)
            slot.name_display = rig_name
            layer = action.layers.new("Astra Motion")
            strip = layer.strips.new(type="KEYFRAME")
            self._channelbag = strip.channelbags.new(slot)
        else:
            self._channelbag = None

    def curve(self, path: str, index: int, group: str) -> bpy.types.FCurve:
        key = (path, index)
        curve = self._curves.get(key)
        if curve is not None:
            return curve
        if self._layered:
            curve = self._channelbag.fcurves.new(path, index=index, group_name=group)
        else:
            curve = self.action.fcurves.new(path, index=index, action_group=group)
        self._curves[key] = curve
        return curve

    def key(
        self,
        path: str,
        index: int,
        frame: float,
        value: float,
        group: str,
        interpolation: str,
    ) -> None:
        curve = self.curve(path, index, group)
        point = curve.keyframe_points.insert(float(frame), float(value), options={"FAST"})
        point.interpolation = interpolation
        point.handle_left_type = "AUTO_CLAMPED"
        point.handle_right_type = "AUTO_CLAMPED"

    def finish(self, loop: bool) -> None:
        for curve in self._curves.values():
            curve.update()
            curve.extrapolation = "CONSTANT"
            if loop:
                curve.modifiers.new(type="CYCLES")


def _rotation_keys(writer: _ActionWriter, bone: str, frame: int, xyz: Sequence[float]) -> None:
    quaternion = Euler(tuple(float(value) for value in xyz), "XYZ").to_quaternion()
    path = _pose_path(bone, "rotation_quaternion")
    for index, value in enumerate(quaternion):
        writer.key(path, index, frame, value, bone, "BEZIER")


def _location_keys(writer: _ActionWriter, bone: str, frame: int, xyz: Sequence[float]) -> None:
    path = _pose_path(bone, "location")
    for index, value in enumerate(xyz):
        writer.key(path, index, frame, value, bone, "BEZIER")


def _property_key(
    writer: _ActionWriter,
    bone: str,
    property_name: str,
    frame: int,
    value: float,
) -> None:
    path = f'pose.bones["{_escape(bone)}"]["{_escape(property_name)}"]'
    writer.key(path, 0, frame, value, bone, "CONSTANT")


def _ensure_facial_control_properties(rig: bpy.types.Object) -> None:
    head = rig.pose.bones.get("head")
    if head is None:
        return
    for name, default in FACIAL_CONTROL_DEFAULTS.items():
        if name not in head:
            head[name] = default
        try:
            head.id_properties_ui(name).update(
                default=default,
                min=0.0,
                max=1.0,
                soft_min=0.0,
                soft_max=1.0,
                description="Astra facial blend-shape control",
            )
        except (AttributeError, TypeError):
            pass


def _facial_control_keys(writer: _ActionWriter, spec: ActionSpec) -> None:
    """Author reusable head-bone controls; facial_rig connects them to keys."""

    for name in FACIAL_CONTROL_DEFAULTS:
        _property_key(writer, "head", name, spec.frame_start, 0.0)
        _property_key(writer, "head", name, spec.frame_end, 0.0)
    if spec.name == "Idle":
        blinks = ((54, 0.0), (57, 1.0), (60, 0.0), (132, 0.0), (135, 1.0), (138, 0.0))
        for frame, value in blinks:
            _property_key(writer, "head", "face_blink_both", frame, value)
    elif spec.name == "Idle_Breathing":
        blinks = ((80, 0.0), (83, 1.0), (86, 0.0), (185, 0.0), (188, 1.0), (191, 0.0))
        for frame, value in blinks:
            _property_key(writer, "head", "face_blink_both", frame, value)
    elif spec.name.startswith("Attack_"):
        middle = 1 + (spec.frame_end - 1) // 2
        _property_key(writer, "head", "face_angry", middle - 8, 0.0)
        _property_key(writer, "head", "face_angry", middle, 0.78)
        _property_key(writer, "head", "face_angry", min(spec.frame_end - 1, middle + 10), 0.24)
        _property_key(writer, "head", "face_mouth_open", middle, 0.42)
    elif spec.name == "Wave":
        _property_key(writer, "head", "face_smile", 22, 0.0)
        _property_key(writer, "head", "face_smile", 34, 0.52)
        _property_key(writer, "head", "face_smile", 102, 0.52)
    elif spec.name == "Look_Around":
        for frame, value in ((72, 0.0), (75, 1.0), (78, 0.0)):
            _property_key(writer, "head", "face_blink_both", frame, value)


def _hair_control_keyframes(spec: ActionSpec) -> tuple[int, ...]:
    start, end = spec.frame_start, spec.frame_end
    span = end - start
    if spec.name in {"Walk", "Run"}:
        return (
            start,
            start + span // 8,
            start + span // 4,
            start + 3 * span // 8,
            start + span // 2,
            start + 5 * span // 8,
            start + 3 * span // 4,
            start + 7 * span // 8,
            end,
        )
    if spec.name in {"Idle", "Idle_Breathing"}:
        return (start, start + span // 4, start + span // 2, start + 3 * span // 4, end)
    if spec.category in {"combat", "jump", "turn"}:
        return (start, start + span // 4, start + span // 2, start + 3 * span // 4, end)
    return (start, start + span // 2, end)


def _merge_pose(target: dict[str, BonePose], bone: str, pose: BonePose) -> None:
    previous = target.get(bone, BonePose())
    target[bone] = BonePose(
        rotation=pose.rotation if pose.rotation is not None else previous.rotation,
        location=pose.location if pose.location is not None else previous.location,
    )


def _sample(frame: int, **bones: BonePose) -> PoseSample:
    return PoseSample(frame, bones)


def _idle_samples(spec: ActionSpec, breathing: bool) -> list[PoseSample]:
    middle = 1 + (spec.frame_end - 1) // 2
    amplitude = 1.0 if breathing else 0.42
    samples: list[PoseSample] = []
    for frame, phase in ((1, 0.0), (middle, math.pi), (spec.frame_end, math.tau)):
        breath = math.sin(phase - math.pi * 0.5) * amplitude
        sway = math.sin(phase) * amplitude
        samples.append(
            _sample(
                frame,
                root=BonePose(location=(0.0, 0.0, 0.0)),
                pelvis=BonePose(rotation=(0.0, sway * 0.006, -sway * 0.010), location=(sway * 0.002, 0.0, breath * 0.002)),
                spine_01=BonePose(rotation=(breath * 0.010, 0.0, sway * 0.006)),
                spine_02=BonePose(rotation=(breath * 0.014, 0.0, -sway * 0.004)),
                spine_03=BonePose(rotation=(breath * 0.012, sway * 0.004, 0.0)),
                chest=BonePose(rotation=(breath * 0.018, 0.0, sway * 0.005)),
                neck=BonePose(rotation=(-breath * 0.007, sway * 0.006, -sway * 0.003)),
                head=BonePose(rotation=(breath * 0.004, -sway * 0.010, sway * 0.006)),
                clavicle_L=BonePose(rotation=(0.0, breath * 0.004, breath * 0.006)),
                clavicle_R=BonePose(rotation=(0.0, -breath * 0.004, -breath * 0.006)),
            )
        )
    return samples


def _walk_samples(spec: ActionSpec, run: bool) -> list[PoseSample]:
    frames = (1, 1 + (spec.frame_end - 1) // 4, 1 + (spec.frame_end - 1) // 2, 1 + 3 * (spec.frame_end - 1) // 4, spec.frame_end)
    amplitude = 0.82 if run else 0.52
    lift = 0.060 if run else 0.030
    samples: list[PoseSample] = []
    for index, frame in enumerate(frames):
        phase = math.tau * index / (len(frames) - 1)
        left = math.sin(phase)
        right = -left
        left_bend = max(0.0, -left)
        right_bend = max(0.0, -right)
        # The proof camera sees the locomotion from three-quarter view.  A
        # restrained 20-degree shoulder swing looked almost static there, so
        # keep a clear contralateral silhouette while staying below the armor
        # collision range used by the larger gesture clips.
        arm = 1.02 if run else 0.64
        hip = math.cos(phase)
        root_height = lift * (0.30 + 0.70 * abs(math.sin(phase)))
        samples.append(
            _sample(
                frame,
                root=BonePose(location=(0.0, 0.0, root_height)),
                pelvis=BonePose(rotation=(0.0, hip * 0.045, left * 0.060), location=(left * 0.010, 0.0, 0.0)),
                spine_01=BonePose(rotation=((0.16 if run else 0.03), 0.0, -left * 0.035)),
                spine_02=BonePose(rotation=((0.10 if run else 0.01), 0.0, -left * 0.025)),
                chest=BonePose(rotation=((0.06 if run else 0.0), 0.0, left * 0.080)),
                head=BonePose(rotation=(-(0.07 if run else 0.01), 0.0, -left * 0.025)),
                clavicle_L=BonePose(rotation=(0.0, 0.0, right * (0.045 if run else 0.028))),
                clavicle_R=BonePose(rotation=(0.0, 0.0, left * (0.045 if run else 0.028))),
                thigh_fk_L=BonePose(rotation=(left * amplitude, 0.0, 0.0)),
                thigh_fk_R=BonePose(rotation=(right * amplitude, 0.0, 0.0)),
                shin_fk_L=BonePose(rotation=(-left_bend * (1.12 if run else 0.72), 0.0, 0.0)),
                shin_fk_R=BonePose(rotation=(-right_bend * (1.12 if run else 0.72), 0.0, 0.0)),
                foot_fk_L=BonePose(rotation=(-left * (0.24 if run else 0.15), 0.0, 0.0)),
                foot_fk_R=BonePose(rotation=(-right * (0.24 if run else 0.15), 0.0, 0.0)),
                toe_fk_L=BonePose(rotation=(max(0.0, left) * 0.16, 0.0, 0.0)),
                toe_fk_R=BonePose(rotation=(max(0.0, right) * 0.16, 0.0, 0.0)),
                upper_arm_fk_L=BonePose(rotation=(right * arm, 0.0, -0.070)),
                upper_arm_fk_R=BonePose(rotation=(left * arm, 0.0, 0.070)),
                forearm_fk_L=BonePose(rotation=(-0.30 - max(0.0, right) * (0.44 if run else 0.32), 0.0, 0.0)),
                forearm_fk_R=BonePose(rotation=(-0.30 - max(0.0, left) * (0.44 if run else 0.32), 0.0, 0.0)),
                hand_fk_L=BonePose(rotation=(right * 0.06, 0.0, -right * 0.035)),
                hand_fk_R=BonePose(rotation=(left * 0.06, 0.0, left * 0.035)),
            )
        )
    return samples


def _jump_samples(spec: ActionSpec, phase_name: str) -> list[PoseSample]:
    middle = 1 + (spec.frame_end - 1) // 2
    if phase_name == "Jump_Start":
        states = ((1, 0.0, 0.0), (middle, 1.0, -0.035), (spec.frame_end, 0.25, 0.080))
    elif phase_name == "Jump_Loop":
        states = ((1, 0.42, 0.0), (middle, 0.32, 0.014), (spec.frame_end, 0.42, 0.0))
    else:
        # Frame 20 is the release proof.  Make it the compression beat rather
        # than an interpolation towards recovery: hips drop, knees absorb the
        # impact and the torso counters forward before settling at frame 30.
        states = ((1, 0.25, 0.070), (10, 0.72, -0.035), (20, 1.25, -0.105), (spec.frame_end, 0.0, 0.0))
    samples: list[PoseSample] = []
    for frame, crouch, height in states:
        samples.append(
            _sample(
                frame,
                root=BonePose(location=(0.0, 0.0, height)),
                pelvis=BonePose(rotation=(-0.16 * crouch, 0.0, 0.0), location=(0.0, 0.012 * crouch, -0.052 * crouch)),
                spine_01=BonePose(rotation=(0.25 * crouch, 0.0, 0.0)),
                spine_02=BonePose(rotation=(0.15 * crouch, 0.0, 0.0)),
                chest=BonePose(rotation=(-0.18 * crouch, 0.0, 0.0)),
                neck=BonePose(rotation=(-0.08 * crouch, 0.0, 0.0)),
                head=BonePose(rotation=(-0.07 * crouch, 0.0, 0.0)),
                thigh_fk_L=BonePose(rotation=(0.72 * crouch, 0.0, -0.10)),
                thigh_fk_R=BonePose(rotation=(0.72 * crouch, 0.0, 0.10)),
                shin_fk_L=BonePose(rotation=(-1.16 * crouch, 0.0, 0.0)),
                shin_fk_R=BonePose(rotation=(-1.16 * crouch, 0.0, 0.0)),
                foot_fk_L=BonePose(rotation=(0.43 * crouch, 0.0, 0.0)),
                foot_fk_R=BonePose(rotation=(0.43 * crouch, 0.0, 0.0)),
                upper_arm_fk_L=BonePose(rotation=(-0.72 * crouch, 0.0, -0.18)),
                upper_arm_fk_R=BonePose(rotation=(-0.72 * crouch, 0.0, 0.18)),
                forearm_fk_L=BonePose(rotation=(-0.42 * crouch, 0.0, 0.0)),
                forearm_fk_R=BonePose(rotation=(-0.42 * crouch, 0.0, 0.0)),
            )
        )
    return samples


def _attack_samples(spec: ActionSpec, attack_two: bool) -> list[PoseSample]:
    """Build two visibly different unarmed combat silhouettes.

    Attack_01 is a compact right-hand driving strike whose proof beat is frame
    24.  Attack_02 is a broader left-leading cross-body sweep keyed exactly at
    frame 34.  Keeping those beats explicit avoids the former neutral-looking
    interpolated frames while retaining conservative rotations for rigid armor.
    """

    if attack_two:
        frames = (1, 18, 34, 50, spec.frame_end)
        poses = (
            # twist, drive, guard, lunge
            (0.0, 0.0, 0.0, 0.0),
            (-0.34, 0.48, -0.62, 0.20),
            (0.62, 1.02, -0.34, 0.52),
            (-0.24, 0.30, -0.50, 0.16),
            (0.0, 0.0, 0.0, 0.0),
        )
    else:
        frames = (1, 12, 24, 36, spec.frame_end)
        poses = (
            # twist, drive, guard, lunge
            (0.0, 0.0, 0.0, 0.0),
            (-0.30, 0.38, -0.48, -0.10),
            (-0.48, 1.10, -0.56, 0.46),
            (0.18, 0.22, -0.34, 0.10),
            (0.0, 0.0, 0.0, 0.0),
        )
    samples: list[PoseSample] = []
    for frame, (twist, drive, guard, lunge) in zip(frames, poses):
        samples.append(
            _sample(
                frame,
                root=BonePose(location=(lunge * 0.030, -abs(lunge) * 0.040, 0.0)),
                pelvis=BonePose(rotation=(-0.05 * abs(lunge), 0.0, twist * 0.42), location=(lunge * 0.020, 0.0, -abs(lunge) * 0.010)),
                spine_01=BonePose(rotation=(-abs(twist) * 0.10, 0.0, twist * 0.28)),
                spine_02=BonePose(rotation=(-abs(twist) * 0.05, 0.0, twist * 0.34)),
                chest=BonePose(rotation=(-abs(twist) * 0.04, twist * 0.08, twist * 0.48)),
                neck=BonePose(rotation=(0.0, 0.0, -twist * 0.18)),
                head=BonePose(rotation=(0.0, -twist * 0.06, -twist * 0.24)),
                # Attack two leads with the opposite arm and opens into a broad
                # cross-body line; attack one drives the right fist forward.
                upper_arm_fk_R=BonePose(rotation=((guard if attack_two else drive), -0.10, (0.36 if attack_two else 0.18))),
                forearm_fk_R=BonePose(rotation=((-0.72 - abs(guard) * 0.22) if attack_two else (-0.14 - max(0.0, 1.0 - drive) * 0.22), 0.0, 0.06)),
                hand_fk_R=BonePose(rotation=(0.0, (guard if attack_two else drive) * 0.18, -0.10)),
                upper_arm_fk_L=BonePose(rotation=((drive if attack_two else guard), 0.10, (-0.56 if attack_two else -0.34))),
                forearm_fk_L=BonePose(rotation=((-0.20 if attack_two else -0.82 - abs(guard) * 0.18), 0.0, -0.05)),
                hand_fk_L=BonePose(rotation=(0.0, (-drive * 0.16 if attack_two else 0.0), 0.08)),
                thigh_fk_L=BonePose(rotation=(max(0.0, lunge) * 0.32, 0.0, -0.12)),
                thigh_fk_R=BonePose(rotation=(-max(0.0, lunge) * 0.24, 0.0, 0.12)),
                shin_fk_L=BonePose(rotation=(-max(0.0, lunge) * 0.30, 0.0, 0.0)),
            )
        )
    return samples


def _wave_samples(spec: ActionSpec) -> list[PoseSample]:
    frames = (1, 24, 48, 72, 96, spec.frame_end)
    waves = (0.0, -0.55, 0.55, -0.55, 0.55, 0.0)
    samples: list[PoseSample] = []
    for frame, wave in zip(frames, waves):
        raised = 0.0 if frame in {1, spec.frame_end} else 1.0
        samples.append(
            _sample(
                frame,
                chest=BonePose(rotation=(0.0, 0.0, -0.05 * raised)),
                neck=BonePose(rotation=(0.0, 0.0, 0.04 * raised)),
                head=BonePose(rotation=(0.0, -0.04 * raised, 0.05 * raised)),
                # Rotation X lifts the down-sloping upper-arm rest chain.  Keep
                # the elbow outside the face and let a deep elbow fold place the
                # palm beside, rather than in front of, the head.
                clavicle_L=BonePose(rotation=(0.0, -0.05 * raised, -0.10 * raised)),
                upper_arm_fk_L=BonePose(rotation=(1.18 * raised, -0.10 * raised, -0.18 * raised)),
                forearm_fk_L=BonePose(rotation=(-1.28 * raised, 0.0, 0.18 * raised)),
                hand_fk_L=BonePose(rotation=(0.10 * raised, wave * 0.72, -wave * 0.22)),
            )
        )
    return samples


def _look_samples(spec: ActionSpec) -> list[PoseSample]:
    frames = (1, 45, 90, 135, spec.frame_end)
    yaws = (0.0, 0.55, 0.0, -0.55, 0.0)
    pitches = (0.0, 0.06, -0.10, 0.05, 0.0)
    return [
        _sample(
            frame,
            chest=BonePose(rotation=(0.0, 0.0, yaw * 0.14)),
            neck=BonePose(rotation=(pitch * 0.45, 0.0, yaw * 0.42)),
            head=BonePose(rotation=(pitch, 0.0, yaw)),
        )
        for frame, yaw, pitch in zip(frames, yaws, pitches)
    ]


def _turn_samples(spec: ActionSpec, direction: float) -> list[PoseSample]:
    frames = (1, 18, 36, 54, spec.frame_end)
    progress = (0.0, 0.18, 0.52, 0.82, 1.0)
    samples: list[PoseSample] = []
    for index, (frame, amount) in enumerate(zip(frames, progress)):
        step = math.sin(math.pi * amount)
        root_yaw = direction * math.pi * 0.5 * amount
        samples.append(
            _sample(
                frame,
                root=BonePose(rotation=(0.0, 0.0, root_yaw), location=(direction * 0.018 * step, 0.0, 0.008 * step)),
                pelvis=BonePose(rotation=(0.0, 0.0, direction * 0.16 * step)),
                spine_01=BonePose(rotation=(0.0, 0.0, -direction * 0.08 * step)),
                chest=BonePose(rotation=(0.0, 0.0, -direction * 0.12 * step)),
                head=BonePose(rotation=(0.0, 0.0, direction * 0.12 * step)),
                thigh_fk_L=BonePose(rotation=((0.18 if index % 2 else -0.10) * step, 0.0, 0.0)),
                thigh_fk_R=BonePose(rotation=((-0.10 if index % 2 else 0.18) * step, 0.0, 0.0)),
                upper_arm_fk_L=BonePose(rotation=(-direction * 0.10 * step, 0.0, 0.0)),
                upper_arm_fk_R=BonePose(rotation=(direction * 0.10 * step, 0.0, 0.0)),
            )
        )
    return samples


def _samples_for(spec: ActionSpec) -> list[PoseSample]:
    if spec.name == "Idle":
        return _idle_samples(spec, False)
    if spec.name == "Idle_Breathing":
        return _idle_samples(spec, True)
    if spec.name == "Walk":
        return _walk_samples(spec, False)
    if spec.name == "Run":
        return _walk_samples(spec, True)
    if spec.name.startswith("Jump_"):
        return _jump_samples(spec, spec.name)
    if spec.name == "Attack_01":
        return _attack_samples(spec, False)
    if spec.name == "Attack_02":
        return _attack_samples(spec, True)
    if spec.name == "Wave":
        return _wave_samples(spec)
    if spec.name == "Look_Around":
        return _look_samples(spec)
    if spec.name == "Turn_Left":
        return _turn_samples(spec, 1.0)
    if spec.name == "Turn_Right":
        return _turn_samples(spec, -1.0)
    raise AnimationBuildError(f"No procedural motion recipe for {spec.name!r}")


def _hair_overlay(spec: ActionSpec, frame: int) -> dict[str, BonePose]:
    """Subtle secondary motion, authored only when the optional bones exist."""

    phase = math.tau * (frame - spec.frame_start) / max(1, spec.frame_end - spec.frame_start)
    multiplier = 1.0
    if spec.name == "Walk":
        multiplier = 1.7
    elif spec.name == "Run":
        multiplier = 2.6
    elif spec.category in {"combat", "jump", "turn"}:
        multiplier = 2.0
    sway = math.sin(phase - 0.55) * multiplier
    return {
        "hair_front_01": BonePose(rotation=(0.018 * sway, 0.010 * sway, 0.0)),
        "hair_side_L_01": BonePose(rotation=(0.015 * sway, 0.0, 0.020 * sway)),
        "hair_side_R_01": BonePose(rotation=(0.015 * sway, 0.0, -0.020 * sway)),
        "hair_back_01": BonePose(rotation=(0.026 * sway, -0.012 * sway, 0.0)),
        "braid_01": BonePose(rotation=(0.032 * sway, -0.020 * sway, 0.014 * sway)),
        "braid_02": BonePose(rotation=(0.045 * sway, -0.028 * sway, 0.018 * sway)),
        "braid_03": BonePose(rotation=(0.058 * sway, -0.034 * sway, 0.022 * sway)),
        "braid_04": BonePose(rotation=(0.068 * sway, -0.040 * sway, 0.026 * sway)),
        "braid_05": BonePose(rotation=(0.076 * sway, -0.046 * sway, 0.030 * sway)),
    }


def _finger_overlay(spec: ActionSpec, frame: int) -> dict[str, BonePose]:
    amount = 0.0
    if spec.name.startswith("Attack_"):
        normalized = (frame - spec.frame_start) / max(1, spec.frame_end - spec.frame_start)
        amount = math.sin(math.pi * normalized) * 0.72
    elif spec.name == "Run":
        amount = 0.22
    result: dict[str, BonePose] = {}
    for side in ("L", "R"):
        for finger in ("index", "middle", "ring", "pinky"):
            spread = {"index": 0.88, "middle": 1.0, "ring": 1.08, "pinky": 1.14}[finger]
            for segment, factor in (("01", 0.58), ("02", 0.78), ("03", 0.88)):
                result[f"{finger}_{segment}_{side}"] = BonePose(rotation=(amount * spread * factor, 0.0, 0.0))
        for segment, factor in (("01", 0.42), ("02", 0.58), ("03", 0.66)):
            result[f"thumb_{segment}_{side}"] = BonePose(rotation=(amount * factor, 0.0, (-0.15 if side == "L" else 0.15) * amount))
    return result


def _build_one_action(
    rig: bpy.types.Object,
    spec: ActionSpec,
    *,
    replace: bool,
    include_hair: bool,
    include_fingers: bool,
) -> tuple[bpy.types.Action, bool]:
    action = bpy.data.actions.get(spec.name)
    created = action is None
    if action is None:
        action = bpy.data.actions.new(spec.name)
    elif action.get("astra.generator") != GENERATOR_ID:
        raise AnimationBuildError(
            f"Action {spec.name!r} already exists and is not owned by this generator; "
            "rename it explicitly before building the canonical library"
        )
    elif not replace:
        return action, False
    _clear_action(action)
    writer = _ActionWriter(action, rig.name)
    available = {bone.name for bone in rig.data.bones}
    _ensure_facial_control_properties(rig)
    samples = _samples_for(spec)
    for sample in samples:
        poses = dict(sample.bones)
        if include_fingers:
            for bone, pose in _finger_overlay(spec, sample.frame).items():
                _merge_pose(poses, bone, pose)
        for bone, pose in poses.items():
            if bone not in available:
                continue
            if pose.rotation is not None:
                _rotation_keys(writer, bone, sample.frame, pose.rotation)
            if pose.location is not None:
                _location_keys(writer, bone, sample.frame, pose.location)
        # Force FK for all authored limb curves.  These property channels make
        # playback deterministic even if an animator last left the rig in IK.
        for side in ("L", "R"):
            _property_key(writer, f"hand_ik_{side}", "ik_fk", sample.frame, 0.0)
            _property_key(writer, f"foot_ik_{side}", "ik_fk", sample.frame, 0.0)
    if include_hair:
        for frame in _hair_control_keyframes(spec):
            for bone, pose in _hair_overlay(spec, frame).items():
                if bone in available and pose.rotation is not None:
                    _rotation_keys(writer, bone, frame, pose.rotation)
    _facial_control_keys(writer, spec)
    writer.finish(spec.loop)
    action.use_fake_user = True
    action.use_frame_range = True
    action.frame_start = spec.frame_start
    action.frame_end = spec.frame_end
    action["astra.generator"] = GENERATOR_ID
    action["astra.fps"] = FPS
    action["astra.loop"] = spec.loop
    action["astra.category"] = spec.category
    action["astra.frame_start"] = spec.frame_start
    action["astra.frame_end"] = spec.frame_end
    action["astra.root_motion"] = spec.category == "turn"
    start_marker = action.pose_markers.new("Loop_Start" if spec.loop else "Start")
    start_marker.frame = spec.frame_start
    end_marker = action.pose_markers.new("Loop_End" if spec.loop else "End")
    end_marker.frame = spec.frame_end
    return action, created


def build_action_library(
    rig: bpy.types.Object | str | None = None,
    *,
    scene: bpy.types.Scene | None = None,
    action_names: Iterable[str] | None = None,
    replace: bool = True,
    include_hair: bool = True,
    include_fingers: bool = True,
    require_approval: bool = True,
    mutate_scene_timing: bool = False,
) -> ActionBuildResult:
    """Build requested actions idempotently after explicit visual approval.

    The routine is transactional: if any requested clip fails, newly created
    clips are removed and rebuilt clips are restored from in-memory backups.
    It does not assign an active action, save, render, bind meshes, or
    alter object transforms.  Scene FPS is verified but is changed only when
    ``mutate_scene_timing=True``.  Existing generator-owned action objects keep their
    datablock identity when rebuilt.  Foreign same-named actions are never
    overwritten; rename them explicitly before creating the canonical library.
    """

    requested = tuple(action_names) if action_names is not None else ACTION_NAMES
    unknown = sorted(set(requested) - set(ACTION_NAMES))
    if unknown:
        raise ValueError("Unknown Astra action names: " + ", ".join(unknown))
    if len(requested) != len(set(requested)):
        raise ValueError("action_names contains duplicates")
    foreign_conflicts = [
        name
        for name in requested
        if bpy.data.actions.get(name) is not None
        and bpy.data.actions[name].get("astra.generator") != GENERATOR_ID
    ]
    if foreign_conflicts:
        raise AnimationBuildError(
            "Canonical action names are already owned by other datablocks: "
            + ", ".join(foreign_conflicts)
        )
    if require_approval:
        try:
            require_human_base_approved()
        except HumanBaseGateError as exc:
            raise AnimationBuildError(str(exc)) from exc
    resolved = _require_rig(rig)
    target_scene = scene or bpy.context.scene
    timing_matches = (
        target_scene.render.fps == FPS
        and abs(float(target_scene.render.fps_base) - 1.0) <= 1.0e-8
    )
    if not timing_matches and not mutate_scene_timing:
        raise AnimationBuildError(
            f"Scene timing is {target_scene.render.fps}/{target_scene.render.fps_base}; "
            "set it to 60/1 explicitly or pass mutate_scene_timing=True"
        )
    rig_property_names = (
        "astra.animation_actions",
        "astra.animation_fps",
        "astra.animation_generator",
    )
    transaction = _BuildTransaction(
        created_actions=[],
        action_backups={
            name: _backup_action(bpy.data.actions[name])
            for name in requested
            if bpy.data.actions.get(name) is not None and replace
        },
        rig_properties={
            key: resolved.get(key, _MISSING_PROPERTY)
            for key in rig_property_names
        },
        timing=(target_scene.render.fps, float(target_scene.render.fps_base)),
    )
    if mutate_scene_timing:
        target_scene.render.fps = FPS
        target_scene.render.fps_base = 1.0
    created: list[str] = []
    rebuilt: list[str] = []
    actions: dict[str, bpy.types.Action] = {}
    try:
        for name in requested:
            action, was_created = _build_one_action(
                resolved,
                ACTION_SPEC_BY_NAME[name],
                replace=replace,
                include_hair=include_hair,
                include_fingers=include_fingers,
            )
            actions[name] = action
            if was_created:
                transaction.created_actions.append(action)
                created.append(name)
            else:
                rebuilt.append(name)
        resolved["astra.animation_actions"] = ",".join(requested)
        resolved["astra.animation_fps"] = FPS
        resolved["astra.animation_generator"] = GENERATOR_ID
    except Exception:
        _rollback_action_build(resolved, target_scene, transaction)
        raise
    _commit_action_build(transaction)
    missing_optional: list[str] = []
    if include_hair:
        optional = set(_hair_overlay(ACTION_SPECS[0], 1))
        missing_optional.extend(sorted(name for name in optional if resolved.data.bones.get(name) is None))
    return ActionBuildResult(
        ok=True,
        status="built",
        rig=resolved.name,
        fps=FPS,
        actions=actions,
        created=tuple(created),
        rebuilt=tuple(rebuilt),
        missing_bones=(),
        warnings=(
            ("Optional secondary bones absent: " + ", ".join(missing_optional),)
            if missing_optional else ()
        ),
    )


def build_all_actions(
    rig: bpy.types.Object | str | None = None,
    **kwargs: Any,
) -> dict[str, bpy.types.Action]:
    """Backward-compatible mapping return for pipeline entry points."""

    return dict(build_action_library(rig, **kwargs).actions)


def _action_fcurves(action: bpy.types.Action) -> tuple[bpy.types.FCurve, ...]:
    if hasattr(action, "layers"):
        curves: list[bpy.types.FCurve] = []
        for layer in action.layers:
            for strip in layer.strips:
                for channelbag in strip.channelbags:
                    curves.extend(channelbag.fcurves)
        return tuple(curves)
    return tuple(action.fcurves)


def validate_actions(
    rig: bpy.types.Object | str | None = None,
    *,
    scene: bpy.types.Scene | None = None,
    raise_on_error: bool = False,
) -> dict[str, Any]:
    """Validate exact names, 60 FPS, ranges, loop metadata and bone-only paths."""

    inspection = inspect_animation_target(rig)
    issues = list(inspection["issues"])
    target_scene = scene or bpy.context.scene
    missing = [name for name in ACTION_NAMES if bpy.data.actions.get(name) is None]
    foreign: list[str] = []
    empty: list[str] = []
    invalid_ranges: list[str] = []
    invalid_loop_flags: list[str] = []
    invalid_paths: list[str] = []
    invalid_values: list[str] = []
    curve_count = 0
    keyframe_count = 0
    for spec in ACTION_SPECS:
        action = bpy.data.actions.get(spec.name)
        if action is None:
            continue
        if action.get("astra.generator") != GENERATOR_ID:
            foreign.append(spec.name)
        curves = _action_fcurves(action)
        curve_count += len(curves)
        if not curves:
            empty.append(spec.name)
        if action.get("astra.frame_start") != spec.frame_start or action.get("astra.frame_end") != spec.frame_end:
            invalid_ranges.append(spec.name)
        if bool(action.get("astra.loop", False)) != spec.loop:
            invalid_loop_flags.append(spec.name)
        for curve in curves:
            keyframe_count += len(curve.keyframe_points)
            if not curve.data_path.startswith('pose.bones["'):
                invalid_paths.append(f"{spec.name}:{curve.data_path}")
            if curve.data_path.endswith(".scale"):
                invalid_paths.append(f"{spec.name}:{curve.data_path}")
            for point in curve.keyframe_points:
                if not all(math.isfinite(float(value)) for value in point.co):
                    invalid_values.append(f"{spec.name}:{curve.data_path}")
    if target_scene.render.fps != FPS or abs(float(target_scene.render.fps_base) - 1.0) > 1.0e-8:
        issues.append(f"Scene timing is {target_scene.render.fps}/{target_scene.render.fps_base}; expected 60/1")
    if missing:
        issues.append("Missing actions: " + ", ".join(missing))
    if foreign:
        issues.append("Foreign same-named actions: " + ", ".join(foreign))
    if empty:
        issues.append("Actions without F-Curves: " + ", ".join(empty))
    if invalid_ranges:
        issues.append("Invalid action frame metadata: " + ", ".join(invalid_ranges))
    if invalid_loop_flags:
        issues.append("Invalid loop metadata: " + ", ".join(invalid_loop_flags))
    if invalid_paths:
        issues.append("Non-skeleton animation paths: " + ", ".join(invalid_paths))
    if invalid_values:
        issues.append("Non-finite keyframes: " + ", ".join(invalid_values))
    report = {
        "ok": not issues,
        "status": "valid" if not issues else inspection["status"] if not inspection["ok"] else "invalid",
        "rig": inspection["rig"],
        "fps": target_scene.render.fps,
        "fps_base": target_scene.render.fps_base,
        "expected_actions": list(ACTION_NAMES),
        "missing": missing,
        "foreign": foreign,
        "empty": empty,
        "invalid_ranges": invalid_ranges,
        "invalid_loop_flags": invalid_loop_flags,
        "invalid_paths": invalid_paths,
        "invalid_values": invalid_values,
        "curve_count": curve_count,
        "keyframe_count": keyframe_count,
        "issues": issues,
    }
    if raise_on_error and issues:
        raise AnimationBuildError("Action validation failed: " + "; ".join(issues))
    return report


def validate_action_library_static() -> dict[str, Any]:
    """Validate pure motion recipes without requiring Blender datablocks."""

    issues: list[str] = []
    sample_counts: dict[str, int] = {}
    keyed_bones: dict[str, tuple[str, ...]] = {}
    for spec in ACTION_SPECS:
        try:
            samples = _samples_for(spec)
        except (AnimationBuildError, ValueError) as exc:
            issues.append(f"{spec.name}: {exc}")
            continue
        sample_counts[spec.name] = len(samples)
        frames = [sample.frame for sample in samples]
        if frames != sorted(frames) or len(frames) != len(set(frames)):
            issues.append(f"{spec.name}: sample frames are not strictly increasing")
        if not frames or frames[0] != spec.frame_start or frames[-1] != spec.frame_end:
            issues.append(f"{spec.name}: samples do not cover declared endpoints")
        all_bones = sorted({bone for sample in samples for bone in sample.bones})
        keyed_bones[spec.name] = tuple(all_bones)
        if "root" not in all_bones and spec.category in {"locomotion", "jump", "turn"}:
            issues.append(f"{spec.name}: root motion/grounding channel is absent")
        for sample in samples:
            for bone, pose in sample.bones.items():
                vectors = tuple(value for value in (pose.rotation, pose.location) if value is not None)
                if not vectors:
                    issues.append(f"{spec.name}:{bone}: empty BonePose")
                for vector in vectors:
                    if len(vector) != 3 or not all(math.isfinite(float(value)) for value in vector):
                        issues.append(f"{spec.name}:{bone}: invalid transform vector")
    return {
        "ok": not issues,
        "fps": FPS,
        "action_count": len(ACTION_SPECS),
        "sample_counts": sample_counts,
        "keyed_bones": keyed_bones,
        "issues": issues,
    }


__all__ = (
    "ACTION_NAMES",
    "ACTION_SPECS",
    "ANIMATION_FPS",
    "ActionBuildResult",
    "AnimationBuildError",
    "BonePose",
    "LOOP_ACTIONS",
    "PoseSample",
    "build_action_library",
    "build_all_actions",
    "inspect_animation_target",
    "validate_action_library_static",
    "validate_actions",
)
