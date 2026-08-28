# YouTube playback continuity · v917

## Changes

- Fixed the telemetry throttle alias so iframe messages no longer recurse through the scheduler.
- Updated telemetry controls in place instead of replacing their HTML every tick. This avoids mutation-observer work and layout churn while a video is decoding.
- Ignored telemetry-only mutations in the Pro enhancer and coalesced meaningful enhancements into one animation frame.
- Kept the active YouTube iframe stable when the queue/current-video indicator changes; only the small queue summary and active row are updated.
- Deferred the initial playback-rate command until the iframe is ready, while retaining the ready callback as the authoritative rate sync.
- Changed the decorative player meter to compositor-only transforms and paused only the ambient nebula repaint while playback is active. No feature, saved data, asset or player control is removed.
- Bumped route and Service Worker asset versions so deployed clients do not reuse the previous bundle.

## Verification

- `node --check youtube-playback-core.js`
- `node --check youtube-hub.js`
- `node --check youtube-hub-pro.js`
- Focused YouTube/search contract tests: passed.
- Full repository test suite: run before release; YouTube CDN selection, ads, codec choice, browser decode and network quality remain outside the application boundary.

## Limitation

The site cannot guarantee that every network or YouTube CDN will never buffer. It now avoids application-induced iframe reloads, layout churn, telemetry recursion and unnecessary animation work; a remaining stall caused by YouTube, an ad, the browser decoder or the user's connection is outside the website's control.
