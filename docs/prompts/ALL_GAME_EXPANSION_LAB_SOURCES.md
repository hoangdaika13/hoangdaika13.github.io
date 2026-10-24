# Lab expansion: source and model notes

Implementation and SVG/oscillator scores are original, dependency-free work. No upstream game code, images, sound samples, fonts or music files were copied. These repositories were read for architecture/mechanics on 2026-10-23:

- boardgame.io: README, LICENSE (MIT), src/core/flow.ts and player-view.ts. Move/state, turn phases and per-player information.
- cwilso/metronome: README, LICENSE.txt (MIT), js/metronome.js. Look-ahead audio scheduling. Engines only emit JSON voice events; host owns Web Audio.
- liabru/matter-js: README, LICENSE (MIT), examples/slingshot.js. Constraint/torque vocabulary and collision examples; no engine dependency imported.
- OpenTTD/OpenTTD: README, COPYING.md (GPL version 2), src/economy.cpp. Transportation/economy design only; no GPL code copied/ported. OpenGFX/OpenSFX/OpenMSX and original TTD media have separate rights and were not used.
- ncase/trust: README, LICENSE (CC0), js/sims/PD.js and Iterated.js. Iterated payoff/tutorial design only. README identifies CC BY-NC and CC Sampling+ sound exceptions; no media or bundled libraries copied.
- jakesgordon/javascript-pong: README, LICENSE (MIT), pong.js. AI reaction/error and spin concepts; no code/media copied.

Source links: https://github.com/boardgameio/boardgame.io ; https://github.com/cwilso/metronome ; https://github.com/liabru/matter-js ; https://github.com/OpenTTD/OpenTTD ; https://github.com/ncase/trust ; https://github.com/jakesgordon/javascript-pong

Scientific models are explicitly simplified game models: reaction reagents A/B/X are fictional; clinic cues are fictional game care sequences; optics uses paraxial thin lenses; orbit uses a two-body point-mass potential and finite impulse maneuvers; thermal nodes use conserved energy and a latent-heat interval. Genetics samples Mendelian alleles with seeded RNG and distinguishes sample ratios from theoretical probabilities. These models do not claim engineering certification, medical diagnosis or exact physical simulation.

Audio descriptor contract: `{clock,running,revision,lookahead:0.12,voices:[{key,time,freq,gain,kind,duration,pan}]}`. `transport` is the game's listening control; host additionally gates actual session pause/start/mute. Music accepts monotonic `action.elapsed` while physics uses the core's bounded step. No engine creates AudioNodes, timers, RAF, workers or DOM listeners.

Verification: `node --test tests/all-game-exp-lab.test.js` includes fresh-state legal completions for all 35 games and all three mandatory puzzle/music/science missions, resource/conservation tests, invalid-case checks and immutable JSON states. `scripts/all-game-exp-lab-checks.js` supplies 35 browser input recipes; the shared browser runner owns viewport/screenshot/lifecycle validation. Browser recipes themselves do not claim whole-campaign manual play or physical mobile testing.
