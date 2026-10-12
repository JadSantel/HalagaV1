# ADR-071: Start with Free Services and Require Approval for Paid Tiers

- Status: Accepted
- Date: 2026-10-12

## Context

The project owner is a student and cannot sustain a ₱5,000 monthly technical-services budget during development and early validation. Halaga should validate the marketplace with the smallest practical operating commitment before subscribing to paid infrastructure.

Free tiers can introduce quotas, service sleep, suspension, limited backups, restricted observability, changing terms, and no service-level guarantee. A free-first choice therefore needs explicit safety and launch boundaries rather than treating zero price as the only criterion.

## Decision

- Target ₱0 in recurring third-party technical-service fees during development and invite-first seeding.
- Prefer suitable free tiers, free allowances, and local or open-source development tools.
- Do not enable a paid subscription, usage-based billing path, automatic paid upgrade, or resource that can incur charges without the project owner's explicit approval.
- Where supported, prefer billing-disabled configurations or hard spending caps. Alerts alone are not a substitute when charges can continue automatically.
- Record provider quota usage and make approaching limits observable.
- Do not remove or weaken required privacy, authorization, audit, safety, evidence-protection, backup-validation, or retention controls merely to remain on a free plan.
- Before public registration opens, verify the selected providers' then-current free limits, suspension behavior, data-retention behavior, backup/restore capability, and relevant terms against the expected pilot workload.
- If the free architecture cannot meet a launch requirement, pause public launch and present either a compliant architecture change or a specifically costed paid exception for explicit approval.

This decision does not yet select vendors. Prices, quotas, and plan features must be checked from primary provider sources when each vendor ADR is evaluated.

## Consequences

- Early architecture should minimize the number of external services and avoid designs that require paid coordination infrastructure.
- The modular monolith and relational system-of-record choices remain favorable because they reduce operational components.
- Development may use local services where hosted free tiers are unsuitable, but local-only operation does not prove public-pilot readiness.
- Free-tier sleep or quota exhaustion may reduce availability; user-facing degradation and recovery behavior must be designed explicitly.
- A later paid upgrade is permitted only through a new or updated ADR with the reason, expected monthly cost, billing controls, and exit path.
- Vendor lock-in and export/restore capability remain evaluation criteria even for free products.

## Source

- `PROJECT.md` section 33
- Architecture interview decision made on 2026-10-12
