# Patin · Release 1041

Date: 2026-10-10 (Asia/Bangkok). Implementation in the existing HH Platform; no deployment or commit/push performed for this request.

## Delivered

- Giải trí & Nội dung → Patin, canonical `/#/patin`. Six views: overview, skills, pathway, gear/safety, training journal and resources. Sidebar, Platform catalog and global command palette use the real registry; the palette lists the parent once plus five distinct child destinations.
- 42 original Vietnamese educational entries across seven categories and four levels. Each has a goal, suggested prerequisites, learning approach, common misconception, self-observation and source links. Advanced entries are orientation only, marked as needing direct instruction. Inline heel-brake guidance is not presented as quad toe-stop guidance.
- Five suggested pathway stages; editable-choice 10/20/30-minute session outlines, not a physical prescription or promised learning timeline.
- Eight equipment/maintenance topics, a seven-item per-session preflight checklist, 30 glossary entries, 12 FAQs and six knowledge questions. The checklist clears when a new workspace session mounts and does not certify safety.
- Search accepts Vietnamese with or without accents; category, level and bookmarks filters work together, with 12-item pagination.
- Independent self-reported read/tried flags, auto-saved skill notes, last-opened lesson, bookmarks and manual training logs. Time summaries total actual manually entered minutes, not measured exercise, calories, competence or certified achievement.
- Confirmed deletion/reset, real JSON download and validated/import-preview confirmation. Corrupt stored data is preserved and can be downloaded before reset. Failed storage keeps a scoped in-memory draft and warns honestly; retry/export/discard controls are provided.
- Original static SVG skate illustration and scoped cosmic cyan/violet/gold UI. No added canvas, audio, video, external dependency, backend endpoint or device permission. Existing login scene and its 25 planets remain unchanged.

## Data & limits

Local schema v1 under `hh.patin.v1.<account-or-guest>`. Account identity uses the existing user's stable ID (fallback `_id`, `sub` or email if that is the only existing identity); no new login system. Existing anonymous guest IDs stay explicitly guest-scoped, with an unidentifiable-guest fallback on that browser. No server sync. An exported file intentionally contains private notes/journal and must be handled by its owner.

Allowed fields are validated/whitelisted on import; unknown auth/token/password fields are not re-exported. Limits: 500 manual sessions, 4,000 characters per skill note, 2,000 characters per journal note and 600,000 UTF-8 bytes per state (small export-envelope allowance). JSON formats are versioned. Cross-tab mutations read current data; a storage event does not rerender an actively open note editor. Revisiting a lesson reads the current saved note. This is not CRDT collaborative editing.

Only submitted journal entries persist; an unsubmitted journal form and quiz answers are not promised to survive route changes. Notes already typed into the auto-save editor do persist, provided the browser permits storage. A memory-only draft cannot survive browser reload; the UI explicitly offers export.

## Editorial scope / rights

HH owns the new Vietnamese summary text and SVG. No third-party code/media, hotlinked backgrounds, course transcripts, downloaded manuals, logos or stock assets were incorporated. External sources remain user-opened links; linking is not a license to reproduce those works. The content is an original foundation/overview, **not an exhaustive encyclopedia, certified curriculum or coach-reviewed technical assessment**. All skills retain `reviewedAt: null` and content metadata `draft-coach-review-needed`.

Primary sources checked on 2026-10-10:

- [CPSC · Skate Safely](https://www.cpsc.gov/s3fs-public/5014.pdf): safety equipment, appropriate practice environment and introductory stopping guidance.
- [Skatefresh · Beginner lessons](https://skatefresh.com/inline-skating-lessons/beginner/) and [learning FAQ](https://skatefresh.com/faq/): beginner topic organization and guidance on working with an instructor; no proprietary course reused.
- [Rollerblade · Maintenance guides](https://www.rollerblade.com/usa/en/maintenance-list): manufacturer-specific equipment/maintenance references. No claim that its full large manual was read or incorporated.
- [SkateIA](https://www.skateia.org/): direct-instruction context for inline/quad and specialist disciplines; no HH affiliation or accreditation implied.
- [World Skate · Inline Freestyle regulations](https://www.worldskate.org/inline-freestyle/about/regulations.html): link to the current official rule directory, not a copied rulebook or fixed scoring table. Other disciplines require their own applicable rulebook.

High-risk park/rail/ramp/jump and advanced stopping topics deliberately do not provide stunt execution recipes. Beginners should learn with suitable instruction and protective equipment. The app cannot diagnose physical symptoms, evaluate actual movement or verify a safe location.

## Verification

- Syntax checks: new Patin JS, QA script and modified router/loader/gateway/Galaxy shell/home/service worker.
- Focused suite: 81/81 passing across Patin (17), Platform home/scroll, shell lifecycle, registry/navigation, gateway and release/cache consistency.
- Existing security suite: 14/14 passing.
- Local Chromium QA: 20 passing groups, using an isolated fixture and the actual Platform shell. All 42 individual skill routes rendered; search/filter/pagination, bookmarks, notes/read/tried, planner, checklist reset, glossary and quiz scoring, journal save/reload, real export/import, invalid-import preservation, confirmed deletion, auth-scope changes, two-tab bookmark updates and unmount were exercised.
- Actual guest entry → Platform → sidebar Patin → detail → Platform → Back/Forward → reload preserves chrome and saved notes. Homepage catalog and command-palette entry work. Assets remain lazy before Patin opens.
- All views tested at 1440px, 768px and 375px; scrolling to the footer, keyboard checkbox operation/focus, reduced motion, forced colors and 200% zoom. No horizontal page overflow or new uncaught exceptions in these runs. Isolated Patin made no external request or device/permission request.
- Full shell backend requests use explicit local QA doubles (providers/auth return configured unavailable responses). This verifies UI routing, not production authentication, a deployed backend or physical skating ability. No production user records were changed.
- `git diff --check` passes. The project has no general lint, typecheck or application build command; the favicon build is unrelated and was not run.
- Known pre-existing issue: `tests/performance-loading-contract.test.js` initial-script budget expects ≤16 while both HEAD `5e8e93a` and this change have 17 executable initial script tags. That suite is 4/5 passing. Patin adds zero initial scripts/styles; it does not change the unrelated budget failure or relax its test.

QA outputs/profile state/downloads are under ignored `.study-local/patin-qa/`; no test records, screenshots, credentials or configuration are added to the Git release.

Reproduce focused tests with `npm run test:patin`. Run `node scripts/qa-patin.js` with `HH_QA_PLAYWRIGHT` pointing to the installed Playwright package and optional `HH_QA_CHROMIUM` pointing to the local Chromium executable. The script starts a temporary loopback static server, uses isolated browser contexts and closes them on completion.
