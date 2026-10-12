# ADR-055: Use Authoritative English With Selective Cebuano/Bisaya Support

- Status: Accepted
- Date: 2026-10-11

## Context

The MVP launches in Cagayan de Oro City, where Cebuano/Bisaya guidance may improve comprehension for household users. Full localization of every interface, policy, operational tool, and communication would materially expand writing, review, consistency, and maintenance work during the pilot.

## Decision

English is the authoritative language for:

- The full responsive web interface.
- Policies and terms.
- Privacy content.
- Moderation rules.
- Support procedures.
- Operational and staff-facing content.

Cebuano/Bisaya translations will be provided selectively for agreed high-impact user guidance and core marketplace flows where they improve comprehension for Cagayan de Oro users. When a translation conflicts or becomes outdated, the English text controls and the discrepancy must be corrected.

Required Cebuano/Bisaya coverage consists of paired English-and-Cebuano content for:

- Listing diagnostics and condition questions.
- Battery and hazardous-item safety warnings.
- Offer, counteroffer, reservation, and expiry states.
- Pickup or meetup coordination and safety guidance.
- Completion and final-price confirmation.
- Cancellation and rescheduling.
- Reporting, no-show, and dispute flows.
- Critical transactional emails corresponding to those events.

The English source is displayed or otherwise available with the paired translation and remains authoritative.

Full Filipino localization is outside MVP scope.

User-generated listing descriptions and private messages may use languages chosen by users, subject to content and moderation rules. The platform does not promise automatic translation in the MVP.

## Consequences

- English content must be complete; selective Cebuano support cannot be used to leave gaps in the authoritative experience.
- Translated strings need source linkage, review ownership, versioning, and a fallback to English.
- Legal and policy screens must clearly identify English as authoritative if translated summaries are shown.
- Search and moderation should expect Cebuano, English, and mixed-language user content even without a fully localized interface.
- Machine translation is not an MVP requirement and must not be presented as authoritative policy or evidence.
- General browsing, non-critical account settings, business verification, and staff tooling may remain English-only during the MVP unless required content overlaps the list above.

## Source

- ADR-013: Launch the MVP in Cagayan de Oro City
- ADR-030: Deliver the MVP as a Responsive Web Application
- Project interview decision made on 2026-10-11
