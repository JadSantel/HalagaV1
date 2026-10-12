# ADR-047: Require Listing Renewal After 30 Days

- Status: Accepted
- Date: 2026-10-11

## Context

Indefinitely active listings create stale inventory, wasted buyer effort, misleading marketplace supply, and unreliable pilot metrics. Sellers need a lightweight way to confirm that an item remains available and its disclosures are still accurate.

## Decision

An active listing has a 30-day lifetime beginning when it is first published or successfully renewed.

After that lifetime, the seller must renew the listing to keep or return it to active marketplace availability. Renewal is an explicit seller action confirming that the item remains available and that the current listing facts are still accurate.

When the 30-day boundary is reached with existing activity:

- The listing stops accepting new offers unless the seller renews it.
- An existing reservation remains valid and continues under the normal appointment, inspection, cancellation, completion, and expiry rules.
- Active offers and counteroffers keep their existing 72-hour proposal deadlines and may be accepted, rejected, countered, withdrawn, or expire normally.
- An accepted existing proposal may create a reservation even though the listing is no longer accepting new offers.
- If the seller does not renew, the listing transitions to `Expired` once all existing active proposals and any reservation have ended without a completed transaction.

Renewal during this draining period restores eligibility for new offers without extending or silently modifying existing proposal deadlines.

## Consequences

- Listings need published-at, current-cycle-start, expires-at, renewal, expired, and closed lifecycle data.
- In-app and email reminders should be sent before expiry.
- An expired listing is not publicly active and cannot accept new offers.
- Renewal must not erase listing revisions, prior publication cycles, offer history, or pilot analytics history.
- Material changes made during renewal trigger the material-edit rules.
- The lifecycle needs a state or flags that distinguish accepting-new-offers from resolving-existing-activity.
- Renewal limits and any post-expiry renewal grace period remain unresolved.

## Source

- ADR-029: Use an Eight-Week Pilot and 30 Completed Transactions as the Primary Threshold
- ADR-033: Allow Public Browsing of Active Listings
- Project interview decision made on 2026-10-11
