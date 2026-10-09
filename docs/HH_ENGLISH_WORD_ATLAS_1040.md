# HH English Word Atlas · release 1040

Date: 2026-10-09. Upgrade extending Cosmic Academy 1039.

## Delivered

- 240 unique entries in 24 original study sets: daily routines, study, learning habits, conversation, feelings, travel, food, services, spending vocabulary, home, cities, digital tools, software, teams, interviews, projects, media, research, environment, design, phrasal verbs, collocations and academic nuance.
- Each entry has an original English example, a contextual Vietnamese sense, part of speech, a useful phrase and a suggested A1–C2 level. Meanings are not presented as exhaustive dictionary definitions. CEFR levels are suggestions, not official classifications. A0 curriculum remains available unchanged.
- New content is explicitly HH/AI-assisted **draft**, not human-reviewed. No invented IPA or human voice metadata. Listed US spellings are accepted for appropriate recall/audio/cloze tasks.
- Nine working study methods: two-sided self-rated cards, meaning choice, typed recall, listen/type, contextual cloze, matching, sentence order, collocation recall and self-written sentences. Mixed sessions alternate six assessed methods; they are not counted as an additional pedagogical method.
- Library search includes Vietnamese without accents, suggested-level filtering, persistent favourites and a selected-set preview. Start/resume/restart, backward navigation, typed/radio/select drafts and result gates are real actions.
- Explicit word saves go into the existing `savedWords`/`reviewQueue`; no second SRS. Unsaved words can be practised but are not silently added to the deck. Existing deck/due lesson sources can use draft entries only after the user has saved them, with provenance preserved.
- Assessed answers update actual per-word attempts; matching counts each pair independently. Self-rated cards and open sentences do not become grammar/pronunciation evidence. One correct answer cannot mark a new word mastered. Errors feed the existing Error Clinic; duplicate accepted submissions do not advance reviews twice.
- Original 30,000-entry ESDB index, its checksums, 69 curriculum lessons, 70 career paths, personal dictionary and prior reviews remain intact. New contexts may overlap terms already found in the older index/curriculum; 240 is the size of the new context bank, not a claim that 240 spellings are absent from that corpus.
- TSV/Anki export is a real local download. Audio remains explicit-click TTS. No microphone, paid AI, new backend or third-party download was introduced.
- Narrow dictionary fixes: account-aware personal catalog, stale asynchronous search/detail guards, immediate note saving and bounded/error-handled file import. No auth route or Platform shell changes.

## Architecture and persistence

Word Atlas is a tab inside Vocabulary Explorer at `/english/galaxy`, not a new shell. Practice Hub links to that same route. Learning OS retains five primary destinations.

New state is additive under `vocabularyStudio.extension`, within the existing owner/profile-scoped V3 state and sync endpoint. Session IDs, word IDs, draft inputs, results, favourites and a bounded 200-attempt history survive reload. Audio transport and microphone permissions are not persisted as live devices.

Assets: `english-vocabulary-expansion.js?v=1`, `english-vocabulary-practice.js?v=1`, `english-vocabulary-practice.css?v=1`, `english-vocabulary.js?v=5`, `english-academy.js?v=2`, loader 702 and cache 1040. Existing `english-learning.js?v=31` and `script.js?v=284` are unchanged.

## Evidence

- `npm run test:english`: 90/90 (78 existing + 12 Word Atlas tests).
- Release/navigation/Platform/Galaxy contract subset: 30/30.
- Security regression: `npm run test:security` — 14/14.
- `scripts/qa-english-word-atlas.js`: 23 passed browser checks. All nine methods plus mixed session submitted; real filter/favourite/save/export; correct/wrong feedback; drafts and session identity across navigation/Back/reload; original SRS advancement and duplicate-submit protection; account isolation; 1440/768/375px; 200% zoom, forced colours, reduced motion and focus; actual HH Platform guest → lazy Vocabulary workspace at 375px. No uncaught page errors in the isolated feature context.
- Existing `scripts/qa-english-academy.js`: 18 regression checks passed, including native synthetic-device recording, writing versions, IndexedDB audio, strict lesson completion and full-shell navigation.
- TTS QA is a transport double confirming explicit-click utterance delivery and no automatic playback. It does not certify physical speakers, voice quality or external speech-provider availability. Backend/auth responses are QA doubles; no production accounts or database records are written.
- Browser data/screenshots stay in ignored `.study-local/english-word-atlas-qa/` and `.study-local/english-academy-qa/`.
- Syntax checks and Git whitespace checks run on changed files. No general lint/typecheck/application-build script exists; unrelated favicon generation is not reported as an application build.

## Sources and limits

All new text, examples and UI code are original project work; no website, GitHub source, media or dictionary definitions were copied. Existing ESDB provenance/license stays unchanged. The new bank is draft educational material that still needs human pedagogical review, especially level estimates and nuanced meanings. It is not an exam word list, CEFR certificate, AI grammar evaluator or acoustic pronunciation engine.
