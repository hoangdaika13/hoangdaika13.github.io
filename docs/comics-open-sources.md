# HH Comics · GitHub Open Library

Catalog snapshot: 2026-08-08. Images are streamed from `raw.githubusercontent.com`; HH does not mirror the page binaries.

| Series | Repository | License | Chapters | Story pages |
| --- | --- | --- | ---: | ---: |
| Pepper & Carrot | [ollm/OpenComic](https://github.com/ollm/OpenComic/tree/master/Pepper%20%26%20Carrot) | CC BY 4.0; David Revoy attribution retained | 2 | 11 |
| God's World | [TheLemmaLlama/God-s-World](https://github.com/TheLemmaLlama/God-s-World) | Unlicense | 1 | 105 |
| Back in This World as Myself | [TheLemmaLlama/bitwam-Back-in-this-world-as-myself](https://github.com/TheLemmaLlama/bitwam-Back-in-this-world-as-myself) | CC0 1.0 | 3 | 335 |
| Tlatoāni Tales | [8007342/tlatoani-tales](https://github.com/8007342/tlatoani-tales) | CC BY-SA 4.0 for artwork | 1 | 1 |

Total: 4 series, 7 chapters and 452 story pages.

The manifest intentionally excludes third-party fan-art directories and files marked as collectables, cameos or bonus artwork. Repository source, license URL, attribution and content rating remain attached to every series record in `comic-open-source-catalog.js`.

## TruyenDex / MangaDex provider

The [zennomi/truyendex](https://github.com/zennomi/truyendex) repository is used as an architectural reference only. It does not contain a redistributable comic archive and does not declare a repository license; its README states that comic metadata and pages come from MangaDex and are not stored by TruyenDex.

HH Comics therefore uses a newly written same-origin MangaDex adapter. It requests Vietnamese chapters with `safe` or `suggestive` ratings, keeps scanlation-group attribution, asks MangaDex@Home for port-443 data-saver pages only when a chapter is opened, and never stores the image binaries on HH servers.
