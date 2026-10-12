# ADR-030: Deliver the MVP as a Responsive Web Application

- Status: Accepted
- Date: 2026-10-06

## Context

Primary sellers will often create listings and upload photos from phones, while buyers may browse from phones or computers. Building native Android and iOS applications would add parallel implementation, store release, update, and device-support work before the marketplace hypothesis is validated.

## Decision

The MVP will be delivered as a responsive web application only.

It must provide usable seller, buyer, messaging, scheduling, moderation, and support workflows on current mobile and desktop browsers. Native Android and iOS applications are outside MVP scope.

## Consequences

- The interface must be designed mobile-first for photo capture/upload, diagnostics, offer comparison, negotiation, appointment coordination, and confirmation.
- Desktop layouts must remain usable for professional buyers and support staff.
- Native-app-only capabilities cannot be assumed.
- Browser constraints around camera access, background behavior, uploads, and notifications must be handled explicitly.
- App-store distribution, native deep linking, and native mobile codebases are non-goals for the MVP.
- Whether the web application is installable as a PWA and which notification channels are required remain unresolved.

## Source

- `product.md`, especially sections 12, 18, 30, 31, and 40
- Project interview decision made on 2026-10-06
