# HH English Cosmic Academy · release 1039

Date: 2026-10-09. Scope: HH English only, plus its existing sync endpoint, asset manifest/cache and the two necessary CORS request headers. HH Platform remains the only shell. No new service, dependency, gateway, account system, SRS store or renderer.

## Audit and delivery

| Area | Delivered / verified | Limit |
| --- | --- | --- |
| Existing curriculum | Preserved 69 CEFR/preparatory lessons, 70 career paths, stable lesson IDs, freely selectable levels, Smart Start and deterministic career adaptation | A0 is internal preparation, not an official CEFR level; academic human review remains needed |
| Learning OS | Existing five destinations; compact English language switcher, contextual tools, neon dark/day workspace, mobile tool collapse, visible focus and motion/forced-colors support | Old lesson duration records remain estimated and are labelled accordingly |
| Guided lesson | Checkpoint input/radio drafts, exact sentence order, authored variants, assessed versus self-reported evidence, skipped-step completion gate | Free production is submitted/self-confirmed, not automatically grammar-graded |
| Practice Lab | Choice, gap, matching, ordering with keyboard input, dictation and correction using existing authored exercise answers | Correction is correction of an exercise choice, not general-purpose grammar diagnosis |
| Error Clinic | Actual retry and saved evidence; legacy occurrence migration no longer inflates on each read | Open-ended answers need human review; manual resolution is identified as self-report |
| Writing | Seven level templates, append-only outlines, auto-saved drafts, checklist, structure-only feedback, global 20-version cap, comparison, restoration and TXT export | No IELTS/TOEIC/CEFR score or AI rewriting |
| Speaking | Eight original pronunciation self-practice sets, 16 two-turn scripted situations, reply/draft/history persistence and TXT export | TTS is synthetic. Transcript coverage is not phoneme/fluency/accent scoring. Browser speech recognition may process audio outside the device and is labelled |
| Recording | User-triggered permission, 120-second/10-MiB stop thresholds, stop/listen/download/delete, stopped live tracks on view replacement/hidden/unmount, account/profile guards | QA uses Chromium's synthetic input, not physical microphones. Completed recording stays in memory within English, must be downloaded before unmount/reload |
| Listening/Reading | Existing seven listening and seven reading items retained; TTS navigation follows actual utterance-end events rather than a fabricated elapsed timeline; reading notes saved on input | TTS has no audio timestamp. Existing virtual positions remain only for V1/V3 compatibility and sentence lookup; waveform is decorative. Offline TTS availability depends on installed voices |
| Personal audio | MIME/header validation, real IndexedDB import, 10 files, 10 MiB/file, 40 MiB/profile, transactional quota check, playback speed, actual audio-time A–B loop, bookmark, transcript and notes | Local only, no file/transcript sync to server. Browser codec support still applies. New uploads require the user's rights to the content |
| Learning plan / group | Weekly goal, priority skill, actual exercise evidence and explicit handoff to the existing Study Together route; lesson-ID links contain no private progress | Does not auto-join a room or switch on any device. This release does not duplicate LiveKit/classroom features |
| Data and sync | Scoped V3 plus compatible V1 snapshot, backup of unclaimed V1 data, memory fallback with truthful warnings, bounded import, local reset separate from server delete, retry/export/preview/explicit conflict resolution | Legacy data without an owner is not silently assigned to a signed-in account. Backup key: `hh.english.legacy-unclaimed.v1` |
| Backend | Authenticated owner derivation, learner-owner request guard, safe revisions, compare-and-swap, exact-body idempotency, duplicate-first-save race protection, 72-character delete confirmation | Handler tested against a Mongo-behaviour QA double, not the production database |

Navigation does not itself mark the sync record dirty; this avoids recreating a deleted server copy merely by changing tabs. An offline revision conflict retains the local revision and requires explicit resolution rather than rebasing and overwriting automatically. In-flight responses cannot cross owner/profile/account-mode boundaries. All active request controllers are aborted on disposal.

No new XP is granted for a clock finishing or for skipping a lesson. Old XP/history is preserved, not silently reinterpreted. Placement no longer treats blank/null answers as option zero. Timer completion and legacy estimated durations are not described as attention or actual study time.

## Verification evidence

- Baseline before changes: existing English suite 60/60.
- Final English suite: `npm run test:english` — 78/78, including 18 new core/sync/API tests.
- Security: `npm run test:security` — 14/14.
- Release/navigation/auth/shell regression: 55/55 from `release-consistency`, `platform-single-shell`, `runtime-boundary`, `galaxy-shell-contract`, `auth-platform-contract`, `app-shell-layout-lifecycle`, `api-runtime-routing`, `dynamic-navigation-contract`.
- Syntax checks: changed application JavaScript and the QA runner; `git diff --check`.
- Browser runner: `scripts/qa-english-academy.js`, headless Chromium. Requires Playwright supplied through `HH_QA_PLAYWRIGHT` and optional executable through `HH_QA_CHROMIUM`; no production identities or paid API calls. Test artefacts stay in ignored `.study-local/english-academy-qa/`.
- Browser flows: five destinations; writing input/version/compare/TXT/reload; wrong versus right sentence order; scripted replies and unsubmitted draft reload; denied and synthetic-device native recording; local audio import/transcript/notes/reload/no-autoplay; skip-all blocked and fully answered guided completion; eight views at 1440, 768 and 375px; 200% zoom, forced colours, reduced motion and focus; guest/account isolation; group route/Back; storage quota fallback and recovery; day theme.
- Actual application shell, not only fixture: guest login → `/platform` → `/english/writing` → Platform → Back → reload, unchanged header/sidebar, draft retained, desktop/375px without horizontal overflow, no uncaught page errors. API transport is explicitly stubbed for this local static QA run.

No general lint/typecheck/build commands exist in this repository. Its `build:favicons` is unrelated and was not represented as an application build. Physical-device audio, Safari/Firefox, WAN, production database conflicts and production authenticated sync were not certified by the local QA run.

## Content and assets

New text/templates/situations/sound guidance are HH original, AI-assisted drafts dated 2026-10-09 and marked `reviewStatus: draft` in `english-academy-core.js`. They are not claimed to have received human academic review. New exercises reuse the project's existing lesson/exercise/vocabulary data without changing lesson IDs. No third-party code, media, branding or audio was downloaded/copied, and no external license was added. User-imported audio remains the user's material and responsibility. Existing ESDB vocabulary index is still distinct from fully edited dictionary entries; no completeness claim was added.

AI Tutor and acoustic/phoneme analysis are not connected by this release. Scripted conversation and local writing checks are available without pretending to be AI. No provider quota was invented, no API key was introduced and no paid AI request was made. Future AI integration needs a verified provider/backend, opt-in and appropriate evaluation.

## Release assets

`performance-loader.js?v=701`, `english-learning.js?v=31`, `english-learning-os.js?v=10`, `english-learning-galaxy.js?v=6`, new Academy CSS/core/UI/sync/media at `v=1`; cache `hh-identity-portal-v1039`. Existing `script.js?v=284` and unrelated workspaces are unchanged.
