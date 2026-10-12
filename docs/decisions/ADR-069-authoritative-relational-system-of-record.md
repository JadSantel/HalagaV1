# ADR-069: Use One Authoritative Relational System of Record

- Status: Accepted
- Date: 2026-10-11

## Context

Halaga requires transaction-safe acceptance, one active reservation per listing, bilateral completion, durable deadlines, private participant data, immutable or auditable history, human case review, and reproducible pilot metrics. Splitting ownership of these rules across independently consistent services during the MVP would add failure modes and operational burden without validated scale pressure.

Search, analytics, email delivery, and media processing have different access and performance needs, but none should become authoritative for marketplace or transaction state.

## Decision

- One relational system of record owns authoritative account-domain state, listings, revisions, diagnostics, negotiations, proposals, reservations, appointments, completion confirmations, transaction outcomes, cases, findings, notifications, and audit metadata.
- Business modules remain explicit code and data-ownership boundaries within the application.
- Cross-module state changes that must be atomic share the relational transaction.
- Search documents, pilot analytics facts, email delivery work, and other read-optimized models are derived projections that may be rebuilt from authoritative records and versioned events.
- A transactional outbox or equivalent atomic event-recording mechanism connects committed state to asynchronous workers.
- Private object storage owns image, document, and evidence bytes. Relational metadata owns object identity, authorization, integrity, processing, publication, quarantine, retention, and deletion state.
- Object existence, search-index state, analytics state, or email-delivery state never determines whether a listing is published, an offer is accepted, a reservation is active, or a transaction is completed.
- The architecture remains vendor-neutral until later ADRs select products.

## Consequences

- Single-reservation and bilateral-completion invariants can be enforced close to authoritative data.
- The application must define explicit public, participant-private, restricted-evidence, and staff projections rather than exposing general-purpose entities.
- Background jobs use idempotent guarded commands and cannot bypass current state.
- Projection lag may delay search, analytics, or email but cannot corrupt transactional truth.
- Search and analytics can be rebuilt after defects or rule changes.
- Database availability becomes central to interactive marketplace availability and requires appropriate backup and recovery decisions.
- Relational growth, indexes, retention jobs, and audit volume must be monitored; distribution is a later evidence-driven decision.
- The initial architecture should be a logically modular application, not independently deployed domain microservices.

## Source

- `PROJECT.md` sections 29, 30, 32, and 33
- `architecture.md` critical-flow and concurrency requirements
- Architecture interview decision made on 2026-10-11
