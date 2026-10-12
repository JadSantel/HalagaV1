# ADR-020: Make IMEI Entry Optional but Strongly Encouraged

- Status: Accepted
- Date: 2026-10-05

## Context

An IMEI can help identify a cellular device and may support theft reports, duplicate detection, or buyer verification. Some legitimate sellers cannot retrieve it because the device is broken, inaccessible, or unfamiliar to them. Requiring it would prevent those sellers from publishing.

An IMEI is also a persistent device identifier and should not be treated as ordinary public listing data.

## Decision

For smartphones and cellular-capable tablets in the MVP, IMEI entry is optional but strongly encouraged.

Omitting an IMEI does not by itself block listing publication. When supplied, it must be stored as sensitive device evidence rather than displayed as ordinary public listing content.

Before reservation, buyers may see only that an IMEI was provided. The platform will not display even a masked portion of the value.

After reservation, the platform will not reveal the IMEI automatically. The seller may explicitly choose to disclose the full IMEI to that reserved buyer so the buyer can perform checks before meetup. If the seller does not disclose it in advance, the buyer may ask to verify the device identifier during physical inspection.

Except for a seller-authorized disclosure to the reserved buyer, the stored IMEI is visible only to the seller and authorized platform staff with a legitimate operational need.

## Consequences

- The listing flow should explain how to locate an IMEI and why providing it may improve trust without implying that it proves ownership.
- The data model must support devices with no submitted IMEI and, where relevant, more than one IMEI.
- IMEI values require input normalization, encryption or equivalent protection, restricted access, redaction in logs, and a retention policy.
- Public listing pages and notifications must not expose a full IMEI.
- The public or pre-reservation trust signal must say only that an IMEI was provided and must not imply that the platform verified ownership, authenticity, or theft status.
- Seller-authorized disclosure must be an explicit, auditable action tied to the reserved transaction; ordinary message rendering must not reveal the stored value automatically.
- The product must not claim an item is theft-free merely because an IMEI was supplied.
- Whether the platform checks external blocklists remains unresolved.

## Source

- ADR-019: Require a Seller Ownership Declaration for Every Listing
- Project interview decision made on 2026-10-05
