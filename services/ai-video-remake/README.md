# AI Video Remake API

Authenticated handler exposed at `/api/ai-video-remake`. Vercel rewrites this
public URL to the existing Store gateway so the deployment remains within the
Hobby function limit; the API contract below is unchanged.

## Route contract

| Method | Action | Request | Result |
| --- | --- | --- | --- |
| GET | `capabilities` | query `action=capabilities` | Truthful server/provider/mode/billing capabilities. |
| POST | `estimate` | Normalized render input | Server quote `{ estimate, quote: { id, expiresAt } }`; an unused matching quote is reused. |
| POST | `estimate-analysis` | Director brief plus optional owned Media Cloud asset IDs | Separate, single-use analysis quote; never interchangeable with a render quote. |
| POST | `analyze` | Exact analysis quote input plus `quoteId`, `acceptedEstimate:true`, and `idempotencyKey` | Gemini metadata-based plan, or worker visual analysis when explicitly configured. Paid analysis is idempotent and records unknown provider submissions without silently resending. |
| POST | `create-job` | Exact quoted input plus `quoteId`, `acceptedEstimate:true`, and `idempotencyKey` | Persisted async job. HTTP 202 is returned even when provider submission failed or is unknown; inspect `job.status`. |
| GET | `status` | query `id` | Owner-scoped provider status. Progress is `null` unless the provider reports it. |
| POST | `pause`, `resume`, `cancel` | `{ id }` | CAS-protected control. Pause/cancel remain requested until an external adapter acknowledges them. |
| POST | `retry` | `{ id, quoteId, acceptedEstimate:true }` | New paid attempt from the stored checkpoint. `submission-unknown` also requires `confirmPossibleDuplicate:true`. |
| GET | `download` | query `id` | Owner-scoped output proxy with host, redirect, MIME and byte-size checks. Large outputs should be registered in private Media Cloud Blob instead. |

Canonical render input fields:

```json
{
  "mode": "text-to-video | video-remix | character-replace",
  "prompt": "Vietnamese or English production brief",
  "mediaProjectId": "Mongo Media Project ID when assets are used",
  "sourceAssetId": "Media Cloud video asset ID",
  "characterAssetIds": ["Media Cloud image asset ID"],
  "referenceAssetIds": ["Media Cloud image asset ID"],
  "audioAssetId": "Media Cloud audio asset ID",
  "sourceStartSeconds": 0,
  "sourceEndSeconds": 8,
  "durationSeconds": 8,
  "aspectRatio": "16:9",
  "resolution": "720p",
  "variants": 1,
  "provider": "auto | veo | worker | gemini-omni | wan2.2",
  "rightsAttested": true,
  "characterConsentAttested": true
}
```

`mediaProjectId` is intentionally distinct from a browser-local project UUID. Every input asset must be a non-deleted `mediaAssets` row owned by the current user, in that exact project, with `status:"ready"`, an allowed MIME type and valid private Blob storage metadata.

## Required server configuration

- Director: `GEMINI_API_KEY`/`GEMINI_API_KEYS` and `AI_VIDEO_DIRECTOR_MODEL`.
- Direct text-to-video: Gemini key plus `GEMINI_VIDEO_MODEL` (or `VEO_MODEL`).
- Direct capability declarations: `VEO_ALLOWED_DURATIONS`, `VEO_ALLOWED_ASPECT_RATIOS`, `VEO_ALLOWED_RESOLUTIONS`. Safe defaults are 4/6/8 seconds, 16:9/9:16, and 720p only.
- Worker: `MEDIA_AI_WORKER_URL`, `MEDIA_AI_WORKER_TOKEN`, and explicit `MEDIA_AI_WORKER_MODES`.
- Worker provider/model allowlists: `MEDIA_AI_WORKER_PROVIDERS`, `MEDIA_AI_WORKER_MODELS`, and `MEDIA_AI_WORKER_DEFAULT_MODEL` when more than one model is declared.
- Worker parameter declarations: `MEDIA_AI_WORKER_DURATIONS`, `MEDIA_AI_WORKER_ASPECT_RATIOS`, `MEDIA_AI_WORKER_RESOLUTIONS`, and `MEDIA_AI_WORKER_MAX_VARIANTS`. Safe defaults are deliberately conservative.
- Pricing: `VEO_LITE_USD_PER_SECOND`, `VEO_FAST_USD_PER_SECOND`, `VEO_STANDARD_USD_PER_SECOND`, `MEDIA_AI_WORKER_USD_PER_SECOND`, and `AI_VIDEO_PRICING_VERSION` as applicable.
- Paid access: owner only by default. Explicit alternatives are `AI_VIDEO_BILLING_USER_IDS`, or `AI_VIDEO_ALLOW_USERS=1` together with `AI_VIDEO_DAILY_USD_LIMIT` and server pricing.
- Daily limits: `AI_VIDEO_DAILY_JOB_LIMIT`, `AI_VIDEO_DAILY_USD_LIMIT`, and owner equivalents `AI_VIDEO_ADMIN_DAILY_JOB_LIMIT`, `AI_VIDEO_ADMIN_DAILY_USD_LIMIT`.

No API key, worker token, provider operation ID, signed input URL, private output URL or owner ID is included in a public job response.
