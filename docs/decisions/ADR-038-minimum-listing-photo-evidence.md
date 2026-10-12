# ADR-038: Require at Least Two Photos of the Actual Item

- Status: Accepted
- Date: 2026-10-06

## Context

Buyers form offers before physical inspection and need visual evidence of identity and visible condition. Requiring too many images would burden occasional household sellers, while allowing a listing with no image or only one ambiguous image would weaken valuation and increase disputes.

## Decision

A listing must include at least two clear photos of the actual item before publication.

Stock images, catalog images, or screenshots alone do not satisfy the requirement. Additional category-guided photos may be recommended, including relevant front, back, ports, labels, included accessories, and visible defects. A known visible defect must not be intentionally omitted merely because the two-photo minimum was met.

## Consequences

- Publication validation must require at least two successfully uploaded and processed item images.
- The mobile web flow must support camera capture, gallery upload, preview, reordering, replacement, and upload recovery.
- Listing guidance should help sellers avoid blurry, dark, distant, or duplicate views.
- Image processing must remove embedded location metadata and avoid exposing original filenames or private metadata publicly.
- Moderation and reporting must address unrelated, stolen, prohibited, personally identifying, or unsafe imagery.
- Maximum image count, file-size limits, supported formats, retention, and automated quality checks remain implementation decisions.

## Source

- `product.md`, especially sections 12, 14, 22, 30, and 40
- ADR-018: Derive Item Condition From Simple Diagnostic Questions
- ADR-023: Define Material Misrepresentation by Decision Impact
- Project interview decision made on 2026-10-06
