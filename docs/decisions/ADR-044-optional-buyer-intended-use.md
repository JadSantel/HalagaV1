# ADR-044: Make Buyer Intended Use Optional

- Status: Accepted
- Date: 2026-10-06

## Context

The product aims to help items reach higher-value next uses, and sellers may care whether a buyer plans to reuse, repair, refurbish, resell, salvage, or recycle an item. Requiring an intended-use classification on every offer would add friction and ask buyers to commit before physical inspection.

Buyer intent may also change after inspection and cannot be guaranteed by the platform.

## Decision

A buyer may optionally state an intended use when submitting or revising an offer.

The available values are:

- Reuse.
- Repair.
- Refurbish.
- Resell.
- Parts or salvage.
- Recycle.
- Other, with a short explanation.

The intended use is shown to the seller during private offer comparison. It is contextual, non-binding information and not a guarantee of the item's eventual destination.

## Consequences

- Sellers can consider buyer intent alongside price, verification, pickup method, and trust signals.
- Omitting intended use does not invalidate an offer or reduce marketplace access.
- The platform must not claim verified diversion, recycling, or environmental impact based solely on stated intent.
- Intended use can support exploratory analytics only when clearly labeled as self-reported and incomplete.
- A future outcome-verification or certified recycling program requires a separate decision.

## Source

- `product.md`, especially sections 4, 6, 9, 16, 22, 34, 37, and 41
- ADR-001: Make Competitive Price Discovery the Core MVP Promise
- Project interview decision made on 2026-10-06
