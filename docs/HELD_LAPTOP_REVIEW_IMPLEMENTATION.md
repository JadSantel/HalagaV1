# Held laptop review: synthetic service foundation

2026-10-22 PHT. **Implemented service layer; not mounted.** Authority: ADR-096,
058/078/080/084/085. Earlier policy/prerequisite records are preserved; their
no-service/no-schema statements are superseded only for this implementation.

## Implemented behavior

The internal repository implements installation-bound owner grants/revocation,
shifts/attendance, triage/claim/handoff/conflicts, exact-revision candidate review,
supported deterministic rejection/correction, seller notices/read state and one
appeal. A protected HTTP adapter is tested with real stored synthetic sessions.
No Next route, UI, bootstrap or held-submission producer installs these operations.
Admin, audit and recovery methods are not HTTP-dispatchable.

Ordinary sign-in never grants staff authority. Owner/reviewer/appeal/audit/recovery
permissions are separate. Coverage needs confirmed training/current shifts and
active scope grants. Consequential commands require original sign-in age below
15 minutes. Session, grants, purpose, assignment, conflict and coverage are checked
before receipt replay and before commit. Audit failure denies sensitive disclosure.

Queue projection is neutral/minimal. Assigned candidate review binds revision
UUID/version and diagnostics without selecting private expectation, contacts,
media keys or unrelated records. Evidence-byte access/media adoption remain absent.
No public/search/metadata/media reader was added; existing drafts exclude HELD.

Supported reasons derive from implemented checks: missing fields, disclosed safety
exclusion, missing declaration or current publication restriction. No invented
detector, arbitrary reason fallback or submitted assessment override exists.
Rejection changes only the exact current HELD revision; correction requests retain
HELD and append history. Approval rechecks state/revision/live evaluation, then
returns `ELIGIBILITY_UNAVAILABLE`: outstanding assessment/geography/declaration/
readiness requirements cannot be overridden.

History, action audit, readable in-app notice, eligible email work and retry receipt
commit atomically. Required-write failure rolls back everything. Changed retry
input conflicts; exact authorized replay is audited. Seller feedback uses accepted
fixed copy/reasons and omits staff identity, rationale and private findings.
Explicit notice reads preserve original availability/read/deadline timestamps.

Appeals require the affected seller, exact rejection, accepted grounds and 1-4,000
Unicode code points of plain text. Filing includes the original deadline instant;
new request IDs cannot create another appeal. No uploads, HTML rendering, link
fetching or arbitrary evidence references are supported. Optional references stay
rejected pending an authorized evidence source. PHT Monday-Saturday targets start
at submission; receipt is separate from human acknowledgement. Original reviewers
cannot claim/review while a different eligible operator is available. Otherwise
resolution requires logged reconsideration addressing every ground. Conflicts
remain blocking. Explicit correction returns to private HELD, never PUBLISHED or
unrestricted. No automatic restoration or second appeal.

## Physical and concurrency review

The additive SQL migration and Prisma scalar mappings cover grants/shifts, exact
requests, conflicts, decisions, appeals/responses, notices, audits/receipts, email
generation/jobs/attempts and exceptions. SQL owns composite FKs, checks and immutable
history triggers. Client generation alone does not install those constraints.
Only disposable fixtures create fictional installation and submission provenance;
a nonempty source-policy string is not producer authorization.

Lock order: sorted identity/domain accounts (actor/seller/admin or handoff target),
initiating stored session, singleton moderation control, listing, review, child
work. The global lock deliberately serializes this local slice. Existing account/
restriction/email commands never acquire it, so their account-first locks fence
review/recipient checks. Pre-lock metadata supplies only lock targets. Current
state is reread after locking; UUID/version/listing/seller are bound consistently.

## Delivery, retention and gates

Sending defaults disabled; only tests inject a fake sender. No provider, CLI
schedule or hosted worker is installed. At most one email is claimed, with fenced
two-minute leases, locked backoff rechecks, five executions, original seven-day
deadline and 30-second provider timeout. Only definitive 429 retries automatically;
ambiguity is UNKNOWN. Pre-send leases recover; expired SENDING never blindly resends.
Generic text/HTML omits listing/decision/staff/evidence detail and links. Address
generation detects A-to-B-to-A changes; binding, deletion and both verification
stores are rechecked before SENDING. No verification backfill. Recipients erase
at terminal event/deadline; terminal metadata lasts 30 days and a minimal outcome
stays with the notice. Separately authorized/audited recovery can resolve UNKNOWN
without resend. Controlled resend needs an actual provider-nonacceptance evidence
path; no free-text proof bypass exists.

Review cleanup uses original closure, six-month PHT clamping, bounded batches and
scoped exceptions. Access events have independent clocks. Expired ordinary review
access is denied before physical cleanup. Source revisions/media are not adopted
or erased. Reads/retries do not extend retention. Before mounting, remaining work
includes active grant/shift and administrative receipt/history cleanup, owner
binding history, eligible-deletion minimization, exception administration/periodic
review, necessity jobs/continuations and restore propagation. Queue appeal target
dates/overdue state never manufacture human acknowledgement. This is not all
moderation job classes or general retention/deletion.

ADR-096 section 4 still gates actual bootstrap/staffing, held-submission provenance,
declaration capture/version, risk/evidence assessments, ADR-094 geography acceptance,
paired translations/usability and ADR-081 readiness. No operator workbench/pilot
completion, real-data, deployment, mounting, publication or sending grant is claimed.

## Verification

Existing `test:laptop-drafts` imports the new database suite. The dedicated loopback
`halaga_signup_test` harness replays migrations in disposable schemas and cleans
synthetic schemas/blobs. No persistent application migration was applied. Checks
cover denial/projections, audit/required-effect rollback, revision/restriction races,
final coverage expiry, revocation/replay, original notice/appeal clocks, Unicode
bounds, appeal uniqueness/acknowledgement/alternate/fallback/conflict, delivery
ambiguity/bounds/suppression/no-backfill and scoped cleanup. Final command results
are in the completion report. Initial runs found and fixed strip-only/narrowing
issues and synthetic fixture clock/suspension setup leaks.

Changed implementation files: `app/prisma/schema.prisma` and the additive migration;
`app/src/server/moderation-policy.ts`; repository `held-laptop-review.ts`,
`held-laptop-review-http.ts` and `moderation-email-worker.ts`; the new
`app/tests/held-laptop-review-database.test.mjs` and its import from the existing
draft suite. Status/boundary notes were appended to PROJECT, architecture,
implementation slices, prerequisite/schema reviews and repository README. Existing
owner ADR/document edits were preserved.

| Existing command (from app unless stated) | Final result |
| --- | --- |
| `npm.cmd run db:generate` | Passed; local client generated, no persistent migration. |
| `npm.cmd run test:laptop-drafts` with the existing dedicated-test URL launcher | 54 passed, none failed/skipped. |
| `npm.cmd run test:foundation` | 38 passed, none failed/skipped. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed, including TypeScript; no new route. |
| `git diff --check` and new-file `git -c core.autocrlf=false diff --no-index --check -- NUL <file>` (root) | Passed; no-index difference status 1 without diagnostics is expected. Tracked Git LF/CRLF notices are non-fatal. |

Existing Node module-type and pg concurrent-query warnings remain. No browser or
accessibility run was performed because this increment adds no mounted UI.
