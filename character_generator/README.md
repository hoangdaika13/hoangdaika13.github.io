# Astra H-08 self-contained Blender pipeline

This generator accepts exactly one visual input: the project-owned Astra H-08
2D character sheet. It must not import any external `.blend`, FBX, OBJ, GLB,
glTF, VRM, MakeHuman, DAZ, Character Creator, Mixamo, or marketplace model.

The final humanoid body must be a connected polygon surface generated directly
with `mesh.from_pydata()` or `bmesh`; primitive body parts are prohibited.
Armor may use extensively reshaped hard-surface primitives only after the body
passes four-view silhouette QA.

Build order is gated:

1. `01_body_generator.py` / `modeling/body.py`
2. face and facial topology
3. hair
4. bodysuit
5. armor
6. materials
7. humanoid and secondary rig
8. facial shape keys
9. animation
10. export and website integration

No final asset may be committed or pushed before the render comparison and
animation validation gates pass.

## Rig and animation code

The post-approval implementation is prepared under `rigging/` and `animation/`.
It is inert on import and reports an absent/incomplete target instead of guessing
scene state. `07_rig.py` authors the humanoid/finger FK-IK rig, facial keys and
hair chains; `09_animation.py` authors the exact 13-action, 60 FPS library. Both
entry points fail closed while `approvedForNextPhase` is false and neither opens,
saves, imports, or exports a Blender file.

Ordinary Python static validation is available without Blender:

```powershell
python character_generator/animation/static_validate.py
python character_generator/rigging/static_validate.py
python -m compileall -q character_generator/animation character_generator/rigging
```

## Release export

`export_release.py` and the modules under `export/` are a fail-closed release
step for the eventual finished Blender scene. They export selected, already
authored meshes/armature to `assets/character-3d/astra-h08/output/ASTRA_H08.glb`
and `.fbx`, then write hashes and exact object/bone/action/shape-key/material
statistics. They never create or import model data.

Run `./character_generator/run_blender.ps1 -Phase export` only with the final
scene open/supplied after independent QA has explicitly set both
`approvedForNextPhase` and `approvedForRelease` to `true`. The current review is
rejected, so the command intentionally exits with code 2, writes only
`ASTRA_H08.pending.json`, and must not write GLB/FBX/release manifest files.
