# Legacy campaign verification — release 1063

59 stable game IDs; 1364 mandatory missions across six lazy-loaded content packs. Each mission was completed from a fresh native state through legal controls at normal difficulty. Quick Play uses the original engines.

The focused suite also checks mission constraints, snapshot immutability, deterministic restore, invalid actions, actual misses, mandatory routes, ordered signals, score conditions and schema validation. Human playtime and subjective difficulty have not been measured; automated solver runtime is not an estimate of either.

| Game ID | Model | Missions | Chapters | Proof |
|---|---|---:|---:|---|
| snake | action | 20 | 4 | 20 fresh legal walkthroughs |
| breakout | action | 20 | 4 | 20 fresh legal walkthroughs |
| star-guard | action | 20 | 4 | 20 fresh legal walkthroughs |
| merge | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| mines | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| memory | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| crate-lab | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| block-drop | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| orbit-runner | action | 20 | 4 | 20 fresh legal walkthroughs |
| lights-out | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| slide-tiles | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| peg-solitaire | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| n-queens | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| nonogram | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| towers-hanoi | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| maze-path | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| word-search | learning | 28 | 4 | 28 fresh legal walkthroughs |
| number-order | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| sudoku-mini | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| color-flood | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| pipe-link | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| code-breaker | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| knights-tour | puzzle | 28 | 4 | 28 fresh legal walkthroughs |
| connect-four | board | 28 | 4 | 28 fresh legal walkthroughs |
| tic-tac-toe | board | 28 | 4 | 28 fresh legal walkthroughs |
| reversi-mini | board | 28 | 4 | 28 fresh legal walkthroughs |
| paddle-duel | season | 16 | 4 | 16 fresh legal walkthroughs |
| sky-glider | action | 20 | 4 | 20 fresh legal walkthroughs |
| meteor-dodge | action | 20 | 4 | 20 fresh legal walkthroughs |
| coin-catcher | action | 20 | 4 | 20 fresh legal walkthroughs |
| road-rush | season | 16 | 4 | 16 fresh legal walkthroughs |
| river-cross | action | 20 | 4 | 20 fresh legal walkthroughs |
| asteroid-drift | action | 20 | 4 | 20 fresh legal walkthroughs |
| gravity-flip | action | 20 | 4 | 20 fresh legal walkthroughs |
| ball-balance | action | 20 | 4 | 20 fresh legal walkthroughs |
| jump-tower | action | 20 | 4 | 20 fresh legal walkthroughs |
| laser-dash | action | 20 | 4 | 20 fresh legal walkthroughs |
| orbit-collect | action | 20 | 4 | 20 fresh legal walkthroughs |
| shield-defense | action | 20 | 4 | 20 fresh legal walkthroughs |
| target-range | action | 20 | 4 | 20 fresh legal walkthroughs |
| penalty-kick | season | 16 | 4 | 16 fresh legal walkthroughs |
| mini-golf | season | 16 | 4 | 16 fresh legal walkthroughs |
| basket-shot | season | 16 | 4 | 16 fresh legal walkthroughs |
| simon-sequence | puzzle | 24 | 4 | 24 fresh legal walkthroughs |
| reaction-stop | action | 20 | 4 | 20 fresh legal walkthroughs |
| rhythm-tap | music | 20 | 4 | 20 fresh legal walkthroughs |
| whack-orb | action | 20 | 4 | 20 fresh legal walkthroughs |
| aim-trainer | action | 20 | 4 | 20 fresh legal walkthroughs |
| math-sprint | learning | 24 | 4 | 24 fresh legal walkthroughs |
| color-word | learning | 24 | 4 | 24 fresh legal walkthroughs |
| odd-one-out | puzzle | 24 | 4 | 24 fresh legal walkthroughs |
| pattern-recall | puzzle | 24 | 4 | 24 fresh legal walkthroughs |
| treasure-grid | puzzle | 24 | 4 | 24 fresh legal walkthroughs |
| lock-timing | action | 20 | 4 | 20 fresh legal walkthroughs |
| stack-tower | action | 20 | 4 | 20 fresh legal walkthroughs |
| constellation-trace | puzzle | 24 | 4 | 24 fresh legal walkthroughs |
| pixel-painter | creative | 20 | 4 | 20 fresh legal walkthroughs |
| garden-care | creative | 20 | 4 | 20 fresh legal walkthroughs |
| cafe-orders | creative | 20 | 4 | 20 fresh legal walkthroughs |

Validation: `node --test tests/all-game-arcade.test.js tests/all-game-adventure.test.js tests/all-game-puzzles.test.js tests/all-game-pack-arcade.test.js tests/all-game-pack-puzzles.test.js tests/all-game-pack-casual.test.js tests/all-game-campaign-legacy.test.js`.

The final run passes 265/265 tests, including 69 focused campaign checks. Serve/aim states in Pong, Golf, Basketball and Breakout suspend idle frames, then request frames after a legal launch. Cooldowns and the final golf stroke are adjudicated before suspension; games with required keeper motion, drift, hazards or passive timers retain frames.

Two issues found by full mission replay were corrected: campaign Pong bumpers preserve rally energy instead of decaying to a near-static ball; the final Gravity Flip region provides enough geometric transition distance around its central obstacle. Quick Play merge undo also retains its exact original object shape when no campaign tile supply exists.

Detailed mechanics, renderer declarations and proof mapping are in `ALL_GAME_CAMPAIGN_LEGACY_1063.json`. Browser visuals, host persistence and full-shell accessibility are verified by the parent integration suite, separately from these engine walkthroughs.
