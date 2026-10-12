# ADR-041: Apply a Fixed Expiration to Offers and Counteroffers

- Status: Accepted
- Date: 2026-10-06

## Context

Open-ended proposals can remain apparently actionable after a buyer's funds, market assumptions, or willingness have changed. Allowing each proposer to choose a deadline would add flexibility but create inconsistent urgency, comparison difficulty, and pressure tactics.

## Decision

Every structured buyer offer and seller counteroffer in the MVP has a fixed 72-hour validity duration.

Users cannot choose a shorter or longer proposal deadline. When a new counterproposal is submitted, it becomes the currently actionable proposal and receives the standard validity duration from its submission time. Expired proposals remain in the negotiation history but cannot be accepted.

When a negotiation is paused as a backup because another buyer reserved the listing, its existing proposal does not automatically resume if that reservation fails. The backup buyer must explicitly reactivate the same amount or submit a revised proposal after reviewing the listing and current context. Either action creates a fresh 72-hour actionable proposal. Until then, the negotiation remains non-actionable.

The listing reopens to all eligible buyers immediately when the reservation ends without completion. Backup buyers are notified but have no exclusive reactivation window; they may reactivate while the listing remains active.

## Consequences

- Each proposal needs submitted-at and expires-at timestamps and a derived or stored expiration state.
- Acceptance must be validated atomically against proposal expiry.
- Notifications should warn the receiving party before expiration without creating excessive email.
- Free-form messages cannot extend an offer; only a new structured proposal creates a new actionable amount and deadline.
- Historical expired proposals remain available for dispute and negotiation context.
- Backup notifications must not imply priority over new offers.

## Source

- `product.md`, especially sections 15 and 16
- ADR-007: Support Seller Counteroffers and Price Negotiation
- ADR-008: Keep Pre-Acceptance Negotiation In the Platform
- Project interview decision made on 2026-10-06
