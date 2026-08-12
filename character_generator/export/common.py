"""Shared validation and reporting for Astra H-08 release exports.

This module never creates, imports, reshapes, rigs, or animates character data.
It validates the already-open Blender scene and only exposes objects that pass
the explicit release gate to the format-specific exporters.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import bpy

from config import ASSET_ROOT, CHARACTER_NAME, FPS, PROJECT_ROOT, PROVENANCE


OUTPUT_ROOT = ASSET_ROOT / "output"
QA_REVIEW_PATH = ASSET_ROOT / "qa" / "human-base-latest.review.json"
REPORT_PATH = OUTPUT_ROOT / "ASTRA_H08.report.json"
MANIFEST_PATH = OUTPUT_ROOT / "ASTRA_H08.release.json"
PENDING_REPORT_PATH = OUTPUT_ROOT / "ASTRA_H08.pending.json"
GLB_PATH = OUTPUT_ROOT / "ASTRA_H08.glb"
FBX_PATH = OUTPUT_ROOT / "ASTRA_H08.fbx"
BLEND_PATH = OUTPUT_ROOT / "ASTRA_H08.blend"

REQUIRED_ACTIONS = (
    "Idle",
    "Idle_Breathing",
    "Walk",
    "Run",
    "Jump_Start",
    "Jump_Loop",
    "Jump_Land",
    "Attack_01",
    "Attack_02",
    "Wave",
    "Look_Around",
    "Turn_Left",
    "Turn_Right",
)
REQUIRED_SHAPE_KEYS = (
    "Basis",
    "Blink_L",
    "Blink_R",
    "Blink_Both",
    "Smile",
    "Sad",
    "Angry",
    "Surprised",
    "Mouth_Open",
    "Mouth_A",
    "Mouth_E",
    "Mouth_I",
    "Mouth_O",
    "Mouth_U",
)
REQUIRED_MATERIAL_ROLES = (
    "BODY_SKIN",
    "HAIR",
    "BODYSUIT",
    "ARMOR_WHITE",
    "ARMOR_RED",
    "METAL_DARK",
    "EMISSION_CYAN",
)
REQUIRED_OBJECT_ROLES = (
    "BODY",
    "HEAD",
    "HAIR",
    "BODYSUIT",
    "ARMOR",
    "BOOTS",
)


class ReleaseGateError(RuntimeError):
    """Raised when an unapproved or incomplete scene reaches an exporter."""


@dataclass(frozen=True)
class SceneInventory:
    objects: tuple[bpy.types.Object, ...]
    meshes: tuple[bpy.types.Object, ...]
    armatures: tuple[bpy.types.Object, ...]
    vertices: int
    triangles: int
    bones: int
    materials: tuple[str, ...]
    shape_keys: tuple[str, ...]
    actions: tuple[str, ...]

    def report(self) -> dict[str, Any]:
        return {
            "objects": len(self.objects),
            "meshObjects": len(self.meshes),
            "armatures": len(self.armatures),
            "vertices": self.vertices,
            "triangles": self.triangles,
            "bones": self.bones,
            "materials": list(self.materials),
            "materialCount": len(self.materials),
            "shapeKeys": list(self.shape_keys),
            "shapeKeyCount": len(self.shape_keys),
            "actions": list(self.actions),
            "actionCount": len(self.actions),
        }


def _read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ReleaseGateError(f"Required QA record is missing: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ReleaseGateError(f"Required QA record is unreadable: {path}") from exc
    if not isinstance(value, dict):
        raise ReleaseGateError(f"Required QA record is not a JSON object: {path}")
    return value


def write_pending_report(reason: str, review: dict[str, Any] | None = None) -> dict[str, Any]:
    """Record why no release asset exists without creating a publish manifest."""
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "character": CHARACTER_NAME,
        "status": "build-pending",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "approvedForRelease": False,
        "reason": str(reason),
        "qa": {
            "status": (review or {}).get("status", "missing-or-unreadable"),
            "approvedForNextPhase": (review or {}).get("approvedForNextPhase") is True,
            "approvedForRelease": (review or {}).get("approvedForRelease") is True,
        },
        "outputsWritten": [],
    }
    PENDING_REPORT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def require_visual_qa(review_path: Path = QA_REVIEW_PATH) -> dict[str, Any]:
    """Require an explicit human visual approval before any release export."""
    review = _read_json(review_path)
    if review.get("approvedForNextPhase") is not True:
        status = str(review.get("status") or "not-approved")
        reason = (
            f"Visual QA blocks release export ({status}). "
            "ASTRA_H08.glb/FBX were not written."
        )
        write_pending_report(reason, review)
        raise ReleaseGateError(reason)
    if review.get("approvedForRelease") is not True:
        reason = (
            "Final visual/animation QA has not set approvedForRelease=true. "
            "ASTRA_H08.glb/FBX were not written."
        )
        write_pending_report(reason, review)
        raise ReleaseGateError(reason)
    return review


def _evaluated_triangles(obj: bpy.types.Object, depsgraph: bpy.types.Depsgraph) -> int:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        return len(mesh.loop_triangles)
    finally:
        evaluated.to_mesh_clear()


def inventory_scene() -> SceneInventory:
    objects = tuple(
        obj for obj in bpy.context.scene.objects
        if obj.type in {"MESH", "ARMATURE"} and not obj.hide_render
    )
    meshes = tuple(obj for obj in objects if obj.type == "MESH")
    armatures = tuple(obj for obj in objects if obj.type == "ARMATURE")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    triangles = sum(_evaluated_triangles(obj, depsgraph) for obj in meshes)
    bones = sum(len(obj.data.bones) for obj in armatures)
    materials = sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material})
    shape_keys = sorted({
        block.name
        for obj in meshes
        if obj.data.shape_keys
        for block in obj.data.shape_keys.key_blocks
    })
    actions = sorted({action.name for action in bpy.data.actions})
    return SceneInventory(
        objects=objects,
        meshes=meshes,
        armatures=armatures,
        vertices=vertices,
        triangles=triangles,
        bones=bones,
        materials=tuple(materials),
        shape_keys=tuple(shape_keys),
        actions=tuple(actions),
    )


def _contains_role(names: Iterable[str], role: str) -> bool:
    normalized_role = role.casefold().replace("_", "")
    return any(normalized_role in name.casefold().replace("_", "") for name in names)


def validate_scene(inventory: SceneInventory) -> dict[str, Any]:
    failures: list[str] = []
    warnings: list[str] = []
    object_names = tuple(obj.name for obj in inventory.objects)

    if not inventory.meshes:
        failures.append("No renderable mesh objects are present.")
    if len(inventory.armatures) != 1:
        failures.append(f"Expected exactly one release armature; found {len(inventory.armatures)}.")
    if not 70_000 <= inventory.triangles <= 150_000:
        failures.append(f"Triangle count {inventory.triangles} is outside the 70k-150k release budget.")
    if inventory.bones <= 0 or inventory.bones > 150:
        failures.append(f"Bone count {inventory.bones} must be between 1 and 150.")

    missing_objects = [role for role in REQUIRED_OBJECT_ROLES if not _contains_role(object_names, role)]
    missing_materials = [role for role in REQUIRED_MATERIAL_ROLES if not _contains_role(inventory.materials, role)]
    missing_shapes = [name for name in REQUIRED_SHAPE_KEYS if name not in inventory.shape_keys]
    missing_actions = [name for name in REQUIRED_ACTIONS if name not in inventory.actions]
    if missing_objects:
        failures.append(f"Missing required object roles: {', '.join(missing_objects)}")
    if missing_materials:
        failures.append(f"Missing required material roles: {', '.join(missing_materials)}")
    if missing_shapes:
        failures.append(f"Missing required shape keys: {', '.join(missing_shapes)}")
    if missing_actions:
        failures.append(f"Missing required animation actions: {', '.join(missing_actions)}")

    for obj in inventory.meshes:
        scale_error = any(abs(float(value) - 1.0) > 1e-4 for value in obj.scale)
        rotation_error = any(abs(float(value)) > 1e-4 for value in obj.rotation_euler)
        if scale_error or rotation_error:
            failures.append(f"{obj.name} has unapplied rotation or scale.")
        if obj.parent and obj.parent.type == "ARMATURE":
            continue
        if not any(modifier.type == "ARMATURE" and modifier.object for modifier in obj.modifiers):
            failures.append(f"{obj.name} is not bound to an armature.")

    if bpy.context.scene.render.fps != FPS:
        failures.append(f"Scene FPS is {bpy.context.scene.render.fps}; expected {FPS}.")
    if not inventory.shape_keys:
        warnings.append("No shape keys were found.")

    return {
        "passed": not failures,
        "failures": failures,
        "warnings": warnings,
        "required": {
            "objects": list(REQUIRED_OBJECT_ROLES),
            "materials": list(REQUIRED_MATERIAL_ROLES),
            "shapeKeys": list(REQUIRED_SHAPE_KEYS),
            "actions": list(REQUIRED_ACTIONS),
        },
    }


def select_export_objects(inventory: SceneInventory) -> tuple[bpy.types.Object, ...]:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in inventory.objects:
        obj.hide_set(False)
        obj.select_set(True)
    if inventory.armatures:
        bpy.context.view_layer.objects.active = inventory.armatures[0]
    return inventory.objects


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def begin_release() -> tuple[dict[str, Any], SceneInventory, dict[str, Any]]:
    review = require_visual_qa()
    inventory = inventory_scene()
    validation = validate_scene(inventory)
    if not validation["passed"]:
        raise ReleaseGateError("Release scene validation failed: " + " ".join(validation["failures"]))
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    select_export_objects(inventory)
    return review, inventory, validation


def write_report(
    review: dict[str, Any],
    inventory: SceneInventory,
    validation: dict[str, Any],
    outputs: dict[str, Path],
) -> dict[str, Any]:
    output_records = {
        name: {
            "path": str(path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for name, path in outputs.items()
        if path.is_file()
    }
    report = {
        "schemaVersion": 1,
        "character": CHARACTER_NAME,
        "status": "qa-approved-export",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "blenderVersion": bpy.app.version_string,
        "fps": FPS,
        "provenance": PROVENANCE,
        "qa": {
            "reviewedAt": review.get("reviewedAt"),
            "status": review.get("status"),
            "approvedForNextPhase": review.get("approvedForNextPhase") is True,
            "approvedForRelease": review.get("approvedForRelease") is True,
        },
        "scene": inventory.report(),
        "validation": validation,
        "outputs": output_records,
        "limitations": [
            "FBX is an interchange copy; the local GLB is the website runtime source.",
            "This exporter does not claim to preserve VRM extensions.",
        ],
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "schemaVersion": 1,
        "assetId": "astra-h08-release-v1",
        "status": "ready",
        "model": output_records.get("glb"),
        "report": str(REPORT_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "approvedForRelease": True,
        "stats": inventory.report(),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report
