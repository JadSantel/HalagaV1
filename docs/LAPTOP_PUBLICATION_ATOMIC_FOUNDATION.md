# Atomic laptop publication foundation

Implementation boundary: 2026-10-22 PHT. Synthetic data only.

Later policy supplement (2026-10-22 PHT): the owner explicitly accepted
[ADR-096](decisions/ADR-096-held-review-authorization-and-operations.md), resolving the
held-review authorization/coverage/audit/retention/notice/job/appeal-intake policy
choices. Its [operations runbook](runbooks/HELD_LISTING_REVIEW_OPERATIONS.md)
records the procedure. Older policy-pending statements below preserve this increment's history.
The coordinator remains an internal foundation without an application adapter;
policy acceptance does not implement its required persisted effects or independent
submission/assessment/declaration/geography/readiness prerequisites.

The owner explicitly kept policy-dependent behavior gated after the repository
review identified missing publication job/delivery policies. This increment
implements an internal transaction coordinator and a disposable PostgreSQL adapter
fixture. It does not complete publication, notifications or durable-job execution.
There is no application adapter, physical marketplace migration, endpoint, worker,
schedule, live sending or new staff access. Existing owner review remains read-only.

## Authority and affected boundaries

The initial HalagaV1 working tree was clean. The active gym-management-system
directory contains only a README; implementation belongs to the writable HalagaV1
repository. Root/app AGENTS.md, PROJECT sections 14/25/28/29/34, architecture
sections 3/4.1/4.9/5/6/8.2, design sections 5.3/5.4 and the publication evaluation
record establish the boundary. ADR-058 supplies publication/review semantics;
ADR-078 supersedes its historical unresolved appeal statement. ADRs 069/070/073/084
supply transactional and module boundaries, ADR-085 safe logs, and ADR-090 scoped
restrictions. ADRs 088/089 govern account email only.

Future affected commands are listing submission and review of an exact revision.
The fixture uses DRAFT -> HELD -> REJECTED to test coordination; it does not install
those commands or approve a review policy. Actual eligible publication also needs
the required cycle/availability records and projection work within the transaction.
The existing publication evaluator cannot supply missing risk/evidence assessments
or authorize a lifecycle transition.

Affected readers remain separate: owner-private draft/revision review, future
public active-only projections, recipient-specific notifications, minimized worker
projections, and purpose-authorized staff/audit access. This increment mounts none.
Restricted findings/reasons belong in audit scope, not result/notification payloads
or operational logs. A client-supplied account ID is never recipient authorization.

## Coordinator contract

`defineAtomicPublicationDecision` reuses `defineGuardedCommand` for validation,
actor resolution, transactions and safe logs. The owning repository must supply:

1. A strict JSON command schema with request ID, target, exact revision and SUBMIT
   or REVIEW intent. Include every decision-affecting input in that schema.
2. A real relational transaction and locks covering live identity/session/account
   prerequisites, the listing, and actor/command/request-key reuse. The latter must
   serialize retries even when a reused key names another target. The coordinator
   does not create database locks or constraints itself.
3. Live authorization, checked before receipt access and again before returning
   from the transaction. Include current time checks after waits; held prerequisite
   locks must fence conflicting changes. Replays never grant permission.
4. A uniquely scoped immutable receipt. A matching normalized-input SHA-256 digest
   returns the original safe result, including after later state changes. Changed
   input under the same key rejects. Property order does not change the digest.
   No submitted content is placed in operational logs.
5. A current-state/revision guard and pure decision plan with explicit required
   notification intents/jobs. A mandatory effects validator must reject missing
   policies or incomplete plans; empty arrays cannot silently waive requirements.
6. Domain, append-only audit, notification-intent, job-intent and receipt writers
   that use only the supplied transaction. Audit must bind actor, command, target,
   revision, prior/result state, reason, authoritative event time and correlation.
   Preserve immutable original deadlines and accepted policy versions in work.
   Use database uniqueness for logical event/type/recipient/channel and work keys,
   not array indices alone. The decision UUID binds the writes to one decision.

An exception from any writer, receipt save, final authorization check or commit
aborts the transaction. Retrying a committed command does no new decision writes.
Sending belongs after commit in a separate delivery boundary; no provider callback
exists in the coordinator. Adapters remain trusted internal code: the coordinator
cannot make a callback using another connection, external I/O or weak guards safe.
Receipt/audit/intent retention and safe result projections still need review before
an application adapter is installed. A digest is not a retention exemption.

## Account-email compatibility review and remaining decisions

The existing account dispatcher has useful patterns: account-first lock ordering,
fenced compare-and-set claims, stale-work checks, minimized projections, explicit
fake providers and separation of domain commit from sending. Their general atomic
and idempotency requirements apply under ADR-073. The shared guarded-command helper
is reused; account-email tables, token encryption, templates, address snapshots,
leases, retry classifications/counts, deadlines and retention are not reused.
ADR-088's ambiguous-send quarantine also cannot settle publication recovery policy.

Before implementing a publication adapter or worker, record accepted decisions for:

- Required submission/review events, recipients/channels, safe versioned copy,
  notification preference rules and recipient binding across account/email changes.
- Required job classes and ownership, original due/deadline rules, stale-state
  suppression and each class's idempotency boundary.
- Versioned lease duration, renewal/interruption/reclaim behavior, bounded attempts,
  backoff and failure classification, including ambiguous external delivery.
- Purpose-restricted failed-job inspection, role/assignment checks, access audit,
  retry authority, preserved failed attempts and audited new attempts. ADR-073
  requires controlled retry; it does not supply an implemented staff role model.
- Retention/deletion and scoped exceptions for receipts, audit, intents, recipient
  addressing, attempts and processed-work markers. No account-email values apply
  by default. Existing publication evaluation/evidence/readiness gates also remain.

Hosted workers, polling, provider sending and broad staff tools remain outside this
increment. No new ADR is marked accepted: this is implementation of existing atomic
requirements within the owner's narrowed scope, not a policy decision.

## Verification

Existing `test:foundation` runs the coordinator tests in `guarded-command.test.mjs`.
They use session-local PostgreSQL tables, synthetic identities/data and a fake
delivery failure. They leave no persistent schema or async work. Coverage includes
rollback after domain/audit/each intent/job/receipt writes and a deferred-constraint
commit failure, policy gating, database
uniqueness failures, lost-response retries, changed input, current authorization
on replay and before commit, stale revisions/states, separate submission/review
receipts, original stored job dates, recipient/result minimization and safe logs.
The fake delivery failure occurs after commit and leaves the committed rows intact.
These tests verify the coordinator with a fixture adapter, not a marketplace command.

Duplicate delivery/consumer processing, worker interruption/recovery, late/stale job
execution, bounded retries and restricted staff retry cannot yet be verified: their
production behavior remains deliberately unimplemented pending the policies above.
The tests do not claim exactly-once mailbox delivery, concurrent application-adapter
correctness, a reviewed physical schema, or a retention implementation.

Commands from `app`: `npm.cmd run test:foundation`, `npm.cmd run lint` and
`npm.cmd run build`. Root: `git diff --check`. See the completion report for results.

Final local results on 2026-10-22 PHT:

| Command | Result |
| --- | --- |
| `npm.cmd run test:foundation` | 38 passed, 0 failed/skipped. Includes all coordinator/transaction cases above. Existing Node module-type warnings remain. |
| `npm.cmd run lint` | Passed, including the new server-only/import boundary. |
| `npm.cmd run build` | Passed, including TypeScript checking. No new route. |
| `git diff --check` | Passed; Git reported LF/CRLF conversion notices. |

Changed files: `app/src/server/atomic-publication-decision.ts` (coordinator),
`app/tests/guarded-command.test.mjs` (PostgreSQL fixture/transaction cases),
`app/eslint.config.mjs` and `app/tests/data-access-boundary.test.mjs` (server-only
and repository boundaries), `app/src/server/repositories/README.md`, `PROJECT.md`,
`architecture.md` and this document (contract, verification and policy gates).
