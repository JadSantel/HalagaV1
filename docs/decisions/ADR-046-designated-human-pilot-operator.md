# ADR-046: Staff the Pilot With a Designated Human Operator

- Status: Accepted
- Date: 2026-10-11

## Context

The agreed MVP includes human-reviewed business and technician verification, listing and safety moderation, no-show review, material-misrepresentation disputes, evidence review, platform findings, and account or listing sanctions. These workflows cannot function safely or honestly if no person is responsible for them during the pilot.

## Decision

A designated primary and at least one trained alternate operator will provide coverage throughout the eight-week Cagayan de Oro City MVP pilot (expanded by ADR-080).

The operator is responsible for the operational queues needed to support the agreed policies, including:

- Business and professional technician verification applications.
- Prohibited, hazardous, stolen-item, and other listing reports.
- User conduct and no-show reports.
- Material-misrepresentation disputes.
- Evidence review and platform findings.
- Listing removal, warnings, privilege restrictions, suspensions, and status corrections within authorized policy.

The pilot must not launch these workflows without an assigned operator and controlled staff access.

The pilot service targets are:

- **Urgent safety reports:** initial human review within four hours that fall inside the operator's defined coverage hours.
- **Routine verification applications and disputes:** initial human review within two business days.

These are initial-review targets, not guaranteed final-resolution times. The operator may need additional evidence, a response from another user, or external escalation before closing a case.

Operator coverage is **8:00 AM through 10:00 PM Philippine Time (PHT, UTC+8), every day**.

For routine-target calculation, business days are Monday through Saturday in PHT. Sunday is covered for urgent safety review but does not count as a business day for the two-business-day routine target.

## Consequences

- A staff interface or secure operational process is an MVP requirement.
- Operator actions must be authorized, auditable, and attributable to a staff identity.
- Private messages, sensitive identifiers, verification documents, and dispute evidence must be exposed only when necessary for the assigned case.
- Clear review queues, case priorities, policy guidance, and escalation paths are required before pilot launch.
- Automation may prioritize, notify, and enforce deterministic deadlines, but it must not fabricate a human finding.
- Queue timestamps and reporting must distinguish submission, initial review, user-response waiting time, and final resolution.
- Time calculations and user-facing deadlines must use explicit timestamps and the documented PHT business calendar rather than the application server's local timezone.
- External emergency or law-enforcement escalation procedures remain unresolved.

## Source

- ADR-017: Exclude Standalone and Hazardous Battery Items
- ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies
- ADR-027: Do Not Infer a No-Show From Reservation Expiry
- ADR-036: Human-Review Business and Professional Technician Verification
- Project interview decision made on 2026-10-11
