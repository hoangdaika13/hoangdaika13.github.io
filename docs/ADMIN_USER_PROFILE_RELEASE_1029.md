# Admin user profile 360 — release 1029

Implementation extends the existing Admin Panel and keeps the Platform shell, routing, authentication and role hierarchy. Profile data is not stored in localStorage. Existing account-scoped list preferences continue to use `hh.admin.accounts.filters.v1`.

## Delivered

- Nine profile panels: overview, login/security, sessions/devices, consented workspace activity, roles/access, support metadata, account audit, notes/review and privacy.
- Optional `section` on `accounts-detail` loads each panel separately. Omitting it retains the older complete response contract. Switching tabs suppresses stale responses; closing/replacing the dialog aborts its requests. Native dialogs provide Escape and focus containment, with focus restored to the list.
- Overview derives facts from retained session/login records and consented presence, with a visible 100-record limit instead of inventing all-time statistics. Missing timestamps remain unknown.
- Account-scoped readers may inspect only permitted account IDs. The global recent list/export still requires global permission. Notes, support, audit and role data are independently permission-gated and display an explicit unauthorized state.
- Workspace activity requires both the Admin permission and current account consent. Revoked consent suppresses previously retained telemetry. Privacy reads `consentPreferences`, the legacy boolean `consent`, and `consentUpdatedAt`, matching the existing consent API.
- Login result, risk/device, date and search filters over the bounded loaded history; session status filter; newest-session ordering; short session identifiers; masked network metadata. Existing status dialogs start from the current state and suspension date.
- Built-in roles, global permissions, scoped assignments and grants, source administrator, expiration and revocation metadata. Existing role policies and permission simulator are reused; assignment revocation uses the existing protected API.
- Own-note creation/edit/deletion, author/retention timestamps, escaped plain text, and rejection of explicit credential labels. Edits are bound to account, author and retention. Audit records contain operation metadata rather than note contents.
- Review flag, priority, validated active Admin assignee, reason and future review time persist at the server. No notification job is claimed.
- Single-profile JSON export requires `reports.export`, is rate-limited, bounded, projected and audited before download. Existing list CSV/JSON export retains its field allowlist, 1,000-account cap and formula neutralization; its audit now records non-identifying filter metadata.
- Desktop/mobile layout and text scaling. The selection toolbar stays in normal flow so it cannot cover the detail button at 200% text size. Tabs scale their width with text size. Light theme, reduced motion and forced colors remain supported.
- Release/cache manifests advance together: loader 691, Admin recent accounts CSS/JS 2, Community Admin JS 17, cache 1029.

## Evidence and repeatable checks

The focused suite passed 105/105 tests covering account projection/redaction, list/export bounds, native/current sessions, role hierarchy, ABAC, note mutation, review validation, consent suppression, lazy panel queries, scoped account reads, support/access projection and export audit. Related shell/auth/home/release contracts are included.

Browser QA: `scripts/qa-admin-user-profile.js` serves only the visibly labeled local fixture. It uses an external development Playwright installation via `HH_PLAYWRIGHT_PATH`, with optional `HH_BROWSER_EXECUTABLE`; no dependency is added to the website.

At 1440, 768 and 375 px it verifies all nine panels, event filters, keyboard tab navigation, Escape/focus restoration, notes create/edit/delete, literal XSS text, review priority, fixture session revocation, JSON download, API error/recovery, closing during loading, 200% text, forced colors, zero page/console errors and no page/dialog horizontal overflow. Screenshots are written to a temporary QA directory, not the repository.

The project is a static/serverless application with no configured lint, typecheck or general build script. Syntax checks and repository tests are the available checks; a build result is not claimed.

## Operational limits

- Browser QA uses labeled fixture data; backend tests use isolated database doubles. Production MongoDB/authentication were not exercised with real accounts.
- Historical data is limited by existing TTL/retention and collection availability. Counts are not all-time totals. No online-user, location, duration or security conclusion is inferred from a retained session.
- Support panels show ticket metadata only, not private correspondence. No new helpdesk escalation workflow is invented.
- Password reset remains in the existing user recovery flow. No Admin-issued password, login-as/impersonation, billing access or new outbound email integration is added.
- Review dates are stored scheduling metadata, not automatic reminders. Conditional/scoped permission decisions remain contextual and enforced by the existing server policy.
- Closing an in-flight write cannot guarantee that a server has not already committed it. The next profile load reads the server result; the UI does not report a cancelled request as a successful write.
- Profile panels have no identifying URL deep link; existing list query preferences remain compatible with reload/navigation.

No external UI code, media or new production dependency is used.
