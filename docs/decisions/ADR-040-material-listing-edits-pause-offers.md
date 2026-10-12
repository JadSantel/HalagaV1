# ADR-040: Pause Offers After Material Listing Edits

- Status: Accepted
- Date: 2026-10-06

## Context

A buyer's offer is based on the listing facts and evidence visible at the time of submission. If the seller later changes device identity, condition, defects, included items, or visual evidence, silently preserving the offer would imply consent to facts the buyer never reviewed.

Canceling every negotiation would preserve consent but discard useful history and force buyers to start over.

## Decision

A material listing edit automatically pauses all affected active offers and paused backup offers.

Each affected buyer must review the changed listing and explicitly choose to:

- Reactivate the existing offer.
- Revise the offer.
- Withdraw the offer.

Offers are never silently carried forward across a material listing change. Non-material edits do not require buyer reapproval.

A change is material when it could reasonably affect a buyer's valuation or decision, including changes to:

- Category, brand, model, or material specifications.
- Diagnostic answers or derived condition.
- Known problems, functional status, locks, safety facts, or missing components.
- Included accessories or bundle contents.
- Item photos or other identifying evidence.
- Pickup/meetup availability when it affects fulfillment.

Formatting, spelling, or clarification changes that do not alter item identity, condition, included value, safety, or fulfillment are non-material.

If a material edit occurs after reservation, the reservation is not canceled immediately. It moves to `buyer reconfirmation required`:

- The reserved buyer must review the new material listing version.
- The prior reservation terms and appointment are suspended and cannot proceed as though unchanged.
- The buyer may reconfirm, propose revised terms, or withdraw.
- The seller cannot complete the transaction or reserve the listing for a different buyer while reconfirmation remains pending.
- Backup offers remain paused until the reserved buyer reconfirms, withdraws, or the reconfirmation period expires.

The buyer has 24 hours from the material-edit notification to act. If the buyer does not reconfirm, revise, or withdraw within that window, the suspended reservation automatically cancels. Eligible backup negotiations may then reopen. An explicit withdrawal cancels the reservation immediately.

## Consequences

- Listings need immutable revision history or equivalent version snapshots with a materiality classification.
- Each offer negotiation must record the material listing version most recently acknowledged by its buyer.
- Buyer notifications must summarize changed fields without exposing other offers.
- Paused offers cannot be accepted, negotiated, or counted as active until the buyer takes an explicit action.
- A revised offer continues the existing private negotiation history rather than creating a second competing buyer.
- Support needs access to revision history when reviewing misrepresentation disputes.
- Scheduled processing and notifications must support the 24-hour reconfirmation deadline and automatic cancellation.

## Source

- ADR-005: Keep Offer Amounts Private
- ADR-007: Support Seller Counteroffers and Price Negotiation
- ADR-018: Derive Item Condition From Simple Diagnostic Questions
- ADR-023: Define Material Misrepresentation by Decision Impact
- Project interview decision made on 2026-10-06
