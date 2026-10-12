# ADR-019: Require a Seller Ownership Declaration for Every Listing

- Status: Accepted
- Date: 2026-10-05

## Context

The marketplace could be abused to sell stolen or unauthorized items. Requiring receipts or formal proof for every old household device would exclude legitimate sellers who no longer possess purchase records and would create document-storage and manual-review burdens.

The MVP needs a universal baseline while allowing stronger evidence where it is practical and materially useful.

## Decision

Before publishing every listing, the seller must affirm that they own the item or are authorized by its owner to list and transfer it.

The declaration must be recorded with the seller, listing, declaration version, and timestamp. It is an attestation, not proof that the platform independently verified ownership.

Additional evidence may be collected for specific device types or risk cases when practical and useful. Such requirements must be defined explicitly rather than imposed ad hoc.

## Consequences

- Publication must be blocked until the seller accepts the ownership declaration.
- The listing and safety policies must prohibit stolen items and unauthorized sales.
- The interface must not describe a declared item as platform-verified ownership.
- Reports of suspected theft need a moderation and evidence-handling process.
- Stronger proof requirements must account for sensitive identifiers, privacy, retention, reviewer access, and legitimate owners without receipts.
- The categories requiring serial numbers, IMEI values, ownership photos, receipts, or other evidence remain unresolved.

## Source

- `product.md`, especially sections 12 and 21
- Project interview decision made on 2026-10-05
