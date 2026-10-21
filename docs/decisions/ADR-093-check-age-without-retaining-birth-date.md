# ADR-093: Check Age Once Without Retaining Birth Date

- Status: Accepted
- Date: 2026-10-21 PHT
- Owner approval: Birthday use is “age check only”; “Yes: check once, then discard the birthday.”
- Supersedes: DOB retention and repeated DOB-based eligibility checks in ADR-042/087 and older account documentation. Other signup, attestation, enforcement and launch rules remain binding.

## Decision

Signup still requires a valid self-declared birth date and the separate, unchecked
`adult-eligibility-en-v1` attestation. The server checks age 18 or older against
the current Philippine calendar date before any signup writes. Invalid, future
or underage dates do not create an account. This remains self-declaration, not
identity or government-ID age verification.

Discard the submitted birth date after the check, on success as well as rejection.
Do not store it in account, authentication, revision, audit, job, email, logging,
analytics or browser storage. Request/form memory is transient; clear the submitted
date field after a completed submission attempt. Keep only the passed-check time
(`adultEligibilityCheckedAt`) and the existing adult-attestation version/time,
atomically with the rest of signup. Never accept a client-supplied check result/time.

Account prerequisite readers and email-change issue/consume/delivery guards use
the stored successful check and non-future attestation instead of recalculating
age from a birth date. Missing, invalid or future evidence fails closed. Ordinary
sign-in, account security, scoped restrictions, suspension and later-discovered
underage treatment retain their existing rules. The check is not a general
marketplace permission.

Keep the minimal eligibility result and attestation while the account is active;
erase on eligible deletion unless a documented scoped exception applies under
PROJECT.md §28.4. Do not add a new consent record or inherit the abandoned proposal
for ongoing DOB processing/withdrawal. The ground and disclosures for transient
age checking and retained eligibility evidence still need privacy review. This
decision does not establish legal compliance or approve final documents.

## Existing local synthetic records

Add a forward migration; do not edit historical migrations. Derive a passed check
at the original attestation time only where existing finite DOB and the accepted
attestation version establish adulthood on that original PHT date, with no future
attestation. Missing/inconsistent evidence stays ineligible; do not grant eligibility
merely because a person has since turned 18. Then drop the DOB column for every row.
This bounded migration concerns the authorized local synthetic installation only;
it is not evidence of provider/backup deletion and is not applied to persistent
or shared databases without the existing reviewed migration workflow.

## Related owner facts and remaining gates

JCA is an informal, unregistered team/brand. The team jointly decides data uses.
A team member will take responsibility as Privacy Lead; no public personal name
has been supplied. `support@halaga.ph` is still being set up and no physical mailing
address has been supplied. A registered operator is not inferred from the brand;
responsible operator disclosure, address, operational privacy handling and final
Terms/Notice approval remain unresolved. ADR-092 capture remains conditional.

Real data, public registration, provider sends, hosting and all ADR-081 readiness
gates remain closed. Required paired Cebuano/Bisaya and human review remain gates.
