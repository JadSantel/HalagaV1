# ADR-065: Bound Case Evidence Formats and Preserve Private Originals

- Status: Accepted
- Date: 2026-10-11

## Context

No-show, material-misrepresentation, and safety cases need enough evidence for fair human review. Unbounded media uploads would increase storage, security, privacy, accessibility, and moderation burdens during the pilot. Users also should not need to screenshot or re-upload records Halaga already controls.

Evidence originals may contain useful context and metadata, but those same files can contain precise location, device, identity, or malicious content. The evidence system therefore needs separate original, processing, preview, and notification paths.

## Decision

### Participant submissions

Every participant evidence submission requires a structured written statement. Each participant may attach to a case:

- Up to 10 images, each no larger than 10 MB
- Up to three PDF documents, each no larger than 15 MB
- Supplemental external links

Video, audio, archive, and executable uploads are not accepted during the MVP. External links are not authoritative evidence because their contents can change or disappear.

### Platform records

Relevant Halaga-controlled records are attached internally when authorized, including applicable listing revisions, messages, proposals, reservations, appointments, completion confirmations, notifications, and audit events. Participants are not asked to re-upload those records.

The internal attachment records the exact source record or immutable snapshot used in the case so later state changes do not silently change the reviewed evidence.

### Processing and access

- Originals are stored privately and are never served from a public bucket or public URL.
- Each original receives an integrity hash and immutable evidence metadata.
- Files are malware-checked before they become available to ordinary case viewers.
- Unsafe, unsupported, or unprocessable uploads are quarantined and clearly reported to the submitting participant and authorized operator.
- Ordinary image previews use generated metadata-stripped derivatives.
- Access to originals and derivatives is authorization-checked, purpose-limited, and audited.
- Notifications link to the authorized case view and do not embed original evidence.
- If a notification surface is later authorized to display an evidence preview, it may use only a safe derivative and must still enforce recipient authorization.

## Consequences

- The MVP can accept common photos, screenshots, receipts, permits, and written documents without taking on video moderation or arbitrary file handling.
- The evidence model must distinguish participant statement, uploaded original, derived preview, supplemental link, internally attached platform record, scan state, quarantine state, and access audit.
- Object storage must support private objects, controlled retrieval, retention enforcement, and deletion.
- Upload validation must enforce both per-participant counts and per-file byte limits on the server.
- Client-side validation may improve feedback but is not authoritative.
- Preserving private originals supports integrity review, while metadata-stripped previews reduce ordinary disclosure risk.
- Storage and bandwidth forecasts must include the worst-case evidence allowance when the operating budget is selected.

## Source

- `PROJECT.md` sections 22, 23, 25, and 28
- Architecture interview decision made on 2026-10-11
