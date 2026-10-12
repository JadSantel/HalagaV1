# ADR-057: Make Safety and Trust a Hard Pilot Continuation Gate

- Status: Accepted
- Date: 2026-10-11

## Context

The pilot's numerical thresholds measure exchange completion and competing-offer liquidity. Those outcomes do not establish that the marketplace operated safely or preserved user trust. Growth achieved while critical hazards, privacy failures, fraud, prohibited items, transaction corruption, or support breakdown remain unresolved is not a successful basis for expansion.

## Decision

The quantitative pilot thresholds are necessary but not sufficient for continuation.

The pilot may be considered meaningfully promising only when:

- It meets the primary numerical thresholds in ADR-029.
- It has no unresolved critical safety incident.
- It has no demonstrated systemic failure in privacy, fraud prevention, prohibited-item controls, transaction integrity, or urgent support operations.

If a critical incident or systemic trust failure exists, expansion or further investment is paused until:

- The issue is contained and remediated.
- Affected users and records are handled under the applicable policy.
- The failed controls are corrected.
- The affected controls are revalidated with documented evidence.

Meeting the numerical thresholds does not override this pause.

## Consequences

- Pilot reporting needs a safety-and-trust review in addition to KPI totals.
- Critical incidents, root cause, affected data or users, containment, remediation, and revalidation evidence need auditable records.
- Known severe issues cannot be reclassified as ordinary backlog solely to allow pilot continuation.
- Privacy exposure of exact addresses or IMEI values, repeated hazardous-listing bypass, widespread fraudulent offers, corrupted transaction state, or inability to perform urgent review are examples requiring critical or systemic assessment.
- The team must assign authority for severity classification, remediation acceptance, and revalidation before launch.
- Expansion remains paused when evidence is insufficient to conclude that the affected control works again.

## Source

- ADR-017: Exclude Standalone and Hazardous Battery Items
- ADR-020: Make IMEI Entry Optional but Strongly Encouraged
- ADR-022: Provide Human Dispute Review With Non-Monetary Platform Remedies
- ADR-029: Use an Eight-Week Pilot and 30 Completed Transactions as the Primary Threshold
- ADR-046: Staff the Pilot With a Designated Human Operator
- Project interview decision made on 2026-10-11
