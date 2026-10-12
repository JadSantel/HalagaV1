# ADR-016: Define the MVP Device Categories

- Status: Accepted
- Date: 2026-10-05

## Context

The existing product concept spans small electronics, office equipment, components, televisions, appliances, and institutional equipment across multiple possible phases. The MVP needs an explicit listing boundary so that forms, taxonomy, search, moderation, buyer acquisition, and safety rules can be designed for a known inventory.

## Decision

The MVP supports these top-level listing categories:

1. Smartphones & Tablets
2. Laptops
3. Desktop Computers
4. Computer Components & Peripherals
5. Monitors
6. Printers & Scanners
7. Networking Devices
8. UPS & Small Backup Power
9. Accessories & Small Electronics

`Accessories & Small Electronics` includes these initial subtypes:

- Charger / Adapter
- Cable / Wire
- Headset / Earphones
- Keyboard / Mouse
- Webcam
- Laptop Dock
- USB Hub / Dongle
- Small Computer Speaker
- Replacement Laptop / Phone Accessory
- Accessory Bundle
- Other Supported Accessory

`Accessories & Small Electronics` is a constrained accessory category, not a catch-all electronics category. An item in this category must be an accessory or peripheral intended for use with at least one supported MVP device category. A standalone device outside the approved categories is not eligible merely because it is small.

Examples of products not accepted under this category at launch include:

- Cameras
- Game consoles
- Smartwatches
- Drones
- Vapes
- Medical devices
- Power tools
- Standalone consumer electronics without a supported parent category

Loose lithium batteries, damaged or swollen batteries, and similarly hazardous battery items are excluded from the MVP.

## Consequences

- The listing taxonomy must preserve a controlled top-level category and, where applicable, subtype rather than relying only on free text.
- Listing fields may vary by category, but every category must support the common condition and offer workflow.
- Search, filters, buyer preferences, moderation, and marketplace metrics should use stable category identifiers independent of display-label changes.
- Large appliances, televisions, air conditioners, refrigerators, washing machines, and unspecified institutional equipment are outside the launch taxonomy.
- Category expansion requires an explicit product decision because it may introduce new safety, logistics, and data requirements.
- Unsupported standalone products must be rejected or routed to a future category-request waitlist; the exact launch behavior remains unresolved.
- Standalone batteries and battery products, including power banks, are excluded under ADR-017.

## Source

- `product.md`, especially sections 10, 25, 27, 28, and 32
- Project interview decision made on 2026-10-05
