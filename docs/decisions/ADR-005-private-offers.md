# ADR-005: Keep Offer Amounts Private

- Status: Accepted
- Date: 2026-10-05

## Context

The marketplace can expose competing offers publicly, creating an auction-like experience, or keep each offer confidential between its buyer and the listing seller. Public amounts can encourage reactive bidding but may anchor buyers to prior offers, invite incremental bidding games, and disclose commercially sensitive valuations.

The MVP's purpose is to help a seller discover value from multiple interested buyers, not necessarily to operate a public auction.

## Decision

Offer amounts are private to the listing seller and the buyer who submitted the offer.

Other buyers must not be able to view an offer's amount, private message, or the number of valid offers received by the listing. Public pages and unrelated buyers receive no competing-demand count, offer-volume range, popularity badge, or similar aggregate signal.

Offer activity is visible only to the listing seller, the buyer within that buyer's own inquiry or negotiation, and authorized platform staff with an operational need.

## Consequences

- Seller views must support side-by-side comparison of all offers received on their listing.
- Buyer views must expose only that buyer's own offer details and status.
- API authorization and database access rules must prevent cross-buyer disclosure.
- Notifications, analytics, logs, and error messages must avoid leaking competing offer amounts.
- Buyers form independent valuations rather than bidding directly against a visible price.
- The experience must not be described as a public auction.
- Public caching, page metadata, client payloads, and timing-dependent messages must not leak offer counts or amounts.

## Source

- `product.md`, especially sections 15 and 16
- Project interview decision made on 2026-10-05
