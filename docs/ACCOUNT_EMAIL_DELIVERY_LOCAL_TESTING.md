# Slice 2 account email delivery

ADR-088 accepts and implements the internal delivery path. Account request routes
remain unmounted, account screens remain disabled previews, and no worker is
deployed. Do not use real participant data or provider credentials in local checks.

## Implemented

- Signup, verification resend, password reset and email-change proof atomically write
  a token digest, minimized outbox event, AES-256-GCM ciphertext and one durable
  `account_email_delivery` record. Signup now owns its initial token. Security notice
  uses the existing old-address snapshot and has no action token.
- Token ciphertext is bound to outbox ID, account ID, event type/version and logical
  work key. Production requires `ACCOUNT_EMAIL_KEYRING` JSON with an active key and
  any still-needed prior keys. Each key is 32 random bytes encoded as base64. Keep
  old keys through expiry and purge. Local nonproduction has a fixed local-only key;
  never deploy it.
- Replacement marks prior READY/LEASED work in that token family SUPPRESSED and
  erases ciphertext in the same transaction. The dispatcher repeats account,
  token, binding and expiry guards before SENDING. A request already in SENDING can
  race replacement; its old single-use link is inert.
- Four versioned English templates and configured-origin fragment links follow
  ADR-088. Fragment action pages must clear fragments before POST, set
  `Referrer-Policy: no-referrer`, load no third-party resources and avoid caching.
  The pages are not implemented; the dispatcher must remain unmounted until they
  work. Brevo transactional link/open tracking must be disabled because tracking
  redirects can alter fragment links.
- `dispatchOneAccountEmail()` claims one job using PostgreSQL `SKIP LOCKED`, a
  two-minute fenced lease and a five-attempt limit. Explicit 429 responses retry
  after 30, 60, 120 and 240 seconds. Definite 4xx fails. Network, timeout, malformed
  success response and 5xx outcomes enter UNKNOWN, without automatic resend.
  Expired LEASED work is reclaimable; expired SENDING work becomes UNKNOWN.
- `recoverAndClean()` expires READY work, recovers leases, removes expired account
  token rows, and deletes terminal outbox/job records after 30 days. Email-change
  security notice work expires after seven days. Retention cleanup still needs a
  scheduled worker after deployment is selected.

## Available checks

Run from `app` after setting an explicit loopback `SIGNUP_TEST_DATABASE_URL` for the
dedicated `halaga_signup_test` database:

```powershell
npm.cmd run db:generate
npm.cmd run test:signup
npm.cmd run test:verification
npm.cmd run test:reset
npm.cmd run test:email-change
npm.cmd run test:account-email-intents
npm.cmd run lint
npm.cmd run build
```

The account suites create disposable schemas and use `.invalid` addresses. Do not
set `BREVO_API_KEY` for these suites. Provider delivery and new dispatch/recovery
fake-provider checks have not been run. Do not run a persistent migration against a
participant or deployed database. Add synthetic provider tests before mounting any
worker.

## Remaining gates

- Account routes, client fragment consumption, cookies, sign-in/session races and
  password-change security notice writes.
- Restricted staff/audit access for FAILED/UNKNOWN reconciliation and controlled
  retry. UNKNOWN must not be auto-retried because provider acceptance may have
  preceded a crash.
- Worker hosting/scheduling, production key provisioning/rotation, trusted origin,
  authenticated sender domain, Brevo tracking settings and current free-tier/billing
  review.
- Launch privacy, backup, retention/deletion, availability and quota checks under
  ADR-081. No real participant email is authorized before those checks pass.
