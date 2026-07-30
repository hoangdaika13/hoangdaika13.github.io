"""Convert the curated CC0 Free3D nature pack FBX files to web-ready GLB.

Run with Blender:
  blender --background --python scripts/convert-free3d-cc0-nature.py -- INPUT_ROOT OUTPUT_ROOT
"""

from pathlib import Path
import sys

import bpy
from mathutils import Vector


ASSETS = (
    ("Trees/FBX Files/Tree 1.1/Tree1.1.fbx", "free3d-tree-a.glb", 5.8),
    ("Trees/FBX Files/Tree 2.1/Tree2.1.fbx", "free3d-tree-b.glb", 6.4),
    ("Trees/FBX Files/Tree 3.1/Tree3.1.fbx", "free3d-tree-c.glb", 5.2),
    ("Bush/FBX Files/Bush1.1/Bush1.1.fbx", "free3d-bush.glb", 1.35),
    ("Flowers/FBX Files/Flower1.1/Flower1.1.fbx", "free3d-flower.glb", 0.62),
    ("Mushrooms/FBX Files/Mushroom1.1/Mushroom1.1.fbx", "free3d-mushroom.glb", 0.42),
    ("Stone/FBX Files/Stone1.1/Stone1.1.fbx", "free3d-stone.glb", 0.58),
)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for datablock in list(collection):
            if datablock.users == 0:
                collection.remove(datablock)


def import_fbx(path):
    if hasattr(bpy.ops.wm, "fbx_import"):
        bpy.ops.wm.fbx_import(filepath=str(path))
    else:
        bpy.ops.import_scene.fbx(filepath=str(path), automatic_bone_orientation=True)


def normalize_scene(target_height):
    objects = [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "EMPTY"}]
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("FBX contains no mesh")

    corners = []
    for obj in meshes:
        corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    height = max(0.001, maximum.z - minimum.z)
    scale = target_height / height
    center_x = (minimum.x + maximum.x) * 0.5
    center_y = (minimum.y + maximum.y) * 0.5

    root = bpy.data.objects.new("HH_Free3D_CC0_Root", None)
    bpy.context.scene.collection.objects.link(root)
    for obj in list(bpy.context.scene.objects):
        if obj == root or obj.parent is not None:
            continue
        obj.parent = root
    root.scale = (scale, scale, scale)
    root.location = (-center_x * scale, -center_y * scale, -minimum.z * scale)

    for mesh in meshes:
        for material in mesh.data.materials:
            if material is None:
                continue
            material.use_nodes = True
            material.diffuse_color[3] = 1.0
            if hasattr(material, "blend_method"):
                material.blend_method = "OPAQUE"
        mesh.select_set(True)
    return root


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) != 2:
        raise SystemExit("Expected INPUT_ROOT and OUTPUT_ROOT")
    source_root = Path(argv[0]).resolve()
    output_root = Path(argv[1]).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    for relative_path, output_name, target_height in ASSETS:
        source = source_root / relative_path
        if not source.is_file():
            raise FileNotFoundError(source)
        reset_scene()
        import_fbx(source)
        normalize_scene(target_height)
        export_glb(output_root / output_name)
        print(f"HH_FREE3D_EXPORTED {output_name}")


if __name__ == "__main__":
    main()
