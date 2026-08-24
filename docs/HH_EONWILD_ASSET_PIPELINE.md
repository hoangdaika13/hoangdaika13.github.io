# HH EonWild production asset pipeline

HH EonWild uses The Isle only as a quality reference. No model, texture, animation, audio, map, code or visual identity is copied from that product.

## Current truth

The four vertical-slice creature contracts remain placeholders. Tyrannosaurus and Triceratops now have optional animated Quaternius CC0 GLBs for testing the real import/skin/animation path, while Spinosaurus and Pteranodon still use procedural geometry. The imported pair is deliberately marked `prototype-only`: each has one LOD, flat colors, six clips and known skin-root warnings, so `productionModelsReady` must remain `false` until every creature has an approved GLB, four LOD levels, bespoke rig, complete animation set, PBR textures, scientific review and checksums.

The environment runtime now contains four self-hosted Poly Haven CC0 assets at the 1K tier: fern clumps, a mossy rock set, a living quiver tree and a partly-cloudy photographic HDRI. They are real-world scans/photo-based lighting sources, but 1K runtime assets alone do not make the whole scene equivalent to camera footage. Their combined runtime size is 10,471,123 bytes under a hard 12 MiB budget.

## Pipeline

1. Build and rig at real scale in Blender with one bespoke skeleton per species.
2. Export GLB with named animation clips and material slots.
3. Validate glTF structure, scale, transforms, skin weights and animation bounds.
4. Generate four LOD levels and apply Meshopt compression.
5. Convert texture sets to KTX2 and enforce the texture/triangle budgets in the manifest.
6. Add the asset record, scientific source, reconstruction confidence, license and SHA-256 to `asset-manifest.v1.json`.
7. Run `npm run validate:eonwild-assets` and browser QA on WebGPU, WebGL and Canvas Lite fallback.

Runtime code must fail closed: a missing, invalid or unlicensed production asset keeps the procedural proxy and displays its placeholder status. It must never silently claim production quality.

Promotion is also fail-closed in the manifest validator. A production creature must be linked by `productionAssetId` to its bespoke contract, expose the exact four-level LOD chain, contain every required animation in the GLB, declare the full PBR channel set and bounded texture budget, carry an approved scientific review, and match a separate production-approved provenance receipt. Renaming a prototype to `production` is therefore rejected even when its checksum is valid.

## Reproducible Poly Haven environment ingest

Run `node scripts/sync-eonwild-polyhaven-assets.js` with glTF Transform 4.4.2 installed. The script has a fixed asset allowlist and:

1. Calls only the official `https://api.polyhaven.com/info/{id}` and `/files/{id}` endpoints using `HH-EonWild-AssetPipeline/1.0 (+https://hoang8.com)`.
2. Accepts downloads only from `https://dl.polyhaven.org/file/ph-assets/` and rejects credentials, alternate hosts and unsafe relative paths.
3. Downloads the official 1K glTF package or 1K Radiance HDR into an isolated temporary directory.
4. Verifies the API-provided byte size and MD5 for every source file before writing a runtime result.
5. Bundles each glTF, BIN and JPEG dependency into a self-contained GLB, generates portable MikkTSpace tangents for the normal maps, then runs `gltf-transform validate`.
6. Computes SHA-256 for every same-origin runtime file and writes `assets/eonwild/environment/polyhaven-provenance.v1.json`.
7. Fails if the four output files exceed 12 MiB.

The checked-in manifest deliberately duplicates the source MD5 evidence and is cross-checked against the provenance receipt by `npm run validate:eonwild-assets`. The validator also verifies actual file sizes, SHA-256 values, canonical CC0 declarations, pinned Poly Haven URLs and the pinned Babylon.js glTF loader.

Do not run this sync command as part of browser startup or deployment. External runtime assets remain forbidden; only the verified same-origin outputs belong in the game. See `assets/eonwild/THIRD_PARTY_NOTICES.md` for sources and license records.

## Reproducible Quaternius prototype ingest

Run `node scripts/sync-eonwild-quaternius-creatures.js` to re-fetch the two bounded prototype GLBs. The script accepts only the pinned Poly Pizza pages and `static.poly.pizza` resource IDs, verifies the visible Quaternius/CC0 declaration, enforces a 1 MiB limit per file, parses the GLB container, requires one skin and the exact `attack/death/idle/jump/run/walk` clip set, then writes SHA-256 evidence to `assets/eonwild/creatures/quaternius-provenance.v1.json`.

These prototype records can exercise the runtime loader but can never satisfy a production contract: the validator requires `status: production` for that promotion and separately checks that every prototype remains linked to a placeholder contract with incomplete PBR and one LOD declared honestly.
