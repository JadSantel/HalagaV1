# Unmounted authenticated password change: local synthetic testing

This Slice 2 operation implements the credential/session part of ADR-087 using
synthetic data. Routes, Server Actions, UI, email delivery and endpoint integration
remain unmounted. Use fictional `.invalid` addresses and synthetic passwords only.

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
schema. No persistent application migration is run. No dependency or migration is
needed: the existing identity, mapping, credential and session tables suffice.
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

All exercises assert unchanged token and outbox counts. They create no
password-change notice intent. They verify only the credential/session slice;
the approved required notice writes remain unimplemented and block mounting.

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
again after verification. It updates only the existing credential and deletes all
other stored sessions, including expired ones, in one transaction. It creates no
replacement session and never changes the initiating session's creation time.

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
cleanup remain unresolved. This resolves the policy gap, not the implementation.

The current operation still creates no notice intent. Unchanged-outbox assertions
are deliberate tests of this incomplete credential/session slice, not full ADR-087
compliance. The mounting-boundary regression checks disabled previews and absence
of password-change command wiring while required notice writes are missing.

Before mounting, implement the approved required atomic notice writes;
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
