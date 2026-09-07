# HH Focus Room v2

## Product boundary

- Canonical route: `/focus-room`.
- Owner: the **Học tập & Ngôn ngữ** section inside the existing HH Platform shell.
- The workspace does not replace or remount the global header, sidebar or breadcrumb.
- `/music/ambient` remains available as a compatibility workspace. A first-run Focus Room profile can read its old scene, mix and timer preferences without rewriting the legacy key.
- Shared rooms are intentionally marked **Chưa cấu hình**. The repository has no verified Focus Room-specific synchronization service, so no room, member or online count is fabricated.

## Real capabilities

- Twenty-six project-local full scenes and twenty-six delivery thumbnails, including eight photorealistic landscape environments and six calm cat/dog companion spaces.
- Scene search, category filters, favorites, pins, recent scenes and grid/list views.
- User image upload to account-namespaced IndexedDB with type and 10 MB size validation.
- Sixteen procedural Web Audio channels rebuilt as longer, differently timed sound beds with scene-specific filtering, gentle gain drift, restrained stereo placement and sparse natural transients.
- The rain, distant thunder, wind, fire, café, keyboard, paper, birds, ocean and stream profiles are synthesized separately instead of sharing one generic short noise loop. A dynamics compressor, per-channel trim and energy normalization prevent harsh peaks when several channels are mixed.
- Sources are created lazily only when their channel becomes audible. This reduces initial memory and CPU use while keeping every mixer control live.
- Interaction-gated audio startup; all audio sources and the `AudioContext` are stopped on unmount.
- A real study-music player with account-scoped track, volume and loop settings. It includes a locally synthesized 68 BPM lo-fi bed and two project-local CC0 piano recordings with honest loading/error/progress states.
- Music and ambience share the master/phase gain, never autoplay after navigation or reload, suspend when the document is hidden and release media elements, audio nodes, schedulers and listeners on unmount.
- 25/5, 45/15, 50/10 and 90/20 cycles plus bounded custom durations.
- Wall-clock timer based on `endsAt`, cross-tab storage reconciliation and an idempotent completion lock.
- Account-scoped tasks with inline editing/reordering, primary task, navigation-safe autosaved notes, completed-session history, real goal completion ratio and JSON import/export.
- Zen/fullscreen layout, explicit motion pause, three quality levels, data saver and reduced-motion support.
- Account-scoped free layout on sufficiently large workspaces: the scene title, clock and tool dock can be moved with pointer drag or keyboard arrows, locked, reset and restored after reload.
- Zoom-safe measured reflow: browser zoom, Platform sidebar resizing and narrow devices automatically suspend free positioning and use a single-flow compact layout without deleting the user's saved coordinates.
- Hidden tabs stop decorative work and timer polling. The timer is reconciled from wall time when visibility returns.
- High quality pet scenes can add one bounded Three.js depth-portrait layer with damped pointer response and 30 FPS/DPR caps. Balanced, eco, data saver, reduced motion, hidden tabs and WebGL failure all use the existing lightweight CSS fallback.

## Data

| Data | Storage |
| --- | --- |
| Settings, timer, mixes, tasks, note, history, scene metadata | `hh.focus-room.v2.<account-fingerprint>` in localStorage |
| Selected music, music volume and loop preference | Nested in the same account-scoped `audio.music` record; playback state is deliberately not persisted |
| Custom image bytes | `hh-focus-room-media-v1/scenes` in IndexedDB, keyed by account fingerprint and scene ID |
| Multi-tab completion lock | `hh.focus-room.v2.lock.<account-fingerprint>.<session-id>` |
| Legacy read-only sources | `hh.focus.study-room.v1:<owner>` and `hh.galaxy.domain-views.v1` |

The account fingerprint is a one-way FNV-style browser hash of the available account identifier. Raw email addresses are not placed in storage keys. Guest data uses its own `guest` namespace.

## Research and licensing

Research was performed on 2026-09-07:

1. [LifeAt](https://lifeat.io/) — commercial product reference for the broad combination of moving virtual spaces, ambiance, timer, tasks and notes. [Focus with Others](https://lifeat.io/feature/focus-with-others) was reviewed to understand synchronized-scene/Pomodoro expectations. No LifeAt code, media, copy or branding was used.
2. [Ukiyo.js](https://github.com/yitengjun/ukiyo-js) — MIT-licensed background-parallax project. Applied only the general ideas of bounded pointer parallax, `requestAnimationFrame` throttling, disabling motion when unsupported/reduced and providing cleanup. No dependency or source code was copied.
3. [ayoisaiah/focus](https://github.com/ayoisaiah/focus) — MIT-licensed productivity timer. Applied only the product patterns of customizable work/break duration, pause/resume, skip, long breaks, ambient choices and truthful history. Its Go implementation was not copied.
4. [mrdoob/three.js](https://github.com/mrdoob/three.js) — MIT-licensed WebGL library already bundled by the repository. The existing local module is reused only for the optional pet depth layer; no new render dependency was added.
5. [flavioow/threejs-depth-portrait](https://github.com/flavioow/threejs-depth-portrait) — MIT-licensed depth-portrait reference. Only the general technique of a subdivided image plane, shader displacement and damped pointer movement informed the original HH implementation; its source, models and media were not copied.
6. [goldfire/howler.js](https://github.com/goldfire/howler.js) and [Tone.js](https://github.com/Tonejs/Tone.js) — MIT-licensed audio references reviewed for interaction-gated playback, fades, clock-based scheduling and cleanup. They are not bundled because the existing Web Audio/native-media implementation already covers the requirement.

All new scene images are original project assets generated for HH Platform. Their hashes, prompt boundary and generation provenance are recorded in `assets/focus-room/README.md`. Ambient and lo-fi beds are synthesized locally. The only shipped third-party media is the two Kimiko Ishizaka piano performances released under CC0 1.0 and documented with source URLs and hashes in that asset manifest.

## Environment expansion

The built-in library now adds: rooftop sunrise, rainy greenhouse, alpine lake dawn, old university reading hall, Nordic cabin morning, Vietnamese rice-terrace veranda, original autumn garden room and moonlit observatory. Each full scene has a project-local thumbnail and a matching low-cost CSS environment profile.

The pet collection adds six opt-in scenes: rainy attic cat, retriever sunroom, fireside library cat, spring veranda dog, Vietnamese riverside cat and lakeside cabin puppy. At high quality, a feathered shader isolates the animal region of the same scene image and applies subtle breathing depth plus damped pointer response. This is a pseudo-3D depth portrait, not an animated 3D animal model; no skeleton, locomotion or capability is fabricated. The prior CSS breathing mask remains the fallback. Eco, balanced, data saver, paused-motion, hidden-tab and system reduced-motion states remove WebGL work completely.

New environment profiles cover dawn light and valley haze, glass condensation, lake mist and water movement, library dust/light shafts, cup steam, field breeze, drifting autumn leaves, soft moonlight, quiet rain, garden petals and warm fire. They remain decorative (`pointer-events: none`), pause with the existing motion/visibility controls, and are removed at eco quality except for the static grade.

Two additional local channels provide a very quiet synthesized cat purr and sleeping-pet breathing bed. Both start at zero outside matching scenes, carry conservative output trims and are subject to the same compressor, visibility suspension and cleanup lifecycle as every other channel.

## QA checklist

- Open `/focus-room` from the Học tập & Ngôn ngữ group or command palette.
- Verify the global HH Platform shell remains mounted across scene/panel changes and Back/Forward.
- Verify every built-in scene and thumbnail returns HTTP 200.
- Start audio only from a click, adjust every channel and close the workspace; confirm `hh:media-playback` becomes false.
- Select each music track, play/pause, seek the file tracks, change music/master volume and loop, hide/show the tab, then close the workspace. Confirm there is no autoplay and every media/audio runtime is released.
- Start, pause, resume, skip and reset the timer; reload while running and verify remaining time derives from `endsAt`.
- Create, reorder, complete, select and delete a task. Enter a note, leave the route and verify both restore for the same account only.
- Complete a short custom test cycle and verify the history is added exactly once across multiple tabs.
- Upload a JPG/PNG/WebP scene, reload, then delete it and verify its IndexedDB record is removed.
- Test quality/motion/data-saver controls, system reduced motion, keyboard focus and 200% zoom.
- Test desktop, tablet and 375 px layouts for horizontal overflow, clipped controls and nested scroll traps.
- On each pet scene, compare high quality with balanced/eco and motion off. Confirm the depth canvas never captures input, pauses when hidden, disposes on scene change and visibly falls back if WebGL is unavailable.
- On a wide desktop, choose **Sắp xếp**, drag all three handles, lock the layout and reload. Verify positions restore; use arrow keys (Shift for a larger step), Home to reset one item and Escape to lock.
- Repeat at 125%, 150% and 200% browser zoom. Verify compact mode removes transforms when the actual stage is narrow, keeps panels in document flow and restores the saved desktop positions after zooming out.
