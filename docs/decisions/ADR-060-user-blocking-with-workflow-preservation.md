# ADR-060: Allow Blocking Without Erasing Active Workflows

- Status: Accepted
- Date: 2026-10-11

## Context

Users need a way to stop unwanted future contact. Treating a block as deletion or cancellation could conceal evidence, strand the counterparty, or let a participant escape a reservation, completion confirmation, or dispute.

## Decision

A user may block another account.

Blocking prevents new interactions between the two accounts, including:

- New pre-offer inquiries.
- New offers or counteroffers.
- New ordinary direct messages outside preserved active-workflow communication.

Blocking does not cancel, delete, hide from its participants, or otherwise resolve an existing reservation, pending completion process, report, or dispute. Existing workflows remain accessible as required and must reach a terminal state through normal cancellation, completion, administrative closure, or support resolution.

Relevant records and evidence remain available to authorized support under the retention policy.

When either account blocks the other, the platform applies mutual authenticated-session hiding:

- Each account's profile is hidden from the other outside preserved workflow views.
- Each account's future listings are omitted from the other's signed-in browsing, search, and recommendations if recommendations are later introduced.
- Existing transaction, report, dispute, and retained-history views remain accessible only to the extent necessary to resolve or understand those workflows.

Because active listings are publicly browseable, blocking does not guarantee that otherwise public content is invisible when accessed while signed out or through a public direct link. The interface must not claim otherwise.

## Consequences

- Block checks must be enforced server-side for new interaction creation in both directions.
- The interface must explain that blocking does not end an active transaction or replace urgent reporting.
- Communication within an active workflow may be limited to necessary structured actions or support-mediated channels if ordinary messaging is blocked.
- Blocking must not erase prior messages, offers, appointments, confirmations, or audit history.
- Support must be able to distinguish a block from suspension, account deletion, or a platform finding.
- Search and profile queries in authenticated sessions must enforce mutual hiding without leaking the reason or blocker identity through public APIs.

## Source

- ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies
- ADR-049: Allow Either Party to Cancel a Reservation Directly
- ADR-053: Block Full Account Deletion While Marketplace Workflows Are Active
- ADR-059: Allow Private Buyer Questions Before an Offer
- Project interview decision made on 2026-10-11
