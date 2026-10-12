# ADR-011: Require Dual Confirmation of Final Price and Completion

- Status: Accepted
- Date: 2026-10-05

## Context

Completed transactions and their final prices may later inform marketplace success metrics and valuation guidance. If either party can unilaterally declare a transaction complete at a chosen price, the resulting records may be inaccurate or disputed.

Requiring agreement from both participants improves data integrity but introduces an intermediate state when only one party has confirmed.

## Decision

A transaction is completed only after both the buyer and seller confirm inside the platform:

- The same final transaction price.
- That the item transfer and transaction were completed.

One party's submission creates or updates a pending confirmation; it does not complete the transaction by itself.

## Consequences

- The lifecycle needs a `pending completion confirmation` state in addition to negotiation, reservation, cancellation, and completion states.
- Each party's confirmation, confirmed price, and timestamp must be recorded separately.
- Conflicting price submissions must not be treated as completion and require reconciliation.
- Completed-transaction metrics and historical valuation data should include only mutually confirmed transactions, with any later exclusions for fraud or reversal clearly tracked.
- The interface must show which confirmation is outstanding without exposing information to unrelated users.
- Reminder, timeout, non-response, dispute, and administrative-resolution behavior remain unresolved.

## Source

- `product.md`, especially sections 17, 21, 24, 34, and 35
- ADR-010: Allow Post-Inspection Renegotiation and Record the Final Price
- Project interview decision made on 2026-10-05
