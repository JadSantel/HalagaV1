# ADR-029: Use an Eight-Week Pilot and 30 Completed Transactions as the Primary Threshold

- Status: Accepted
- Date: 2026-10-06

## Context

Registrations, listings, and messages do not by themselves show that the marketplace creates useful exchanges. The MVP needs a time-bounded outcome threshold to determine whether continued investment is justified.

## Decision

The initial Cagayan de Oro City MVP pilot will run for eight weeks beginning at the recorded timestamp when public registration opens after the invite-first liquidity gate is satisfied.

The pilot must produce at least 30 mutually confirmed completed transactions before it is considered meaningfully promising on its primary outcome measure.

Only transactions meeting the project's definition of completed transaction count toward this threshold. Administratively closed, expired, canceled, disputed-but-unresolved, or unilaterally claimed exchanges do not count.

The pilot must also have at least 40% of eligible published listings receive valid offers from at least two distinct buyers. This threshold tests whether the marketplace delivers competing-offer price discovery rather than merely facilitating isolated one-buyer exchanges.

For pilot measurement, a valid offer satisfies all of these conditions:

- It contains a positive amount denominated in Philippine pesos.
- It comes from a distinct buyer account that is eligible to transact and not suspended.
- It is submitted while the listing is active.
- It remains active until the seller responds or the listing or reservation resolves, or it receives a seller response such as acceptance, rejection, or counteroffer.
- It is not identified as a test, spam, fraudulent, self-dealing, duplicate or manipulative, or immediately withdrawn offer.

Multiple proposals or counterproposals within one buyer's negotiation count as one buyer's offer for the competing-offer metric, not as additional competing offers.

An otherwise legitimate listing enters the competing-offer denominator when either:

- It accumulates at least 24 hours of public availability while active.
- It becomes reserved or completed before reaching 24 hours of public availability.

Time spent draft, paused, reserved, removed, or otherwise unavailable to new buyers does not count toward the 24-hour exposure path. Early reservation or completion is a separate qualification path and is not excluded merely because the listing resolved quickly.

For a listing created during invite-first seeding and still active at formal pilot start:

- Its 24-hour public-availability calculation for the formal denominator starts at the formal pilot start timestamp; pre-pilot exposure does not count.
- Only valid offers submitted on or after formal pilot start count toward the two-distinct-buyer numerator.
- A reservation or completion event occurring on or after formal pilot start may qualify the listing through the early-resolution path even if its earlier negotiation history began during seeding.
- Historical seeding activity remains visible operationally but is excluded from formal KPI event counts.

## Consequences

- Pilot reporting must use the dual-confirmation completion state rather than self-reported or accepted offers.
- Activity completed or offers submitted during invite-first seeding does not count toward the formal thresholds, even if its records remain visible during the pilot.
- The measurement window ends exactly eight weeks after the recorded public-opening timestamp under the documented PHT calendar.
- The pilot is meaningfully promising only if it reaches both the 30-completion threshold and the 40% competing-offer threshold.
- Reaching the thresholds is a continuation signal, not proof of product-market fit or profitability.
- Transaction quality, offer competition, safety, and cohort composition must still be reviewed; teams must not optimize the count through low-quality or artificial transactions.
- Internal/test transactions and detected coordinated abuse must be excluded under documented analytics rules.
- Exclusions for test, duplicate, policy-removed, or fraudulent listings still need to be incorporated into the final `eligible published listing` definition. Secondary thresholds for completion conversion, time to first offer, and safety also remain unresolved.

## Source

- `product.md`, especially sections 29, 34, 35, and 42
- ADR-001: Make Competitive Price Discovery the Core MVP Promise
- ADR-011: Require Dual Confirmation of Final Price and Completion
- Project interview decision made on 2026-10-06
