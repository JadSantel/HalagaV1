# Read-only laptop publication evaluation

Implementation boundary: 2026-10-22 PHT. Synthetic data only.

The owner-private saved-revision review evaluates revision N without publishing,
holding, rejecting, submitting for review, or generating a notification. The
implementation identifier is `laptop-publication-evaluation-v1`; it versions this
evaluation, not a newly accepted risk-detection policy. Existing PROJECT rules and
accepted ADRs remain authoritative.

## Authority and scope

Inspected root/application AGENTS.md, the initially clean working tree, current
schema, draft/photo repositories, routes, tests and package scripts before editing.
Relevant sources: PROJECT §§8–15/26/28–29/33–34; architecture §§3/4.1/5/6/8.2;
design §§5.3–5.4/9; glossary; ADRs 017/019/038/039/058/061/068/084/090/093/095
and proposed ADR-094. Installed Next client-boundary documentation was read.

ADR-090 supersedes design.md's historical open decisions about renewals, underage
handling, appointment reminders and unsupported-category handling; none is
implemented here. ADR-095 supersedes older media-unavailable statements for private
synthetic processing only. ADR-094 remains proposed: no registry is implemented.

Affected flow: stored-session authentication, undeleted owner mapping and locked
owner/listing, then read exact immutable revision and derive its evaluation. The
only listing state remains `DRAFT`. Historical reviews use historical content and
photo membership, with current account prerequisites and restrictions. A later
save cannot substitute newer content. Reads do not renew draft retention.

The existing owner-only no-store API supplies fixed evaluation messages. Private
expectation remains separate from proposed public content. No assessment record,
matched text, device identifier, restriction reason, staff identity, appeal route,
or private finding is serialized. Private risk triggers collapse to one generic
review requirement. No new public/staff reader, storage, logging, worker, network
service, migration or notification path is introduced. Page HTML/metadata remain
content-free shells. This evaluation is not a future publication authorization:
that command must independently recheck live state and commit its required audit
and outbox records atomically.

## Outcomes and accepted checks

Every check reports `pass`, `missing`, `ineligible`, `review` or `unavailable`.
The summary precedence is deterministic exclusion, review requirement, missing
requirements, unavailable checks, then eligibility. All check results remain
visible, so precedence never erases other blockers. This presentation order is
not a lifecycle transition. `eligible` is true only if every check passes.

| Area | Implemented rule | Current owner-review boundary |
| --- | --- | --- |
| Required fields and diagnostics | Accepted laptop version, identity/description, disclosure choices, required explanations, contents consistency and fulfillment. Reuses accepted diagnostics, including optional tests and truthful unknowns. | Runs against saved answers. Unknown/failed battery operation is separate from hazardous safety. |
| Battery safety | Declared hazard is deterministically ineligible; uncertainty requires review; both stop testing. | No hold, rejection, operator request or ordinary condition is created. |
| Locks | Required structured status and explanations for disclosed known locks; inconsistent startup/lock answers require correction. | Disclosed locks alone neither fail eligibility nor alter condition. |
| Geography | Barangay is required and must pass controlled CDO validation. | Missing selection is reported; validation unavailable pending ADR-094 acceptance and implementation. Fictional practice geography never supplies a runtime pass. |
| Ownership | Declaration must exist for this revision and pass versioned seller/authorization validation. It never proves ownership. | Missing record reported. Capture/version recognition and evidence assessment remain unavailable. No new version or automated verification is invented. |
| Account | Existing passed-adult-check helper, live auth plus domain email verification, current active `PUBLISH_LISTING`/`SUSPENSION` decisions. | Runs under existing owner locks, exposes only fixed messages. Other action scopes do not prevent review. Review time is not restriction expiry. |
| Photos | At least two distinct revision-member photos with processing approval, available derivative, separate clear actual-item assessment. No synthetic/stock/catalog/screenshot counts. Ambiguity requires review. Visible-defect coverage must pass. | All current uploads are synthetic; actual-item/clarity/defect assessments are unavailable. Technical approval cannot establish identity or clarity. |
| Unknown brand/model | Explicit Unknown branches by markings: qualifying markings photo when present; multiple qualifying different angles when absent; sufficient observable descriptive facts in both cases. Supplements the general photo minimum. | Markings, angle and sufficiency assessment/capture are unavailable. No guessed identity or invented description-length threshold. |
| Accepted review triggers | Any assessed trigger requires review, never a confirmed violation. Missing/unavailable assessments block eligibility. | Detection policy/provider paths remain unavailable as below. |
| Readiness | Language/usability validation and operational readiness must pass separately. | Remains unavailable; no pilot/publication permission. |

`PublicationAssessments` is an internal, revision-ID-bound rule-testing seam, not
an HTTP input, persisted moderation decision, reviewer tool or runtime provider.
The mounted repository supplies no assessments. Synthetic tests fabricate complete
assessment facts to exercise the eligible branch and each evidence rule; they do
not submit synthetic images as actual-item evidence or establish a real eligible
listing. A mismatched revision ID, omitted check or unsupported assessment outcome
fails closed. Any future provider needs its own accepted rules, authorization,
provenance, current availability and revision binding before it can be connected.

## Decisions and implementation still required

ADR-058 accepts trigger categories, but does not specify executable detectors.
The following are recorded gaps, not accepted detector proposals or defaults:

| Check | Decision/evidence needed before a runtime pass is possible |
| --- | --- |
| Sensitive public text | Reviewed matching/assessment rules and a synthetic corpus for apparent phones, exact addresses, full device identifiers, financial details and other sensitive text, including negation and legitimate numbers. Cover all proposed public free text, including diagnostic notes and included-item descriptions; exclude private expectation and restricted evidence. Define false-positive handling without returning matched values or evasion details. No regex, score or threshold is accepted here. |
| Hazardous/prohibited content in text/images | Defined signals and safe assessment path distinguishing suspicion from confirmed violation. Structured safety answers alone cannot clear all content. |
| Stolen-item indicators and duplicate/inconsistent identifiers | Define internal evidence/consistency rules and purpose-limited access. No external blocklist in MVP (ADR-090); no automatic ownership verification. |
| Duplicate/manipulative listings | Define what constitutes a relevant duplicate/manipulation, comparison scope and assessment provenance. No similarity score or time window is invented. |
| Classification/accessories and bundle composition | Define ambiguity assessment for free-form contents; the saved slice remains one laptop. Other categories/bundles are unsupported by this evaluator, not thereby declared prohibited inventory. |
| Relevant prior support findings and ownership/identity evidence | Define relevant findings, authorization, current scope and safe response projection. Do not infer guilt or reuse unrelated private cases. Existing explicit publication restrictions are already checked separately. |
| Actual-item photo evidence and Unknown identity | Define authorized assessment/capture and provenance for identity, clarity, markings, multiple angles, descriptive sufficiency and intentionally omitted visible defects. Image processing is insufficient. Do not turn this into universal human preapproval by default. |

Registry acceptance, ownership declaration version/capture, human-reviewed paired
Cebuano/Bisaya, English usability, and ADR-081 operational readiness also remain
gates. These gaps pause only their dependent implementations. No implementation
or documentation in this slice marks them accepted or treats absence as clearance.

## Verification

Use existing `test:laptop-drafts`, `test:diagnostics`, `test:sign-in-app`, `lint`
and `build` scripts; inspect package.json before invocation. Database suites use
the existing dedicated loopback `halaga_signup_test` disposable-schema harness.
No persistent migration, real participant data or real email is needed.

The draft suite includes fictional complete eligibility; incomplete/unavailable
checks; unsupported schema/slice; two distinct qualifying photos; nonqualifying
and ambiguous evidence; both Unknown identity branches; hazard versus uncertainty;
accepted condition and disclosed-lock cases; every risk trigger, including a
sensitive-text assessment; safe output; live account checks; exact historical
revision review; owner isolation and unchanged lifecycle/outbox/notice counts.
These sensitive-text cases test routing and privacy, not an unimplemented text
detector.

Verification on 2026-10-22 PHT, from `app` unless noted:

| Command | Result |
| --- | --- |
| `npm.cmd run test:laptop-drafts` | 35 passed. Includes policy fixtures, live account/restriction guards, exact owner review, unchanged listing/history/outbox/notice counts and existing photo jobs/cleanup. Final run includes unavailable supplemental-photo assessments. |
| `npm.cmd run test:diagnostics` | 40 passed; accepted laptop schema and condition/safety behavior preserved. |
| `npm.cmd run test:sign-in-app` with existing installed-browser opt-in | 19 passed. Real Next API/page dispatch, private headers and empty metadata shells; browser review of all six condition/safety scenarios; unchanged Draft states. Existing draft/photo/account flows also passed. |
| Browser checks in that harness | Keyboard/focus, 1440/375/320px reflow and 200% text checks passed. Automated WCAG 2.2 AA-tagged checks reported no violations. Desktop/mobile review captures were inspected. Full manual screen-reader certification was not performed. |
| `npm.cmd exec tsc -- --noEmit` | Passed. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed; private review API remains dynamic. |
| Existing Impeccable `detect --json app/src/app/drafts/review.tsx` (root) | No findings (`[]`). |
| `git diff --check` (root) | Passed, with existing LF/CRLF conversion notices. |

Database launchers derive only the dedicated loopback test database URL from local
configuration without printing credentials. Harnesses replay migrations into
random disposable schemas and remove synthetic schemas/blobs in cleanup. No
persistent migration, real sending/data, external evidence check, scanner setup
or deployment occurred. Existing Node module-type and pg concurrent-query
deprecation warnings were non-fatal. No verification command failed.

Impeccable reported its legacy PRODUCT.md record lacks a current schema stamp;
that skill-specific context migration is unrelated and was left unchanged.
