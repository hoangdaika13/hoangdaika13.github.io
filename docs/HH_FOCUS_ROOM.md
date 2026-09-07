# HH Focus Room v2

## Product boundary

- Canonical route: `/focus-room`.
- Owner: the **Học tập & Ngôn ngữ** section inside the existing HH Platform shell.
- The workspace does not replace or remount the global header, sidebar or breadcrumb.
- `/music/ambient` remains available as a compatibility workspace. A first-run Focus Room profile can read its old scene, mix and timer preferences without rewriting the legacy key.
- Shared rooms use the authenticated `focus-room` service in the repository's persistent Socket.IO server. Rooms are private by unlisted code, memory-only and capped at sixteen verified sockets; no room, member or online count is fabricated.

## Real capabilities

- A 226-scene library: the original 26 project-local scenes plus exactly 200 Atlas presets built from 20 owned backgrounds and ten lighting/atmosphere states. Atlas 200 is presented truthfully as presets, not 200 independent photographs.
- Scene search, category filters, favorites, pins, recent scenes and grid/list views.
- Paginated scene discovery renders 24 matching cards at a time, preserving search, category and account-scoped favorites while keeping the large catalog responsive.
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
- A real Deep Focus command center with a daily minute goal, per-session intention, actual seven-day chart and streak derived only from completed local sessions.
- Three built-in one-tap rituals and up to twelve account-scoped custom rituals. A ritual captures the current scene, complete ambient mix, master/music settings and Pomodoro cycle, but deliberately never autoplays audio.
- An account-scoped distraction log records the real timestamp, current session and selected task without pausing the timer. Completed history snapshots the session intention and matching distraction count.
- Completed focus sessions can be exported as UTF-8 CSV in addition to the versioned JSON backup.
- Opt-in Screen Wake Lock keeps the display awake where supported, releases when the tab is hidden or workspace closes, and truthfully reports unsupported/denied states.
- A real shared-room panel can create a private room, join by code or invitation link, copy invitations, show server-confirmed members, transfer host control after a host leaves, recover after a connection interruption and explicitly leave.
- Only the host can publish scene, Pomodoro and ambient-mix state. Each participant can independently disable scene, timer or audio-mix synchronization; audio never starts because of a remote event.
- Private tasks, notes, goals, history, custom files and account identifiers are excluded from realtime payloads. The personal scene, timer and ambient mix are snapshotted before joining and restored on leave, while private edits made during the room remain saved.
- Keyboard access includes Alt+Space for the timer, Alt+1–9 for tool panels, Alt+Z for Zen and Escape to close the active panel; form fields are never intercepted.
- Zen/fullscreen layout, explicit motion pause, three quality levels, data saver and reduced-motion support.
- Account-scoped free layout on sufficiently large workspaces: the scene title, clock and tool dock can be moved with pointer drag or keyboard arrows, locked, reset and restored after reload.
- Zoom-safe measured reflow: browser zoom, Platform sidebar resizing and narrow devices automatically suspend free positioning and use a single-flow compact layout without deleting the user's saved coordinates.
- Hidden tabs stop decorative work and timer polling. The timer is reconciled from wall time when visibility returns.
- Cat and Corgi companions use two self-hosted, licensed GLB models with real skeleton animation. Automatic behavior alternates a bounded walk, long rest and idle; users can force Rest or Walk. Balanced mode caps at 24 FPS/DPR 1, High at 30 FPS/DPR 1.5, and eco/data saver/reduced motion/hidden tabs/WebGL failure use the lightweight fallback with no active render loop.

## Data

| Data | Storage |
| --- | --- |
| Settings, timer, mixes, tasks, note, history, scene metadata | `hh.focus-room.v2.<account-fingerprint>` in localStorage |
| Selected music, music volume and loop preference | Nested in the same account-scoped `audio.music` record; playback state is deliberately not persisted |
| Daily goal, session intention, saved rituals and distraction log | Nested in the account-scoped `planning` record under the same versioned key |
| Custom image bytes | `hh-focus-room-media-v1/scenes` in IndexedDB, keyed by account fingerprint and scene ID |
| Multi-tab completion lock | `hh.focus-room.v2.lock.<account-fingerprint>.<session-id>` |
| Legacy read-only sources | `hh.focus.study-room.v1:<owner>` and `hh.galaxy.domain-views.v1` |
| Shared room state | Memory-only on the Socket.IO host; allowlisted scene ID, bounded Pomodoro state, bounded ambient levels and server-confirmed member identities only |

The account fingerprint is a one-way FNV-style browser hash of the available account identifier. Raw email addresses are not placed in storage keys. Guest data uses its own `guest` namespace.

Shared rooms require a signed-in account and the production `HH_SOCKET_URL`. The Node server and frontend authentication API must use the same `JWT_SECRET`, `MONGODB_URI` and `MONGODB_DB`. Room discovery is disabled. A room disappears when its last socket leaves or when the realtime service restarts; this is reported as a real limitation rather than hidden behind simulated persistence.

## Research and licensing

Research was performed on 2026-09-07:

1. [LifeAt](https://lifeat.io/) — commercial product reference for the broad combination of moving virtual spaces, ambiance, timer, tasks and notes. [Focus with Others](https://lifeat.io/feature/focus-with-others) was reviewed to understand synchronized-scene/Pomodoro expectations. No LifeAt code, media, copy or branding was used.
2. [Ukiyo.js](https://github.com/yitengjun/ukiyo-js) — MIT-licensed background-parallax project. Applied only the general ideas of bounded pointer parallax, `requestAnimationFrame` throttling, disabling motion when unsupported/reduced and providing cleanup. No dependency or source code was copied.
3. [ayoisaiah/focus](https://github.com/ayoisaiah/focus) — MIT-licensed productivity timer. Applied only the product patterns of customizable work/break duration, pause/resume, skip, long breaks, ambient choices and truthful history. Its Go implementation was not copied.
4. [mrdoob/three.js](https://github.com/mrdoob/three.js) — MIT-licensed WebGL library already bundled by the repository. The existing local module is reused only for the optional pet depth layer; no new render dependency was added.
5. [flavioow/threejs-depth-portrait](https://github.com/flavioow/threejs-depth-portrait) — MIT-licensed depth-portrait reference. Only the general technique of a subdivided image plane, shader displacement and damped pointer movement informed the original HH implementation; its source, models and media were not copied.
6. [goldfire/howler.js](https://github.com/goldfire/howler.js) and [Tone.js](https://github.com/Tonejs/Tone.js) — MIT-licensed audio references reviewed for interaction-gated playback, fades, clock-based scheduling and cleanup. They are not bundled because the existing Web Audio/native-media implementation already covers the requirement.
7. [Gobkit Free 3D Assets](https://github.com/Ariescar/gobkit-free-assets) — CC0 1.0 Corgi GLB and its official 24 FPS frame-range integration guidance. The model is self-hosted and its documented ranges are scrubbed without a new dependency.
8. [Cat by J-Toastie](https://poly.pizza/m/DJ9rpAhrh3) — CC BY 3.0 rigged cat GLB. The required creator attribution appears in the scene UI, asset manifest and third-party notice.
9. [M3-org/pets](https://github.com/M3-org/pets) — MIT-licensed behavior specification reviewed for the general idle/move/stay vocabulary and tight asset limits. No code or model from the project is bundled.

All new scene images are original project assets generated for HH Platform. Their hashes, prompt boundary and generation provenance are recorded in `assets/focus-room/README.md`. Ambient and lo-fi beds are synthesized locally. Shipped third-party media consists of two Kimiko Ishizaka CC0 piano performances, the Gobkit CC0 Corgi and the J-Toastie CC BY 3.0 cat; source URLs, licenses, attribution and hashes are documented in the asset manifest and `assets/focus-room/pets/THIRD_PARTY_NOTICES.md`.

## Atlas 200 and pet expansion

The built-in library now contains the original rooftop sunrise, rainy greenhouse, alpine lake dawn, old university reading hall, Nordic cabin morning, Vietnamese rice-terrace veranda, original autumn garden room and moonlit observatory additions. Atlas 200 then combines 20 local backgrounds—including the new rainy garden sanctuary—with dawn, mist, clear day, golden hour, sunset, blue hour, quiet night, soft rain, starlight and pet-companion states. Every combination has its own stable ID, title, grade, crop, effect, sound suggestion and optional pet assignment.

The pet collection keeps six opt-in photographic scenes and adds selectable 3D cat/Corgi companions to every environment. The Corgi uses its supplied baked track for idle, a resting hold and walk. The cat uses its supplied idle clip plus a bounded procedural leg gait for walking. Automatic behavior spends most of its 44-second cycle resting, with a short walk and idle transition; explicit Rest and Walk modes are also persisted per account. Eco, data saver, paused motion, hidden tabs and system reduced motion remove WebGL work completely. The previous depth portrait remains available only as the fallback for legacy photographic pet scenes when no 3D companion is selected.

New environment profiles cover dawn light and valley haze, glass condensation, lake mist and water movement, library dust/light shafts, cup steam, field breeze, drifting autumn leaves, soft moonlight, quiet rain, garden petals and warm fire. They remain decorative (`pointer-events: none`), pause with the existing motion/visibility controls, and are removed at eco quality except for the static grade.

Two additional local channels provide a very quiet synthesized cat purr and sleeping-pet breathing bed. Both start at zero outside matching scenes, carry conservative output trims and are subject to the same compressor, visibility suspension and cleanup lifecycle as every other channel.

## QA checklist

- Open `/focus-room` from the Học tập & Ngôn ngữ group or command palette.
- Verify the global HH Platform shell remains mounted across scene/panel changes and Back/Forward.
- Verify every built-in scene and thumbnail returns HTTP 200.
- Verify the exported catalog contains 226 unique IDs and exactly 200 `Atlas 200` presets, then page through all results in 24-card increments.
- Select Cat and Corgi in Balanced and High quality; verify Auto, Rest and Walk, then hide/show the tab, pause motion, enable data saver and leave the route to confirm the GLB renderer stops and disposes.
- Start audio only from a click, adjust every channel and close the workspace; confirm `hh:media-playback` becomes false.
- Select each music track, play/pause, seek the file tracks, change music/master volume and loop, hide/show the tab, then close the workspace. Confirm there is no autoplay and every media/audio runtime is released.
- Start, pause, resume, skip and reset the timer; reload while running and verify remaining time derives from `endsAt`.
- Set a daily goal and intention, apply every built-in ritual, save/load/delete a custom ritual, reload and verify it restores without autoplay.
- Log each distraction type during a running focus session, finish a short test session and verify its intention/distraction count in history and CSV export.
- Enable Screen Wake Lock on a supported browser, hide/show the tab, then leave the route; verify the lock is reacquired only while visible and released on exit.
- Verify Alt+Space, Alt+1–9, Alt+Z and Escape while ensuring shortcuts do not fire inside inputs, textareas or selects.
- With two signed-in browser profiles, create a shared room in the first, join by code in the second and verify the member list is sourced from Socket.IO. Change scene and start/pause/skip/reset Pomodoro as host; verify the second profile follows only while its local sync toggles are enabled.
- Enable ambient-mix sync in the second profile and verify levels follow without starting audio. Disable it and verify the local mix returns. Confirm tasks, notes, goals, history and custom images never appear in Socket.IO payloads.
- Disconnect/reconnect one profile, leave the host profile to verify host transfer, then leave the room. Confirm each profile restores its personal scene/timer/mix and retains private changes.
- Create, reorder, complete, select and delete a task. Enter a note, leave the route and verify both restore for the same account only.
- Complete a short custom test cycle and verify the history is added exactly once across multiple tabs.
- Upload a JPG/PNG/WebP scene, reload, then delete it and verify its IndexedDB record is removed.
- Test quality/motion/data-saver controls, system reduced motion, keyboard focus and 200% zoom.
- Test desktop, tablet and 375 px layouts for horizontal overflow, clipped controls and nested scroll traps.
- On each pet scene, compare high quality with balanced/eco and motion off. Confirm the depth canvas never captures input, pauses when hidden, disposes on scene change and visibly falls back if WebGL is unavailable.
- On a wide desktop, choose **Sắp xếp**, drag all three handles, lock the layout and reload. Verify positions restore; use arrow keys (Shift for a larger step), Home to reset one item and Escape to lock.
- Repeat at 125%, 150% and 200% browser zoom. Verify compact mode removes transforms when the actual stage is narrow, keeps panels in document flow and restores the saved desktop positions after zooming out.
