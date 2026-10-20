# ADR-089: Password-Change Email and Retention

- Status: Accepted by explicit owner answers to all three policy questions
- Date: 2026-10-20 PHT
- Supplements: ADR-073, ADR-079, ADR-085, ADR-086, ADR-087, ADR-088

## Decision and authority

The owner approved the wording/seven-day window, retention rules, and deletion/
scope package in the 2026-10-20 decision interview. This resolves the corresponding
open decisions in the password-change email/retention brief, PROJECT sections
8.5/25/34, architecture sections 6/8.2 and ADR-087. It supersedes their statements
that these event-specific policies remain unaccepted. Historical implementation
records remain history, not evidence that this pipeline has been implemented.

ADR-087's trigger, commit-time verified-in-both-stores eligibility, immutable
addressing, atomic required writes, no backfill/retargeting and initiating-session
preservation remain binding. A later email switch alone cannot suppress the warning.

## Version-1 message and delivery

Subject: `Your Halaga password changed`

Exact text (three paragraphs):

```text
The password for your Halaga account changed on {eventTimePHT}.

At that time, other sessions were signed out. The session used for this change remained signed in.

If you did not expect this change, open Halaga directly and use the password reset option.
```

Render the event instant in `Asia/Manila` with fixed English month names and
24-hour time: `DD Mon YYYY, HH:mm:ss PHT (UTC+08:00)`. HTML uses the same three
escaped paragraphs in an English document. No links, tracking, images, additional
copy or stored rendered message. Addressing is transport-only; ADR-087 exclusions
continue to apply.

The delivery deadline is event time plus exactly seven times 24 hours. No send may
start at or after it. Reuse ADR-088's two-minute fenced leases, five-attempt bound,
explicit-429 backoff and UNKNOWN quarantine; recovery never extends the deadline.
This explicitly accepts bounded outage recovery and potentially delayed warnings.
It creates no retry endpoint and makes no exactly-once mailbox guarantee.

## Private data classification and ordinary retention

| Data/state | Accepted rule and purpose |
| --- | --- |
| READY/LEASED/SENDING recipient | Immutable verified commit-time address for delivery only, until the original seven-day deadline at the latest. No fallback addressing. |
| ACCEPTED/SUPPRESSED recipient | Erase atomically with the outcome. ACCEPTED means provider acceptance, not inbox delivery. |
| FAILED/UNKNOWN recipient | Retain for restricted reconciliation only until the original seven-day deadline, then erase. Never automatically resend UNKNOWN. No staff reader or controlled retry is authorized here. |
| Delivery metadata | Private, potentially account-linkable account/event/outbox/job IDs and channel work key support association/deduplication; type/version/event time/original deadline support interpretation and expiry; state, attempts, availability and lease fields support dispatch/fencing; fixed error codes, bounded provider message ID and outcome timestamps support reconciliation. Purge at the earlier of terminal outcome plus 30 days or event time plus 37 days. Purge outbox, delivery and email processed-work evidence together. Clear leases on terminal transition. No recipient, content, token, credential, request data or raw provider error is metadata. |
| In-app notice, eligibility and read state | Account association, event/work identity, type/version/time, fixed eligibility and nullable read time provide bounded owner security history for 90 days from the event; then delete together. Reading never restarts retention. Committed account deletion erases them sooner. Email outcome/purge alone does not erase the in-app notice. |

Boundaries use `now >= deadline` and elapsed durations, not business days or local
midnights. Cleanup uses the existing explicitly invoked worker, with no selected
cadence. An outage may delay physical cleanup; resumption applies original cutoffs
immediately, without new retention clocks or expired owner reads. No bounded
physical-erasure latency is promised before worker/hosting readiness passes.

Cleanup follows account-to-job lock order and fenced updates. At expiry,
READY/LEASED becomes SUPPRESSED and SENDING becomes UNKNOWN; FAILED/UNKNOWN retain
truthful outcomes but lose addressing. Late acknowledgements cannot recreate an
erased recipient or overwrite a fenced outcome. Recovery/cleanup is restart-safe;
purge dependent work only after it cannot send again. Never reconstruct email from
in-app eligibility or a current account address. Keep only ADR-085-safe cleanup
outcomes/counts, not permanent per-recipient erasure logs.

ADR-079 exceptions require minimum scope, documented purpose/authorizer and review
at least every 30 calendar days. Release applies original ordinary cutoffs without
a fresh period. Hold enforcement and audited staff tools remain real-data gates;
synthetic validation does not exercise real holds.

## Account deletion and external copies

A deletion request alone leaves the notice eligible while another workflow blocks
deletion. This email's queued, failed or ambiguous work does not itself block
eligible deletion. On committed deletion, atomically suppress READY/LEASED, erase
all password-change recipients and in-app records, and fence SENDING as UNKNOWN.
Retain only bounded reconciliation metadata above; deletion cannot restart its
clock. Other PROJECT section 28.3 blockers remain. Implementing the actual account
deletion workflow remains separate; synthetic checks must exercise its commit
boundary before real account use.

A request already handed to the provider cannot reliably be recalled and may
arrive after expiry/deletion. Do not promise recall, recreate addressing or blindly
resend. The designated owner/operator must verify provider recipient/content/
diagnostic copies, disabled tracking, backup expiry and restore behavior before
real data or sending. Record actual purge limits/procedures, not an instant external
erasure guarantee. Restores must reapply original retention/deletion cutoffs and
released exceptions before enabling reads/dispatch.

## Authorized implementation boundary

Later local integration authorization (2026-10-20 PHT): the owner's subsequent
explicit implementation request supersedes the unmounted-only restriction below
for protected POST `/api/auth/change-password` and the existing
`/account/change-password` form only. The guarded operation/plugin now serves these
local synthetic surfaces, with fixed safe responses after commit, exact initiating
session/cookie preservation and the existing atomic notice pipeline. Installed-library
direct credential-write compatibility and both protected HTTP sign-in race orders
are reviewed/tested. See `docs/PASSWORD_CHANGE_LOCAL_TESTING.md` for verification.
Notice readers, notification UI and staff tools remain unmounted; real sending,
participant data, provider/backup/hold/staff recovery and operational/ADR-081 gates
remain. This records mounting authorization and implementation, changing none of
this ADR's accepted delivery, deletion, retry or retention policy.

Record these rules and complete the previously requested unmounted synthetic
pipeline with a fake provider. No command/reader/UI mounting, real sending,
participant data, worker schedule, deployment, new provider/dependency or billing
is authorized. Provider/backup evidence, restore safeguards, hold enforcement,
staff reconciliation, protected password-change HTTP/client integration, direct
credential-write compatibility and operational/ADR-081 readiness remain gates.

## Implementation record: unmounted synthetic pipeline

The same-day implementation commits eligible intent/recipient/job with credential,
session and in-app changes. Existing dispatch/cleanup supports the version-1
template, event deadline, fenced outcomes and separate retention clocks. SQL-only
guards preserve immutable addressing/deadlines; a committed-deletion trigger
atomically erases recipients/notices and fences work. No deletion endpoint or hold
workflow is added. Migrations run only in disposable synthetic schemas.

Thirty password-change tests and the relevant account/foundation/logging scripts
report 176 total passes with a fake provider. Lint and production build/type checks
pass. See `docs/PASSWORD_CHANGE_LOCAL_TESTING.md` for exact commands and remaining
mounting, staff/provider/backup/hold and real-data gates. Acceptance and synthetic
completion do not authorize mounting or real sending.

## Sources

- Owner's explicit approvals of all three policy questions, 2026-10-20 PHT
- `docs/PASSWORD_CHANGE_EMAIL_RETENTION_DECISION_BRIEF.md`, concrete proposal A–C
- ADR-073/079/085/086/087/088; PROJECT sections 8.5, 25, 28 and 34
