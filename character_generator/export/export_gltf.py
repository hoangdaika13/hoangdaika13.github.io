"""Blender 4.x/5.x GLB export for the QA-approved Astra H-08 scene."""

from __future__ import annotations

from pathlib import Path

import bpy


def export_glb(path: Path) -> Path:
    supported = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    options = {
        "filepath": str(path),
        "check_existing": False,
        "export_format": "GLB",
        "use_selection": True,
        "export_apply": False,
        "export_yup": True,
        "export_skins": True,
        "export_def_bones": True,
        "export_morph": True,
        "export_morph_normal": True,
        "export_morph_tangent": False,
        "export_materials": "EXPORT",
        "export_image_format": "AUTO",
        "export_animations": True,
        "export_animation_mode": "ACTIONS",
        "export_force_sampling": True,
        "export_frame_range": False,
        "export_anim_slide_to_zero": True,
        "export_optimize_animation_size": True,
        "export_optimize_animation_keep_anim_armature": True,
        "export_optimize_animation_keep_anim_object": False,
        "export_reset_pose_bones": True,
        "export_extras": True,
        "export_cameras": False,
        "export_lights": False,
    }
    result = bpy.ops.export_scene.gltf(**{key: value for key, value in options.items() if key in supported})
    if "FINISHED" not in result or not path.is_file():
        raise RuntimeError(f"Blender did not produce the requested GLB: {path}")
    return path
