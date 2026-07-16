# HH Platform Engineering Guide

## Architecture

- `index.html` is the application shell and asset manifest.
- `script.js` owns authentication state, hash routing, primary navigation, and legacy module mounting.
- Feature workspaces live in dedicated `*.js` and `*.css` files and expose a small global mount API.
- `english-curriculum.js` owns original A1-C2 course data; `english-career-expansion.js` owns shared field vocabulary and expanded profession metadata; `english-career-curriculum.js` compiles profession-specific paths; `english-learning.js` owns the renderer, Smart Start onboarding, and deterministic local learning-plan engine.
- Serverless endpoints live in `api/`; persistent Socket.io services live in `realtime-server/`.
- User-facing local-first state must be versioned and stored under an `hh.*` localStorage key.

## Conventions

- Keep source files UTF-8 and avoid broad formatting changes in legacy files.
- Escape user-provided strings before inserting HTML.
- Prefer semantic controls, visible focus states, and keyboard-operable interactions.
- Do not place secrets, service-role keys, passwords, or private tokens in client code.
- Browser-only capabilities must provide a clear unsupported/error state.
- Educational content is data, not one hard-coded page per lesson.
- Every HH English level remains selectable; placement results are recommendations rather than hard locks.
- HH English smart recommendations must explain their inputs and must not claim external AI when they are computed locally.
- Career English adaptation must remain deterministic: role stage, skill focus, intensity, saved words, and review due dates may change the word kit, dialogue, and exercises without changing the stable lesson ID.

## Commands

- `node --check <file.js>` checks JavaScript syntax.
- `npm run test:space` checks ASTRA HH contracts.
- `npm run test:community` checks Community contracts.
- `node --test tests/english-learning.test.js` checks CEFR and Career English content plus learning logic.

## Definition Of Done

- The feature is reachable from the primary sidebar and command search.
- Core controls perform real work and persist the expected state.
- Desktop and 375px layouts are usable without horizontal overflow.
- Keyboard focus is visible and reduced-motion preferences are respected.
- Syntax checks, contract tests, and focused feature tests pass.
- No secrets or unrelated user changes are committed.
