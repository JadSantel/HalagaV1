# ADR-079: Require Documented, Reviewable Retention Exceptions

- Status: Accepted
- Date: 2026-10-12

## Context

Halaga defines standard deletion/anonymization periods for transactions, uncompleted negotiations, and verification evidence. Active cases, urgent safety investigations, or a documented legal obligation may require specific records to remain available past those periods. An indefinite or undocumented exception would defeat data minimization and make access difficult to audit.

## Decision

- Retain records beyond their normal period only when necessary for an active case/safety investigation or a documented legal obligation or hold.
- An authorized operator records the affected data/subjects, purpose and reason, authorizing identity, start date, and review/expiry date. The exception is scoped to the minimum necessary records and access remains purpose-limited and audited.
- Review each active exception at least every 30 calendar days. Release it promptly when its purpose or legal basis ends, and then delete or irreversibly anonymize under the ordinary retention rule without undue delay.
- A retention exception does not make otherwise private data public or authorize unrelated reuse.
- This policy governs primary records. Provider-specific backup purge timing and deletion propagation remain an implementation decision to verify after storage providers are selected.

## Consequences

- Retention metadata needs exception scope, reason, authorizer, start, review/expiry, and release history.
- Operators need a queue for upcoming reviews and expired exceptions.
- Backup deletion guarantees must be evaluated against provider behavior before public launch.

## Source

- `PROJECT.md` section 28
- Architecture interview decision made on 2026-10-12
