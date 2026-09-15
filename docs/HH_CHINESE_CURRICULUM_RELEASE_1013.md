# HH Chinese curriculum release 1013

## Outcome

HH Chinese keeps its canonical `/chinese` route and existing HH Platform shell while
expanding the local-first learning experience for Vietnamese learners. Existing learner
state remains account-scoped under the established `hh.*` storage keys and older
58-card schedules migrate forward without discarding review history.

## Shipped scope

- A structured nine-level curriculum map with 100 active-learning vocabulary cards.
- Expanded grammar, reading, dictation, conversation, writing, idiom and short
  skill-practice collections.
- Vietnamese-targeted pronunciation contrasts and 13 contrastive language modules.
- Two-way Vietnamese–Chinese translation practice.
- Transparent local writing and reading checks, alternative accepted answers and a
  stale-state guard that prevents duplicate SRS progress across tabs.
- Five stable navigation groups: Today, Foundation, Communication, Reading–Writing
  and Skill Practice.
- Responsive layouts, visible keyboard focus and reduced-motion support.

## Capability boundaries

- The 50,000-entry CVDICT catalog remains lookup-only and is never automatically
  added to SRS.
- The short skill practice is not a standardized HSK exam, score or certificate.
- Browser SpeechSynthesis is device-generated and is not native-speaker audio.
- Local pronunciation, writing, reading and translation feedback does not claim
  linguistic or semantic accuracy beyond the explicitly displayed checks.
- New HH-authored learning content remains marked as requiring specialist linguistic
  review.

## Sources and licences

No external code or media assets were added by this release. Framework references and
the existing CVDICT attribution are documented in `assets/chinese/NOTICE.md`.
