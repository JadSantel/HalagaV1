# ADR-043: Support Explicit Single-Item and Bundle/Lot Listings

- Status: Accepted
- Date: 2026-10-06

## Context

Households and small offices may have one device, a group of similar accessories, or a mixed set they want valued together. Restricting every listing to one physical object would create excessive listing work for low-value accessories and prevent intentional lots. Treating all listings alike would make quantities and valuation ambiguous.

## Decision

The MVP supports two explicit listing types:

- `Single item`
- `Bundle/lot`

A seller must choose the type during listing creation. A bundle or lot must describe its contents and quantities sufficiently for buyers to understand what the proposal covers. The listing's photos must show the actual bundle contents as well as material individual differences or defects.

Every offer, counteroffer, reservation, inspection outcome, and completion for a bundle/lot applies to the entire listed bundle. Buyers cannot bid on selected items within the listing, and the seller cannot complete only part of the bundle under that transaction. A seller who wants separate outcomes must create separate listings before accepting an offer.

A bundle may contain items with different derived condition states. Each materially distinct item or grouped quantity must have its own condition inputs and disclosed issues; the platform must not assign one blanket condition label that obscures variation.

If every included item has the same universal condition, the bundle displays that condition at the listing level. If included items have more than one universal condition, the bundle displays `Mixed conditions` and shows the quantity breakdown for each included condition.

`Mixed conditions` is a bundle summary, not a fifth universal item-condition value. When a buyer applies a condition filter, a bundle matches if at least one included item has the selected condition.

All bundle contents must belong to one supported category or a predefined closely related category family. Sellers cannot create arbitrary mixed-electronics lots, and free text cannot override the allowed category-family mapping.

The allowed bundle families are:

1. **Mobile** — smartphones and tablets, plus supported accessories intended for them.
2. **Computing** — laptops, desktop computers, computer components and peripherals, monitors, plus compatible supported accessories.
3. **Printing** — printers and scanners, plus compatible supported accessories.
4. **Networking** — networking devices, plus compatible supported accessories.
5. **Power protection** — UPS and small backup-power devices, plus their non-battery supported accessories.

Items from different families cannot share one bundle listing. The battery exclusions in ADR-017 apply regardless of family.

## Consequences

- Listing type is a normalized field and cannot be inferred only from the title or description.
- Bundle listings need structured or clearly itemized contents and quantities, not merely a single-device form with quantity hidden in text.
- Condition and diagnostic evidence needs per-item or grouped-quantity handling when bundle contents differ.
- Search indexing must derive bundle condition facets from its itemized contents and preserve the quantity breakdown.
- Search and analytics must distinguish single-item transactions from bundle transactions; a completed bundle is one transaction but may contain multiple physical items.
- Historical valuation must not compare a bundle's total final price directly with a single item's price without normalization.
- Material removal, addition, or substitution of bundle contents triggers the material-edit rules in ADR-040.
- Adding or changing a family is a taxonomy decision and may not be done through seller-entered free text.

## Source

- `product.md`, especially sections 10, 12, 27, 28, and 32
- ADR-002: Use Individual and Household Sellers as the MVP Design Center
- ADR-016: Define the MVP Device Categories
- Project interview decision made on 2026-10-06
