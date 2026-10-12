# ADR-072: Select TypeScript, Next.js, and PostgreSQL as the Stack Foundation

- Status: Accepted
- Date: 2026-10-12
- Supersedes: ADR-070 only where it treated a separate worker process as fully accepted; worker persistence contract subsequently defined by ADR-073

## Context

Halaga needs a responsive web application, server-enforced commands and private projections, shared domain rules, and a relational system of record. The project is student-run and follows ADR-071's free-first constraint, so reducing language and tooling breadth is valuable.

ADR-070 selected a modular monolith and described web and worker runtime roles. The background responsibilities remain necessary, but the final runtime topology should not be accepted until durable job persistence, retries, idempotency, crash recovery, and failure handling are defined.

## Decision

Accept the following stack foundation:

- TypeScript for web, server endpoint, domain, and shared validation code.
- Next.js for the responsive web application and server endpoints.
- Shared TypeScript domain and validation modules used by both interactive and background code.
- PostgreSQL as the authoritative relational database standard.

The server remains authoritative. Sharing validation code with the browser improves feedback but does not replace server authorization, validation, transaction constraints, or privacy-safe projections.

### Proposed worker approach

A separate Node.js worker built from the same repository is the proposed implementation for durable background responsibilities. ADR-073 accepts the PostgreSQL-backed persistence, retry, lease, idempotency, recovery, and failed-job contract. The separate runtime and its deployment/operational parameters are not yet final. Before deployment, define at least:

- worker hosting, process supervision, polling cadence, lease duration, and heartbeat;
- alert thresholds, on-call ownership, and recovery runbook;
- schema/event compatibility during deployments;
- behavior during provider suspension or free-tier quota exhaustion.

### Explicitly not selected

This decision does not select:

- A Next.js or Node.js version
- A validation library
- An ORM, query builder, or migration tool
- A PostgreSQL version or hosting provider
- A web, worker, or deployment vendor
- An authentication provider
- Object storage, email, search, observability, or analytics vendors

Choosing Next.js does not imply Vercel hosting. Choosing PostgreSQL does not imply a particular managed PostgreSQL service.

## Consequences

- Most application and domain work uses one language and type system.
- Browser and server code may share data shapes and pure validation logic, while privileged domain commands remain server-only.
- PostgreSQL-specific transactional constraints and query behavior may be used when recorded and tested.
- The codebase must prevent server-only secrets and privileged modules from entering client bundles.
- Background handlers should be written as idempotent application commands even before the final worker topology is selected.
- Vendor and version evaluations must satisfy ADR-071 and be verified against current primary documentation before acceptance.
- ADR-070 remains accepted for the modular-monolith and internal-module decisions, subject to this ADR's worker clarification.

## Source

- ADR-045, ADR-069, ADR-070, and ADR-071
- Architecture interview decision made on 2026-10-12
