# ADR-008: Keep Pre-Acceptance Negotiation In the Platform

- Status: Accepted
- Date: 2026-10-05

## Context

Price negotiation requires communication between a seller and each prospective buyer. Revealing personal contact details before agreement would be simpler to implement, but it would expose users unnecessarily, move negotiation evidence outside the platform, and make it difficult to understand the terms that led to a transaction.

## Decision

All negotiation before offer acceptance will happen inside the platform.

The platform will support:

- Private messages between the listing seller and the buyer within a specific offer negotiation.
- Structured monetary offers and counteroffers whose amount, proposer, timestamp, and status are recorded.

Personal contact details will not be revealed merely because a buyer submits an offer or begins negotiating.

## Consequences

- In-app messaging is an MVP requirement rather than a future alternative.
- Messages and structured proposals must belong to a specific private negotiation associated with a listing.
- Offer amounts should be represented as structured proposals, not inferred from message text.
- Access controls must prevent other buyers and unrelated users from seeing the conversation or proposal history.
- Message retention, moderation access, reporting, prohibited content, attachments, and deletion behavior require explicit policies.
- Notifications should alert participants to new messages and proposals without leaking sensitive content.
- The product still needs a decision about which contact details, if any, are exchanged after acceptance.
- Keeping records enables later support and dispute review, but the retention period and platform responsibility remain unresolved.

## Source

- `product.md`, especially sections 15, 17, 18, 19, and 21
- Project interview decision made on 2026-10-05
