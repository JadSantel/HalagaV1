# ADR-031: Require In-App and Email Notifications

- Status: Accepted
- Date: 2026-10-06

## Context

Marketplace events such as new offers, counteroffers, appointment proposals, rescheduling, completion confirmation, and deadlines require timely user attention. In-app notifications alone are ineffective when an occasional household user does not keep the website open. SMS introduces per-message cost and phone-number handling, while browser push introduces permission and browser-support complexity.

## Decision

The MVP will provide:

- In-app notifications.
- Email notifications.

SMS and browser push notifications are outside initial MVP scope.

## Consequences

- Every account needs a usable email address, with verification policy still to be defined.
- Notification events need durable records, read/unread state for in-app delivery, email-delivery attempts, and retry or failure handling.
- Time-sensitive email must avoid exposing private offer amounts, exact meetup locations, IMEI values, or unnecessary message content.
- Users need essential notification settings, but safety, security, appointment, reservation-expiry, dispute, and confirmation-deadline notices may need to remain mandatory.
- Product flows must not rely on SMS, native push, or browser push to meet deadlines.
- The event matrix, user preferences, retry schedule, and email provider remain implementation decisions.

## Source

- ADR-008: Keep Pre-Acceptance Negotiation In the Platform
- ADR-026: Tie Reservation Expiry to the Agreed Appointment
- ADR-030: Deliver the MVP as a Responsive Web Application
- Project interview decision made on 2026-10-06
