# HH Patin — release 1046: illustrated learning desk

## Upgrade delivered

- All 148 existing topic IDs now have an original Vietnamese reading layout and a code-native SVG teaching card. The catalog includes technical skills, foundations, equipment, observation and competition topics; it is not a claim to catalog every skating maneuver in the world.
- The four reader tabs are Written Guide, SVG Illustration, Video and Learning Level / Competition. Written guidance organizes the existing lesson-specific goal, conditions, approach, common misunderstanding, observation and coach questions into five readable sections. No copied course or transcript.
- Six earlier foundation diagrams are retained. Sixteen new SVG visual families cover footwork, glide, load, swizzles, turning, wheel contact, cone context, Fish/Snake/Cross concepts, speed observation, track context, Slide observation, notes and rules. The 148 cards reuse these 22 conceptual families with the selected lesson's title, description and observation text. They are not 148 unique biomechanical animations.
- The visual pane has a desktop drawing/inspector split, mobile stacked layout, three actual highlight controls, bounded 100–200% zoom, pan, reset and downloadable standalone SVG. Points 1–3 are a way to read a picture, not an execution sequence. Advanced maneuvers use context/observation cards and explicit coach/environment warnings.
- Every reading guide can export TXT containing the actual selected lesson, prerequisites, source URLs and direct video URLs. SVG exports include their own original CSS and parse as XML. Media files/transcripts are not downloaded.
- Cards show text/SVG/direct-video/verified-source availability. Method filters intersect the existing category/discipline/level/favorite/status filters, and save in the same per-account local key. Quick discipline buttons agree with native selectors. Grid/list, paging, search and empty states remain real controls.
- The existing Visual Lab additionally offers a searchable atlas of all 148 cards, previous/next and native keyboard selection. No-result searches hide the previous reader rather than leave a stale result visible.
- Reader tab/highlight/zoom and atlas selection survive workspace changes and favorite rerender in an account-scoped, bounded in-memory session map (at most 300 entries). Private notes and library method preferences still persist on reload through the existing Patin store. Reader position is session-only, not a new hidden localStorage format.
- Twelve newly verified SkateIA links expand the publisher catalog from 25 to 37 while retaining all old video IDs. Direct video associations now cover 42 topics. Other lessons clearly say no direct video has been checked; prerequisite videos are explicitly labelled as related, not substitutes.
- New videos cover two-foot Slalom, backward stroking, crossovers, parallel turn, T-stop, hockey-stop orientation, Pivot context, outside-edge one-foot glide, one-foot Slalom, toe/heel orientation and two Transition camera angles.
- Competition presentation keeps the existing 16 source-checked base examples and their Classic/Slides labels, edition, page and conditions. HH approach level is separate. No fabricated personal/athlete leaderboard, fake grades, added scoring formula or inferred mastery.

## Preservation and scope

- /platform is the sole shell. /patin and all existing child routes, sidebar/header/breadcrumb, authentication and Admin behavior remain intact. No router/login/auth code was edited; the 25 login planets are unchanged.
- State and JSON envelope remain version 1, the same account/guest-scoped hh.patin.v1.* keys, original 148 lesson IDs and original 25 video IDs. The optional library.method field defaults to all when missing. Import validation still whitelists fields; invalid methods are rejected before saving.
- Existing favorites, lesson/video notes, timestamps, plans, journal, routines, preparation, scoped reset/import and cross-tab conflict protection are preserved. A new video or picture never marks a lesson read/tried, creates a session, counts exercise minutes or certifies a physical skill.
- No dependency, remote decorative image/font, API, service, device permission, paid operation or autoplay was added. Reader content is escaped. SVG uses original code only, no script/foreignObject/external image; input-generated markup is not accepted. Listeners and Blob URLs are cleaned up. Existing player cleanup remains in its owner.

## Sources and usage rights

Checked 2026-10-10.

- [SkateIA inline video page](https://www.skateia.org/videos): the 12 added YouTube IDs are explicitly published in its page. Each original title/author was checked with YouTube oEmbed; author SkateIA and HTTP 200. Catalog stores the source page, watch URL, original title, checked date and original HH observation prompts. Grade/Level in a publisher title is not a HH safety level or certification.
- [SkateIA Slalom](https://www.skateia.org/slalom): rechecked for discipline/in-person teaching context, not copied as a course or certificate requirements.
- [InMoveSkates public examples](https://www.inmoveskates.com/inline-skates-lessons-in-us): existing opt-in publisher videos retained, no paid course or media copied.
- [World Skate Inline Freestyle regulations](https://www.worldskate.org/inline-freestyle/about/regulations.html): current source landing rechecked; the previous release's limited factual reference dataset is unchanged. Exact sources/rights/page distinctions are recorded in PATIN_PERFORMANCE_ARENA_RELEASE_1045.md.
- All 37 records pass a read-only oEmbed metadata audit (matching normalized title/author and HTTP 200). Metadata does not prove embeddability, captions or availability in every region.

Videos remain publisher-owned; only outbound links and user-initiated standard privacy-enhanced embeds are used. No redistribution license is asserted, media downloaded, watermark removed, transcript extracted or Vietnamese subtitles fabricated. Text, diagram families, SVG/CSS, UI and observation prompts are original project work. No GitHub/library code or other-party graphic was imported in this release. Advanced lessons still require qualified supervision, and HH text/illustrations have not been reviewed by a skating coach.

## Test evidence

- Syntax: 13 changed production/QA/new-test JavaScript files pass node --check.
- Patin suite: 69/69. Combined feature/navigation/shell/release suite: **133/133**. Security: **14/14**.
- Browser: qa-patin 20, workshop 15, disciplines 13, video 18, arena 19, guide 14: **99 passing groups**.
- The new guide run opens every one of the 148 actual routes and checks the lesson-specific text, nonempty SVG, three point controls and unchanged read state. It exercises tabs via arrows/Home/End, focus, zoom/pan/reset, real TXT/SVG downloads, XML parsing, 42/16 filter subsets, account isolation, note reload, reader return/star rerender, atlas alias/no-result/previous/next behavior and existing media deep links.
- Visual QA inspected library and reader screenshots at desktop/mobile, including the drawing/inspector split. Browser checks cover 1440, 768 and 375 px, footer scrolling, every reader tab, light theme, forced colors, reduced motion and 200% text zoom. No horizontal overflow, uncaught module errors or third-party request before consent in the isolated guide fixture.
- Existing browser suites additionally cover actual native local video playback/rate/seek/A–B, Blob/media cleanup, journal/plan/routine saves, cross-tab conflicts, JSON round-trip, guest Platform, command search, stable shell, Back/Forward, reload and auth rescope.
- Real cross-origin playback probe: six catalog videos (the four earlier publisher samples plus new Parallel Turn and T-stop) were paused before explicit Play, then advanced about 2.9–5.6 seconds, readyState 4, no media error. Headless Chromium was muted; nothing saved/reuploaded. This is transport evidence for those samples, not every video/region.
- Shell auth/backend and isolated iframe action/error tests use labelled QA doubles; hidden-tab signal is simulated. No claim of production login/role, physical-skating, WAN, device, codec-universal or coaching certification.
- QA downloads, screenshots, metadata audit, transport output and generated local clips are ignored under .study-local/, not committed.

## Remaining limits / baseline

- 148 topics are the current curated library, not every technique. Some share a generic context picture; those images are explicitly not an exact movement or safe self-instruction recipe. Text/illustrations need coach review.
- Direct video exists for 42 topics, not every lesson. Publisher availability and subtitles are outside HH control. Missing clips and unverified grades are reported rather than fabricated.
- There is still no synchronized athlete leaderboard, body/AI grading, cloud note sync or official certification. Session-only reader position resets on browser reload; persisted notes/preferences do not.
- No general lint/typecheck/application-build command exists for these vanilla JS modules; syntax, contract/behavior/security tests and browser QA were used.
- The pre-existing performance-loading-contract suite stays **4/5**: 17 first-paint scripts vs budget 16, in both HEAD and the working release. This upgrade adds zero first-paint scripts/styles and does not weaken that assertion.
- Release/cache 1046; loader 708; router remains 289; Platform catalog metadata 17; Patin data 5, core/UI 6, existing CSS 5, video 2, visuals 1, Arena 1. New guide/data-expansion/UI/CSS modules are version 1. No secret or private configuration added to Git.
