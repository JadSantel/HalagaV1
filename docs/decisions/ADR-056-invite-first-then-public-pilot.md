# ADR-056: Use an Invite-First Pilot Before Public Registration

- Status: Accepted
- Date: 2026-10-11

## Context

The product's core promise depends on enough relevant buyers being available near sellers to produce competing offers. Opening an empty local marketplace to the public could create poor first experiences and fail because of cold-start timing rather than the underlying value proposition. A permanently closed cohort would not test broader eligible-user participation.

## Decision

The eight-week Cagayan de Oro City pilot uses a staged launch:

1. **Invite-first seeding:** the team recruits an initial cohort of sellers and active buyers to establish marketplace supply and demand.
2. **Public registration:** once a documented baseline-liquidity threshold is reached, registration opens to any eligible Cagayan de Oro user who satisfies the MVP participation requirements.

Invite status affects only initial access. It does not provide offer priority, listing priority, exclusive inventory access after public opening, reduced moderation, special trust badges, or preferential treatment in transactions.

Public registration opens only after all of these baseline-liquidity conditions are met:

- At least 25 eligible active listings.
- At least eight transaction-ready buyers.
- Active inventory across at least three supported category families.
- At least five distinct buyers have submitted one or more valid offers during the seeding period.
- No single buyer accounts for more than 40% of all valid offers submitted during the seeding period at the public-opening checkpoint.

For this gate, a transaction-ready buyer is an eligible, non-suspended, email-verified adult account within the launch market that has completed the required buyer onboarding and can submit an offer immediately. Merely being invited or registered does not make an account transaction-ready.

The formal eight-week pilot clock begins when public registration opens after the liquidity gate is satisfied and the opening decision is recorded. Invite-first seeding is a separate pre-pilot phase.

Seeding-period activity does not count toward the formal pilot's 30 mutually confirmed completed transactions or 40% competing-offer threshold. It may be retained and reported separately for product debugging, operational learning, baseline analysis, and comparison with public-phase behavior.

Eligible listings created during seeding may remain active when public registration opens; republication is not required. Their pre-pilot history remains intact. Formal KPI attribution is event-based: only qualifying offers, reservations, completions, and other measured events whose relevant event timestamp occurs on or after the formal pilot start count toward formal pilot metrics.

## Consequences

- Access control must support invite-first registration and a later public-registration mode without changing account or transaction semantics.
- Invite source and cohort should be recorded for analytics but not exposed as a trust signal.
- Pilot analysis must distinguish seeded-cohort activity from post-opening public acquisition and must not describe recruited usage as purely organic demand.
- Invitations cannot be used to bypass email verification, adult eligibility, location, ownership, category, or safety rules.
- Analytics must assign activity to the seeding or formal-pilot phase using the recorded public-opening timestamp.
- Persisted seeding listings must not be duplicated or given artificial publication recency when the formal pilot begins.
- The opening decision and the metrics used must be recorded in the pilot log.
- The 40% concentration threshold is an analytics criterion for public-opening readiness only. It does not cap, reject, throttle, or otherwise restrict legitimate offers from a buyer.

## Source

- ADR-001: Make Competitive Price Discovery the Core MVP Promise
- ADR-013: Launch the MVP in Cagayan de Oro City
- ADR-029: Use an Eight-Week Pilot and 30 Completed Transactions as the Primary Threshold
- Project interview decision made on 2026-10-11
