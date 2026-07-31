"""Build normalized Astral Realms weapon GLBs from a JSON source catalog.

Run with Blender in background mode:
  blender --background --python build_weapon_glb.py -- catalog.json output-dir

The catalog is intentionally external so original downloaded packs never need to
be committed. Each output receives stable runtime sockets and normalized bounds.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


RANGED_CLASSES = {"pistol", "rifle", "shotgun", "sniper", "heavy"}
VERTICAL_CLASSES = {"sword", "greatsword", "dualBlade", "spear", "hammer", "scythe", "staff"}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def import_source(source: Path) -> None:
    suffix = source.suffix.lower()
    if suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source), use_anim=False)
    elif suffix in {".gltf", ".glb"}:
        bpy.ops.import_scene.gltf(filepath=str(source), import_shading="NORMALS")
    else:
        raise ValueError(f"Unsupported source format: {source}")


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def hierarchy_roots(objects: list[bpy.types.Object]) -> list[bpy.types.Object]:
    selected = set(objects)
    return [obj for obj in objects if obj.parent not in selected]


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)
    return minimum, maximum


def add_socket(root: bpy.types.Object, name: str, position: tuple[float, float, float]) -> None:
    socket = bpy.data.objects.new(name, None)
    socket.empty_display_type = "PLAIN_AXES"
    socket.empty_display_size = 0.045
    socket.parent = root
    socket.location = position
    bpy.context.scene.collection.objects.link(socket)


def normalize_weapon(entry: dict) -> tuple[bpy.types.Object, int]:
    meshes = mesh_objects()
    if not meshes:
        raise RuntimeError(f"No mesh was imported for {entry['id']}")

    root = bpy.data.objects.new("HHWeaponAsset", None)
    root.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(root)
    model = bpy.data.objects.new("Model", None)
    model.parent = root
    bpy.context.scene.collection.objects.link(model)

    imported = list(bpy.context.scene.objects)
    imported.remove(root)
    imported.remove(model)
    for obj in hierarchy_roots(imported):
        world = obj.matrix_world.copy()
        obj.parent = model
        obj.matrix_world = world

    bpy.context.view_layer.update()
    minimum, maximum = world_bounds(meshes)
    size = maximum - minimum
    source_axis = max(range(3), key=lambda index: abs(size[index]))
    weapon_class = entry["class"]

    orientation = entry.get("orientation")
    if weapon_class in RANGED_CLASSES or orientation == "ranged":
        target_axis = Vector((0.0, 0.0, -1.0))
    elif weapon_class in VERTICAL_CLASSES or weapon_class == "bow":
        target_axis = Vector((0.0, 1.0, 0.0))
    else:
        target_axis = Vector((0.0, 1.0, 0.0))
    source_vector = Vector((0.0, 0.0, 0.0))
    source_vector[source_axis] = 1.0
    model.rotation_mode = "QUATERNION"
    model.rotation_quaternion = source_vector.rotation_difference(target_axis)
    bpy.context.view_layer.update()

    minimum, maximum = world_bounds(meshes)
    size = maximum - minimum
    longest = max(abs(size.x), abs(size.y), abs(size.z), 0.0001)
    target_length = float(entry.get("targetLength", 1.35))
    model.scale *= target_length / longest
    bpy.context.view_layer.update()

    minimum, maximum = world_bounds(meshes)
    center = (minimum + maximum) * 0.5
    if weapon_class in RANGED_CLASSES or orientation == "ranged":
        model.location += Vector((-center.x, -center.y, -center.z))
    elif weapon_class == "bow":
        model.location += Vector((-center.x, -center.y, -center.z))
    elif weapon_class == "shield":
        model.location += Vector((-center.x, -center.y, -center.z))
    else:
        model.location += Vector((-center.x, -minimum.y, -center.z))
    bpy.context.view_layer.update()

    grip_left = entry.get("gripLeft", [0.0, 0.0, -target_length * 0.34])
    muzzle = entry.get("muzzle", [0.0, 0.0, -target_length * 0.56])
    blade_root = entry.get("bladeRoot", [0.0, target_length * 0.16, 0.0])
    blade_tip = entry.get("bladeTip", [0.0, target_length * 0.92, 0.0])
    add_socket(root, "Grip_R", (0.0, 0.0, 0.0))
    add_socket(root, "Grip_L", tuple(float(value) for value in grip_left))
    add_socket(root, "Muzzle", tuple(float(value) for value in muzzle))
    add_socket(root, "BladeRoot", tuple(float(value) for value in blade_root))
    add_socket(root, "BladeTip", tuple(float(value) for value in blade_tip))

    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        obj.name = f"WeaponMesh_{entry['id']}_{obj.name}"
        for material in obj.data.materials:
            if not material:
                continue
            material.use_nodes = True
            material.blend_method = "OPAQUE"
            material.surface_render_method = "DITHERED"

    root["hhWeaponId"] = entry["id"]
    root["hhWeaponClass"] = weapon_class
    root["hhSource"] = entry["source"]
    root["hhLicense"] = entry["license"]
    root["hhTwoHanded"] = bool(entry.get("twoHanded", False))
    root["hhOffhand"] = bool(entry.get("offhand", False))
    root["hhTriangles"] = triangles
    return root, triangles


def export_weapon(entry: dict, output_dir: Path) -> dict:
    reset_scene()
    source = Path(entry["input"]).resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    import_source(source)
    root, triangles = normalize_weapon(entry)
    output = output_dir / f"{entry['id']}-raw.glb"
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_add_webp=True,
        export_image_webp_fallback=True,
        export_lights=False,
        export_cameras=False,
        export_extras=True,
    )
    return {"id": entry["id"], "raw": str(output), "triangles": triangles}


def main() -> None:
    try:
        separator = sys.argv.index("--")
    except ValueError as error:
        raise SystemExit("Expected: -- catalog.json output-dir") from error
    args = sys.argv[separator + 1 :]
    if len(args) != 2:
        raise SystemExit("Expected: -- catalog.json output-dir")
    catalog_path = Path(args[0]).resolve()
    output_dir = Path(args[1]).resolve()
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    results = []
    for index, entry in enumerate(catalog["weapons"], 1):
        print(f"[AstralWeapon] {index}/{len(catalog['weapons'])}: {entry['id']}")
        results.append(export_weapon(entry, output_dir))
    (output_dir / "build-report.json").write_text(
        json.dumps({"weapons": results}, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
