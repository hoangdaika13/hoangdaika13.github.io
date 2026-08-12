"""Thin explicit wrapper for the facial demonstration action."""

from __future__ import annotations

import bpy

try:
    from ..rigging.facial_rig import create_facial_demo_action
except ImportError:  # pragma: no cover
    from rigging.facial_rig import create_facial_demo_action


def create_facial_demo(mesh: bpy.types.Object | str | None = None) -> bpy.types.Action:
    return create_facial_demo_action(mesh, name="Facial_Demo")


__all__ = ("create_facial_demo",)
