# ADR-053: Block Full Account Deletion While Marketplace Workflows Are Active

- Status: Accepted
- Date: 2026-10-11

## Context

Deleting an account during a listing, negotiation, reservation, completion-confirmation flow, or dispute could strand the counterparty, break deadlines, remove evidence, and make transaction state impossible to resolve consistently.

## Decision

The MVP will not permit full account deletion while any marketplace workflow involving the account remains active or unresolved.

Blocking conditions include, at minimum:

- Active or draining listings.
- Active offers, counteroffers, paused backup negotiations, or buyer-reconfirmation states.
- Active reservations or appointments.
- Pending or conflicting completion confirmations.
- Open reports, disputes, verification review, or support cases requiring the user's participation or record preservation.

The user must close, withdraw, cancel, complete, or otherwise reach a terminal state for the applicable workflows before deletion can proceed, subject to policies that prevent unilateral erasure of another party's claim.

After an account becomes eligible and deletion is completed:

- Login is permanently disabled for that account.
- The public profile and any remaining public-facing listings or content tied to the account are removed from public access.
- The account's display identity in retained transaction-facing history is replaced with `Deleted user`.
- Only non-public records still required by an applicable retention purpose remain, such as transaction audit records, dispute findings, moderation history, or verification audit metadata.
- Retained records are deleted or irreversibly anonymized when their applicable retention periods end unless a valid documented exception, such as an active legal hold, applies.

Deletion must not expose the former display name through public pages, search indexes, caches, notifications generated after deletion, or ordinary counterparty views.

## Consequences

- Account deletion eligibility requires a server-side check across marketplace and support states.
- The interface must explain each blocking workflow and the allowed action rather than show a generic deletion error.
- Account deletion does not override the 24-month closed-transaction retention policy or the six-month post-termination verification-document policy.
- Support action may be needed when a workflow cannot be resolved through ordinary user actions.
- Retained audit data must remain restricted to its approved operational purpose and must not silently recreate a public profile.
- Search and cache invalidation are part of the deletion workflow.

## Source

- ADR-011: Require Dual Confirmation of Final Price and Completion
- ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies
- ADR-036: Human-Review Business and Professional Technician Verification
- ADR-052: Retain Closed Transaction Records for 24 Months
- Project interview decision made on 2026-10-11
