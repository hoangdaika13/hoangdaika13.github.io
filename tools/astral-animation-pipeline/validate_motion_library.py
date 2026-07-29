"""Validate baked actions against the target mesh without rendering the game."""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    raw = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--motion", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(raw)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(Path(path).resolve()))
    return [obj for obj in bpy.data.objects if obj not in before]


def main():
    args = parse_args()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    target_objects = import_glb(args.target)
    target = max((obj for obj in target_objects if obj.type == "ARMATURE"), key=lambda obj: len(obj.data.bones))
    import_glb(args.motion)
    target.animation_data_create()
    scene = bpy.context.scene
    report = {"target": Path(args.target).name, "motion": Path(args.motion).name, "clips": []}
    mesh_objects = [obj for obj in target_objects if obj.type == "MESH"]

    for action in sorted(bpy.data.actions, key=lambda item: item.name):
        if action.name.startswith("Scene"):
            continue
        target.animation_data.action = action
        sample_frames = sorted({
            int(math.floor(action.frame_range[0])),
            int(round((action.frame_range[0] + action.frame_range[1]) * 0.5)),
            int(math.ceil(action.frame_range[1])),
        })
        maximum_span = 0.0
        finite = True
        samples = []
        for frame in sample_frames:
            scene.frame_set(frame)
            depsgraph = bpy.context.evaluated_depsgraph_get()
            points = []
            for source in mesh_objects:
                evaluated = source.evaluated_get(depsgraph)
                evaluated_mesh = evaluated.to_mesh()
                try:
                    points.extend(evaluated.matrix_world @ vertex.co for vertex in evaluated_mesh.vertices)
                finally:
                    evaluated.to_mesh_clear()
            if not points:
                finite = False
                continue
            minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
            maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
            size = maximum - minimum
            finite = finite and all(math.isfinite(value) for value in (*minimum, *maximum))
            maximum_span = max(maximum_span, size.length)
            samples.append({"frame": frame, "size": [round(value, 4) for value in size]})
        report["clips"].append({
            "name": action.name,
            "finite": finite,
            "maximumSpan": round(maximum_span, 4),
            "samples": samples,
            "safe": finite and maximum_span <= 6.5,
        })

    report["safe"] = bool(report["clips"]) and all(item["safe"] for item in report["clips"])
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["safe"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
