# HH Patin — release 1045: Performance Arena

## Delivered

- Performance Sports × Urban Skate × Cosmic Neon design, with a compact skate/lane hero, clearer typography, discipline accents, light-theme contrast, responsive competition cards and a saved effects pause control. Decorative CSS stops on hidden-tab signal, honors reduced motion and never blocks controls. No external decorative assets or new render loop.
- 12 real destinations, including the new /patin/map, /patin/competition and /patin/routine. They appear in the existing sidebar, command search, breadcrumb and overview. Exact “Patin” command search keeps the parent destination in its first 12 results.
- 148 original Vietnamese learning/skill topics, retaining all 130 previous IDs. The 18 additions include six orientation-only specialist introductions (Footgun, Christie, Wiper, Cowboy, Torque, Snowplow) and 12 competition/learning topics. Total glossary 40; FAQ 18. No advanced execution recipe or coach certification is claimed.
- A unified overview search covers real lessons, video metadata, glossary and competition references; favorites, recent lessons/video, upcoming plan and manually recorded questions use the existing account-scoped data. The 25 publisher videos and personal player remain available.
- A learning map shows actual prerequisites and dependent lessons, manual read/tried/reviewed states and the expanded discipline branches. No lesson is locked by a checkbox and no state is called mastery.
- A competition desk indexes 107 existing discipline-associated topics, not 107 officially graded tricks. Six formats remain separate: Classic, Battle, Speed Slalom, Slides, Speed Track and Speed Road. Search, discipline/format/rulebook/verification filters, progressive display, same-system grade sorting and comparison of up to four items perform real operations.
- Only 16 base-variant facts are marked checked: eight Classic Slalom and eight Slides examples. Source labels, names/families, rule edition, page, checked date and conditions are shown. All other rows remain unverified or not applicable. Classic labels do not silently apply to Battle; Speed and Speed Slalom receive no Freestyle A–E grade. Difficulty is not safety, a learning sequence, guaranteed points or athlete rank.
- Routine drafts contain up to 12 actual lesson IDs, entry/exit notes, transition notes, chosen format and coach questions. Pointer drag/drop has equivalent Up/Down controls. Remove/reorder undo preserves later text edits. A ten-item event-preparation checklist stores source, date, format and notes. Both tools save locally and export real TXT; neither scores a routine or registers for an event.
- Journal drafts/entries optionally add manual discipline, side, surface and coach feedback. Date/discipline filters, edit, JSON backup, extended CSV and TXT retain actual data. Planned time and video watching are never counted as exercise.
- Lesson/video/routine/preparation conflict drafts retain their original expected snapshot across workspace changes. Stale edits cannot silently overwrite a newer tab's save. Explicit discard/reload, export and existing storage retry/error behavior remain available.

## Compatibility and scope

The Platform shell at /platform, /patin and previous child routes, authentication, Admin guards, login planets and unrelated workspaces are unchanged. Patin data API version is 4; storage and JSON state remain version 1 under the original per-account hh.* key. Arena is additive/optional on import. Old journal records retain their original structure; new context is not injected into them. Existing 600 KB state and 500-entry bounds remain unchanged.

Motion, comparison, routines and checklist round-trip with existing notes, plans, favorites and journal. Reset/import only affect the current Patin scope and clear the relevant retained conflict drafts. Preparation links require HTTPS without embedded credentials; strings are escaped and CSV formula-like text is neutralized. No API, device permission, cloud storage or paid service was added.

## Sources, rights and actual use

Checked 2026-10-10. Research is selective, not an exhaustive survey.

| Source | Actual use and rights boundary |
| --- | --- |
| [World Skate Inline Freestyle regulations](https://www.worldskate.org/inline-freestyle/about/regulations.html), [2026 Nov-25 Edition rulebook](https://www.worldskate.org/inline-freestyle/about/regulations.html?download=8231:inline-freestyle-rulebook-2026-nov-25-edition) | Read-only factual cross-check of a limited set of names/labels; original HH explanations. Source-owned document, no redistribution license asserted. No whole PDF, matrix image, complete table or course text shipped. |
| [World Skate Speed regulations](https://www.worldskate.org/speed/about/regulations.html), [2026 rulebook](https://www.worldskate.org/speed/about/regulations.html?download=8068:speed+rulebook+2026) | Source-aware format orientation and official links. Copyrighted source, not copied into the repository. No invented Freestyle grade for Speed. |
| [Freestyle results](https://www.worldskate.org/inline-freestyle/results.html), [rankings](https://www.worldskate.org/inline-freestyle/rankings.html), [Speed results](https://www.worldskate.org/speed/results.html) | Verified outbound links. No athlete list copied, synchronized or fabricated. |
| [Inline-Skate-Info](https://github.com/hankertrix/Inline-Skate-Info), [AGPL-3.0 license](https://github.com/hankertrix/Inline-Skate-Info/blob/main/LICENCE.txt) | License/maintenance rechecked at afa130ccc0d8fc03881c7a0e27c9a8e777a2c8b2 (commit 2026-10-06). Earlier release inspected grouped/opt-in video discovery. No repository code, catalog, text or assets copied; all new Arena implementation is original. |
| SkateIA, InMoveSkates and Rollerblade video sources | Existing 25 opt-in standard publisher embeds retained. Per-video source/rights records and earlier research are in patin-learning-data.js and PATIN_VIDEO_LEARNING_RELEASE_1044.md. No media downloaded, reuploaded, subtitles fabricated or watermarks removed. |

The PDF skill's render-and-inspect workflow was used because the source difficulty matrices are raster pages, not reliable extracted text. Appendix A was visually checked at printed page 69 / PDF page 70; Appendix C at printed page 74 / PDF page 75. The document edition is Nov-25, while Appendix A's footer says Oct-25; that discrepancy is recorded rather than silently “fixed.” Classic context references §5.7–5.9, printed pages 24–27; Slides context references §9.5, printed page 56 / PDF page 57. Only the listed 16 base examples were checked, not every variant or historical edition.

HH text/CSS/SVG/JavaScript are original project work. Lesson text is still draft material needing a qualified skating coach's review. New specialist topics are orientation-only and require supervised, appropriate conditions. QA PDF downloads, rendered pages, generated clips, downloads, screenshots and JSON fixtures remain ignored under .study-local/ and are not shipped.

## Evidence

- Syntax: 16 changed production/QA/test JavaScript files pass node --check.
- Focused Patin suite: 60/60; combined feature/navigation/shell/cache/release suite: **124/124**.
- Security suite: **14/14**.
- Browser groups: qa-patin 20, qa-patin-workshop 15, qa-patin-disciplines 13, qa-patin-video 18, qa-patin-arena 19: **85 passing groups**.
- New browser evidence covers actual same-format comparison saves/reload, truthful filter intersections and no Speed grades, lesson/video/reference deep links, actual pointer drag/drop, keyboard reorder/undo, checklist validation and TXT content, journal draft/context/filter and JSON round-trip, scoped account switching, two-tab conflicts across route return and stable guest Platform shell.
- Desktop 1440 px, tablet 768 px and mobile 375 px scroll to the footer without horizontal overflow; 200% zoom, keyboard focus/Enter, light theme, forced colors and reduced motion are exercised. Mobile caption layout and light-theme discipline contrast were visually corrected.
- Native local media playback, rate/seek/A–B and Blob cleanup remain covered by video QA. An independent real YouTube transport probe for four publisher examples (SkateIA, InMove Slalom, InMove Slide, Rollerblade Speed) observed paused-before-Play and about five seconds of playback after explicit Play, readyState 4, no media error. Chromium was muted; no media saved.
- Shell auth/backend responses and iframe action/error isolation tests use labelled local doubles. Hidden-tab lifecycle signal is simulated. These are not production authentication/role, physical-device, WAN or coaching certifications.
- No uncaught module errors or third-party requests before media consent in the isolated fixture; Back/Forward, reload, route cleanup and the existing 25 login planets are checked.

## Remaining limits and baseline

- There is no complete official grading database, historical-rulebook dataset or athlete leaderboard. Selecting a different stored rulebook only filters actual researched data, not an invented version conversion.
- No AI/body scoring, ability certification, cloud sync, tournament registration or optional two-personal-video comparison was added. Personal files remain session-only; private text/state remains device-local.
- All source availability, publisher playback policies and future rules may change. Four real transport samples do not certify every video in every region. Current event regulations and direct instruction take precedence.
- No general lint/typecheck/application-build task exists for this vanilla JS workspace. Syntax, behavioral/contract/security tests and browser QA were run instead.
- Existing performance-loading-contract suite remains **4/5**: the first-paint script budget expects at most 16, while both pre-change HEAD and this release contain 17 scripts and 17 styles. This release adds **zero first-paint scripts/styles**, does not weaken the assertion and does not claim to resolve it.
- Release/cache 1045; loader 707; router 289; Platform metadata 16. Patin base CSS/UI/core 5, data 4, video 2; four new Arena modules version 1. No dependencies, secrets, private configuration or QA data are added to Git.
