# ADR-002: Use Individual and Household Sellers as the MVP Design Center

- Status: Accepted
- Date: 2026-10-05

## Context

Potential supply-side users include individuals, households, students, small businesses, private offices, and larger institutions. These groups do not necessarily have the same listing frequency, inventory size, approval requirements, or transaction workflows.

The MVP needs a clear primary seller so that its listing and transaction experience can be designed coherently. At the same time, a standard single-item marketplace flow may also be usable by small businesses and offices without requiring dedicated product features.

## Decision

Individuals and households with occasional unwanted electronic devices are the primary seller segment and the design center for the MVP.

Small businesses and offices are a supported secondary segment when they can use the same standard account, single-item listing, offer-comparison, and transaction flow. They will not be excluded merely because they are organizations.

The MVP will not introduce organization-specific workflows solely for small businesses or offices.

## Consequences

- Listing creation must be understandable to non-technical, infrequent sellers.
- The default flow should optimize for listing one item at a time rather than managing inventory.
- Product language should primarily address an individual owner rather than an asset manager or procurement team.
- Small businesses and offices may create ordinary listings but should not expect batch imports, multi-user organization accounts, internal approvals, formal bidding, asset registers, or disposal documentation in the MVP.
- Demand-side acquisition must generate enough relevant offers for occasional sellers to experience useful price discovery.
- Dedicated business-seller capabilities require later validation and a separate scope decision.

## Source

- `product.md`, especially sections 7.1, 27, 30, 36, and 40
- Project interview decision made on 2026-10-05
