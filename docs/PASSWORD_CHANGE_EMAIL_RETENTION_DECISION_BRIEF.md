# Decision brief: remaining password-change email and retention rules

Date: 2026-10-19 PHT. **Updated 2026-10-20: proposal A–C accepted by explicit owner
answers and recorded in [ADR-089](decisions/ADR-089-password-change-email-and-retention.md).**
Earlier open-gap descriptions below preserve the decision context. ADR-089 now
governs the accepted rules; provider/backup evidence, hold enforcement and other
mounting/real-data readiness gates remain incomplete.

Scope: decisions required before completing and mounting the existing authenticated
password-change operation. This is not password reset or the email-switch warning.
It adds no runtime behavior, recipient storage, template, delivery, cleanup schedule,
provider setup or permission to use real participant data. Any future validation
must use synthetic data until ADR-081 readiness gates pass.

## Authority and implementation before ADR-089

[PROJECT §§8.5, 25, 28 and 34](../PROJECT.md#85-authentication-protection),
[architecture §§3, 5, 6 and 8.2](../architecture.md#6-flow-level-notification-contract),
and [ADR-087's approved notice supplement](decisions/ADR-087-account-onboarding-and-email-credential-flows.md#password-change-security-notices-owner-approved-2026-10-15)
define the binding boundary. The earlier
[owner-approved notice brief](PASSWORD_CHANGE_NOTICE_DECISION_BRIEF.md) records
that approval; it does not approve the remaining decisions here.

[ADR-088](decisions/ADR-088-account-email-delivery-and-recovery.md) approves exactly
four other messages. Its seven-day email-switch notice delivery window and 30-day
terminal retention are accepted for its supported messages, not automatically for
password change. PROJECT §34 and ADR-087's
[2026-10-17 implementation record](decisions/ADR-087-account-onboarding-and-email-credential-flows.md#implementation-record-independent-password-change-in-app-notices-2026-10-17-pht)
expressly preserve this event's open copy, retention and delayed/deleted-account
rules. This is a scope gap, not a conflict requiring the accepted trigger to reopen.
Later ADR-087 records supersede historical signup/sign-in mounting status only.

Current code atomically persists one owner-private `password_change_notice` and a
fixed locked email-eligibility outcome with credentials and session revocation.
The command and owner-only detail reader remain unmounted. No password-change
email intent, recipient snapshot, template, dispatch or later backfill exists,
including for eligible changes. The existing SQL recipient constraint permits only
the separate email-switch warning. See [local testing and gates](PASSWORD_CHANGE_LOCAL_TESTING.md#security-notice-decision-and-remaining-gates).

## Accepted rules that decisions must preserve

| Area | Binding ADR-087 rule |
| --- | --- |
| Trigger and eligibility | Every successful authenticated change has one mandatory account-private in-app notice. Email is mandatory only if the primary address has Better Auth `emailVerified = true` and non-null domain `emailVerifiedAt` no later than event time, reread under committing locks. Unverified, mismatched or future-dated verification creates no email intent or snapshot. No later verification backfill. |
| Credential transaction | Recent sign-in and current-password checks apply. Keep the initiating session and revoke other sessions. Commit all required notice work and eligible immutable recipient binding with credential/session changes; a required write failure rolls back all effects. Delivery failure after commit never undoes them. |
| Recipient races | Bind to the verified primary address at commit. A later primary-address switch alone cannot retarget or suppress that warning. Pending, new or historical addresses are not fallbacks. Email proof first revokes the old session and rejects its attempted password change. |
| Content limits | Permit the change fact, PHT event time, accurate revocation facts and guidance to open Halaga directly and use approved recovery. Do not assert who acted or that no later session exists. Final subject/body/template review remains open. |
| Content exclusions | No passwords/hashes, tokens, credential-bearing links, session IDs, IP/device/location, DOB, display name, addresses in subject/body, messages, proposal amounts, IMEI or evidence. Do not invent a support contact, origin, recovery URL or action token. |
| Identity and failure | One opaque logical change identity with channel-specific work keys and processed-work records. Retries reuse identity; distinct changes remain distinct; rejected commands create no notice. No password/session/address-derived keys. Email failure neither changes verification nor selects another recipient. |
| Retention boundary | Recipient snapshots are private delivery data for approved delivery/recovery purposes, then deleted or irreversibly anonymized under an approved rule. Minimal metadata needs its own classification. Transaction/negotiation periods and intent history do not authorize recipient retention. |

Use [ADR-073](decisions/ADR-073-postgresql-backed-durable-jobs.md) for atomic work,
leases, idempotency, bounded retry, recovery and original deadlines. Reuse ADR-088's
accepted generic transport/dispatch mechanisms after the event-specific decisions;
do not invent new retry allowances or claim exactly-once mailbox delivery. Restricted
staff reconciliation and provider-accept/crash ambiguity remain operational gates.

## Affected flows, states and readers

- **Account owner:** password change, in-app notice and later recovery; verified,
  unverified and mismatched eligibility; later verification or email switch; deletion
  requested, blocked or eligible. The existing reader rechecks the exact stored
  session and undeleted owner mapping and selects only event ID/type/version/time
  and read time. It excludes work and eligibility metadata.
- **Delivery worker:** a future channel-specific projection may read only the
  eligible immutable recipient and necessary work data. ADR-088's existing READY,
  LEASED, SENDING, ACCEPTED, FAILED, UNKNOWN and SUPPRESSED states are reference
  mechanics, not implemented password-change email states. Decisions must cover
  queued, retrying, ambiguous and terminal work, including outages and late cleanup.
- **Operators and auditors:** diagnosis, reconciliation, controlled retry, scoped
  retention exceptions and cleanup evidence require role, purpose and audited
  access. This brief authorizes no staff reader or retry endpoint.
- **Privacy boundary:** recipient addressing stays private to delivery/recovery;
  in-app detail stays owner-only. Exclude recipient data from generic/public or
  unrelated-user readers, previews, metadata, search, responses, operational logs,
  analytics and caches. Provider-held copies and backups are separate deletion
  surfaces. Apply [ADR-085](decisions/ADR-085-privacy-safe-operational-logs.md);
  general logs cannot substitute for restricted audit history.

## Prerequisites recorded before ADR-089

These entries record the gaps before ADR-089. Its accepted policy now resolves
copy, timing, classification, cleanup and deletion behavior; actual provider/backup,
hold and operational evidence remains a real-data gate. Original options below
explain the tradeoffs and do not override ADR-089.

| Decision | Required approval artifact and tradeoff |
| --- | --- |
| Final email copy/template | Approve exact authoritative English subject, plain text and escaped HTML, template/event version, PHT timestamp format and approved recovery wording. ADR-088 does not require paired Cebuano for account emails. A link-free notice follows the existing email-switch pattern; any proposed link still needs explicit privacy review within ADR-087's content limits. Reusing reset copy would misstate a completed change. No rendered message storage or tracking is authorized by this brief. |
| Delivery window and delayed work | Set a maximum send/recovery window, its start instant and boundary semantics. Explicitly decide whether to extend ADR-088's seven-day notice window to this event or approve another bounded window with rationale. A longer window improves outage recovery but prolongs private recipient retention and can produce stale warnings. Late execution must use the original approved deadline, not restart it. Define the terminal outcome and required cleanup when that deadline passes. |
| Ordinary recipient retention | Specify the recipient snapshot's purpose, storage/projection, period, clock start and erase/anonymize action for each delivery outcome. Compare erasing after acceptance/expiry with retaining for a bounded recovery period: the former reduces exposure, the latter supports diagnosis. Decide FAILED/UNKNOWN handling explicitly. Do not assume a 30-day snapshot period from ADR-088 or keep recipients indefinitely for retries. |
| Minimal metadata classification | Enumerate necessary account/event/work references, event time, eligibility, state, attempt/lease fields, error codes, provider message ID and outcome timestamps; justify each retained field. Set separate periods/start instants and deletion/anonymization rules as needed. Opaque identifiers can remain account-linkable personal data. Decide what bounded deduplication/audit evidence survives recipient erasure and why; do not reclassify recipients or message content as metadata. |
| Cleanup contract | Define erasure/purge behavior for nonterminal, expired, accepted, rejected, ambiguous and suppressed work; account deletion; and exception release. Specify transaction/lock coordination with claims, sends, retry and deletion, restart-safe cleanup and minimal audit evidence. Resolve dependencies among snapshot, outbox, delivery/job and processed-work records before removing deduplication history. Select execution ownership and scheduling through the separate worker/deployment decision; no cadence is assumed here. |
| Delayed or deleted account | Decide queued/leased work handling when deletion is requested versus committed, whether this notice work counts as an unresolved workflow under PROJECT §28.3, and whether committed deletion suppresses delivery or permits a narrowly justified bounded delivery purpose. ADR-088's deleted-account suppression is a reference for its four messages, not this decision. Neither a new deletion blocker nor post-deletion sending is approved. Define in-flight/ambiguous send handling, recipient erasure and remaining private records. |
| Provider and backup propagation | Document what copies remain at the provider and in backups, verified purge limits, responsibility and deletion propagation after restore. Determine how cleanup/exception release reaches those copies. No unsupported erasure guarantee, new provider or paid path may be assumed; provider-specific verification remains a launch gate. |

The durable in-app notice, eligibility/read state and account association also need
an explicit retention/deletion classification before real data. They are distinct
from delivery metadata: an email job's terminal outcome must not silently erase the
owner's notice, and read state must not silently authorize indefinite storage. This
brief does not select that classification or extend email periods to in-app data.

Account deletion must preserve [PROJECT §28.3](../PROJECT.md#283-account-deletion):
full deletion is blocked while applicable unresolved workflows remain; after eligible
deletion, login is permanently disabled and only purpose-required records remain
private until their retention ends. A later primary-address switch alone is never a
reason to suppress the historical password-change warning. Distinguish it from
deletion and delivery expiry in the eventual guarded dispatch policy.

A request already sent to the provider may complete during deletion or expiry;
approval must acknowledge that it cannot reliably be recalled. Decide how to record
and reconcile that outcome without recreating erased recipients, extending the
original deadline or blindly resending ambiguous work. No cleanup/retry path may
backfill historical notices from the current in-app eligibility record.

[ADR-079](decisions/ADR-079-documented-retention-exceptions.md) permits only scoped,
documented exceptions for an active case/safety investigation or legal obligation
or hold, reviewed at least every 30 calendar days. That review interval is not an
ordinary retention period. Release must trigger deletion/anonymization under the
approved ordinary rule without undue delay; access remains private and audited.

## Completion and mounting gates

Record explicit owner/product and architecture/privacy decisions in an accepted ADR
or supplement, including versioned copy and the per-data/per-state retention table.
Synchronize PROJECT, architecture, glossary and trackers where the accepted decision
changes them. Until then, all options here remain open and dependent email work
stays blocked; this document is not approval to mount the operation.

After approval, implement and verify atomic eligible intent/recipient writes,
immutable addressing after email switches, required-write rollback, deduplication,
deadline/deletion races, ambiguous delivery and cleanup/exception release using
synthetic data and a fake provider. Preserve in-app independence and prove safe
owner/worker/staff projections. Review the final email for plain language,
accessible text/HTML and truthful delayed-event wording under
[design §§5.12 and 7](../design.md#512-in-app-notifications-and-accountprofile-controls).

Mounting separately requires protected HTTP/client integration, current serialized
sign-in/session race checks, direct credential-write compatibility review, and
existing operations/readiness gates. Serialized sign-in and local signup are now
implemented; that does not itself complete password-change integration. No real
email, participant data, persistent migration, deployment or billing is authorized.

## Concrete proposal for owner review (2026-10-20 PHT)

**Accepted as ADR-089 after explicit approval of all three questions.** The owner
requested a decision interview after the prerequisite audit. The following package
preserves the reviewed proposal; ADR-089 records its acceptance and is binding.
Its periods were selected explicitly for password change, not inherited from
another message. PROJECT, architecture and glossary are synchronized.

### A. Version-1 email and delivery window

Proposed subject: `Your Halaga password changed`

Proposed exact plain text, with one server-rendered timestamp placeholder:

```text
The password for your Halaga account changed on {eventTimePHT}.

At that time, other sessions were signed out. The session used for this change remained signed in.

If you did not expect this change, open Halaga directly and use the password reset option.
```

Use fixed English month names and 24-hour time in
`DD Mon YYYY, HH:mm:ss PHT (UTC+08:00)` format, computed in `Asia/Manila` from the
committed event instant. Version 1 HTML contains exactly these three paragraphs,
escaped, in an English document; no links, tracking, images or additional copy.
Render at dispatch and do not store rendered text/HTML. Recipient addressing is
transport-only. The existing ADR-087 exclusions and commit-time eligibility stay
binding.

Propose an exact seven-times-24-hour delivery window from event time. No send may
start at or after that deadline, and retry/recovery cannot extend it. This allows
bounded outage recovery, at the cost of potentially delayed security warnings.
Reuse ADR-088's existing two-minute fenced leases, five-attempt bound, explicit-429
backoff and ambiguous-outcome quarantine; no new retry allowance or endpoint.

### B. Recipient, metadata and in-app retention

| Data/state | Proposed ordinary rule and purpose |
| --- | --- |
| Recipient in READY/LEASED/SENDING | Keep the immutable commit-time address for delivery only, until the original seven-day deadline at the latest. Never fall back to another address. |
| Recipient after ACCEPTED or SUPPRESSED | Erase in the transaction recording that outcome; keep only the bounded non-address metadata below. Acceptance means provider acceptance, not inbox delivery. |
| Recipient after FAILED or UNKNOWN | Keep only until the original seven-day deadline for purpose-restricted reconciliation, then erase. UNKNOWN must never be automatically resent. This does not authorize a staff reader or controlled-retry endpoint. |
| Delivery metadata | Keep account/event/outbox/job IDs and channel work key for association/deduplication; type/version/event time and original deadline for interpretation/expiry; state, attempts, availability and lease fields for dispatch/fencing; fixed error code, bounded provider message ID and outcome timestamps for reconciliation. These are private, potentially account-linkable data, not anonymous analytics. Retain until the earlier of terminal outcome plus 30 days or event time plus 37 days; then purge outbox, delivery and their email processed-work evidence together. Clear lease fields on terminal transition. No recipient, rendered content, token, password, request data or raw provider error belongs in metadata. |
| In-app notice, eligibility and read state | Keep account association, event/work identity, type/version/time, fixed eligibility and nullable read time for 90 days from the event, then delete together. Reading does not restart the period. This gives the owner a bounded security history; email terminalization or metadata purge alone does not erase it. Committed account deletion erases it sooner, subject only to ADR-079's scoped exceptions. |

All boundaries use `now >= deadline`; they are elapsed durations, not business-day
or local-midnight calculations. Cleanup remains an explicitly invoked existing
worker operation, with no proposed cadence. Outages can delay physical execution;
on resumption, cleanup uses the original due instants and immediately handles
overdue records, without starting new retention clocks or exposing expired records
to readers. No bounded deletion-latency guarantee is claimed until worker/hosting
readiness is verified.

Cleanup must serialize with account commands, deletion and job claims/sends using
the existing lock order and fenced state updates. At delivery expiry, READY/LEASED
work becomes SUPPRESSED; SENDING work becomes UNKNOWN because acceptance may have
occurred; FAILED/UNKNOWN keep their truthful outcome but lose the recipient.
Late acknowledgements cannot recreate addressing or overwrite a fenced outcome.
Cleanup is restart-safe and purges dependent email work together only after it
cannot send again. No cleanup, replay or reconciliation may reconstruct email
from the in-app eligibility record or the current account address.

Use ADR-085's fixed, non-identifying operational cleanup outcomes/counts rather
than a new permanent per-recipient deletion log. ADR-079 permits only separately
documented, purpose-restricted exceptions reviewed at least every 30 calendar
days. Exception release applies the original ordinary deadline without a fresh
period. Hold enforcement and audited staff tools remain real-data readiness gates;
synthetic validation does not implement or exercise real holds.

### C. Deletion, external copies and scope

Propose that a deletion request alone does not suppress the notice while deletion
is blocked by another workflow. This notice's queued, failed or ambiguous delivery
does not itself block eligible account deletion. On committed deletion, atomically
suppress READY/LEASED work, erase all remaining password-change recipients and
in-app records, and fence SENDING work as UNKNOWN. Keep only the bounded metadata
above for delivery reconciliation; deletion cannot restart its clock. Other
unresolved-workflow blockers in PROJECT section 28.3 remain binding. The actual
deletion workflow is a separate implementation; synthetic checks must exercise
the committed-deletion boundary before any real account use.

A send already handed to the provider cannot reliably be recalled and may arrive
after expiry or deletion. Do not promise recall, recreate erased addressing or
blindly resend. A later primary-address change alone must never suppress or retarget
this notice.

The designated owner/operator must verify provider-held recipient/content/diagnostic
copies, tracking disablement, backup expiry and restore behavior before real data
or sending. Record actual provider purge limits and deletion procedures; do not
claim instant external erasure. Restores must reapply original retention/deletion
cutoffs and released exceptions before enabling reads or dispatch. Provider-specific
evidence, hosting/worker readiness and exception enforcement remain launch gates,
not permission to retain live copies indefinitely.

Approval of this package would authorize documenting the rules and completing only
the previously requested unmounted synthetic pipeline with a fake provider. It
would not authorize mounting commands/readers/UI, real sending, participant data,
a schedule, deployment, new provider/dependency or billing path.
