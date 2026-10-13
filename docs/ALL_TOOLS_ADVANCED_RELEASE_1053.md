# All Tool Advanced Workflows — release 1053

Continues release 1052 inside HH Platform. Keeps all 86 identifiers, routes, the outer shell, login and existing account-owned data. Three delegated implementation scopes (Platform, Utility, Workspace) were integrated by the root agent, which owns catalog, release manifests and browser QA. No new service, dependency, paid automatic request or external media asset is introduced.

## Improvements

- Catalog: accent-insensitive Vietnamese metadata search, engine filter and name/recent/pinned sorting within each group. Account-scoped view enums survive reload under `hh.all-tools.catalog-view.v1`; search text is not persisted. Filtering does not remount the current studio. Reset restores the complete registry; keyboard order follows the actual visible order. View preferences are local UI state, not part of the existing content-backup format.
- Platform: cosmic theme presets and bounded personal palettes, preview/apply/rename/delete with account ownership and no global theme change; history date/tool/action/source filters and exports of the matching bounded metadata only.
- Utility: CSV Workbench inside the existing Dev Utilities studio (not a fabricated extra catalog ID), with quoted-field/newline parsing, table preview/filtering, CSV/JSON conversion, file imports and bounded exports. Regex Playground adds capture groups, positions and replacement previews in a time-bounded worker. Input text does not enter action history or persistent settings.
- Workspace: local editable subtitle cues/imports and validated SRT/VTT export; version-history search, paging, labels and selected-version comparison with safety snapshots on restore.

Five built-in palettes (Nebula, Aurora, Solar, Ocean, Minimal) and at most 12 personal palettes use the existing settings store and settings backup. Activity filtering/export covers at most 500 actual metadata events, with date filters in the device's local timezone. CSV is bounded to 1 MiB UTF-8, 5,000 source rows, 100 columns, 100,000 cells and 32,000 characters per cell; the 50-row table preview can shorten long cells, while exports preserve full bounded data. Header duplicates/ragged rows must be resolved for object conversion, or exported in array mode. CSV and Regex source text is ephemeral: export before closing the tool.

Regex executes only in a worker with a 1-second deadline, at most 1,000 matches, 30 capture groups per match, 200,000 displayed capture characters total, a 4 MiB result packet and 2-million-character replacement limit. Capture clipping is signalled; an incomplete replacement is rejected, not exported as complete. Positions use UTF-16. Subtitles support at most 300 plain-text cues, 200,000 total cue characters and 0–24-hour times; basic WebVTT NOTE blocks are omitted with a warning, while STYLE/REGION/cue settings are rejected. Version comparison is limited to 4,000 lines with explicit truncated-diff status; full bounded snapshot content is retained, not truncated by the comparison.

## Privacy and compatibility

All prior account isolation, import validation, backup rollback, editor disposal and hard-reload draft fixes remain in scope for regression checks. Personal presets use the existing settings store. New subtitle state must remain optional and compatible with the existing scoped tool-draft format. File/snapshot limits remain enforced; user text is escaped and never executed.

No audio autoplay, device permission request, provider inference or external notification delivery is triggered by these upgrades. Browser permissions, native API support and provider configuration/billing still apply to the existing voice/AI tools. CSV formula protection reduces the spreadsheet risk; it is not a promise that an edited/re-saved spreadsheet is safe. Subtitle cue times are user-provided or explicitly approximate when derived from transcript text, not measured alignment or speaker diarization. Calendar/reminders, offline availability and Markdown limits remain as documented for release 1052.

The separate unfinished Facebook login draft is not part of this release. The selected Git-index manifests and previously committed auth runtime are used for shell QA; unrelated files, local profiles, credentials and QA output are excluded from the commit.

## Verification

Final checks passed: **200/200 All Tool tests**, **19/19 gateway/security/speech tests**, **42/42 full Chromium probe groups**, syntax for all **7 changed first-party JavaScript files**, and staged/working `git diff --check`. All 86 studios mount at 1440/768/375px without horizontal overflow. Expanded 200% zoom checks include theme, history, CSV, Regex, versions and subtitle panels; forced colors, reduced motion and visible keyboard focus were also checked. No uncaught JavaScript, public-asset or fixture CSP errors were seen.

Real browser probes cover actual Unicode CSV file import, quoted multiline cells, row filtering, JSON conversion and formula-protected download; actual Regex worker capture/replacement and stale-result clearing; saved catalog filter isolation; preset preview/no-write, apply, save/rename/reload/confirmed-delete; metadata-only history JSON/CSV downloads; SRT import/timing edits/overlap rejection/VTT download/timeline reload; and two actual version snapshots with comparison and persisted renamed labels. Prior Monaco/OCR/QR, account isolation, draft/file recovery, backup, offline public cache and App Shell guest/navigation/Back/Forward flows remain passing.

Unit/DOM doubles and provider-response doubles are reported separately from actual browser engines/IndexedDB/local HTTP. Node worker-thread tests exercise catastrophic Regex timeout, Unicode zero-length progression, capture/packet bounds and replacement-token parity. Cross-account delayed compare/rename tests verify that stale results neither populate the new account's reused host nor write its store. Auth/provider/realtime routes in shell QA are explicit doubles: no real-account/WAN login or paid inference/physical microphone test is claimed. This vanilla app has no general lint/typecheck/build command; JavaScript syntax, focused tests, production CSP browser checks and release/cache consistency are the relevant checks.

## References and rights

Reviewed 2026-10-13. Original implementation; no new third-party source or media copied. Existing Monaco/Tesseract/QR licenses and pinned assets remain unchanged; see release 1052 and `ALL_TOOLS_MONACO_RUNTIME.md`.

- [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180): CSV quoted fields, embedded newlines and escaped double quotes; delimiter/header extensions are stated separately.
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection): spreadsheet formula risk and limits of escaping.
- [MDN RegExp indices](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/hasIndices): native match/group position semantics, with explicit unsupported-browser states.
- [MDN WebVTT](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API): cue timestamps and plain-text subtitle interchange; advanced styling/layout is not advertised.
- [W3C WebVTT](https://www.w3.org/TR/webvtt1/): cue syntax reference for the original bounded plain-text parser; no parser source copied.
- [Papa Parse](https://github.com/mholt/PapaParse), [MIT license](https://github.com/mholt/PapaParse/blob/master/LICENSE): inspected delimiter/header/formula-escape patterns; independently implemented, not installed or copied.
- [MDN replacement tokens](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace): replacement semantics, checked against trusted native patterns in isolated worker tests.
