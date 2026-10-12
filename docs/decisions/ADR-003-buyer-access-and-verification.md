# ADR-003: Allow Individuals and Verified Professionals to Submit Offers

- Status: Accepted
- Date: 2026-10-05

## Context

Restricting offers to verified electronics businesses and professional technicians could improve buyer credibility, but it would reduce marketplace liquidity and require a verification operation before the marketplace can function. Allowing any registered user to offer can increase demand but also introduces greater variation in buyer expertise and trustworthiness.

The marketplace needs to distinguish permission to participate from evidence of professional identity.

## Decision

Any registered individual may submit offers in the MVP.

Electronics businesses and professional technicians may also submit offers and can receive a verified professional or business status after completing the platform's verification process. Verification is a visible trust signal, not a prerequisite for submitting an offer.

Anonymous visitors may browse subject to later privacy decisions, but they may not submit offers without registering.

## Consequences

- The authorization model must permit all registered users with buyer capability to create offers.
- The data model must distinguish ordinary registered users from claimed professional or business profiles and their verification status.
- The interface must not imply that an unverified buyer is a professional or that platform verification guarantees transaction quality.
- Sellers must be able to see meaningful buyer identity and verification signals while comparing offers.
- Trust, reporting, abuse prevention, and offer-quality controls are necessary because registration alone does not establish expertise or legitimacy.
- Buyer acquisition can include hobbyists, end users, resellers, repair technicians, refurbishers, recyclers, junk shops, and electronics businesses.
- The exact verification evidence and review process remain unresolved and require a later decision.

## Source

- `product.md`, especially sections 7.2, 11, 16, 20, 21, and 37
- Project interview decision made on 2026-10-05
