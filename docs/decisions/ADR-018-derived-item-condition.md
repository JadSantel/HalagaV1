# ADR-018: Derive Item Condition From Simple Diagnostic Questions

- Status: Accepted
- Date: 2026-10-05

## Context

The primary MVP seller is an occasional individual or household owner who may not know whether a device is repairable, economical to refurbish, or useful for parts. Asking the seller to select a technical condition category directly could create inconsistent and misleading classifications.

The platform still needs normalized condition data for browsing, filtering, offer decisions, safety checks, and analytics.

## Decision

The listing flow will ask the seller simple, observable diagnostic questions and derive a normalized condition label from the answers.

The derived label must be shown to the seller before publication. The interface must also show the underlying answers or explanation sufficiently clearly for the seller to spot and correct an input mistake.

The seller cannot manually override the derived label. If the seller believes the result is wrong, they must review and change the underlying diagnostic answers. Diagnostic questions must provide an appropriate unknown or untested response when the seller cannot truthfully answer.

The classification is guidance based on seller-provided information, not a professional diagnosis, repairability guarantee, or item valuation.

Derived condition labels will describe observable state rather than inferred disposition or economic potential. Labels such as `Repair Needed`, `For Parts`, and `End of Life` will not be used as the normalized condition because they assume technical or economic judgments that the questionnaire cannot reliably establish.

Repair, refurbishment, parts, salvage, and recycling potential may be expressed separately as buyer intent or later routing guidance, but not as the item's factual condition.

The canonical cross-category condition labels are:

1. `Fully functional`
2. `Functional with issues`
3. `Not functional`
4. `Untested/unknown`

Power-on status is stored as a separate diagnostic fact when it is relevant to the category. It is not a universal condition label because some supported accessories and components do not have a meaningful standalone power-on state.

The universal derivation rule is:

- **Untested/unknown:** the seller cannot or did not test the item sufficiently.
- **Fully functional:** the item was tested, all expected primary functions work, and there is no known functional defect.
- **Functional with issues:** the item was tested and performs at least one intended function, but has a disclosed defect, intermittent behavior, or missing functionality.
- **Not functional:** the item was tested and performs no intended function in its current state.

Power-on status, cosmetic damage, missing accessories, battery condition, and specific defects are separate diagnostic facts. They do not replace the universal condition label and must be disclosed where relevant.

## Consequences

- Diagnostic questions should use observable language such as whether the device powers on, starts normally, has visible damage, or has known failing functions.
- Category-specific questions may be necessary, but the MVP needs a consistent cross-category condition model.
- The system must store the material diagnostic answers, not only the derived label, so buyers can evaluate the underlying claims and classification rules can evolve.
- Buyers must be able to see relevant disclosed defects and diagnostic answers rather than relying solely on the label.
- Sellers must correct their underlying answers if the displayed result seems wrong; direct label overrides are not permitted.
- Category-specific questions must map to the universal rule without redefining the four labels. Detailed question wording and test guidance remain to be designed.

## Source

- `product.md`, especially sections 9.3, 12, 13, 22, and 40
- ADR-002: Use Individual and Household Sellers as the MVP Design Center
- Project interview decision made on 2026-10-05
