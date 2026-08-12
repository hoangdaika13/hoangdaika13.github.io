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
    "skin": (0.72, 0.38, 0.30, 1.0),
    "skin_soft": (0.92, 0.58, 0.48, 1.0),
    "eye_white": (0.86, 0.91, 0.94, 1.0),
    "iris_cyan": (0.015, 0.52, 0.62, 1.0),
    "hair_coral": (0.92, 0.19, 0.25, 1.0),
    "hair_root": (0.31, 0.035, 0.060, 1.0),
    "hair_tip": (1.00, 0.39, 0.42, 1.0),
    "suit": (0.010, 0.013, 0.018, 1.0),
    "suit_panel": (0.035, 0.045, 0.055, 1.0),
    "armor_white": (0.78, 0.76, 0.68, 1.0),
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
    _set(shader, 0.49, "Roughness")
    _set(shader, 1.42, "IOR")
    _set(shader, 0.075, "Subsurface Weight", "Subsurface")
    _set(shader, (1.0, 0.47, 0.30), "Subsurface Radius")

    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.name = "SKIN_MICRO_VARIATION"
    noise.inputs["Scale"].default_value = 115.0
    noise.inputs["Detail"].default_value = 2.0
    noise.inputs["Roughness"].default_value = 0.6
    bump = tree.nodes.new("ShaderNodeBump")
    bump.name = "SKIN_MICRO_BUMP"
    bump.inputs["Strength"].default_value = 0.055
    bump.inputs["Distance"].default_value = 0.0005
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    normal = _input(shader, "Normal")
    if normal is not None:
        tree.links.new(bump.outputs["Normal"], normal)
    return material


def _hair(name: str, base: Color, root: Color, tip: Color) -> bpy.types.Material:
    material, tree, shader = _fresh_material(name)
    material.diffuse_color = base
    _set(shader, 0.32, "Roughness")
    _set(shader, 1.47, "IOR")
    _set(shader, 0.15, "Coat Weight", "Clearcoat")
    _set(shader, 0.18, "Coat Roughness", "Clearcoat Roughness")

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
    _set(shader, 1.51, "IOR")
    _set(shader, 0.10, "Coat Weight", "Clearcoat")
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.name = "FABRIC_MICRO_WEAVE"
    noise.inputs["Scale"].default_value = 180.0
    noise.inputs["Detail"].default_value = 1.4
    noise.inputs["Roughness"].default_value = 0.72
    bump = tree.nodes.new("ShaderNodeBump")
    bump.name = "FABRIC_NORMAL"
    bump.inputs["Strength"].default_value = 0.13
    bump.inputs["Distance"].default_value = 0.0007
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
        "EYE_WHITE": _simple_principled("EYE_WHITE", PALETTE["eye_white"], roughness=0.20, coat=0.24),
        "IRIS_CYAN": _simple_principled("IRIS_CYAN", PALETTE["iris_cyan"], roughness=0.16, coat=0.35),
        "EYELID_SKIN": _simple_principled("EYELID_SKIN", (0.62, 0.25, 0.24, 1.0), roughness=0.52),
        "HAIR_MAT": _hair("HAIR_MAT", PALETTE["hair_coral"], PALETTE["hair_root"], PALETTE["hair_tip"]),
        "HAIR_ROOT": _hair("HAIR_ROOT", PALETTE["hair_root"], (0.20, 0.015, 0.03, 1.0), PALETTE["hair_coral"]),
        "HAIR_TIP": _hair("HAIR_TIP", PALETTE["hair_tip"], PALETTE["hair_coral"], (1.0, 0.53, 0.51, 1.0)),
        "BODYSUIT_BLACK": _technical_fabric("BODYSUIT_BLACK", PALETTE["suit"], 0.36),
        "BODYSUIT_PANEL": _technical_fabric("BODYSUIT_PANEL", PALETTE["suit_panel"], 0.29),
        "ARMOR_WHITE": _simple_principled("ARMOR_WHITE", PALETTE["armor_white"], metallic=0.08, roughness=0.29, coat=0.30),
        "ARMOR_RED": _simple_principled("ARMOR_RED", PALETTE["armor_red"], metallic=0.13, roughness=0.25, coat=0.36),
        "METAL_DARK": _simple_principled("METAL_DARK", PALETTE["metal_dark"], metallic=0.82, roughness=0.24),
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
        return "BODY_SKIN"
    if name.startswith("IRIS_"):
        return "IRIS_CYAN"
    if name.startswith("EYE_"):
        return "EYE_WHITE"
    if name.startswith("EYELID_"):
        return "EYELID_SKIN"
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
