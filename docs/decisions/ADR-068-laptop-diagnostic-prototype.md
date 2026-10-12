# ADR-068: Accept the English Laptop Diagnostic Prototype

- Status: Accepted
- Date: 2026-10-11

## Context

The universal condition model requires simple observable facts and a derived label, but category-specific wording and testing guidance were deferred. Laptops were selected as the first reference category in ADR-067.

Laptop diagnostics must distinguish ordinary missing or failed battery operation from a suspected hazardous battery, separate power response from display and startup behavior, state which checks are required or optional, and keep device locks separate from factual condition.

## Decision

Adopt `docs/design/LAPTOP_DIAGNOSTICS.md` as the first English-language category diagnostic prototype.

The prototype:

- Stops testing and invokes the existing rejection/hold safety path for suspected hazardous batteries.
- Uses publication-required disclosures, condition-required applicable checks, optional enhanced checks, and a conditional battery check.
- Treats power response, built-in display, and startup behavior as separate facts.
- Requires conclusive passing answers for applicable power, display, startup, keyboard, pointing-device, and external-power checks before deriving `Fully functional`.
- Evaluates conclusive evidence that no intended computing function is performed before falling back to `Untested/unknown` for generally insufficient testing.
- Allows optional Wi-Fi, audio, camera, and USB checks to remain untested without preventing `Fully functional`; a disclosed tested defect derives `Functional with issues` when the laptop otherwise performs a function.
- Treats an expected failed or absent battery as a prominent issue rather than evidence that the whole laptop is not functional.
- Permits `Fully functional` when battery operation is genuinely not applicable to the configuration and every other applicable requirement passes.
- Keeps lock/management status separate from condition, while allowing untestable functions caused by a lock to produce `Untested/unknown`.
- Shows the derived label, contributing facts, separate battery and lock disclosures, and answer-correction links before publication.

## Consequences

- Laptop condition is deterministic from stored structured answers rather than a seller-selected judgment.
- Safety routing is evaluated before ordinary condition derivation.
- The diagnostic schema needs versioned questions, answer choices, applicability, derivation roles, help text, and safety actions.
- Listing revisions must preserve the diagnostic schema version and submitted answers used for each derived condition.
- Optional checks can improve buyer evidence without making non-technical sellers perform advanced testing.
- English wording requires moderated usability testing before being treated as pilot-ready.
- The required Cebuano/Bisaya translation requires human review, especially for battery and electrical safety language.
- Other supported categories remain deferred until their own question sets are accepted.

## Source

- `PROJECT.md` sections 11, 12, 17, and 29
- ADR-017, ADR-018, ADR-061, and ADR-067
- Architecture interview decision made on 2026-10-11
