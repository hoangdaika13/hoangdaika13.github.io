# Third-party components added to Layer One Workbench

## DOMPurify 3.4.14

- Upstream: https://github.com/cure53/DOMPurify/tree/3.4.14
- Original authors: Mario Heiderich and other contributors.
- Distribution: `vendor/dompurify-3.4.14.min.js`, unmodified official browser build.
- SHA-256: `c2f26ea4fc0d88141c9aa430eb515ac86fce59418ceebd85fa475b87a8d6c3e6`
- License selected for this distribution: Apache-2.0; complete text is in
  `vendor/licenses/DOMPurify-LICENSE.txt`. Upstream also offers MPL-2.0.
- Purpose: sanitize HTML for local Markdown/community previews.
- Size: 29,204 bytes before HTTP compression; no font or media assets included.
- No install scripts were executed and no framework migration was introduced.

The existing QR vendor and JSZip retain their embedded notices and licenses.
This document covers additions in this work, not a complete license inventory
of the historical repository.

## Evaluated, not bundled in this work

WaveSurfer was considered for waveform interaction, but does not itself supply
audio editing/export; the existing waveform and native Web Audio PCM engine
were extended. FFmpeg WASM was not added: a bounded native WebM export path is
provided instead, without claiming arbitrary codecs or MP4 conversion.

Three.js/tsParticles/Anime.js were not layered over the existing homepage GPU
owner. Excalidraw/Phaser/Dexie/Chart.js/Grid.js/ts-fsrs were not installed solely
for decorative changes or to replace already-working engines. Dedicated
Creator and Learning engines continue to own their data and behavior.
