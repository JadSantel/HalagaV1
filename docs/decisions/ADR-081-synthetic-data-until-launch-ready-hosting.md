# ADR-081: Use Synthetic Data Until Hosting Passes Launch Readiness

- Status: Accepted
- Date: 2026-10-12

## Context

The project owner requires a zero-recurring-cost development and early-validation path (ADR-071). Free hosting options may sleep, pause, lack backups, have short data lifetimes, or restrict use. That does not make them suitable for real participant data, especially private negotiation content, identity/verification documents, precise meetup details, and case evidence.

## Decision

- Early development and usability validation use local/private environments and synthetic data.
- Do not accept real participant personal, transaction, verification, or case/evidence data until the selected deployment has passed documented privacy/access-control, backup/restore, retention/deletion, worker-recovery, availability, and quota checks.
- Public-pilot deployment is gated on either a free architecture that passes those checks or a specifically costed paid exception explicitly approved by the project owner.
- No provider, account plan, billing path, or automatic paid upgrade is selected by this decision.

## Consequences

- Development and testing must support deterministic synthetic fixtures that cover sensitive-data and workflow cases.
- Provider selection requires current terms and limits, a recovery test, and confirmation that private objects and database backups can be deleted according to policy.
- A public pilot cannot proceed solely because a provider advertises a free tier.

## Source

- ADR-071: Start with Free Services and Require Approval for Paid Tiers
- `PROJECT.md` section 33
- Architecture interview decision made on 2026-10-12
