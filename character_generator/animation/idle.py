"""Idle action entry points."""

from __future__ import annotations

from typing import Any

from .core import build_action_library


def build_idle(rig, **kwargs: Any):
    kwargs["action_names"] = ("Idle",)
    return build_action_library(rig, **kwargs).actions["Idle"]


def build_idle_breathing(rig, **kwargs: Any):
    kwargs["action_names"] = ("Idle_Breathing",)
    return build_action_library(rig, **kwargs).actions["Idle_Breathing"]


__all__ = ("build_idle", "build_idle_breathing")
