# Decision brief: remaining password-change email and retention rules

Date: 2026-10-19 PHT. **Status: Open; no proposal in this brief is accepted.**

Scope: decisions required before completing and mounting the existing authenticated
password-change operation. This is not password reset or the email-switch warning.
It adds no runtime behavior, recipient storage, template, delivery, cleanup schedule,
provider setup or permission to use real participant data. Any future validation
must use synthetic data until ADR-081 readiness gates pass.

## Authority and current implementation

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

## Decisions still required

All entries below are **open**. Options describe tradeoffs, not defaults.

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
