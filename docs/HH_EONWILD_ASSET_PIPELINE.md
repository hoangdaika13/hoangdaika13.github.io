# HH EonWild production asset pipeline

HH EonWild uses The Isle only as a quality reference. No model, texture, animation, audio, map, code or visual identity is copied from that product.

## Current truth

The four vertical-slice creatures are procedural placeholders. `productionModelsReady` must remain `false` until every creature contract has an approved GLB, four LOD levels, bespoke rig, required animation clips, texture set, scientific source, compatible license and checksum.

## Pipeline

1. Build and rig at real scale in Blender with one bespoke skeleton per species.
2. Export GLB with named animation clips and material slots.
3. Validate glTF structure, scale, transforms, skin weights and animation bounds.
4. Generate four LOD levels and apply Meshopt compression.
5. Convert texture sets to KTX2 and enforce the texture/triangle budgets in the manifest.
6. Add the asset record, scientific source, reconstruction confidence, license and SHA-256 to `asset-manifest.v1.json`.
7. Run `npm run validate:eonwild-assets` and browser QA on WebGPU, WebGL and Canvas Lite fallback.

Runtime code must fail closed: a missing, invalid or unlicensed production asset keeps the procedural proxy and displays its placeholder status. It must never silently claim production quality.
