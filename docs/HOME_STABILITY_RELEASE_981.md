# Release 981 — stable Galaxy navigation and independent Platform scrolling

## Root causes

Layer One previously entered `/home` through `HHGalaxyHomeAI`'s standalone
chrome, but other Galaxy routes used `HHGalaxyLayerOne`. Returning Home inside
that persistent owner produced a second arrangement and duplicate hero/rail.
Home now mounts inside the same Layer One owner from the first load. Its header,
sidebar and route links stay connected while only the content outlet changes.

Platform Home previously relied on `.app-main` for scrolling while its own root
used `overflow: clip`. Editor/fullscreen/dashboard overflow rules could leave
the visible homepage without a scrollable viewport. The root now owns a bounded
vertical scrolling region sized to the viewport or fullscreen ancestor, with
resize/fullscreen listeners and observer cleanup. Section jumps use that root.

## Changes

- Constant 288px desktop navigation and a full-width Galaxy header following
  the supplied reference: HH brand, search, twelve fixed route links, customize
  and profile. Phone navigation uses the existing accessible drawer and dock.
- Home delegates only the map, without an extra introduction or right rail.
- Explicit embedded map height prevents inherited percentage-height collapse.
- Color-coded stable icons, slow illumination across chrome, satellites and
  staggered energy waves. Decorative layers do not capture pointer events.
- Readable compact statistics instead of extremely narrow icon/text columns.
- Existing routes, HH CORE grant, per-layer data and studio logic are preserved.
- Cache and loader versions advanced for the changed resources.

## Verification

334 focused Node tests passed, covering all Galaxy tests, gateway, homepage,
motion lifecycle, stable chrome, viewport contract, navigation, release
consistency and Text on Image regressions.

Live desktop check at 1280×720:

- Home → AI Universe → Music Planet → Home retained header rectangle
  `(15,7,1250,68)` and sidebar rectangle `(0,76,288,644)`.
- Restored map rectangle stayed `(288,76,992,644)`.
- Platform root measured 578px high with 7004px scrollable content.
- Actual wheel input advanced the inner scrollbar to 1440px and 2880px while
  outer `.app-main` stayed at 0.
- The Text on Image Studio → Platform Home round trip still allowed a 1440px
  wheel scroll. At 390×844, both layers had zero horizontal overflow; the
  Platform scroll viewport was 654px high and the Galaxy map retained its
  1280px mobile content height inside the fixed frame.

The four unrelated untracked user images are not part of this release.
