# ADR-039: Permit Unknown Brand or Model With Identifying Evidence

- Status: Accepted
- Date: 2026-10-06

## Context

Exact device identity improves search, buyer evaluation, and later comparable-transaction data. Some legitimate household sellers cannot determine the brand or model of an old, damaged, unbranded, relabeled, or unfamiliar item. Making both fields universally mandatory would block supported inventory or encourage guessing.

## Decision

A seller may select `Unknown` for brand, model, or both when they cannot determine the value truthfully.

An unknown value must not be replaced by a guess. The seller must provide sufficient identifying evidence and available descriptive details so a buyer can assess the item. `Unknown` is an explicit normalized value, not a blank field.

When identifying labels, nameplates, model codes, or other markings are present, publication requires:

- A clear photo showing the relevant markings.
- A written description of the item using the facts the seller can observe.

When no identifying markings exist, publication requires:

- Multiple clear photos from different angles.
- Sufficient descriptive details for buyers to reasonably identify and evaluate the item.

The enhanced evidence supplements, and does not replace, the general two-photo minimum.

## Consequences

- Brand and model need known/unknown state rather than relying on empty strings or invented text.
- Listings with unknown identity may rank or filter differently and should disclose the uncertainty clearly.
- Buyers may use in-app messaging to request additional information before offering.
- A later correction to brand or model must preserve listing revision history, especially after offers exist.
- The platform must not present buyer-suggested identity as verified fact without seller confirmation or moderation.
- Publication validation must branch based on whether the seller reports that identifying markings are present.
- Moderation may reject an `Unknown` listing whose evidence is too vague to evaluate reasonably.

## Source

- `product.md`, especially sections 12, 14, 22, 23, and 40
- ADR-002: Use Individual and Household Sellers as the MVP Design Center
- ADR-038: Require at Least Two Photos of the Actual Item
- Project interview decision made on 2026-10-06
