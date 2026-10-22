# Held-listing review: operations decision brief

Date: 2026-10-22 PHT. **Completed: all six initial choices and detailed groups
E1-E3 explicitly accepted by the owner.**

The six owner choices and the exact E1-E3 package below were explicitly accepted
in the owner interview. [ADR-096](decisions/ADR-096-held-review-authorization-and-operations.md)
records the binding policy and the [operations runbook](runbooks/HELD_LISTING_REVIEW_OPERATIONS.md)
records its operating procedure. The proposal wording below preserves what was
reviewed; it is superseded by ADR-096's accepted wording. This brief does not
implement a staff grant, operator interface, publication path, sending, or launch.
It addresses held laptop review and its moderation appeals; it does not provision
verification, dispute or general account-support queues.

## Authority and owner answers

Read alongside [the prerequisite review](HELD_LAPTOP_REVIEW_PREREQUISITES.md),
PROJECT sections 14/25/27/28/34, architecture sections 3/4.9/5/6/8.2, design
sections 5.13/7/9, the glossary, and ADRs 031/046/058/073/074/078/079/080/084/085/086.
ADR-078 supersedes ADR-058's historical unresolved appeal statement. ADR-090
supersedes older design uncertainty on its accepted topics. ADR-094 is still a
proposal. Account-email and photo job policies do not supply moderation defaults.

The owner explicitly selected:

1. **Owner-only grants:** only the project owner grants or revokes staff access,
   through an authenticated, audited process. Operators cannot grant themselves
   or others access.
2. **Claim before evidence/decision:** queue-authorized operators can see minimal
   queue entries; a single assigned reviewer must claim a review before opening
   restricted evidence or deciding it. Handoffs are audited.
3. **Owner-controlled coverage:** owner-approved, time-bounded application shifts;
   operators may mark themselves unavailable, but only the owner adds or extends
   coverage. Publication pauses without a scheduled, available, trained operator
   with the required queue permission.
4. **Six-month retention:** review records expire six calendar months after the
   decision becomes final, after its appeal window or appeal resolution. Active
   unresolved reviews remain while necessary, with necessity reviewed every 30
   days. Sensitive-access events expire six months after access. Account deletion
   preserves only necessary private records; ADR-079 exceptions remain applicable.
5. **Notices and clock:** mandatory in-app notices for holds, correction requests,
   decisions and appeal updates. Verified-primary email is required for correction
   requests, decisions and appeal updates, but not holds. Email is generic and is
   suppressed on an address change before sending, without retargeting. The appeal
   window starts when the decision notice becomes available in-app, independently
   of email success or read time.
6. **Text-only appeal intake:** authenticated seller form linked to the exact
   rejection/removal decision, accepted ground and text explanation, references to
   existing listing evidence, no new uploads or email inbox. One appeal per
   decision; accountable queue and ADR-078 reviewer/acknowledgement/decision rules.

No real staff names, owner identity binding, training evidence or schedule has
been supplied. Synthetic fixtures must not be represented as that evidence.

## E1: proposed access, audit and coverage mechanics

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
  explicitly proposes that freshness rule for these staff commands; ADR-086 alone
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

## E2: proposed lifecycle, notice copy and appeal details

### Retention classification

All periods below are specifically proposed for moderation. Six months means
calendar-month addition in PHT, clamping an invalid day to the last day of that
month and preserving local clock time. Read, retry, handoff and worker activity
never restart a clock.

| Record | Ordinary rule proposed |
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

Proposed fixed English email for every eligible event:

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

Decision detail uses `moderation-safe-reasons-en-v1`, the following proposed
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
English proposal does not certify translations or category/risk-detector rules.

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

## E3: proposed moderation job and recovery policy

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

## Recording and verification after acceptance

After the owner accepts or changes E1-E3, record the completed policy in a new
accepted ADR and a held-review operations runbook. Synchronize PROJECT,
architecture, glossary, domain model, design guidance, decision index and the
prerequisite record, distinguishing accepted policy from absent implementation.

Runbook must cover owner bootstrap/grants, training/coverage/confirmation,
claim/conflict/handoff, fail-closed reads, exact-revision decision, notice/appeal
history, recovery and retention/exception review. It must name required readiness
evidence without filling real names, schedules, identities or contact data.

No runtime implementation resumes solely because this policy is accepted.
Physical schema/reader review and concurrency checks remain necessary; held-request
submission provenance, ownership declaration capture/version, risk/evidence
assessment rules/provenance, geography, translation/usability
validation and ADR-081 gates remain separately tracked. Existing synthetic photos
never count as actual-item publication evidence.

Documentation verification: inspect whitespace/link targets and review the exact
changed scope. Runtime tests are appropriate only when runtime changes are made;
historical prerequisite test results must not be represented as new test runs.

## Completion and documentation verification (2026-10-22 PHT)

All six initial answers and E1-E3 were explicitly accepted. ADR-096 and its
operations runbook are written. PROJECT, architecture, design, glossary, domain
model, decision index, implementation tracker, atomic-foundation record and the
prerequisite review now distinguish accepted policy from missing implementation.
Existing prerequisite changes to PROJECT/architecture and the prerequisite file
were preserved. No application source, schema, migration or runtime behavior changed.

- Local Markdown target check: 58 relative targets across the 12 affected
  documents resolved. This checks file existence, not rendered UI or anchor IDs.
- Tracked `git diff --check`: passed. Four untracked Markdown files also passed
  `git -c core.autocrlf=false diff --no-index --check -- NUL <file>` with no
  whitespace diagnostics. An initial wrapper incorrectly treated no-index exit 1
  (files differ) as a whitespace failure; the corrected check accounted for that
  status and verified empty diagnostic output. No content repair was needed.
- Accepted ADR E1-E3 body compared with the approved brief: matched after only
  section-heading and proposed-to-accepted wording substitutions.
- No runtime tests/build/lint/browser run: this change is documentation only.
  Earlier runtime results in the prerequisite record are historical, not reruns.

Owner bootstrap/staff/coverage evidence, reviewed physical/concurrency controls,
independent submission/assessment/declaration/geography/translation prerequisites
and launch gates remain outstanding. The operator workbench remains not started.
