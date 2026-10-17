# Unmounted authenticated password change: local synthetic testing

This Slice 2 operation implements credential/session changes and the independently
accepted atomic in-app notice portion of ADR-087 using synthetic data. Password-change
routes, Server Actions, notice readers and UI remain unmounted/disabled. Protected
endpoint integration exists for synthetic testing; the application exposes only the
existing six email commands. Signup/sign-in remain closed. Use fictional `.invalid`
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

All exercises assert unchanged token and email-outbox counts. Successful changes
add exactly one in-app notice, with ELIGIBLE only for the verified exercise; rejected
or rolled-back attempts add none. Retry after rollback leaves exactly one committed
notice. No password-change email intent or recipient snapshot is created, including
for eligible events. These exercises do not establish full ADR-087 mounting readiness.

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

The owner approved the [decision brief](PASSWORD_CHANGE_NOTICE_DECISION_BRIEF.md)
and contract on 2026-10-15 PHT. ADR-087 now requires an account-private durable in-app
notice after every successful authenticated password change, with email only to
the primary address verified in both stores at commit (`emailVerifiedAt` no later
than the event). Unverified, mismatched or future-dated verification gets no email
intent/snapshot. Password maintenance remains available without verification repair
or marketplace access. Later verification does not backfill an email. Bind required
intents and the eligible immutable recipient atomically with credential/session
writes; later email changes cannot retarget the warning. The ADR records content,
race, retry/failure and retention limits. Final templates and operational retention/
cleanup for this event remain unresolved. This resolves the policy gap, not the
remaining email implementation gates.

Completed: atomic in-app notice, fixed locked eligibility and the safe owner detail
repository. Unchanged email-outbox assertions now describe the explicit gated email
boundary. The mounting regression checks the six-path email allowlist excludes
password change/signup/sign-in, disabled previews, and no application password-change
command/reader wiring. Partial implementation is not a policy exception permitting
public password changes without their mandatory eligible email work.

Remaining decisions, checked against current ADR-087/088 and PROJECT on 2026-10-17 PHT:

1. Approve the final password-change email subject, text and HTML/template contract
   within ADR-087's accepted content limits. ADR-088 approves exactly four other
   messages; neither its email-switch template nor a reset message is a substitute.
2. Explicitly settle ordinary password-change recipient-snapshot and minimal
   delivery-metadata retention/cleanup, delivery-window and delayed/deleted-account
   handling, including the applicability of ADR-088 mechanics. Provider/backup
   deletion propagation remains a readiness check. Do not infer this event's rule
   from transaction/negotiation periods or ADR-079 exception reviews.

Until then, no password-change email intent, recipient snapshot, template, worker
branch, send or later backfill is implemented for any eligibility outcome. The
existing outbox recipient check remains exclusive to the email-switch warning.
No recipient is retained speculatively. In-app retention/deletion execution also
requires readiness review before real data; no ordinary period or schedule is invented.

Before mounting, resolve those email decisions and implement/test atomic eligible
email intent/commit-time recipient binding, immutable addressing across later email
switches, required-write rollback and password-change-specific delivery/recovery;
review direct credential-write compatibility on library/schema/password configuration,
plugin or database-hook changes; integrate safe errors and response cookies with
origin/CSRF and ADR-086 endpoint/IP protection. The direct operation does not invoke
Better Auth's endpoint limiter or change-password hooks. The library endpoint is
not a substitute: its other-session option replaces the initiating session.

Account-owned reset, verification, email-change and password-change commands share
identity/mapping locks. Library sign-in/session creation does not share those locks:
an old-password sign-in racing credential replacement may create a session after
revocation. That integration race must be settled before mounting. Existing durable
dispatch/jobs, retention/cleanup, secrets/proxy/origin review, restrictions/full
marketplace authorization and ADR-081 real-data/launch gates remain. No operational
schedule, retry allowance, provider, paid service or participant data is added.

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
