# Account terms and privacy review

- Date: 2026-10-21 PHT
- Status: Review drafts; not approved for real registration
- Owner instruction: Draft from accepted project rules. Latest supplied team/brand:
  “JCA”, superseding the earlier “Halaga business team” description. The owner
  requests no individual names in the drafts. `support@halaga.ph` is confirmed
  for both support and privacy requests, but the inbox is still being set up.
  JCA is informal/unregistered; the team jointly decides data uses. A team member
  will take responsibility as Privacy Lead, with no individual public name supplied.
  No physical mailing address was supplied. Legal operator disclosure, address
  and operational privacy handling remain publication blockers.

Latest accepted age-data decision: [ADR-093](decisions/ADR-093-check-age-without-retaining-birth-date.md).
The owner confirmed “age check only” and approved checking DOB once then discarding
it. Signup stores only passed-check time and the existing adult-attestation
version/time. This supersedes the earlier retained-DOB consent/withdrawal proposal;
it does not approve a processing basis, final policy text or real-data use.

## Reviewable implementation

Open `/account/terms` and `/account/privacy` in the local app, using the links
above registration or in the account footer. The documents are available without
a session and do not read or write personal records. They retain the account
layout, private response headers, static metadata and noindex controls. Contents
links move keyboard focus to their headings. Both documents state draft status,
the absence of an effective date, the supplied JCA/shared-email details and the
remaining operator/address/privacy-responsibility gaps. No individual names are added.

The single text source is
[`policy-content.ts`](../app/src/app/account/policy-content.ts). Identifiers
`terms-en-draft-2026-10-21` and `privacy-en-draft-2026-10-21` identify review text
only; they are not accepted agreement or consent versions. The
[`policy-document.tsx`](../app/src/app/account/policy-document.tsx) renderer shares
the page structure. Signup collects only the existing adult attestation. Its
strict server payload rejects invented terms-acceptance fields.

No fictitious operator, address, mailbox, effective date, consent, liability cap,
arbitration clause, provider transfer or retention period was supplied. Accepted
product policy is summarized; planned marketplace and staff features are
identified separately from currently working account/private-draft functions.

## Source and conflict review

PROJECT.md remains authoritative. The drafts use §§5–9/11–15/17–24/26/28/33,
architecture §§3/5/6, the glossary, ADR-086/087/088/089 and later ADR-090/091.
Older design/account documents that describe restrictions and underage treatment
as undecided are superseded by ADR-090; older claims that password change or
notice readers are unmounted are superseded by their dated implementation
records. This work changes neither those decisions nor the launch gates.

External research informs the open review items, rather than establishing legal
compliance. The [Data Privacy Act, §§3/12/13](https://privacy.gov.ph/data-privacy-act/)
distinguishes ordinary and sensitive processing; age is sensitive personal
information. This makes the processing basis for private age/DOB data a specific
review item, not something the existing adult-eligibility statement silently
settles. The NPC's [right-to-be-informed guidance](https://privacy.gov.ph/the-right-to-be-informed/)
identifies the disclosures to finalize. Its [notice/consent guidance](https://privacy.gov.ph/wp-content/uploads/2022/01/AdOps_2019-034.pdf)
distinguishes informing a person from obtaining consent. This draft does not
choose a legal basis, assert compliance or waive rights.

## Decisions needed for approved content

The current processing review and historical age-consent/withdrawal proposal are in
[ACCOUNT_PRIVACY_DECISIONS.md](ACCOUNT_PRIVACY_DECISIONS.md). ADR-093 supersedes the
retained-DOB proposal; processing grounds remain unapproved.

| Item | Current state | Required next step |
| --- | --- | --- |
| Responsible operator | Informal, unregistered team/brand “JCA”; joint team decisions; no public individual names supplied | Do not infer that the brand is a legal entity. Responsible operator disclosure and physical correspondence address remain unresolved. |
| Support and privacy contact | `support@halaga.ph` still being set up; a team member will take the Privacy Lead role | Verify inbox monitoring, confidential handling and accountable operation before real requests. Planned responsibility is not operational readiness. |
| Processing grounds | ADR-093 accepts transient DOB checking and minimal passed-check/attestation evidence | Review the basis and disclosures for transient age checking and retained evidence, alongside the bounded processing map. No ongoing retained-DOB consent/withdrawal flow is authorized. |
| Terms agreement | ADR-092 accepted; implementation conditional | After final document approval, add the separate unchecked agreement and atomic server-owned versions/time. Erase the minimal record on eligible deletion unless a scoped exception applies. Notice viewing is not consent. |
| Final text and effective versions | Drafts prepared | Review the rendered wording, approve changes and assign effective versions/date only after dependencies are settled. |

Provider/hosting/recipient/transfer disclosures, remaining account/draft/restriction/
backup retention details, rights-request operations and verification of safeguards
also remain real-data readiness gates. They belong to the relevant operational,
deletion/retention and later marketplace slices; drafting this notice does not
implement them or add them as hidden Slice 2 account features.

The draft pages remain English review surfaces. Required paired Cebuano/Bisaya
for safety and critical transactional content, and human accessibility/usability
review, remain publication gates; no unreviewed translation is invented here.

## Scope of completion

Current local Slice 2 account functions and draft enforcement can be verified
independently. Final terms/privacy approval remains unfinished. The Slice 2
tracker must continue to distinguish implemented local behavior, pending policy
approval, future marketplace action guards and operational readiness. It must not
claim 100% completion merely because draft documents now exist.

Verification results are recorded in
[`SLICE_2_CLOSEOUT.md`](SLICE_2_CLOSEOUT.md). No deployment, real email, real
participant data, persistent database migration or new dependency is authorized
by this review.
