# ADR-007: Support Seller Counteroffers and Price Negotiation

- Status: Accepted
- Date: 2026-10-05

## Context

An accept-or-reject offer flow would be simple, but a seller may consider a buyer suitable while disagreeing with the initial amount or transaction terms. Requiring the seller to reject that offer could prevent otherwise viable transactions.

Supporting counteroffers changes an offer from a single bid into a negotiation whose terms may evolve.

## Decision

The MVP will allow a seller to counter a buyer's offer and negotiate the price before either party reaches agreement.

Negotiations remain private to the listing seller and the buyer involved. Other buyers must not see proposal amounts, messages, or negotiation history.

## Consequences

- The domain model must preserve proposal history rather than overwriting the original offer amount.
- Each negotiation must identify the currently proposed terms, which party proposed them, and its current status.
- The seller's offer-comparison view must clearly show the latest active proposal for each buyer without losing the original bid history.
- Notifications are needed when a new offer, counteroffer, acceptance, rejection, withdrawal, or expiration occurs.
- Authorization must limit each negotiation to the listing seller and its originating buyer.
- The product must define when a proposal becomes agreed, whether an agreement is binding, and what happens to competing negotiations.
- The exact communication channel, allowed negotiable terms, revision and withdrawal rules, and expiration behavior remain unresolved.

## Source

- `product.md`, especially sections 15, 16, 17, and 18
- Project interview decision made on 2026-10-05
