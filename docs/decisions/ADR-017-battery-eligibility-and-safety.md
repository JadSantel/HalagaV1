# ADR-017: Exclude Standalone and Hazardous Battery Items

- Status: Accepted
- Date: 2026-10-05

## Context

Several supported electronics contain integrated batteries, while some potential accessories are themselves battery products. Lithium batteries can introduce fire, chemical, handling, and storage risks, especially when damaged. A local pickup model reduces shipping risk but does not eliminate risks to users, meetup locations, or marketplace operations.

## Decision

Standalone batteries and standalone battery products, including power banks, are excluded from the MVP.

An integrated battery is permitted when it is part of an otherwise supported device, provided that the device does not have a known hazardous battery condition. The seller must disclose the battery's known condition during listing.

A device is not eligible for a normal marketplace transaction if its battery is known or observed to be:

- Swollen.
- Leaking.
- Punctured.
- Overheating.
- Otherwise hazardous.

## Consequences

- Power Bank must not appear as an allowed accessory subtype.
- The listing flow for supported battery-powered devices must ask for known battery condition and present clear unsafe-condition options.
- A seller who reports a hazardous battery condition must be prevented from publishing the item as a normal marketplace listing.
- Moderation and reporting must support removal of listings that show or describe hazardous batteries.
- Product guidance must not encourage users to transport, open, repair, compress, puncture, or otherwise handle a hazardous battery.
- A future safe-disposal referral flow may be considered, but guaranteed disposal and hazardous-item logistics are not MVP promises.
- The system cannot verify undisclosed physical battery conditions remotely; seller declarations and reports are safety inputs, not guarantees.

## Source

- `product.md`, especially sections 12, 13, 26, and 28
- ADR-016: Define the MVP Device Categories
- Project interview decision made on 2026-10-05
