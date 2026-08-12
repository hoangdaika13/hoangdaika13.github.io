"""Blender 4.x/5.x FBX export for the QA-approved Astra H-08 scene."""

from __future__ import annotations

from pathlib import Path

import bpy


def export_fbx(path: Path) -> Path:
    options = {
        "filepath": str(path),
        "check_existing": False,
        "use_selection": True,
        "object_types": {"ARMATURE", "MESH"},
        "use_mesh_modifiers": True,
        "mesh_smooth_type": "FACE",
        "use_tspace": True,
        "add_leaf_bones": False,
        "use_armature_deform_only": True,
        "armature_nodetype": "NULL",
        "bake_anim": True,
        "bake_anim_use_all_bones": True,
        "bake_anim_use_nla_strips": False,
        "bake_anim_use_all_actions": True,
        "bake_anim_force_startend_keying": True,
        "bake_anim_step": 1.0,
        "bake_anim_simplify_factor": 0.0,
        "path_mode": "COPY",
        "embed_textures": True,
        "axis_forward": "-Z",
        "axis_up": "Y",
        "apply_unit_scale": True,
        "apply_scale_options": "FBX_SCALE_UNITS",
    }
    result = bpy.ops.export_scene.fbx(**options)
    if "FINISHED" not in result or not path.is_file():
        raise RuntimeError(f"Blender did not produce the requested FBX: {path}")
    return path
