# ADR-026: Tie Reservation Expiry to the Agreed Appointment

- Status: Accepted
- Date: 2026-10-06

## Context

A fixed reservation period beginning at offer acceptance may expire before a legitimate pickup can occur or remain active long after a missed meetup. The parties already need to coordinate inspection and transfer, so an agreed appointment provides a more meaningful deadline.

## Decision

An active reservation must have a structured pickup or meetup appointment agreed by both buyer and seller.

Reservation expiry is tied to the agreed appointment time plus a 12-hour grace period. Free-form messages may support coordination, but text in a message does not by itself establish or change the system appointment.

At the end of the grace period, the reservation expires automatically unless either:

- A completion-confirmation flow for the transaction has already started.
- The buyer and seller agreed to a structured rescheduled appointment before the deadline.

Automatic expiry ends the reservation and makes eligible paused backup negotiations available to reopen. It does not classify the transaction as completed or determine that either party committed a no-show.

## Consequences

- The transaction model needs a proposed appointment, acceptance by the other party, timezone-aware scheduled timestamp, fulfillment method, and private location details.
- Appointment changes must preserve history and require agreement rather than silently replacing the prior schedule.
- The interface must show the appointment and reservation deadline clearly to both parties.
- Paused backup offers remain paused until the reserved transaction completes, is canceled, or reaches the appointment-based expiry process.
- Notifications and reminders must be scheduled relative to the appointment.
- Scheduled processing must expire eligible reservations reliably and reopen the listing or backup negotiations without creating a second simultaneous reservation.
- The allowable appointment horizon, rescheduling limits, no-show claims, and backup reopening order remain unresolved.

## Source

- ADR-014: Limit MVP Fulfillment to Buyer Pickup and Agreed Meetup
- ADR-015: Coordinate Pickup and Meetup Inside the Platform
- ADR-025: Pause Competing Offers as Backups During a Reservation
- Project interview decision made on 2026-10-06
