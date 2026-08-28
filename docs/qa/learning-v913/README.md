# Learning release v913 · QA evidence

Validated locally on 2026-08-28 against `http://127.0.0.1:4193/`.

## Automated verification

- Full repository suite: 2,259/2,259 passed.
- Security suite: 100/100 passed.
- HH Japanese regression suite: 29/29 passed.
- `git diff --check`: passed.

## Responsive browser verification

| Surface | Desktop 1440×1000 | Mobile 375×812 | Tablet 768×1024 |
| --- | --- | --- | --- |
| HH English | No document-level horizontal overflow; main scroll reached the end | No document-level horizontal overflow; main scroll reached the end | No document-level horizontal overflow |
| HH Japanese | 11-room navigation is a labelled horizontal strip; no document-level horizontal overflow | App content fits the viewport; main scroll reached the end | Compact layout activated; `#appMain` client width and scroll width both measured 490px |
| HH Chinese | No document-level horizontal overflow | Horizontal learning-track carousel remains intentional; main scroll reached the end | No document-level horizontal overflow; main scroll reached the end |
| Phật Pháp | Workspace scroll reached the end | Workspace scroll reached the end; no document-level horizontal overflow | Workspace scroll reached the end; no visible content overflow |

## Screenshots

- `english-desktop.jpg`, `english-mobile.jpg`
- `japanese-desktop.jpg`, `japanese-mobile.jpg`
- `chinese-desktop.jpg`, `chinese-mobile.jpg`
- `dharma-desktop.jpg`, `dharma-mobile.jpg`

## Scope notes

- Browser QA used the local guest profile and device-local learning data.
- Microphone, speech-recognition permission prompts, real audio playback and signed-in cross-device sync were not exercised during this pass.
- Reduced-motion support and version/cache contracts are covered by automated source-contract tests; no claim is made for physical-device testing.
