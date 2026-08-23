# HH Play realtime

HH Play keeps all rooms local until an authenticated Socket.IO connection is
confirmed. The realtime adapter is registered by
`realtime-server/src/play-realtime.js` and uses these events:

- `play:room:create` — authenticated host creates a room.
- `play:room:join` — authenticated member joins with the invite code.
- `play:room:leave` — leaves the current room.
- `play:room:state` — host-only authoritative state update.
- `play:room:event` — bounded gameplay/watch event.
- `play:room:presence` — server-confirmed member list.

Room discovery is disabled. Guests cannot create or join a room, and a private
room cannot be joined by a second member. Current persistence is memory-only;
the UI labels this explicitly and never presents it as durable or public data.

Set `MAX_PLAY_ROOMS` and `MAX_PLAY_MEMBERS` in the realtime server environment.
The server must use the same `JWT_SECRET` as the authenticated frontend and be
served through HTTPS/WSS in production. Do not put secrets in `hh-play.js` or
the browser configuration.

Rhythm attempts to load `hh-play-audio-worklet.js` for lower-latency audio. If
the browser blocks AudioWorklet, the existing Web Audio scheduler remains the
truthful fallback; no capability is reported as active until loading succeeds.
