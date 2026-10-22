# ADR-096: Held-Review Authorization and Operations

- Status: Accepted by explicit owner answers to the six initial choices and E1-E3
- Date: 2026-10-22 PHT
- Supplements: ADR-031, ADR-046, ADR-058, ADR-073, ADR-074, ADR-078, ADR-079, ADR-080, ADR-084, ADR-085 and ADR-086
- Scope: held laptop review and its moderation appeals; local/private synthetic implementation only

## Decision and approval

The owner explicitly approved owner-only staff grants, required reviewer claims,
owner-controlled coverage, six-month retention, mandatory in-app/conditional
verified-email notices with original in-app notice timing, and authenticated
text-only appeal intake. The owner then explicitly accepted the full E1, E2 and
E3 contracts in the [decision brief](../HELD_REVIEW_OPERATIONS_DECISION_BRIEF.md),
including exact English copy, retention classifications and numerical job policy.
The sections below reproduce that accepted contract. The [operations runbook](../runbooks/HELD_LISTING_REVIEW_OPERATIONS.md)
describes its application without claiming the controls already exist.

These policies resolve the corresponding undocumented choices in the
[prerequisite review](../HELD_LAPTOP_REVIEW_PREREQUISITES.md). They supersede older
statements that these particular policy choices remain open. They do not complete
staff provisioning, coverage, sensitive-access auditing, held requests, notice
readers/delivery, appeal intake or cleanup. A participant account is not staff.
ADR-078 remains the appeal policy; ADR-058's older unresolved statement is historical.
No broader verification/dispute/support queue, live sending, deployment, paid
service or real-data use is authorized. No real owner binding, operator identity,
training evidence or coverage schedule is supplied by synthetic fixtures.

## 1. Staff access, audit and coverage

- Bind the owner authority to a pre-provisioned stored identity/domain-account
  mapping, explicitly recorded by the owner in a controlled installation record.
  No first-registrant rule, email/name comparison, request parameter or ordinary
  role may establish ownership. Initial binding and later replacement are audited;
  the trusted installation procedure and real identity must be verified before
  mounting administrative controls. Missing binding denies administrative actions.
- Maintain separate permissions for held-review triage/claim/evidence/decision,
  appeal review, moderation delivery recovery, and audit inspection. Owner
  administration does not automatically confer evidence or reviewer access.
  Audit readers see necessary history; that permission alone cannot open evidence.
- Check the stored session, undeleted identity mapping, active grant, queue,
  authorized purpose, current assignment and conflicts on every relevant read,
  mutation and retry. Owner grant/shift changes, review/appeal decisions and manual
  delivery retries additionally require sign-in less than 15 minutes ago. This
  explicitly applies that freshness rule to these staff commands; ADR-086 alone
  applies it only to its documented account changes.
- Server operations determine the permitted purpose: held review, moderation
  appeal, delivery recovery or audit inspection. A submitted purpose/reason must
  match the authorized operation; free text never grants access. Grant and purpose
  checks precede receipt lookup, preventing replay from revealing revoked access.
- Queue projection: internal review reference, category, neutral state, trigger
  class, submission/target times and assignment status. No evidence thumbnails,
  private price expectation, full identifier, unrelated messages, account contact
  data or detailed risk signals. Review detail contains the exact candidate
  revision and necessary policy findings. Restricted evidence is separately read
  only for the assigned purpose. Seller feedback excludes staff identity/notes,
  private findings, other users' data and evasion-enabling detail.
- Claim and handoff are guarded, atomic changes. An authorized operator may claim
  unassigned work. The current reviewer can release or transfer it to another
  eligible operator; the owner can reassign it with a recorded reason. No claim
  is implicitly stolen on timeout. Revocation/unavailability/conflict blocks further
  evidence reads and decisions and surfaces handoff work. Queue triage remains
  available to other authorized operators. No operator reviews their own listing
  or a review with a declared personal/commercial conflict. Owner-only conflict
  escalation does not permit the owner to manufacture an impartial reviewer.
- Sensitive reads persist actor, grant/purpose, target/revision, necessary reason
  and timestamp **before disclosure**. Required access-audit failure denies the
  disclosure. Decisions atomically write their exact-revision history, required
  action/access audits, notices/jobs and idempotency receipt. Required-write failure
  rolls back the command. Ordinary corrections append linked records.
- Coverage is authoritative in PostgreSQL, with immutable change history and
  owner-approved start/end instants, named primary/alternate, training reference,
  required queue grant and explicit operator availability confirmation. Shift start
  does not auto-confirm attendance. Operators can declare unavailable and request
  restoration; only the owner restores availability after that declaration.
  Expiry, revocation, missing training/confirmation or unavailability removes the
  operator from coverage immediately. Future shifts are separate confirmations.
- Daily 08:00-22:00 PHT is the required minimum coverage window. Publication needs
  actual valid coverage at its commit instant; an owner may schedule additional
  coverage outside that window. This does not assume round-the-clock availability.
  The same authoritative coverage gate applies to new onboarding, as ADR-080
  already requires. Reports remain available with truthful response windows.
- Serialize grant/availability/assignment changes and decisions through a documented
  database lock order or equivalent serializable transaction. Recheck current
  coverage, grant, claim, exact revision, restrictions and eligibility before commit.
  A decision never overrides a deterministic exclusion or unavailable assessment.
  Revocation committed first denies the operation; an earlier completed disclosure
  cannot be recalled. Lock design and race tests remain implementation review work.

## 2. Retention, notices and appeals

### Retention classification

All periods below are specifically accepted for moderation. Six months means
calendar-month addition in PHT, clamping an invalid day to the last day of that
month and preserving local clock time. Read, retry, handoff and worker activity
never restart a clock.

| Record | Accepted ordinary rule |
| --- | --- |
| Review request, exact reviewed snapshot, necessary evidence references, findings, assignment/action history, appeal text/history, seller in-app notices and decision receipts | Six calendar months from final closure. An appealable decision closes at its seven-day appeal deadline if no appeal is filed, or when a timely appeal is resolved and its outcome notice is available. A nonappealable outcome closes when the request is explicitly resolved/withdrawn and its required notice is available. Correction requests and active holds remain unresolved. Approval closes the review, independently of the listing's subsequent lifecycle. |
| Sensitive-access events | Six calendar months after each access; minimal target/actor/revision references, never copied evidence or message bodies. Later reads do not extend earlier events. |
| Grants, provisioning/revocation history, owner binding changes and coverage history | Necessary while active; six calendar months after the grant/shift/binding ends. Do not copy credentials or participant content into this history. |
| Email recipient | Delivery-only until acceptance, suppression, definite failure or the original seven-day delivery deadline, whichever comes first. UNKNOWN retains its recipient only until that deadline for authorized reconciliation. Erase at the terminal event/deadline; retries never reconstruct an erased address. |
| Email attempts/jobs/provider reference, deduplication and safe failure metadata | While nonterminal within the original seven-day window; 30 elapsed days after terminal outcome. All unresolved email work terminalizes by the original deadline, bounding this data at 37 elapsed days from event time. A minimal channel outcome remains in the review notice record without recipient/provider diagnostics. |

Delete or irreversibly anonymize account-linkable content/identifiers at expiry;
do not call opaque linked IDs anonymous. Deleting a reference does not delete a
source transaction/evidence record still required under its independently accepted
policy; retaining a reference cannot extend the source's lifetime. Missing evidence
is shown as unavailable. A reviewed snapshot needs its own classification before
moving from ADR-095's synthetic draft lifetime into this workflow; no silent media
adoption. Retention jobs must check all applicable references and scoped exceptions.

An open appeal/review is an unresolved workflow under PROJECT 28.3. A possible but
unfiled appeal and background email alone do not add a deletion blocker. Eligible
deletion suppresses unsent email, erases its recipient and minimizes retained
private records; the decision itself is not erased before its approved expiry.
ADR-079 exceptions preserve only documented necessary data, are reviewed at least
every 30 calendar days and do not extend delivery deadlines or authorize sending.

### Outcome and channel matrix

| Version-1 event | Mandatory in-app | Mandatory email when eligible | Appeal eligibility |
| --- | --- | --- | --- |
| Held | Yes | No | None from a neutral hold |
| Correction requested | Yes | Yes | Correction/resubmission, not an appeal |
| Approved | Yes | Yes | None from approval |
| Rejected or removed | Yes | Yes | One appeal per originating decision |
| Appeal received | Yes | Yes | Does not create another appeal |
| Appeal under review (human acknowledgement) | Yes | Yes | Original appeal continues |
| Appeal resolved | Yes | Yes | No second internal appeal |

Email eligibility requires both existing verification indicators at event commit,
with verification time no later than that event. Bind a private recipient snapshot
and email-binding generation then. Immediately before SENDING, recheck unchanged
binding/address, verification and undeleted account. Any intervening email switch
suppresses even if the account later switches back; no retargeting or later
verification backfill. Suppression erases recipient data. An in-flight send may
complete after an email change/deletion and cannot reliably be recalled.

Accepted fixed English email for every eligible event:

Subject: `An update is available in Halaga`

```text
An update is available in your Halaga account.

Open Halaga directly and sign in to view it and any applicable deadline.
```

No listing title, decision type, staff identity, reasons, evidence, account name,
address in body, links, tracking, attachments or rendered-message storage. Use
escaped equivalent HTML and plain text. In-app version-1 copy:

| Event | Fixed text |
| --- | --- |
| Held | Your listing is awaiting review and is not public. A hold is not a finding that you broke a rule. |
| Correction requested | Changes are needed before this review can continue. Open the decision details for the required corrections. |
| Approved | Review of this listing revision is complete. Open the listing to check its current status. |
| Rejected | This listing revision was rejected. Open the decision details for the reason, correction guidance and appeal deadline. |
| Removed | Your listing was removed from public view. Open the decision details for the reason and appeal deadline. |
| Appeal received | Your appeal was received. We aim to acknowledge it within two business days and decide it within five business days. Current restrictions remain in place unless explicitly changed. |
| Appeal under review | An operator has acknowledged your appeal and is reviewing it. Open the appeal details for its status and target date. |
| Appeal resolved | A decision on your appeal is available. Open the appeal details for the outcome and any next steps. There is no second internal appeal. |

Decision detail uses `moderation-safe-reasons-en-v1`, the following accepted
allowlist, plus original notice/deadline timestamps. Codes are selected only when
the corresponding policy finding is supported; the catalogue defines no detector,
evidence threshold or new rejection ground.

| Reason code | Safe reason and guidance |
| --- | --- |
| REQUIRED_INFORMATION | Required listing information is missing or inconsistent. Review the marked fields, save a new revision and submit it again. |
| SAFETY_INELIGIBLE | The disclosed item does not meet Halaga's safety requirements. Stop testing or using an item that may be hazardous. Do not relist it to bypass this decision. |
| CATEGORY_UNSUPPORTED | The item does not fit a supported marketplace category. Do not change its category merely to bypass this requirement. |
| EVIDENCE_INSUFFICIENT | The listing evidence does not meet the stated requirements. Review the evidence checklist and submit a corrected revision where permitted. |
| SENSITIVE_PUBLIC_CONTENT | Proposed public content contains information that must remain private. Remove it from the marked public fields or images and submit a corrected revision. |
| OWNERSHIP_DECLARATION | The required ownership declaration is missing or invalid for this revision. Complete the accepted declaration process before submitting again. |
| ACCOUNT_PUBLICATION_RESTRICTED | Your account is currently restricted from publishing. Open your private restriction notice for its status and any available review path. |
| DUPLICATE_OR_MANIPULATIVE | This listing does not meet the platform's duplicate or manipulation policy. Review the decision and use the appeal path if you believe it is incorrect. |
| POLICY_REVIEW | This listing needs further human review. It remains private; this status is not a violation finding. |
| ORIGINAL_DECISION_CONFIRMED | The original decision remains in effect after review of your appeal grounds. No second internal appeal is available. |
| DECISION_CORRECTED | The decision was corrected after review of your appeal grounds. Open the listing or restriction notice to check the explicitly updated status. |
| MORE_INFORMATION_REQUIRED | More information is needed to continue this review. Describe it through the existing authorized review or appeal form; do not send private evidence through public fields. |

Only POLICY_REVIEW is generic hold guidance; it cannot justify a rejection or
removal. Unknown reasons have no arbitrary free-text fallback: new reason copy
requires explicit approval. Required paired
Cebuano/Bisaya for safety/ownership content still needs human validation; this
English policy does not certify translations or category/risk-detector rules.

Make the required in-app notice readable in the same transaction as the decision;
its first available instant is immutable notice time. Appeal deadline is exactly
seven elapsed days later, represented in PHT; accept filing at or before that
deadline. Reopening, reading, email delivery and retries never reset it.

### Appeal intake and review

The owner-only form requires one or more ADR-078 grounds and 1-4,000 Unicode
code points of plain explanation. Optional references must identify existing
evidence the seller is authorized to reference; never arbitrary object keys or
unrelated user records. No HTML, automatic link fetching or new file uploads.
Describe new evidence in text; file intake is a later explicit decision.

Server checks stored owner session, exact originating decision, original deadline
and uniqueness before accepting. Commit appeal, history, targets, receipt and
notice/jobs together. Identical request-ID retries return the same private result;
changed payload conflicts. A uniqueness guard prevents a second appeal under a
new request ID. An appeal decision is not itself a fresh appealable decision;
correction/resubmission creates a new revision, never rewrites the old decision.

Targets run from accepted appeal submission, not email or claim time. Count
Monday-Saturday PHT, skipping Sunday, preserve the submission's PHT clock time
when adding two/five business days; no additional holiday calendar is assumed.
An automatic receipt is not the human acknowledgement. Surface overdue targets
without silently extending them or turning targets into guarantees.

Route to a different authorized, nonconflicted operator when available. If none
is available, record that fact and the separately logged reconsideration by the
original reviewer addressing every ground. A declared personal/commercial
conflict cannot be waived by that fallback: leave the appeal pending for an
eligible reviewer and show accurate delay. The owner resolves staffing, without
receiving automatic evidence access. No automatic restoration or lifted restriction.

## 3. Moderation jobs and recovery

Version `moderation-jobs-v1`, distinct from account email and photo jobs:

- Logical work classes: moderation email delivery, appeal-target/active-review
  necessity checks, and moderation retention cleanup. In-app notices are durable
  transaction records immediately available without waiting for a worker.
- Local synthetic runtime: explicit run-once worker, at most one claimed work item
  per invocation, plus bounded recovery/cleanup. No daemon, hosted polling cadence,
  provider sending or deployment is authorized by this decision.
- PostgreSQL fenced claims use a two-minute lease, renewal every 30 seconds and a
  30-second execution/provider-request timeout. Claim with concurrent-safe row
  locking; stale lease holders cannot commit completion.
- At most five executions per logical work item. Known retryable failures use
  60/300/1,800/7,200-second delays after attempts 1-4. No attempt starts at or after
  the email's original seven-elapsed-day deadline. Non-email retries retain their
  original due instant and recheck present authoritative state.
- For email, only definitive provider rate-limit rejection (HTTP 429) is an
  automatic retry after a send call. Network error, timeout, provider 5xx, malformed
  success or crash after SENDING is UNKNOWN and never blindly resent. Definite
  non-rate-limit 4xx is FAILED. Recover expired pre-send leases; quarantine expired
  SENDING. Provider acceptance is not proof of inbox delivery.
- For internal target/cleanup work, known transient database or local execution
  failures are retryable; invalid payload/policy is permanent. Idempotent state
  checks make a crash/reclaim safe. Target checks surface due/overdue queue work
  and never generate an acknowledgement or human decision. Active reviews get
  30-calendar-day necessity checks. Cleanup selects by approved expiry, uses
  batches of at most 100 records and schedules continuation when necessary.
- Required event, channel-intent/job and receipt writes share the domain
  transaction. Event/channel work keys and unique records deduplicate logical
  effects. Failed or exhausted work is restricted operational work, not discarded.
- Owner-granted moderation-recovery permission and purpose are required for
  inspection/retry; operator review permission alone is insufficient. Diagnosis
  exposes safe state/codes and the minimum necessary private delivery data, never
  evidence or raw provider payloads. Inspection is access-audited.
- A controlled retry requires a fresh staff session, audit reason, current grants,
  unexpired deadline and unchanged binding/account. It appends an attempt, preserving
  history. The same five-execution and original-deadline bounds remain; exhausted
  work cannot be restarted under a new logical key. UNKNOWN can be retried only
  with recorded provider evidence of definite nonacceptance; otherwise resolve
  as unknown without resend. No exactly-once mailbox guarantee.
- Retention cleanup never waits for a failed email retry. Fence/cancel affected
  work, erase recipients on their deadline and retain only approved metadata.
  Necessary exception-held data is isolated rather than preventing unrelated
  expiry. Resumption/restore must reapply deletion deadlines before ordinary
  readers/senders run. Provider/backup purge capabilities remain launch evidence.

## 4. Remaining implementation and readiness gates

Implementations must review physical records, foreign keys, projections, access
audit behavior, concurrency/lock order, live revocation and coverage enforcement,
retention/deletion and restart/restore behavior before mounting affected paths.
The owner bootstrap/identity verification procedure remains required installation
evidence; accepting its authority does not establish an actual owner identity.

Held-request submission provenance, ownership declaration capture/version,
risk/evidence assessment rules and provenance, geography under proposed ADR-094,
validated translations/usability, and ADR-081 readiness remain independent gates.
This ADR classifies review snapshots/references but does not implement adoption of
private synthetic draft media; technical photo processing never proves actual-item
evidence. Approval never turns missing/unavailable checks into a pass.

Use existing repository checks when implementing: denied/wrong-queue/wrong-purpose/
revoked access, claim/conflict/handoff races, audit failure preventing disclosure,
minimal projections, exact-revision decisions, concurrent coverage/restriction/
revocation changes, atomic required effects and receipt replay, original notice
clock and appeal uniqueness, reviewer fallback, delivery suppression/ambiguity,
retry bounds and cleanup/exception release. Public/discovery/media/metadata readers
must exclude held content when those paths exist. Policy acceptance alone passes
none of these runtime criteria.

## Sources

- Owner interview and explicit answers, 2026-10-22 PHT, preserved in the decision brief.
- PROJECT sections 14, 25, 27, 28 and 34; architecture sections 3, 4.9, 5, 6 and 8.2.
- Domain model section 5.9; design sections 5.13 and 7; prerequisite review.
- Accepted ADRs listed above; ADR-094 remains proposed.
