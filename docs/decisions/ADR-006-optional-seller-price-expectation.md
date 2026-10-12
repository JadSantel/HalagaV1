# ADR-006: Allow an Optional Seller Price Expectation

- Status: Accepted
- Date: 2026-10-05

## Context

Many MVP sellers will list an item precisely because they do not know its market value. Requiring an asking price would create friction and could falsely imply that the seller already knows the answer. Providing no way to state an expectation, however, may make it harder for a seller to communicate a known minimum or rough idea of value.

## Decision

A seller may provide a price expectation when creating or managing a listing, but the field is optional. A listing can be published without any seller-supplied price.

The price expectation is guidance rather than an authoritative platform valuation. It does not guarantee acceptance, establish the item's market value, or prevent buyers from submitting different amounts unless a later decision explicitly introduces such a rule.

The expectation is private to the seller. Buyers must not see it. It is shown to the seller as a personal benchmark when reviewing and comparing received offers.

## Consequences

- The listing data model needs a nullable seller price-expectation amount and currency.
- Listing validation and publication must not require a price.
- Product language must distinguish a seller's expectation from verified value, an appraisal, or a platform-generated estimate.
- Marketplace analytics should distinguish the seller's expectation from submitted, accepted, and completed transaction amounts.
- API authorization, notifications, analytics surfaces, and logs exposed to buyers must not reveal the expectation.
- Because buyers cannot see the expectation, submitted offers remain independent of the seller's stated benchmark.

## Source

- `product.md`, especially sections 9.2, 12, 15, 23, and 24
- Project interview decision made on 2026-10-05
