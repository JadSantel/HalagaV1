# ADR-050: Limit MVP Discovery to Essential Search, Filters, and Newest Sort

- Status: Accepted
- Date: 2026-10-11

## Context

Buyers need to locate relevant inventory quickly, but the MVP has no public asking price, does not collect precise listing coordinates, and must avoid building advanced recommendation or geospatial systems before marketplace behavior is validated.

## Decision

MVP marketplace discovery provides:

- Keyword search across listing title, brand, model, and searchable description or keywords.
- Category filter.
- Derived condition filter.
- Barangay/location filter.
- Listing type filter for `Single item` versus `Bundle/lot`.
- Sort by newest publication activity.

Search and filters may be combined. Public results include only listings in a publicly browseable state.

Buyers discover inventory through browsing and manual search. The MVP does not include saved searches or automatic notifications for newly published matching listings.

## Consequences

- Search indexing must respect listing visibility and avoid indexing private fields, seller price expectations, messages, IMEI values, exact transaction locations, or moderation evidence.
- Category, condition, barangay, listing type, and publication time require stable normalized fields.
- `Newest` needs a documented timestamp rule that does not let trivial edits repeatedly jump a listing to the top; renewal and material republication behavior remain to be specified.
- Exact-distance or radius filtering is not an MVP requirement because listing location is barangay-level.
- Public price filtering and sorting are not available because seller expectations and offers are private.
- Relevance ranking, personalized recommendations, saved searches, new-listing alerts, advanced specification filters, offer-count sorting, and map-radius search are outside MVP scope.

## Source

- `product.md`, especially sections 14, 19, and 32
- ADR-006: Allow an Optional Seller Price Expectation
- ADR-018: Derive Item Condition From Simple Diagnostic Questions
- ADR-035: Show Barangay and an Approximate Map Area Publicly
- ADR-043: Support Explicit Single-Item and Bundle/Lot Listings
- Project interview decision made on 2026-10-11
