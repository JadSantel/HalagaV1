# ADR-023: Define Material Misrepresentation by Decision Impact

- Status: Accepted
- Date: 2026-10-06

## Context

Used electronics may contain mistakes, unknown defects, or deliberately concealed problems. A dispute standard based only on proven intent would leave buyers without a valid platform finding when an important inaccurate statement was made honestly. Treating every minor discrepancy as material would make ordinary variation and inconsequential errors disputable.

## Decision

A listing or transaction contains a material misrepresentation when an undisclosed or inaccurate fact would reasonably have changed the buyer's offer, decision to reserve, or decision to complete the transaction.

Materiality does not depend on proving that the seller acted intentionally. Seller knowledge, intent, care, cooperation, prior history, and repeated conduct affect the appropriate platform remedy or sanction rather than whether the discrepancy was material.

Potentially material facts include, without limitation:

- Incorrect device identity, model, or material specifications.
- A significant functional defect inconsistent with the diagnostic answers or description.
- Missing components or accessories represented as included.
- Activation, account, firmware, or management locks that materially limit use.
- Counterfeit or materially inauthentic identity claims.
- Undisclosed hazardous conditions.

Minor cosmetic variation, buyer's remorse, disagreement about subjective value, and defects accurately disclosed before completion are not material misrepresentation by themselves.

## Consequences

- Support must assess both materiality and culpability rather than treating them as the same question.
- An honest but material mistake may justify correcting transaction records or protecting the buyer without automatically warranting suspension.
- Deliberate concealment, reckless statements, or repeated material errors may justify stronger account restrictions.
- Listing forms and diagnostic questions should capture facts buyers commonly rely on, reducing avoidable disputes.
- The platform must communicate that physical inspection remains important and that the platform does not guarantee every undiscoverable internal condition.
- Evidence standards, the dispute filing window, and policy for latent defects remain unresolved.

## Source

- ADR-018: Derive Item Condition From Simple Diagnostic Questions
- ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies
- Project interview decision made on 2026-10-06
