# ADR-054: Target WCAG 2.2 Level AA for Core MVP Flows

- Status: Accepted
- Date: 2026-10-11

## Context

The MVP is a responsive web application used by household sellers, buyers, professionals, and support staff across phones and desktops. Accessibility affects the structure and behavior of forms, images, messaging, status changes, maps, deadlines, and transaction workflows and is expensive to retrofit after implementation.

## Decision

All core MVP flows will target WCAG 2.2 Level AA.

Core flows include:

- Public marketplace browsing, search, filtering, and listing detail.
- Account creation, email verification, sign-in, and account management.
- Listing creation, diagnostic questions, image upload, preview, publication, editing, renewal, and closure.
- Offers, counteroffers, comparison, withdrawal, reservation, and backup states.
- In-app messaging, notifications, appointment coordination, inspection outcome, and dual completion confirmation.
- Reporting, dispute submission, verification application, and evidence upload.
- Human operator review and moderation workflows.

## Consequences

- Keyboard access, visible focus, semantic structure, sufficient contrast, meaningful labels, accessible errors, status announcements, and non-color-only state cues are acceptance criteria.
- Item images need seller-provided or platform-supported alternative descriptions appropriate to the flow; decorative and evidence images must be handled deliberately.
- Maps cannot be the only way to understand barangay location or appointment details.
- Timed flows need clear deadlines and must follow accessibility requirements for time limits where user extension is applicable without overriding marketplace policy deadlines silently.
- Automated accessibility checks are necessary but do not replace manual keyboard, screen-reader, zoom, and responsive testing of core journeys.
- Third-party services and components must be evaluated for their effect on the target.

## Source

- ADR-030: Deliver the MVP as a Responsive Web Application
- Project interview decision made on 2026-10-11
