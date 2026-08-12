"""Gesture and turn action entry points."""

from __future__ import annotations

from typing import Any

from .core import build_action_library


def build_gestures(rig, **kwargs: Any):
    names = ("Wave", "Look_Around", "Turn_Left", "Turn_Right")
    kwargs["action_names"] = names
    return dict(build_action_library(rig, **kwargs).actions)


__all__ = ("build_gestures",)
