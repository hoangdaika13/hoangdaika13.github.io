# Rubik visualization runtime

This browser bundle exposes `TwistyPlayer`, `puzzles` and `Alg` from cubing.js 0.66.1. esbuild bundles and chunks the published ESM distribution without changing its behavior. The three.js 0.170.0 rendering bundle is loaded only for the puzzles that use it.

- cubing.js source for this release: <https://github.com/cubing/cubing.js/tree/8544249ff1e662557df912065a26b5f90f4df574>
- Published distribution: <https://registry.npmjs.org/cubing/-/cubing-0.66.1.tgz>
- Distribution terms: [MPL 2.0](LICENSE-cubing-MPL.md) for cubing.js and [MIT](LICENSE-three.txt) for three.js.

To reproduce, install pinned `cubing@0.66.1`, `three@0.170.0` and esbuild in a temporary folder. Create an entry that re-exports `TwistyPlayer` from `cubing/twisty`, `puzzles` from `cubing/puzzles` and `Alg` from `cubing/alg`. Build with `--bundle --format=esm --splitting --minify --legal-comments=external --target=es2022 --out-extension:.js=.mjs --entry-names=special --chunk-names=chunks/[name]-[hash]`.
