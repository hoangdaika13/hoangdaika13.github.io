"""Combat action entry points."""

from __future__ import annotations

from typing import Any

from .core import build_action_library


def build_combat(rig, **kwargs: Any):
    names = ("Attack_01", "Attack_02")
    kwargs["action_names"] = names
    return dict(build_action_library(rig, **kwargs).actions)


__all__ = ("build_combat",)
