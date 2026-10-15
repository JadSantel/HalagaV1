# Slice 2 account email delivery: blocked execution, tested intent inspection

Implementation record, 2026-10-15 PHT. **Durable delivery is not implemented.**
The independent inspector checks existing account-owned intent/token bindings.
It does not provide private raw-token transport, render messages, call a provider,
materialize jobs, or authorize sending. No route, worker or UI action imports it.
Existing disabled `/account` previews remain unchanged.

## Authority and exact blockers

These requirements are complementary, not conflicting rules from which an
implementation may choose a shortcut:

| Source passage | Required behavior | Decision still needed |
| --- | --- | --- |
| ADR-087, Delivery: “Persist each email intent atomically with the token or account-state change” | Commit durable handoff with the account operation; no post-commit memory callback as delivery | Recoverable private transport representation, purpose-bound access, atomic write/read boundary, secret provisioning/rotation if needed, consumption/replacement/crash handling, removal and retention classification |
| ADR-087, protected-integration record: “No accepted decision specifies durable private transport, crash-safe handoff or stale-intent suppression” | Digest-only tokens and minimized outbox records cannot supply raw links | Accepted transport decision before implementation; initial signup also needs a token association without duplicating a subsequent resend |
| ADR-073, Consequences: worker decisions depend on “polling/scheduling, lease duration, heartbeat, retry allowances, alert thresholds, and recovery operations” | Concurrent claims, expiring leases, reclaim/fencing, versioned bounded exponential retries, restricted failed jobs, audited operator retry | Job-class parameters and ownership, attempt/failure classifications and safe diagnostics, controlled-retry access/audit, original-deadline behavior, rollout and recovery runbook |
| Architecture §6: “Duplicate worker execution must not create duplicate logical notifications” | Idempotent logical handoff and recovery | Provider-acceptance/DB-acknowledgement ambiguity, lost response/lease and reclaimed-worker behavior; a `dispatchedAt` flag alone is insufficient |
| ADR-075, Decision: “Verification, password reset, and transactional notices use privacy-reviewed templates” | Minimal, recipient-specific messages | Approved subject/body/action text for all four messages, link origin/path/encoding and safe consumption/redirect/referrer contract; provider configuration/error projection and current provider capabilities must be reviewed before an adapter |
| PROJECT §28 and architecture §8.2 | Purpose-limited sensitive data and bounded retention | Token transport, notice-recipient, delivery-attempt/diagnostic retention, deletion propagation and cleanup operations; token expiry is not a retention period |

ADR-087's implementation record permits an email-switch notice to say that an
email changed and sessions were revoked, and forbids fetching the new address into
that notice. It expressly selects **no template**. That payload review cannot be
treated as approval of new message copy. No copy, translation, URL convention,
token encryption/storage mechanism, operational number or schedule is selected here.
An accepted follow-up ADR must settle these choices before dependent implementation.

Verification and reset target the token-bound **current address**. Email-change
proof targets the bound **proposed address**. The switch notice uses only the
recorded **old-address snapshot**, never the current identity address. PROJECT
§26.1 does not list these account emails among required paired Cebuano/Bisaya
flows. English remains authoritative; no translation or unsupported claim is added.

Schema review: `verification` holds namespaced digests and private address bindings;
`outbox_event` holds minimized intents plus the notice-only old recipient. Neither
stores recoverable raw-token material. There is no durable-job, attempt, lease,
failure-history or processed-work schema. Existing storage cannot support the
complete path as reviewed. A migration may be necessary **after** a transport/job
decision; inventing columns now would silently choose that decision. No migration
is added or applied to a persistent database in this step.

## Completed independent work

`app/src/server/repositories/account-email-intents.ts` is a trusted, internal
account-module inspector, instantiated only by synthetic tests/manual tooling.
Caller-supplied IDs confer no participant or staff authority. It is not a public,
account-owner, generic-outbox or staff reader and must not be mounted as one.
All persisted reads use explicit projections. Returned data contains exactly one
fixed status, with no address, identity/account ID, DOB, digest, token, URL, binding,
message body, raw error or diagnostic. Exceptions have fixed codes without causes.
It does not emit logs or analytics, cache results or accept raw tokens.

| Status | Meaning, not permission to send |
| --- | --- |
| `MISSING` | No such intent |
| `UNSUPPORTED` | Unknown event type or version |
| `DISPATCH_RECORDED` | Existing dispatch marker; does not assert provider acceptance or delivery |
| `SIGNUP_TOKEN_UNBOUND` | Initial signup intent has no token-specific association; inspector neither issues nor borrows a resend token |
| `TOKEN_CURRENT` | Existing token-specific intent matches current account, token family, binding, original expiry and relevant consume guards at inspection time |
| `NOTICE_RECORDED` | Structurally valid old-recipient snapshot and notice key; no current/new address is fetched |
| `STALE` | Existing state/binding fails inspection; no persisted suppression or deletion occurs |

Token inspections share the identity/domain lock order used by the account
operations. Reset additionally locks and checks the existing credential without
reading its hash. Email-change checks the shared strict binding schema, existing
adult/verification prerequisites and proposed-address availability. Creation and
original expiry are rechecked after waits, including credential waits. Notice
inspection reads only the notice projection and recipient snapshot; it never reads
the identity or token table. It does not select a notice policy for delayed delivery,
deletion, subsequent email changes or recovery.

**Inspection locks end at commit.** Its result can become stale immediately.
It must never be used as a send authorization outside an accepted dispatch/race
contract. It is not a durable-job claim, deduplication/processed-work record,
recovery handler or implementation of exactly-once effects. Repeated inspection
is read-only. Failed inspection does not mark, reschedule or mutate any intent.

Existing account transactions and generic signup/resend/reset responses remain
unchanged. Only the strict email-change binding schema is exported for reuse;
its validation behavior is unchanged. Existing atomic-intent rollback tests remain
applicable. The owner subsequently approved the password-change notice contract in
ADR-087: in-app notice for every success and email only to the commit-time primary
address verified in both stores. Its required atomic notice writes and sign-in/session
races remain separate integration blockers, outside this delivery implementation.

## Isolated local checks

Use installed dependencies/generated Prisma client and the existing local
PostgreSQL instance. Set an explicit URL for the separate `halaga_signup_test`
database using a local test role with schema-creation permission. Do not point at
an application/deployed database or include participant data. The test helper
rejects remote hosts and other database names; it has no application-URL fallback.
If needed, create the empty test database using your local administration tool.

```powershell
cd app
# Supply your local test role/password; do not print or commit credentials.
$env:SIGNUP_TEST_DATABASE_URL = 'postgresql://TEST_ROLE:TEST_PASSWORD@127.0.0.1:5432/halaga_signup_test?schema=public'
npm.cmd run test:account-email-intents
npm.cmd run test:signup
npm.cmd run test:verification
npm.cmd run test:reset
npm.cmd run test:email-change
npm.cmd run test:password-change
npm.cmd run test:auth
npm.cmd run lint
npm.cmd run build
```

The existing sandbox creates a random `signup_test_*` schema, replays checked-in
migrations there, and removes it in `finally`. Model queries and SQL lock queries
share that schema. No persistent migration command, provider account, credentials,
network send, paid service or deployment is used. All addresses end in `.invalid`.

The new suite has 13 passing tests (including the parent): fixed errors/input
validation, unbound signup, recipient bindings/minimized results, repeated
inspection, superseded/consumed tokens, original expiry/future issue, cross-account
relabeling/isolation, changed address/deletion/verification/credential state,
malformed/extra-field/header-injection bindings, old-snapshot-only notice queries,
unsupported/dispatched intents, deferred commit rollback/retry, and actual account/
credential lock waits. These are intent tests, **not delivery tests**.

Required fake-provider/mail-capture tests for rendering, duplicate jobs, transient/
permanent/quota failure, bounded retries, lease loss/reclaim/fencing, crash after
provider acceptance, controlled operator retry and private diagnostic access remain
**blocked and unrun**. No dummy sender or fake successful delivery is supplied to
hide those missing decisions. Transport-write rollback must also be tested once
transport exists. Existing suites check the presently implemented account/intents.

## Direct manual exercises

With that same test URL, run each command from `app`:

```powershell
node --conditions=react-server scripts/try-account-email-intents.mjs verification
node --conditions=react-server scripts/try-account-email-intents.mjs reset
node --conditions=react-server scripts/try-account-email-intents.mjs email-change
node --conditions=react-server scripts/try-account-email-intents.mjs security-notice
```

Each command creates and removes its own disposable schema. It signs up a
fictional adult, prints `SIGNUP_TOKEN_UNBOUND`, issues a token through the existing
trusted internal operation, and inspects its intent twice (`TOKEN_CURRENT` twice).
A replacement makes the first intent `STALE`. Advancing the synthetic clock to
the replacement's original expiry gives `STALE`; restoring the test clock and
consuming the replacement also leaves its intent `STALE`. The security-notice
exercise additionally asserts that the stored recipient equals the original
address and prints `NOTICE_RECORDED`. Every command ends with
`{ dispatched: false, sent: false }`. Output never includes links, raw tokens,
addresses, credentials or provider diagnostics. No development server is needed.

## Verification record

Checks run on 2026-10-15 PHT:

| Command/check | Result |
| --- | --- |
| New intent suite through `node --conditions=react-server --test tests/account-email-intents-database.test.mjs` | 13 passed |
| Combined Node runner, `--conditions=react-server --test --test-concurrency=1`, covering the 14 files backing `test:auth`, `test:signup`, `test:verification`, `test:reset`, `test:email-change`, `test:password-change`, `test:account-email-intents`, `test:foundation` and `test:logging` | 119 passed, zero failures/skips |
| Four direct `scripts/try-account-email-intents.mjs` exercises above | All passed; no dispatch/send |
| `npm.cmd run lint` | Passed |
| `npm.cmd run build` | Passed, including TypeScript; only existing static account previews |
| `git diff --check` | Passed; existing LF/CRLF warnings |

For these runs, existing local-role credentials were reused without printing them;
the child processes received an explicit loopback `SIGNUP_TEST_DATABASE_URL` with
database path `/halaga_signup_test`. The test helper itself remains unchanged and
never falls back to the application URL. Foundation regressions used their existing
rolled-back synthetic fixtures; no persistent migration command ran. Browser/
screen-reader and provider delivery checks were not run for this server-only step.
Unrelated concurrent password-change decision documentation was left untouched.

Initial local execution used the guide's
example credentials and failed PostgreSQL authentication. Execution with the
existing local role against the explicit dedicated test database succeeded.
The first database run also caught a fixture clock preceding signup's database
timestamp; refreshing that synthetic clock fixed the fixture. A shell-quoted
environment-presence probe failed to parse and was rerun through literal stdin.
The existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains informational.
