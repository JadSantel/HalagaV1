# ADR-004: Use Unified Accounts for Buying and Selling

- Status: Accepted
- Date: 2026-10-05

## Context

An individual may own unwanted electronics in one transaction and want to acquire an item in another. Requiring a permanent buyer or seller account type would force users to predict their future behavior, maintain multiple accounts, or undergo a role-conversion process.

Professional and business information is relevant to trust and presentation, but it does not need to determine whether an account can list or offer.

## Decision

One user account may both:

- Create and manage listings as a seller.
- Submit and manage offers as a buyer.

Buyer and seller are contextual roles within a listing or transaction, not mutually exclusive account types. A user may additionally maintain a professional or business profile and verification status without losing ordinary seller capabilities.

## Consequences

- The core user model must not contain a mutually exclusive buyer-versus-seller role.
- Authorization should be based on the requested action and the user's relationship to the listing or transaction.
- Profiles and navigation should expose both selling and buying activity where relevant.
- A listing owner must not be allowed to submit an offer on their own listing.
- Reputation may eventually need separate buyer and seller dimensions even though both belong to one identity.
- Professional or business verification remains an optional trust attribute rather than a separate account class.

## Source

- `product.md`, especially sections 7, 11, 20, and 21
- Project interview decision made on 2026-10-05
