# ADR-063: Bound Completion Reminders and Mismatch Resolution

- Status: Accepted
- Date: 2026-10-11

## Context

Halaga counts a transaction as completed only when buyer and seller confirm both completion and the same final PHP price. The first confirmation starts a 72-hour response window and disables ordinary direct cancellation.

The prior rule treated every failure to obtain a matching confirmation within 72 hours as administrative closure. That did not distinguish total silence from an active disagreement, and it gave a participant who responded near the deadline too little time to correct an accidental price mismatch. Automatically sending every silent timeout to support would also burden the pilot operator without evidence of an actual dispute.

## Decision

### Notifications

After the first completion confirmation:

- Halaga notifies the other participant immediately.
- While that participant has not responded, Halaga sends a reminder with 48 hours remaining in the original window.
- While that participant has not responded, Halaga sends a final reminder with 12 hours remaining in the original window.

Transactional emails follow the existing privacy rule and do not include the submitted final price or unnecessary private transaction details.

### Total non-response

If the other participant submits no completion confirmation by the original 72-hour deadline, Halaga administratively closes the transaction as unconfirmed. This does not automatically create a support case and does not count as completion.

### Mismatched confirmations

When both parties have submitted completion confirmations but their final prices do not match:

- Halaga notifies both participants of the mismatch without disclosing information beyond their shared transaction.
- Either participant may self-correct by submitting a new confirmation that supersedes their own previous confirmation.
- Prior confirmations remain immutable history.
- Either participant may report a problem and request support before the automatic support-routing deadline.

The mismatch correction deadline is:

```text
earlier of (
  first confirmation timestamp + 120 hours,
  later of (
    first confirmation timestamp + 72 hours,
    first mismatch timestamp + 48 hours
  )
)
```

The first mismatch fixes this deadline. Later corrections or mismatches do not restart or extend it.

- If the current confirmations match by the correction deadline, the transaction completes normally.
- If a mismatch remains at the correction deadline, Halaga creates a support case.
- An unresolved mismatch is not administratively closed as ordinary non-response.

## Examples

- A first mismatch at hour 20 has a correction deadline at hour 72.
- A first mismatch at hour 70 has a correction deadline at hour 118.
- No response at all by hour 72 causes administrative closure without an automatic support case.

## Consequences

- Ordinary inactivity does not consume operator capacity.
- A genuine disagreement receives a bounded self-service correction period and eventual human review.
- The system must distinguish no response, matching confirmations, and mismatched confirmations.
- Completion confirmations are append-only, with an explicit supersession relationship per participant.
- The scheduler needs separate idempotent jobs for the two reminders, silent administrative closure, and unresolved-mismatch support routing.
- The original response deadline, first-mismatch timestamp, computed correction deadline, reminder delivery state, and support-case causation must be auditable.
- The 120-hour cap prevents repeated corrections from holding the workflow open indefinitely.

## Source

- `PROJECT.md` sections 20 and 25
- Architecture interview decision made on 2026-10-11
