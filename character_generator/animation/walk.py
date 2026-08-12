"""Walk action entry point."""

from __future__ import annotations

from typing import Any

from .core import build_action_library


def build_walk(rig, **kwargs: Any):
    kwargs["action_names"] = ("Walk",)
    return build_action_library(rig, **kwargs).actions["Walk"]


__all__ = ("build_walk",)
