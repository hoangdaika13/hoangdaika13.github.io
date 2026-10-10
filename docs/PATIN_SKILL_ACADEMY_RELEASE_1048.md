# HH Patin Skill Academy — release 1048

## Scope and inventory

Only the skills library and skill reader are redesigned. The existing Platform shell, routes, authentication, login planets, Overview 3D renderer/layout, other Patin workspaces and saved IDs remain intact. Shared core gains optional, validated local-first fields; existing version-1 backups still import.

Before → after: **148 → 148 topics**, **37 → 37 publisher video records**, **148 → 148 conceptual SVG cards**. This release deepens existing content rather than adding names or calling every topic a distinct maneuver. Direct linked-video coverage remains 42 topics; the 16 limited checked competition examples are unchanged.

Academy organizes the existing inventory into mutually exclusive reading groups: foundation 24, freeskate/turning 11, Speed 33, Slide 29, Slalom 45, Quad 3, specialist/skatepark 3. The 9 original categories and 4 HH learning levels remain. HH levels are not official competitive grades.

## Delivered

- An original Neon Skate Lab skills-only hero, skate illustration, asphalt/grid treatment, discipline accents, prerequisite labels and responsive cards. No downloaded artwork or new 3D engine.
- A compact, always accessible search, 7 quick groups, collapsible filters, shoe scope and 9 conceptual technique families. Filters intersect existing query/category/level/favorites/status/method, show real totals, clear explicitly and persist through opening a lesson/Back/reload.
- Structured dossiers for all 148 existing topics: purpose, equipment, surface, risk/scope, prerequisites, steps or reading sequence, posture observations, common mistake/recovery, preparation/main/review, related successors, authorship, sources and limitations.
- **16 foundation/observation topics** receive original expanded 4–5-step sequences. Other topics reuse their existing goal/drill/mistake/check inside a transparent reading structure. **65 orientation-only topics remain orientation-only**, not executable advanced technique recipes. Posture observations are shared by group and expressly not individualized angles or biomechanics.
- Quick/detail reading modes and a narrower distraction-reduced reading layout; Escape restores normal reading and focus. Conditions can be expanded in quick mode; risk remains visible. Desktop/tablet/mobile reader has five keyboard-operated tabs: writing, SVG, video, practice, competition/reference. The separate illustration atlas retains its existing four-tab UI.
- Five unlocked reading paths: beginner, control/stopping, Speed, Slide, Slalom. Every destination is an existing route; rationale and limits are explicit. Read checkboxes never unlock physical ability.
- Per-topic preparation checklist and manual self-review. These are separate from read/tried flags, notes, favorites, planned time and actual manual journal entries. There is no mastered flag, invented score or leaderboard.
- Checklist TXT download and inclusion in the existing JSON backup/import/export. Same-topic stale edits reject; conflicting drafts survive workspace changes, can export and require explicit discard. Failed storage reports memory/pending rather than success.
- Six newly checked related Sikana source-page links in detailed source sections; links open at the publisher only, not automatic media loads. They do not inflate the existing video registry or pretend to be exact videos for every variant.

## Persistence and compatibility

Existing key stays `hh.patin.v1.<scope>`; envelope and workshop version stay 1. Optional additions:

```
workshop.library.shoe   = all | inline | quad | context
workshop.library.family = all | equipment | balance | travel | stop | turn | cones | contact | review | rules
workshop.academy = {version: 1, records: {[existingSkillId]: {checks: [knownChecklistIds], assessment: knownManualChoice}}}
```

Old backups without these fields get empty/default values. Existing notes, favorites, journal IDs, video data, routine, plan and comparison state are preserved. New group values are whitelisted alongside the original three disciplines. Unknown/prototype IDs, duplicate/unknown checklist keys, invalid assessments and oversized record registries reject. Total 600 KB store/500 journal limits are not raised.

No API, external AI, camera, microphone, account credentials, paid service, automatic media or new local tracking is added. New UI owns no animation/render loop. Existing guide listeners are removed on unmount; scoped session cache is bounded and cleared by explicit Patin reset/import.

## Sources and rights

Primary pages were inspected on 2026-10-10. Their contents are not licenses to copy courses or redistribute media. HH prose/SVG/CSS/code are original or reuse project-owned code. None of these sources certifies HH instructions or a user's safety/skill.

- [SkateIA skill/video organization](https://www.skateia.org/videos): informs separation of skill groups and reading levels; existing opted-in video records retained. No booklet or transcript imported.
- [SkateIA core instructor requirements](https://www.skateia.org/store/p/skateia-level-1-instructor-certification-in-person): context for guided foundations and separate inline/Quad setups; not a user certification scheme.
- [Skatefresh beginner lesson scope](https://skatefresh.com/inline-skating-lessons/beginner/) and [FAQ](https://skatefresh.com/faq/): beginner balance/movement/stopping and coach-dependent progression. Reference only; no paid-course text imported.
- [Sikana / Roller Squad Institut overview](https://www.sikana.tv/en/sport/inline-skating): links-only reference, publisher-owned content. Six specific pages below were opened; no media/transcripts/thumbnails downloaded, rehosted or automatically loaded:
  - [Protective gear](https://www.sikana.tv/en/sport/inline-skating/protective-gear)
  - [Standing up](https://www.sikana.tv/en/sport/inline-skating/how-to-stand-up)
  - [Heel brake](https://www.sikana.tv/en/sport/inline-skating/stopping-using-the-heel-brake)
  - [Turning](https://www.sikana.tv/en/sport/inline-skating/how-to-turn)
  - [Backward skating](https://www.sikana.tv/en/sport/inline-skating/skate-backwards)
  - [Obstacle context](https://www.sikana.tv/en/sport/inline-skating/get-passed-an-obstacle): related context, not a new instruction to jump obstacles.
- GitHub reference: [Learning Equality / Kolibri](https://github.com/learningequality/kolibri), [MIT license inspected](https://raw.githubusercontent.com/learningequality/kolibri/develop/LICENSE), [source component inspected](https://raw.githubusercontent.com/learningequality/kolibri/develop/kolibri/plugins/learn/frontend/views/TopicsPage/TopicSubsection.vue), [release listing inspected](https://github.com/learningequality/kolibri/releases). Organizational inspiration only: scoped topic-card collections and keeping return navigation. No code, Vue runtime, assets or dependency copied. Its locked course/mastery behavior was not adopted for physical skating ability.

Existing World Skate versioned/page-scoped references and previous video rights disclosures remain unchanged; no new official scores or grades were synthesized.

## Verification

- Syntax checks for Academy, core, reader, Patin renderer, loader, service worker and touched/new QA/tests.
- **147/147** targeted unit/content/storage/security-contract/navigation/shell/release tests, including **13 new Academy tests** and the 80 existing Patin tests.
- Separate security suite **14/14**.
- Browser suites: base Patin 20, workshop 15, disciplines 13, video 18, Arena 19, guide 14, Overview 18, Academy 14 = **131 passing groups**.
- All 148 lesson routes, original diagrams, source-grade and missing-video states, search/filter intersections, native SVG zoom/pan/reset, read/tried independence, notes and favorites.
- New checklist and self-review actual save/reload, route/star return, guest/A/B separation, real two-tab conflict/draft/export/discard, actual TXT and JSON downloads/import, actual denied-storage pending export.
- 1440/768/375 px, 200% CSS zoom, keyboard focus/Enter/Space/roving tabs, light/forced colors/reduced motion, footer scroll, no horizontal overflow, no new module external requests/uncaught exceptions. Screenshots inspected and quick/mobile controls refined.
- Actual Platform guest/sidebar/command search, workspace cleanup, Back/Forward/reload and stable shell tested by existing browser suites. Local auth/backend doubles are explicitly labeled; these are not production authentication or physical-device/coaching validation. Video iframe transport/error QA includes doubles and native test WebM; external publisher playback was not re-certified this release.
- Known unrelated baseline: `performance-loading-contract` **4/5**, first-paint scripts are **17 in pre-change HEAD and 17 after**, versus budget 16. No first-paint asset is added, assertion not weakened. Repository has no general app lint/typecheck/build tasks; only specific build helpers. Syntax and applicable tests ran instead.

## Limits / missing content

This is not a complete world inventory or a coach-approved curriculum. Advanced execution, speed/slide loads, sitting/jumping biomechanics and personalized correction still require qualified direct instruction. Some topics share conceptual pictures rather than a unique physical sequence. Quad has only three existing topics; stairs, slopes and specialist variants are not silently invented. Most topics still lack directly matched video. Related publisher pages do not close those gaps. No user ranking or competition-result feed is configured.

## Release/cache

Cache 1048; loader 710; Patin UI 8; core 7; guide UI 2; new Academy data/UI-helper and CSS 1. Data registry 5, guide SVG 1, Overview assets 1 and router 289 remain unchanged. New assets remain route-lazy; no new package dependencies or infrastructure settings.
