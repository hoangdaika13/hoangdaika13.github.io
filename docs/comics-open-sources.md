# HH Comics · GitHub Open Library

Catalog snapshot: 2026-08-08. Images are streamed from `raw.githubusercontent.com`; HH does not mirror the page binaries.

| Series | Repository | License | Chapters | Story pages |
| --- | --- | --- | ---: | ---: |
| Pepper & Carrot | [ollm/OpenComic](https://github.com/ollm/OpenComic/tree/master/Pepper%20%26%20Carrot) | CC BY 4.0; David Revoy attribution retained | 2 | 11 |
| God's World | [TheLemmaLlama/God-s-World](https://github.com/TheLemmaLlama/God-s-World) | Unlicense | 1 | 105 |

Total: 2 series, 3 chapters and 116 story pages.

The manifest intentionally excludes third-party fan-art directories and files marked as collectables, cameos or bonus artwork. Repository source, license URL, attribution and content rating remain attached to every series record in `comic-open-source-catalog.js`.

## TruyenDex / MangaDex provider

The [zennomi/truyendex](https://github.com/zennomi/truyendex) repository is used as an architectural reference only. It does not contain a redistributable comic archive and does not declare a repository license; its README states that comic metadata and pages come from MangaDex and are not stored by TruyenDex.

HH Comics therefore uses a newly written same-origin MangaDex adapter. It requests Vietnamese chapters with `safe` or `suggestive` ratings, keeps scanlation-group attribution, asks MangaDex@Home for port-443 data-saver pages only when a chapter is opened, and never stores the image binaries on HH servers.

## OTruyen backend provider

The browser no longer calls the OTruyen catalog directly. HH's same-origin backend validates page, search, genre, status and sort parameters, applies rate limiting and forwards bounded requests to the upstream catalog. The UI exposes every available page through first/previous/next/last controls and a direct page-number input; chapter images remain on-demand.
