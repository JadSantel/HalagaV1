# ADR-076: Keep MVP Marketplace Search in PostgreSQL

- Status: Accepted
- Date: 2026-10-12

## Context

MVP discovery needs keyword search over approved public listing fields, combined with category, derived-condition, barangay, and listing-type filters, plus newest sorting (ADR-050). A separate search service would add a vendor, synchronization path, and operational cost before the pilot demonstrates a need. Halaga already uses PostgreSQL as its authoritative relational system of record (ADR-069), and the project is free-first (ADR-071).

## Decision

- Implement MVP listing keyword search, filters, and newest sorting using PostgreSQL capabilities; do not introduce a separate search service for the MVP.
- Search only publicly browseable listings and approved public fields. Never index private price expectations, inquiries, proposals, contact details, IMEI values, exact appointment locations, or restricted evidence.
- Keep search data derived from authoritative listing state and rebuildable. Search results must re-check current listing visibility so stale index state cannot expose a held, paused, removed, or otherwise non-public listing.
- Use normalized fields and appropriate database indexes for the filters and ordering described in ADR-050.
- Revisit a separate search service only through a later ADR backed by measured query latency, database load, relevance needs, or pilot scale that PostgreSQL cannot meet within accepted operational targets.

## Consequences

- The MVP avoids an additional service and keeps public discovery data within the existing database boundary.
- Search query design, text configuration, ranking, index maintenance, and measurable performance targets still require implementation and operational validation.
- Search must not become a source of truth for listing eligibility or visibility.

## Source

- ADR-050: Limit MVP Discovery to Essential Search, Filters, and Newest Sort
- ADR-069: Use a Relational System of Record
- ADR-071: Start With Free-First Services
- Architecture interview decision made on 2026-10-12
