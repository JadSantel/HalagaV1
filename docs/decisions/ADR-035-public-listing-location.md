# ADR-035: Show Barangay and an Approximate Map Area Publicly

- Status: Accepted
- Date: 2026-10-06

## Context

Buyers in a local pickup marketplace need enough location context to estimate travel effort. Showing only Cagayan de Oro City provides little differentiation, while showing an exact household address creates unnecessary privacy and safety risk.

## Decision

An active public listing will show:

- The barangay within Cagayan de Oro City.
- An approximate map area.

The exact address, exact pickup point, and private transaction-appointment location must never appear on the public listing.

The approximate map uses a barangay-level representative area or boundary from controlled geographic data. It is not derived from, randomized around, or otherwise computed from the seller's exact home location. The listing flow does not require an exact address or precise coordinate.

## Consequences

- Listing creation needs a controlled barangay selection and maintained barangay boundary or representative-area data.
- Public listing APIs, page metadata, image metadata, maps, analytics, and caches must not leak exact coordinates or addresses.
- Exact pickup or meetup locations are shared only within the private reserved transaction workflow.
- Sellers need a clear preview of what location information will be public before publication.
- The map must not create false precision or imply that the marker is the item's exact location.
- The listing does not store a private home point merely to render its public map.
- Map provider and barangay geography maintenance remain implementation decisions.

## Source

- `product.md`, especially sections 12, 14, 15, 19, and 40
- ADR-013: Launch the MVP in Cagayan de Oro City
- ADR-015: Coordinate Pickup and Meetup Inside the Platform
- ADR-033: Allow Public Browsing of Active Listings
- Project interview decision made on 2026-10-06
