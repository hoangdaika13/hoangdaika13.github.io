# HH Character 3D — production pipeline

## Current truth

The website currently keeps **Astra H-08** in concept/build mode. The raster
sheet under `assets/character-3d/astra-h08/concept/` is the only permitted
visual input. No external 3D model, human base, marketplace asset, MakeHuman,
Character Creator, DAZ or Mixamo file may be imported into the production
pipeline. A runtime preview must never be represented as the completed model.

Blender 5.2.0 LTS is available at
`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Production starts
with `character_generator/01_body_generator.py`: it must create one connected
humanoid polygon surface directly from vertices/edges/faces and render front,
side, back and three-quarter QA images before face, hair, clothing, rigging or
animation can proceed. Previous primitive blockouts were rejected and removed.

## Required artist pass

1. Use the concept sheet as design direction, redraw any details that do not work in 3D and lock orthographic proportions.
2. Sculpt an original face, body, hair clusters, boots, gloves and multilayer costume.
3. Retopologize deformation loops around eyes, mouth, shoulders, elbows, hips and knees. Targets: mobile 20–35k triangles, balanced 35–60k, cinematic 60–100k.
4. UV unwrap and produce licensed PBR/MToon textures. Use 512–1K on mobile, 1K balanced and no more than 2K cinematic.
5. Create a humanoid armature and manually weight paint body, fingers, hair and costume. Verify A-pose, crouch, walk, run, sit and raised arms.
6. Add expression shape keys for neutral, happy, angry, sad, relaxed and surprised, plus blink left/right and visemes `aa`, `ih`, `ou`, `ee`, `oh`.
7. Add Spring Bone chains and conservative colliders for head, shoulders, chest and torso. Test hair and costume penetration on every quality tier.
8. Store author, consent/provenance, source URL, exact license, commercial/modification/redistribution/avatar permissions and SHA-256 in `assets/character-3d/rights-registry.json`.
9. Export VRM 1.0 for avatars and GLB for props/stages; reusable animation may use VRMA or glTF clips. Validate using Khronos glTF Validator and a VRM 1.0 validator.
10. Optimize geometry with Draco or Meshopt and texture with KTX2/Basis. Do not assume a generic glTF exporter preserves VRM extensions.

## Runtime contract

- Three.js r184 and its locally hosted GLTF, Draco, KTX2 and Meshopt loaders are reused; no second Three.js bundle is loaded from a CDN.
- Imported files are local-only, limited to GLB/VRM, inspected for extension, MIME, size and GLB magic bytes, and released with `URL.revokeObjectURL`.
- Unknown licensing is allowed for private preview but blocks public/reusable publishing pathways.
- Browser speech synthesis is a free fallback. Audio-amplitude mouth motion is labelled **estimated lip-sync**, never phoneme recognition.
- PNG uses the WebGL canvas. Realtime recording checks `MediaRecorder.isTypeSupported()` before selecting WebM/MP4; browser support determines the actual format.
- Webcam mocap remains P1 until MediaPipe Face/Pose Landmarker runs in a Worker with explicit consent, local processing, calibration, stop/cleanup and no automatic upload.

## QA checklist

- Desktop target: 55–60 FPS on the reference hardware; mobile target: approximately 30 FPS.
- No T-pose flash between available animation clips; use 200–400ms crossfades.
- Reduced-motion disables nonessential idle movement.
- Mobile 375px has no horizontal page overflow.
- Hide the tab to pause rendering/physics/audio analysis.
- Mount/unmount repeatedly while checking renderer geometry/texture counts and released Object URLs.
- Test corrupted, oversized and externally referenced assets; no URL import is accepted.
- Test WebGL context loss/restore, transparent PNG, portrait/thumbnail export and codec fallback.

## GLB / FBX release handoff

The format exporters are isolated under `character_generator/export/`; they do
not generate, import or modify body, head, hair, armor, rig or animation. The
release entry point is `character_generator/export_release.py` (or
`run_blender.ps1 -Phase export`). It inventories the already-open final scene,
requires one armature, applied transforms, 60 FPS, required object/material
roles, facial shape keys and authored actions, and enforces the realtime
triangle/bone budgets before either exporter runs.

Export is intentionally fail-closed. Both `approvedForNextPhase` and
`approvedForRelease` must be explicitly true in the independent QA review.
While the current human-base review remains rejected, the command exits with
code 2 and may write only `ASTRA_H08.pending.json`; it must not create
`ASTRA_H08.glb`, `ASTRA_H08.fbx` or `ASTRA_H08.release.json`.

After a future final scene passes visual and animation QA, a successful run
writes the editable `.blend`, GLB, FBX, SHA-256 hashes, exact scene/action/shape
key/material statistics and a small release manifest beside the asset. The
website may auto-load only the same-origin GLB named by that ready manifest.
FBX remains an interchange copy; the exporter does not claim to preserve VRM
extensions.
