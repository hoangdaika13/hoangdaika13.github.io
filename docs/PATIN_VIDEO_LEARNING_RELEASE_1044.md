# HH Patin — release 1044: video learning studio

## Shipped

- 24 new original Vietnamese learning/skill summaries: 8 foundations, 6 Speed, 4 Slide-related learning topics, 6 Slalom. Total 130; the original 106 IDs and v1 account-scoped storage keys are retained.
- 25 curated publisher videos: SkateIA 14, InMoveSkates 8, Rollerblade 3. New route /patin/videos is in the Entertainment/Patin sidebar, command search, overview and related lesson links. Each discipline has a fifth observation/feedback stage.
- Search by Vietnamese/accent-insensitive skill terms; topic and HH approach-level filters, favorites, manual reviewed status and progressive catalog display. “Grade” in a publisher title is not HH's safety assessment.
- Selected video, private observation notes and up to 12 manual timestamp bookmarks per video save through the existing Patin store. They round-trip in the existing JSON backup; TXT notes are downloadable. Reviewed/video time never counts as exercise, ability, certificates or calories.
- Conflicting cross-tab note edits retain the visible draft and reject silent overwrite. Explicit reset/import clears retained conflict drafts. Storage/quota errors remain visible and existing scoped memory-draft/backup/retry behavior is preserved.
- One privacy-enhanced YouTube iframe only after explicit user input; no remote cover images or pre-consent requests. No autoplay. Native publisher speed/caption/fullscreen controls are left intact, with source/watch links for unavailable embeds. No iframe API dependency or CSP relaxation.
- Local MP4/WebM reader (150 MB limit): actual native playback, rate selection, ±5-second seek, A/B capture and loop. User-owned/permitted files only, no backend upload or persisted media. File/codec errors are explicit.
- Publisher frame is removed when hidden, changing selection, leaving the route, resetting/importing or switching account. Local playback pauses on hidden tab/panel and Blob URL/source/listeners are released on close/unmount. Nothing auto-resumes after reload.
- Main preview precedes the library in DOM/mobile reading order. Keyboard jump controls reach the catalog or selected video without overlays/scroll locks. CSS is scoped under .pt-root; shell/auth/login planets unchanged.

## Research, source rights and actual use

Checked 2026-10-10. Curated primary sources, not an exhaustive web crawl.

| Source | Rights / scope | Used |
| --- | --- | --- |
| [SkateIA inline videos](https://www.skateia.org/videos) | Publisher-owned videos; no redistribution license claimed | 14 existing YouTube links/standard embeds, skill associations and original HH observation prompts |
| [InMoveSkates free examples](https://www.inmoveskates.com/inline-skates-lessons-in-us) | Publisher-owned public examples, not a license to copy the paid course | 8 publisher-linked YouTube examples; no downloaded videos, transcripts or course text |
| [Rollerblade Advice](https://www.rollerblade.com/usa/en/rollerblade-tv/Advice) | Publisher-owned | 3 Speed examples with specific source URLs recorded per video |
| [Inline-Skate-Info](https://github.com/hankertrix/Inline-Skate-Info) | [AGPL-3.0](https://github.com/hankertrix/Inline-Skate-Info/blob/main/LICENCE.txt) | Reviewed README, tree and VideoCollapsible.svelte for opt-in/grouped video-discovery ideas. No code, catalog, assets or wording copied |
| [YouTube embed parameters](https://developers.google.com/youtube/player_parameters) | Official integration documentation | Standard autoplay=0, playsinline, start and native player controls; no player-API script |

GitHub repository inspected at afa130ccc0d8fc03881c7a0e27c9a8e777a2c8b2, committed 2026-10-06. Its license is not a license for videos referenced by its contributors; individual publishers were independently verified. No new third-party dependency or raster/media asset was imported.

Full source URL, publisher, original title, checked date, skill IDs and rights scope live in patin-learning-data.js. Inline “cover art” is original CSS, not a hotlinked thumbnail. HH educational text is original and **has not been reviewed by a skating coach**. Advanced maneuvers remain orientation-only, with supervised/environment warnings.

## Evidence

- Syntax: changed production JavaScript plus QA/audit scripts pass node --check.
- Related feature/navigation/shell/release suite: **112/112**.
- Security suite: **14/14**.
- Browser QA: qa-patin (20 groups), qa-patin-workshop (15), qa-patin-disciplines (13), qa-patin-video (18): **66 passing groups**.
- Video QA covers actual local saves, reload/route/Back, JSON and TXT downloads, note conflicts, scoped reset, account switching, opt-in/stop, native WebM metadata/rate/seek/A–B playback, invalid codecs, hidden-tab signal, Blob cleanup, desktop/tablet/375px, 200% zoom, forced colors, reduced motion, keyboard focus, stable real Platform shell and no uncaught module exceptions.
- Iframe action/error/cleanup assertions use a clearly labelled transport double. Auth/backend in shell tests uses local doubles; this is not production account/role authentication certification.
- Read-only oEmbed audit: all **25/25** IDs return matching normalized titles/publishers, HTTP 200. Metadata is not proof that every video will play in every region.
- Independent real transport probe: heel-brake (SkateIA), Slalom (InMoveSkates), Slide (InMoveSkates), Speed (Rollerblade) each remained paused before Play, then progressed ~5 seconds with readyState 4 and no media error after explicit Play. Chromium was muted; no media was saved or republished.
- QA output/screenshots/generated local test clips are ignored under .study-local/, not shipped.

## Limits and baseline

- External video availability, region/age restrictions, advertisements, captions and service policies remain under publisher/YouTube control. Vietnamese observation prompts are provided, not fabricated translated subtitles. Four real playback samples do not certify all 25 under every network/region.
- The viewer does not extract transcripts, estimate speed/force or score a skater's body. Watching is not a safe substitute for direct instruction.
- Personal media files do not survive reload/route exit. Notes and bookmarks persist locally, not in cloud storage.
- No general lint/typecheck/application-build task exists for this vanilla JS module; syntax, behavioral/contracts and browser QA were run instead.
- Existing performance-loading-contract suite: 4/5; pre-existing first-paint budget assertion expects <=16 scripts, while both HEAD and this worktree have 17. This release adds **zero first-paint scripts/styles**, and does not weaken that test.
- Release/cache: 1044, loader 706, router 288, Platform home metadata 15; Patin UI/CSS/core 4, data 3, two new lazy modules version 1. No auth, gateway, infrastructure limit or unrelated feature rewrite.
