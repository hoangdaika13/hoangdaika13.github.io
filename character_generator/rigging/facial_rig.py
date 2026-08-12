"""Data-API facial shape keys and a small lip-sync demonstration.

The module is intentionally inert on import.  ``build_facial_rig`` is an
explicit, fail-closed phase: it requires the HUMAN_BASE visual approval record
before touching a mesh.  It works with a face/head mesh supplied by a later
modeling phase and never creates or replaces that geometry.
"""

from __future__ import annotations

import math
from typing import Any

import bpy

try:  # Support both package imports and Blender's script-directory imports.
    from ..pipeline_gate import HumanBaseGateError, require_human_base_approved
except ImportError:  # pragma: no cover - exercised only by Blender script mode.
    from pipeline_gate import HumanBaseGateError, require_human_base_approved

FACIAL_SHAPE_KEYS: tuple[str, ...] = (
    "Basis",
    "Blink_L", "Blink_R", "Blink_Both",
    "Eye_Wide", "Eye_Squint",
    "Brow_Up", "Brow_Down", "Brow_Angry",
    "Smile", "Smile_Wide", "Sad", "Angry", "Surprised",
    "Mouth_Open",
    "Mouth_A", "Mouth_E", "Mouth_I", "Mouth_O", "Mouth_U",
    "Mouth_Smile", "Mouth_Frown", "Cheek_Puff",
    # Legacy aliases required by the first brief.
    "A", "E", "I", "O", "U",
)
FACIAL_GENERATOR_ID = "astra_h08.08_facial_rig"
FACIAL_CONTROL_TO_SHAPE: dict[str, str] = {
    "face_blink_l": "Blink_L",
    "face_blink_r": "Blink_R",
    "face_blink_both": "Blink_Both",
    "face_smile": "Smile",
    "face_angry": "Angry",
    "face_sad": "Sad",
    "face_surprised": "Surprised",
    "face_mouth_open": "Mouth_Open",
}


class FacialRigError(RuntimeError):
    """Raised when a facial mesh cannot satisfy the shape-key contract."""


def _resolve_mesh(mesh: bpy.types.Object | str | None) -> bpy.types.Object:
    if isinstance(mesh, str):
        mesh = bpy.data.objects.get(mesh)
    if mesh is None:
        for name in ("HEAD", "FACE", "HEAD_MESH", "BODY_HEAD"):
            candidate = bpy.data.objects.get(name)
            if candidate is not None:
                mesh = candidate
                break
    if mesh is None or mesh.type != "MESH" or mesh.data is None:
        raise FacialRigError("A face/head mesh object is required")
    if len(mesh.data.vertices) < 3:
        raise FacialRigError(f"{mesh.name!r} has too few vertices for shape keys")
    return mesh


def _bounds(mesh: bpy.types.Object) -> tuple[float, float, float, float, float, float]:
    vertices = mesh.data.vertices
    xs = [float(vertex.co.x) for vertex in vertices]
    ys = [float(vertex.co.y) for vertex in vertices]
    zs = [float(vertex.co.z) for vertex in vertices]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def _falloff(value: float, center: float, radius: float) -> float:
    if radius <= 1.0e-8:
        return 0.0
    distance = abs(value - center) / radius
    if distance >= 1.0:
        return 0.0
    return (1.0 - distance * distance) ** 2


def _shape_delta(name: str, co: Any, bounds: tuple[float, ...]) -> tuple[float, float, float]:
    """Return a conservative local-space delta for one expression.

    The masks deliberately degrade to a subtle, valid key on a generic head;
    later face topology can refine the same named keys without changing the
    animation contract.
    """
    x_min, x_max, y_min, y_max, z_min, z_max = bounds
    width = max(x_max - x_min, 1.0e-5)
    depth = max(y_max - y_min, 1.0e-5)
    height = max(z_max - z_min, 1.0e-5)
    x = float(co.x)
    y = float(co.y)
    z = float(co.z)
    # The character faces -Y.  Face-region masks are normalized so the helper
    # also works when the head is authored in a different scale.
    face = _falloff(z, z_min + height * 0.56, height * 0.40)
    mouth = _falloff(z, z_min + height * 0.38, height * 0.19) * _falloff(y, y_min + depth * 0.12, depth * 0.30)
    # Anatomical left is +X throughout the Astra rig contract.
    eye_l = _falloff(x, x_min + width * 0.70, width * 0.24) * _falloff(z, z_min + height * 0.62, height * 0.18)
    eye_r = _falloff(x, x_min + width * 0.30, width * 0.24) * _falloff(z, z_min + height * 0.62, height * 0.18)
    eye = max(eye_l, eye_r)
    if name in {"Blink_L", "Blink_R", "Blink_Both"}:
        factor = eye_l if name == "Blink_L" else eye_r if name == "Blink_R" else max(eye_l, eye_r)
        return (0.0, 0.0, -height * 0.035 * factor)
    if name == "Eye_Wide":
        return (0.0, -depth * 0.012 * eye, height * 0.025 * eye)
    if name == "Eye_Squint":
        return (0.0, 0.0, -height * 0.018 * eye)
    if name in {"Brow_Up", "Brow_Down", "Brow_Angry"}:
        sign = 1.0 if name == "Brow_Up" else -1.0
        asym = (x - (x_min + x_max) * 0.5) / width if name == "Brow_Angry" else 0.0
        return (0.0, 0.0, height * 0.018 * sign * face * (0.5 + abs(asym)))
    if name in {"Smile", "Smile_Wide", "Mouth_Smile"}:
        amount = 0.018 if name != "Smile_Wide" else 0.030
        return (0.0, -depth * 0.010 * mouth, height * amount * mouth * (0.5 + abs(x - (x_min + x_max) * 0.5) / width))
    if name in {"Sad", "Mouth_Frown"}:
        return (0.0, depth * 0.010 * mouth, -height * 0.018 * mouth)
    if name == "Cheek_Puff":
        return (0.0, -depth * 0.028 * face, 0.0)
    if name == "Mouth_Open" or name in {"Mouth_A", "Mouth_E", "Mouth_I", "Mouth_O", "Mouth_U", "A", "E", "I", "O", "U"}:
        vowel = name[-1] if name in {"Mouth_A", "Mouth_E", "Mouth_I", "Mouth_O", "Mouth_U"} else name
        opening = {"A": 0.040, "E": 0.020, "I": 0.014, "O": 0.034, "U": 0.026}.get(vowel, 0.032)
        return (0.0, -depth * 0.014 * mouth, -height * opening * mouth)
    if name in {"Angry", "Surprised"}:
        sign = -1.0 if name == "Angry" else 1.0
        return (0.0, -depth * 0.006 * face, height * 0.015 * sign * face)
    return (0.0, 0.0, 0.0)


def _ensure_key(mesh: bpy.types.Object, name: str, basis: Any, bounds: tuple[float, ...]) -> Any:
    shape_keys = mesh.data.shape_keys
    key = shape_keys.key_blocks.get(name) if shape_keys else None
    if key is None:
        key = mesh.shape_key_add(name=name, from_mix=False)
    for index, vertex in enumerate(mesh.data.vertices):
        base = basis.data[index].co
        dx, dy, dz = _shape_delta(name, base, bounds)
        key.data[index].co = (base.x + dx, base.y + dy, base.z + dz)
    key.value = 0.0
    key.slider_min = 0.0
    key.slider_max = 1.0
    return key


def _resolve_driver_rig(rig: bpy.types.Object | str | None) -> bpy.types.Object | None:
    if isinstance(rig, str):
        rig = bpy.data.objects.get(rig)
    if rig is None:
        rig = bpy.data.objects.get("ASTRA_RIG")
    if rig is None:
        return None
    if rig.type != "ARMATURE" or rig.pose.bones.get("head") is None:
        raise FacialRigError("Facial driver rig must be an armature with a head pose bone")
    return rig


def _ensure_shape_driver(
    key: Any,
    rig: bpy.types.Object,
    control_name: str,
) -> None:
    try:
        key.driver_remove("value")
    except (RuntimeError, TypeError):
        pass
    fcurve = key.driver_add("value")
    driver = fcurve.driver
    driver.type = "AVERAGE"
    variable = driver.variables.new()
    variable.name = "control"
    variable.type = "SINGLE_PROP"
    target = variable.targets[0]
    target.id_type = "OBJECT"
    target.id = rig
    escaped = control_name.replace("\\", "\\\\").replace('"', '\\"')
    target.data_path = f'pose.bones["head"]["{escaped}"]'


def build_facial_rig(
    mesh: bpy.types.Object | str | None = None,
    *,
    rig: bpy.types.Object | str | None = None,
    replace: bool = False,
) -> dict[str, Any]:
    """Create the complete named shape-key set after the visual gate."""
    try:
        require_human_base_approved()
    except HumanBaseGateError as exc:
        raise FacialRigError(str(exc)) from exc
    obj = _resolve_mesh(mesh)
    driver_rig = _resolve_driver_rig(rig)
    if obj.data.shape_keys is None or obj.data.shape_keys.key_blocks.get("Basis") is None:
        basis = obj.shape_key_add(name="Basis", from_mix=False)
    else:
        basis = obj.data.shape_keys.key_blocks["Basis"]
    bounds = _bounds(obj)
    created: list[str] = []
    for name in FACIAL_SHAPE_KEYS[1:]:
        existing = obj.data.shape_keys.key_blocks.get(name)
        if existing is not None and not replace:
            continue
        _ensure_key(obj, name, basis, bounds)
        created.append(name)
    driven: list[str] = []
    if driver_rig is not None:
        head = driver_rig.pose.bones["head"]
        for control_name, shape_name in FACIAL_CONTROL_TO_SHAPE.items():
            if control_name not in head:
                head[control_name] = 0.0
            key = obj.data.shape_keys.key_blocks.get(shape_name)
            if key is not None:
                _ensure_shape_driver(key, driver_rig, control_name)
                driven.append(shape_name)
    obj["astra.generator"] = FACIAL_GENERATOR_ID
    obj["astra.facial_shape_key_contract"] = ",".join(FACIAL_SHAPE_KEYS)
    return validate_facial_shape_keys(obj) | {
        "created": created,
        "driver_rig": driver_rig.name if driver_rig else None,
        "driven_shape_keys": driven,
    }


def validate_facial_shape_keys(mesh: bpy.types.Object | str | None = None) -> dict[str, Any]:
    try:
        obj = _resolve_mesh(mesh)
    except FacialRigError as exc:
        return {
            "ok": False,
            "status": "target-face-mesh-absent",
            "object": None,
            "shape_keys": [],
            "missing": list(FACIAL_SHAPE_KEYS),
            "mismatched": [],
            "issues": [str(exc)],
        }
    blocks = obj.data.shape_keys.key_blocks if obj.data.shape_keys else ()
    names = tuple(block.name for block in blocks)
    missing = [name for name in FACIAL_SHAPE_KEYS if name not in names]
    basis_count = len(blocks[0].data) if blocks else 0
    mismatched = [block.name for block in blocks if len(block.data) != basis_count]
    ok = not missing and not mismatched
    return {
        "ok": ok,
        "status": "valid" if ok else "facial-shape-keys-incomplete",
        "object": obj.name,
        "shape_keys": list(names),
        "missing": missing,
        "mismatched": mismatched,
        "issues": [] if ok else ["Facial shape-key contract is incomplete"],
    }


def _clear_action_channels(action: bpy.types.Action) -> None:
    if hasattr(action, "layers"):
        for layer in tuple(action.layers):
            action.layers.remove(layer)
        for slot in tuple(action.slots):
            action.slots.remove(slot)
    else:
        for curve in tuple(action.fcurves):
            action.fcurves.remove(curve)


def _shape_key_action_writer(action: bpy.types.Action, keys: Any):
    if hasattr(action, "layers"):
        slot = action.slots.new(id_type="KEY", name=keys.name)
        layer = action.layers.new("Facial Performance")
        strip = layer.strips.new(type="KEYFRAME")
        bag = strip.channelbags.new(slot)
        return lambda path: bag.fcurves.new(path)
    return lambda path: action.fcurves.new(path)


def create_facial_demo_action(mesh: bpy.types.Object | str | None = None, *, name: str = "Facial_Demo") -> bpy.types.Action:
    """Key blink, eye direction, smile, and mouth-open demonstration."""
    try:
        require_human_base_approved()
    except HumanBaseGateError as exc:
        raise FacialRigError(str(exc)) from exc
    obj = _resolve_mesh(mesh)
    report = validate_facial_shape_keys(obj)
    if not report["ok"]:
        raise FacialRigError("Cannot animate incomplete facial keys: " + ", ".join(report["missing"]))
    keys = obj.data.shape_keys
    action = bpy.data.actions.get(name) or bpy.data.actions.new(name)
    owner = action.get("astra.generator")
    if owner not in {None, FACIAL_GENERATOR_ID}:
        raise FacialRigError(
            f"Action {name!r} is owned by another author/generator; refusing to overwrite it"
        )
    if owner is None and len(action.pose_markers) > 0:
        raise FacialRigError(
            f"Untagged action {name!r} contains user-authored markers; refusing to overwrite it"
        )
    if owner is None:
        if hasattr(action, "layers") and len(action.layers) > 0:
            raise FacialRigError(
                f"Untagged action {name!r} contains user-authored channels; refusing to overwrite it"
            )
        if hasattr(action, "fcurves") and len(action.fcurves) > 0:
            raise FacialRigError(
                f"Untagged action {name!r} contains user-authored channels; refusing to overwrite it"
            )
    _clear_action_channels(action)
    action.use_fake_user = True
    make_curve = _shape_key_action_writer(action, keys)
    sequence = {
        "Blink_Both": ((1, 0.0), (8, 1.0), (13, 0.0), (100, 0.0), (104, 1.0), (109, 0.0), (180, 0.0)),
        "Smile": ((1, 0.0), (88, 0.0), (116, 0.75), (150, 0.40), (180, 0.0)),
        "Mouth_Open": ((1, 0.0), (128, 0.0), (142, 0.68), (158, 0.0), (180, 0.0)),
        "Eye_Squint": ((1, 0.0), (42, 0.22), (70, 0.0), (180, 0.0)),
    }
    for key_name, frames in sequence.items():
        curve = make_curve(f'key_blocks["{key_name}"].value')
        for frame, value in frames:
            curve.keyframe_points.insert(frame, value)
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
        curve.update()
    animation_data = keys.animation_data_create()
    animation_data.action = action
    if hasattr(action, "slots") and action.slots:
        animation_data.action_slot = action.slots[0]
    action["astra.fps"] = 60
    action["astra.generator"] = FACIAL_GENERATOR_ID
    action["astra.frame_start"] = 1
    action["astra.frame_end"] = 180
    action["astra.sequence"] = "blink -> look left -> look right -> smile -> mouth open -> neutral"
    return action


__all__ = ("FACIAL_SHAPE_KEYS", "FacialRigError", "build_facial_rig", "validate_facial_shape_keys", "create_facial_demo_action")
