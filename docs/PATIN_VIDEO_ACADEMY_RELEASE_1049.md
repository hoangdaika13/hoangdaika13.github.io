# HH Patin Neon Video Academy — release 1049

## Delivered scope

The existing `/patin/videos` workspace and `/patin/videos/<id>` links are retained inside the unchanged HH Platform shell. No authentication, router, login planets, Overview 3D code/layout, skill IDs or other workspace layout is replaced. Shared Patin data/core gain additive content and optional validated video preferences.

### More real lessons

- **37 → 75 publisher video records**, appending **38** records while preserving every prior ID, title, source and personal-state association.
- Additions: 15 SkateIA Slalom clips, 8 SkateIA Quad clips and 15 Sikana English inline clips. By UI topic the additions are Slalom 17, Quad 8, foundation 13 (two Sikana clips cover cones/limited-wheel context).
- Existing Rollerblade Speed and InMoveSkates Slide videos remain; these pools were organized into collections, not inflated with unrelated clips.
- Skill-specific direct linked-video coverage **42 → 55 of the existing 148 topics**. Broader context is explicitly stored separately in `relatedSkillIds`; Quad clips relate to `quad-basics` but are not falsely declared exact inline-technique videos. The Quad article still has no directly matched full lesson.
- Publisher original title, author/channel, source URL, language/subtitle limitation, inspection date and standard-link/embed/no-redistribution rights accompany every addition.
- Observations are original HH study prompts, not copied transcripts, coach-certified procedures, timing/chapter claims or physical ability assessments. Advanced clips retain orientation-only warnings. Publisher Grade/Level is not an HH safety level or official competition rank.

### Easier learning desk

- Scoped neon studio, discipline accents, original local SVG concept previews and clear source labels. Previews explicitly say they are HH illustrations, not frames/thumbnails from publisher media; no image hotlinks or remote fonts.
- Eight ordered collections: starting inline, stopping/control, Slalom foundations, advanced Slalom observation, Quad, Speed, Slide, equipment/cadence. Collections contain actual registry IDs. Counts of marked-reviewed items are manual self-reports, not watch-time/mastery.
- Persistent search, topic, HH level, publisher, collection, favorite/unreviewed filters, title/level/collection ordering and list/grid mode. Search includes actual titles, existing aliases and relevant skill IDs. Empty intersections are honest and clearable.
- Library, side-by-side and lesson layouts, with mobile auto starting in the catalog unless opened via a direct lesson route. Automatic layout responds to viewport changes; explicit personal layout choices remain. Advanced filters collapse initially on small screens while search/clear/mode remain accessible.
- Ordered previous/next uses the current actual filtered results, never automatically plays the next video. A selected video outside filters shows an explicit state and disabled queue controls.
- Collection selection resets conflicting filter inputs intentionally; mode toggles and library bookmarks do not discard notes. Removing the final visible bookmarked item and exhausting more results preserve keyboard focus.
- View/source links, source language/date, bounded original observation list, collapsible private notes/markers, existing opt-in publisher player and native local-file slow motion/A–B remain usable.
- Hiding the lesson closes its external iframe. Workspace exit, auth change and hidden-tab handling continue to release/pause media; no new timer, render loop, media SDK, device permission or backend/API is introduced.
- Light-theme dark-player placeholder contrast was fixed after visual inspection; mobile shortcuts and filter panels were made more compact.

## State / compatibility

The existing `hh.patin.v1.<scope>` key, envelope/workshop/video version 1, 600 KB total storage limit and 150 MB local-file limit remain. Optional addition:

```
workshop.videos.library = {
  query, topic, level, publisher, collection,
  favorites, unreviewed, sort, mode, view
}
```

Older states without this object default to the unfiltered automatic-layout catalog. Each enum, registered publisher, collection and 120-character query is checked; fields are whitelist-cleaned. Existing notes, markers, reviewed flags, favorites, last video, skill notes, checklist, journal, plan and routine are preserved through save/reload/export/import. No Blob URL, video file, API token or credential enters exported data.

New records work with existing optimistic note snapshots. Failed storage reports pending/in-memory state; stale two-tab notes retain exportable drafts until explicit discard. Video reviewing never creates skill completion or journal minutes.

## Sources / rights actually used

Public sources inspected on 2026-10-10:

- [SkateIA inline videos](https://www.skateia.org/videos): existing records preserved.
- [SkateIA Slalom skills](https://www.skateia.org/skills-slalom): publisher-page embed IDs matched to YouTube metadata; 15 selected named variants, not the entire publisher catalog.
- [SkateIA Quad skills](https://www.skateia.org/skills-quads): 8 selected clips clearly separated from inline setups.
- [Sikana / Roller Squad Institut inline program](https://www.sikana.tv/en/sport/inline-skating): 15 English lesson pages inspected; English video IDs obtained from the publisher's page, then confirmed as `SIKANA English` through oEmbed. Each registry record links its specific lesson page. Topics include protection, putting on/cleaning skates, standing up, initial movement, plough/heel braking, turning, backwards, observational drills and limited-wheel context.
- [Existing InMoveSkates publisher](https://www.inmoveskates.com/about-us) and [Rollerblade advice portal](https://www.rollerblade.com/usa/en/rollerblade-tv/Advice) remain source references. No new unrelated Speed/Slide records were inferred from search results.

External media is publisher-owned, not claimed to have a free redistribution license. Only links and opt-in standard YouTube privacy-enhanced embeds are used. No video/audio/thumbnail/transcript/course PDF was downloaded, rehosted or incorporated. Original HH code/CSS and project-owned SVG are used; no third-party package, engine, code or asset was imported. Source grades remain in original titles for attribution/context, not a scoring engine.

## Evidence

- Syntax: 11 production/touched QA/new-test files passed.
- **159/159** targeted Patin, storage/content, shell/navigation, feature isolation and release/cache tests, including **12 new Video Academy tests** (105 Patin tests in total).
- Separate security suite: **14/14**.
- Browser suites: base 20, workshop 15, disciplines 13, video 18, Arena 19, guide 14, Overview 18, Skill Academy 14, Video Academy 15 = **146 passing groups**.
- New-video direct routes, actual publisher/topic/collection intersections, sorted list/grid restoration, ordered queue bounds, manual collection counts, notes/favorites/markers, guest/A/B isolation, two-tab conflict persistence, real TXT/JSON download/import, advanced/related/invalid-route states and explicit iframe teardown verified.
- Desktop 1440, tablet 768 and mobile 375; 200% CSS zoom, light/forced colors/reduced motion, keyboard focus/Enter, natural footer scrolling and no horizontal overflow. Screenshots inspected and contrasted/compacted in response. No new module uncaught errors or pre-consent external media requests.
- Existing real Platform guest/sidebar/command search, workspace cleanup, Back/Forward/reload and shell stability rerun. Auth/backend checks use labeled local doubles; they are not production-account or physical-device certification. Overview renderer QA uses software GPU.
- **75/75 live oEmbed records** returned 200 with exact normalized original title and expected channel. This proves current metadata, not playback rights/availability everywhere. Read-only audit output is ignored under `.study-local/patin-video-qa/source-audit.json`.
- Separate actual cross-origin, muted browser playback observed for **4/4 new sample clips**: standing up `gaMNfokY-K8`, heel brake `Ta_DBRMiPgE`, Nelson `7H9ZnkhXt2A`, Quad basic stride `6TW1aCn7xhE`. Each initially paused; after explicit QA Play, time advanced and readyState was 4. No iframe transport doubles were used for this probe. No media was saved/reuploaded. Samples do not certify all 75 clips, regions, subtitles or physical technique. Ignored results: `.study-local/patin-video-qa/live-transport.json`.
- Known unrelated performance-loading suite remains **4/5**: first-paint script budget 16, actual **17 both before and after**. New video assets are route-lazy, no assertion weakened. No general application lint/typecheck/build script exists; syntax and relevant tests were used instead.

## Limits

Publisher availability, embedding, age/region limits, subtitles and rate/fullscreen controls remain external. There is no automatic YouTube playback/watch-time tracking or frame extraction. Some previews and links are conceptual/broader context, not an exact technique lesson; there are still topics without direct video. Source materials and HH prompts are not a personal training prescription or safety/skill certification. No new Speed/Slide videos were fabricated, no real-world coaching or user ranking was implemented.

## Release assets

Cache 1049; loader 711; data 6; core 8; video UI 3; new video curriculum/helper and scoped CSS 1. Patin renderer 8, Skill Academy assets 1, guide/guide UI 1/2, Overview assets 1 and router 289 unchanged. Previous release marker retained. All new assets lazy-load through the existing Patin group and have one canonical service-worker entry.
