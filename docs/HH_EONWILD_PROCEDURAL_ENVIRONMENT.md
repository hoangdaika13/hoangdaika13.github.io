# HH EonWild procedural environment

## Scope and truth

The `#/game` environment is a deterministic browser simulation, not a finished AAA or photoreal production build. It uses original procedural code and optional, verified assets. It does not contain maps, shaders, models, textures, audio or source code copied from The Isle, ARK or another commercial game.

The procedural fallback remains mandatory. Removing every Personal Cinematic Pack and every optional repository environment asset must still leave terrain, biome data, vegetation descriptors, water, weather, atmosphere and Canvas Lite usable. Optional assets improve surface fidelity; they never become a runtime requirement.

## Runtime architecture

The route-lazy bundle loads the following modules before `hh-eonwild-renderer-3d.js`:

1. `hh-eonwild-landscape-core.js`
   - Seeded continental, ridge, detail and domain-warp fields.
   - Drainage and erosion masks.
   - Height, normal, climate and ten blended biome weights.
   - Downhill primary rivers and tributaries shared by every chunk.
   - Bounded rock-shelter/cave descriptors.
   - Renderer-neutral typed-array chunk geometry.
   - LOD hysteresis and dither-transition state.
2. `hh-eonwild-landscape-worker.js`
   - Same-origin Worker only.
   - Validates the immutable job schema before execution.
   - Reuses one core per complete world address.
   - Transfers typed geometry under a 32 MiB result limit.
   - Never creates Babylon, WebGL or DOM objects.
3. `hh-eonwild-vegetation-system.js`
   - Seventeen ecological vegetation roles.
   - Deterministic placement by seed, biome and chunk.
   - Water, slope and rock exclusion.
   - Clusters and natural clearings.
   - Four wind layers and a continuous gust front.
   - Bounded compression, wetness, burn, snow and mud influences.
4. `hh-eonwild-environment-renderer.js`
   - One shared Babylon source per vegetation type.
   - Thin-instance matrices and bounded typed buffers.
   - One chunk plan per update, distance/frustum culling, LOD hysteresis and deterministic density dithering.
   - Bounded chunk-build matrices consume per-instance wind phase and compression state; shared source sway provides live branch/leaf motion without re-uploading every plant each frame.
   - World-to-render-origin conversion for the centered 16.384 km scene.
   - Descriptor-only fallback when thin instances are unavailable.
5. `hh-eonwild-water-weather-system.js`
   - Deterministic river, basin, water, weather, atmosphere and interaction state.
   - Bounded river/waterfall meshes with shared water materials when Babylon exists.
   - Pools for foam, ripple, wake, rain splash, footprint, wetness and vegetation disturbance data.
   - Height/valley/water/weather fog, celestial state and Rayleigh/Mie sky approximation.
   - Seven weather modes: clear, mist, rain, storm, snow, ash and dust.
6. `hh-eonwild-renderer-3d.js`
   - Guarded WebGPU to WebGL2 to Canvas Lite lifecycle.
   - Terrain Worker bridge and a bounded synchronous warm-frame fallback.
   - Babylon terrain, river, vegetation, lighting and weather integration.
   - ACES, physical camera, optional TAA/SSAO2/SSR and cascaded shadows.
   - Honest telemetry and complete route disposal.

## Coordinate contract

- Logical world: `0..16384` metres on X/Z.
- Chunk: `256 × 256` metres.
- Babylon render origin: world centre, so render X/Z are logical coordinates minus `8192`.
- Terrain Worker geometry is chunk-local and converted to the centred scene by the renderer.
- Adjacent chunks sample the exact same world coordinates at shared edges.
- Worker terrain adds bounded skirts after delivery to hide mixed-LOD T-junctions.
- Save schema remains v4; this environment upgrade does not migrate or rescale player data again.

## Terrain and biome model

Every sample combines:

- Continental scale landmass.
- Multi-octave ridged mountains.
- Domain warping.
- Hills and plateaus.
- Drainage erosion.
- Fine detail.
- Coast taper.
- River-bed influence.

Biome weights use elevation, slope, moisture, temperature, water distance, realm and time slice. The current IDs are ocean, reef, wetland, rainforest, forest, grassland, desert, tundra, alpine and volcanic. Weights are normalized and blended; hard painted biome boundaries are not used.

Terrain PBR uses verified albedo/normal/roughness/AO channels when present. Without a pack, natural vertex colour, macro variation, continuous UVs, normal calculation, roughness and live wetness remain active. This is a procedural PBR approximation, not a claim that the current fallback contains 8K scanned material layers.

## Streaming and performance safeguards

- Terrain work dispatches at most two Worker jobs concurrently.
- The first visible terrain patch is capped at 24 segments on the main thread, then replaced by the requested Worker LOD.
- Chunk installation remains bounded per frame.
- Terrain LOD has hysteresis; replacement meshes cross-fade and retain skirts.
- Vegetation plans at most one chunk per update.
- Vegetation density LOD uses deterministic instance rejection near thresholds; wind/compression are applied when a chunk or interaction state rebuilds, while shared source sway remains live each frame. The mirrored `lodData`, `stateData` and `windData` buffers are diagnostic/forward-compatible data, not a claim that an unverified custom shader is running.
- Vegetation has fixed caps per quality profile and never creates one mesh per plant.
- The integrated renderer caps procedural vegetation below the standalone kernel maximum:
  - Low: 3,000 instances / 18 chunks.
  - Balanced: 9,000 / 32.
  - High: 15,000 / 44.
  - Ultra: 24,000 / 56.
  - Cinematic Personal: 36,000 / 64.
- Pools reject or reuse excess environmental effects instead of growing without limit.
- Imported textures/models still use the separate VRAM and asset provenance rules.
- Cinematic Personal is explicit; adaptive quality never enables it automatically.
- Context loss, Worker failure, shader failure or missing assets must fail open to a lighter path, never a black screen.

## Weather and environment interaction

Rain and storms update real simulation state:

- Terrain roughness and darkening.
- Wet vegetation colour/specular response.
- Snow, mud, burn and ash state.
- Puddle and river-level descriptors.
- Ripple, splash and wake pools.
- Height/valley/weather fog.
- Wind and gust fronts.
- Bounded lightning flash and delayed thunder descriptors.

Rain emission is reduced inside a nearby procedural rock-shelter descriptor. The current heightfield cannot carve a fully walkable volumetric cave; those descriptors are truthful groundwork for future cave meshes rather than a claim that complete cave interiors exist now.

Player movement records bounded footprints or water steps. These feed visible thin-instance compression plus footprint, splash, ripple, wake and wetness pools. Records decay, changed interaction state rebuilds the bounded matrices and everything is disposed with the route.

## Visual quality profiles

- **Lite**: Canvas 2D or minimal WebGL, low vegetation and simple water.
- **High**: bounded terrain/vegetation streaming, layered fog and simple reflection.
- **Ultra**: higher density, larger draw distance and guarded volumetric effects.
- **Cinematic Personal**: explicit owner profile with the highest terrain/vegetation budgets, cascaded shadows, TAA/SSR/SSAO2 and physical Photo Mode. It remains bounded and may fail down before context loss.

WebGPU is preferred but optional. WebGL2 and Canvas Lite are required fallbacks.

## Lifecycle

When the document is hidden or the route pauses:

- Render loop stops.
- Landscape Worker terminates and pending chunk jobs return to the bounded queue.
- Vegetation and water/weather stop advancing.
- Rain and cinematic audio stop with the renderer.

On resume, a clean Worker may be created and desired chunks are recalculated. On route disposal, every Worker, mesh, thin-instance buffer, material, texture, particle system, water body, post-process, audio object and listener is released. Disposal is idempotent.

## Security and licensing

- No Google Images download path exists.
- No runtime asset search or arbitrary asset URL exists.
- Procedural modules perform no external network request.
- The Worker URL is fixed and same-origin.
- Worker jobs are schema-validated and size-bounded.
- Optional external assets remain subject to immutable manifest, SHA-256, provenance, MIME, origin and license validation in the Personal Cinematic Pack pipeline.
- Shader or JSON text from an untrusted source is never evaluated.

## Required verification

Run:

```text
node --check <each changed JavaScript file>
npm run test:eonwild
npm run validate:eonwild-assets
npm run test:security:full
npm audit --omit=dev
git diff --check
```

Browser QA must cover WebGPU, WebGL2, 4K Cinematic Personal, Canvas Lite, installed/removed packs, route cycling, hidden/visible tab, failed assets/shaders, console output and lifecycle counts. FPS, p95 frame time, draw calls, triangles, RAM and estimated VRAM are observations from the tested machine, not universal promises.

## Known limitations

- Current repository creature models remain prototypes as described in the asset pipeline.
- Procedural tree geometry and material response are functional fallbacks, not final scanned forest assets.
- Foam, puddle, caustic and interaction pools contain real bounded state, but some effects use simplified Babylon rendering or descriptors rather than a bespoke production shader.
- Cave entries are descriptors/rock shelters; a heightfield alone cannot represent full overhang interiors.
- Audio uses verified optional ambience where available; synthesized placeholder state is not labeled as a field recording.
- Browser telemetry estimates VRAM because Web APIs do not expose a portable authoritative VRAM counter.
