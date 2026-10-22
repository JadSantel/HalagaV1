# Held laptop revision review: prerequisite review

Later implementation supplement (2026-10-22 PHT): an unmounted synthetic service,
physical records and protected adapter now implement part of ADR-096. Earlier
no-service/no-schema descriptions below are historical. Full approval, submission,
bootstrap/mounting and remaining integration are still gated. See the
[implementation record](HELD_LAPTOP_REVIEW_IMPLEMENTATION.md); this is not operator
workbench or pilot completion.

Date: 2026-10-22 PHT. Updated after owner interview: **Policy decisions accepted
in ADR-096; runtime implementation and independent prerequisites remain blocked.**
Synthetic data only. This is an implementation readiness record, not an accepted
ADR, staff grant, review decision, or completion of the operator workbench/pilot.

## Owner decision supplement (2026-10-22 PHT)

The owner explicitly accepted six initial choices and the full E1-E3 contract in
[ADR-096](decisions/ADR-096-held-review-authorization-and-operations.md), supported
by the [approved operations runbook](runbooks/HELD_LISTING_REVIEW_OPERATIONS.md)
and [completed interview brief](HELD_REVIEW_OPERATIONS_DECISION_BRIEF.md).
Staff grant/purpose/claim rules, coverage authority, access/action audit behavior,
review/access retention, exact moderation notices/job recovery and text-only appeal
intake policies are now decided. The earlier missing-policy descriptions below
are historical and superseded only for those choices.

No staff identity/grant, actual coverage, sensitive reader/audit store, review
request/decision, notice job, intake form or cleanup implementation is created by
this documentation change. Physical record/projection/lock review and runtime
acceptance checks remain outstanding. Held-submission provenance, ownership
declaration capture/version, risk/evidence assessments and provenance, geography
(ADR-094 proposed), validated translations/usability and ADR-081 readiness remain
independent gates. Acceptance is not publication permission or evidence of pilot
staffing. Historical verification results below do not test ADR-096 behavior.

## Inspection and authority

The requested working directory, `gym-management-system`, contains only a README.
The laptop application and required documents are in the adjacent writable
`HalagaV1` repository. Both working trees were clean before this review; HalagaV1
HEAD was `5eb8205`. No unrelated changes were present.

Read root/app AGENTS.md, PROJECT sections 6.4/8/11/14-16/25/27-29/33-34,
architecture sections 3/4.1/4.9/5/6/8.2, design sections 4/5.3/5.4/5.13/7/9,
the glossary, domain/schema boundary records, current routes/repositories/schema,
tests, package scripts and publication implementation records. Relevant accepted
ADRs include 031/046/058/073/078/080/084/085. ADR-078 supersedes ADR-058's historical
statement that formal appeals are unresolved. Some older design statements also
remain superseded by ADR-090; they do not reopen its accepted policies.

AGENTS.md requires pausing implementation that depends on unresolved decisions.
[The existing atomic foundation](LAPTOP_PUBLICATION_ATOMIC_FOUNDATION.md) already
records the owner's instruction to keep publication-specific policy gaps gated.
The new request requires checking those prerequisites and prohibits inventing
their resolution. It does not supply the missing authorization/operations policy.

## Existing flows and privacy boundaries

- `app/src/server/repositories/laptop-drafts.ts` resolves a stored participant
  session and undeleted owner, locks the account/session/listing and selects only
  `DRAFT` listings without publication history. Its exact-revision `review` method
  is an owner-private evaluation, not staff review. A signed-in participant,
  verified adult, seller or record author does not thereby become staff.
- `/api/laptop-drafts/{id}/review?revision=N` is GET-only and owner-private.
  `HELD` is a schema state, but no submission command currently creates a held
  review request. No held queue, staff detail/evidence reader or resolution command
  exists. Draft APIs must not be widened to serve held records as a shortcut.
- There is no public listing/discovery reader. Candidate data, including the
  proposed-public part of a draft, remains private. Future browse/search/detail,
  metadata, previews, images, caches and derived projections must exclude held
  revisions on the server. Their absence today is not proof of future filtering.
- `AccountMarketplaceRestriction` preserves scoped restriction history but is not
  a staff role/grant or review audit store. `authorizedBy` fixture strings are not
  authenticated operator identities. No staff provisioning, assignment, purpose
  authorization or coverage authority is implemented in the current schema/code.
- `atomic-publication-decision.ts` requires authorization and transactional domain,
  audit, intent/job and retry-receipt writes from its owning adapter. Only a
  disposable PostgreSQL test adapter exists. Its callbacks and fixture actors do
  not implement staff policy, a held-review store, or access auditing.
- The owner review projection includes private expectation; it cannot be reused
  wholesale for staff. Separate candidate, necessary restricted evidence,
  staff/audit and seller-feedback projections need approved access rules. Do not
  include unrelated account data, negotiation activity or staff identities in
  seller/public responses. Safe operational logs are not sensitive-access audits.
- Existing notices, templates and delivery jobs concern account security/email or
  private synthetic photos. They do not authorize moderation notices, an appeal
  intake channel, or publication delivery/retention defaults.

## Prerequisites and decisions required

Historical table from the pre-interview check. Consult ADR-096 and the supplement
above for accepted policy; all missing runtime implementation/evidence remains
outstanding unless separately verified.

| Prerequisite | Accepted requirement | Missing decision or implementation evidence |
| --- | --- | --- |
| Staff identity and authorization | Explicit role, queue authority and operational purpose; restricted evidence only as necessary (PROJECT 27; architecture 3/4.9; ADR-046). | Approve the trusted provisioning/revocation authority, operator identity mapping, queue/purpose checks, whether record assignment is required, permitted evidence scope and conflict/handoff rules. Define live revocation/session checks. A request purpose string or signed-in account alone is insufficient. |
| Audited reads/actions | Append-only action and sensitive-access history, actor/reason/time and exact reviewed revision; corrections preserve history (ADR-058; domain model 5.9). | Review physical records, access-audit failure behavior and the staff/auditor reader boundary. Resolve retention/deletion for review requests, findings, access events, receipts and evidence references. Do not apply 24-month closed-transaction or account-email periods to unrelated review data by default. |
| Coverage | Named primary and trained alternate, queue authorization, 08:00-22:00 PHT daily; pause publication if neither is available (ADRs 046/080). | Supply the authoritative coverage/availability source and who may change it, including conflict/handoff handling and transactional enforcement. Actual training/names/schedules are pilot readiness evidence, not fabricated synthetic fixtures. |
| Held request and eligibility | Exact immutable revision and explicit trigger; a hold is neutral. Approval cannot override deterministic exclusions or current restrictions (ADR-058; architecture 4.9/5). | Implement submission/held request provenance after its existing gates are resolved. Risk/evidence assessment rules, authorization and provenance remain unavailable; see the publication evaluation record. Registry ADR-094 is still proposed. No blanket staff approval can turn missing/unavailable checks into passes. |
| Seller notice and delivery | Privacy-safe decision feedback; durable domain/notification handoff, deduplication and no rollback on email failure (ADRs 031/073; architecture 6). | Accept per-outcome event/recipient/channel matrix, safe versioned copy and guidance, preferences, recipient binding across email/account changes, and original notice time. Resolve required job classes, leases, bounded retries, ambiguous delivery/recovery and purpose-authorized failed-work handling. Account-email/photo policies are not defaults. |
| Appeal and correction | One appeal after moderation rejection/removal within seven calendar days after notice; accepted grounds; acknowledge within two business days and target five; different operator if available, otherwise separate logged reconsideration; no automatic restoration or second appeal (ADR-078). | Supply an implemented, authorized intake/notice path and accountable queue, timing/deduplication and linked decision/appeal history. The policy is accepted; its mechanism is absent. A neutral hold does not itself start the rejection/removal appeal clock. Correction/resubmission is distinct from an appeal and must bind the new revision. |

These decisions must be recorded in the applicable ADR/runbook and synchronized
with authoritative documents before dependent implementation. This record selects
no defaults and grants no publication, external sending, deployment or real-data
permission. Broader queues, verification, disputes and pilot operations remain out
of scope. A local synthetic scope does not waive staff/access-audit safeguards.

## Acceptance and verification boundary

Existing `test:laptop-drafts` covers owner/session denial, minimal projections,
historical exact-revision evaluation, current restrictions/prerequisites, competing
revision writes and exclusion of every non-draft state (including HELD) from draft
list/detail/review/save. It also checks no publication/notice side effects.
Existing `test:foundation` covers the internal coordinator's authorization before
receipt access and commit, stale state/revision, idempotency, safe result/log
projections and rollback of required audit/intent/job/receipt writes.

These are regression checks of existing code and synthetic fixtures. They cannot
establish authorized staff access, purpose-restricted held evidence, persisted
review history, audited reads, concurrent application approval versus revision/
restriction/coverage/revocation changes, seller moderation delivery, or appeals.
Those acceptance criteria remain blocked/unverified, not passed by the fixture.

After the prerequisites are accepted, use existing repository checks and extend
them for anonymous/participant/wrong-queue/wrong-purpose/revoked staff denial;
audit failure denying disclosure; minimized queue/detail/evidence/notice responses;
exact revision/history; stale and concurrent decisions; live eligibility and
coverage rechecks; atomic required effects and retry replay; notice failure,
deduplication and original notice-based appeal timing; one-appeal limits, grounds,
reviewer separation/reconsideration and no automatic restoration. Verify all
public/discovery/media/metadata paths exclude held content when those paths exist.

No application source, schema, migration, endpoint, staff bypass or new test policy
is introduced in this prerequisite-only change. Verification results belong below
and in the completion report; no broader slice is marked complete.

## Verification results (2026-10-22 PHT)

Commands ran from `app` unless noted. Only existing relevant scripts were run.

| Command | Result and scope |
| --- | --- |
| `npm.cmd run test:laptop-drafts` | 35 passed, 0 failed/skipped. Launched with `SIGNUP_TEST_DATABASE_URL` derived in memory from local configuration, changing only the database name to `halaga_signup_test`; credentials were not printed. The existing harness replayed migrations into disposable schemas and cleaned synthetic data/blobs. |
| `npm.cmd run test:foundation` | 38 passed, 0 failed/skipped. Existing rolled-back/session-local synthetic fixtures; no persistent schema change. |
| `git diff --check` (repository root) | Passed for tracked changes; Git emitted LF/CRLF conversion notices. The new prerequisite record was also checked with `git diff --no-index --check`. |

The initial `cmd.exe` Node launcher failed with `SyntaxError: Invalid or unexpected
token` before starting the draft suite because of shell quoting. Running the same
launcher through the default PowerShell succeeded. Node emitted existing module-type
warnings; draft tests also emitted the existing pg concurrent-query deprecation.
No application build/lint/browser run was needed for documentation-only edits.
No new held-review behavior or unavailable acceptance criterion is claimed tested.
