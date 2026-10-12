# ADR-082: Set Pilot Recovery Objectives

- Status: Accepted
- Date: 2026-10-12

## Context

Halaga needs explicit recovery expectations before real participant data is accepted. The project is free-first, so stronger guarantees may make an all-free deployment impossible; the public-pilot gate in ADR-081 prevents that constraint from silently weakening privacy or integrity.

## Decision

For the public pilot:

- Recovery Point Objective (RPO): no more than 24 hours of authoritative data loss.
- Recovery Time Objective (RTO): restore the service within 24 hours after a declared recovery event.
- These are launch acceptance targets, not a provider SLA or a guarantee to participants.
- The selected recovery plan must account for PostgreSQL state, private object data needed by active workflows, and required configuration/keys through a documented recovery process. A restore test must demonstrate the targets before real participant data or public launch.
- If a free configuration cannot demonstrate these objectives, apply ADR-081's explicit launch gate and seek a specifically costed paid exception only with owner approval.

## Consequences

- Database host, backup frequency/location, object recovery, key/config recovery, restore procedure, and recovery-test evidence remain to be selected and validated.
- Backup retention and deletion propagation must also satisfy ADR-079 and the applicable data-retention rules.

## Source

- ADR-071: Start with Free Services and Require Approval for Paid Tiers
- ADR-081: Use Synthetic Data Until Hosting Passes Launch Readiness
- Architecture interview decision made on 2026-10-12
