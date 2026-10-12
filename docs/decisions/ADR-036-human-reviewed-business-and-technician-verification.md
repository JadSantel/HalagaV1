# ADR-036: Human-Review Business and Professional Technician Verification

- Status: Accepted
- Date: 2026-10-06

## Context

Verified electronics businesses and professional technicians participate alongside ordinary registered buyers. A verification badge can improve seller confidence, but overly rigid proof requirements would exclude small legitimate local operators, while vague or automated approval would make the badge misleading.

## Decision

Professional and business verification is manually reviewed by authorized platform staff. The review establishes that the applicant appears to be a real, operating electronics business or practicing technician based on the required and supporting evidence. It does not guarantee expertise, honesty, solvency, item valuation, or transaction outcome.

### Electronics Business Verification

An applicant must provide:

- Business name.
- Public-facing business address.
- At least one official supporting record, such as DTI or SEC registration, barangay or business permit, BIR registration, or another official business record accepted by policy.
- At least one public contact channel, such as a Facebook page, website, or business phone number.

Storefront or workshop photos may be submitted as optional supporting evidence.

### Professional Technician Verification

An applicant must provide:

- Real name and contact details, kept private from the public marketplace profile.
- Evidence of actual technical work, such as shop affiliation, a service page, portfolio or work samples, a training certificate, a TESDA-related credential where applicable, or comparable proof.

A verifiable professional reference or public business presence should also be supplied when available. Its absence does not automatically disqualify an applicant if other evidence is sufficient for human review.

### Public Presentation

Approved applicants receive the applicable `Verified Electronics Business` or `Verified Professional Technician` badge. An approved business may show its business name and public-facing business information. An approved technician may continue to use a chosen display name; their private real name and contact details are not made public merely because they are verified.

Verification badges do not expire on a periodic schedule during the MVP. They remain valid until a review-triggering event occurs, such as a material profile or evidence change, a credible report, evidence that the operation closed or changed identity, suspected fraudulent documentation, or a relevant policy violation. Authorized support may place the badge under review, request updated evidence, remove it, or restore it based on the review.

Verification documents are retained while the badge remains valid so the platform can support re-review, audit, and fraud investigation. When the badge is revoked or voluntarily withdrawn, or the account is closed, the documents remain for six months and are then deleted unless a documented case-specific retention exception applies.

## Consequences

- Verification applications need typed evidence, review status, reviewer, decision reason, timestamps, and an audit trail.
- Verification documents and private identities require restricted access, secure storage, redaction from logs, and a retention policy.
- Review guidance must allow equivalent evidence and document exceptions consistently so that small operators are not rejected solely for lacking a sophisticated web presence.
- Applicants need a way to correct incomplete submissions and appeal or reapply after rejection.
- Badge text and help content must state the badge's limited meaning.
- Material profile changes, fraudulent documents, closure of the operation, or policy violations can trigger badge removal or re-review.
- The system needs review-trigger reasons and badge states that distinguish verified, under review, rejected, and revoked.
- Raw verification evidence must not be retained indefinitely after the badge and account relationship ends.
- Retention jobs must track the badge or account termination event that starts the six-month clock.
- Review service levels and the precise evidence scoring guide remain unresolved.

## Source

- `product.md`, especially sections 20 and 21
- ADR-003: Allow Individuals and Verified Professionals to Submit Offers
- ADR-034: Show a Chosen Display Name on Public Listings
- Project interview decision made on 2026-10-06
