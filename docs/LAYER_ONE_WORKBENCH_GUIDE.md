# Layer One Workbench — usage and test setup

## Local tools

**Music:** Import one or more audio files. Set Start/End in the existing trim
form, adjust gain/fades in Workbench, and choose preview or WAV export.
Mix requires 2–8 checked tracks. WAV output is 16-bit PCM; tracks align at time
zero. Source media is not overwritten. Decode is capped at 64 MB input per
track and 24 million samples/channel; total mix PCM is bounded separately.
The worker performs sample processing away from the UI. Reopen saved sources
with the source card or explicitly restore the saved playlist.

**Video:** Import a local video. Paste/edit SRT or VTT in Workbench and choose
Apply or export. For native WebM export, choose a range or join up to four
session videos, optionally add text, and keep the tab visible. Export is in
real time, limited to 120 seconds, 1280×720, and supported WebM codecs only.
Use Cancel to stop. No arbitrary MP4 conversion is promised. The clip list
allows reordering; save a project to retain trim/text settings and source IDs,
then explicitly restore it after reload. Missing sources are reported, not
silently replaced. Creator text handoffs append to a chosen step after
confirmation without marking that step complete.

**Documents/prompts/snippets:** Local item cards expose edit, favorite and JSON
export. Edit supports folder/tags and preserves IDs/routes. Snippet storage is
explicitly limited to 16,000 characters; larger editor content must be exported
instead of silently truncated. Prompt templates use `{{variable}}` with a JSON
object of values; missing values are reported before apply. Imported text is
appended to a prompt only through an explicit action and must fit the composer.

**Tools:** Process input first, then copy or download the resulting text/HTML/
SVG. Editing the input invalidates the prior result. Example data is labeled.
QR uses UTF-8 and the shared QR encoder is restored after each generation.

**Learning:** The mistake notebook derives entries from wrong quiz answers.
It is blocked while a quiz is active to avoid showing answer keys early.

**Creator:** Work in a user project, not a read-only sample. Image/thumbnail
steps export a real PNG canvas; text steps export Markdown; production ZIP
contains project JSON, nine step files, README and manifest. Voice/music/video
controls operate on local inputs. Binary inputs in those production controls
are session-only: download the results and select inputs again after reload.
Text handoff appends to the chosen step after confirmation and does not change
its completion status.

## Backend configuration — do not paste secrets into chat or commit them

Use a dedicated test database and test accounts, not production records.
Configure the existing server runtime through environment management:

- `MONGODB_URI`: test MongoDB connection.
- `MONGODB_DB`: isolated test database name.
- `JWT_SECRET`: existing auth-compatible secret, at least 32 characters.
- `GEMINI_API_KEY` / supported key list: provider credential on the server.
- `GEMINI_MODEL`: model available to that provider account.
- Existing trusted-origin/CORS and auth setup must remain intact.

`/api/ai` already rewrites to the existing tool gateway. Layer One reuses its
authenticated server adapter, not a client API key. Context is bounded and
every successful provider result is stored locally; timeouts are not retried
automatically. Stopping the client request does not guarantee cancellation of
a provider job already accepted on the server.

The new endpoint is `/api/community?galaxy=1`, with data isolated in
`hhGalaxyLayerOnePosts` and `hhGalaxyLayerOneComments`. It uses the existing
`currentUser`, trusted mutation checks, rate limiter and 40 KB body cap.
API operations cover public/private post listing, idempotent create, owner-only
versioned edit/delete, comments and idempotent reactions. Group membership,
events, moderation workflows and realtime socket fanout are not implemented by
this endpoint. Optional refresh is polling and is labeled as such.

## Acceptance commands

```powershell
node --test tests/galaxy-workbench-core.test.js tests/galaxy-community-service.test.js
node --test tests/galaxy-*.test.js tests/home-*.test.js tests/platform-home.test.js tests/hh-core-gateway.test.js tests/release-consistency.test.js
```

For online acceptance, configure the isolated backend, sign in as two distinct
test users and verify private/public visibility, owner checks, version
conflicts and idempotent replay over HTTP. A memory-DB service test is not a
substitute for this deployment test. The user subsequently authorized a
commit/push of this reviewed implementation checkpoint. Online acceptance and
the remaining limitations are still documented in the functional audit.
