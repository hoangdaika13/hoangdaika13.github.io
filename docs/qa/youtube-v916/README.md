# YouTube startup smoothness · v916

## Changes

- Added route-level DNS hints and route-only `preconnect` warm-up for `youtube-nocookie.com` and `i.ytimg.com`.
- Added `fetchpriority="high"` and a stable player id to the YouTube iframe.
- Fixed the YouTube IFrame API handshake: `listening` is now sent as an IFrame event instead of an invalid command message.
- Kept the search/result DOM intact when switching videos, so existing cards and thumbnails are not recreated during iframe startup.
- Stopped automatic `seekTo`/`playVideo` retries during normal startup buffering. YouTube's adaptive player keeps control of initial bitrate and buffer decisions; retry remains available for explicit transient player errors or a confirmed later stall.
- Reduced telemetry traffic before playback progress to current time, duration and loaded fraction; secondary metadata is requested only after playback has begun.

## Verification

- `node --check youtube-playback-core.js`
- `node --check youtube-hub.js`
- `node --check youtube-hub-pro.js`
- Focused YouTube/search contract tests: all passed.
- Full repository test suite: run before release; external YouTube CDN, ads, codec choice and network quality remain outside the application boundary.

## Limitations

No web application can guarantee zero startup buffering: the selected video's CDN, browser autoplay policy, device decode capability and the user's network can still affect first-frame latency. The player is kept on the official YouTube embed path; no proxy or re-hosting is used.
