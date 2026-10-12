# ADR-051: Do Not Generate Platform Price Estimates in the MVP

- Status: Accepted
- Date: 2026-10-11

## Context

Accurate electronics valuation depends on identity, age, condition, repair cost, component state, local demand, and transaction history. The MVP will not begin with enough reliable, mutually confirmed Cagayan de Oro transaction data to support defensible estimated values. A displayed estimate could anchor offers and undermine the experiment in independent competitive price discovery.

## Decision

The MVP will not display a platform-generated estimated price, price range, appraisal, or automated valuation.

Value discovery comes from private offers submitted independently by buyers. The seller compares those offers against a private optional seller price expectation that buyers cannot see.

## Consequences

- AI, machine-learning, image-based, rules-based, scraped-market, and historical-comparable price estimates are outside MVP scope.
- The platform must not present derived condition, buyer intent, offer count, or business verification as a proxy for monetary valuation.
- Buyer offer amounts remain private under ADR-005.
- Mutually confirmed final prices may be collected for analytics, but they are not automatically exposed as estimates or comparables.
- Any future valuation feature requires sufficient evidence, methodology, confidence communication, privacy review, and a separate product decision.

## Source

- `product.md`, especially sections 9.2, 23, 24, and 42
- ADR-001: Make Competitive Price Discovery the Core MVP Promise
- ADR-005: Keep Offer Amounts Private
- ADR-006: Allow an Optional Seller Price Expectation
- Project interview decision made on 2026-10-11
