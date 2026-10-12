# ADR-034: Show a Chosen Display Name on Public Listings

- Status: Accepted
- Date: 2026-10-06

## Context

Public listings need enough seller identity to avoid feeling anonymous, but displaying a household seller's legal name would expose unnecessary personal information. Showing no identity until sign-in would reduce accountability and make public inventory less trustworthy.

## Decision

Public listings will show the seller's chosen display name.

The platform will not show an individual seller's legal or full name publicly by default. A verified business may separately show its verified business name and verification badge under the business-profile rules.

## Consequences

- Accounts need a display-name field distinct from legal, verification, billing, and contact names.
- Display names require content rules, moderation, uniqueness or disambiguation behavior, and change-history policy.
- The interface must distinguish a chosen display name from a verified business identity.
- A display name must not be presented as proof of legal identity.
- Public seller reputation may attach to the stable account while the visible display name changes, so account continuity must remain clear.
- Impersonation reporting and reserved-name handling are required trust-and-safety considerations.

## Source

- ADR-003: Allow Individuals and Verified Professionals to Submit Offers
- ADR-033: Allow Public Browsing of Active Listings
- Project interview decision made on 2026-10-06
