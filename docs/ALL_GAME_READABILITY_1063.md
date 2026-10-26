# All Game full-shell readability — release 1063

Real Chromium inspected all 209 library cards in all 16 themes exposed by `HHAppTheme`. The four primary Settings Studio themes (Cosmic, Midnight, Aurora, Light) also receive forced hover, focus and selected favorite CSS states. A real favorite click, actual route visit/return and keyboard Tab are exercised separately.

Computed foreground colors are compared with computed gradient endpoint bounds, background colors and ancestor alpha compositing. No assumed card colors are used; unmeasurable paint/opacity is reported. 71,060 contrast checks passed with 0 text/icon failures and 0 browser JavaScript errors.

| Role | Minimum contrast |
|---|---:|
| title | 13.04:1 |
| link | 13.04:1 |
| description | 6.89:1 |
| metadata | 5.97:1 |
| journey | 9.29:1 |
| estimate | 6.89:1 |
| cta | 4.98:1 |
| favorite | 5.39:1 |

The first keyboard focused favorite originally had 1.25:1 cyan outline contrast against its light card. The scoped dark blue outline fix reaches 7.42:1; forced colors uses the system Highlight color and measures 15.13:1.

No horizontal page overflow was detected at 1440×900, 768×1024, 375×812 or 720 CSS pixels at DPR 2. Advanced filters collapse below 769 CSS pixels. The 200% test is a 720 CSS px/DPR 2 reflow equivalent within 1440 physical pixels; headless Chromium does not provide OS browser zoom UI interaction. Browser privacy masks visited link colors in computed styles, so an actual sample visit and screenshot inspection are reported without claiming private visited color access.

The mobile header and navigation were compacted after visual inspection. At 375 px, the first card begins at y=807 in the full outer page. The visible “Khám phá thư viện” button was tested at all three sizes: it brings the first title into view and focuses the real “Vào chơi” link. The direct Futsal play action is also visible in the hero.

The contact sheet `media/all-game-library-1063.webp` was visually inspected: names read clearly on light cards, all 6 sports artworks depict recognizable equipment/athletes, and the cards align. Desktop, mobile, forced color, normal, hover and focus screenshots plus full computed records remain in ignored `.study-local/all-game-readability-1063/`.

Run with `HH_QA_PLAYWRIGHT`, `HH_QA_CHROMIUM` and `HH_QA_ENFORCE_READABILITY=1`: `node scripts/qa-all-game-readability.js`. External API requests explicitly return 503; the frontend, CSS and local assets are real.
