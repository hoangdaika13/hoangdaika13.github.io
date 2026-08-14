# Security incident runbook

## 1. Confirm and preserve

Record UTC time, reporter, affected route, deployment ID, commit, `X-Request-ID`, provider request IDs and a short factual timeline. Export relevant logs before retention expires. Do not copy raw tokens or unrelated user data into tickets.

## 2. Contain

- Enable Vercel Attack Challenge Mode or a narrow WAF rule for the affected route/IP/ASN.
- Pause the affected integration or worker; do not take the entire site offline unless compromise is broad.
- Revoke the compromised OAuth connection/session and increment the affected user's `tokenVersion`.
- For owner compromise, revoke every owner session and temporarily remove mutable admin allowlists until identity is verified.

## 3. Rotate in dependency order

Rotate provider/API credentials first, then token-encryption keys with a controlled migration, then JWT/OTP secrets. Rotating JWT invalidates all sessions and must be announced. Rotate DNS, GitHub and Vercel credentials if the deployment chain may be affected.

## 4. Eradicate and recover

Patch from a clean branch, review the diff, run production dependency audit and the full security suite, deploy a preview protected by Vercel Authentication, then promote. Restore data only from a known-good point and verify ownership boundaries before reopening writes.

## 5. Notify and learn

Assess legal and contractual notification duties with qualified counsel. Notify affected providers/users with facts, impact, actions and safe next steps—never speculation. Within seven days, document root cause, detection gap, control failure, recovery time and assigned preventive actions.

## Emergency checklist

- [ ] Preserve logs and request IDs
- [ ] Contain the smallest affected surface
- [ ] Revoke sessions/tokens
- [ ] Rotate exposed secrets
- [ ] Patch, review and test
- [ ] Restore and verify owner isolation
- [ ] Notify where required
- [ ] Complete post-incident actions
