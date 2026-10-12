# ADR-066: Define Case Findings, Remedies, and Appeals

- Status: Accepted
- Date: 2026-10-11

## Context

No-show and material-misrepresentation cases need consistent outcomes, bounded platform remedies, and a practical way to correct material mistakes. Halaga does not process payments and is not a court, ownership registry, or adjudicator of legal damages. Its findings and actions must therefore stay within marketplace operations.

The MVP may have only one authorized operator available at times. Requiring a different reviewer in every case would make an appeal unavailable precisely when correction is most needed, but an unstructured same-person review would not provide meaningful reconsideration.

## Decision

### Findings

A no-show or material-misrepresentation case ends with one platform finding:

- `Substantiated`
- `Unsubstantiated`
- `Inconclusive`

The finding records reasons and the evidence relied upon. `Inconclusive` is not treated as substantiation merely because the accused participant did not respond.

### Remedies and actions

Actions must be reasoned and proportionate to the finding, risk, intent where relevant, cooperation, repetition, and account history. Halaga may:

- Correct transaction status where policy and evidence permit
- Remove a listing
- Issue a warning
- Restrict marketplace privileges
- Suspend an account

Halaga does not issue or guarantee a refund, reverse external payment, determine legal ownership, award damages, or determine legal liability.

### Appeals

- Each affected participant may file one internal appeal per case.
- The appeal must be filed within seven calendar days after decision notice.
- It must identify new evidence, a material factual error, misapplication of platform policy, or a material procedural failure.
- Halaga acknowledges the appeal within two business days.
- Halaga targets an appeal decision within five business days.
- A different authorized operator reviews the appeal when one is available.
- If no different authorized operator is available, the original operator performs a separately logged reconsideration that addresses each appeal ground.
- Existing safety restrictions remain effective during appeal unless an authorized operator explicitly modifies them.
- There is no second internal appeal during the MVP.

Business-day calculations use Monday through Saturday in Philippine Time.

## Consequences

- Case outcomes have a controlled vocabulary suitable for consistent operations and analytics.
- An inconclusive record remains distinguishable from both substantiation and exoneration.
- Enforcement actions remain separate records from the underlying finding and require their own reason, scope, actor, and timestamp.
- The case model must record decision notice, appeal eligibility, appeal filer, grounds, evidence, acknowledgement, reviewer, reconsideration, decision, and any changed actions.
- The authorization model must distinguish case decision and appeal-review capabilities even when one person temporarily holds both roles.
- Operator dashboards need queues for appeals approaching acknowledgement and decision targets.
- Appeal targets are service objectives, not guarantees of a final decision by those times.
- Moderation and professional-verification appeals were subsequently defined by ADR-078 using the same bounded process.

## Source

- `PROJECT.md` sections 22, 23, and 27
- Architecture interview decision made on 2026-10-11
