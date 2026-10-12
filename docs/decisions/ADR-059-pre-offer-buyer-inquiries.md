# ADR-059: Allow Private Buyer Questions Before an Offer

- Status: Accepted
- Date: 2026-10-11

## Context

Buyers may need clarification about specifications, defects, accessories, testing, or photos before they can form a meaningful valuation. Requiring a monetary offer before asking a question would encourage placeholder offers and reduce offer quality.

## Decision

An eligible, registered, email-verified adult buyer may start a private listing inquiry with the seller before submitting an offer.

The inquiry is tied to the listing and the buyer-seller pair. It is not an offer, does not count toward offer metrics, does not reserve the item, and does not reveal competing buyers or private offer information.

Pre-offer inquiry remains inside the platform. Users may not exchange phone numbers or external contact handles before reservation under ADR-015.

## Consequences

- Messaging needs a listing-scoped pre-offer conversation state in addition to structured proposal states.
- When that buyer submits an offer, the inquiry history should remain attached to the same buyer-seller listing conversation for context and moderation.
- Inquiry access requires server-side checks for account eligibility, email verification, listing visibility, blocks, and restrictions.
- Rate limits, blocking, reporting, and spam controls are required because no monetary action is needed to initiate contact.
- Sellers may answer, report, block, or ignore an inquiry without affecting listing or offer status.
- Inquiry messages must not count as valid offers, active buyers, or competing-offer activity.
- Retention for inquiries that never produce a transaction remains unresolved.

## Source

- ADR-008: Keep Pre-Acceptance Negotiation In the Platform
- ADR-015: Coordinate Pickup and Meetup Inside the Platform
- ADR-032: Require Email Verification for Listings and Offers
- Project interview decision made on 2026-10-11
