# ADR-058: Publish Valid Listings Immediately and Hold Flagged Listings for Review

- Status: Accepted
- Date: 2026-10-11

## Context

Universal human pre-approval would make a single pilot operator a bottleneck for every listing and slow marketplace supply. Unconditional immediate publication would expose users to unsupported, hazardous, fraudulent, or insufficiently evidenced items before staff could act.

## Decision

The MVP does not require universal human pre-approval of listings.

A listing publishes immediately when it satisfies required fields, supported-category and bundle rules, safety restrictions, ownership declaration, evidence requirements, and deterministic automated validation without triggering a review condition.

A listing that triggers a defined safety, policy, fraud, or evidence-review condition is withheld from public visibility pending human review. It must not appear in public browsing, search, feeds, metadata, or share previews while held.

Every published listing remains subject to user reporting, rules-based detection, and post-publication human moderation.

Pre-publication human review is triggered when automated or rules-based checks detect one or more of these conditions:

- Unsupported or ambiguous category classification, including uncertain constrained-accessory eligibility.
- Text, images, or answers suggesting a hazardous battery, hazardous item, or prohibited product.
- Suspected stolen-item indicators, duplicate device identifiers, or other identifier inconsistency.
- Repeated duplicate or manipulative listings.
- Apparent public exposure of phone numbers, exact addresses, full device identifiers, financial details, or other sensitive information.
- Bundle contents that fail or ambiguously cross the allowed category-family rules.
- An account restriction, relevant prior support finding, or risk state requiring review before publication.
- A failed or ambiguous ownership-declaration, unknown-brand/model, photo, or other required-evidence check.

A deterministically ineligible item or listing is rejected from normal publication with an appropriate reason and safe guidance. An ambiguous case is held for human review rather than automatically treated as a violation.

## Consequences

- Listing lifecycle needs draft, validating, held for review, published, removed, rejected, expired, and other transactional states without conflating them.
- Validation outcomes and review triggers must be deterministic, explainable, versioned, and auditable.
- A hold is not an accusation or public sanction; the seller needs clear status and next steps without receiving details that enable control evasion.
- Human approval or rejection must record reviewer, reason, evidence, and timestamp.
- Post-publication removal must preserve the listing snapshot and affected transaction history under retention policy.
- Safety-critical deterministic exclusions, such as a seller-declared hazardous battery, may be rejected from normal publication rather than routed through ordinary marketplace review.
- Sellers need a correction and resubmission path when the issue can be remedied without support appeal.
- Formal appeal rules for disputed review decisions remain unresolved.

## Read-only evaluation implementation record (2026-10-22 PHT)

Owner-private saved laptop review now returns a versioned, read-only evaluation of
an exact revision. Implemented accepted checks cover saved fields, laptop diagnostics,
fulfillment, structured safety/lock disclosures, declaration presence and current
account prerequisites/publication restrictions. The evidence-rule evaluator requires
two distinct qualifying actual-item photos and applicable Unknown identity evidence.
Current synthetic uploads cannot meet those rules. Unavailable checks never pass.

There is no runtime risk/evidence assessment provider: this ADR's trigger categories
do not specify executable sensitive-text, fraud, image or support-history detectors.
Their rules, authorized assessment and provenance remain pending, documented in
[evaluation scope and decisions](../LAPTOP_PUBLICATION_EVALUATION.md). Synthetic
assessment fixtures exercise all-pass and held-review routing without asserting
real evidence or accepting detector thresholds. Private review details are omitted.

This implements existing accepted semantics, not a new policy decision. It makes
no lifecycle transition, public reader, hold queue, audit/outbox/notification write
or launch grant. A future publication command must recheck state and fulfill its
own atomic authorization, evidence, audit and notification contract. ADR-078 already
supersedes the historical unresolved appeal statement above; no appeal flow changes.

## Submission-gate implementation supplement (2026-10-22 PHT)

The owner explicitly
confirmed keeping dependent submission behavior gated. The mounted exact-current-
revision recheck always returns paused and creates no lifecycle/declaration/review/
notification/job effects. Shared public facts now allowlist nested diagnostic keys.
This changes no accepted publication or review semantics and accepts no missing
declaration, assessment, geography, retention or job contract. See
[the scope and verification record](../LAPTOP_SUBMISSION_GATES.md).

## Source

- ADR-017: Exclude Standalone and Hazardous Battery Items
- ADR-019: Require a Seller Ownership Declaration for Every Listing
- ADR-038: Require at Least Two Photos of the Actual Item
- ADR-039: Permit Unknown Brand or Model With Identifying Evidence
- ADR-046: Staff the Pilot With a Designated Human Operator
- Project interview decision made on 2026-10-11
