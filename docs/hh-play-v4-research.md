# HH Play v4 — open-source research notes

The release applies architecture and product patterns from primary project documentation. It does not copy source code, assets or game content from these projects.

| Source | License / scope checked | Pattern applied to HH Play |
| --- | --- | --- |
| [Phaser](https://github.com/phaserjs/phaser) and [official examples](https://github.com/phaserjs/examples) | Engine and example code are MIT; example assets have separate restrictions. No code or asset was imported. | Small self-contained game cartridges and a data-driven example catalog. |
| [Playnite](https://github.com/JosefNemec/Playnite) | MIT application; no code imported. | Unified library, local metadata, favorites and recent activity. |
| [boardgame.io](https://github.com/boardgameio/boardgame.io) | MIT; no dependency or code imported. | Separate local play from server-authoritative multiplayer and never present local rooms as verified online presence. |
| [GDevelop](https://github.com/4ian/GDevelop) | MIT engine/editor areas described by the project; no code or asset imported. | Modular behaviors, reusable metadata and extensible game families. |
| [PlayCanvas Engine](https://github.com/playcanvas/engine) | MIT; no dependency or code imported. | Keep future WebGL/WebGPU games optional and preserve lightweight browser fallbacks. |
| [js13kGames resources](https://github.com/js13kGames/resources) | Resource index with per-project licensing; no linked asset imported. | Favor small offline-capable interactions with bounded runtime state. |
| [Google web.dev PWA checklist](https://web.dev/articles/pwa-checklist) | Public technical guidance. | Preserve a useful offline/local-first path and communicate network limitations clearly. |
| [W3C Gamepad](https://www.w3.org/TR/gamepad/) | Web standard. | Keep actions device-independent and compatible with the standard button/axis model. |

Any future external game or asset import must be reviewed separately for source, author, exact license, attribution requirements and browser security before entering the catalog.
