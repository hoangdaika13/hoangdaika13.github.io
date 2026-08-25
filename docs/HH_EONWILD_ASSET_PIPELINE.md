# HH EonWild production asset pipeline

HH EonWild uses The Isle only as a quality reference. No model, texture, animation, audio, map, code or visual identity is copied from that product.

## Current truth

The four vertical-slice creature contracts remain placeholders. Tyrannosaurus and Triceratops now have optional animated Quaternius CC0 GLBs for testing the real import/skin/animation path, while Spinosaurus and Pteranodon still use procedural geometry. The imported pair is deliberately marked `prototype-only`: each has one LOD, flat colors, six clips and known skin-root warnings, so `productionModelsReady` must remain `false` until every creature has an approved GLB, four LOD levels, bespoke rig, complete animation set, PBR textures, scientific review and checksums.

The environment runtime now contains four self-hosted Poly Haven CC0 assets at the 1K tier: fern clumps, a mossy rock set, a living quiver tree and a partly-cloudy photographic HDRI. They are real-world scans/photo-based lighting sources, but 1K runtime assets alone do not make the whole scene equivalent to camera footage. Their combined runtime size is 10,471,123 bytes under a hard 12 MiB budget.

The base renderer also has a fully code-generated environment path: seeded terrain/biomes/rivers, Worker chunk geometry, seventeen vegetation roles with thin-instance rendering, layered wind, water/weather/atmosphere state and bounded environmental interaction pools. These systems remain available with every Cinematic Pack removed. They are documented in `docs/HH_EONWILD_PROCEDURAL_ENVIRONMENT.md` and are still described as procedural fallbacks rather than scanned production scenery.

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

The validator does not trust those arrays by themselves. It parses the complete GLB container and requires LOD0–LOD3 to resolve to four distinct meshes with backed POSITION accessors (or an equivalent valid `MSFT_lod` chain). Every material textureInfo must resolve through a valid texture and sampler to a self-contained PNG, JPEG, WebP or KTX2 image; embedded image headers are measured against the declared edge budget. Required animation names count only when their channels target real nodes, their samplers reference backed FLOAT accessors and their keyframe times increase. Wetness/dirt evidence must be bound to an actual named texture or `extras.eonwildTextureIndices`, not a free-form channel claim. The production receipt must repeat the exact LOD, texture-channel and texture-budget records; renamed nodes, dangling indices, empty clips and a one-mesh/non-PBR GLB cannot pass by copying optimistic metadata.

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

## Personal Cinematic Pack

The Personal Cinematic Pack is an owner-operated delivery layer for assets that are too large for the repository. It does not turn the current prototype creatures into production models and it does not weaken the production-promotion validator. The ordinary same-origin assets and Canvas Lite renderer remain the mandatory fallback.

Six independent pack IDs are accepted:

- `creature-ultra`
- `forest-vegetation`
- `terrain-rock`
- `ocean`
- `weather-atmosphere`
- `cinematic-audio`

`hh-eonwild-cinematic-pack.js` is the first script in the route-lazy game bundle, so the base App Shell does not pay its startup cost. It stores large packs in the Origin Private File System (OPFS), hashes streams in `hh-eonwild-cinematic-pack-worker.js`, and uses a separate `hh-eonwild-cinematic-assets-v1` Cache Storage cache only when OPFS is unavailable. The Service Worker deliberately preserves this named cache during normal shell-cache rotation and bypasses the App Shell cache for both `cache: "no-store"` and `Range` requests, preventing a resumable multi-gigabyte pack from being duplicated or served with broken range semantics. Cache fallback is capped at 128 MiB; a larger pack fails with `OPFS_REQUIRED_FOR_LARGE_PACK` instead of retaining a multi-hundred-megabyte Blob in normal web cache.

### Immutable manifest contract

Import only a reviewed JSON manifest with this shape:

```json
{
  "format": "hh-eonwild-cinematic-pack",
  "version": 1,
  "id": "creature-ultra",
  "build": "2026.08.24-owner.1",
  "immutable": true,
  "totalBytes": 300000000,
  "licenseReportUrl": "https://hoang8.com/eonwild/licenses/creature-ultra-2026.08.24.html",
  "licenseReportSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "assets": [
    {
      "path": "tyrannosaurus/lod0.glb",
      "role": "creature:tyrannosaurus:lod0",
      "url": "https://hoang8.com/eonwild/packs/creature-ultra/sha256-lod0.glb",
      "byteSize": 150000000,
      "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "contentType": "model/gltf-binary",
      "author": "Reviewed asset author",
      "license": "CC-BY-4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "sourceUrl": "https://official.example/asset-page",
      "provenanceSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    {
      "path": "tyrannosaurus/lod1.glb",
      "role": "creature:tyrannosaurus:lod1",
      "url": "https://hoang8.com/eonwild/packs/creature-ultra/sha256-lod1.glb",
      "byteSize": 80000000,
      "sha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "contentType": "model/gltf-binary",
      "author": "Reviewed asset author",
      "license": "CC-BY-4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "sourceUrl": "https://official.example/asset-page",
      "provenanceSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    {
      "path": "tyrannosaurus/lod2.glb",
      "role": "creature:tyrannosaurus:lod2",
      "url": "https://hoang8.com/eonwild/packs/creature-ultra/sha256-lod2.glb",
      "byteSize": 45000000,
      "sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "contentType": "model/gltf-binary",
      "author": "Reviewed asset author",
      "license": "CC-BY-4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "sourceUrl": "https://official.example/asset-page",
      "provenanceSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    {
      "path": "tyrannosaurus/lod3.glb",
      "role": "creature:tyrannosaurus:lod3",
      "url": "https://hoang8.com/eonwild/packs/creature-ultra/sha256-lod3.glb",
      "byteSize": 25000000,
      "sha256": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "contentType": "model/gltf-binary",
      "author": "Reviewed asset author",
      "license": "CC-BY-4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "sourceUrl": "https://official.example/asset-page",
      "provenanceSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  ]
}
```

Every build ID must identify one immutable manifest. Reusing a build ID for different bytes is unsupported. Paths reject absolute paths, drive letters, reserved metadata names, empty segments and `.`/`..`. Pack and asset byte budgets, duplicate paths, SHA-256 format, active content types and summed `totalBytes` are validated before storage is opened. Asset and license-report URLs accept same-origin by default. A separate HTTPS object-storage origin is accepted only through the manager's immutable `trustedOrigins` allowlist; credentials, queries and URL fragments are rejected.

The installer fetches the report with credentials omitted, redirects disabled and a 4 MiB hard limit, hashes its actual bytes, and refuses the pack before requesting any model when the hash differs. The verified report is stored beside the pack and is re-hashed by `verify()` and before the first runtime asset URL is issued. Every asset repeats the report hash as `provenanceSha256`, so bytes from one build cannot be paired with another report.

Each asset must also carry either a record in the manager's `approvedAssetRecords` map whose SHA-256, byte size, author, official source and license fields all match, or the complete inline author, fixed approved license, license URL and official source URL shown above. A bare approved ID can never authorize substitute bytes. An invented reference and an unverified report URL are rejected. The delivery manifest remains an integrity envelope; editorial review must still verify that the named author and license actually describe the binary before the report checksum is approved.

### Bounded runtime roles

Installation accepts only the general role grammar, while the renderer consumes a smaller semantic allowlist. This prevents an arbitrary verified file from being attached to an unrelated shader or decoder:

| Pack | Runtime role | Current consumer |
| --- | --- | --- |
| `creature-ultra` | `creature:<species>:lod0` through `lod3` | Four unique GLBs are mandatory per species. Babylon loads LOD0 first, keeps the proxy until locomotion clips are usable, then switches among available LODs at bounded camera distances. |
| `forest-vegetation` | `vegetation:fern`, `vegetation:rock`, `vegetation:quiver` | Replaces the matching deterministic instanced foreground prop and retains the repository scan on any failure. |
| `terrain-rock` | `terrain:albedo`, `terrain:normal`, `terrain:roughness`, `terrain:ao` | Binds verified tiled PBR textures to streamed terrain chunks. |
| `ocean` | `ocean:normal`, `ocean:foam` | Binds the verified water normal/foam textures while the procedural normal remains the fallback. |
| `weather-atmosphere` | `weather:hdri` | Supplies the physical environment/sky IBL; an invalid HDR keeps the repository Poly Haven sky. |
| `cinematic-audio` | `audio:ambience`, `audio:forest`, `audio:ocean`, `audio:rain`, `audio:wind` | Uses one verified looping ambience, follows the real sound toggle/volume and pauses/disposes with the renderer. |

Every selected runtime file is re-hashed before its Blob URL is created. Concurrent reads share one immutable verified Blob per pack generation, and every reference is released on route disposal. Texture, audio, model and HDR consumers all validate a same-origin Blob URL and the expected MIME family. They still label imported content `productionApproved: false` unless the separate repository production validator approves the exact binary and receipt.

The current Babylon vertical slice has authored renderer proxies for Tyrannosaurus, Triceratops, Spinosaurus and Pteranodon, so only those four can consume a Creature Ultra LOD chain today. The remaining nine Flagship species stay playable through the broader simulation/Canvas path and must not be claimed as cinematic creature integrations until their 3D locomotion/camera contracts are added.

The license report must trace each packed asset back to the production manifest/provenance receipt: author, official source, license and license URL, scientific identity/confidence where applicable, processing history, checksum, byte size, PBR channels, animation set, LOD chain and truthful prototype/production status. The pack installer validates delivery integrity; `npm run validate:eonwild-assets` remains responsible for production eligibility. Never use a Google Images result, ripped game asset or ambiguous downloadable model as a pack source.

### Object storage requirements

The immutable asset URL must return the exact declared bytes, use CORS for `https://hoang8.com`, and support `Range: bytes=N-` with an exact `Content-Range: bytes N-(size-1)/size`. Redirects are intentionally rejected, so a signed URL that redirects or expires is not suitable. Send long-lived immutable caching headers only after the object is final. Do not put OAuth tokens, signed secrets, Discord credentials or account identifiers in a manifest URL.

### Install, pause and resume

1. Import and validate the manifest.
2. Request persistent storage from a user gesture when the browser supports it.
3. Start `manager.install(manifest, { onProgress })`, or use `installFromFiles` with an owner-selected `Map<path, File>` plus the local license/provenance report file.
4. Display `loadedBytes`, `totalBytes`, `assetLoadedBytes`, `assetTotalBytes` and `phase`; these are observed bytes, not a simulated percentage.
5. `manager.pause(packId)` aborts the request. OPFS commits the safe partial file and the next install sends a bounded Range request from its exact size. Cache fallback resumes at completed-asset boundaries.
6. A server that ignores Range causes a safe full-file restart. A mismatched `Content-Range`, overflow, exact-size mismatch or checksum mismatch fails the pack.
7. Only state `ready` may produce an `assetUrl`. Release each Blob URL with `releaseAssetUrl`, or dispose the manager when the route closes.

Network interruption retains only bounded partial OPFS data or already verified Cache entries. A different manifest clears partial data for that pack before download, preventing bytes from two builds being combined.

### Integrity, deletion and fallback

- `verify(packId)` re-reads every stored byte and updates `verifiedAt`; a missing or corrupt entry changes the pack to `failed`.
- `verifyAll()` checks all ready packs without inventing online or production status.
- `remove(packId)` waits for an active download to stop, revokes its Blob URLs, and removes both OPFS and Cache copies.
- `removeAll()` clears all six Personal Cinematic packs, but leaves the lightweight repository assets intact.
- `storageEstimate()` reports browser usage/quota and active storage capability; `requestPersistence()` asks the browser not to evict owner-installed data when supported.

The renderer must treat `paused`, `failed`, missing and unverified packs as unavailable, show a clear “Dùng model thay thế” state, and continue with the lightweight model/material. Do not render a black frame while installing or verifying. Never place pack bytes in `localStorage`, commit them to Git, or let the Service Worker precache remote multi-gigabyte payloads.

Install, verify, runtime URL creation and removal are serialized per pack. Removal aborts or waits for the active operation, surfaces OPFS permission/I/O failures instead of pretending success, and cannot be followed by stale verification code recreating a ready marker or Blob URL.

### Security and failure checklist

- Test an untrusted origin, credentialed URL, URL fragment, unsafe path, duplicate path, active MIME type and incorrect total.
- Test a correct 206 resume, a wrong Content-Range, a server returning 200 to a resume request, cancellation during streaming and a network disconnect.
- Test exact byte overflow/underflow and a valid-size file with a bad SHA-256.
- Test OPFS installation, sub-128-MiB Cache fallback, rejection above the fallback limit, restart with the same manifest and replacement with a different build.
- Test verify, one-pack deletion, delete-all, object URL release, route disposal and Service Worker upgrade preservation.
- Keep WebGL2 and Canvas Lite functional with every pack removed.
