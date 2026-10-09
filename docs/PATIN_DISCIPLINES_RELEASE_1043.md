# Patin · Speed, Slide & Slalom · Release 1043

Date: 2026-10-10 (Asia/Bangkok). User explicitly requested this expansion and commit/push after verification. The release also includes the previously uncommitted Patin foundation and Visual Lab work (1041/1042); unrelated changes/configuration/QA outputs are excluded.

## Content and real navigation

64 new original Vietnamese educational summaries compile with the original 42 unchanged IDs into **106 lessons/skill-orientation entries**. These are learning topics, not 106 certified physical techniques. Each addition has a goal, suggested prerequisites, a supervised learning approach, a common misconception, a self-observation prompt, a specific question for a coach and source metadata.

| Discipline | New entries | Existing related entries | Current pool | Route |
| --- | ---: | ---: | ---: | --- |
| Speed | 20 | 4 | 24 | `/#/patin/speed` |
| Slide | 20 | 1 | 21 | `/#/patin/slide` |
| Slalom | 24 | 8 | 32 | `/#/patin/slalom` |

- **Speed:** setup, posture, push/recovery, cadence, single support, arm coordination, pacing, curve/crossover context, standing/rolling starts, acceleration, double push, paceline, drafting, passing, relay, finish and session review.
- **Slide:** preparation and surface/equipment context; entry/exit, Soul, Acid, Powerslide, Magic, Parallel, Fast wheel, Fast slide, Ernsui, Soyale, Unity/Savannah, UFO, Eagle, Wheel barrow, Cross Acid, heel/toe variants and organizing a supervised sequence.
- **Slalom:** setup, leading side, rhythm, backward Snake/Criss-cross/one-foot, Nelson/backward Nelson, Crazy, Sun, Mega, Eagle/Eagle cross, pivot, spin, toe/heel branches, changing contact/foot support, bilateral practice, Fish-to-Snake, composition, Speed slalom and session review.

The new `/#/patin/disciplines` atlas and each discipline are registered as children of Patin in **Giải trí & Nội dung**, reachable through the existing command palette and real links. Eight primary Patin views remain inside HH Platform. Each discipline has four **reference** stages, covers all entries in its pool, includes links to needed foundation lessons from other groups and provides a whole-pool library button. Stages never lock or certify physical ability.

Nine library categories preserve the original seven IDs and add Speed/Slide categories. A separate remembered discipline filter includes related legacy entries even when they retain another category. Category, discipline, level, text, favorites and self-reported status intersect. Counts come from the compiled registry and actual scoped read/tried flags, not generated scores.

## Preservation and rights

Local state and export envelope remain version 1 under existing `hh.patin.v1.*` identity keys. The content API becomes version 2. Older saved library preferences lacking `discipline` default to `all`; saved plans, sessions, notes, favorites, read/tried flags and existing IDs survive. New IDs work in the same note/bookmark/plan/journal and import/export functions.

All added text is original HH educational copy with `reviewedAt: null` / `draft-coach-review-needed`. Supervised approaches are not an accredited training curriculum. Named Slide techniques and specialist race/spin/low-contact branches are orientation-only, not stunt execution recipes. Competition difficulty is not an injury-risk rating, safe progression or prerequisite certification. Speed track, freestyle Slide/Slalom and Alpine Inline Slalom are not treated as interchangeable. There is no fixed training dose, speed, stopping distance, calorie estimate, automatic motion evaluation or promise of performance improvement.

No external code, video, trick-matrix reproduction, score table, manufacturer artwork, stock imagery or new dependency was incorporated. Sources are user-opened links, not hotlinks or automatically loaded media. No paid API, backend, camera/mic/GPS request or audio autoplay was added. Existing login planets, auth, Admin and outer shell are unchanged.

### Primary references checked 2026-10-10

- [World Skate · current Speed regulation directory](https://www.worldskate.org/speed/about/regulations.html): identifies the current speed rulebook and event-specific documents. HH links to it rather than prescribing or copying race rules.
- [World Skate · current Inline Freestyle directory](https://www.worldskate.org/inline-freestyle/about/regulations.html): discipline/rule context. The directory's 2026 document was identified; direct PDF fetching was intermittent. No claim that all pages were read or republished.
- [Polish Skating Federation publication of the World Skate 2026 Freestyle rulebook](https://pzsw.org/wp-content/uploads/2026/03/Inline-Freestyle-Rulebook-2026-Nov-25-Edition.pdf): checked names in the slide appendix. Only factual technique names informed the vocabulary; the matrix, ranks, difficulty/scoring and its artwork were not reproduced.
- [SkateIA · Freestyle Slalom](https://www.skateia.org/slalom): names such as Snake/Criss-cross, backward variants, Nelson, Crazy, Sun and Mega, plus the direct-instruction context. Proprietary teaching methods, exam thresholds, equipment/certification requirements and availability claims were not copied into HH.
- [Skatefresh · advanced training overview](https://skatefresh.com/freebie-advanced/): context for transitions/double push. The source may request registration; HH does not submit user information, download or embed the course.
- Prior equipment/safety references remain: [CPSC](https://www.cpsc.gov/s3fs-public/5014.pdf), [Rollerblade maintenance](https://www.rollerblade.com/usa/en/maintenance-list) and [SkateIA](https://www.skateia.org/). None certifies the HH summaries.

## Verification

- Related unit/contract suite: **104/104** passing, including **40 Patin tests**. Prerequisites are real and acyclic, all new IDs are unique, every discipline stage links valid content and covers its pool, old-state defaults preserve content, and new-data exports round-trip in the v1 envelope.
- Existing security suite: **14/14** passing.
- Local Chromium baseline QA: **20 groups**, now including **all 106 detail routes**, actual journal/notes/bookmarks/quiz/checklist/import/export and all discipline pages at 1440px/768px/375px.
- Visual Lab/workshop browser QA: **15 groups** still passing with expanded data.
- New discipline browser QA: **13 groups** passing. Atlas/current navigation, each pool's real count and filter/reload, lesson-specific coach question/note/bookmark/read counts, specialist limits, plan/journal/actual JSON download and import, account isolation, keyboard, reduced motion/forced colors, 200% zoom and layout/scroll. Actual guest Platform/command palette opens all three routes with correct breadcrumbs and stable header/sidebar; leaving unmounts the feature; Back/reload restores the route; 25 login planets remain unchanged.
- Isolated module runs have no uncaught JS errors or external requests. Full-shell provider/auth requests are explicit local QA doubles; this is not production-login, backend or physical-skating validation. Outputs/downloads/screenshots are ignored in `.study-local/` and not staged.
- JS syntax and `git diff --check` pass. Loader/cache/router versions align: Patin disciplines v1, data v2, core/UI/CSS v3, visuals v1; homepage JS v14; loader v705/router v287/cache v1043.
- No general lint/typecheck/application build command exists in this repository. The unrelated favicon build was not run. The pre-existing initial-script-budget test (≤16 versus 17 at HEAD/current) remains; Patin adds no initial script/style, and that unrelated threshold was not relaxed.

Reproduce with `npm run test:patin`, `node scripts/qa-patin.js`, `node scripts/qa-patin-workshop.js` and `node scripts/qa-patin-disciplines.js`. Browser QA uses `HH_QA_PLAYWRIGHT` and optional `HH_QA_CHROMIUM` with isolated contexts and temporary loopback servers.
