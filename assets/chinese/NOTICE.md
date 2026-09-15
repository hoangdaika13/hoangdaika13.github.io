# HH Chinese data & provenance

## Lazy 50.000-entry lookup catalog

HH Chinese now includes a generated, lazy-loaded lookup catalog at `cvdict-50k.json.gz`.
It contains exactly 50,000 unique simplified-headword entries selected from **CVDICT**
(a Chinese–Vietnamese dictionary derived from CC-CEDICT). Each record keeps simplified,
traditional, pinyin and Vietnamese meaning fields plus a `CVDICT` provenance label.

- Source repository: <https://github.com/ph0ngp/CVDICT>
- Source licence: **CC BY-SA 4.0** (attribution and share-alike apply)
- Generated asset: `cvdict-50k.json.gz`
- Generated metadata/checksum: `cvdict-50k.meta.json` · SHA-256 `3d3f5953c1ede07b372423a64c425034fce3b61aea77f42ae813d01cbfe55d01`
- Selection: first 50,000 unique, parseable simplified entries containing Chinese characters from the downloaded CVDICT source; this is a reproducible lookup subset, not an official HSK word list.

The catalog is deliberately loaded only when the dictionary view is opened. It is not
copied into localStorage and is not mixed into the 100-entry HH-authored learning deck or
its SRS schedule. CVDICT meanings are open-source dictionary data and can contain
translation or sense omissions; learners should verify context before promoting a word
into a personal study deck.

HH Chinese v1 shipped a small, HH-authored seed deck (40 foundation entries) plus 18 extended entries for HSK 5, HSK 6 and the HSK 7–9 advanced band. Release v14 adds 42 HH-authored draft learning entries, bringing the active-learning deck to 100 entries. This deck is for local-first guided practice; it is not a complete official HSK vocabulary package and must not be described as an official HSK exam bank.

## Curriculum expansion v14

The v14 curriculum bundle is project-authored and stored as structured data in
`hh-chinese-curriculum.js`. It adds level packs, vocabulary, grammar, reading,
conversation, writing, idiom, tone-pair and Vietnamese learner contrast exercises.
Every new authored item is marked `hh-authored-needs-linguist-review` with the
editorial date `2026-09-15`. This status must remain visible until a qualified Chinese
language reviewer has checked the content.

Current learning-surface coverage after the merge:

- 100 active-learning vocabulary cards, separate from the 50,000-entry lookup catalog.
- 27 grammar points and 21 active-recall grammar questions.
- 10 basic readings, 9 deep readings and 10 dictation prompts.
- 12 conversation scenarios, 9 writing prompts and 12 idiom entries.
- 10 tone trainer prompts, 10 tone-pair drills, 8 Vietnamese pronunciation contrasts and 13 Vietnamese learner modules.
- 18 short skill-practice questions. These are not a standardized HSK mock exam, score or certificate.

No external code, audio, images or third-party curriculum data were copied into the
v14 expansion. The official Chinese Proficiency Grading Standards (GF0025-2021) and
Chinese Tests Service HSK overview were used only as framework references. Browser
SpeechSynthesis remains a device-generated accessibility aid, not a native-speaker
recording or pronunciation authority. The local writing and translation checks examine
transparent surface signals only; they do not claim semantic, grammatical or exam-grade
assessment.

The Vietnamese learner pathway intentionally separates “lộ trình năng lực” from “dữ liệu đã có”: HSK 7–9 is represented as the official advanced band, with an HSK 9 destination, while advanced seed words remain HH-authored until a licensed, versioned syllabus dataset is integrated.

Reference points used for the product design:

- The official Chinese Tests Service website describes the HSK 3.0 framework as three stages/nine levels and five syllabus components: tasks, topics, vocabulary, grammar and Chinese characters: <https://www.chinesetest.cn/HSK>.
- The official Chinese Proficiency Grading Standards reference is GB/T 38565-2020 / GF0025-2021; it is used as a level-framework reference only, not copied as syllabus content: <http://www.moe.gov.cn/jyb_sjzl/ziliao/A19/202104/W020210420557727347710.pdf>.
- Hanzi Writer is an MIT-licensed open-source stroke animation/practice library. Its data has a separate Arphic Public License notice: <https://github.com/chanind/hanzi-writer>.
- CC-CEDICT is commonly distributed under CC BY-SA 3.0. Any future import must preserve attribution/share-alike requirements: <https://github.com/moyalabs/cc-cedict-sqlite>.
- Pinyin Data provides portable readings for Hanzi and documents its Unicode data terms: <https://github.com/xiaohk/pinyin_data>.
- ChineseFlow and other open projects were reviewed for dashboard, SRS and test-flow ideas; no code or proprietary content is copied into this seed: <https://github.com/mwojtcz/chinese-learning-app>.

When a larger vocabulary, sentence bank, audio pack or stroke dataset is added, keep its source URL, version, checksum, licence and editorial review status beside the asset. Do not claim native pronunciation accuracy from browser speech synthesis alone.
