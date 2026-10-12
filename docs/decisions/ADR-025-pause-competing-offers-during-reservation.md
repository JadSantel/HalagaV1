# ADR-025: Pause Competing Offers as Backups During a Reservation

- Status: Accepted
- Date: 2026-10-06

## Context

Offer acceptance creates a reservation subject to inspection rather than a guaranteed sale. The reserved transaction may fail because of inspection findings, cancellation, or a no-show. Immediately rejecting every other buyer would remove a useful recovery path, while allowing concurrent acceptance would create conflicting commitments for the same item.

## Decision

When a seller accepts one proposal and creates a reservation:

- The listing stops accepting new offers while the reservation is active.
- Existing competing offer negotiations are paused as backups rather than rejected.
- The seller cannot create a second simultaneous reservation for the same listing.
- Paused buyers are informed that another offer is currently reserved without seeing that offer's amount, messages, or buyer identity.

When the reserved transaction is mutually completed, the listing closes and paused competing offers are closed as unsuccessful. When the reservation ends without completion, the listing reopens to all eligible buyers immediately. Eligible backup buyers are notified and invited to review their prior negotiation, but they receive no exclusive window or priority. A backup offer does not automatically become active or actionable; its buyer must explicitly reactivate or revise it.

## Consequences

- Listing, negotiation, and reservation states must be coordinated transactionally to prevent double reservation.
- Paused offers retain their history but cannot be accepted or actively negotiated during the reservation.
- Offer privacy continues to apply when notifying backup buyers.
- Buyers need clear status language so `paused` is not mistaken for rejection or acceptance.
- Backup reactivation creates a fresh actionable proposal under ADR-041 rather than resuming a stale expiration clock.
- There is no protected backup ordering or exclusive reactivation period; competing proposals are evaluated normally after reopening.
- Reservation cancellation and no-show resolution details remain unresolved.

## Source

- ADR-005: Keep Offer Amounts Private
- ADR-009: Treat Offer Acceptance as a Reservation Pending Inspection
- Project interview decision made on 2026-10-06
