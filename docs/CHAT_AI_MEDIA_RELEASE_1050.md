# Chat AI — opt-in image/video workspace, release 1050

## Features

- Distinct **Tạo ảnh**, **Tạo video**, **Phân tích tệp** modes. `/image` now generates images instead of accidentally routing to vision; `/video` opens video creation. Existing chat/research/code/write/study behavior remains.
- Image prompt + five optional style choices, seven aspect ratios, 1K/2K output intent and up to two PNG/JPEG/WebP references (each uses existing file-size limits). Raster signatures, permissions and cost acknowledgement are checked before submission.
- Inline review requires cost + content/reference-rights acknowledgement. Video uses existing server estimates, expiring quote ID and idempotent creation; neither clicking a mode nor pressing Enter immediately runs a paid generation.
- Result cards expose real backend status, opt-in image/video Blob preview, controlled playback without autoplay, downloads, prompt reuse and explicit status checking. Cancel remains a request until the video adapter acknowledges it.
- Image jobs/results are owned by authenticated account, unique by owner + request key, expire after **7 days**, and return raster bytes only through an owned proxy. Local chat history saves opaque job metadata, not image bytes, reference files, Blob URLs, provider output URLs or credentials.
- Reload/rejoin can reopen results and inspect unfinished image requests by idempotency key. An unacknowledged video submit can explicitly continue the **same** quote/request key, not create an automatic paid retry.
- Poll only the current conversation, max three active jobs every 20 seconds; skip hidden tabs. Unmount aborts fetches, removes timers and revokes Blob URLs. Client limits previews/downloads to **40 MB** with bounded streaming; larger output uses the existing Studio workflow.

## Existing infrastructure/policy reused

Images use the current Gemini Images adapter and `GEMINI_IMAGE_MODEL`; the new Chat path selects **one key / one attempt**, never rotates a potentially paid submission after failure. Existing music/design callers keep their old behavior. Chat images reuse the existing **Admin paid-image permission and shared 12 requests/hour ceiling**; this release does not grant guest/regular-user paid access or raise budgets.

Videos use `/api/ai-video-remake`: configured Veo/worker declarations, quote fingerprint/expiry, billing allowlist/Owner policy, daily quotas, owner-scoped status and authenticated output proxy are unchanged. Backend capabilities, not invented choices, constrain direct-Veo dimensions/durations/resolutions. Chat currently supports **text-to-video**; source-video remix and character replacement remain in AI Video Remake Studio.

No new serverless function, provider account, dependency or secret. The twelve-function Vercel limit is preserved. HH Platform/App Shell, login and routes are untouched by this commit. The separately pending Facebook Login changes are intentionally **not included**.

## Truthful failure/limits

- Provider timeout/refusal/invalid output is never presented as a generated image or substituted with local text pretending to be media. Ambiguous image submission is persisted; no silent regeneration.
- Image price is not fabricated. The UI explicitly states no image unit price is configured and requires acknowledgement; video displays server estimate only when configured.
- A configured model/key is not proof of billing/quota or provider availability. This release does not claim unlimited/free generation or public paid access for everyone.
- Private/incognito chat refuses persistent media creation and explains that backend jobs are stored. Image/reference input limits and generated-output transport limits are explicit.
- Expired server output is not resurrected by local history. Download original results while available. Chat JSON export preserves metadata, not an offline copy of generated assets.

## Verification

2026-10-12 local verification:

- Syntax checks for changed client/backend/media/loader/worker/QA files and `git diff --check`.
- **100/100 targeted tests**: Chat AI + media ownership/idempotency/consent/expiry/raster validation, existing Music AI, AI Center, AI Video contracts, security and release/cache consistency.
- **16/16 browser probes** in `scripts/qa-chat-ai-media.js`: 375/768/1440px, cost/rights refusal, image result/view/download, scoped history + reload, real quote contract submission, opt-in video transport, cross-account state, ambiguous provider state, unavailable capabilities, reference image/slash commands and cleanup. No page JavaScript errors. Output/screenshot artifacts stay Git-ignored under `.study-local/chat-ai-media-qa`.
- The image shown in browser QA is a **1px PNG fixture**, not an AI-generated image. Video preview uses a transport double, **not successful playback evidence**. Tests run real application code with explicit provider/database doubles. **No live paid Gemini/Veo call was made**; WAN generation, quota and billing are not verified.

## Primary references

Read official Google documentation on 2026-10-12:

- <https://ai.google.dev/gemini-api/docs/image-generation> — Interactions image output, references and configurable aspect/size. Retained the existing configured model; no forced provider/model migration.
- <https://ai.google.dev/api/generate-content> — parameter/MIME constraints.
- <https://ai.google.dev/gemini-api/docs/veo> — asynchronous generation/status/authenticated download. Reused repository's existing implementation instead of another video engine.

No third-party code, bitmap/video asset or branding was copied/downloaded.
