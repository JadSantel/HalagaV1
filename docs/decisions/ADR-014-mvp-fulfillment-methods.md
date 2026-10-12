# ADR-014: Limit MVP Fulfillment to Buyer Pickup and Agreed Meetup

- Status: Accepted
- Date: 2026-10-05

## Context

The MVP launches within Cagayan de Oro City and treats offer acceptance as a reservation subject to physical inspection. Shipping or platform-managed delivery would introduce packaging, carrier integration, remote inspection, payment timing, loss and damage claims, and broader geographic operations.

## Decision

The MVP supports two fulfillment methods:

- Buyer pickup.
- A meetup location mutually agreed by the buyer and seller.

The MVP will not support shipping, seller-arranged delivery as a first-class method, or a platform-operated logistics service.

## Consequences

- Listings or offers must communicate whether buyer pickup, meetup, or both are available.
- Reservation must be followed by private coordination of a time and location.
- Physical inspection occurs at pickup or meetup before final completion confirmation.
- Public listing views must not expose a seller's exact home address.
- The parties, not the platform, are responsible for physically transporting the item under the supported methods.
- Shipping labels, carrier tracking, delivery insurance, remote receipt confirmation, and shipping-damage disputes are outside MVP scope.
- Safety guidance for home pickup and public meetup is required; exact location-sharing and contact-detail rules remain unresolved.

## Source

- `product.md`, especially sections 15, 17, 19, 26, and 28
- ADR-009: Treat Offer Acceptance as a Reservation Pending Inspection
- ADR-013: Launch the MVP in Cagayan de Oro City
- Project interview decision made on 2026-10-05
