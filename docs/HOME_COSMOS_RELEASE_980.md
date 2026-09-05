# Home Cosmos — release 980

Both homepage owners mount independent instances of `HHHomeCosmosMotion`.
The shared module is presentation-only: no storage reads, requests, account
access or navigation mutations. `/home`, `/platform`, HH CORE and all feature
destinations retain their previous ownership.

## Visual changes

- Real depth-projected WebGL star fields and rotating colored particle disks.
- Three CSS-3D gyroscopic rings with luminous satellites, layered nebulae,
  slowly drifting stars and intermittent comets.
- Layer One: animated textured planets/coronas and stellar core; richer local
  status panels. Layer Two: holographic core, floating category portals,
  iridescent card edges and floating icons throughout the homepage.
- Desktop pointer parallax changes depth, not navigation coordinates. Touch
  and reduced-motion modes keep the interface stable.

## Safety and performance

- Each page has an explicit pause/resume control.
- System reduced-motion and forced colors are respected, together with the
  existing owner preferences. No settings or preferences are overwritten.
- Bounded 500/1700/2600 particles, 24/30/50 FPS draw budgets, DPR cap 1.5 and
  a maximum approximately 1.8-million-pixel render buffer.
- One RAF per live GPU instance; CSS fallback has no JS animation loop.
- Hidden/offscreen scenes pause; offscreen cards pause their local animations.
- Route cleanup removes listeners/observers and releases shaders, buffers,
  programs and the GPU context. Context loss falls back and restores safely.

## Verification

330 focused tests passed: new lifecycle/particle tests, all Galaxy tests,
Platform Home, HH CORE, navigation, cache release consistency, runtime
boundary and Text on Image regression suites.

Browser checks: both homepage instances reported WebGL, one decorative canvas
at a time, all three ring animations running, and correct explicit pause/resume.
HH CORE navigation and the 32-entry Platform catalog remained intact.
Desktop and 390px visual QA showed zero document horizontal overflow; no
console errors were recorded during the check.
