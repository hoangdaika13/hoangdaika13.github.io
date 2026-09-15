# HH Chinese Cosmic Creative Studio release 1014

## Outcome

HH Chinese now uses the same neon-cosmic visual language as HH Platform while
remaining inside the canonical `/platform` shell and preserving the existing
`/chinese` routes, account-scoped state and learning workflows.

## Shipped scope

- Replaced the heritage brown surface with a deep-space glass system using cyan,
  ultraviolet and pink accents.
- Unified top bars, navigation, cards, workspaces, overlays, progress panels,
  form controls and action bars with consistent borders, glow and contrast.
- Restyled the curriculum coverage, Vietnamese pronunciation, translation and
  writing feedback panels without changing their honest local-only behaviour.
- Restored a visible layered star field and lightweight halo/sweep motion while
  keeping decorative layers non-interactive.
- Added stronger keyboard focus states, readable disabled states and mobile-safe
  spacing without introducing a global scroll lock or a second page scrollbar.
- Kept reduced-motion support and the existing writing/reading canvas fallback.

## Capability boundaries

- No external code, images, fonts or media assets were added.
- Existing browser speech, local assessment and CVDICT limitations remain as
  documented in `assets/chinese/NOTICE.md` and the curriculum release note.

## Verification

Focused HH Chinese, learning cockpit, navigation and release-consistency tests
were run after the v15 asset/cache bump. Browser checks cover desktop and 375px
layouts, keyboard focus, mobile overflow and the existing Vietnamese learning
labs.
