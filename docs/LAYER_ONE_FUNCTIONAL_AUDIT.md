# Layer One functional audit — work in progress

Baseline: commit `b3a01f4`, 2026-09-06. This is a functional implementation
task, not a claim that every advertised workflow is complete.

## Baseline test result

`node --test tests/*.test.js`: 2,584 tests, 2,578 pass, 6 fail.
Existing failures: four Fortune files missing `astronomy-engine`, one trusted
comic catalog evidence checksum, one EonWild glTF loader checksum. They are
outside this work and their safety assertions have not been weakened.

## Capability inventory

| Route / entry | Input → output | Storage / engine | Baseline gaps | Current implementation / verification |
|---|---|---|---|---|
| `/home` map, search, zoom, reset, pause | navigation/preferences → selected Galaxy view | existing home/Layer One owners | no major audited gap; retain regression checks | unchanged; routing/layout contracts retained |
| `/galaxy/ai` prompt library | prompt/title → local record | `hh.galaxy.layer-one.v1` | no edit/tag/favorite UI | Workbench edit dialog, tags/folder/favorite and per-record JSON export; store unit tests |
| AI variables | template + JSON values → resolved prompt | pure Workbench core, no storage | missing | missing-variable checks and bounded local expansion; unit tested |
| AI attachments | imported text record → explicitly appended prompt | Layer One content IndexedDB | metadata was not consumable by composer | explicit read/append with prompt-length checks; browser QA pending |
| AI conversation | typed prompt/context → provider answer | `/api/ai` existing Gemini proxy, local snapshots | single-turn only, incomplete history controls | bounded multi-turn context + resume/copy/export; real authenticated provider test pending |
| `/galaxy/music` player, recording | media file/microphone → playback/recording | native media, MediaRecorder, session playlist | reload could not reopen stored sources; no record download | source reopen from content store + download; browser QA pending |
| Music trim/fade/gain | decoded PCM + range → PCM/WAV | native Web Audio + dedicated worker | range metadata only | real WAV encoder and trim/fade/gain, shared preview/export; unit tested |
| Music multi-track | 2–8 PCM tracks → aligned mix/WAV | bounded PCM worker | unimplemented card | rate conversion, mono/stereo alignment, gain normalization; unit tested |
| Music waveform/playlist | time/input → playhead/seek/loop/order | existing waveform + player events/content store | static waveform; session playlist | timeupdate playhead, pointer/keyboard seek, 1×/2×/4× zoom, loop, explicit source restoration and saved ordering; final replay QA pending |
| `/galaxy/video` player, notes, thumbnail | local video → frame/time metadata | existing media engine and content store | stale async subtitle callback | owner check, disable previous track; existing media tests |
| Video subtitles | SRT/VTT text → parsed cues/track/files | existing parser + new serializer | no editing/export | editable text, apply, SRT/VTT export; timing round-trip unit tests |
| Video editing | 1–4 local clips + range/text → WebM | Canvas captureStream + MediaRecorder | timeline editor unimplemented | bounded native renderer, ordered clip list, project/source links; real WebM frame/audio verified and source/text restored after reload; no MP4/FFmpeg claims |
| `/galaxy/creator` nine-step pipeline | project + step text/checklists → versioned project/files | independent Creator store/IndexedDB | mostly planning/text, not production engines for each stage | image/thumbnail PNG canvas, all-step Markdown, production ZIP, explicit append-to-step handoff; voice recording, local music playback/download and video WebM controls added; media assets remain session-bound and complete production/asset-link acceptance remains pending |
| `/galaxy/games` Orbit Collector | keyboard/touch/gamepad → score/win/timeout | Canvas, local save/control records | no target/time/difficulty/touch/restart | bounded challenge, explicit restart, touch input, saved remaining/difficulty; browser QA pending |
| `/galaxy/dev` snippets | code/title → local snippet | existing Layer One store | no edit/search tools/visible highlighting | record editing, line-numbered escaped highlighting, find/replace, download/diff; >16k persistence rejected explicitly instead of truncating; browser edit/save exercised |
| Dev preview | HTML/CSS → sandbox frame | existing no-script/no-network iframe | no safe JS execution engine | unchanged sandbox restrictions; no arbitrary JS runner claimed |
| `/galaxy/learning` decks/cards/quiz/review | user cards/answers → due schedule/progress | existing Learning engine/IndexedDB | no mistake notebook UI | derived wrong-answer notebook, blocked during active quiz; existing grading/storage engine retained |
| `/galaxy/community` drafts | text/file → local draft/preview | existing main store + DOMPurify | no preview/edit/attachment consumption | edit records, sanitized preview, explicit TXT/MD append; local only |
| Community online | posts/comments/users → server records/feed | new isolated API collections `hhGalaxyLayerOnePosts` / `hhGalaxyLayerOneComments` | no Layer One CRUD/feed adapter | authenticated public/private post CRUD, comments, reactions, cursor paging/idempotency, explicit polling client implemented; two-identity service tests pass; real DB/auth acceptance, groups and socket fanout still pending |
| `/galaxy/tools` seven tools | text/JSON/CSV/QR input → processed result | existing pure tools, QR vendor, Web Crypto | no result actions; permissive CSV row width | copy/download/reset/labeled examples, stale-result invalidation, strict quoted CSV; unit/browser QA |
| `/galaxy/analytics` consent/filter/export | opted-in events → metrics/JSON/CSV | existing bounded analytics engine | unchanged measurements are explicitly raw | existing consent tests retained; no fake chart added |
| `/galaxy/settings` theme/UI/privacy/backup | explicit preferences/import → settings or merged data | existing versioned main/Creator/Learning/content backup | binary media excluded from portable JSON | retained transactional importer; Blob exclusion remains explicit, full media backup not implemented |

## Libraries

DOMPurify 3.4.14 is the only newly vendored dependency; see
`THIRD_PARTY_NOTICES.md` and the original license in `vendor/licenses`.
Existing WebGL, IndexedDB, game, learning and Creator engines are not replaced
just to add a dependency. PCM export and the bounded native WebM pipeline are
original repository code, not copies of WaveSurfer/FFmpeg implementations.

## External configuration and incomplete acceptance

- Authenticated AI requires the existing Vercel rewrite to `tool-api/ai`, the
  current auth/database configuration, a Gemini key and working provider quota.
  No credentials are embedded or requested in source code.
- Community requires its own authorized server data and realtime adapter;
  a connection alone does not establish persistence or multi-user correctness.
- No new accounts, paid services, deployments or production writes were made.
- Do not label the overall request complete until the pending rows above have
  been implemented and their real browser/backend acceptance tests pass.

## Local configuration inspection (values never printed)

`.env.local` contains empty `MONGODB_URI` and `JWT_SECRET`; no nonempty
Gemini key was found under the supported names. No credential or existing
production environment was altered. Authenticated external acceptance remains
pending an isolated configured backend and appropriate test users.

## Real-file browser verification so far

- Generated two public sine-wave fixtures and a two-second solid-color video
  with the installed FFmpeg, outside the repository in a temporary QA folder.
- Browser imported both WAVs, exported a 0.5–1.5 second crop with fade, then
  mixed the two tracks. Independent ffprobe inspection found PCM s16le,
  48 kHz mono, exactly 1.000000 / 2.000000 seconds respectively.
- Browser exported the sample video with `HH GALAXY QA` overlay. ffprobe
  found VP9 1280×720 plus stereo Opus. Decoding the exported WebM's frame
  confirmed the text was burned into the picture, not a UI-only overlay.
- JSON Formatter's downloaded JSON was opened and parsed as expected.
- Exported QR SVG containing `Xin chào Việt Nam` was rasterized from its
  module path and decoded independently with zxing-cpp 2.3.0; decoded text
  matched exactly. The QA decoder is installed only in the temporary QA
  directory and is not bundled with the site.
- A named local QA snippet was created and edited using the new modal.
  Metadata and oversized-write failure cases are also covered by unit tests.
- Snippet `QA Workbench 983` was reopened after a page reload and retained
  `const galaxy = "Edited";` exactly.
- Creator project `QA Production 983` exported a ZIP with 12 files / 9 step
  entries. Its idea Markdown contained the typed text; the manifest explicitly
  declared `includesBinaryMedia: false`. The exported thumbnail opened as a
  1280×720 PNG with the typed `GALAXY CREATOR — TEST` visibly rendered.
- Game start/pause/resume/save was exercised through native buttons. The
  time-limited win/lose implementation still needs a full end-state browser
  playthrough, and microphone recording needs user-granted permission QA.
- Community starts with `Chưa kết nối API`; the explicit connection button on
  the static test server returns the actual HTTP 404 configuration error.
- Eight changed module views were measured at 390px with zero document/inner
  overflow. Tools was also measured at 375, 768, 1024 and 1440px, without
  horizontal overflow. No runtime console errors were recorded in this pass.

## Current acceptance summary

The whole-repository test run after implementation has 2,611 tests:
2,605 pass and the same 6 baseline failures remain. Focused Galaxy/Home/
gateway/release checks have 484 passing tests. These counts describe test
execution, not the proportion of the user request completed.

Remaining work includes a real authenticated provider request, real MongoDB
API/two-session testing, group membership/events and socket fanout, complete
persistent Creator media references, full media-inclusive backup if desired,
and broader cancellation/browser/end-state acceptance. None are marked done.

Project `QA Video Project 983` was saved, the page reloaded, then restored
through the UI. Its `Project restore QA` overlay text and playable source
video were recovered from Layer One storage.

These results are partial acceptance evidence, not a blanket completion claim.
