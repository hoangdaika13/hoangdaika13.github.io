"""Static animation contract for the original Astra H-08 motion library.

The declarations in this module are intentionally Blender-independent.  They
can be imported by release tools and ordinary Python tests without opening a
``.blend`` file.  Every duration is expressed in inclusive 60 FPS frames.
"""

from __future__ import annotations

from dataclasses import dataclass


FPS = 60
GENERATOR_ID = "astra_h08.animation.v1"


@dataclass(frozen=True)
class ActionSpec:
    """Stable metadata for one required action."""

    name: str
    frame_start: int
    frame_end: int
    loop: bool
    category: str

    @property
    def frame_count(self) -> int:
        return self.frame_end - self.frame_start + 1

    @property
    def duration_seconds(self) -> float:
        return (self.frame_end - self.frame_start) / FPS


ACTION_SPECS: tuple[ActionSpec, ...] = (
    ActionSpec("Idle", 1, 180, True, "idle"),
    ActionSpec("Idle_Breathing", 1, 240, True, "idle"),
    ActionSpec("Walk", 1, 60, True, "locomotion"),
    ActionSpec("Run", 1, 40, True, "locomotion"),
    ActionSpec("Jump_Start", 1, 24, False, "jump"),
    ActionSpec("Jump_Loop", 1, 36, True, "jump"),
    ActionSpec("Jump_Land", 1, 30, False, "jump"),
    ActionSpec("Attack_01", 1, 48, False, "combat"),
    ActionSpec("Attack_02", 1, 66, False, "combat"),
    ActionSpec("Wave", 1, 120, False, "gesture"),
    ActionSpec("Look_Around", 1, 180, False, "gesture"),
    ActionSpec("Turn_Left", 1, 72, False, "turn"),
    ActionSpec("Turn_Right", 1, 72, False, "turn"),
)

ACTION_NAMES: tuple[str, ...] = tuple(spec.name for spec in ACTION_SPECS)
LOOPING_ACTIONS: tuple[str, ...] = tuple(spec.name for spec in ACTION_SPECS if spec.loop)
ONE_SHOT_ACTIONS: tuple[str, ...] = tuple(spec.name for spec in ACTION_SPECS if not spec.loop)
ACTION_SPEC_BY_NAME: dict[str, ActionSpec] = {spec.name: spec for spec in ACTION_SPECS}

# Controls and deform bones keyed by the authored clips.  Builders report these
# as missing instead of dereferencing an absent pose bone.
ANIMATION_BONE_CONTRACT: tuple[str, ...] = (
    "root",
    "pelvis",
    "spine_01",
    "spine_02",
    "spine_03",
    "chest",
    "neck",
    "head",
    "clavicle_L",
    "clavicle_R",
    "upper_arm_fk_L",
    "upper_arm_fk_R",
    "forearm_fk_L",
    "forearm_fk_R",
    "hand_fk_L",
    "hand_fk_R",
    "thigh_fk_L",
    "thigh_fk_R",
    "shin_fk_L",
    "shin_fk_R",
    "foot_fk_L",
    "foot_fk_R",
    "toe_fk_L",
    "toe_fk_R",
    "hand_ik_L",
    "hand_ik_R",
    "foot_ik_L",
    "foot_ik_R",
)

FINGER_NAMES: tuple[str, ...] = ("thumb", "index", "middle", "ring", "pinky")
FINGER_SEGMENTS: tuple[str, ...] = ("01", "02", "03")
FINGER_BONES: tuple[str, ...] = tuple(
    f"{finger}_{segment}_{side}"
    for side in ("L", "R")
    for finger in FINGER_NAMES
    for segment in FINGER_SEGMENTS
)

FACIAL_CONTROL_TO_SHAPE: dict[str, str] = {
    "face_blink_l": "Blink_L",
    "face_blink_r": "Blink_R",
    "face_blink_both": "Blink_Both",
    "face_smile": "Smile",
    "face_angry": "Angry",
    "face_sad": "Sad",
    "face_surprised": "Surprised",
    "face_mouth_open": "Mouth_Open",
}


def validate_manifest() -> dict[str, object]:
    """Validate the pure-Python manifest without requiring Blender."""

    names = [spec.name for spec in ACTION_SPECS]
    duplicates = sorted(name for name in set(names) if names.count(name) > 1)
    invalid_ranges = [spec.name for spec in ACTION_SPECS if spec.frame_start >= spec.frame_end]
    invalid_categories = [spec.name for spec in ACTION_SPECS if not spec.category]
    issues: list[str] = []
    if duplicates:
        issues.append("Duplicate actions: " + ", ".join(duplicates))
    if invalid_ranges:
        issues.append("Invalid frame ranges: " + ", ".join(invalid_ranges))
    if invalid_categories:
        issues.append("Missing categories: " + ", ".join(invalid_categories))
    return {
        "ok": not issues,
        "fps": FPS,
        "action_count": len(ACTION_SPECS),
        "actions": tuple(names),
        "looping_actions": LOOPING_ACTIONS,
        "one_shot_actions": ONE_SHOT_ACTIONS,
        "issues": issues,
    }


_MANIFEST_REPORT = validate_manifest()
if not _MANIFEST_REPORT["ok"]:
    raise RuntimeError("Invalid Astra animation manifest: " + "; ".join(_MANIFEST_REPORT["issues"]))


__all__ = (
    "ACTION_NAMES",
    "ACTION_SPECS",
    "ACTION_SPEC_BY_NAME",
    "ANIMATION_BONE_CONTRACT",
    "ActionSpec",
    "FINGER_BONES",
    "FINGER_NAMES",
    "FINGER_SEGMENTS",
    "FACIAL_CONTROL_TO_SHAPE",
    "FPS",
    "GENERATOR_ID",
    "LOOPING_ACTIONS",
    "ONE_SHOT_ACTIONS",
    "validate_manifest",
)
