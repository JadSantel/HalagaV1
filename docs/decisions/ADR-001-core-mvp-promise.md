# ADR-001: Make Competitive Price Discovery the Core MVP Promise

- Status: Accepted
- Date: 2026-10-05

## Context

Owners of unwanted electronics may face two related but distinct problems:

1. They do not know what an item is worth or which kind of buyer values it most.
2. They need the item removed or responsibly disposed of, including when it has little or no market value.

Solving the second problem reliably could require guaranteed collection, recycling coverage, logistics operations, and service-area commitments. Those capabilities would materially expand the MVP beyond validating the proposed marketplace.

The existing product discovery indicates that owners already have access to disposal channels such as junk shops, while uncertainty about remaining value is the more important unmet need.

## Decision

The MVP's non-negotiable core promise is:

> Help an owner discover an unwanted electronic item's market value through competing offers from interested buyers.

The MVP will be designed and evaluated primarily as a marketplace for offer-based price discovery. It does not promise that every listed item will receive an offer, be collected, or be routed to a recycler.

## Consequences

- Marketplace liquidity and the quality and legitimacy of offers are central product concerns.
- Receiving multiple comparable offers is a more meaningful success signal than registrations or listing volume alone.
- Buyer acquisition and buyer relevance are necessary to deliver seller value.
- Logistics, recycling coverage, and guaranteed removal may support transactions but are not the product's core MVP promise.
- Items with no offers must be handled honestly in the user experience; the platform must not imply that a listing guarantees value or removal.
- A future disposal or guaranteed-routing service would require a separate product decision and operational model.

## Source

- `product.md`, especially sections 2, 3, 8, 9.2, 17, 28, 35, and 42
- Project interview decision made on 2026-10-05
