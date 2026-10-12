# ADR-037: Omit Public Ratings and Written Reviews From the MVP

- Status: Accepted
- Date: 2026-10-06

## Context

Public star ratings and written reviews can support trust in a mature marketplace, but the pilot will have sparse histories and dual-role users. Reviews also create retaliation, moderation, defamation, appeal, and role-specific interpretation problems before enough transactions exist to make aggregate scores meaningful.

## Decision

The MVP will not provide public star ratings or written transaction reviews.

Public marketplace trust signals will be limited initially to:

- Applicable business or professional verification badges.
- Mutually confirmed completed-as-seller transaction count.
- Mutually confirmed completed-as-buyer transaction count.
- Account age or member-since information.

User reports, dispute history, submitted evidence, support findings, warnings, restrictions, and suspensions remain private operational data visible only to the affected user where policy requires and to authorized support staff. Unsubstantiated allegations are not public reputation signals.

## Consequences

- The MVP does not need review composition, public review moderation, star aggregation, review replies, or review-removal workflows.
- Public transaction counts must include only mutually confirmed completions and exclude administratively closed or unverified claims.
- Buyer and seller completion counts are derived separately from the account's contextual role in each completed transaction and must not be merged into a single public total.
- Account age and badges must not be described as guarantees of trustworthiness.
- Private history may inform support decisions and marketplace privileges, subject to access control and audit.
- A later reputation system requires separate research into retaliation, role-specific behavior, minimum sample sizes, and appeals.

## Source

- `product.md`, especially sections 20 and 21
- ADR-004: Use Unified Accounts for Buying and Selling
- ADR-011: Require Dual Confirmation of Final Price and Completion
- ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies
- Project interview decision made on 2026-10-06
