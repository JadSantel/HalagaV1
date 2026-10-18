# Account email delivery and link flows

Current status (2026-10-16 PHT): six email request/completion commands, fragment
forms and a local run-once Node.js job entrypoint are implemented. Provider sending
defaults off. This supersedes older unmounted email-route/link statements in the
slice guides. Real participant use and public deployment remain gated by ADR-081.

## Implemented boundaries

- Only POST `/api/auth/send-verification-email`, `/api/auth/verify-email`,
  `/api/auth/request-password-reset`, `/api/auth/reset-password`,
  `/api/auth/change-email` and `/api/auth/confirm-email-change` are mounted.
  They reuse the installed handler's origin/CSRF checks, endpoint/IP limiter,
  exact path and strict inputs, request admission and existing guarded commands.
  Generic request responses never return token/account material. Successful proof
  and reset clear cookies after commit and revoke all sessions.
- Registration, sign-in, password change, public session reads and all other
  library endpoints stay closed. Email change needs a fresh existing synthetic
  session; tests create it through the unmounted trusted fixture API.
- Action pages read then immediately clear `#token=...` after hydration. Tokens
  stay in component memory only; explicit submission POSTs them to the same
  origin. Pagehide/success clears them; refresh requires reopening the email.
  Query/path credentials are rejected. Pages/APIs use no-store/no-referrer and
  pages load no third-party resources.
- Signup/resend/reset/email-change issue atomically write a digest, minimized
  intent, AES-256-GCM ciphertext and durable job. Replacement suppresses queued
  work for that token family. Dispatch checks current account/token/binding/expiry
  and the fencing lease again after lock waits. Signup and namespaced work keys
  are supported. Security notices use only their immutable old-address snapshot.
- ADR-088's two-minute leases, five-attempt limit and explicit-429 backoff of
  30/60/120/240 seconds apply. Definite rejection fails. Ambiguous outcomes and
  expired SENDING work become UNKNOWN without automatic resend. Late provider
  acknowledgement cannot overwrite quarantine. Exactly-once inbox delivery is
  not guaranteed.
- Recovery precedes dispatch. Expired leases recover or fail at their allowance;
  expired work loses ciphertext; expired account tokens are deleted; terminal
  metadata purges after 30 days. Notice delivery expires after seven days.
  Token cleanup commits separately from job recovery to avoid reverse lock order.
- Forward migration `20261015110000_allow_erased_email_ciphertext` permits empty
  payloads required for erasure. Only disposable test schemas received replay.

## Local runtime

From `app`, with a reviewed **local synthetic** database containing the migrations:

```powershell
npm.cmd run jobs:account-email
```

Each invocation recovers/cleans, dispatches at most one job, then disconnects.
It creates no polling loop, hosted schedule or in-request background task.
Repeated invocations reuse durable work keys, fencing leases and bounded attempts.
`ACCOUNT_EMAIL_SENDING_ENABLED` defaults false. An API key alone cannot send.
Disabled dispatch claims no work or attempts; cleanup still runs. Do not enable
real sending for these checks. Tests inject a fake provider.

Production still requires `ACCOUNT_EMAIL_KEYRING` JSON with an active key and old
keys, each 32 random bytes encoded as base64. Keep old keys until ciphertext expiry
and purge. Never deploy the fixed local-only development key. Links use configured
`HALAGA_PUBLIC_ORIGIN`, never request headers. Sender setup, disabled Brevo tracking
and free-tier/billing review remain launch gates. No provider credentials were added.

## Verification

Set an explicit loopback `SIGNUP_TEST_DATABASE_URL` naming `halaga_signup_test`.
Tests create random schemas, replay migrations there, use `.invalid` addresses and
drop their schemas afterward. No shared/persistent migration or real email is needed.

```powershell
npm.cmd run test:account-email
npm.cmd run test:auth
npm.cmd run test:signup
npm.cmd run test:verification
npm.cmd run test:reset
npm.cmd run test:email-change
npm.cmd run test:password-change
npm.cmd run test:account-email-intents
npm.cmd run test:logging
npm.cmd run test:foundation
npm.cmd run lint
npm.cmd run build
```

Initial checks exposed an existing Node-incompatible provider error constructor,
incorrect dispatcher work-key parsing, the ciphertext-erasure constraint, reset
tests counting signup verification tokens as reset tokens, and a Turbopack rule
treating CSS modules as global CSS. These were corrected and rechecked. Reset tests
still assert that unrelated verification tokens survive.

Final verification on 2026-10-16 PHT:

- All `tests/*.test.mjs` files ran together through
  `node --conditions=react-server --test` with both database variables explicitly
  targeting the dedicated loopback test database: **188 passed, zero failed/skipped**.
  The new account-email suites contribute 20 checks, including late provider
  acknowledgement fencing and corrupt-ciphertext rejection. Existing module-type
  warnings are non-failing; no package-module conversion was introduced.
- `npm.cmd run lint`, `npm.cmd run build` and `git diff --check` passed.
- The production server returned no-store/no-referrer for account pages. The actual
  Next.js API route failed closed with fixed 500 `INTERNAL_ERROR` responses because
  this local environment lacks production HTTPS-origin/reviewed-IP-header settings.
  No exception/configuration details escaped. Expected 404/400/401 route behavior
  was verified through the same installed handler factory with explicit synthetic
  configuration. Public production configuration remains a launch gate.
- A headless local browser confirmed fragment clearing and reset success feedback
  using a mocked HTTP response. Real commands/account writes and fake-provider
  delivery were exercised separately through the same installed handler factory
  against isolated PostgreSQL schemas. This is not a real-provider delivery test.
- Desktop and 320px browser checks showed no overflow or third-party scripts and
  no console errors. Axe WCAG 2 A/AA scans reported zero violations/incomplete
  checks after the CSS fix. This is bounded automation, not a complete WCAG 2.2 AA
  or assistive-technology certification. The design detector's single warning was
  the existing thick notice accent border; the proposed visual system was preserved.
- Initial loopback/browser sandbox denials were retried with approval. No real
  email, paid service, deployment or shared/persistent migration was performed.

## Focused dispatcher verification (2026-10-18 PHT)

This local, synthetic-only follow-up changes tests and this guide. The existing
dispatcher required no runtime fix; no accepted policy, route, provider configuration,
migration, worker schedule or retention period changed. ADR-088's later integration
record governs the six email routes over historical unmounted-route notes. Signup,
sign-in and password-change routes remain closed, as the existing handler tests verify.

Seven added database checks cover leased replacement with token-family isolation,
successful 429 retry with the same work/link, expiry during backoff, FAILED/UNKNOWN
ciphertext erasure, the exact seven-day notice deadline, all four terminal outcomes'
30-day snapshot/cascaded-job purge, and cleanup isolation from other verification
purposes, sessions and rate counters. The disabled-runtime check now starts with
an expired lease. Fake fetch also checks 429, definite rejection, 5xx, malformed
success, network/timeout ambiguity and acceptance without provider network access.

An stdin launcher privately loaded local development connection configuration,
changed only the database name to `halaga_signup_test`, and supplied the explicit
test URL. Sending was disabled and provider credentials blank in subprocesses;
the adapter test enables only its in-process fake fetch. Synthetic `.invalid`
accounts and migration replays stayed in disposable schemas. Read-only catalog
checks found zero `signup_test_*` schemas before and after every run, including
the failed run. No persistent/shared migration or real email was sent.

| Command/check | Result |
| --- | --- |
| `npm.cmd run test:account-email` | Baseline: 20 passed. Expanded suite: 27 passed, zero failures/skips. The first expanded run reported 25 passed/two failures (one child assertion plus its parent) because a new notice fixture's clock preceded database job availability; correcting the fixture clock resolved it. Existing module-type warnings remain non-failing. |
| `npm.cmd run lint -- tests/account-email-delivery-database.test.mjs` | Passed. |
| `git diff --check` | Passed. |

Build, deployment and unrelated suites were not run for this test/documentation-only
change. This verifies fake-provider behavior, not real-provider or inbox delivery.
Password-change email subject/body, ordinary recipient/metadata retention and cleanup,
including delayed/deleted-account handling, remain unresolved under ADR-087 and
PROJECT §§8.5/25/34. ADR-088's four-message rules do not settle those decisions.

## Remaining blockers

- Hosted worker/scheduler selection, invocation cadence, rollout compatibility,
  monitoring and recovery runbook remain open under architecture §8.2. The local
  command completes the code boundary, not a deployment decision.
- FAILED/UNKNOWN staff access, reconciliation and controlled retry require reviewed
  role/purpose authorization and audit. UNKNOWN is never blindly auto-retried.
- Signup terms/privacy, library sign-in/session-creation races and password-change
  notice writes/templates remain gates for those closed endpoints.
- Production proxy/IP trust, origin/secret/key provisioning, provider tracking,
  sender authentication, session/counter cleanup and provider backup/deletion remain
  open. Privacy, recovery, availability and quota checks must pass before real data.
