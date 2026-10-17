# Owner decision brief: password-change security notices

Date: 2026-10-15 PHT. **Accepted by the project owner on 2026-10-15 PHT.** The owner
answered “Yes” to approval of the recommendation and contract. Binding requirements
are recorded in [ADR-087](decisions/ADR-087-account-onboarding-and-email-credential-flows.md#password-change-security-notices-owner-approved-2026-10-15).
Acceptance is not implementation: the password-change command remains unmounted;
its disabled preview is not a working flow. This brief records policy; the current
independent in-app implementation is described below and in the local testing guide.
Scope: authenticated password change, not password reset.

## Evidence and finding before approval

The preapproval sources left a **policy gap, not a conflict**. PROJECT is authoritative;
accepted ADRs are binding. Architecture §1 gives PROJECT and the most recent
accepted ADR precedence. The quotations below preserve that review; subsequent
approved edits resolve the gap, so they are not all current source wording.

| Source | Relevant exact passage | Meaning |
| --- | --- | --- |
| [PROJECT §8.5](../PROJECT.md#85-authentication-protection) | “an authenticated password change requires recent sign-in and revokes other sessions while keeping the current one.” | Defines credential/session behavior, not notices. |
| [PROJECT §8.5](../PROJECT.md#85-authentication-protection) | “An unverified adult may sign in and browse.” | Unverified accounts exist; their notice behavior needs an explicit decision. |
| [PROJECT §34](../PROJECT.md#34-deferred-decisions) | “Whether an authenticated password change requires a security notice, its recipient and privacy-reviewed intent/template contract” | Explicitly defers this policy. |
| [ADR-087, Password and email changes](decisions/ADR-087-account-onboarding-and-email-credential-flows.md#password-and-email-changes) | “Revoke every session, require sign-in again, and send a privacy-reviewed security notice to the old address.” | Applies to successful **email proof/switch**, not password change. |
| [ADR-087, Delivery](decisions/ADR-087-account-onboarding-and-email-credential-flows.md#delivery-limits-and-implementation-boundary) | “Verification, reset, and account-security email use the accepted durable PostgreSQL outbox/job path and privacy-reviewed templates” | Specifies delivery for required email; does not establish a password-change trigger. |
| [ADR-087, Delivery](decisions/ADR-087-account-onboarding-and-email-credential-flows.md#delivery-limits-and-implementation-boundary) | “Delivery failure never marks an address verified and never rolls back a committed account, email change, or password change.” | A failure rule cannot establish whether or where to send a notice. |
| [ADR-087, password-change implementation record](decisions/ADR-087-account-onboarding-and-email-credential-flows.md#implementation-record-unmounted-authenticated-password-change-2026-10-15) | “This slice adds no notice intent and does not accept omission as product policy.” | Current absence of intent is an implementation boundary, not accepted omission. |
| [Architecture §6](../architecture.md#6-flow-level-notification-contract) | “State changes first commit the domain record and a durable notification intent in the same transaction.” | Governs required intents; does not enumerate their triggers. |
| [Architecture §6](../architecture.md#6-flow-level-notification-contract) | “Duplicate worker execution must not create duplicate logical notifications.” | Requires logical deduplication. |
| [ADR-075](decisions/ADR-075-brevo-free-transactional-email.md#decision) | “Provider rejection, quota exhaustion, and transient delivery errors remain visible, retryable notification states” | Delivery failures remain operational work, separate from credential success. |
| [ADR-075](decisions/ADR-075-brevo-free-transactional-email.md#consequences) | “Email is a delivery channel, not the authoritative notification record.” | Durable in-app notification must remain available during email failure. This does not itself define a password-change event. |
| [ADR-087, email-change implementation record](decisions/ADR-087-account-onboarding-and-email-credential-flows.md#implementation-record-unmounted-email-change-2026-10-14) | “Approved retention/deletion rules apply; intent history does not authorize indefinite recipient retention.” | The existing old-address exception is purpose-limited, not permission to retain every notice recipient indefinitely. |

[PROJECT §§25–28](../PROJECT.md#25-notifications), [architecture §3](../architecture.md#3-actors-and-information-scopes)
and [ADR-085](decisions/ADR-085-privacy-safe-operational-logs.md) constrain content,
readers and logs. [ADR-073](decisions/ADR-073-postgresql-backed-durable-jobs.md)
constrains delivery, not the missing trigger/recipient rule.

The [password-change record](PASSWORD_CHANGE_LOCAL_TESTING.md#security-notice-decision-and-remaining-gates)
and repository/tests allow verified, unverified and mismatched verification states
to change passwords without changing verification. They add no notice. The later
[integration record](ACCOUNT_FLOW_INTEGRATION.md) clarifies that disabled previews
and synthetic handlers exist; account API commands remain unmounted.

## Choices and approved recommendation

| Choice | Account-security benefit | Privacy/operational cost |
| --- | --- | --- |
| Email after every successful change to the current primary address, verified or not | Offers an external warning even before verification. | A mistyped or third-party signup address receives account-activity disclosures; an abuser can generate unwanted notices. Verification is not proof of identity, but its absence leaves mailbox control unproved. |
| Email only when the current primary address is verified at the change | Warns a mailbox whose control was proved; avoids new activity disclosures to unverified addresses. | Unverified users receive no external warning. A compromised verified mailbox can still receive notices. |
| Send to the address current at delivery, a pending new address, or historical addresses | Might reach a later mailbox or an earlier owner. | Can redirect a past security warning after takeover, disclose activity to an unproved address, or require unjustified address history. Reject for this event. The separate mandatory email-switch notice still goes to its old address. |

**Approved:** every successful authenticated password change atomically records
one mandatory, account-private in-app security notice. Email delivery is mandatory
only when, under the committing transaction's locks, the primary address has both
Better Auth `emailVerified = true` and a non-null domain `emailVerifiedAt` no later
than the event time. This in-app trigger and conditional email rule were explicitly
approved, not inferred from the earlier ADR-075/087 delivery clauses. They are not
an optional marketing preference.

For unverified or mismatched verification states, create the in-app notice but no
email intent or recipient snapshot. Do not block password maintenance, repair
verification, or grant marketplace access. Record a fixed, private email-eligibility
outcome without address copies. Later verification does not backfill an email for
this past change. No fallback recipient is inferred.

This reduces third-party disclosure but leaves unverified users without external
warnings. In-app notices cannot reliably alert an owner locked out by an attacker.
Verified email cannot protect a compromised mailbox or guarantee prompt delivery.
Existing recent-sign-in/current-password checks and session rules remain necessary.

## Approved content, transaction and delivery contract

- **Content:** permit the password-change fact, PHT event time, and other-session
  revocation with the initiating session retained. Do not assert who acted or that
  no later session exists. Permit guidance to open Halaga directly and use approved
  recovery if unexpected. No invented support contact, origin, recovery URL or
  action token. Final copy/template review remains required.
- **Omissions:** no passwords/hashes, tokens or credential-bearing links, session
  IDs, IP/device/location information, DOB, display name, current/new/pending email
  address in subject/body, private messages, offer amounts, IMEI or evidence. The
  recipient belongs only in delivery addressing, never generic readers, logs,
  analytics, caches or command responses. In-app detail is owner-only; staff access
  requires role, purpose and audit. Workers use a recipient/channel projection.
- **Atomic binding:** reuse the account-owned identity/domain, credential and
  initiating-session lock order. Reread address and verification under those locks,
  never from the earlier session lookup. Commit credential
  replacement, other-session revocation, the in-app notice intent and any required
  email intent/immutable recipient snapshot together. Failure to persist required
  work rolls back all effects. Provider failure after commit never rolls them back.
  Permit only account reference, versioned event type, opaque change/work identifier,
  event time, channel/eligibility outcome and eligible email recipient as needed.
  No password-derived, session-derived or address-derived deduplication key.
- **Email races:** if password change commits first at verified address A, bind its
  email to A, even if email proof later switches to B before dispatch. Do not
  retarget or suppress that historical warning merely because primary changed.
  Email proof still creates its separate old-address notice. If email proof wins
  first, its revocation makes the old initiating session fail password change;
  no password-change notice results. A later fresh sign-in changing the password
  binds to verified B. Pending email-change requests cannot change the recipient.
  Verification races likewise use commit-time eligibility, without backfill.
- **Duplicates and failure:** give each committed change one stable logical event
  identity, with channel-specific work keys and processed-work records. Retries
  and lease recovery reuse them; distinct changes in one session remain distinct.
  Failed/rejected commands create no notice. Follow ADR-073's leases, recovery,
  bounded exponential backoff,
  role-restricted failed-job queue and audited controlled retries. Do not promise
  exactly-once mailbox delivery across a provider-accept/crash ambiguity; provider
  idempotency/reconciliation remains a dispatch gate. In-app availability is
  independent. Failure never changes verification or selects a fallback address.
- **Retention:** treat the snapshot as private delivery data, as with the existing
  old-address notice. Retain it only for approved delivery/recovery purposes, then
  delete or irreversibly anonymize under an approved cleanup rule; minimal delivery
  metadata follows its own classification. Neither PROJECT's 24-month transaction
  period nor six-month negotiation period defines a notice-recipient period.
  Period, cleanup and provider/backup deletion remain readiness gates, including
  delayed work/account deletion.
  ADR-079 exceptions require scoped authorization and review at least every 30
  calendar days; they do not supply a missing ordinary retention period.

## Approval and follow-through

The owner approved the recommendation and contract, including in-app notices for
every success, verified-only email, explicit unverified/mismatch email omission and
commit-time recipient binding without retargeting. ADR-087, PROJECT, architecture,
the glossary and implementation/testing records now distinguish accepted policy
from incomplete notice implementation.

The 2026-10-17 independent implementation adds synthetic in-app coverage for verified/unverified/both mismatch directions,
future verification timestamps, verification before/after the change, both email-
proof lock orders and pending changes, intent/write/deferred-commit rollback and
retry, distinct changes versus duplicate work, safe projections/content and logs,
and supported email delivery failure without credential/in-app rollback. Password-change
email delivery, snapshot binding and snapshot retention are not implemented or tested.
The new in-app-only table does not broaden recipient storage:
the SQL constraint permits `recipientEmail` **only** for
`account.email-changed-security-notice`. This policy update does not broaden it.
Dispatch/recovery tests require their separate contracts. Approval does not
authorize mounting, credentials, delivery or participant data; sign-in race,
job, retention, deployment and ADR-081 gates remain.

## Implementation boundary checked 2026-10-17 PHT

ADR-088's newer template table approves exactly four messages, excluding password
change. Its supported-message cleanup contract does not expressly settle this
brief's ordinary password-change recipient/metadata period or delayed/deleted-account
handling. PROJECT's instruction to reuse those generic mechanics does not approve
missing password-change copy or silently extend the specific recipient-retention scope.
These are remaining decisions, not a reason to reopen the accepted trigger/recipient.

Completed: atomic owner-private in-app record and fixed commit-time eligibility,
opaque unique event/work identity, safe unmounted owner detail, rollback/retry and
synthetic race/privacy checks. No rendered notice copy is stored. Dependent email
intent/snapshot/delivery remains unimplemented for all changes, including eligible
ones; no later email backfill is authorized. The command, preview and reader remain
unmounted/disabled. See [current local testing](PASSWORD_CHANGE_LOCAL_TESTING.md).
