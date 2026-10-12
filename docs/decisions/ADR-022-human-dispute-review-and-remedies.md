# ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies

- Status: Accepted
- Date: 2026-10-06

## Context

Listings, negotiations, and transaction confirmations can produce disputes about item description, conduct, or transaction status. Payments occur outside the platform, so the platform cannot reliably verify or reverse the movement of funds. Providing no case review would leave the platform unable to act on repeated abuse or correct its own records.

## Decision

MVP disputes may be reviewed by human support.

Support may review platform records and evidence submitted by the parties, record a finding, and take platform-level actions including:

- Correcting transaction status where the evidence and policy permit.
- Removing listings.
- Issuing warnings.
- Restricting marketplace privileges.
- Suspending accounts.

The platform does not:

- Guarantee or issue refunds for external payments.
- Reverse external payments.
- Legally determine item ownership.
- Legally determine damages or liability.

## Consequences

- Disputes need a case record, participants, category, status, submitted evidence, support notes, findings, actions, timestamps, and an audit trail.
- Authorized support access to private messages, proposal history, transaction confirmations, listing revisions, and submitted evidence must be controlled and auditable.
- User-facing policy must distinguish platform findings and account actions from judicial, law-enforcement, or payment-provider decisions.
- Transaction-status corrections must preserve prior state and the reason for the administrative action rather than rewriting history invisibly.
- Support staffing, response targets, evidence retention, appeals, and escalation procedures are operational requirements that still need definition.
- Reviewable dispute categories and the definition of material misrepresentation remain unresolved.

## Source

- `product.md`, especially sections 21, 34, and 35
- ADR-008: Keep Pre-Acceptance Negotiation In the Platform
- ADR-021: Keep MVP Payments Outside the Platform
- Project interview decision made on 2026-10-06
