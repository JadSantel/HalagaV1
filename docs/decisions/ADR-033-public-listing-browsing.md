# ADR-033: Allow Public Browsing of Active Listings

- Status: Accepted
- Date: 2026-10-06

## Context

Requiring an account before viewing inventory adds friction for prospective buyers and limits link sharing and search discovery. Public listing access also increases the risk of exposing seller identity, exact location, sensitive device identifiers, and transaction details.

## Decision

Active marketplace listings may be browsed without signing in.

Registration and verified email remain required before a user can submit an offer or publish a listing. Public browsing does not grant access to private negotiation, seller contact, exact pickup details, stored IMEI values, seller price expectations, or transaction records.

During the eight-week MVP pilot, public listing pages must not be intentionally indexed by search engines. The application will use appropriate `noindex` directives and crawler controls while still permitting ordinary users to browse and share direct links.

## Consequences

- Public listing routes must enforce a deliberate public-field projection rather than serialize the full listing or seller record.
- Public pages may be shared by direct link but are marked not for search-engine indexing during the pilot.
- Removed, draft, reserved, expired, or otherwise non-public listing states must not leak through predictable URLs or caches.
- Public images and descriptions require moderation and guidance against embedded phone numbers, addresses, serial numbers, or other sensitive information.
- Rate limiting, scraping controls, and image-metadata handling are required considerations.
- `Noindex` and crawler rules are not security controls; private data must remain excluded from public responses even when crawlers ignore directives.

## Source

- `product.md`, especially sections 14, 18, 19, and 40
- ADR-015: Coordinate Pickup and Meetup Inside the Platform
- ADR-020: Make IMEI Entry Optional but Strongly Encouraged
- ADR-032: Require Email Verification for Listings and Offers
- Project interview decision made on 2026-10-06
