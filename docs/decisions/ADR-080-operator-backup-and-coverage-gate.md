# ADR-080: Require Trained Operator Backup and Coverage Gate

- Status: Accepted
- Date: 2026-10-12

## Context

ADR-046 sets daily operator coverage from 8:00 AM to 10:00 PM PHT and a four-hour initial-review target for urgent safety reports during coverage hours. A single designated operator creates a predictable gap during illness, conflict of interest, or unavailability. Launching user-facing workflows without an available reviewer would misrepresent the safety service.

## Decision

- The pilot requires a named primary and at least one trained alternate operator, both authorized for the queues they cover.
- The primary/alternate schedule must provide the ADR-046 coverage window and urgent-review target throughout the pilot.
- If neither trained operator is available for coverage, pause new onboarding and listing publication until coverage resumes.
- Keep reporting available. Show the reporter the actual response window and do not claim the normal urgent-review target when it cannot be met.
- Operator handoff, queue ownership, conflicts of interest, and all decisions remain attributable and auditable.

## Consequences

- Pilot readiness includes training, access provisioning, backup schedule, and a tested handoff process.
- Availability messaging and a publication gate are required operational controls.
- External emergency/law-enforcement escalation remains a separate procedure and must be defined before pilot launch where the product directs users to it.

## Source

- ADR-046: Staff the Pilot With a Designated Human Operator
- `PROJECT.md` sections 6.4, 14, and 27
- Architecture interview decision made on 2026-10-12
