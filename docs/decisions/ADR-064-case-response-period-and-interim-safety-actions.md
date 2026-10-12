# ADR-064: Define Case Response Period and Interim Safety Actions

- Status: Accepted
- Date: 2026-10-11

## Context

No-show and material-misrepresentation findings may lead to warnings, restrictions, or suspension. Automatic reservation expiry and a reporter's allegation are not sufficient by themselves to establish fault. The accused participant needs a meaningful opportunity to respond, while urgent safety or marketplace risks may require containment before an ordinary response period ends.

The MVP operator also needs a deterministic deadline that follows Halaga's established Philippine business-day calendar.

## Decision

For no-show and material-misrepresentation cases:

- The accused participant has three business days from case notice to respond.
- Business days are Monday through Saturday in Philippine Time. Sunday does not advance the response period.
- The participant may obtain one extension of two business days by requesting it before the original deadline.
- The timely extension is granted once without requiring a finding on the merits.
- A second extension and a request made after the original deadline are not available through the ordinary self-service rule.
- Failure to respond is not an admission and does not create an automatic adverse finding.
- After the applicable response deadline, support may decide the case using the platform records and evidence then available.
- Support may apply a temporary restriction before the response deadline when reasonably necessary to contain an urgent safety or marketplace risk.
- A temporary restriction must be scoped to the identified risk, record its reason and author, be auditable, and remain distinct from the final case finding.

Case notice and deadline calculations are recorded as exact timestamps. User-facing dates and times are displayed in PHT, and business-day calculation uses the Monday-through-Saturday calendar established for the MVP.

## Consequences

- Accused participants receive a predictable response opportunity and limited scheduling flexibility.
- Silence may affect the evidence available to the operator but is not treated as proof.
- The operator need not leave an urgent risk active solely to wait for the ordinary response deadline.
- The case model must store notice time, original response deadline, extension request and grant, extended deadline, responses, temporary restrictions, and the final finding separately.
- Notification delivery attempts and in-app notice availability must be auditable because they establish the response period.
- Evidence formats, case remedies, and appeal procedures remain deferred.

## Source

- `PROJECT.md` sections 21 through 23 and 27
- Architecture interview decision made on 2026-10-11
