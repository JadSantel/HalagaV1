# Slice 2 account integration: synthetic, unmounted commands

Implementation record, 2026-10-15 PHT. This document changes no accepted policy.
ADR-086 and ADR-087 remain binding. All account HTTP commands remain unmounted.
The public `/account` paths are static, disabled screen previews, not working
registration, sign-in, recovery or account settings.

**Status update, 2026-10-15 PHT:** ADR-088 and the internal account email dispatcher
resolve the historical private-token transport and dispatch/recovery blockers below.
Initial signup now has a token-bound encrypted handoff. Templates, fragment links,
replacement suppression, leases, explicit-429 retries, ambiguous-outcome quarantine
and cleanup are accepted and implemented. The historical blocker list records the
state before ADR-088 and is superseded for those items. Routes, fragment consumption,
worker deployment, staff retry/audit and provider launch setup remain blocked.

## Current email-only integration (2026-10-16 PHT)

The owner's next-slice request now mounts only the six email request/completion
commands and fragment forms. The local `jobs:account-email` Node.js entrypoint
recovers/cleans then dispatches at most one job. Sending defaults off even with
provider credentials. This supersedes historical statements below that every
account route and link page is unmounted. Signup, sign-in and authenticated password
change remain closed; no session-creation route is exposed. Hosted scheduling,
staff recovery/audit and ADR-081 readiness remain unresolved. See the current
[delivery and verification guide](ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md).

## Implemented independently (original synthetic integration)

- `app/src/server/repositories/account-flows.ts` composes the existing account-owned
  operations. It adds no transaction, account-ID input, identity repair or data reader.
- `app/src/server/account-flow-plugin.ts` provides a Better Auth plugin and a safe
  handler adapter for synthetic integration. Nothing installs it in application auth
  or exports it from a Next.js route or Server Action. There is no runtime enable flag.
- Core endpoint keys replace the library's account transactions and token defaults.
  Requests run through `auth.handler`, including the configured endpoint/IP limiter
  and origin/CSRF middleware. Plugin request admission requires POST, the configured
  origin and an exact allowlisted path without a query string. A private WeakSet
  admits each request once after the limiter; direct `auth.api` calls are rejected,
  including calls supplied with a fabricated Request. Unrelated library endpoints,
  including sign-in and public session reads, are not exposed by this integration.
- Signup, verification-resend and reset requests return exactly
  `{"status":"REQUEST_RECEIVED"}` on success. Neither repository results nor raw
  issuance material are returned. Unknown, duplicate and verified states are tested.
  Validation and failures use fixed codes; raw exceptions and validation issues
  are never serialized or logged. No account/email/DOB/session projection is added.
- Successful verification, reset and email proof use Better Auth's configured cookie
  deletion helper after the command commits. Failed commands do not clear cookies.
  Password change sends no replacement cookie and keeps the initiating session.
  Repositories still own authorization, original-session-createdAt freshness,
  credential checks, token consumption/replacement, locks, rollback and revocation.
- The handler adapter adds `no-store`, `no-referrer` and `nosniff`, sanitizes failures,
  and preserves numeric limiter retry feedback. It calls `auth.handler`, never a
  direct account `auth.api` method. This outer boundary matters: installed
  Better Auth 1.7.7 returns limiter/onRequest responses before plugin onResponse.

The supported plugin mechanism is documented in [Better Auth's plugin guide](https://better-auth.com/docs/1.6/concepts/plugins).
Behavior was also inspected in the pinned package's `api/index.mjs`,
`api/dispatch.mjs`, `api/to-auth-endpoints.mjs`, `api/rate-limiter/index.mjs`,
`api/middlewares/origin-check.mjs` and cookie helpers. Package upgrades require
rechecking endpoint replacement, admission identity and limiter behavior.

| Synthetic endpoint | ADR-086 maximum / inactivity window | Successful effect |
| --- | --- | --- |
| POST `/sign-up/email` | 3 / 15 minutes | Existing atomic signup and verification intent; no session |
| POST `/send-verification-email` | 3 / 15 minutes | Existing verification token replacement/intent, generic response |
| POST `/request-password-reset` | 3 / 15 minutes | Existing reset token replacement/intent, generic response |
| POST `/verify-email` | 60 / 1 minute | Existing atomic verification/revocation; clear cookie |
| POST `/reset-password` | 60 / 1 minute | Existing atomic reset/revocation; clear cookie |
| POST `/change-email` | 60 / 1 minute | Owner's fresh stored session; old address stays primary |
| POST `/confirm-email-change` | 60 / 1 minute | Existing atomic switch/revocation/old-recipient intent; clear cookie |
| POST `/change-password` | 60 / 1 minute | Existing current-password check/replacement; retain initiating session/cookie |

These paths are internal integration contracts only. There is no external token
transport, token URL format, callback URL, redirect contract or client submit path.

## Historical mounting blockers before ADR-088

1. **Durable private token transport.** ADR-087's verification/reset/email-change
   repositories commit a namespaced digest plus private binding and minimized
   outbox intent. Raw material returns only after commit to a trusted issuer.
   The digest and intent cannot recover the token. Signup records only an initial
   intent, with no token. No accepted decision specifies where recoverable delivery
   material lives, how it reaches only the intended recipient, or how a crash
   between commit and handoff is recovered. Discarding an issuer result in a public
   request would make its intent undeliverable. Sending synchronously would violate
   ADR-075; copying a recoverable token into generic outbox records would violate
   the existing privacy boundary. A memory callback, log, public response, manual
   token-entry flow or invented URL format does not resolve durable transport.
2. **Dispatch and stale work.** ADR-073 accepts leases, idempotency, bounded retries,
   recovery and failed-job handling, but leaves operational parameters unresolved.
   No dispatcher or job materialization exists. Recipient-bound transport, obsolete
   intent suppression after resend/address changes, privacy-reviewed templates and
   the required job-class/recovery/retention decisions must be settled together.
   Independent account-owned intent inspection now checks current token/binding/
   expiry state and old-recipient snapshots with fixed status-only results. Its
   locks end at commit; it provides no sending, durable suppression, claim,
   processed-work or recovery contract. See `ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`.
   This change selects no transport, encryption/key policy, retry allowance,
   schedule, cleanup rule, retention period or provider configuration.
3. **Password-change notice implementation.** The owner approved the
   [decision brief](PASSWORD_CHANGE_NOTICE_DECISION_BRIEF.md) on 2026-10-15 PHT.
   ADR-087 now requires in-app notice for every success and email only to the
   commit-time primary address verified in both stores. Unverified/mismatched
   states get no email, with no later backfill or recipient retargeting. Required
   atomic intents/recipient binding are not implemented; password-change mounting
   stays gated. Policy approval adds no notice behavior, schema or delivery and
   does not settle final templates, retention or worker parameters.
4. **Sign-in/session creation races.** Existing library sign-in does not share the
   account-owned identity/mapping/credential locks. A sign-in can race reset,
   email proof or password replacement. The synthetic plugin intentionally exposes
   no sign-in endpoint; serialized account commands alone do not settle this race.
5. **Existing readiness gates.** Approved terms/privacy content, production origin
   and trusted-IP deployment review, secret management, cleanup/retention and
   ADR-081 launch checks remain required. No real participant data is authorized.

There is no contradiction authorizing a shortcut: ADR-087's durable-email mandate
supplements ADR-073/075; it does not supersede their delivery/privacy requirements.
The user explicitly permits independent work with dependent routes left unmounted.

## Screen previews

`/account` links to `register`, `sign-in`, `verify-email`, `forgot-password`,
`reset-password`, `change-email`, `confirm-email-change` and `change-password`.
Each preview states that actions are unavailable. Inputs and submit controls are
disabled, forms use POST, and no client handler, query reader, persisted record,
credential, token, storage or analytics is used. No submission or success is simulated.
These previews must not be described as completed functional account flows.

Screens use design.md's proposed palette/system fonts, single-column responsive
layout, visible labels, password-manager autocomplete, exact unchecked ADR-087 adult
attestation, privacy explanations, skip link, focus styles and 44px action targets.
Colors remain proposals. Metadata is static/noindex/no-referrer. English is
authoritative; account screens are not among PROJECT §26.1's required paired
Cebuano/Bisaya flows. No invented translation or email template is introduced.
Live loading, field-error summaries, status announcements and approved terms/privacy
links still need verification when functional clients can be connected safely.

## Verification

Use installed dependencies and existing scripts from `app`. For account database
tests explicitly set `SIGNUP_TEST_DATABASE_URL` to the separate loopback
`halaga_signup_test` database, as documented in the existing local-testing guides.
The new integration suite uses the same random-schema sandbox, replays existing
migrations there and drops its schema in `finally`. It never migrates persistent data.
`test:auth` now also requires that dedicated test URL; it does not fall back to the
application database for account fixtures. Existing RateLimit tests still use their
own isolated schema. Synthetic sign-ins and direct issue calls seed tests only;
they are neither mounted nor an implemented delivery mechanism.

Commands run on 2026-10-15 PHT:

| Check | Result |
| --- | --- |
| `npm.cmd run test:auth` | 21 passed: handler limits, shared PostgreSQL concurrency, origins, direct-call rejection, generic/safe responses, ownership, freshness, cookie behavior and commit rollback/retry |
| `npm.cmd run test:signup` | 7 passed |
| `npm.cmd run test:verification` | 11 passed |
| `npm.cmd run test:reset` | 12 passed |
| `npm.cmd run test:email-change` | 16 passed |
| `npm.cmd run test:password-change` | 13 passed |
| `npm.cmd run test:foundation` | 21 passed |
| `npm.cmd run test:logging` | 5 passed |
| `npm.cmd run lint` | Passed |
| `npm.cmd run build` | Passed, including TypeScript |
| `git diff --check` | Passed; Git reports existing LF/CRLF conversion warnings |

`npm.cmd run start -- --hostname 127.0.0.1 --port 3102` served the built app for
native Node fetch/assert probes, then was stopped. All eight previews, the account
index and existing laptop prototype returned 200. Checks confirmed one H1 per
preview, static noindex/no-referrer metadata, POST forms, disabled inputs/buttons
and no Server Action identifiers. Nine account API paths, including sign-in,
returned 404. Unknown account screens render the not-found fallback; an initial
probe expecting every streamed not-found response to start with HTTP 404 was
corrected to test fallback content (Next.js can begin streaming with 200).
An initial shell-quoted probe failed to parse and was rerun using literal stdin.

Native Node sRGB contrast calculations passed: body 14.84:1, muted text 5.95:1,
links 5.86:1, notice text 8.50:1, button text 8.21:1, input boundary 4.15:1 and
focus indicator 6.52:1 against their specified backgrounds. This is a static
color check, not a substitute for browser or assistive-technology testing.

Account suites preserve existing coverage for token expiry/replacement/reuse,
hash/write/commit failures, retry, unrelated-account isolation and concurrent
account changes. The integration suite additionally proves actual HTTP admission,
response/cookie boundaries and three permitted concurrent signup requests across
two handlers sharing PostgreSQL counters. Denied requests leave the inactivity
timestamp unchanged; a separate IP gets its own bucket; inactivity restores access.

Initial checks caught incorrect HTTP-status handling, limiter early-response handling,
and a `dynamicParams` configuration incompatible with this repository's enabled
Next.js Cache Components. These were corrected and affected checks rerun successfully.
Existing Node module-type warnings remain. No browser automation CLI is installed;
manual keyboard, screen-reader, 200% text/400% zoom and viewport checks remain unrun.
HTTP/static checks do not establish WCAG conformance.

No new dependency, package script, migration, email send, paid service or deployment.
