# ADR-048: Allow Buyer Withdrawal Before Seller Acceptance

- Status: Accepted
- Date: 2026-10-11

## Context

A buyer's circumstances or valuation may change while a proposal is active. Requiring support approval to withdraw an unaccepted proposal would add friction and leave offers that no longer represent genuine buyer intent.

## Decision

A buyer may withdraw their active offer at any time before the seller accepts it, without support approval.

Withdrawal takes effect immediately when validly submitted. It makes the current proposal non-actionable, notifies the seller, and remains in the negotiation history. It does not erase messages or prior proposals.

After seller acceptance, the transaction is a reservation rather than an active offer. Ending it follows the reservation-cancellation or expiry rules, not offer withdrawal.

## Consequences

- Offer acceptance and withdrawal must be serialized or otherwise protected from races so only one can win.
- A seller cannot accept a withdrawn or expired proposal.
- Withdrawn offers do not automatically reactivate; the buyer must submit a new structured proposal if the listing remains eligible.
- Immediate withdrawal before seller response does not satisfy the valid-offer metric under ADR-029.
- Repeated manipulative offer-and-withdraw behavior may be reported and reviewed as abuse.
- Reservation cancellation rules remain separate and unresolved.

## Source

- ADR-029: Use an Eight-Week Pilot and 30 Completed Transactions as the Primary Threshold
- ADR-041: Apply a Fixed Expiration to Offers and Counteroffers
- Project interview decision made on 2026-10-11
