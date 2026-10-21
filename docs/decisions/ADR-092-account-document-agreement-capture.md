# ADR-092: Account Document Agreement Capture

- Status: Accepted policy; implementation conditional on final document approval
- Date: 2026-10-21 PHT
- Owner approval: 2026-10-21 PHT, agreement flow and minimal record retention
- Authority: PROJECT.md §§8/26/28/33, ADR-087 and the owner's draft-document request

## Context

Registration has an approved, separate adult-eligibility attestation. Terms and
Privacy Notice text is now drafted, but the responsible operator and contact are
undecided. Existing decisions do not establish a terms-agreement mechanism,
agreement-record retention, a lawful basis for every data use, or blanket privacy
consent. Draft viewing must not manufacture these decisions.

## Decision

Once final documents are approved:

- Add a separate, initially unchecked required checkbox with the wording
  “I agree to the Terms of Use.” Link the named terms beside it. Preserve the
  separate approved adult attestation unchanged.
- Present the Privacy Notice before submission. A link or acknowledgment informs
  the participant; it does not grant general consent. Any purpose-specific
  consent determined necessary by privacy review must have its own approved
  wording, choice, withdrawal treatment and server checks.
- Require agreement on the server for new accounts. Resolve effective document
  versions on the server and atomically record the terms version, notice version
  presented and server timestamp with signup. Do not accept arbitrary client
  versions or manufacture agreement on duplicate signup.
- Keep these records account-private and outside public/session responses, email
  payloads and operational logs. Retain the minimal agreement record while the
  account is active, then erase it on eligible deletion unless a documented,
  scoped retention exception applies under PROJECT.md §28.4. Other account data
  and legal processing grounds remain separate review items. Transaction retention
  is not a blanket account-document retention period.
- Decide material-change notification and any renewed agreement requirement
  before subsequent effective versions replace an existing accepted version.

## Current implementation boundary

Only read-only review pages and links are implemented. No agreement/notice/consent
column, checkbox, route, accepted version, effective date or migration is added.
The strict signup payload still accepts only the existing approved fields.

This supplements ADR-087 with the owner's approved agreement policy. It does not
make the draft wording effective or authorize real participant data, email
delivery, staff access, publication or deployment. Dependent signup validation,
storage, UI and synthetic rollback/privacy checks must follow only after final
document approval. Material-change notification/re-agreement details, processing
grounds and any purpose-specific consent remain unresolved; no defaults are added.

## Related review

Later owner decisions are recorded in ADR-093 and supersede the retained-DOB and
unknown-team-status statements in the historical paragraph below: JCA is informal/
unregistered, the team jointly decides data uses, and a team member will serve as
Privacy Lead. The shared mailbox is still being set up and no physical address was
supplied. DOB will be checked once then discarded. Final documents, processing
grounds and operational privacy handling remain unresolved; agreement capture
is still conditional.

Latest owner follow-up (2026-10-21 PHT): team/brand “JCA” supersedes the earlier
“Halaga business team” description, with no individual names to be specified.
`support@halaga.ph` is confirmed for both support and privacy. A responsible
privacy handler is not yet assigned. Legal operator identity/address and
privacy-request responsibility remain open. The owner chose to retain private DOB and review a
specific consent/withdrawal design. This does not approve final documents or the
separate processing proposal, and does not activate agreement capture.

See [ACCOUNT_POLICY_REVIEW.md](../ACCOUNT_POLICY_REVIEW.md) for the reviewable text,
authoritative sources and remaining owner/operational inputs.
