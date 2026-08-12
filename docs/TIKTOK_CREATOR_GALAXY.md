# TikTok Creator Galaxy

TikTok Creator Galaxy is an owner-isolated workspace at `#/davinci-resolve/tiktok`. It exposes eighteen honest workspaces across discovery, creation, publishing, engagement, business and platform operations.

## Capability truth

- Local-first: Trend/SEO/Competitor/Product imports, video preview, AI handoff, script drafts, subtitle utilities, LIVE planning and media inspection.
- Login Kit + Display API: connected-user profile, stats and that user's public video list after the required scopes are granted.
- Content Posting API: upload draft with `video.upload` and Direct Post with `video.publish`. Every post requires fresh creator info, preview, an explicit privacy choice, music confirmation and final consent. Unaudited clients are restricted to `SELF_ONLY`.
- API for Business: Ads, Organic, Business Messaging and TikTok One stay visibly locked until TikTok approves the app and advertiser/business owner authorization exists.
- TikTok Shop Partner: Shop and affiliate adapters stay visibly locked until a Partner app, market availability and seller authorization exist.

The product does not scrape TikTok or competitors, accept account passwords/cookies, automate followers/views/comments, bypass CAPTCHA/quota/audit, provide a downloader, or remove watermarks.

## Server configuration

Configure only in Vercel/server environment:

```text
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://hoang8.com/api/tiktok/oauth/callback
TIKTOK_TOKEN_ENCRYPTION_KEY=
TIKTOK_WEBHOOK_SECRET=
TIKTOK_CONTENT_POSTING_AUDITED=false
TIKTOK_BUSINESS_APP_ID=
TIKTOK_BUSINESS_APP_SECRET=
TIKTOK_SHOP_APP_KEY=
TIKTOK_SHOP_APP_SECRET=
```

`TIKTOK_TOKEN_ENCRYPTION_KEY` must be at least 32 characters and distinct from other provider keys. Access and refresh tokens are AES-256-GCM encrypted with owner and connection identifiers as authenticated data. The browser never receives either token.

Register the redirect URI exactly in TikTok Login Kit. Request only scopes needed by the selected action. Set `TIKTOK_CONTENT_POSTING_AUDITED=true` only after TikTok formally approves the Content Posting audit.

Register `https://hoang8.com/api/tiktok/webhook` in TikTok Developer Portal. The gateway verifies the raw body with `TikTok-Signature`, enforces a five-minute timestamp window and stores an idempotency hash before updating a publish job. `TIKTOK_WEBHOOK_SECRET` may be set to the signing secret supplied for the webhook; when it is omitted, the official app `TIKTOK_CLIENT_SECRET` is used as the signing key.

## Data boundaries

MongoDB collections are `tiktokConnections`, `tiktokOauthStates`, `tiktokSnapshots`, `tiktokProjects`, `tiktokJobs`, `tiktokAuditEvents`, and `tiktokWebhookEvents`. Every user-facing query filters by the authenticated HH `userId`; webhook updates are additionally narrowed through the connected TikTok `openId` when supplied. Public response serializers omit encrypted tokens, upload session URLs and private payloads.

The internal calendar is an HH reminder/queue, not a TikTok Scheduling API. Sending content only starts after a new explicit confirmation. A scheduled internal item remains queued until its owner resumes it.

## Official references

- https://developers.tiktok.com/doc/login-kit-overview
- https://developers.tiktok.com/doc/tiktok-api-scopes
- https://developers.tiktok.com/doc/display-api-overview
- https://developers.tiktok.com/products/content-posting-api
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-sharing-guidelines
- https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
- https://ads.tiktok.com/help/article/marketing-api
- https://business-api.tiktok.com/portal
- https://partner.tiktokshop.com/docv2/page/tts-developer-guide
