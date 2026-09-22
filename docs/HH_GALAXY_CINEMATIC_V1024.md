# HH Galaxy — Cinematic environments v1024

## Scope

Extends the existing Platform-contained Galaxy. `/platform`, authentication,
login artwork, Solar Secret, Admin guards, tool routes and stored document
formats are unchanged. The only shell edits are release/cache asset references.

The map and all eleven workspace environments use real Three.js meshes, a
perspective camera and depth testing. Workspace tools, charts, labels and forms
remain stable HTML; they are intentionally not rendered into a 3D texture.
Artwork is procedural illustration, not astronomical measurement or photography.

## Visual changes

- Shared ocean, gas, ice, rock and technological surface families, world-space
  lighting, derivative bump detail, day/night shading and restrained reflections.
- Independent cloud shells; atmosphere rim/terminator tint; anti-aliased ring
  bands, gaps and analytical planet shadow. Moons have defined poses even when
  animation is paused before the first frame.
- Solar granulation, slow plasma, darker spots and small magnetic loops.
  Layered nebula sprites, spatial stars and existing sparse meteor effects.
  ACES tone mapping and bounded renderer antialiasing; glow uses sprites rather
  than an expensive full-screen postprocessing bloom stack.
- Map selection approaches the real target with damped camera position/yaw.
  Keyboard focus highlights a planet; the sun participates in raycast occlusion.
  Opening a workspace remains an explicit action. No camera flight delays routing.
- A single sticky scene continues behind each workspace instead of a separate
  canvas on every card. The local portal image remains the failure fallback.

| Workspace | Spatial identity |
| --- | --- |
| AI | Violet/cyan technology core and instanced neural nodes |
| Music | Banded planet and instanced resonance bars (decorative, not fake audio data) |
| Video | Rocky planet and depth-separated cinematic frames |
| Creator | Multicolored gas world and interlaced ribbons |
| Games | Ocean world and a belt of rocky islands |
| Dev | Dark technical planet and rotated lattice frames |
| Learning | Ocean world, warm observatory and armillary rings |
| Community | Ocean world and linked constellation nodes, no simulated people |
| Tools | Ice planet and mechanical gyroscope |
| Analytics | Ice world and spatial arcs, no invented chart values |
| Settings | Rocky world and control-station modules |

## Runtime and data

The workspace scene survives same-route document refreshes. Route changes still
destroy the old renderer. Setup failure and context loss stop the render loop;
destruction disconnects observers/listeners and disposes GPU resources exactly once.
Hidden, offscreen and forced-color scenes do not render on resize. Manual pause
survives a system reduced-motion preference change.

Quality and pause reuse `hh.galaxy.universe.v1` through the existing account-scoped
storage adapter, preserving the other fields. No new account identifiers,
credentials, API calls or external assets are introduced. Settings' reduced motion
and quiet effects continue to take precedence. DPR is capped at 1/1.25/1.5 for
workspace tiers and the existing 1/1.3/1.65 on the map. Slow-frame adaptation cannot
be inadvertently reversed by an unrelated same-route refresh.

## Verification — 22 September 2026

- 343 focused Galaxy, shell, scroll and release tests passed. This includes eight
  new behavioral tests for geometry/material isolation, orbit planes, camera
  damping and the actual renderer lifecycle with a fake GPU boundary.
- JavaScript/module syntax checks and `git diff --check` passed.
- No generic lint, typecheck or build script exists in this static-JS repository;
  these were not reported as passing commands.
- Browser: all eleven workspace routes mounted exactly one ready WebGL canvas;
  no document horizontal overflow at desktop. Map return removed the workspace
  canvas. Browser error logs inspected during these route runs were empty.
- AI draft survived AI → Music → Back. Changing quality retained the selected
  value after reload. A temporary local document refresh retained the scene frame
  counter (8 → 9) and one canvas, rather than recreating the renderer.
- Map raycast selected Music; paused camera focused at distance 25. Keyboard
  rotation/Home worked; Escape restored `pan-y pinch-zoom` and left 3D control mode.
- The local browser fixture exercised real WebGL context loss on both renderers,
  fallback status, retry with one canvas, and destroy with zero remaining canvases.
- 375×812 and 768×1024: zero horizontal document overflow. Mobile page scroll
  reached the workspace below the hero. Graphics controls measured 44px high.
- Runtime test verifies reduced motion and forced colors without altering OS
  preferences. Physical multi-touch gestures and real 200% browser zoom remain
  unverified: the in-app browser did not apply the zoom shortcuts. No claim of
  complete device/accessibility certification is made.

### Measured rendering cost

Same deterministic map fixture, overview camera, 1280×720 viewport, balanced:

| Counter | HEAD baseline | v1024 |
| --- | ---: | ---: |
| Draw calls | 48 | 66 |
| GPU geometries | 14 | 18 |

The increase buys independent moons/clouds and solar-loop meshes, not extra canvases.
Final AI workspace: 11 balanced draw calls (down from 28 before instancing), 5 in
economy, 5 geometries. The map fixture recorded short samples around 85–87 FPS on
this host. These are not sustained benchmarks, nor a claim of 60 FPS on other
devices. Browser focus/privacy shielding and background throttling affect samples.

### Visual comparison and test harness

`tests/fixtures/galaxy-graphics-qa.html?still=1` freezes a deterministic overview.
`python scripts/galaxy-qa-baseline.py --port 8768 --ref 6414528` serves the baseline renderers
without changing checkout files. Compare with a normal local static server on a
different port. The helper binds only to loopback and never writes repository data.

Before/after 1280×720 PNGs and a mobile screenshot were captured as task artifacts
outside the repository (`galaxy-1024/map-before.png`, `map-after.png`,
`mobile-after.png`). The fixture itself is not registered in production navigation
or precached by the service worker.

### Known environment limits

Static preview does not provide the AI gateway (existing HTTP 404 readiness
message), authenticated backend or realtime server. Those services were not changed
or represented as functional. Functional smoke testing used isolated localhost
guest data; no production account data was sent. A temporary QA document/draft may
remain in that local-only guest profile after the browser interrupted cleanup.

## Sources and rights

- Existing local Three.js r184, MIT: `vendor/THREE-LICENSE.txt`.
- All added shaders, material recipes and landmark geometry are original project
  code; no external texture, model, HDRI, image or dependency was downloaded.
- Existing project portal images are unchanged and retain their prior provenance.

## Release manifest

Service worker v1024; loader v685; Galaxy Layer One JS v26 / worlds CSS v17;
Living Universe JS v7 / CSS v3; map renderer v7; workspace renderer v2;
shared celestial materials v2. No schema migration is required.
