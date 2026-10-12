# ADR-067: Use Laptops as the Reference Thin Slice

- Status: Accepted
- Date: 2026-10-11

## Context

The MVP supports several electronics categories, but architecture and interaction assumptions should be validated through one complete path before every category-specific flow is implemented. The reference category needs enough complexity to exercise the universal condition model, safety disclosures, evidence, private offers, reservation, inspection, final-price confirmation, notifications, and audit history.

Laptops exercise power behavior, display, input devices, battery condition, charger inclusion, storage and memory facts, firmware or organization locks, missing components, cosmetic evidence, and unknown-brand/model handling. They provide meaningful complexity without making optional cellular identifiers such as IMEI central to the first slice.

## Decision

Laptops are the reference category for:

- The first category-specific diagnostic-question prototype
- The first moderated seller usability test
- The initial mobile-first listing wireframe validation
- The first thin end-to-end implementation slice

The thin slice covers:

```text
Create and publish laptop listing
  -> buyer inquiry and private proposal
  -> seller accepts proposal
  -> parties agree appointment
  -> each party submits matching completion confirmation
  -> transaction becomes mutually confirmed completed
```

This is an implementation and validation sequence. It does not remove, defer beyond pilot readiness, or change the eligibility of any category approved in `PROJECT.md`.

## Consequences

- The first vertical slice tests representative condition, privacy, transaction, scheduling, notification, and audit requirements.
- Laptop diagnostic wording and safe-testing guidance must be accepted before the listing portion of the slice is considered specified.
- The domain model and APIs must remain category-extensible and may not hard-code laptop-specific fields into general listing, revision, or condition state.
- Each remaining supported category requires an accepted diagnostic schema and usability validation before pilot launch.
- Smartphone-specific IMEI behavior remains required for the MVP but is not the central identifier flow in the first thin slice.

## Source

- `PROJECT.md` sections 9, 11, 12, 29, and 33
- Architecture interview decision made on 2026-10-11
