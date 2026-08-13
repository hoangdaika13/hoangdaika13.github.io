"""Build the complete, self-contained Astra H-08 character in Blender.

The only design input is the project-owned 2D reference sheet.  Every mesh is
authored by the local Blender-Python modules; this entry point never downloads,
imports, appends, or links external 3D data.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
ASSET_ROOT = ROOT.parent / "assets" / "character-3d" / "astra-h08"
OUTPUT = ASSET_ROOT / "output"
BLEND_PATH = OUTPUT / "ASTRA_H08.blend"
BUILD_REPORT = OUTPUT / "ASTRA_H08.build.json"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from animation import build_action_library, validate_actions  # noqa: E402
from main_body import assemble_body, clean_scene, setup_camera, setup_world, validate  # noqa: E402
from materials.materials import assign_character_materials, build_materials  # noqa: E402
from modeling.armor import build_armor  # noqa: E402
from modeling.bodysuit import build_bodysuit  # noqa: E402
from rigging import (  # noqa: E402
    apply_weight_profile,
    build_anatomical_weight_profile,
    build_facial_rig,
    build_hair_rig,
    build_humanoid_rig,
    validate_facial_shape_keys,
    validate_hair_rig,
    validate_humanoid_rig,
)
from rigging.weights import copy_weight_profile  # noqa: E402


def log(message: str) -> None:
    try:
        print(f"[ASTRA_BUILD] {message}", flush=True)
    except (BrokenPipeError, OSError, ValueError):
        pass


def _load_hair_module():
    path = ROOT / "03_hair.py"
    spec = importlib.util.spec_from_file_location("astra_phase03_hair", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load procedural hair module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _ensure_head_role(body: bpy.types.Object) -> bpy.types.Object:
    """Expose the continuous face-region mesh under the release HEAD role.

    The body remains one connected surface; a second hidden or duplicate head is
    deliberately not created.  The role is expressed by a stable object name and
    metadata so facial shape keys deform the actual rendered character.
    """
    # Keep the canonical body name so fitted builders and release inventory use
    # the same object without hidden aliases.
    body.name = "BODY_CONTINUOUS"
    body["astra.roles"] = "BODY,HEAD"
    body["astra.source"] = "mesh.from_pydata procedural HUMAN_BASE"
    return body


def _ensure_hair_groups(objects: tuple[bpy.types.Object, ...]) -> None:
    """Assign deterministic regional hair groups before adding secondary bones."""
    mapping = {
        "HAIR_FRONT": "hair_front_01",
        "HAIR_AHOGE": "hair_front_01",
        "HAIR_TEMPLE_L": "hair_side_L_01",
        "HAIR_SIDE_L": "hair_side_L_01",
        "HAIR_TEMPLE_R": "hair_side_R_01",
        "HAIR_SIDE_R": "hair_side_R_01",
        "HAIR_BACK": "hair_back_01",
        "HAIR_CROWN_LAYERS": "hair_back_01",
        "HAIR_BRAID_GATHER": "braid_01",
        "HAIR_BRAID": "braid_01",
        "HAIR_BRAID_TAIL": "braid_05",
        "HAIR_LOOSE_STRANDS": "hair_back_01",
        "HAIR_ACCESSORY_FRAME_L": "hair_side_L_01",
        "HAIR_ACCESSORY_CORE_L": "hair_side_L_01",
        "HAIR_ACCESSORY_CYAN_L": "hair_side_L_01",
        "HAIR_ACCESSORY_RED_PIN_L": "hair_side_L_01",
        "HAIR_BRAID_CLASP_TOP": "braid_01",
        "HAIR_BRAID_CLASP_END": "braid_05",
    }
    for obj in objects:
        if obj.type not in {"MESH", "CURVE"}:
            continue
        group_name = mapping.get(obj.name)
        if group_name is None:
            continue
        if obj.type == "CURVE":
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
        group = obj.vertex_groups.get(group_name) or obj.vertex_groups.new(name=group_name)
        if len(obj.data.vertices):
            group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")


def _assign_soft_weights(
    obj: bpy.types.Object,
    bone_centers: dict[str, Vector],
    z_min: float,
    z_max: float,
) -> None:
    """Apply the same deterministic anatomical skinning to body-derived cloth."""
    height = z_max - z_min
    groups = {name: obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name) for name in bone_centers}
    for index, vertex in enumerate(obj.data.vertices):
        co = obj.matrix_world @ vertex.co
        normalized_z = (co.z - z_min) / max(height, 1.0e-6)
        abs_x = abs(co.x)
        if normalized_z > 0.86:
            candidates = ("head", "neck")
        elif normalized_z > 0.72 and abs_x > 0.18:
            side = "L" if co.x >= 0.0 else "R"
            candidates = ("chest", f"upper_arm_{side}", f"forearm_{side}", f"hand_{side}")
        elif normalized_z > 0.50:
            candidates = ("pelvis", "spine_01", "spine_02", "spine_03", "chest")
        else:
            side = "L" if co.x >= 0.0 else "R"
            candidates = ("pelvis", f"thigh_{side}", f"shin_{side}", f"foot_{side}")
        ranked = sorted(
            ((name, (co - bone_centers[name]).length) for name in candidates),
            key=lambda item: item[1],
        )[:2]
        raw = [1.0 / max(distance, 0.015) ** 2 for _name, distance in ranked]
        total = sum(raw)
        for (name, _distance), weight in zip(ranked, raw):
            groups[name].add([index], weight / total, "REPLACE")


def _bind_release_meshes(rig: bpy.types.Object) -> list[str]:
    """Attach the generated scene to the authored rig without external weights.

    Body skinning uses region-normalized procedural weights.  Hard-surface
    objects receive an armature modifier and retain rigid object-local geometry;
    this is sufficient for deterministic export while the release QA still checks
    every action visually.
    """
    body = bpy.data.objects.get("BODY_CONTINUOUS")
    if body is None:
        raise RuntimeError("BODY_CONTINUOUS is missing before rig binding")
    bounds = [vertex.co.z for vertex in body.data.vertices]
    z_min, z_max = min(bounds), max(bounds)
    bone_centers = {
        name: (rig.data.bones[name].head_local + rig.data.bones[name].tail_local) * 0.5
        for name in (
            "pelvis", "spine_01", "spine_02", "spine_03", "chest", "neck", "head",
            "upper_arm_L", "forearm_L", "hand_L", "upper_arm_R", "forearm_R", "hand_R",
            "thigh_L", "shin_L", "foot_L", "thigh_R", "shin_R", "foot_R",
        )
    }
    apply_weight_profile(rig, body, build_anatomical_weight_profile(rig, body))

    def rigid_bone_for(obj: bpy.types.Object) -> str:
        point = obj.location.copy()
        if obj.bound_box:
            point = sum((Vector(corner) for corner in obj.bound_box), Vector()) / 8.0
            point = obj.matrix_world @ point
        name = obj.name.upper()
        # Geometry builders historically labelled the negative-X side ``L``
        # even though the rig follows the anatomical convention L=+X. Resolve
        # generated object suffixes first; spatial fallback remains for neutral
        # or centre objects.
        if name.endswith("_L"):
            side = "R"
        elif name.endswith("_R"):
            side = "L"
        else:
            side = "L" if point.x >= 0.0 else "R"
        if any(token in name for token in ("BOOT", "SOLE", "INSTEP", "TOE", "ANKLE")):
            return f"foot_{side}"
        if any(token in name for token in ("SHIN", "KNEE")):
            return f"shin_{side}"
        if any(token in name for token in ("THIGH", "HIP")):
            return f"thigh_{side}"
        if any(token in name for token in ("HAND", "GLOVE")):
            return f"hand_{side}"
        if any(token in name for token in ("FOREARM", "ELBOW")):
            return f"forearm_{side}"
        if any(token in name for token in ("SHOULDER", "UPPER_ARM")):
            return f"upper_arm_{side}"
        if name.startswith(("EYE_", "IRIS_", "PUPIL_", "EYELID_", "EYEBROW_", "MOUTH_")):
            return "head"
        if "HAIR" in name:
            return "head"
        if any(token in name for token in ("WAIST", "BELT", "UTILITY")):
            return "pelvis"
        return "chest"

    bound: list[str] = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name == "GROUND":
            continue
        # Shrinkwrap is only a construction aid. Evaluating it after armature
        # deformation can feed a deformed suit back onto itself and explode the
        # surface; bake the fitted garment before adding the rig modifier.
        for fit_modifier in tuple(obj.modifiers):
            if fit_modifier.type not in {"SHRINKWRAP", "SOLIDIFY"}:
                continue
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=fit_modifier.name)
        modifier = next((item for item in obj.modifiers if item.type == "ARMATURE"), None)
        if modifier is None:
            modifier = obj.modifiers.new("ASTRA_ARMATURE", "ARMATURE")
        modifier.object = rig
        if obj.name == "BODYSUIT":
            for group in tuple(obj.vertex_groups):
                obj.vertex_groups.remove(group)
            if len(obj.data.vertices) == len(body.data.vertices):
                copy_weight_profile(rig, body, obj)
            else:
                apply_weight_profile(rig, obj, build_anatomical_weight_profile(rig, obj))
        elif obj is not body:
            preferred = rigid_bone_for(obj)
            existing = [group for group in obj.vertex_groups if group.name in rig.data.bones]
            # Hair groups are authored explicitly by region. Other generated
            # meshes replace any stale/partial group with one rigid parent bone;
            # mixed source groups make armor split into detached shells.
            if not obj.name.startswith("HAIR_") or not existing:
                for group in tuple(existing):
                    obj.vertex_groups.remove(group)
                group = obj.vertex_groups.get(preferred) or obj.vertex_groups.new(name=preferred)
                if len(obj.data.vertices):
                    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        if obj.name.startswith(("EYE_", "IRIS_", "PUPIL_", "EYELID_", "EYEBROW_", "MOUTH_")):
            # Facial landmarks are rigid children of the head. Bone parenting is
            # preferable here to skinning tiny planar surfaces and survives GLB.
            for armature in tuple(item for item in obj.modifiers if item.type == "ARMATURE"):
                obj.modifiers.remove(armature)
            for group in tuple(obj.vertex_groups):
                obj.vertex_groups.remove(group)
            world_matrix = obj.matrix_world.copy()
            obj.parent = rig
            obj.parent_type = "BONE"
            obj.parent_bone = "head"
            obj.matrix_world = world_matrix
        bound.append(obj.name)
    return bound


def _hide_qa_scene_objects() -> None:
    for name in ("GROUND", "KEY", "FILL", "RIM", "TOP", "Camera_FullBody"):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_render = True


def main() -> dict[str, object]:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    log("[01/15] Cleaning scene")
    clean_scene()
    log("[02/15] Creating continuous HUMAN_BASE")
    body, features = assemble_body()
    body = _ensure_head_role(body)
    technical = validate(body, features)
    body["HUMAN_BASE_APPROVED"] = True
    bpy.context.scene["HUMAN_BASE_APPROVED"] = True

    log("[03/15] Creating coral layered hair and braid")
    hair_module = _load_hair_module()
    hair = hair_module.build_hair(body=body)
    _ensure_hair_groups(hair.objects)
    log("[04/15] Creating body-derived technical suit")
    materials = build_materials()
    bodysuit = build_bodysuit(body, materials)
    log("[05/15] Creating fitted hard-surface armor")
    armor = build_armor(body, materials)
    log("[06/15] Assigning procedural PBR materials")
    material_assignments = assign_character_materials(materials)
    # The face/body skin must remain the warm reference tone.  This explicit
    # assignment protects it from broad name-based suit/metal matching.
    body.data.materials.clear()
    body.data.materials.append(materials["FACE_SKIN"])
    material_assignments[body.name] = materials["FACE_SKIN"].name
    # assign_character_materials normalizes material slots, so restore the
    # bodysuit's transparent exposed-skin slot and polygon zoning afterwards.
    suit = bpy.data.objects.get("BODYSUIT")
    invisible = bpy.data.materials.get("BODYSUIT_INVISIBLE")
    if suit is not None and invisible is not None:
        suit.data.materials.append(invisible)
        z_min = min(vertex.co.z for vertex in body.data.vertices)
        z_max = max(vertex.co.z for vertex in body.data.vertices)
        height = max(1.0e-6, z_max - z_min)
        for polygon in suit.data.polygons:
            coords = [body.data.vertices[index].co for index in polygon.vertices]
            covered = all(
                not (
                    (co.z - z_min) / height > 0.855
                    or (co.z - z_min) / height < 0.085
                    or (0.405 <= (co.z - z_min) / height <= 0.505 and abs(co.x) > 0.255 * height)
                )
                for co in coords
            )
            polygon.material_index = 0 if covered else 1
        suit["astra.suit_covered_polygons"] = sum(
            1 for polygon in suit.data.polygons if polygon.material_index == 0
        )
        suit["astra.suit_exposed_polygons"] = sum(
            1 for polygon in suit.data.polygons if polygon.material_index == 1
        )
        # Hide the underlying body exactly where the suit is visible.  Keeping
        # the skin surface rendered beneath a close fitted shell causes tiny
        # numerical pose differences to show as large skin patches in combat.
        body.data.materials.append(invisible)
        for polygon in body.data.polygons:
            suit_polygon = suit.data.polygons[polygon.index]
            polygon.material_index = 1 if suit_polygon.material_index == 0 else 0

    log("[07/15] Building humanoid FK/IK rig")
    rig = build_humanoid_rig(require_approval=True)
    log("[08/15] Building facial shapes and hair secondary rig")
    facial = build_facial_rig(body, rig=rig, replace=True)
    hair_rig = build_hair_rig(rig, hair.objects)
    bound = _bind_release_meshes(rig)
    log("[09/15] Authoring 60 FPS action library")
    actions = build_action_library(
        rig,
        include_hair=True,
        include_fingers=True,
        require_approval=True,
        mutate_scene_timing=True,
    )

    log("[10/15] Creating studio presentation scene")
    setup_world()
    setup_camera()
    _hide_qa_scene_objects()
    log("[11/15] Validating rig, shapes and actions")
    validations = {
        "humanoid": validate_humanoid_rig(rig),
        "hair": validate_hair_rig(rig),
        "facial": validate_facial_shape_keys(body),
        "actions": validate_actions(rig),
    }
    failures = [name for name, report in validations.items() if report.get("ok") is not True]
    if failures:
        raise RuntimeError("Final stack validation failed: " + ", ".join(failures))

    # Release naming contracts are substring-based; tag key generated roles
    # explicitly without duplicating geometry.
    for obj in bodysuit:
        obj["astra.release_role"] = "BODYSUIT"
    for obj in armor:
        obj["astra.release_role"] = "ARMOR,BOOTS"
    for obj in hair.objects:
        obj["astra.release_role"] = "HAIR"

    log("[12/15] Saving editable project")
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
    report = {
        "status": "complete-awaiting-independent-release-qa",
        "source": "local Blender Python only",
        "externalModelUsed": False,
        "technicalBase": technical,
        "objects": len(bpy.context.scene.objects),
        "meshObjects": len([obj for obj in bpy.context.scene.objects if obj.type == "MESH"]),
        "bones": len(rig.data.bones),
        "shapeKeys": facial.get("shape_keys", []),
        "actions": list(actions.actions),
        "hairObjects": [obj.name for obj in hair.objects],
        "bodysuitObjects": [obj.name for obj in bodysuit],
        "armorObjects": [obj.name for obj in armor],
        "boundMeshes": bound,
        "materialAssignments": material_assignments,
        "validations": validations,
        "blend": str(BLEND_PATH),
    }
    BUILD_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log("[13/15] Wrote complete build report")
    log("[14/15] GLB/FBX export remains behind independent final QA")
    log("[15/15] CHARACTER BUILD COMPLETE")
    return report


if __name__ == "__main__":
    main()
