# Unmounted password reset: local synthetic testing

This Slice 2 implementation follows accepted ADR-087. It is an internal server
repository, not an HTTP route or Server Action. No account UI, email dispatcher,
provider callback, or delivery is mounted. Use fictional `.invalid` addresses
and synthetic credentials only; do not submit real participant data.

## Setup

Use the installed Node version from `app/.nvmrc` and the existing local
PostgreSQL instance. The generated Prisma client and installed dependencies are
required. From the repository root, enter `app`.

The checks require an explicitly supplied loopback PostgreSQL URL naming the
separate database `halaga_signup_test`, using the local role that can create
and remove schemas and install the existing migrations. There is no fallback
to the application `DATABASE_URL`. If this database is absent, create the
empty test database with your local PostgreSQL administration tool, owned by
that local role. Do not use the application database or a deployed database.

```powershell
cd app
# Replace the example role/password with your local test credentials.
$env:SIGNUP_TEST_DATABASE_URL = 'postgresql://halaga:halaga@127.0.0.1:5432/halaga_signup_test?schema=public'
npm.cmd run test:reset
```

Each run creates a random `signup_test_*` schema, applies the existing checked-in
migrations inside it, and removes the schema in `finally`. Both Prisma model
queries and raw locking queries use that schema. The tests do not migrate the
persistent local application database. Reset needs no new migration or package.
Do not print or commit database credentials. Node may print the existing
`MODULE_TYPELESS_PACKAGE_JSON` warning; it is not a test failure.

## Direct manual exercises

Run these from `app`, with the explicit test URL above. No development server
or browser is required. Each invocation creates fresh fixtures and cleans up.

```powershell
node --conditions=react-server scripts/try-reset.mjs success
node --conditions=react-server scripts/try-reset.mjs verified
node --conditions=react-server scripts/try-reset.mjs expiry
node --conditions=react-server scripts/try-reset.mjs reuse
node --conditions=react-server scripts/try-reset.mjs replacement
node --conditions=react-server scripts/try-reset.mjs failure
node --conditions=react-server scripts/try-reset.mjs commit-failure
node --conditions=react-server scripts/try-reset.mjs issue-failure
```

The script signs up a fictional adult, issues a separate verification token,
creates two Better Auth sessions, and issues one reset token. `verified` consumes
the verification token before sign-in; the other exercises leave it outstanding.
Output contains only synthetic status codes, counts, and booleans.

| Exercise | Expected result |
| --- | --- |
| `success` | `PASSWORD_RESET`; reset token count goes from one to zero, sessions from two to zero. Both verification states remain false and the verification token remains outstanding. Old-password sign-in fails; new-password sign-in succeeds with email still unverified. |
| `verified` | Same reset/session effects, but both verification states remain true, and fresh sign-in remains verified. |
| `expiry` | The synthetic clock advances to exactly one hour after issue. `INVALID_TOKEN`; credentials, sessions, token and both verification states remain unchanged. No real wait is needed. |
| `reuse` | First consume succeeds; second returns `INVALID_TOKEN`, with no second password change or session creation. |
| `replacement` | A second issue invalidates the first token. Only the replacement succeeds. Email-intent count is four instead of three; intents remain undispatched. |
| `failure` | A PostgreSQL trigger rejects session deletion. `INTERNAL_ERROR`; token, old password and both sessions survive. Removing the trigger permits the same token to succeed. |
| `commit-failure` | A deferred trigger rejects transaction commit after the password write. All effects roll back; removing the trigger permits same-token retry. |
| `issue-failure` | A trigger rejects the replacement email intent. `INTERNAL_ERROR`; the prior token and intents survive, and that prior token still completes reset. |

Before reset, email-intent count is three: signup, explicit verification issue,
and reset issue. Consume does not create another email intent. After successful
reset, sessions are zero until the script explicitly signs in with the new
password. Every invocation ends with the cleanup message and sends no email.

The full database suite also covers every required write failure, issue commit
failure, configured password limits, hasher failure, expiry after hashing,
unknown/future tokens, last valid millisecond, current-address binding,
missing/deleted/unmapped identities, missing/ambiguous credentials, mismatched
verification states, unrelated-account/provider isolation, concurrent issue and
consume, issue racing consume, and verification racing reset. Existing cookie
sessions fail account access after reset; fresh Better Auth sign-in uses the
replacement hash and preserves verification status.

To rerun nearby flows:

```powershell
npm.cmd run test:signup
npm.cmd run test:verification
npm.cmd run test:auth
npm.cmd run test:foundation
npm.cmd run lint
npm.cmd run build
```

The existing auth/foundation suites additionally require the local application
`DATABASE_URL`; they use their existing isolated/temporary synthetic fixtures.
Clear the explicit test variable when finished:

```powershell
Remove-Item Env:SIGNUP_TEST_DATABASE_URL
```

## Recorded verification (2026-10-14 PHT)

From `app`, `npm.cmd run test:reset` passed all 12 checks. Nearby scripts passed:
`test:signup` (7), `test:verification` (11), `test:auth` (8), and
`test:foundation` (21). `npm.cmd run lint` and `npm.cmd run build` passed;
`git diff --check` passed from the repository root. All eight direct
`node --conditions=react-server scripts/try-reset.mjs <scenario>` exercises
passed. The dedicated test database had zero remaining `signup_test_*` schemas
afterward. The build listed only the existing home/not-found pages, with no
account route. Tests retained the existing module-format warning.

No persistent migration, dependency install, real-data, email/provider or
deployment check ran. Browser/accessibility checks were skipped because no UI
or route changed. These checks establish the local unmounted boundary only.

## Implementation and remaining boundaries

`createPasswordResetOperations(database, auth, clock)` exposes `issue(email)`
and `consume({ token, newPassword })` to trusted internal callers. Issue returns
restricted `{ token, expiresAt }` after commit, or `null` for an ineligible
identity. This return value must never be a public request response. Future
reset-request handlers must use the same generic confirmation for every
eligible/ineligible account outcome and enforce ADR-086 endpoint/IP limits.
Malformed inputs and internal failures use fixed private-safe rejection codes.

Opaque random 32-byte reset tokens expire one hour after issue. The existing
private Better Auth verification table stores a namespaced SHA-256 digest,
identity reference, current-email binding and timestamps. Identity/domain locks
serialize reset issue/replacement/consume and email verification. Reset also
locks and requires exactly one existing, correctly mapped password credential;
it does not repair legacy identities. Verified and unverified accounts can reset.
Reset neither repairs mismatched verification states nor grants marketplace access.

Issue atomically replaces only the outstanding reset token and adds a minimized,
token-specific `account.password-reset-email-requested` outbox intent. Existing
verification tokens and earlier undispatched intents remain unchanged. Consume
uses the installed Better Auth password hasher and configured limits, then
rereads account/credential/token/address/deadline guards under locks. One
transaction consumes the token, updates the credential hash and deletes every
stored session for that identity. Write or commit failure preserves all old
state for retry before the original expiry. Successful replay is rejected;
reset does not create an authenticated session.

Direct credential writes bypass library reset hooks. No reset hooks or plugins
are configured currently. Recheck compatibility when Better Auth, its schema,
password configuration, database hooks or plugins change.

The outbox holds no email, password, raw token or recoverable reset link. Durable
private token transport, stale-intent suppression and ADR-073 dispatch/jobs,
leases, retries and controlled failed-job recovery remain future integration.
Pending intents are never delivered by this slice. Delivery failure must not
undo a committed action. No cleanup schedule, retention change, worker retry
allowance, provider or paid service is selected.

All routes/UI/delivery stay unmounted. Future route integration must review
cookie clearing and sign-in/reset concurrency, including sign-in that checked
old credentials before reset but attempts session creation afterward; direct
library sign-in does not participate in these account-owned locks. Synthetic
checks here prove revocation of existing stored sessions and serialized account
commands, not a mounted sign-in race boundary. Email-change flows, restrictions,
full authorization, proxy/origin trust, secret provisioning, cleanup and ADR-081
launch readiness remain gates. Browser/accessibility and real-email/provider
checks do not apply to this unmounted server-only exercise.
