# ADR-052: Retain Closed Transaction Records for 24 Months

- Status: Accepted
- Date: 2026-10-11

## Context

Transaction records support short-term disputes, abuse-pattern review, support decisions, auditability, and pilot analysis. They also contain private messages, proposal history, appointment details, location information, cancellations, and other personal data that should not be retained indefinitely without purpose.

## Decision

Closed transaction records are retained for 24 months from the transaction's terminal closure timestamp.

The retained record may include the relevant listing snapshot and revisions, offer and counteroffer history, private transaction messages, appointment history, confirmations, cancellation or expiry records, support findings, and audit events.

After 24 months, personal data in those records must be deleted or irreversibly anonymized unless a valid, documented reason requires a specific case or subset of data to be retained longer. Extended retention must be scoped to the necessary record, carry a reason and review status, and not silently reset the general retention period.

## Consequences

- Every terminal transaction state needs a closure timestamp that starts the retention clock.
- Automated retention processing must distinguish deletion from irreversible anonymization and verify that public, operational, search, cache, backup, and analytics copies follow the approved policy.
- Aggregated metrics may remain only when they cannot reasonably be linked back to a person or private transaction.
- Open cases and records under an approved exception must be protected from scheduled deletion until the exception ends.
- Users and staff need accurate privacy language; the product must not promise immediate erasure of records subject to the documented retention policy.
- The valid exception categories, backup-deletion behavior, account deletion interaction, and retention for verification documents and rejected listings remain unresolved.

## Source

- ADR-008: Keep Pre-Acceptance Negotiation In the Platform
- ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies
- ADR-024: Use a 48-Hour Material-Misrepresentation Dispute Window
- Project interview decision made on 2026-10-11
