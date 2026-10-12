# All Tool: local Monaco and workspace upgrade

## Sources, maintenance and license

- Upstream: https://github.com/microsoft/monaco-editor
- Pinned release/tag: `v0.55.1`; package `monaco-editor@0.55.1`.
- License inspected: https://raw.githubusercontent.com/microsoft/monaco-editor/v0.55.1/LICENSE.txt (MIT, Microsoft).
- API/lifecycle integration reference: https://microsoft.github.io/monaco-editor/docs.html and https://raw.githubusercontent.com/microsoft/monaco-editor/v0.55.1/README.md.
- Upstream code inspected: the pinned `min/vs/editor/editor.main.js`, `workers-DcJshg-q.js`, language contributions and package metadata. This is a maintained Microsoft upstream. Its AMD build is deprecated for future releases; the pinned compatibility build is used to fit the existing no-bundler application. A future update must review migration to ESM rather than silently upgrading.
- Archive: https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.55.1.tgz. `scripts/sync-tool-monaco.js` verifies its published SHA-512 before extracting an allowlisted subset. Each extracted file has a SHA-256 in `vendor/monaco-0.55.1/manifest.json`.
- MIT license and ThirdPartyNotices are shipped next to the runtime. No website design, branding, illustrations or private code were copied.

## Actual application

Only the editor core, English strings, JS/TS/JSON/HTML/CSS/Markdown syntax modules, language-service workers and notices are vendored: 34 files, about 13.12 MiB uncompressed. TypeScript's worker is about 7 MiB and loads only when needed. None of this runtime is eagerly loaded by other tools or the homepage. Browser requests use same-origin `/vendor/monaco-0.55.1/` paths, never a CDN. JSON remote schema requests are disabled. Code is not evaluated or executed.

Desktop loads Monaco on opening its workspace and supports syntax markers, find/replace, language-aware formatting, read-only inline diff, multiple independent documents, saving and export. Markdown has highlighting but no formatter and reports that limitation explicitly. A slow/failed/blocked runtime leaves the textarea intact. Official Monaco does not support mobile browsers; small/coarse-pointer devices intentionally receive a native 16px textarea with document management, JSON formatting, comparison and export.

On workspace close, editor/models/listeners/diff models are disposed; public language-default events reset worker managers and owned workers terminate. Same-origin module workers are used. The production CSP must be tested; do not weaken `script-src` with `unsafe-eval` to mask an integration problem.

## Original local features (no copied source)

Prompt Library now edits existing IDs, tags/search/favorites/duplicates, validates JSON imports and expands `{{variables}}` without evaluation or AI calls. Tabs retain text on switch, show dirty state, support pin/reorder/rename/export and keep a snapshot before deletion. Version History compares bounded line regions and snapshots current text before restore. File Explorer has account-local folders and safe editable text; it never runs uploaded HTML/SVG. Editing a text file snapshots the original.

Hard reload restores a newer draft only to its existing account-owned tab; it does not assign a deleted tab's draft to a different document. File Explorer keeps pending text through rename/move and restores it after reload. Opening another file requires resolving pending edits; inline discard confirmation and draft export remain available. A stale base version blocks overwrite. Editable file text and safety snapshots are bounded to 500 KB UTF-8, with no silent draft truncation.

The workspace backup adapter includes account-scoped records/history and opt-in small binaries (1 MiB per file, 2 MiB total). Omitted file IDs are listed. Import validates supported types, sizes and identities; IndexedDB applies records/history/files in one transaction. Replacing a backup does not delete omitted files or their needed folders. Guest and other-account rows are not adopted.

Speech file transcription and WAV synthesis are wired to the existing backend gateway, consume explicit per-request paid-processing consent, do not retry and never autoplay audio. Native device speech remains distinct. Provider configuration is a capability check, not proof of billing, quota or successful paid generation.

## Verification scope

The focused tests cover pure engines, storage-account boundaries, prompt update-vs-duplicate behavior, document switching in a DOM double, safety snapshots, adapter requests with explicit response doubles, WAV signature/size checks, backup round trips and all runtime checksums. These tests do not claim live paid media generation, physical microphone behavior, actual browser layout or production transport; report browser probes separately in the release document.
