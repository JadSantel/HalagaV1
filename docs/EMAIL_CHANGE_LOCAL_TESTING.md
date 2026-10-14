# Unmounted email change: local synthetic testing

This Slice 2 repository implements accepted ADR-087 for local synthetic data.
No route, Server Action, UI, token transport, dispatcher or email delivery is
mounted. Use fictional `.invalid` addresses and synthetic passwords only.

## Setup

Use the pinned Node version in `app/.nvmrc`, installed dependencies and local
PostgreSQL. From `app`, generate the client for the checked-in schema, then
provide an explicit loopback URL for the separate `halaga_signup_test` database.
Create that empty database with your local administration tool if absent, owned
by a role permitted to create/drop schemas and install the existing migrations.
There is no fallback to the application's `DATABASE_URL`.

```powershell
cd app
npm.cmd run db:generate
# Replace example credentials with your local test role/password.
$env:SIGNUP_TEST_DATABASE_URL = 'postgresql://halaga:halaga@127.0.0.1:5432/halaga_signup_test?schema=public'
npm.cmd run test:email-change
```

The existing signup sandbox creates a random `signup_test_*` schema, replays
checked-in migrations and removes the schema in `finally`. Model queries and
raw lock queries use that schema. No persistent application migration runs.
Do not print or commit database credentials. The existing Node
`MODULE_TYPELESS_PACKAGE_JSON` warning does not indicate a failed check.

## Direct manual exercises

With that test URL set, run from `app`; each invocation has fresh fixtures and
cleanup. No browser or development server is needed.

```powershell
node --conditions=react-server scripts/try-email-change.mjs success
node --conditions=react-server scripts/try-email-change.mjs expiry
node --conditions=react-server scripts/try-email-change.mjs reuse
node --conditions=react-server scripts/try-email-change.mjs replacement
node --conditions=react-server scripts/try-email-change.mjs freshness
node --conditions=react-server scripts/try-email-change.mjs conflict
node --conditions=react-server scripts/try-email-change.mjs failure
node --conditions=react-server scripts/try-email-change.mjs commit-failure
node --conditions=react-server scripts/try-email-change.mjs issue-failure
```

The script signs up and verifies a fictional adult and signs in twice with
Better Auth. Output includes only fixed status codes, booleans and counts.
Token/cookie/address/credential material stays inside the synthetic process.

| Exercise | Expected result |
| --- | --- |
| `success` | Request leaves the old verified address primary and two sessions intact. Proof returns `EMAIL_CHANGED`, leaves the new address verified, removes the pending token and both sessions, and records one undispatched notice addressed to the old address. Old-address sign-in fails; new-address sign-in succeeds with the same password. |
| `expiry` | At exactly 24 hours, proof returns `INVALID_TOKEN`. Old address, verification, sessions and pending token remain unchanged. The clock advances synthetically; no real wait. |
| `reuse` | First proof succeeds; second returns `INVALID_TOKEN` without another notice or switch. |
| `replacement` | The second request invalidates the first token and grants the replacement a full 24 hours. Only replacement proof succeeds; one additional verification intent remains undispatched. |
| `freshness` | A session created exactly 15 minutes earlier returns `UNAUTHORIZED`, despite a recent renewal timestamp. No token or change intent is created. |
| `conflict` | Another synthetic signup claims the proposed address after issue. Proof returns `INVALID_TOKEN`, preserving the token and old state. Freeing that address in the disposable fixture permits same-token retry. |
| `failure` | A PostgreSQL trigger rejects session deletion during proof. `INTERNAL_ERROR` rolls back token consumption, address switch and verification update. Removing the trigger permits same-token retry. |
| `commit-failure` | A deferred trigger rejects commit after security-notice insertion. Old address, token and sessions survive; no notice commits. Removing the trigger permits same-token retry. |
| `issue-failure` | An outbox insert failure during replacement rolls back replacement; the original token and intent remain. Original proof still succeeds. |

Before proof, intent count is three: signup, explicit initial verification, and
email-change verification. Successful proof adds one security-notice intent;
replacement adds another verification intent. `freshness` never issues change
work and retains the two initial intents. Proof leaves zero sessions until the
script explicitly signs in again. All invocations clean up and send no email.

The database suite additionally checks every required request/completion write
and deferred commit failure, retry, the final valid millisecond, future issue,
unknown/malformed tokens and bindings, missing/deleted/remapped accounts,
adult and verification eligibility, current/proposed address guards, unchanged
credentials/eligibility history/separate verification and reset tokens, unrelated
accounts, concurrent requests/proof, replacement racing proof, two accounts
claiming one proposed address, revoked/changed/expired/future/stale sessions,
locked deadline rechecks, and old-recipient schema enforcement.

Nearby checks:

```powershell
npm.cmd run test:signup
npm.cmd run test:verification
npm.cmd run test:reset
npm.cmd run test:auth
npm.cmd run test:foundation
npm.cmd run lint
npm.cmd run build
Remove-Item Env:SIGNUP_TEST_DATABASE_URL
```

Auth/foundation checks also require the local application `DATABASE_URL` for
their existing isolated/temporary fixtures.

## Server operation and schema boundary

`createEmailChangeOperations(database, auth, clock)` exposes
`issue(headers, { proposedEmail }, applySessionHeaders)` and `consume(token)`.
Owner comes exclusively from Better Auth's stored-session resolution with cookie
cache disabled. The headers callback preserves future cookie-response handling.
Request locks identity/domain mapping, then rereads and locks that exact stored
session. It rejects missing, revoked, expired or future sessions and creation age
at or above 15 minutes, including time spent waiting for locks. Renewal does not
renew freshness. Caller-selected account/session IDs are not accepted.

Both commands require an undeleted mapped account with the existing adult
prerequisites and matching verified identity/domain state. These checks neither
implement a policy for existing underage accounts nor grant marketplace actions;
restrictions and full command authorization remain separate integration gates.

The private verification table stores a separate `halaga-email-change:` SHA-256
token digest, identity reference and strict JSON binding of domain account ID,
current address and normalized proposed address. Opaque tokens use 32 random
bytes, expire 24 hours after issue and return only after commit to the trusted
internal issuer. They must never become a public request response. Request
replaces only its own prior pending token and records a token-specific minimized
`account.email-change-verification-requested` outbox intent. Old intents remain
undispatched; future delivery must suppress stale work.

Proof needs the single-use token, not a still-fresh initiating session. Under
identity/domain and token locks it rechecks account mapping, eligibility,
current/proposed addresses, token identity, creation time, expiry and address
availability. The existing unique email constraint arbitrates competing claims.
One transaction removes the token, switches and verifies the auth address,
updates the domain verification timestamp, deletes all stored sessions and
records one `account.email-changed-security-notice` intent. Write/commit failure
rolls back every effect, leaving the token retryable before its original expiry.
Account identity and history, credentials, other token families and unrelated
accounts remain intact. Errors expose only fixed codes without raw causes.

The original outbox has only an account reference, type/version, work key and
timestamps. After a switch, the reference resolves to the new address; it cannot
identify the required old recipient. This is the schema blocker for a durable
old-address notice. The narrow additive migration
`20261014100000_email_change_notice_recipient` adds nullable `recipientEmail`.
A SQL check requires it for the security-notice event and forbids it for other
event types. Existing intents remain null; no history is fabricated. This is
the only schema change and adds no dependency. The migration was replayed only
in disposable synthetic schemas, not applied to persistent local/deployed data.

### Security-notice intent privacy review

Version 1 records the old-address recipient snapshot, account reference,
token-digest-based logical-work key and event time. The recipient is private
delivery data, not a general event payload or a public/account-access projection.
The intent contains no proposed/current-new address, raw token/link, DOB,
password/hash, session, IP, user agent, message content or rendered email body.
Its sole purpose is an account-security notice to the previously verified
address. A future renderer may state that the account email changed and that
sessions were revoked; it must not dereference the new address into the notice
or disclose unrelated account/workflow data. No renderer, approved bilingual
template, support/recovery link or delivery implementation is created here.

Recipient access must remain purpose-limited to delivery and authorized,
audited staff diagnosis. Do not expose it through logs, analytics, metadata,
public caches, generic event readers or unrelated-user responses. The snapshot
is subject to approved retention/deletion rules; preserving intent history does
not authorize indefinite recipient retention. Cleanup and delivery-state
retention still require integration review before real data. No new retention
period, expiry-as-cleanup rule, worker schedule or retry allowance is selected.

## Recorded verification (2026-10-14 PHT)

`npm.cmd run db:generate` passed. `test:email-change` passed 16 checks; nearby
`test:signup` (7), `test:verification` (11), `test:reset` (12), `test:auth` (8)
and `test:foundation` (21) passed. Lint and build passed; the build lists only
the existing home/not-found pages. All nine manual exercises passed.
`git diff --check` passed from the repository root. The dedicated test database
had zero remaining `signup_test_*` schemas after verification.

The first email-change run failed a fresh account-access assertion because its
synthetic verification timestamp was ahead of the reader's real clock. Using
the current instant corrected the fixture; all subsequent checks passed.
A preliminary inline database probe failed PowerShell/Node quoting before
database access; running the existing test scripts with private environment
setup confirmed the dedicated database was ready. The existing module-format
warning remains. No dependency install, persistent migration, deployment,
provider delivery or real-data check ran. No UI changed, so browser/accessibility
checks were skipped.

## Remaining integration gates

Keep routes, UI, email delivery and token transport unmounted. Future handlers
need ADR-086 endpoint/IP limits, origin/CSRF protection, cookie-header propagation
and cookie clearing after proof, reviewed safe response projections and error
serialization. Direct `auth.api` calls do not provide endpoint rate protection.
Direct identity writes bypass Better Auth email-change hooks; review installed
library/schema/plugin/hook compatibility on changes.

Durable private token transport, stale-intent suppression and the full ADR-073
dispatch/job path (idempotency, expiring leases/recovery, bounded retries and
audited controlled retry) remain unimplemented. Delivery failure must never undo
a committed change. Before using this repository outside synthetic schemas,
apply the narrow migration through the reviewed migration workflow and regenerate
the client. Production sender/template/privacy review, retention/cleanup,
restrictions, proxy/origin trust, secret provisioning and ADR-081 launch readiness
remain gates.

Library sign-in/session creation does not share these account-owned locks. Tests
prove revocation of stored sessions and serialized account commands, not a
mounted sign-in race boundary. Integration must prevent an old-address sign-in
that validated before proof from creating a session afterward. No new origin,
provider, deletion process, paid service or operational parameter is selected.
