# HH Platform Home & Text on Image Studio — release 979

## Routes and ownership

- `/platform` is the Layer Two homepage. The HH CORE button grants the existing tab-scoped access and opens this route.
- `/home` and the twelve-route Galaxy allowlist are unchanged. Leaving HH CORE revokes the grant before returning to `/home`.
- `/create` remains the independent Creative workspace. Brand, breadcrumb, primary sidebar, mobile Home and Alt+H use the new entry route.
- Galaxy Shell resolves blocked deep links before applying layout, preventing a hidden Gateway when its router rejects `/platform`.

## Homepage

`platform-home.js` / `platform-home.css` are loaded only for `/platform`.
The catalog is generated from `navigationSections`, `groups`, their pages/studio items and existing module metadata. DEV and Music include their full child registries. Counts are computed, not hard-coded.

The six categories currently contain 32 entries. Ordinary accounts see an explanatory locked Admin card, while the shared sidebar counts only the 31 accessible tools. No Admin action or child link is exposed without verified access.

The homepage includes a CSS-based cosmic hero, six category portals, local command center, searchable/filterable cards with expandable child links, seven suggested journeys, privacy explanation and existing account-scoped favorites/pins/recents. It reads only Creative OS project display metadata, never Layer One storage, and makes no provider requests or analytics writes.

Provider-dependent capabilities are explicitly described as unverified or requiring connection; browser online status does not imply backend readiness. Original workspace stores and unrelated files are preserved.

## Text on Image Studio

- Picking a solid color disables auto-contrast and gradient, the two features that previously masked the chosen color.
- Explicit Solid / Auto contrast / Two-color gradient selection makes paint precedence visible. Color picker, HEX input and eight swatches stay synchronized without replacing the editing control.
- Global edits clear only the edited properties from per-image overrides. Individual AI text, positions and other settings are retained. Current-image edits remain isolated.
- Undo/redo now restores the complete per-image override tuple instead of incorrectly treating the override object as an array.
- Text, font, size and paint controls precede optional layer/AI panels. Larger labels, readable inputs, roomier export controls and a collapsible library preserve canvas space. Phone inspectors have a sticky close control.

## Verification

- Syntax: `script.js`, `platform-home.js`, `galaxy-shell.js`, `hh-core-gateway.js`, `galaxy-home-ai.js`, `performance-loader.js`, `image-text-studio.js`, `sw.js`.
- Focused Node suite: 324 passing tests across homepage, HH CORE, all Galaxy tests, dynamic navigation, release consistency, runtime boundary and image-text suites.
- Browser: HH CORE → `/platform`; new Home and brand links; explicit exit; locked deep-link recovery; Creative route remains distinct; 32 cards; child-tool search; five-item Learning filter; favorites/pins round trip; four-step language journey.
- Responsive checks at 390, 768, 1024 and 1440px; no document horizontal overflow observed. Native keyboard search and explicit mobile sheet controls are preserved.
- Real PNG export: existing public HH brand asset, chosen text `#FF5378`, output 1280×720. Image inspection and pixel counting confirmed 6,571 exact `(255,83,120)` pixels in the exported file. Preview showed the same selected color.
- Unit coverage: global/current color changes, auto/gradient precedence, invalid HEX, retained AI text, undo/redo, and shared text renderer at 1280/1920/3840 widths.

## Existing full-suite limitations

The unrelated full repository suite has six failures in unchanged areas:

1. Four Fortune test files cannot resolve the locally missing `astronomy-engine` dependency.
2. `comic-motion-rights-admin.test.js` reports a catalog-evidence SHA-256 mismatch.
3. `hh-eonwild-assets.test.js` reports the glTF loader checksum mismatch.

Their owning tests, implementation and asset inputs were not changed by this release. No checksum policy was weakened and no unrelated dependencies or assets were modified to hide these failures.
