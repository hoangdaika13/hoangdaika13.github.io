"""Jump action entry points."""

from __future__ import annotations

from typing import Any

from .core import build_action_library


def build_jump(rig, **kwargs: Any):
    names = ("Jump_Start", "Jump_Loop", "Jump_Land")
    kwargs["action_names"] = names
    return dict(build_action_library(rig, **kwargs).actions)


__all__ = ("build_jump",)
