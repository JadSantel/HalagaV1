# ADR-024: Use a 48-Hour Material-Misrepresentation Dispute Window

- Status: Accepted
- Date: 2026-10-06

## Context

Physical inspection occurs before transaction completion, but some materially inconsistent defects may require setup or ordinary testing to discover. An indefinite transaction-dispute window would create uncertainty for users and an open-ended support obligation.

## Decision

A buyer may open a material-misrepresentation dispute until 48 hours after buyer and seller mutually confirm transaction completion.

The deadline is calculated from the timestamp at which the second matching completion confirmation makes the transaction completed.

The 48-hour limit applies to a transaction remedy or finding based on material misrepresentation. It does not prevent users from reporting suspected stolen property, immediate safety risks, prohibited items, threats, harassment, fraud patterns, or other account abuse after the transaction-dispute window.

## Consequences

- The system must calculate and store a precise dispute deadline for each mutually completed transaction.
- The completion interface must disclose the deadline clearly to both parties.
- The transaction and relevant evidence must not be purged before the dispute window and any opened case are resolved.
- A dispute submitted before the deadline remains reviewable after the deadline passes.
- General safety and abuse reporting must be available independently of transaction-dispute eligibility.
- The seller response period, support response target, evidence rules, and appeal window remain unresolved.

## Source

- ADR-011: Require Dual Confirmation of Final Price and Completion
- ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies
- ADR-023: Define Material Misrepresentation by Decision Impact
- Project interview decision made on 2026-10-06
