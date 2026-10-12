# ADR-049: Allow Either Party to Cancel a Reservation Directly

- Status: Accepted
- Date: 2026-10-11

## Context

An accepted offer creates an intent to transact subject to inspection, not a guaranteed sale. Either party may discover that they cannot proceed before completion. Requiring mutual agreement or support approval would keep unwilling participants locked in and create unnecessary operational delay.

## Decision

Either the buyer or seller may cancel a reservation directly before transaction completion without mutual agreement or support approval.

Cancellation requires the initiating party to select or enter a reason. It takes effect immediately when validly submitted, notifies the other party through in-app and email channels, and remains in the transaction audit history.

Cancellation does not by itself create a fault, no-show, or misconduct finding. The other party may report abuse, and repeated or dishonest cancellation behavior may be reviewed under marketplace policy.

Ordinary direct cancellation is disabled as soon as either party submits a completion confirmation. From that point, the workflow must resolve through matching confirmation, party reconciliation of the submitted final terms, the 72-hour administrative-closure process, or human support review. A support-authorized status correction preserves the prior claims and audit history.

## Consequences

- Cancellation needs initiating party, reason category, optional explanation, timestamp, prior state, and resulting state.
- A canceled reservation cannot be completed unless a later policy explicitly supports restoration; the listing and backups follow reopening rules.
- Appointment reminders and expiry jobs must stop or become no-ops after cancellation.
- Private messages and transaction history remain available under retention and dispute policies rather than being deleted.
- Cancellation metrics should distinguish buyer cancellations, seller cancellations, automatic expiry, failed inspection, and support action.
- Authorization and state transitions must prevent a race in which cancellation erases or supersedes an already-recorded completion submission.

## Source

- ADR-009: Treat Offer Acceptance as a Reservation Pending Inspection
- ADR-026: Tie Reservation Expiry to the Agreed Appointment
- ADR-027: Do Not Infer a No-Show From Reservation Expiry
- Project interview decision made on 2026-10-11
