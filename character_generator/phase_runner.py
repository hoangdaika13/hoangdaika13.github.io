"""Safe orchestration helpers for individually gated post-body phases."""

from __future__ import annotations

import bpy

from pipeline_gate import require_human_base_approved


def require_open_approved_body() -> bpy.types.Object:
    """Validate disk evidence and the currently open, untouched body object."""
    require_human_base_approved()
    body = bpy.data.objects.get("BODY_CONTINUOUS")
    if body is None or body.type != "MESH":
        raise RuntimeError("Open the approved HUMAN_BASE.blend; BODY_CONTINUOUS is missing")
    return body


def phase_summary(label: str, objects: list[bpy.types.Object]) -> None:
    names = ", ".join(obj.name for obj in objects)
    print(f"[{label}] Created {len(objects)} objects: {names}")
