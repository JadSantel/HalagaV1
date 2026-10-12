# ADR-032: Require Email Verification for Listings and Offers

- Status: Accepted
- Date: 2026-10-06

## Context

Email is an MVP notification channel for offers, negotiations, appointments, confirmation deadlines, disputes, and account safety. Allowing users with unverified or mistyped addresses to publish or offer would weaken delivery reliability and make low-cost account abuse easier.

## Decision

A user must verify their email address before they can:

- Publish a listing.
- Submit an offer.

An unverified account may exist and access lower-risk functions, but it does not have marketplace transaction capability until email verification succeeds.

## Consequences

- Authorization checks must enforce verification server-side for publication and offer creation, not only hide interface controls.
- Email-change workflows must define when re-verification is required and whether marketplace actions are temporarily restricted.
- Verification tokens need expiry, replay protection, resend limits, and abuse controls.
- Existing listings and negotiations need a policy if a previously verified address becomes undeliverable or is changed.
- Email verification proves control of an address, not identity, ownership, trustworthiness, or professional status.
- Anonymous browsing and the exact lower-risk capabilities of unverified users remain unresolved.

## Source

- ADR-003: Allow Individuals and Verified Professionals to Submit Offers
- ADR-031: Require In-App and Email Notifications
- Project interview decision made on 2026-10-06
