# Architecture Audit

## Current stack

- Static GitHub Pages frontend: HTML, CSS and vanilla JavaScript.
- Vercel serverless API with MongoDB, JWT and bcrypt.
- Socket.io realtime service for chat.
- Module registry: `data/ai-super-platform-modules.json` loaded by `config/modules.config.js`.

## Existing surfaces

- Public portfolio: profile, projects, contact, music and visitor feedback.
- Auth gate: local registration/login backed by Vercel.
- Platform registry: core and extended modules rendered in `#moduleGrid`.
- Dedicated project tools: AI script, voice studio and piano.
- Realtime community chat.

## UI risks found

- The platform currently renders a large collection of modules at once.
- Navigation is split between portfolio anchors, platform filters and per-module controls.
- CSS is feature-rich but has accumulated large append-only sections.
- Module functionality must be preserved while navigation is migrated.

## Migration guardrails

- Keep the existing runtime, API paths, auth and module registry.
- Add an App Shell before changing individual tool behavior.
- Use hash routes so GitHub Pages remains compatible.
- Mount existing platform content into the App Shell workspace during transition.
- Keep the portfolio reachable from `#/profile` while the dashboard is the logged-in default.
