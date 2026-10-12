# ADR-015: Coordinate Pickup and Meetup Inside the Platform

- Status: Accepted
- Date: 2026-10-05

## Context

After a seller accepts an offer, the parties need to agree on a time and place for inspection and transfer. Automatically revealing phone numbers would make direct coordination convenient, but it would expose personal information and move safety-relevant communication outside the platform.

## Decision

Pickup and meetup scheduling, location coordination, and related communication will remain available inside the platform after reservation.

The platform will not automatically reveal either party's phone number or other private contact information when an offer is submitted or accepted.

Exact pickup or meetup details are private to the transaction participants and must not appear on the public listing.

After a reservation exists, either participant may voluntarily send a phone number or external contact handle in the private in-app conversation. The platform does not disclose this information on the user's behalf. Contact-detail exchange before reservation is not permitted.

## Consequences

- In-app messaging continues through reservation, inspection, and transaction outcome rather than ending at offer acceptance.
- The conversation must remain accessible while the transaction is active and during any applicable support or dispute window.
- Notifications must be sufficient for time-sensitive coordination without exposing private message contents unnecessarily.
- Location details require access controls separate from the listing's public city or general-area location.
- The platform should provide meetup and pickup safety guidance.
- Message controls or moderation rules must distinguish voluntary post-reservation contact exchange from prohibited pre-reservation attempts to move negotiations off-platform.
- Users should be warned that off-platform communications may be unavailable to platform support during a dispute.
- Structured scheduling and map/location tools may improve coordination, but their MVP necessity remains unresolved.

## Source

- `product.md`, especially sections 17, 18, 19, and 21
- ADR-008: Keep Pre-Acceptance Negotiation In the Platform
- ADR-014: Limit MVP Fulfillment to Buyer Pickup and Agreed Meetup
- Project interview decision made on 2026-10-05
