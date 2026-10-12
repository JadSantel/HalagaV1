# ADR-028: Make the MVP Free for Sellers and Buyers

- Status: Accepted
- Date: 2026-10-06

## Context

The MVP is intended to validate whether owners list unwanted electronics, relevant buyers submit competing offers, and local exchanges complete. Charging participants at launch would add a second hypothesis about willingness to pay and could suppress the liquidity needed to test the core marketplace.

Off-platform payments also make transaction commissions difficult to verify and enforce reliably.

## Decision

The MVP is free for sellers and buyers.

At launch there will be no:

- Listing fee.
- Offer or negotiation fee.
- Buyer or seller subscription.
- Transaction commission.
- Fee for professional or business verification.
- Paid listing promotion or priority access.

## Consequences

- Revenue is not an MVP success criterion.
- The product must not depend on integrated payment collection or billing infrastructure.
- Access to core marketplace functions and trust verification cannot be conditioned on payment at launch.
- Operating costs for moderation, messaging, media, notifications, and verification require a non-marketplace-fee funding assumption during the pilot.
- Monetization may be tested later only after core marketplace behavior is demonstrated and requires a separate decision.

## Source

- `product.md`, especially sections 28, 33, 34, and 35
- ADR-021: Keep MVP Payments Outside the Platform
- Project interview decision made on 2026-10-06
