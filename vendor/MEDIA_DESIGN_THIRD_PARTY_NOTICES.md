# HH Media & Design — third-party notices and research log

Updated: 2026-08-24

This document separates code that is actually shipped from projects that were
reviewed only as architectural references. HH Media & Design does not copy a
third-party product interface, trademark, sample library, or unlicensed media.

## Runtime dependencies shipped by this repository

| Project | Purpose | License / source |
| --- | --- | --- |
| PDF.js | Local PDF rendering and text extraction | Apache-2.0; see `vendor/licenses/PDFjs-LICENSE.txt` and https://github.com/mozilla/pdf.js |
| pdf-lib | Local PDF page operations and export | MIT; https://github.com/Hopding/pdf-lib |
| JSZip | Package import/export where enabled | MIT; see `vendor/licenses/JSZip-LICENSE.md` and https://github.com/Stuk/jszip |
| Tesseract.js | OCR adapter used only by routes that explicitly load it | Apache-2.0; see `vendor/licenses/Tesseractjs-LICENSE.md` and https://github.com/naptha/tesseract.js |

Runtime capability checks remain authoritative. A dependency being present in
the repository does not mean every browser can run its associated workflow.

## Evaluated references — not bundled by this change

| Project / API | Architecture reviewed | License / terms reminder |
| --- | --- | --- |
| Konva | Scene graph, interactive canvas layers and transforms | MIT; https://github.com/konvajs/konva |
| TOAST UI Image Editor | Non-destructive image-editor workflow and filter controls | MIT; https://github.com/nhn/tui.image-editor |
| ffmpeg.wasm | Bounded browser-side media conversion using a worker | MIT wrapper; FFmpeg codecs retain their own terms; https://github.com/ffmpegwasm/ffmpeg.wasm |
| WaveSurfer.js | Waveform, region, timeline and recording UI | BSD-3-Clause; https://github.com/katspaugh/wavesurfer.js |
| Tone.js | Web Audio scheduling and DSP graph patterns | MIT; https://github.com/Tonejs/Tone.js |
| Yjs | CRDT collaboration, snapshots and shared undo patterns | MIT; https://github.com/yjs/yjs |
| Dexie.js | Versioned IndexedDB and local-first migration patterns | Apache-2.0; https://github.com/dexie/Dexie.js |
| Uppy | Resumable upload and crash-recovery patterns | MIT; https://github.com/transloadit/uppy |
| Google Fonts Developer API | Font-family metadata, variants and subsets | Google API terms apply; https://developers.google.com/fonts/docs/developer_api |
| Remotion | Programmatic video composition concepts | Special/commercial terms may apply; https://github.com/remotion-dev/remotion |
| Design Tokens Community Group format 2025.10 | Stable token interchange schema and terminology | W3C Community Group specification; https://github.com/design-tokens/community-group |
| Uppy 5.2.4 | Resumable upload, restrictions, retry and recovery architecture | MIT; evaluated only, not bundled; https://github.com/transloadit/uppy |
| Origin private file system | Large local project storage and worker-side synchronous access patterns | Web platform API; feature-detected, HTTPS-only; https://developer.mozilla.org/docs/Web/API/File_System_API/Origin_private_file_system |

Before any evaluated reference is added as a dependency, maintainers must pin a
version, review the exact license and transitive dependencies, record bundle and
worker impact, and update this file. Google API keys must be restricted or kept
behind an authenticated server gateway; Google Search scraping is not allowed.

The Brand Universe exporter currently identifies the DTCG `2025.10` schema.
Google Fonts metadata is not fetched unless a separately configured gateway or
domain-restricted key is available. The application does not bundle Uppy or
claim resumable provider uploads when its authenticated adapter is absent.

## Media and data policy

- User files remain local unless the user explicitly chooses a configured,
  authenticated provider.
- Example photos, video, audio, templates and fonts require recorded provenance
  and a compatible license before public distribution.
- GitHub repository metadata may be queried through the official API, subject to
  rate limits. Repository contents are never treated as public-domain material.
- Provider secrets, OAuth tokens and signed private URLs must never be serialized
  into `.hhmedia`, release manifests, browser logs or local preferences.
