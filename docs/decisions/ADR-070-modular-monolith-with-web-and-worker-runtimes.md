# ADR-070: Use a Modular Monolith with Web and Worker Runtimes

- Status: Accepted; worker-runtime implementation amended by ADR-072
- Date: 2026-10-11

## Context

Halaga needs atomic marketplace transactions and explicit domain boundaries, but its invite-first pilot does not justify independently deployed account, listing, negotiation, transaction, case, notification, or audit services. Microservices would introduce distributed transactions, versioned network contracts, deployment coordination, tracing overhead, and additional failure modes before scale evidence exists.

The application still has work that should not run inside an interactive request, including deadline evaluation, email delivery, image and evidence processing, search/analytics projection, and retention.

## Decision

- Build the MVP as one modular monolith in one repository and shared codebase.
- Keep interactive web work and durable background-job responsibilities as distinct runtime boundaries in the shared codebase.
- ADR-072 accepts the Next.js/TypeScript web runtime. ADR-073 later accepts the PostgreSQL-backed persistence, retry, idempotency, recovery, and failure-handling contract; a separately deployed Node.js worker remains proposed pending deployment/operations decisions.
- Use the same versioned domain and application modules in both runtimes.
- Keep accounts, profiles/verification, listings, negotiation, reservations/transactions, cases/enforcement, notifications, audit, and pilot analytics as explicit internal modules.
- A module owns its tables and state transitions. Other modules use defined application services, guarded commands, or committed domain events rather than ad hoc cross-module mutation.
- Cross-module operations that require atomicity use the shared relational transaction.
- Do not introduce independently deployed domain microservices or an external event broker for the MVP.
- Use the transactional outbox from ADR-069 to hand committed work to the worker runtime.

## Consequences

- Transaction and privacy invariants remain enforceable without distributed coordination.
- Web and background-job capacity may be scaled separately if the proposed Node.js worker is accepted, while deployment artifacts and domain rules remain aligned.
- Background failure does not change authoritative transactional truth, although notification, media, or projection freshness may degrade and must be observable.
- Deployments need a compatibility strategy so web and worker processes do not interpret schema or events inconsistently during rollout.
- Internal module boundaries require code-level dependency rules and tests; sharing a database is not permission for unrestricted joins or mutations.
- Long-running or retryable work must enter the worker through durable records, not in-memory fire-and-forget tasks.
- An external broker or service extraction requires a later ADR supported by measured load, reliability, organizational, or security needs.

## Source

- ADR-069
- `docs/architecture/DOMAIN_MODEL.md`
- Architecture interview decision made on 2026-10-11
