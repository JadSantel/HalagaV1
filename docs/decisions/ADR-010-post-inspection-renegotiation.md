# ADR-010: Allow Post-Inspection Renegotiation and Record the Final Price

- Status: Accepted
- Date: 2026-10-05

## Context

Physical inspection may reveal information that neither party could verify during listing and pre-acceptance negotiation. Requiring the parties either to transact at the reserved price or cancel could prevent a reasonable adjustment when the discrepancy is genuine.

Allowing a price change at the exchange also creates a risk of opportunistic last-minute pressure, especially when one party has already spent time or money traveling.

## Decision

After inspecting the item, the parties may renegotiate and complete the transaction at a price different from the accepted pre-inspection proposal.

The platform will preserve both:

- The pre-inspection price associated with the accepted reservation.
- The final price agreed after inspection and recorded for the completed transaction.

The final price must not overwrite or erase the earlier negotiation history.

## Consequences

- The transaction data model needs separate reserved-price and final-price fields or equivalent immutable proposal records.
- Marketplace analytics and future valuation data must use clearly defined price types and should not assume the accepted pre-inspection amount equals the completed-sale amount.
- The product should capture whether the price changed after inspection and why, subject to a later decision about required reasons.
- Users need a clear completion flow for recording the final terms.
- Safeguards are needed against inspection being used as a pretext for coercive last-minute price reductions.
- Whether both parties must confirm the final price, and how disagreements are handled, remain unresolved.

## Source

- `product.md`, especially sections 17, 21, 24, 34, and 35
- ADR-009: Treat Offer Acceptance as a Reservation Pending Inspection
- Project interview decision made on 2026-10-05
