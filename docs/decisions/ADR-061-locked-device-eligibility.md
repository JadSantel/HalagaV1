# ADR-061: Permit Locked Devices With Prominent Structured Disclosure

- Status: Accepted
- Date: 2026-10-11

## Context

Supported devices may have activation locks, linked account locks, BIOS or firmware passwords, organization-management controls, or similar restrictions. Such devices may still have legitimate repair, parts, or salvage value, but an undisclosed lock can materially change usability and price and may indicate unauthorized ownership.

## Decision

A locked or managed device may be listed in the MVP when its status is accurately and prominently disclosed.

Where applicable, lock or management status is a required structured listing attribute and is visible to buyers before they submit an offer. The listing must identify the known lock type and what the seller knows about removal capability without claiming certainty they do not have.

The platform does not guarantee, provide, broker, or assist with lock removal or bypass.

A listing with suspicious ownership indicators, inconsistent device-identity evidence, or other elevated theft or fraud risk is held for pre-publication review or subject to enforcement under the moderation policy.

## Consequences

- Category-specific listing diagnostics need lock-status questions with an `Unknown` path where truthfully necessary.
- Lock status is material listing data; changing it after offers exist triggers ADR-040.
- Buyers must see the disclosed status in listing detail and offer context rather than only in free-form description.
- Undisclosed or inaccurately described lock status may constitute material misrepresentation under ADR-023.
- The platform must not publish instructions or tooling for bypassing security controls.
- A disclosed lock does not prove legitimate ownership; the ownership declaration and risk-review rules still apply.

## Source

- ADR-019: Require a Seller Ownership Declaration for Every Listing
- ADR-023: Define Material Misrepresentation by Decision Impact
- ADR-040: Pause Offers After Material Listing Edits
- ADR-058: Publish Valid Listings Immediately and Hold Flagged Listings for Review
- Project interview decision made on 2026-10-11
