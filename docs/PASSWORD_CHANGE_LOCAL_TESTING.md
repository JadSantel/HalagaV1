# Unmounted authenticated password change: local synthetic testing

## Implemented email pipeline and approved rules (2026-10-20 PHT)

The owner explicitly approved all three policy questions. Accepted
[ADR-089](decisions/ADR-089-password-change-email-and-retention.md) resolves the
previous email/retention brief's copy, deadline, recipient/metadata/in-app retention,
cleanup and deletion decisions. The earlier prerequisite audit was superseded by
that approval. This section supersedes historical email-unimplemented, unresolved
policy and unchanged-outbox wording below; historical verification records remain
dated records.

Every successful change atomically records its in-app notice. When both locked
verification stores qualify at event time, the same transaction also writes one
email intent, immutable primary-address snapshot and delivery job. Required insert
or deferred-commit failure rolls back credentials, revocation and both channels.
The exact initiating session survives. Ineligible events create no email work or
snapshot; verification later never backfills. Work keys use the opaque change UUID.

The existing inspector returns fixed statuses only. The existing dispatcher sends
ADR-089's link-free version-1 text/HTML with the original PHT event timestamp.
Delivery uses the immutable snapshot, even after an email switch; it never fetches
the current primary address as a fallback. Existing leases, five-attempt 429
backoff and UNKNOWN quarantine apply. Addressing and delivery internals remain
outside command responses, owner notice detail, page metadata and operational logs.

| Data/work | Implemented boundary |
| --- | --- |
| Email delivery | Original event plus seven elapsed days; equality is expired. No retry/recovery extension. |
| Recipient | Erased atomically on ACCEPTED/SUPPRESSED or committed deletion; FAILED/UNKNOWN retain only until original delivery expiry. Erased addressing cannot be restored or retargeted. |
| Email metadata/deduplication | Purged with outbox and cascaded job after 30 terminal days, capped at 37 event days. Late cleanup/acknowledgement cannot restart the cap. |
| Owner notice/eligibility/read state | Independently retained for 90 event days, shortened by committed deletion. Reader excludes expired events before physical cleanup; reads do not restart retention. |
| Committed deletion | SQL trigger atomically suppresses READY/LEASED, fences SENDING as UNKNOWN and erases all password-change recipients/notices. Terminal outcomes remain truthful. In-flight mail may still arrive. |
| Cleanup | Existing manual worker invocation; account-to-job locks, fenced outcomes, restart-safe erasure/purge. No new schedule, backfill or permanent per-recipient cleanup log. |

Migration `20261020090000_password_change_email_retention` narrows recipient purpose,
requires a recipient at email-intent creation, enforces immutable event/address
binding and original job deadline, and installs the committed-deletion trigger.
Prisma's nullable recipient column is unchanged; SQL-only guards are documented in
the physical schema review. Migrations were replayed only in disposable synthetic
schemas, never applied to the persistent/shared database.

Existing script definitions were inspected before running from `app`. A launcher
loaded local configuration without printing it, selected loopback
`halaga_signup_test` for both database variables and disabled real sending.
Signup sandboxes remove their random schemas in `finally`; foundation checks use
rolled-back synthetic schemas. Provider classification uses mocked fetch only.

| Command | Result |
| --- | --- |
| `npm.cmd run test:password-change` | 30 passed; eligibility, insert/commit rollback, concurrent writers/claims, immutable addressing, delivery failures, retries/lease fencing, expiry/deletion races, separate cleanup clocks and safe owner projection. |
| `npm.cmd run test:signup` | 7 passed. |
| `npm.cmd run test:verification` | 11 passed. |
| `npm.cmd run test:reset` | 12 passed. |
| `npm.cmd run test:email-change` | 16 passed. |
| `npm.cmd run test:account-email-intents` | 13 passed. |
| `npm.cmd run test:account-email` | 27 passed; existing four-message behavior preserved. |
| `npm.cmd run test:sign-in` | 34 passed, including protected HTTP and both password-change lock orders. |
| `npm.cmd run test:logging` | 5 passed. |
| `npm.cmd run test:foundation` | 21 passed. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed compilation, TypeScript and page generation. |
| `node --conditions=react-server scripts/try-password-change.mjs success` | Passed; unverified change records no email intent. |
| `node --conditions=react-server scripts/try-password-change.mjs verified` | Passed; verified change records one eligible email intent. |

The ten final test scripts reported 176 passes, zero failures/skips. An earlier
implementation run passed 29 password-change tests before the additional lock-wait/
expiry-acknowledgement coverage was added. Existing `MODULE_TYPELESS_PACKAGE_JSON`
warnings remain. Other direct exercise scenarios were not rerun in this slice;
their affected guards are covered by the automated suite. No browser/accessibility
run was needed: no UI changed.

Command and owner-reader mounting, protected password-change HTTP/client flow and
direct-write compatibility review remain gates. The preview stays disabled.
Provider/backup purge evidence, restore safeguards, hold enforcement/audited staff
reconciliation, worker/hosting readiness and all ADR-081 real-data launch checks
remain required. The deletion trigger supports the future deletion commit; this
slice does not implement a deletion endpoint or hold-management workflow. Physical
cleanup can be delayed by outages; original cutoffs remain fixed on resumption.
No real sending, participant data, service, dependency, schedule or deployment.

Update 2026-10-18 PHT: the account sign-in operation serializes
Better Auth credential/state reads through session commit with password change,
reset, verification and email proof. Both lock orders and real PostgreSQL waits
are verified in [SIGN_IN_LOCAL_TESTING.md](SIGN_IN_LOCAL_TESTING.md). This supersedes
the internal race-gate statements below for that operation; raw library sign-in
remains unserialized. Protected POST sign-in and its accessible form are now
mounted for local synthetic testing only; password-change email and other mounting gates
remain. No password-change route, preview or email path is enabled.

This Slice 2 operation implements credential/session changes and atomic in-app/
eligible email notices under ADR-087/089 using synthetic data. Password-change
routes, Server Actions, notice readers and UI remain unmounted/disabled. Protected
endpoint integration exists for synthetic testing; the application exposes only the
existing six email commands plus protected serialized sign-in and signup. Use fictional `.invalid`
addresses and synthetic passwords only.

## Setup and automated checks

Use the pinned Node version in `app/.nvmrc`, installed dependencies, the generated
Prisma client and local PostgreSQL. Create a separate empty `halaga_signup_test`
database through your local administration tool if absent. Its role needs permission
to create/drop schemas and replay the checked-in migrations. The sandbox requires
an explicit loopback test URL; it never falls back to application `DATABASE_URL`.

```powershell
cd app
npm.cmd run db:generate
# Replace the example role/password with your local test credentials.
$env:SIGNUP_TEST_DATABASE_URL = 'postgresql://halaga:halaga@127.0.0.1:5432/halaga_signup_test?schema=public'
npm.cmd run test:password-change
```

Every invocation creates a random `signup_test_*` schema, replays existing migrations
and drops that schema in `finally`. Prisma queries and raw lock queries share that
schema. Migration `20261017090000_password_change_in_app_notice` adds the narrow
owner-private in-app store, with unique opaque event/work identities, fixed eligibility
and nullable read time. It does not broaden the existing email-recipient constraint.
No persistent/shared application migration or new dependency is run/installed.
Both raw sandbox and pooled Prisma connections use UTC. The installed adapter
strips timestamptz offsets rather than converting them, so an implicit PHT database
connection can shift a raw timestamp eight hours. Application Prisma connections now
also pin UTC; event instants remain UTC and existing PHT business/display rules apply.
No existing persistent timestamp is repaired or rewritten; recreate disposable
fixtures rather than treating this slice as a data-conversion migration.
Do not print or commit database credentials. The existing Node
`MODULE_TYPELESS_PACKAGE_JSON` warning does not indicate a failed check.

The checks cover strict input/configured password limits; missing, forged, revoked,
expired and future-created sessions; 899,999/900,000/900,001 millisecond creation-age
boundaries; renewal without freshness; verified/unverified and mismatched verification
states; missing eligibility; deleted/missing/remapped accounts; missing, empty,
misbound or ambiguous credentials; current-password rejection; hash/verify failures;
each write and deferred commit failure; exact rollback and same-session retry;
post-resolution/hash/session/mapping changes; freshness after actual lock waits and
password verification; unrelated-account/provider isolation; all three token families;
concurrent same-session/different-session changes; and reset/verification/email-proof
races. Better Auth confirms the initiating cookie survives, other cookies fail,
the old password fails and the new password signs in.

Notice checks add all boolean/timestamp eligibility combinations (including equality
and future timestamps), post-lock rereads after actual waits, event time after password
verification, deterministic overlapping verification/email-proof in both lock orders,
pending email changes, notice-insert and deferred-commit failure/retry, successful replay
rejection, distinct successes at one instant in one session, duplicate event/work
constraints, safe owner-only projections, revoked/deleted/unrelated readers, fixed
errors and log silence. Failure and repeated execution of an existing signup-email
job leave committed credentials and in-app notices intact. This is delivery isolation
coverage, not password-change email delivery or recipient-binding coverage.

## Direct manual exercises

With the test URL set, run from `app`. No browser or development server is required.

```powershell
node --conditions=react-server scripts/try-password-change.mjs success
node --conditions=react-server scripts/try-password-change.mjs verified
node --conditions=react-server scripts/try-password-change.mjs freshness
node --conditions=react-server scripts/try-password-change.mjs last-millisecond
node --conditions=react-server scripts/try-password-change.mjs wrong-password
node --conditions=react-server scripts/try-password-change.mjs hash-failure
node --conditions=react-server scripts/try-password-change.mjs failure
node --conditions=react-server scripts/try-password-change.mjs commit-failure
```

Each invocation signs up a fictional adult, issues a verification token and signs
in twice. Only `verified` consumes that token first. Output contains fixed statuses,
booleans and counts; passwords, hashes, cookies, token material and addresses remain
inside the synthetic process. Each invocation removes its schema and sends no email.

| Exercise | Expected result |
| --- | --- |
| `success` | `PASSWORD_CHANGED`; the initiating stored session is unchanged, the other session is revoked, old-password sign-in fails and new-password sign-in succeeds. Verification remains false; the outstanding verification token survives. |
| `verified` | Same behavior with both verification states remaining verified. |
| `freshness` | At exactly 15 minutes from session creation, `UNAUTHORIZED`; the old credential and both sessions remain unchanged. No real wait is needed. |
| `last-millisecond` | At 899,999 milliseconds, the change succeeds and retains the same initiating session. |
| `wrong-password` | `INVALID_PASSWORD`, with the credential and both sessions unchanged; retry with the correct current password succeeds. |
| `hash-failure` | A synthetic configured-hasher exception becomes `INTERNAL_ERROR`; state survives and retry through the real hasher succeeds. |
| `failure` | A PostgreSQL trigger rejects other-session deletion after the credential update. `INTERNAL_ERROR`; the old credential and both sessions survive. Removing the trigger permits same-session retry. |
| `commit-failure` | A deferred trigger rejects commit after the credential write. Every effect rolls back; removing the trigger permits same-session retry. |

All exercises assert unchanged token counts. Only the `verified` exercise adds
one eligible password-change email intent/job; the other exercises leave existing
email work unchanged. Successful changes
add exactly one in-app notice, with ELIGIBLE only for the verified exercise; rejected
or rolled-back attempts add none. Retry after rollback leaves exactly one committed
notice. These exercises do not send mail or establish mounting readiness.

## Operation and privacy boundary

`createPasswordChangeOperation(database, auth, clock)` returns
`change(headers, { currentPassword, newPassword }, applySessionHeaders)`. Only trusted
server callers may supply request headers and dependencies. No account/session ID
is accepted in input. Better Auth validates the signed cookie against stored state
with cookie cache and refresh disabled. Disabling refresh avoids a renewal write
outside the credential transaction; ordinary session readers still use ADR-086
rolling renewal. An already expired session lookup may perform Better Auth's
ordinary expired-session cleanup; it cannot authorize a password change.

The operation snapshots the mapped account ID, hashes the new password with Better
Auth's configured limits/hasher, then locks identity/domain mapping, existing
credential and exact initiating session in that order. It rejects a changed mapping,
deleted account, ambiguous/misbound/missing password credential, revoked/changed
session, or invalid original creation age/expiry. The current password is verified
against the locked current hash with Better Auth's verifier. Freshness is checked
again after verification. It records event time and determines email eligibility from
both stores reread after acquiring the identity/domain locks. It updates only the existing credential and deletes all
other stored sessions, including expired ones, in one transaction. It creates no
replacement session and never changes the initiating session's creation time.

The same transaction synchronously creates `password_change_notice`: random UUID,
account reference, fixed `account.password-changed` version 1, unique
`password-changed-in-app:<UUID>` work key, event time, fixed ELIGIBLE/INELIGIBLE
outcome and nullable read time. No key derives from password/session/address or time.
The row is both the durable notice and the in-app processed-work record; no async
materializer/job can add another logical notice for that committed identity. Failed
insertion or commit rolls back credentials and revocations too. Separate successful
changes retain separate identities even in one session at the same instant.

`createPasswordChangeNoticeReader(database, auth, clock)` is also unmounted. It
accepts request headers and an opaque notice ID, never an owner ID. Its read statement
rechecks the exact stored session, ownership and undeleted mapping; returns only
ID/type/version/event time/read time or null. Email eligibility and work metadata do
not enter this projection. No rendered copy, final template, public/staff reader,
mark-read endpoint, analytics or cache is added. Durable read-state storage is present;
participant presentation and read-state commands remain outside this bounded slice.

Successful output is only `{ status: "PASSWORD_CHANGED" }`. Rejections expose only
`INVALID_INPUT`, `UNAUTHORIZED`, `INVALID_STATE`, `INVALID_PASSWORD` or `INTERNAL_ERROR`,
without raw exceptions or causes. Verification, private eligibility/history, other
provider credentials, verification/reset/email-change tokens, existing outbox intents
and unrelated accounts remain unchanged. Write/commit failure preserves the old
credential and every session for retry while the initiating session remains fresh.
A successful retry using the old password is rejected after a different password
has committed; competing requests cannot authenticate against a stale hash.

## Security-notice decision and remaining gates

ADR-087's 2026-10-15 supplement accepts mandatory in-app notices, verified-only
commit-time email eligibility, immutable binding, atomic writes and no backfill.
ADR-089's owner-approved 2026-10-20 supplement resolves the final email copy,
original delivery window, data classification/retention, cleanup and deletion
questions. The unmounted synthetic implementation and checks above implement them.

Before mounting, integrate the protected password-change HTTP/client flow with
safe errors, initiating-cookie preservation, configured origin/CSRF and ADR-086
endpoint/IP protection. Direct operation calls do not invoke the HTTP limiter or
library change-password hooks. The raw library endpoint is not a substitute: its
other-session option replaces the initiating session. Review direct credential
writes on library/schema/password-configuration/plugin/database-hook changes.

Serialized protected sign-in now shares the account transaction/lock boundary;
both race orders are covered by current tests. Raw library sign-in remains unsafe
to expose. Keep the password-change command and owner detail reader unmounted and
the preview disabled until their integration is separately authorized/verified.

Actual deletion/hold workflows, purpose-restricted audited staff recovery,
provider/backup purge evidence, restore safeguards, secrets/proxy/origin review,
worker/hosting readiness and ADR-081 launch checks remain separate gates. This
slice selects no cadence, service, billing or real-data path.

## Verification record (2026-10-15)

Historical credential/session-only record; the current record below supersedes
its route inventory and statements about missing in-app writes.

`npm.cmd run test:password-change` passed all 13 reported tests (11 database
subchecks plus the database parent and input check). The first run failed the
renewal fixture because its expiry did not make renewal due; the fixture was
corrected and the full command passed. All eight direct exercises above passed.
Regression commands `npm.cmd run test:auth` (8), `npm.cmd run test:signup` (7),
`npm.cmd run test:verification` (11), `npm.cmd run test:reset` (12), and
`npm.cmd run test:email-change` (16) all passed. `npm.cmd run lint`,
`npm.cmd run build` (including TypeScript), and `git diff --check` passed.
The build still exposes only `/` and `/_not-found`; no account route is mounted.
The first attempt to launch the new test through an inline PowerShell/Node
environment wrapper failed because native argument handling removed JavaScript
quotes; no test ran in that attempt. Passing that wrapper through stdin fixed
the launcher. Test URLs were supplied explicitly to subprocesses using the
dedicated local database; no connection material was printed.

## Owner-approved policy update verification (2026-10-15 PHT)

Historical policy-only record; current in-app implementation is described above.

The notice contract is now accepted; required notice writes are still unimplemented.
The existing database assertions continue to describe only the credential/session
slice. A new static regression prevents application command wiring and verifies
disabled previews while this slice lacks the required notices. It is not runtime
delivery, recipient/race or full mounting-readiness verification.

Commands run from `app`:

```powershell
node --conditions=react-server --test --test-name-pattern="password change rejects|notice-incomplete password change" tests/password-change-database.test.mjs
npm.cmd run lint -- tests/password-change-database.test.mjs src/server/repositories/password-change.ts
```

Both selected tests passed; targeted ESLint passed. The existing Node
`MODULE_TYPELESS_PACKAGE_JSON` warning remains. `git diff --check` passed from the
repository root with LF/CRLF warnings. The first broad link check failed on existing
broken links in `app/README.md` to absent `SIGNUP_LOCAL_TESTING.md` (twice) and
`EMAIL_VERIFICATION_LOCAL_TESTING.md`. Comparison with HEAD confirmed these links
predate this update. Follow-up checks passed for 32 existing local links, no new
broken links, approved source status, the accepted-ADR anchor and the unchanged
recipient schema restriction. The missing guides were not recreated in this slice.
No database, full build or delivery tests were run for this
policy/documentation and static-boundary update. Actual notice-intent, recipient,
rollback, duplicate/recovery and provider-failure coverage remains required when
the approved contract is implemented; existing independent delivery gates remain.

## Current verification record (2026-10-17 PHT)

Initial working tree was clean. Read the repository instructions, current accepted
ADR-086/087/088, PROJECT, relevant architecture/design/glossary sections, slice and
notice/testing guides, affected schema/repositories/handler/worker/templates, local
sandbox and package scripts before editing. No accepted policy was reopened.

Commands ran from `app` using the inspected existing scripts. A local stdin wrapper
loaded the existing development database configuration without printing it, changed
only the database name to the dedicated `halaga_signup_test`, and supplied explicit
test environment variables to subprocesses. All database fixtures used disposable
schemas or temporary tables; no persistent/shared migration ran. The sandbox itself
still requires an explicit test URL and never falls back to application configuration.

| Command | Final result |
| --- | --- |
| `npm.cmd run db:generate` | Passed; regenerated the ignored Prisma client. |
| `npm.cmd run test:password-change` | 21 passed, including the parent database check and two non-database checks. |
| `npm.cmd run test:auth` | 21 passed. |
| `npm.cmd run test:signup` | 7 passed. |
| `npm.cmd run test:verification` | 11 passed. |
| `npm.cmd run test:reset` | 12 passed. |
| `npm.cmd run test:email-change` | 16 passed. |
| `npm.cmd run test:account-email-intents` | 13 passed. |
| `npm.cmd run test:account-email` | 20 passed, including mounted-email handler and fake-provider checks. |
| `npm.cmd run test:foundation` | 21 passed. |
| `npm.cmd run test:logging` | 5 passed. |
| `node --conditions=react-server scripts/try-password-change.mjs <scenario>` | All eight documented scenarios passed; each removed its disposable schema. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed compilation, TypeScript and page generation; no password-change command/detail route was added. |
| `git diff --check` (repository root) | Passed; Git reported LF/CRLF conversion notices. |

The combined ten test scripts reported 147 passing tests, zero failures/skips.
Four initial password-change runs failed the new raw-SQL lock-wait fixture's timestamp
assertion/eligibility expectation: PostgreSQL rendered an explicit UTC instant in
the connection timezone, while the installed Prisma adapter replaced the offset
without conversion. ISO parameter formatting alone did not fix it. Pinning application
Prisma and both shared-sandbox connection types to UTC fixed the mismatch; final
lock-wait checks compare the actual stored verification state/time. All checks then
passed, including deterministic overlapping verification/email proof in both orders.
The existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning appeared. The temporary
npm subprocess launcher also reported `DEP0190` for static shell arguments; no
credentials or user input were included in those arguments. No dependency/module
configuration was changed to suppress warnings.

Changed implementation files: `app/prisma/schema.prisma`, the additive
`app/prisma/migrations/20261017090000_password_change_in_app_notice/migration.sql`,
`app/src/server/repositories/password-change.ts`, `app/src/server/prisma.ts`,
`app/tests/password-change-database.test.mjs`, `app/tests/helpers/signup-sandbox.mjs`
and `app/scripts/try-password-change.mjs`. Documentation synchronizes PROJECT,
architecture, glossary, ADR-087 and decision index, slice tracker, notice brief,
this guide, integration guide, app/repository READMEs and physical schema review.

No password-change email send/binding/cleanup test is claimed: dependent behavior
remains unimplemented. No browser/manual accessibility check was needed for these
backend-only changes; no UI was enabled or changed. Sign-in/session-race handling,
hosted scheduling, staff recovery, provider/real-data setup and other launch gates
remain outside this slice. Fake-provider failure uses an already approved signup
email and only demonstrates independence of committed in-app/password state.
