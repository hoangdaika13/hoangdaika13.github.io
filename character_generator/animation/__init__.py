"""Canonical, original Astra H-08 skeleton animation package.

Nothing runs on import.  Builders are explicit and remain blocked until manual
HUMAN_BASE approval plus a compatible armature are present.
"""

from .core import (
    ANIMATION_FPS,
    ActionBuildResult,
    AnimationBuildError,
    build_action_library,
    build_all_actions,
    inspect_animation_target,
    validate_action_library_static,
    validate_actions,
)
from .facial import create_facial_demo
from .manifest import (
    ACTION_NAMES,
    ACTION_SPECS,
    ACTION_SPEC_BY_NAME,
    ANIMATION_BONE_CONTRACT,
    LOOPING_ACTIONS,
    ONE_SHOT_ACTIONS,
    validate_manifest,
)

LOOP_ACTIONS = frozenset(LOOPING_ACTIONS)

__all__ = (
    "ACTION_NAMES",
    "ACTION_SPECS",
    "ACTION_SPEC_BY_NAME",
    "ANIMATION_BONE_CONTRACT",
    "ANIMATION_FPS",
    "ActionBuildResult",
    "AnimationBuildError",
    "LOOPING_ACTIONS",
    "LOOP_ACTIONS",
    "ONE_SHOT_ACTIONS",
    "build_action_library",
    "build_all_actions",
    "create_facial_demo",
    "inspect_animation_target",
    "validate_action_library_static",
    "validate_actions",
    "validate_manifest",
)
