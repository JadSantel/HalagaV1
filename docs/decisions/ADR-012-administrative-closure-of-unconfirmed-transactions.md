# ADR-012: Administratively Close Stale Confirmations Without Inferring Success

- Status: Accepted
- Date: 2026-10-05

## Context

Dual confirmation can leave transactions indefinitely pending when one party stops responding. Automatically marking such a transaction completed would produce unverified sales and unreliable final-price data. Leaving it open forever would clutter user workflows and operational queues.

## Decision

A deadline and automatic administrative-closure rules will apply when final completion confirmation remains outstanding.

The deadline is a fixed 72-hour confirmation window that begins when the first party submits completion confirmation.

When the deadline and applicable closure conditions are reached, the platform may close the workflow administratively, but it must not infer that the transaction succeeded merely because time passed.

An administratively closed, unconfirmed transaction is distinct from:

- A mutually confirmed completed transaction.
- A mutually acknowledged cancellation.
- A transaction resolved through support or dispute review.

## Consequences

- The lifecycle needs a terminal or archived status representing administrative closure without verified completion.
- Administrative closure must not contribute to completed-exchange counts, completed-sale conversion, or historical final-price valuation data.
- The system must retain each party's submitted confirmation and claims for audit and support purposes.
- Users need clear language explaining that closure is procedural and does not validate either party's account.
- Scheduled processing and notifications will be needed to issue reminders and apply closure rules.
- The reminder schedule, reopening policy, and conditions that route a case to support instead of automatic closure remain unresolved.

## Source

- `product.md`, especially sections 21, 24, 34, and 35
- ADR-011: Require Dual Confirmation of Final Price and Completion
- Project interview decision made on 2026-10-05
