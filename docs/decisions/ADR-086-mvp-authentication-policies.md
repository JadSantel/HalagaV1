# ADR-086: Configure MVP Authentication Policies

- Status: Accepted
- Date: 2026-10-13
- Supplements: ADR-074, ADR-083, ADR-085

## Context

ADR-074 selected Better Auth but left session/security settings and endpoint limits open. The owner requested seven-day rolling sessions, daily refresh, recent sign-in for sensitive changes, single-application cookies, secure production settings, and conservative shared rate limits. The owner explicitly approved the numerical freshness and rate-limit values below on 2026-10-13.

The repository has Better Auth 1.7.7, Prisma, PostgreSQL, and core identity tables, but no account routes, eligibility integration, or durable verification/reset email delivery. This decision configures a bounded policy foundation; it does not authorize incomplete account endpoints or public deployment.

## Decision

- Sessions expire after seven days. On session use, renew the seven-day expiry when at least one day has elapsed since the previous renewal. This is request-driven, not a scheduled daily refresh; inactive sessions expire. Rolling renewal does not change the sign-in timestamp.
- Recent sign-in means the session was created less than 15 minutes ago. Email and password changes require a valid, recent session on the server. At 15 minutes the session is no longer fresh. Sign in again to create a fresh session; no MFA or additional account feature is selected.
- Use one explicit application origin and trust only that origin. Reject nonempty `BETTER_AUTH_TRUSTED_ORIGINS`, which the library otherwise merges into its trusted-origin list. Do not trust proxy host/protocol headers for origin discovery. Authentication cookies are host-only (omit `Domain`), HttpOnly, SameSite=Lax, and use path `/`. Disable cross-subdomain cookie sharing. Keep origin and CSRF checks enabled. Browser cookies cannot be isolated by port; avoid unrelated applications on the authentication host.
- Require HTTPS and Secure cookies in production. Local loopback HTTP development uses cookies without Secure; HTTPS development still uses Secure cookies. Do not use insecure HTTP for non-loopback authentication.
- Disable session cookie caching so server checks use stored sessions and revocation is not delayed by a cached session snapshot.
- Enable endpoint rate limits in all environments. Key each bucket by the library's resolved client IP and endpoint. Explicit rules replace the library's hidden special defaults:

| Endpoint | Maximum requests | Inactivity window |
| --- | --- | --- |
| `/sign-up/email` | 3 | 15 minutes |
| `/sign-in/email` | 5 | 1 minute |
| `/request-password-reset` | 3 | 15 minutes |
| `/send-verification-email` | 3 | 15 minutes |
| Other authentication endpoints | 60 | 1 minute |

- Use Better Auth's PostgreSQL-backed `RateLimit` store for production and non-local environments, sharing the same database across application instances. Only loopback development may use memory. Retain the adapter's atomic guarded increments and unique key so concurrent requests cannot exceed a bucket's maximum.
- Use the installed library's supported limiter semantics: permitted requests advance the last-request timestamp; rejected requests do not. A bucket resets after its inactivity window. Shared-IP users share buckets and may need to wait. This is endpoint/IP protection, not a separate per-account lockout policy.
- Require an explicitly configured, reviewed single-client-IP header for production/non-loopback authentication. Do not assume any provider's forwarding header or proxy ranges. Configuration fails until this detail is supplied. The deployment must overwrite the header and prevent direct client access to the origin before that trust is valid.
- Disable Better Auth's raw logger because exception output may contain private material. Future handlers must use the ADR-085 allowlist for operational outcomes without serializing library exceptions, request contents, credentials, or tokens.

## Implementation and verification

`app/src/server/auth-policy.ts` centralizes configuration. `app/src/server/repositories/auth.ts` constructs account authentication with the shared PostgreSQL adapter, without mounting routes. Unverified users remain allowed to sign in; marketplace eligibility/verification gates remain separate server requirements under ADR-074.

In Better Auth 1.7.7, email/password change endpoints validate the authoritative session but do not themselves enforce `freshAge`. A supported before hook invokes `freshSessionMiddleware` on both paths. Cookie caching remains disabled. Setting `freshAge` alone would not satisfy this decision.

The additional `RateLimit` Prisma model and additive migration contain the library's key, count, and bigint millisecond timestamp. The key can contain a client IP and endpoint and is private operational data; it must not enter public/domain projections or general logs. The schema-generation fixture/snapshot remains core-identity-only; the counter model is verified separately against actual installed-adapter requests.

Focused synthetic tests exercise the library handler, rolling renewal, stale-sensitive-change rejection, revocation, cookies, endpoint limits, cooldown recovery, safe configuration errors, and concurrent requests across two separate PostgreSQL-backed instances. Database fixtures use a uniquely named local schema removed after verification. No participant records or real emails are used.

## Remaining gates and limitations

- No authentication route or account UI is mounted. ADR-087 settles account-flow policy, but atomic Better Auth/domain/outbox integration and synthetic failure/retry verification must precede routes. Restrictions and full marketplace action authorization remain separate gates.
- ADR-087 sets verification/email-change tokens to 24 hours and reset tokens to one hour, all single-use with resend replacement; it defines atomic verification/reset/email-change behavior and session invalidation. These policies supplement the session, cookie, and endpoint-rate-limit policies here.
- Production origin, secret provisioning/rotation, proxy/header trust, host/database readiness, and library-error response handling remain deployment/integration work. No host or proxy provider is selected.
- Better Auth endpoint rate limiting applies to HTTP handler requests, not direct `auth.api` calls. Future externally reachable server-action/API wrappers must route through the limiter or provide equivalent reviewed protection.
- The library prunes expired counters during an expired-bucket reset. This is opportunistic cleanup, not a bounded-retention job. Expired session/token/counter cleanup and provider backup purge behavior require review before real participant use; no worker schedule is selected here.
- The migration is checked in and exercised in a disposable test schema. It is not applied to the persistent local or deployed database by this slice. Deploy it through the reviewed migration workflow before using database-backed authentication.
- The ADR-081 synthetic-data and launch-readiness gates remain in force. No dependency, paid service, real-email integration, or deployment is added.

Remaining gates: implement and test the accepted account policies before exposing routes. Production origin, trusted client-IP header/direct-origin protection, secret provisioning/rotation, session/token/counter cleanup, and launch readiness remain open; no host or cleanup schedule is selected here.

## Sources

- Owner's authentication implementation request and numerical-policy approval, 2026-10-13
- `PROJECT.md` sections 8, 26, 28, 33, and 34; `architecture.md` sections 3, 6, and 8.2
- ADR-074, ADR-081, ADR-083, and ADR-085
- ADR-087
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth rate limiting](https://better-auth.com/docs/concepts/rate-limit)
- [Better Auth cookies](https://better-auth.com/docs/concepts/cookies)
- Installed Better Auth 1.7.7 endpoint, session-middleware, rate-limiter, and Prisma-adapter source
