"""Procedural PBR palette for the Astra H-08 reference design.

All shading is generated with Blender nodes; no image, texture or model asset is
loaded.  Builders are deterministic and idempotent so later phases may safely
refresh a material after an approved body regeneration.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import bpy


Color = tuple[float, float, float, float]


PALETTE: dict[str, Color] = {
    # Linear-space rose ivory calibrated against the supplied portrait.  The
    # previous saturated brown values turned the face into a dark mask under the
    # neutral QA rig and destroyed the anime facial read.
    "skin": (0.78, 0.45, 0.39, 1.0),
    "skin_soft": (0.84, 0.57, 0.50, 1.0),
    "eye_white": (0.86, 0.91, 0.94, 1.0),
    "iris_cyan": (0.015, 0.52, 0.62, 1.0),
    "hair_coral": (0.64, 0.16, 0.18, 1.0),
    "hair_root": (0.28, 0.035, 0.052, 1.0),
    "hair_tip": (0.92, 0.34, 0.35, 1.0),
    "suit": (0.012, 0.016, 0.021, 1.0),
    "suit_panel": (0.030, 0.039, 0.047, 1.0),
    "armor_white": (0.82, 0.80, 0.74, 1.0),
    "armor_red": (0.49, 0.035, 0.040, 1.0),
    "metal_dark": (0.025, 0.032, 0.040, 1.0),
    "cyan": (0.005, 0.72, 0.86, 1.0),
}


def _input(node: bpy.types.Node, *names: str) -> bpy.types.NodeSocket | None:
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            return socket
    return None


def _set(node: bpy.types.Node, value: Any, *names: str) -> None:
    socket = _input(node, *names)
    if socket is not None:
        socket.default_value = value


def _fresh_material(name: str) -> tuple[bpy.types.Material, bpy.types.NodeTree, bpy.types.Node]:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = PALETTE.get("suit", (0.1, 0.1, 0.1, 1.0))
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "ASTRA_OUTPUT"
    output.location = (520.0, 0.0)
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "ASTRA_PRINCIPLED"
    principled.location = (160.0, 0.0)
    material.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    material["astra_procedural"] = True
    material["external_textures"] = False
    return material, material.node_tree, principled


def _simple_principled(
    name: str,
    color: Color,
    *,
    metallic: float = 0.0,
    roughness: float = 0.45,
    ior: float = 1.46,
    coat: float = 0.0,
) -> bpy.types.Material:
    material, _tree, shader = _fresh_material(name)
    material.diffuse_color = color
    _set(shader, color, "Base Color")
    _set(shader, metallic, "Metallic")
    _set(shader, roughness, "Roughness")
    _set(shader, ior, "IOR")
    _set(shader, coat, "Coat Weight", "Clearcoat")
    _set(shader, 0.22, "Coat Roughness", "Clearcoat Roughness")
    return material


def _skin() -> bpy.types.Material:
    material, tree, shader = _fresh_material("BODY_SKIN")
    color = PALETTE["skin"]
    material.diffuse_color = color
    _set(shader, color, "Base Color")
    _set(shader, 0.55, "Roughness")
    _set(shader, 1.42, "IOR")
    _set(shader, 0.095, "Subsurface Weight", "Subsurface")
    _set(shader, (1.0, 0.47, 0.30), "Subsurface Radius")

    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.name = "SKIN_MICRO_VARIATION"
    noise.inputs["Scale"].default_value = 145.0
    noise.inputs["Detail"].default_value = 2.0
    noise.inputs["Roughness"].default_value = 0.6
    bump = tree.nodes.new("ShaderNodeBump")
    bump.name = "SKIN_MICRO_BUMP"
    bump.inputs["Strength"].default_value = 0.035
    bump.inputs["Distance"].default_value = 0.0005
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    normal = _input(shader, "Normal")
    if normal is not None:
        tree.links.new(bump.outputs["Normal"], normal)
    return material


def _face_skin() -> bpy.types.Material:
    """Warm matte face material; the suit must never override facial skin."""
    material = _simple_principled(
        "FACE_SKIN",
        PALETTE["skin_soft"],
        roughness=0.58,
        ior=1.42,
        coat=0.015,
    )
    return material


def _hair(name: str, base: Color, root: Color, tip: Color) -> bpy.types.Material:
    material, tree, shader = _fresh_material(name)
    material.diffuse_color = base
    _set(shader, 0.38, "Roughness")
    _set(shader, 1.47, "IOR")
    _set(shader, 0.10, "Coat Weight", "Clearcoat")
    _set(shader, 0.24, "Coat Roughness", "Clearcoat Roughness")

    texcoord = tree.nodes.new("ShaderNodeTexCoord")
    texcoord.name = "HAIR_COORDINATES"
    separate = tree.nodes.new("ShaderNodeSeparateXYZ")
    separate.name = "HAIR_VERTICAL_AXIS"
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.name = "HAIR_ROOT_TO_TIP"
    ramp.color_ramp.elements[0].position = 0.17
    ramp.color_ramp.elements[0].color = root
    ramp.color_ramp.elements[1].position = 0.82
    ramp.color_ramp.elements[1].color = tip
    tree.links.new(texcoord.outputs["Generated"], separate.inputs["Vector"])
    tree.links.new(separate.outputs["Z"], ramp.inputs["Fac"])
    base_socket = _input(shader, "Base Color")
    if base_socket is not None:
        tree.links.new(ramp.outputs["Color"], base_socket)

    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.name = "HAIR_STRAND_BREAKUP"
    noise.inputs["Scale"].default_value = 64.0
    noise.inputs["Detail"].default_value = 3.0
    bump = tree.nodes.new("ShaderNodeBump")
    bump.name = "HAIR_STRAND_NORMAL"
    bump.inputs["Strength"].default_value = 0.10
    bump.inputs["Distance"].default_value = 0.001
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    normal = _input(shader, "Normal")
    if normal is not None:
        tree.links.new(bump.outputs["Normal"], normal)
    return material


def _technical_fabric(name: str, color: Color, roughness: float) -> bpy.types.Material:
    material, tree, shader = _fresh_material(name)
    material.diffuse_color = color
    _set(shader, color, "Base Color")
    _set(shader, roughness, "Roughness")
    _set(shader, 1.46, "IOR")
    _set(shader, 0.015, "Coat Weight", "Clearcoat")
    _set(shader, 0.42, "Coat Roughness", "Clearcoat Roughness")
    _set(shader, 0.16, "Sheen Weight", "Sheen")
    _set(shader, 0.44, "Sheen Roughness")
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.name = "FABRIC_MICRO_WEAVE"
    noise.inputs["Scale"].default_value = 240.0
    noise.inputs["Detail"].default_value = 2.0
    noise.inputs["Roughness"].default_value = 0.72
    bump = tree.nodes.new("ShaderNodeBump")
    bump.name = "FABRIC_NORMAL"
    bump.inputs["Strength"].default_value = 0.19
    bump.inputs["Distance"].default_value = 0.00045
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    normal = _input(shader, "Normal")
    if normal is not None:
        tree.links.new(bump.outputs["Normal"], normal)
    return material


def _emission() -> bpy.types.Material:
    material, _tree, shader = _fresh_material("EMISSION_CYAN")
    color = PALETTE["cyan"]
    material.diffuse_color = color
    _set(shader, (0.003, 0.055, 0.065, 1.0), "Base Color")
    _set(shader, 0.23, "Roughness")
    _set(shader, color, "Emission Color", "Emission")
    _set(shader, 3.2, "Emission Strength")
    return material


def build_materials() -> dict[str, bpy.types.Material]:
    """Create/update the complete stable Astra material namespace."""
    materials = {
        "BODY_SKIN": _skin(),
        "FACE_SKIN": _face_skin(),
        "EYE_WHITE": _simple_principled("EYE_WHITE", PALETTE["eye_white"], roughness=0.20, coat=0.24),
        "IRIS_CYAN": _simple_principled("IRIS_CYAN", PALETTE["iris_cyan"], roughness=0.16, coat=0.35),
        "EYELID_SKIN": _simple_principled("EYELID_SKIN", (0.38, 0.055, 0.070, 1.0), roughness=0.48),
        "EYEBROW_MAT": _simple_principled("EYEBROW_MAT", (0.25, 0.025, 0.040, 1.0), roughness=0.47),
        "MOUTH_INNER_MAT": _simple_principled("MOUTH_INNER_MAT", (0.24, 0.018, 0.026, 1.0), roughness=0.56),
        "LIP_NATURAL": _simple_principled("LIP_NATURAL", (0.60, 0.16, 0.18, 1.0), roughness=0.46),
        "HAIR_MAT": _hair("HAIR_MAT", PALETTE["hair_coral"], PALETTE["hair_root"], PALETTE["hair_tip"]),
        "HAIR_ROOT": _hair("HAIR_ROOT", PALETTE["hair_root"], (0.20, 0.015, 0.03, 1.0), PALETTE["hair_coral"]),
        "HAIR_TIP": _hair("HAIR_TIP", PALETTE["hair_tip"], PALETTE["hair_coral"], (1.0, 0.53, 0.51, 1.0)),
        "BODYSUIT_BLACK": _technical_fabric("BODYSUIT_BLACK", PALETTE["suit"], 0.54),
        "BODYSUIT_PANEL": _technical_fabric("BODYSUIT_PANEL", PALETTE["suit_panel"], 0.48),
        "ARMOR_WHITE": _simple_principled("ARMOR_WHITE", PALETTE["armor_white"], metallic=0.04, roughness=0.36, coat=0.20),
        "ARMOR_RED": _simple_principled("ARMOR_RED", PALETTE["armor_red"], metallic=0.09, roughness=0.33, coat=0.24),
        "METAL_DARK": _simple_principled("METAL_DARK", PALETTE["metal_dark"], metallic=0.78, roughness=0.30),
        "EMISSION_CYAN": _emission(),
    }
    for name, material in materials.items():
        material["astra_role"] = name
    print(f"[06/15] Created procedural PBR palette: {len(materials)} materials")
    return materials


def _default_role_for_object(obj: bpy.types.Object) -> str | None:
    explicit = obj.get("material_role")
    if isinstance(explicit, str) and explicit:
        return explicit
    name = obj.name.upper()
    if name == "BODY_CONTINUOUS":
        return "FACE_SKIN"
    if name.startswith("EYEBROW_"):
        return "EYEBROW_MAT"
    if name == "MOUTH_INNER":
        return "MOUTH_INNER_MAT"
    if name.startswith("MOUTH_LIP"):
        return "LIP_NATURAL"
    if name.startswith("IRIS_"):
        return "IRIS_CYAN"
    if name.startswith("PUPIL_"):
        return "METAL_DARK"
    if name.startswith("EYE_"):
        return "EYE_WHITE"
    if name.startswith("EYELID_"):
        return "EYELID_SKIN"
    if name.startswith("HAIR_ACCESSORY_CYAN"):
        return "EMISSION_CYAN"
    if name.startswith("HAIR_ACCESSORY_RED"):
        return "ARMOR_RED"
    if name.startswith("HAIR_ACCESSORY_FRAME"):
        return "ARMOR_WHITE"
    if name.startswith(("HAIR_ACCESSORY_CORE", "HAIR_BRAID_CLASP_TOP")):
        return "METAL_DARK"
    if name.startswith("HAIR_BRAID_CLASP_END"):
        return "ARMOR_RED"
    if name.startswith("HAIR_"):
        return "HAIR_MAT"
    if name == "BODYSUIT":
        return "BODYSUIT_BLACK"
    if "CYAN" in name or "EMISSION" in name or "LIGHT" in name:
        return "EMISSION_CYAN"
    if "RED" in name or "CORAL" in name:
        return "ARMOR_RED"
    if any(token in name for token in ("JOINT", "METAL", "SOLE", "VENT", "BOLT")):
        return "METAL_DARK"
    if "ARMOR" in name or name.startswith(("BOOTS_", "GLOVES_", "ACCESSORY_")):
        return "ARMOR_WHITE"
    return None


def assign_character_materials(
    materials: Mapping[str, bpy.types.Material] | None = None,
) -> dict[str, str]:
    """Assign by stable role/name without editing mesh topology or transforms."""
    palette = dict(materials or build_materials())
    assigned: dict[str, str] = {}
    for obj in bpy.data.objects:
        if not hasattr(obj.data, "materials"):
            continue
        role = _default_role_for_object(obj)
        material = palette.get(role or "")
        if material is None:
            continue
        obj.data.materials.clear()
        obj.data.materials.append(material)
        assigned[obj.name] = material.name
    print(f"[06/15] Assigned materials to {len(assigned)} character objects")
    return assigned
