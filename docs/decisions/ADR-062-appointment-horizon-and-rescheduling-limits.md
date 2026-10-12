# ADR-062: Bound Appointment Scheduling and Rescheduling

- Status: Accepted
- Date: 2026-10-11

## Context

Accepting an offer creates a reservation that stops new offers and pauses every competing negotiation. An unbounded appointment or rescheduling process could let one reservation immobilize a listing indefinitely, frustrate backup buyers, and distort the marketplace pilot.

The MVP nevertheless needs enough flexibility for a local buyer and seller to coordinate an inspection and recover from ordinary scheduling problems.

## Decision

- The first mutually accepted transaction appointment must be scheduled no later than seven calendar days after reservation creation.
- The parties may mutually accept no more than two reschedules for that reservation.
- No accepted appointment may be later than 14 calendar days after reservation creation.
- Appointment proposals or acceptances outside these limits are rejected by the system.
- Free-form messages do not create an appointment, consume a reschedule, or extend either deadline.
- The reservation continues to expire 12 hours after the current accepted appointment unless completion confirmation has started or both parties accepted a permitted reschedule before that expiry threshold.

All elapsed limits use exact instants derived from the reservation creation timestamp. Appointment entry and display use Philippine Time.

## Consequences

- A buyer cannot hold a listing indefinitely through distant appointments or repeated rescheduling.
- Sellers and buyers retain limited flexibility for ordinary coordination problems.
- The appointment model must record reservation creation time, accepted appointment versions, and the count of accepted reschedules.
- Appointment acceptance is a server-enforced transition that checks both the reschedule count and absolute horizon.
- Merely proposing a revision does not consume a reschedule; the count advances only when both parties accept the revised structured appointment.
- Cancellation and automatic expiry remain neutral outcomes and do not establish a no-show or misconduct finding.

## Source

- `PROJECT.md` sections 18, 19, and 21
- Architecture interview decision made on 2026-10-11
