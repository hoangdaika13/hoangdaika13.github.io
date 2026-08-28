# HH Galaxy favicon v2 — QA report

Release: `hh-identity-portal-v914`  
Date: 2026-08-28  
Scope: favicon assets, favicon runtime, lifecycle, release cache and focused regression tests only.

## Root cause before the change

The previous runtime used eight generated SVG data-URI frames and a fixed 167 ms interval (about 6 FPS). Every tick called the icon reconciliation path again, queried all icon links and assigned `href` even though route changes did not require a new engine. It had no Save Data guard, no selectable motion modes, no delayed start until document readiness, no browser decode-failure lock and no public lifecycle snapshot. These properties made duplicate initialization difficult to diagnose and caused avoidable tab-icon work.

## Implementation after the change

- One singleton engine (`engineVersion: 2`) and one `#hhDynamicFavicon` link.
- Sixteen SVG data-URI frames are built once and reused; there is no canvas, Blob, Base64 conversion, Object URL or per-frame DOM node creation.
- The phase is derived from elapsed time instead of advancing blindly, so late timer callbacks do not accumulate animation drift.
- `href` changes only when the logical frame changes.
- Static, Power saver (4 FPS timer), Balanced (8 FPS timer) and Cinematic (maximum 10 FPS timer) modes.
- Static fallback before DOM readiness and whenever the tab is hidden, reduced motion is enabled, Save Data is enabled, or repeated icon decoding fails.
- Optional truthful states: normal, loading, success, notification and connection error.
- Versioned static fallback, Apple icon, PNG/ICO/PWA assets and Service Worker cache.

## Focused benchmark

| Measurement | Before | After |
| --- | ---: | ---: |
| Prebuilt frames | 8 | 16 |
| Default timer | 167 ms (~6 FPS) | 125 ms (8 FPS) |
| Icon links after 30 route changes | Not instrumented | 1 |
| Favicon timers after repeated `init()` | 1, implicit | 1, asserted |
| Save Data behavior | Continued animation | Static fallback |
| Hidden/reduced motion behavior | Static fallback | Static fallback with phase preserved |
| Per-frame canvas/Blob/Object URL work | None | None (asserted) |
| Duplicate-frame `href` write | Every tick | Skipped |

This is a bounded runtime benchmark, not a claim that browser tab chrome renders at 60 FPS. Browser tab rendering cadence is browser-controlled.

## Automated QA

- `node --check galaxy-favicon-controller.js`: passed.
- `node --check scripts/build-galaxy-favicons.js`: passed.
- `node --test tests/galaxy-brand.test.js`: 7/7 passed.
- Contracts cover one link/one timer, 16 prebuilt frames, readiness, hidden tab, reduced motion, Save Data, four motion modes, state fallback, cleanup and ICO dimensions.

## Browser QA

Tested in the Codex in-app Chromium browser against `http://127.0.0.1:4193/`:

- Static SVG icon rendered before the runtime initialized.
- Dynamic data-URI icon used `#hhDynamicFavicon` with `type=image/svg+xml` and `sizes=any`.
- Guest login and 30 real sidebar route changes completed with exactly one favicon link after every route.
- No favicon route failures.
- No browser console warnings or errors were recorded after the route cycle.

Chrome, Edge, Firefox and Safari were not separately available in this environment, so no claim is made that they were manually tested. Their fallback path remains standard static SVG/PNG/ICO markup and is covered by contracts.

## Asset output

- `favicon.ico`: embedded 16×16, 32×32 and 48×48 PNG images.
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png`.
- `apple-touch-icon.png`: 180×180.
- `icon-192.png`, `icon-512.png` (aliases retained for integrations); the existing manifest continues to use the compatible `pwa-192.png` and `pwa-512.png` paths.
- `hh-galaxy-star-static.svg`: static source/fallback.

The original animated in-page Galaxy logo remains separate and may continue using smooth CSS animation; the tab favicon intentionally stays within a 4–10 FPS work budget.
