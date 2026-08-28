# HH Play professional workspace QA

Release checked: `v924` with HH Play `1.1.1`, `hh-play.js?v=6&build=3`, and `hh-play.css?v=7&build=3`.

## Evidence

- `after-home-desktop.png`: 1440 × 1000 viewport. Dashboard includes four command/status tiles, one primary continuation card, three real duration routes, four collection routes, daily progress, recent games, and achievement status.
- `after-quiz-desktop.png`: 1440 × 1000 viewport. Thinking + Advanced filter is active, four choices are rendered, and the answer exposes both the rationale and deeper insight panel.
- `after-quiz-mobile.png`: 390 × 844 touch viewport. Five topics, three difficulty filters and four answer controls remain usable with no document or stage horizontal overflow.

## Functional checks

- Built-in Quiz catalog contains 32 validated questions across Science, Technology, Culture and Thinking.
- Each built-in question has four choices, one bounded answer index, a skill tag, a rationale and an extended insight.
- Topic and difficulty changes reset only the current Quiz session while preserving the selected filters and saved profile.
- A requested `/play/<view>` route remains authoritative after IndexedDB hydration; a previously saved view no longer replaces the destination.
- Dashboard, Quiz desktop and Quiz mobile runs completed without page or console errors.
