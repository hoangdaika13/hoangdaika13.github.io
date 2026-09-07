# HH Focus Room v2

## Product boundary

- Canonical route: `/focus-room`.
- Owner: the **Học tập & Ngôn ngữ** section inside the existing HH Platform shell.
- The workspace does not replace or remount the global header, sidebar or breadcrumb.
- `/music/ambient` remains available as a compatibility workspace. A first-run Focus Room profile can read its old scene, mix and timer preferences without rewriting the legacy key.
- Shared rooms are intentionally marked **Chưa cấu hình**. The repository has no verified Focus Room-specific synchronization service, so no room, member or online count is fabricated.

## Real capabilities

- Twelve project-local full scenes and twelve delivery thumbnails.
- Scene search, category filters, favorites, pins, recent scenes and grid/list views.
- User image upload to account-namespaced IndexedDB with type and 10 MB size validation.
- Fourteen procedural Web Audio channels, including light/heavy rain, distant thunder, keyboard and page turns, with master/channel gain, scene mixes and named user presets.
- Interaction-gated audio startup; all audio sources and the `AudioContext` are stopped on unmount.
- 25/5, 45/15, 50/10 and 90/20 cycles plus bounded custom durations.
- Wall-clock timer based on `endsAt`, cross-tab storage reconciliation and an idempotent completion lock.
- Account-scoped tasks with inline editing/reordering, primary task, navigation-safe autosaved notes, completed-session history, real goal completion ratio and JSON import/export.
- Zen/fullscreen layout, explicit motion pause, three quality levels, data saver and reduced-motion support.
- Hidden tabs stop decorative work and timer polling. The timer is reconciled from wall time when visibility returns.

## Data

| Data | Storage |
| --- | --- |
| Settings, timer, mixes, tasks, note, history, scene metadata | `hh.focus-room.v2.<account-fingerprint>` in localStorage |
| Custom image bytes | `hh-focus-room-media-v1/scenes` in IndexedDB, keyed by account fingerprint and scene ID |
| Multi-tab completion lock | `hh.focus-room.v2.lock.<account-fingerprint>.<session-id>` |
| Legacy read-only sources | `hh.focus.study-room.v1:<owner>` and `hh.galaxy.domain-views.v1` |

The account fingerprint is a one-way FNV-style browser hash of the available account identifier. Raw email addresses are not placed in storage keys. Guest data uses its own `guest` namespace.

## Research and licensing

Research was performed on 2026-09-07:

1. [LifeAt](https://lifeat.io/) — commercial product reference for the broad combination of moving virtual spaces, ambiance, timer, tasks and notes. [Focus with Others](https://lifeat.io/feature/focus-with-others) was reviewed to understand synchronized-scene/Pomodoro expectations. No LifeAt code, media, copy or branding was used.
2. [Ukiyo.js](https://github.com/yitengjun/ukiyo-js) — MIT-licensed background-parallax project. Applied only the general ideas of bounded pointer parallax, `requestAnimationFrame` throttling, disabling motion when unsupported/reduced and providing cleanup. No dependency or source code was copied.
3. [ayoisaiah/focus](https://github.com/ayoisaiah/focus) — MIT-licensed productivity timer. Applied only the product patterns of customizable work/break duration, pause/resume, skip, long breaks, ambient choices and truthful history. Its Go implementation was not copied.

All new scene images are original project assets generated for HH Platform. Their hashes and generation boundary are recorded in `assets/focus-room/README.md`. Ambient audio is synthesized locally; no third-party audio file is shipped.

## QA checklist

- Open `/focus-room` from the Học tập & Ngôn ngữ group or command palette.
- Verify the global HH Platform shell remains mounted across scene/panel changes and Back/Forward.
- Verify every built-in scene and thumbnail returns HTTP 200.
- Start audio only from a click, adjust every channel and close the workspace; confirm `hh:media-playback` becomes false.
- Start, pause, resume, skip and reset the timer; reload while running and verify remaining time derives from `endsAt`.
- Create, reorder, complete, select and delete a task. Enter a note, leave the route and verify both restore for the same account only.
- Complete a short custom test cycle and verify the history is added exactly once across multiple tabs.
- Upload a JPG/PNG/WebP scene, reload, then delete it and verify its IndexedDB record is removed.
- Test quality/motion/data-saver controls, system reduced motion, keyboard focus and 200% zoom.
- Test desktop, tablet and 375 px layouts for horizontal overflow, clipped controls and nested scroll traps.
