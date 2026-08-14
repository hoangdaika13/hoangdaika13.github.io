# HH Platform security baseline

No internet-facing system can be guaranteed impossible to attack. HH Platform uses layered controls so common attacks are blocked, compromised components have limited reach, abnormal behavior is visible, and recovery is repeatable.

## Implemented in source

- API gateway: strict origin checks, Fetch Metadata validation, request IDs, no-store responses and bounded JSON parsing.
- Input boundary: request byte, depth, node, array and field limits; rejection of prototype-pollution keys, Mongo operators and dotted paths.
- Authentication: signed JWT issuer/audience, hashed revocable sessions, secure HttpOnly cookies, OAuth nonce/state, passkeys, adaptive CAPTCHA, login lockout and OTP attempt limits.
- Password changes and new accounts: 12 or more Unicode characters, at most 72 UTF-8 bytes, offline common-password rejection. Existing hashes continue to work.
- Authorization: owner identity is based on immutable configured IDs or an allowlisted Google-verified identity; role grants cannot escalate to the actor's own level.
- Private storage: owner isolation, private Blob access, server-mediated download, `attachment` delivery, active-format denylist, MIME/extension/signature checks and safe fallback content type for legacy records.
- Browser boundary: HSTS, CSP, no framing, no sniffing, restrictive referrer and permissions policies. CSP violations are sanitized, rate-limited and expire after 30 days.
- Realtime server: origin/context checks, body complexity guards, hardened headers, 12-character password policy and authenticated private storage.
- Supply chain: locked dependencies, production audit, dependency review, CodeQL and security contract tests in GitHub Actions.

## Required Vercel controls

These controls cannot be enabled by source code alone. Configure them in the Vercel dashboard with the least-privileged team account:

1. Enable Deployment Protection/Vercel Authentication for every Preview and Development deployment. Production remains public.
2. Enable Bot Protection. Enable AI bot controls only if they do not block the intended public content.
3. Enable the managed OWASP ruleset in log mode first, inspect false positives, then enforce.
4. Add firewall rate limits as a second layer:
   - `/api/auth/*`: 15 requests per minute per IP, with a challenge/block action.
   - AI, TTS and media generation: 10 requests per minute per IP; application quotas still apply per user.
   - `/api/security/csp-report`: 60 requests per 15 minutes per IP.
   - `/api/*`: a conservative global burst ceiling based on normal production traffic.
5. Keep Attack Challenge Mode available for incidents; do not leave it permanently enabled unless traffic requires it.
6. Restrict environment variables to the environments that use them. Never prefix secrets with `NEXT_PUBLIC_` or place them in client configuration.

## Secrets and provider accounts

- Rotate any credential ever pasted into chat, screenshots, logs, commits or browser code. Deleting text later does not make a secret safe again.
- Use independent 32+ byte random values for JWT, OTP/HMAC, YouTube token encryption, Meta token encryption, TikTok token encryption and worker authentication.
- Give each provider a separate project/application and minimum OAuth scopes. Remove unused redirect URIs.
- Keep previous encryption keys only during a measured migration; remove them after all ciphertext is re-encrypted.
- Enable MFA/passkeys on Vercel, GitHub, MongoDB Atlas, Google, Meta, TikTok, Resend and DNS accounts.
- Review provider access and active sessions every month and immediately after a staff/device change.

## MongoDB and storage

- Use a dedicated application database user, never an Atlas organization/project owner credential.
- Require TLS, restrict network access to the narrowest practical path, and enable Atlas alerts and point-in-time backups.
- Test restoration to a separate database quarterly. A backup that has never been restored is not a verified backup.
- Keep Blob private. Large media must bypass JSON serverless functions and use short-lived, owner-bound upload grants when that flow is added.
- Malware scanning is still required before allowing public sharing of user uploads. Current storage is private and download-only.

## Monitoring and review

- Alert on auth lockouts, repeated 401/403/429, owner/admin mutations, OAuth errors, token decrypt failures, CSP spikes and abnormal AI spend.
- Logs must contain request ID, event type, pseudonymous actor ID and result—not passwords, tokens, cookies, prompts or raw private payloads.
- Review `securityCspReports` weekly until CSP is stable, then monthly. A spike can indicate injection, a broken integration or an extension.
- Run `npm run audit:prod` and `npm run test:security:full` before every production release.
- Reassess against OWASP ASVS after major auth, upload, payment, social publishing or AI worker changes.

## Remaining high-value work

- Require recent passkey/password verification for owner actions, secret rotation and bulk exports.
- Add signed, expiring worker callbacks with nonce replay protection to every long-running media worker.
- Add per-user AI cost circuit breakers and provider spend alerts.
- Add malware scanning/quarantine before public file sharing.
- Move toward a nonce/hash-based CSP to remove `style-src 'unsafe-inline'` after legacy inline styles are migrated.
- Perform an independent penetration test before enabling user-generated public uploads, payments at scale or additional administrators.

