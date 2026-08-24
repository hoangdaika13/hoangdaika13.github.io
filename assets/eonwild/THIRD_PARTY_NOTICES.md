# HH EonWild third-party notices

This file records third-party runtime components used by HH EonWild. It is provenance documentation, not a claim that every scene component is production-ready or photorealistic.

## Poly Haven environment assets

Poly Haven publishes its assets under the Creative Commons CC0 1.0 Universal public-domain dedication. License and provider policy: https://polyhaven.com/license. Canonical license text: https://creativecommons.org/publicdomain/zero/1.0/.

Attribution is not required by CC0, but HH preserves authors and source pages for auditability:

- **Fern 02** — Rob Tuytel (scanning), Rico Cilliers (modeling). Source: https://polyhaven.com/a/fern_02. Runtime: `environment/fern-02-1k.glb`.
- **Rock Moss Set 01** — Kless Gyzen. Source: https://polyhaven.com/a/rock_moss_set_01. Runtime: `environment/rock-moss-set-01-1k.glb`.
- **Quiver Tree 02** — Dario Barresi (photography), Rico Cilliers (modeling). Source: https://polyhaven.com/a/quiver_tree_02. Runtime: `environment/quiver-tree-02-1k.glb`.
- **Kloofendal 48d Partly Cloudy (Pure Sky)** — Greg Zaal (original), Jarod Guest (sky edits). Source: https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky. Runtime: `environment/kloofendal-partly-cloudy-puresky-1k.hdr`.

All four assets were downloaded through the official Poly Haven API at the 1K tier. API source-file MD5 records, output byte sizes, output SHA-256 values and the exact ingest User-Agent are stored in `environment/polyhaven-provenance.v1.json` and `asset-manifest.v1.json`.

## Babylon.js Loaders 9.22.1

- Project: Babylon.js
- Component: `babylonjs-loaders` 9.22.1 UMD bundle
- Retrieval URL: https://unpkg.com/babylonjs-loaders@9.22.1/babylonjs.loaders.min.js
- Local runtime path: `../../vendor/babylonjs-loaders-9.22.1.min.js`
- License: Apache License 2.0
- Local license text: `../../vendor/BABYLON-LICENSE.md`

The loader is self-hosted and version-pinned so `.glb` files load without a third-party runtime request.

License-file SHA-256 values in the EonWild manifest use UTF-8 text with line endings normalized to LF, keeping the audit value stable across Windows and Unix checkouts.

## Quaternius animated dinosaur prototypes

- Original pack: [Animated LowPoly Dinosaurs](https://quaternius.itch.io/animated-lowpoly-dinosaurs)
- Author: Quaternius
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Distribution pages: [T-Rex](https://poly.pizza/m/UYtneO5FpF) and [Triceratops](https://poly.pizza/m/IGvrUqGrRM)
- Local runtime files: `creatures/quaternius-tyrannosaurus-prototype.glb` and `creatures/quaternius-triceratops-prototype.glb`

The two self-hosted GLBs are low-poly, flat-color, rigged prototypes with six animation clips. They are not photographic models and are not production-approved. Exact resource IDs, hashes, file sizes, animation names and validator warnings are recorded in `creatures/quaternius-provenance.v1.json` and `asset-manifest.v1.json`.
