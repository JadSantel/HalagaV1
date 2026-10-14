# Unmounted signup: local synthetic testing

This Slice 2 operation is server-internal. No signup or verification route, Server
Action, dispatcher, or email sender is mounted. Tests call
`createSignupOperation` directly. The browser laptop prototype does not use it.

## What the transaction does

Signup validates display name, email, password, calendar DOB, and explicit adult
attestation. It evaluates age against today's Philippine calendar date. An
under-18 DOB is rejected before auth access, hashing, or any database write.
Errors contain fixed codes, never the submitted DOB or a raw library exception.

The account-owned repository reuses Better Auth's configured password length
limits and password hasher. The current installed configuration resolves to
8–128 characters; this slice adds no password-policy setting. After hashing,
one Prisma transaction writes:

1. An unverified Better Auth `user` with a lowercase email.
2. A Better Auth `account` credential containing the password hash.
3. A mapped `user_account` with private DOB, display name, server acceptance
   timestamp, and `adult-eligibility-en-v1`.
4. An `outbox_event` with type `account.verification-email-requested`, version 1,
   an account reference, and a unique `signup-verification:<account ID>` key.

Any failed write or failed commit rolls everything back. A duplicate email also
rolls back; existing and new signup return the same `SIGNUP_RECEIVED` result.
The database's unique email constraint prevents concurrent split accounts.
Retries for the same email create no additional account or intent. A duplicate
does not repair an older unmapped identity or create resend work.

The outbox reference is the entire minimized payload: no copied email, DOB,
password, or token. `dispatchedAt` remains null. This is durable pending intent,
not an implemented delivery job. No verification token, session, cookie, or email
is produced by signup. Token issuance/consumption, job materialization, leases,
attempt history, retry policy, deduplicated delivery, controlled retry, and
retention remain gated work. Future dispatch must recheck current account state
and implement ADR-087's 24-hour, single-use, replaceable verification tokens.

The repository intentionally does not call Better Auth's signup API, which owns
its own transaction and optional session/email effects. It writes the installed
1.7.7 identity/credential format inside Halaga's transaction. An integration test
proves Better Auth can sign in using the stored credential. Review this boundary
if Better Auth's schema, credential format, hashing configuration, plugins, or
database hooks change; these direct writes do not run Better Auth signup hooks.
No additional plugins or signup database hooks are configured today.

## PostgreSQL setup

1. Use Node 24 and the repository's installed dependencies. Start your local
   PostgreSQL server. These instructions use a separate, synthetic-only database
   named `halaga_signup_test`. Never point them at a participant database.
2. Open PowerShell in `app`:

   ```powershell
   Set-Location 'E:\Coding Files (New)\HalagaV1\app'
   ```

3. Connect with your local PostgreSQL administrator. Adjust the local administrator
   name/port if needed. If `psql` is absent from PATH, use its installed full path.

   ```powershell
   psql -h 127.0.0.1 -U postgres -d postgres
   ```

4. For a fresh local setup, execute the following SQL. The password is deliberately
   synthetic and must never be used outside this local exercise. If this role or
   database already exists, use the existing synthetic setup instead of rerunning
   its creation statements.

   ```sql
   CREATE ROLE halaga_signup_tester LOGIN PASSWORD 'synthetic-local-only';
   CREATE DATABASE halaga_signup_test OWNER halaga_signup_tester;
   \connect halaga_signup_test
   CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
   \quit
   ```

   The foundation migration requires `btree_gist`. Installing it in public first
   lets tests reference it without taking ownership of a shared extension.

5. Set the test connection only for this PowerShell session:

   ```powershell
   $env:SIGNUP_TEST_DATABASE_URL = 'postgresql://halaga_signup_tester:synthetic-local-only@127.0.0.1:5432/halaga_signup_test?schema=public'
   ```

   The sandbox rejects other database names, remote hosts, and non-public schema
   URLs. There is no fallback to `DATABASE_URL`. It creates a random `signup_test_*`
   schema and replays every checked-in migration there. Prisma targets that schema.
   It disconnects and drops the schema, including every synthetic row, in `finally`.
   Ordinary success/failure cleans up; forcibly killing Node can leave a schema.

6. Generate the client after the schema change:

   ```powershell
   npm.cmd run db:generate
   ```

   The existing Prisma config still requires a valid local `DATABASE_URL` in
   ignored `app/.env`, as shown in `.env.example`. Generation does not migrate or
   write database records. The sandbox applies migrations itself; do not run
   `db:migrate:local` against the test database for this exercise.

## Test the domain operation manually

Run each command from `app`. Every invocation creates and removes its own schema.
No dev server, auth secret, real email address, or provider credentials are needed.

```powershell
node --conditions=react-server scripts/try-signup.mjs adult
node --conditions=react-server scripts/try-signup.mjs underage
node --conditions=react-server scripts/try-signup.mjs duplicate
```

| Scenario | Synthetic input | Expected result before automatic cleanup |
| --- | --- | --- |
| adult | `local-signup@example.invalid`, DOB `2000-01-01`, display name `Synthetic local adult`, password `synthetic-local-password-only`, attestation `true` | `SIGNUP_RECEIVED`; 1 identity, 1 credential, 1 domain account, 1 email intent, 0 sessions, 0 verification tokens. |
| underage | Same fields, DOB `2020-01-01` | `ADULT_ELIGIBILITY_REQUIRED`; all six counts are 0. DOB is never stored. |
| duplicate | Adult input submitted twice in one sandbox | Two identical `SIGNUP_RECEIVED` results; counts remain 1/1/1/1/0/0. |

The direct manual exercise is in `app/scripts/try-signup.mjs`. To try another
synthetic validation case, temporarily edit its `input` object, run `adult`, and
restore your edit. For example, `adultAttestationAccepted: false`, an invalid
email, or calendar DOB `2000-02-30` gives `INVALID_INPUT` and zero writes. Use only
made-up values. The script never prints submitted data or stored credentials.

Run the full failure/concurrency check:

```powershell
npm.cmd run test:signup
```

Expected: seven passed tests, including the parent database test. Tests reject
underage and malformed inputs before auth/database access, validate password
limits, inject a hashing failure and database failures into each required write
and deferred commit, check the PHT eighteenth birthday, reopen the connection to
verify durable intent, race six normalized-email submissions, retry, and sign in
through Better Auth's internal API. That final compatibility check creates a
synthetic session only inside the disposable schema. It sends no email.

## Cleanup and other checks

Verify automatic cleanup with the local synthetic role:

```powershell
psql -h 127.0.0.1 -U halaga_signup_tester -d halaga_signup_test -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'signup_test_%';"
```

Expected: zero rows. If Node was forcibly interrupted, inspect the returned names
and remove only the matching disposable schemas in this dedicated test database:

```sql
DROP SCHEMA "signup_test_<exact inspected suffix>" CASCADE;
```

Optional: after finishing, connect to `postgres` as your local administrator,
confirm no other process uses this synthetic database, then remove the database
and the role created solely for this exercise:

```sql
DROP DATABASE halaga_signup_test;
DROP ROLE halaga_signup_tester;
```

Clear the session setting:

```powershell
Remove-Item Env:SIGNUP_TEST_DATABASE_URL
```

Other repository checks use the existing local `.env` connection and their own
rolled-back/disposable fixtures:

```powershell
npm.cmd run test:auth
npm.cmd run test:foundation
npm.cmd run test:logging
npm.cmd run lint
npm.cmd run build
```

The additive migration `20261014090000_signup_transaction` adds nullable
`user_account.adultAttestationVersion`, creates `outbox_event`, its restrictive
account FK, positive-version check, deduplication uniqueness, and pending-event
index. It neither backfills historical attestations nor changes existing rows.
Apply it to a persistent local application database only through the existing
`db:migrate:local` workflow when needed. This implementation's verification did
not migrate the persistent application database.

No participant readiness, production migration, public route, email delivery,
cleanup schedule, retry numeric setting, hosting, or deployment decision is
approved by these tests. Full marketplace authorization and restrictions remain
separate gates. UI and accessibility behavior are unaffected.

## Verification record (2026-10-14 PHT)

- `npm.cmd run db:check`: passed; existing local database connection only.
- `npm.cmd run db:generate`: passed; generated ignored Prisma client.
- `npm.cmd run test:signup`: 7 passed in dedicated local PostgreSQL.
- `npm.cmd run test:auth`: 8 passed.
- `npm.cmd run test:foundation`: 21 passed.
- `npm.cmd run test:logging`: 5 passed.
- `npm.cmd run lint` and `npm.cmd run build`: passed. Build lists only `/` and
  `/_not-found`; no account routes.
- Direct `try-signup.mjs` adult, underage and duplicate commands: expected results.
  Metadata check afterward found zero remaining `signup_test_*` schemas.
- `git diff --check`: passed.

An initial signup concurrency run failed because Prisma's installed adapter did
not report uniqueness metadata as expected. Duplicate recognition now scopes the
conflict to the identity write and confirms the email after rollback. An initial
auth run failed because its fixture applied only the old foundation migration;
the fixture now also applies the signup migration. Both suites passed afterward.
An initial inline database-setup command had a PowerShell quoting error before
connecting; its corrected stdin-based invocation succeeded.

Node's existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains. A temporary
verification launcher also reported Node's shell-spawn deprecation warning; that
launcher is not a repository script. No dependency install, persistent application
migration, production/deployment, real-data, email-provider or browser/accessibility
check ran. The empty dedicated test database remains available for local exercises;
its optional removal is described above. Unrelated working changes were preserved.
