# Held-listing review operations

Date: 2026-10-22 PHT. Status: **Approved policy procedure under accepted ADR-096;
runtime controls and operational readiness are not implemented or certified.**

Authority: [ADR-096](../decisions/ADR-096-held-review-authorization-and-operations.md),
ADR-046/058/073/078/079/080 and PROJECT sections 14/25/27/28. This runbook adds no
policy beyond those decisions. Follow these steps only through reviewed,
implemented controls. It supplies no runnable administrative command or endpoint.
Before those exist, record the missing evidence and keep dependent paths gated.

## 1. Establish owner authority and staff grants

1. Verify the owner-controlled installation record binds the actual owner to an
   existing stored identity/domain-account mapping. Missing or unverified binding
   blocks administration. Never select the first registrant, a matching email/name
   or a request-supplied identity. Preserve initial binding/replacement audit.
2. Authenticate the bound owner. Grant/revoke commands require sign-in less than
   15 minutes ago, active stored session and undeleted mapping.
3. Record operator identity, training evidence, specific queue permissions,
   purpose/evidence scope and authorizer. Grant held-review permissions separately
   from appeal, moderation-recovery and audit permissions. Owner status alone does
   not permit evidence access or review decisions. Do not provision unrelated queues.
4. Commit grant/revocation with immutable audit history. Revocation prevents later
   evidence access, decisions and retry-receipt disclosure even when the person's
   participant session remains valid. Flag assigned work for authorized handoff.

Required evidence, currently absent: verified real owner binding, authenticated
provisioning/revocation path, trained named primary/alternate and grant records.
Do not populate the readiness record with fictional production identities.

## 2. Establish and maintain coverage

1. Owner records time-bounded primary/alternate shifts and training references in
   the application's authoritative PostgreSQL coverage records. Provide at least
   08:00-22:00 PHT every day; additional coverage must also be explicitly scheduled.
2. Confirm current queue grants, training and explicit attendance confirmation.
   Scheduled time alone does not demonstrate availability. Operators can mark
   unavailable; only the owner restores availability or adds/extends shifts.
3. At expiry, revocation, missing confirmation or unavailability, immediately stop
   treating that person as coverage. Flag their assigned work for handoff.
4. If no valid operator covers the required queue, pause new onboarding and listing
   publication. Keep reporting available and display the actual response window.
   Do not promise the ordinary urgent-review target without coverage.
5. Commit coverage changes with audit history. Review/publication commands recheck
   authoritative coverage at commit under the reviewed concurrency contract.

Required evidence: real approved schedule, training and attendance records, tested
primary/alternate handoff and coverage-gate enforcement. None is inferred here.

## 3. Triage, claim and inspect a held review

1. Check live session, domain mapping, active queue grant and server-authorized
   purpose before returning minimal triage rows. Never use the owner-private draft
   reader as a staff endpoint. Queue rows contain no restricted evidence previews.
2. Check conflicts and claim unassigned work atomically. One assigned reviewer
   controls evidence reads and decisions. A personal/commercial conflict or own
   listing requires handoff to an eligible reviewer.
3. Load the exact candidate revision through a distinct minimized review projection.
   Open only necessary restricted evidence through a separate authorized read.
4. Persist access audit before disclosing sensitive data. Audit failure denies
   disclosure. Do not put evidence, private expectation, unrelated conversations,
   staff notes or raw errors in general logs or seller responses.
5. Record release/transfer/reassignment with actor, recipient, reason and timestamp.
   The current reviewer can transfer to an eligible operator; owner reassignment
   needs a reason. No timeout silently transfers the claim. Unavailable/conflicted/
   revoked reviewers cannot continue reading evidence or deciding.

Required evidence: held-request provenance and reviewed physical records/readers,
live authorization, assignment and access-audit behavior. These remain unimplemented.

## 4. Resolve the exact revision and notify the seller

1. Use a fresh staff sign-in for the decision. Recheck grant, purpose, claim,
   conflicts, coverage, exact revision, current restrictions and all publication
   prerequisites under the reviewed transaction/lock order.
2. Do not approve deterministic exclusions or unavailable/missing checks. A hold
   is neutral. Correction/resubmission binds a new immutable revision.
3. Commit the supported decision, reason/evidence references, action/access audit,
   immediately readable in-app notice, eligible email intent/job and retry receipt
   atomically. Any required-write failure rolls back the command.
4. Use ADR-096's exact version-1 copy, safe-reason catalogue and outcome/channel
   matrix. Unknown reasons require a new accepted copy decision. Never disclose
   staff identity, detailed risk signals, evidence or unrelated-user information.
5. Preserve the original in-app availability time. For rejection/removal, show its
   inclusive deadline seven elapsed days later in PHT. Read time, email failure,
   retries and later correction do not move that decision's appeal clock.
6. Keep held revisions absent from every public/discovery/media/metadata reader.
   Review approval and publication need their actual accepted prerequisites;
   this runbook creates no publication capability.

## 5. Receive and review the one permitted appeal

1. Authenticate the affected seller and bind intake to the exact rejection/removal
   decision. Check the original deadline and uniqueness server-side. Accept one
   or more ADR-078 grounds and 1-4,000 Unicode code points of plain explanation;
   references must be to existing evidence the seller may reference.
2. Accept no new file uploads or email-inbox submissions in this version. Do not
   fetch pasted links. Handle duplicate request IDs idempotently; changed payload
   conflicts, and a new request ID cannot create a second appeal.
3. Commit appeal/history, targets, receipt and required notice/jobs together. Show
   automatic receipt separately from a human acknowledgement.
4. Calculate targets from original intake: acknowledge within two business days,
   target decision within five. Count Monday-Saturday in PHT, skip Sunday and
   preserve local clock time. Display overdue work without extending targets.
5. Assign a different eligible operator when available. Otherwise record why none
   is available and separately log the original reviewer's reconsideration of
   each ground. Personal/commercial conflicts cannot be waived by this fallback;
   keep pending, escalate staffing to owner and show truthful delay.
6. Record outcome and any explicit authorized state correction with required
   notices/history. No automatic restoration and no second internal appeal.

## 6. Recover moderation jobs

1. Use only `moderation-jobs-v1` parameters in ADR-096. Local validation invokes
   run-once work with a fake provider. No hosted scheduler or live sending is
   authorized by this policy record.
2. Recover expired pre-send leases. Quarantine expired SENDING work as UNKNOWN;
   inspect only through a purpose-authorized, access-audited recovery projection.
3. Suppress queued email after account deletion, any intervening address-binding
   change, verification loss or original delivery expiry. Erase recipients at
   acceptance, suppression, definite failure or original expiry; UNKNOWN may keep
   its recipient only until that deadline. Never retarget or backfill.
4. Only definite provider HTTP 429 permits automatic retry after a send call.
   Ambiguous failures are UNKNOWN, with no blind resend. Definite other 4xx fails.
5. Controlled retry requires separately granted recovery permission, fresh staff
   sign-in, reason/audit, unexpired original deadline and unchanged eligibility.
   Retain attempt history and the same five-execution bound. UNKNOWN requires
   provider evidence of definite nonacceptance before any resend. Exhaustion
   cannot be bypassed with a new logical key.
6. Keep domain decisions and in-app notices committed despite email failure.
   Provider acceptance never proves inbox delivery; an in-flight send cannot be
   reliably recalled after deletion or an address switch.

Required evidence: implemented moderation jobs/recovery, authorized staff readers,
provider diagnostics/reconciliation, tested cleanup and restore behavior. Provider,
host, actual scheduling and real sending need separate readiness authorization.

## 7. Review necessity and apply retention

1. Review active unresolved work every 30 calendar days. Record whether it remains
   necessary and assign follow-up; no silent indefinite preservation. Do not
   invent automatic adverse findings or close reviews merely due to worker delay.
2. Use ADR-096's per-record clocks: review/history/in-app/receipts six months after
   final closure; access events six months after access; ended grants/shifts/owner
   bindings six months after ending. Reads/retries never restart those clocks.
3. Final closure follows appeal eligibility/resolution and notice availability.
   A pending correction/hold stays unresolved. A possible but unfiled appeal or
   background email alone creates no new account-deletion blocker.
4. Erase delivery recipients on their own deadlines and terminal delivery metadata
   after 30 elapsed days, at most 37 elapsed days from the originating event.
   Keep only the minimal recipient-free channel outcome with the review notice.
5. Fence affected work before cleanup. Process up to 100 records per cleanup batch,
   continue idempotently and respect source-record classifications. A reference
   cannot prolong evidence storage; missing evidence is unavailable.
6. Retention exceptions need ADR-079 scope, purpose, authorizer, start and review/
   expiry history. Review at least every 30 calendar days; release promptly and
   apply ordinary expired-data cleanup without restarting a retention clock.
   Exceptions never reopen delivery windows or authorize unrelated access.
7. On eligible account deletion, suppress unsent email, erase its recipient and
   minimize remaining private records. Propagate approved deletion after restore
   before normal readers/senders resume. Verify provider/backup behavior before
   real-data use; no unsupported physical-erasure guarantee is made here.

## Readiness boundary

The policy decisions are accepted; all runtime evidence listed above still needs
implementation and verification. Independently unresolved: held-submission
provenance, declaration capture/version, risk/evidence assessments/provenance,
geography (ADR-094 proposed), validated paired translations/usability and ADR-081
readiness. Existing synthetic photos are not actual-item publication evidence.
Do not use this runbook as evidence of staff provisioning, pilot staffing,
publication, deployment or real-data permission.
