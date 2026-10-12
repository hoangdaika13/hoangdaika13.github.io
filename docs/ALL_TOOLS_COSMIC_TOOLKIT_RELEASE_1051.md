# All Tool — Cosmic Toolkit, release 1051

## Scope and architecture

All 86 named tools are reachable inside the unchanged HH Platform shell at `/tools/<id>`. The All Tool sidebar entry lives under Công việc & Công nghệ. Global command search includes individual tools after the lazy toolkit loads. Legacy names/IDs and `/tools/platform/<id>` remain accepted. `/platform`, login, Admin guards and unrelated workspaces are not replaced.

The generic textarea with inert Run/Save buttons has been removed. Every catalog item resolves to one dedicated Platform, Workspace or Utility engine. A missing engine shows an error/retry, never a fabricated result. Rendering and teardown are serialized per host; a late old mount cannot clean up a newer engine. Route changes, detached hosts and auth changes dispose the current workspace.

No new package dependency, provider account, secret, paid provider call or production QA data was introduced. The pending Facebook Login changes are intentionally excluded from this release.

## Delivered improvements

- Readable Cosmic Toolkit design, per-category/tool accents, larger typography and 44px controls. The catalog supports search, group and collection filters, favorites, pins, recent tools, empty states and arrow/Home/End navigation. Mobile collapses the catalog to preserve working space. No full-page horizontal overflow or invisible overlay.
- Independent All Tool light/dark/system/scheduled appearance, accent, contrast and font settings. Applying a tool theme does not change the primary website's appearance. Appearance carries across Platform, Workspace and Utility studios and survives reload.
- Platform tools: real navigation index/command actions, checked-radio handling, local notifications, skeleton preview, honest scroll/task progress, real FPS/long-task measurement, scoped history/favorites, validated import/export, PWA/cache/install capability inspection, scoped keyboard shortcuts and settings.
- AI/Workspace tools: correct authenticated `/api/ai` contract with per-request cost acknowledgement, one attempt and no automatic retry. Distinct local prompt library/optimizer/image-prompt composer. Workspace Tabs and Auto Save flush drafts when leaving. Version snapshots, actual file bytes/previews/downloads, editor fallback, usable local widgets and reviewed text-plugin engines. No fabricated job/task/user counts.
- OCR: reuse bundled Tesseract 6.0.1 worker/WASM and `vie`/`eng` language data, lazy-loaded from this origin. Images stay on device. Crop/recognition/edit/TXT export, progress for the current engine step, cancel and worker termination. It is image OCR, not an advertised PDF pipeline.
- Developer utilities: real JSON, safe Markdown preview, Unicode Base64, crypto UUID/hash/password, explicit timestamp formats, aligned text diff, safe calculator grammar, unit conversion, bounded Regex worker, HTTP tester and public-repository inspector. API requests honor CORS; no proxy bypass or secret persistence.
- Productivity: Notes CRUD/search/multiline, Todo ordering, real Kanban columns with drag/select moves, Calendar `.ics`, reminder due views, deadline-based Pomodoro/Countdown/Stopwatch with pause/resume/laps, honest activity/file metadata, bookmarks/pins and scoped floating/focus controls.
- System: real browser capability reports, own runtime logs, local preferences/language previews, measured asset throughput, clocks and user-triggered weather lookup. QR Scanner falls back to existing local jsQR 1.4.0 when BarcodeDetector is unavailable and never opens decoded links automatically.

## Data and privacy

Catalog and appearance use versioned `hh.all-tools.*` keys scoped to stable account ID or guest. Utility local state, Platform IndexedDB and Workspace records/binary files are similarly isolated. Common runtime history is also scoped. Delayed writes retain their original owner or are canceled; they are not attributed to the next account.

Unattributed old databases/keys remain unchanged but are **not automatically assigned** to the current account. Their safe migration requires an explicit ownership/import decision. Platform import/export rejects other-workspace and secret-bearing keys; validation happens before replacement. Write/quota failures do not report successful permanent saves.

A public account-profile change in another tab does not prove that this tab's authentication token changed. All Tool stops work and requires normal session reload before continuing, rather than mixing identities. This is a local UI/data boundary, not a replacement for backend authentication or authorization.

Generated passwords, API headers/bodies/responses, hashes and clipboard contents are excluded from generic activity history. Clipboard retention is opt-in. Only selected files are read. Microphone, notifications, downloads and network/AI actions require direct user actions. No audio autoplay, automatic device permission or paid fallback.

## Verification — 2026-10-12

- `npm run test:all-tools`: **102/102 passing** focused behavior, parser, storage, security/capability, routing, runtime and release/cache tests. DOM/IndexedDB/API doubles in unit tests are explicitly documented and are not represented as device/WAN verification.
- JavaScript syntax checks pass for the eleven changed runtime/release/QA scripts. `git diff --check` passes. This buildless JavaScript repository has no generic lint, TypeScript or build script; those checks are not claimed.
- `scripts/qa-all-tools.js`: real Chromium browser QA, **22 passing probe groups**, including all 86 studio mounts at 1440/768/375px; real IndexedDB/files/Notes/Kanban/timers; local plugin/widget operations; favorites/export/validate/import; actual Tesseract OCR of a generated PNG and actual QR pixel decoding; appearance persistence; keyboard/reduced-motion/forced-colors/200% zoom; cross-tab account stop; stale-engine-return double; primary sidebar/command palette; and real App Shell guest → tool → home → Back/Forward → reload. No uncaught page JavaScript errors or automatic remote media/AI calls in these probes.
- The one AI request uses an explicit **backend-error double**, with opt-in consent. It verifies error/draft/no-retry behavior, not successful Gemini generation. Auth/provider routes in the App Shell test use local doubles; no real account login, paid inference or device permission was exercised.
- Screenshots, browser profiles and results remain Git-ignored under `.study-local/all-tools-qa`. No QA user/file records are committed.

## Honest remaining limits

- AI Chat requires a working authenticated backend, configured provider, billing/quota and allowed account. Live paid inference was not tested.
- Live Speech Recognition and Speech Synthesis depend on browser voices, network/service availability and user permission. Uploaded-audio transcription and synthesized-audio file export have no configured server adapter; they report that limit rather than producing fake content. SRT/VTT generated from manually edited text uses approximate four-second segments, not measured diarization/timestamps.
- Monaco-specific diagnostics/intellisense require a loaded Monaco runtime; the working local text editor is explicitly labeled fallback. It does not pretend to execute arbitrary code.
- Widget Marketplace is a reviewed **local widget kit**, not a remote marketplace; Plugin System runs only the three reviewed text engines, not user-supplied JavaScript. Terminal Simulator is a sandbox simulation, not OS shell access.
- Multi-language is a curated UI phrase preview, not free-form machine translation. Realtime Notification is local notifications; remote Web Push is not configured. Browser telemetry does not claim OS/GPU measurements that browsers do not expose.
- PWA installation/offline availability depends on the browser and actual cached assets. A generic cache report is not a guarantee that every API or workspace works offline.

## GitHub references and licenses

Research checked on 2026-10-12. No website/template/branding or newly downloaded code was copied into this release. Reused bundles and their existing licenses remain in `vendor/`.

| Source | License | Actually applied |
| --- | --- | --- |
| [CorentinTh/it-tools](https://github.com/CorentinTh/it-tools), [ToolCard.vue at inspected SHA](https://github.com/CorentinTh/it-tools/blob/d505845f918e946ec300af7b36efc107e2f66e9e/src/components/ToolCard.vue), [LICENSE](https://github.com/CorentinTh/it-tools/blob/main/LICENSE) | GPL-3.0 | UX reference only: task-specific controls, input/result separation, clear tool discovery/favorites. Utility output formats and validation are independently implemented; no GPL source/assets incorporated. Repository not archived; inspected default-head SHA `d505845f918e946ec300af7b36efc107e2f66e9e`. |
| [hotkeys-js scope/filter code](https://github.com/jaywcjlove/hotkeys-js/blob/master/src/index.ts), [LICENSE](https://github.com/jaywcjlove/hotkeys-js/blob/master/LICENSE) | MIT | Scope/input filtering and lifecycle ideas; native listeners implemented locally, no library added. |
| [SortableJS](https://github.com/SortableJS/Sortable), [LICENSE](https://github.com/SortableJS/Sortable/blob/master/LICENSE) | MIT | Ordering/cleanup and keyboard-equivalent movement ideas. Native drag/drop and move buttons, no Sortable dependency or copied source. |
| [Monaco Editor](https://github.com/microsoft/monaco-editor), [LICENSE](https://github.com/microsoft/monaco-editor/blob/main/LICENSE.txt) | MIT | Existing optional editor/model-disposal API contract retained; no runtime download or claim that Monaco is installed. |
| [Tesseract.js worker API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [LICENSE](https://github.com/naptha/tesseract.js/blob/master/LICENSE.md) | Apache-2.0 | Real worker initialization/recognition/termination using already-bundled 6.0.1 assets. License at `vendor/licenses/Tesseractjs-LICENSE.md`; trained-data license at `vendor/licenses/Tessdata-LICENSE.txt`. |
| [jsQR](https://github.com/cozmo/jsQR), [LICENSE](https://github.com/cozmo/jsQR/blob/master/LICENSE) | Apache-2.0 | Real bounded image-pixel decoding with already-bundled `vendor/jsqr.js`; no image uploads or auto-open. |
