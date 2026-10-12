# ADR-078: Provide One Appeal for Moderation and Verification Decisions

- Status: Accepted
- Date: 2026-10-12

## Context

Case decisions already have a bounded one-appeal process under ADR-066. Listing moderation and professional/business verification can also materially affect a user's marketplace access or public trust status. Leaving those decisions without a correction path would make a mistaken decision difficult to remedy, while an unbounded process would exceed MVP operator capacity.

## Decision

- A user may file one internal appeal within seven calendar days after notice of a listing moderation rejection/removal or a verification denial/revocation.
- The appeal must identify new evidence, a material factual error, misapplication of platform policy, or a material procedural failure.
- Acknowledge within two business days and target a decision within five business days, using the Monday-through-Saturday Philippine Time business calendar.
- A different authorized operator reviews the appeal when available. Otherwise, the original operator performs a separately logged reconsideration addressing each appeal ground.
- An appeal does not automatically restore a listing, badge, account privilege, or lift an interim safety restriction. An authorized operator must explicitly change the applicable state.
- There is no second internal appeal during the MVP.

## Consequences

- Moderation and verification decisions need appeal eligibility, notice time, grounds, evidence, reviewer, and outcome history.
- Operator queues must surface appeal acknowledgement and decision targets across case, moderation, and verification work.
- The process gives affected users a correction path while preserving current safety controls and bounded operator duties.

## Source

- ADR-066: Define Case Findings, Remedies, and Appeals
- `PROJECT.md` sections 14, 23, 24, and 27
- Architecture interview decision made on 2026-10-12
