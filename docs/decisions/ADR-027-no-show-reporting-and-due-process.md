# ADR-027: Do Not Infer a No-Show From Reservation Expiry

- Status: Accepted
- Date: 2026-10-06

## Context

A reservation can expire because an appointment passed without completion or rescheduling being recorded. That event does not prove which participant failed to attend, whether both agreed informally to cancel, or whether an emergency or technical problem occurred.

Automatically penalizing a user based only on workflow expiry could damage the wrong user's reputation or privileges.

## Decision

Reservation expiry does not automatically create a no-show finding or penalty.

A no-show case begins only when one transaction participant reports that the other failed to attend the agreed appointment. The accused user must be notified and given an opportunity to respond before support records an adverse platform finding or applies a marketplace penalty.

## Consequences

- No-show report, allegation, response, evidence, finding, and sanction must be distinct records or states.
- The agreed structured appointment and relevant in-app coordination history are evidence available to authorized support.
- The reporting interface must not present expiry alone as proof of fault.
- Repeated substantiated no-shows may inform stronger restrictions, but repeated allegations without findings must not be treated equivalently.
- Response deadline, non-response handling, appeal, and the exact effect on reputation or privileges remain unresolved.

## Source

- ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies
- ADR-026: Tie Reservation Expiry to the Agreed Appointment
- Project interview decision made on 2026-10-06
