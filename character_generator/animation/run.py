"""Run action entry point."""

from __future__ import annotations

from typing import Any

from .core import build_action_library


def build_run(rig, **kwargs: Any):
    kwargs["action_names"] = ("Run",)
    return build_action_library(rig, **kwargs).actions["Run"]


__all__ = ("build_run",)
