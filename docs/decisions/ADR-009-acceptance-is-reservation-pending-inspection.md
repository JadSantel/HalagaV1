# ADR-009: Treat Offer Acceptance as a Reservation Pending Inspection

- Status: Accepted
- Date: 2026-10-05

## Context

Listings concern used, damaged, and sometimes non-functional electronics. Photos and seller descriptions may not reveal every defect, missing component, or mismatch. Treating an accepted remote offer as an immediately binding completed sale would create risk when the buyer later inspects the physical item.

At the same time, the parties need a clear transition from negotiation to arranging the exchange.

## Decision

Seller acceptance of a negotiated offer represents a reservation and mutual intent to transact at the proposed terms, subject to the buyer's physical inspection of the item at pickup or meetup.

Acceptance does not by itself:

- Complete the transaction.
- Guarantee that payment or transfer will occur.
- Establish the accepted amount as the final completed-sale price.
- Prevent an inspection outcome from ending the transaction under rules still to be defined.

## Consequences

- The transaction lifecycle must distinguish at least `negotiating`, `reserved/pending inspection`, and `completed` states.
- Product language must avoid presenting reservation as a completed or legally guaranteed sale.
- Marketplace metrics must distinguish accepted reservations from completed exchanges.
- The listing needs defined behavior while reserved, including whether it becomes hidden and what happens to competing offers.
- Pickup or meetup coordination follows reservation and precedes completion.
- The platform must record the final outcome and final price separately from the accepted pre-inspection proposal.
- Inspection criteria, post-inspection renegotiation, cancellation reasons, no-shows, and misrepresentation handling remain unresolved.

## Source

- `product.md`, especially sections 15, 17, 19, 21, 34, and 35
- Project interview decision made on 2026-10-05
