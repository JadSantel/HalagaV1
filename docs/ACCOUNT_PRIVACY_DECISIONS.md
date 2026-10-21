# Account privacy processing decisions for owner review

- Prepared: 2026-10-21 PHT
- Status: Processing grounds remain proposed; ADR-093 age-data minimization accepted
- Scope: account/signup and current private laptop drafts, not full pilot readiness

## Owner responses received (2026-10-21 PHT)

- Latest team/brand supplied: “JCA”, superseding “Halaga business team”. The owner
  requests that individual names not be specified. Do not invent a legal entity
  or imply that the responsible legal operator has been established. JCA is an
  informal, unregistered team/brand; the team jointly decides data uses.
- Contact supplied: `support@halaga.ph`, confirmed for both support and privacy.
  The inbox is still being set up. A team member will serve as Privacy Lead;
  monitoring and confidential handling must still be put in place. No public
  individual name is supplied or invented.
- Latest age-data approval: “age check only”; check once, discard the birthday,
  retain only passed-check time and the existing adult-attestation version/time.
  [ADR-093](decisions/ADR-093-check-age-without-retaining-birth-date.md) supersedes
  the earlier choice to retain DOB and its consent/withdrawal proposal below.
  No processing ground, final wording or new consent has been approved.
- No correspondence address, effective date or final document approval was supplied.

## Purpose

Resolve the remaining policy questions with a concrete proposal before changing
registration or labeling the documents effective. ADR-093 changes retained DOB
to transient signup checking; the separate adult-attestation requirement remains.
ADR-092 already accepts the separate Terms agreement and minimal record retention;
it does not establish the basis for processing every account field.

## Operator and contact facts needed

The responsible person/entity, correspondence address, support contact, privacy
contact and person handling requests must be real and supplied by the owner.
The brand name alone is not a substitute for the responsible operator. A shared
support/privacy mailbox is possible only if it is monitored and requests are
handled with appropriate confidentiality. No mailbox or identity is inferred.

## Proposed processing map

These are proposed purposes and candidate grounds, not a legal-compliance finding.
The responsible operator must confirm necessity, proportionality and the applicable
ground before real use. A purpose-specific consent cannot authorize unrelated use.

| Data / processing | Bounded purpose | Proposed ground or remaining review |
| --- | --- | --- |
| Display name, email, credential hash and essential account operations | Create and maintain the requested account, prove address control and maintain credentials | Necessary account-service processing, subject to review under DPA §12(b). Public display of the chosen name must be explained separately from private email. |
| Transient DOB check and retained passed-check/adult-attestation evidence | Check self-declared age once at signup; maintain minimal adult-eligibility evidence under PROJECT.md §8/ADR-093 | Processing grounds/disclosures remain under review. The earlier ongoing full-DOB consent/withdrawal proposal is superseded; discarding DOB does not itself settle the basis for its transient use or retained age evidence. |
| Session/cookie, endpoint/IP abuse controls and minimal security records | Maintain authentication and protect accounts against abuse | Service necessity where applicable; any reliance on legitimate interest needs its own documented necessity/balancing assessment under §12(f). Do not apply an ordinary-data ground to sensitive age data. |
| Owner-private draft contents and revision history | Save/resume the owner's requested draft and preserve applicable history | Requested service processing, subject to minimization and the relevant retention review. No public exposure or unrelated reuse. |
| Terms version, notice version presented and agreement time | Evidence the separately agreed account terms and notice presentation | ADR-092 purpose/retention applies. The processing ground must be documented without claiming that accepting Terms grants general data consent. |
| Case/evidence, verification, enforcement, provider/transfer or later marketplace data | Their separate documented workflows | Outside this bounded approval. Do not invent a single blanket ground covering all future data. |

## Historical retained-DOB proposal — superseded by ADR-093

The following proposal is preserved as review history only. It is not the current
signup design and must not be implemented as an approved consent/withdrawal flow.
The owner instead approved transient checking and discarding the birth date.

Keep the existing private DOB and separate adult attestation for this proposal.
Before collecting/submitting DOB, explain the adults-only purpose, why full DOB
is needed, the retention rule and the withdrawal route. Add an initially unchecked
purpose-specific choice separate from Terms agreement and adult attestation.

Proposed English wording, not yet accepted:

> I consent to Halaga using my date of birth and adult-eligibility declaration
> to check and maintain my eligibility for its adults-only marketplace. I can
> withdraw this consent in account privacy controls and contact the privacy
> contact shown in the Privacy Notice for help.

This wording is usable only after the operator confirms the need for full DOB
and the complete notice/withdrawal details. A checkbox alone does not establish
that collection is necessary or consent is valid. If a less intrusive design is
chosen instead, record a new decision before replacing the existing DOB policy.

Suggested refusal/withdrawal behavior for review:

- Without the specific age-processing consent, do not submit or create a new
  DOB-based account. Public browsing remains available when that marketplace
  surface is implemented; do not promise a current public listing reader.
- Provide a no-fee withdrawal control in the same account interface, with clear
  consequences before confirmation. Make it as easy to withdraw as to consent.
  The named privacy contact is a help/alternative route with proportionate identity
  checks, rather than a forced switch from online consent to an email-only process.
  Before real use, verify the operational process; an email link alone is insufficient.
- After verified withdrawal, stop consent-based DOB processing and remove DOB
  unless another independently applicable, previously disclosed ground requires
  narrowly scoped retention. Do not retain DOB merely because a different
  marketplace workflow remains unresolved.
- Restrict new marketplace activity while age eligibility cannot be established.
  Preserve sign-in, security, privacy/appeal access and permitted existing-workflow
  resolution. Do not silently cancel transactions, erase unrelated history or
  treat withdrawal as evidence of wrongdoing.
- Offer eligible account deletion separately. An account-deletion blocker must
  not be used as a blanket reason to refuse stopping consent-only processing.

Record consent wording/version/time separately from Terms agreement. The minimal
consent-evidence retention, withdrawal evidence, precise execution/identity-check
procedure and any independent retention ground must be settled before this
proposal becomes effective. Do not silently reuse the agreement-record retention
decision for a different purpose.

## Decisions still to make

1. Resolve responsible operator/address disclosures and operational monitoring/
   confidential handling for the planned Privacy Lead and unfinished shared
   mailbox `support@halaga.ph`. Respect
   the owner's preference to omit individual names from the review drafts.
2. Review processing grounds and disclosures for ADR-093's transient birth-date
   check and minimal retained eligibility evidence. Do not implement the historical
   retained-DOB consent/withdrawal proposal. Owner preference does not by itself
   certify a lawful basis.
3. Review and accept the bounded processing map, outstanding retention items and
   the operational privacy-request/withdrawal process before real data.
4. Review the resulting final text and assign effective document versions/date.
   Only then implement the conditional ADR-092 capture with atomic signup and
   rejection/rollback/privacy checks. No draft is automatically promoted.

## Research supporting the review

- [DPA §§3, 12 and 13](https://privacy.gov.ph/data-privacy-act/): distinguish age
  data from ordinary account fields and review the applicable processing ground.
- [NPC right-to-be-informed guidance](https://privacy.gov.ph/the-right-to-be-informed/):
  finalize operator/contact, purposes, grounds, recipients and retention disclosures.
- [NPC Circular 2023-04](https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf):
  review specific consent, necessity and withdrawal rather than bundling unrelated
  permission into account terms.

This document records a review proposal. It authorizes no real participant data,
deployment, new staff access, paid provider or schema/registration change.
