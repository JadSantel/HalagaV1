# ADR-042: Restrict MVP Marketplace Participation to Adults

- Status: Accepted
- DOB-retention supersession: ADR-093 (2026-10-21 PHT) replaces retained DOB with transient signup checking and minimal passed-check/attestation evidence. Adults-only eligibility and the separate attestation remain.
- Date: 2026-10-06

## Context

The product facilitates negotiation, local meetups or home pickup, off-platform payment, and transfers of used property. Allowing minors would require guardian consent, age-specific privacy treatment, and additional safety and contract rules beyond the MVP's operational scope.

## Decision

Marketplace participation in the MVP is limited to users who are at least 18 years old.

An underage user may not publish listings, submit offers, negotiate, create reservations, schedule transaction appointments, or complete marketplace transactions.

For ordinary users, the MVP enforces this rule through:

- A self-declared date of birth.
- An explicit attestation that the user is at least 18 and eligible to participate.

Ordinary marketplace access does not require government-ID verification solely for age. The platform must describe this as self-declared eligibility, not verified age or identity.

## Consequences

- Account onboarding or marketplace-capability activation must capture the date of birth, attestation version, and attestation timestamp.
- Terms and safety guidance must state the adult-only requirement clearly.
- Reports of underage participation need an account-restriction and review process.
- The product will not implement guardian accounts, parental consent, or minor-specific transaction workflows in the MVP.
- Public browsing without an account does not constitute marketplace participation.
- Date of birth is private account data and must not appear on public profiles or listings.
- Treatment of an account later found to be underage remains unresolved.

## Source

- ADR-014: Limit MVP Fulfillment to Buyer Pickup and Agreed Meetup
- ADR-021: Keep MVP Payments Outside the Platform
- Project interview decision made on 2026-10-06
