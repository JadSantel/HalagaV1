# Halaga MVP Implementation Slices

This tracker maps the approved MVP to implementation work. Product behavior comes from `PROJECT.md`, accepted decisions from `docs/decisions/`, architecture from `architecture.md`, and interface guidance from `design.md`.

**Status means code present in this repository.** An accepted ADR or installed dependency is not an implemented user flow. “Prototype complete” means the local synthetic-data exercise works; it is not production-ready or pilot-ready.

## Implemented

### Latest Slice 2 verification and document review (2026-10-21 PHT)

Current mounted account functions and laptop draft scope/suspension guards pass
local synthetic verification. Terms/Privacy review drafts are now linked from
registration and the account footer. ADR-092 accepts future separate Terms
agreement and minimal private record retention after final document approval;
current signup still captures only the approved adult attestation. Operator/contact,
final wording and processing grounds remain unresolved. Overall Slice 2 remains
in progress on that approval dependency and subsequent agreement capture, rather
than being declared complete because draft pages exist. See
[SLICE_2_CLOSEOUT.md](SLICE_2_CLOSEOUT.md) for the acceptance inventory, 242 passing
checks, earlier failures, existing style warning and remaining gates, and
[ACCOUNT_POLICY_REVIEW.md](ACCOUNT_POLICY_REVIEW.md) for owner decisions.

### Local synthetic password-change integration (2026-10-20 PHT, after ADR-089)

Protected POST `/api/auth/change-password` and `/account/change-password` are now
mounted under explicit owner authorization. A one-path handler reuses the existing
guarded operation/plugin, preserving stored-session freshness, origin/CSRF, fixed
responses, exact initiating cookie/session and atomic credentials/revocation/notices/
eligible email intent/jobs. The accessible form supports pending, validation,
wrong-password, fresh-sign-in, shared-IP limits, persistent success and truthful
uncertain outcomes without automatic retries. Passwords clear on response/navigation.
Installed Better Auth 1.7.7 direct-write compatibility is reviewed; the shared limiter
glob now implements ADR-086's accepted values for slash-prefixed paths. Synthetic
PostgreSQL, actual Next dispatch, both protected HTTP sign-in race orders and
installed-browser checks are recorded in
[PASSWORD_CHANGE_LOCAL_TESTING.md](PASSWORD_CHANGE_LOCAL_TESTING.md).

This supersedes older password-change unmounted/disabled implementation statements
in this tracker only. Notice readers, notification UI and staff tools remain
unmounted. Real sending/data, provider/backup evidence, restores, hold enforcement,
staff recovery, full deletion workflow, worker/hosting and ADR-081 gates remain.
No migration is added or applied to persistent/shared databases. No new dependency,
provider, schedule, session reader, deployment or billing path is selected.

Final verification: twelve account/auth/logging/foundation test scripts report
218 passes with no failures/skips, including the installed-browser actual Next
harness. Lint, production build/TypeScript, diff whitespace and the UI detector pass.
Earlier limiter, fixture, lint and sandboxed-browser failures and the remaining
human accessibility/real-data gates are recorded in the testing guide.

| Slice | Status | Evidence and boundary |
| --- | --- | --- |
| Laptop diagnostic rules | Prototype complete; private backend reuse | `app/src/domain/laptop-diagnostics.ts` derives the four accepted condition states, validates answers, handles safety stops, and provides synthetic examples. Slice 3 now reuses these rules server-side for owner-private drafts; publication enforcement remains gated. |
| Laptop draft and privacy preview | Prototype complete | `app/src/domain/laptop-listing.ts` validates a local draft and creates an explicit public-field allowlist. `app/src/app/laptop-draft-form.tsx` renders the practice flow and three fictional sample-image fixtures. Data stays in browser memory; barangays and listing are fictional; sample images do not count as actual-item evidence; no publication. |
| Web stack bootstrap | Foundation only | Next.js/TypeScript app, Tailwind, selected packages, and the first account/listing migration exist. PostgreSQL storage constraints and synthetic rollback tests are implemented. Local account/private-draft paths are documented below; marketplace flows remain gated. |

No production marketplace flow is implemented yet.

### Completed unmounted password-change email slice (2026-10-20 PHT)

The owner explicitly approved wording/seven-day delivery, retention and deletion/
scope decisions. Accepted [ADR-089](decisions/ADR-089-password-change-email-and-retention.md)
resolves the earlier prerequisite audit and supersedes historical open-policy/
email-unimplemented statements below.

Credential replacement, other-session revocation, mandatory in-app notice and
eligible email intent/immutable recipient/job now commit atomically. Locked
verified-in-both-stores eligibility selects the primary address; ineligible changes
create no email work, and later verification never backfills. The initiating
session survives. Existing dispatch/recovery supports version-1 PHT copy, original
seven-day expiry, existing bounded retries/leases and ambiguous-outcome fencing.

Recipients erase on acceptance/suppression/deletion or by original expiry for
FAILED/UNKNOWN. Metadata purges after 30 terminal days capped at 37 event days;
in-app records last 90 event days or until committed deletion. SQL guards prevent
retargeting/restoration/deadline extension. A deletion trigger atomically erases
password-change recipients/notices, suppresses unsent work and quarantines SENDING.
The existing manual cleanup path applies separate clocks without backfill.

Final verification: 176 passes across `test:password-change` (30), `test:signup` (7),
`test:verification` (11), `test:reset` (12), `test:email-change` (16),
`test:account-email-intents` (13), `test:account-email` (27), `test:sign-in` (34),
`test:logging` (5) and `test:foundation` (21). Lint and build/type checking passed.
Only synthetic schemas and fake delivery were used. See the
[password-change guide](PASSWORD_CHANGE_LOCAL_TESTING.md#implemented-email-pipeline-and-approved-rules-2026-10-20-pht)
for behavior, migration and verification details.

Password-change commands/readers stay unmounted; preview and real sending remain
disabled. Protected HTTP/client integration, direct-write compatibility, actual
deletion/hold/staff workflows, provider/backup/restore evidence, hosted operations
and ADR-081 readiness remain gates. No persistent migration, new dependency,
provider, cadence, deployment, participant data or billing is authorized.

### Working Slice 3 owner-private workspace (2026-10-19 PHT)

Authenticated, mapped, undeleted synthetic accounts can list, create, edit and resume
their own single-item laptop drafts at `/drafts` and `/drafts/[listingId]`, linked
from sign-in. GET/POST `/api/laptop-drafts` and GET/PUT
`/api/laptop-drafts/[listingId]` provide the saved source of truth. The list excludes
any non-draft or publication history and returns only ID, title, revision, updated
time and validated condition. Loading, empty, error, signed-out, pending, saved,
uncertain-retry and stale-edit states are implemented. Shared diagnostic controls
retain the browser-only practice behavior; no sample data is automatically saved.
Stored sessions and ownership are rechecked under transaction locks.
Clients cannot set the seller, author,
condition, listing type/category, quantity or lifecycle. Unverified accounts can
use this private draft capability; it grants no marketplace action.

Incomplete snapshots are saved as immutable, numbered revisions with versioned
per-question answers. A condition is stored only after existing whole-draft and
per-answer validation passes. Request UUIDs identify immutable revisions for
idempotent retries; expected revision guards reject stale edits. The nullable
barangay/condition migration is checked in and tested in disposable schemas;
apply it through the existing local migration workflow before manual persistence.

Full replacement saves preserve a request UUID/body through uncertain retries.
Stale edits cannot overwrite a newer revision; the UI retains edits and offers
explicit reload. Saved data never uses browser storage. Explicit owner-private
detail includes private price expectation; no public
reader, metadata, marketplace grant, hold or publication is added. Barangay input,
including fictional practice choices, media, fulfillment and ownership-submission
input remain unsupported. The browser practice form still uses memory only.
Publication remains gated on controlled CDO geography, evidence/image processing,
safety/risk/restriction checks, declaration history, audit/outbox and operational
readiness. See [LAPTOP_DRAFT_LOCAL_TESTING.md](LAPTOP_DRAFT_LOCAL_TESTING.md).

### Latest Slice 2 signup boundary (2026-10-18 PHT, after sign-in)

Local synthetic signup is now mounted at POST `/api/auth/sign-up/email`, using
the existing atomic operation and protected HTTP integration. The accessible
`/account/register` form replaces its disabled preview. It uses the exact unchecked
ADR-087 attestation; version/timestamp remain server-owned. Fixed generic responses
hide new/duplicate/verified address state. Signup creates no session and sends no
email. Origin/CSRF and the three-per-15-minute endpoint/IP limit remain enforced.
Actual Next-route tests replay migrations in disposable synthetic schemas with
finally cleanup, inject write/commit failures, retry, and verify no underage writes,
session behavior, fake-delivery verification and closed unrelated routes. An
optional installed-browser check exercises keyboard, focus, pending/results,
errors and reflow. See [SIGNUP_LOCAL_TESTING.md](SIGNUP_LOCAL_TESTING.md).
This supersedes earlier signup mounting/client status below. Signup is available
only for local synthetic validation. Terms/privacy content, restriction enforcement,
owner notice reading, audited staff recovery, provider/hosted operations and all
real-data/public-launch gates remain incomplete.

### Current Slice 2 sign-in boundary (updated 2026-10-18 PHT)

`account-flows.signIn` now calls the installed Better Auth 1.7.7 sign-in API
inside a transaction-bound Prisma adapter after identity/mapping and credential
locks. Credential/state reads, password verification and session insertion share
that transaction; cookies/results return after commit. Synthetic PostgreSQL tests
prove both lock orders with observed backend-specific waits against password
change, reset, verification, email proof and verification-state maintenance.
Unverified sign-in, fresh-sign-in requirements, rollback/retry, unrelated-account
isolation and safe errors/logs are preserved. See
[SIGN_IN_LOCAL_TESTING.md](SIGN_IN_LOCAL_TESTING.md) for trace, results and limits.
The protected HTTP integration now calls that operation through the installed
handler with shared endpoint/IP counters, configured-origin admission and the
installed first-login CSRF middleware. Explicit ambient adapter binding preserves
the operation's transaction inside the HTTP handler. Success returns only
`{"status":"SIGNED_IN"}` and its host-only session cookie after commit; failure
returns a fixed safe code without cookies. Tests use disposable synthetic schemas
and cover both revocation orders and rollback/retry. This supersedes older race
and HTTP-integration status wording below only for this protected integration.
Raw library sign-in remains unsafe to expose. POST `/api/auth/sign-in/email`
and its accessible email/password form work for local synthetic testing. The
protected handler is separate from the six email commands and emits only its
fixed result and session cookie; no general session reader or marketplace grant
is exposed. Application-route and browser checks use disposable synthetic data.
Signup and password change have their own protected local-synthetic integrations,
documented in their current records. This supersedes historical sign-in mounting
status below. Launch gates remain incomplete.

## To implement

| Order | Slice | Scope / completion boundary | Status |
| --- | --- | --- | --- |
| 1 | Application and data foundation | Configure validated runtime, PostgreSQL connection, Prisma migrations, shared server validation, module boundaries, and privacy-safe logging. Keep local/private development on synthetic data. | **Complete:** runtime configuration reports field-only validation errors; local PostgreSQL connection and reviewed migration workflow are configured; the first migration is installed and its checksum, 15 constraints, and seven triggers verify locally. Shared Zod validation, server-only/database import boundaries, guarded-command transaction behavior, and privacy-safe operational logging pass synthetic checks. Exact direct dependency pins match the lockfile; `.nvmrc` matches Node 24.21.0. Slice 1 added no persisted product reads or commands; slice 2 now provides account prerequisite reads, while other authorized projections and flow-specific safeguards belong to their owning slices. See `docs/architecture/SERVER_BOUNDARY_REVIEW.md`, `docs/architecture/PHYSICAL_SCHEMA_REVIEW.md`, `app/README.md`, and `app/src/server/repositories/README.md`. |
| 2 | Adult account and access | Registration, 18+ attestation and private DOB, Better Auth sessions, email verification, account eligibility/restrictions, and server-enforced action gates. | **In progress: current implementation verified locally; final document approval blocked.** Mounted protected flows: registration, sign-in, verification resend/consume, password-reset request/consume, email-change request/confirmation, authenticated password change, and owner-private password-change notice list/read. Stored ownership, freshness, deletion, adult/verification prerequisites and laptop draft restriction/suspension checks have synthetic coverage. Password change preserves its initiating session and atomically writes notices/eligible email work. The local email worker is implemented; real sending remains off. Terms/Privacy review pages are linked from registration. ADR-092 accepts a separate unchecked Terms agreement and minimal private versions/time record after final document approval; capture/storage is not yet implemented. Remaining: operator/contact, final wording and processing-ground review, then dependent agreement implementation/checks. Future marketplace commands must enforce their own matching scope. No general session reader or marketplace grant is exposed. Staff recovery/audit, hosted providers/workers, backup/restore and ADR-081 readiness remain separate gates. See `docs/SLICE_2_CLOSEOUT.md`, `docs/ACCOUNT_POLICY_REVIEW.md` and the linked account-flow testing guides. |
| 3 | Listing creation and publication | Convert laptop prototype into a server-validated flow; real supported CDO barangays; ownership declaration history; listing/revision lifecycle; required photos, safe image handling, publication risk checks and held-review path; private price expectation. | **Partial, local synthetic only:** authenticated owner-private single-item laptop draft create/read/save, incomplete snapshots, server validation/condition derivation, immutable versioned history, exact private expectation, transactions, retry idempotency and stale-revision guards. No publication/hold/public reader or marketplace grant. Barangay registry, media, fulfillment/declaration submission, publication safety/risk/restrictions, audit/outbox and readiness remain gated. See `docs/LAPTOP_DRAFT_LOCAL_TESTING.md`. |
| 4 | Public marketplace discovery | Public active-listing browse/search/detail with explicit public projections, filters and sort rules, shareable noindex pages, blocking-aware signed-in views, and no demand/private-data leakage. | Not started |
| 5 | Buyer inquiry and offer negotiation | Pre-offer inquiry, private buyer-seller conversation, structured proposals/counters, 72-hour deadlines, withdrawal/rejection/expiry, revision acknowledgement, and seller-only offer comparison. | Not started |
| 6 | Reservation and competing-offer handling | Guarded seller acceptance, at most one active reservation, pause/reopen eligible competing offers, cancellation and reservation expiry, and material-edit buyer reconfirmation. | Not started |
| 7 | Pickup/meetup appointments | Private appointment proposals and accepted schedule/location, first appointment and reschedule limits, expiry threshold, privacy-safe coordination, and accessible status/copy. | Not started |
| 8 | Inspection and transaction completion | Inspection and post-inspection negotiation, separate reserved/final prices, bilateral matching completion confirmations, mismatch correction deadline, and unconfirmed administrative closure. | Not started |
| 9 | Durable jobs and notifications | PostgreSQL-backed outbox/jobs, idempotency, expiring leases/recovery, bounded retries, deadline rechecks, in-app notices and recipient-specific transactional email. No invented reminder schedule. | Not started |
| 10 | Reports, disputes, and enforcement | Safety/report intake, no-show and misrepresentation cases, bounded evidence, response/extension windows, human findings/remedies, interim actions, one appeal, role-restricted audited staff access. | Not started |
| 11 | Verification and operator workbench | Business/technician applications and evidence, human review and appeal, held-listing/report/dispute queues, named primary/alternate coverage controls and access audit. | Not started |
| 12 | Blocking, deletion, and retention | Blocking with active-workflow preservation; deletion eligibility and identity handling; 6-month unreserved negotiation content and 24-month closed transaction retention; documented, reviewed exceptions and deletion jobs. | Not started |
| 13 | Pilot trust, analytics, and operational readiness | Event-time cohort and success metrics, safety continuation gate, accessibility review, backup/restore and recovery validation, quotas/availability checks, and operator readiness. Launch gates must pass before real participant data or public registration. | Not started |
| 14 | Remaining category diagnostics | Accepted, validated diagnostic schemas and usability-tested flows for every supported non-laptop category, including smartphone identifier handling. Do not infer question sets from the laptop prototype. | Blocked on product/design validation |

### Slice 2 boundary and remaining work (updated 2026-10-21 PHT)

The current state is summarized in the Slice 2 table above. Earlier account-flow
notes below and in linked guides are historical snapshots; use each guide's latest
dated integration record for implementation details. In particular, password
change is mounted for local synthetic validation, sign-in and signup are mounted,
and the six account-email commands plus fragment forms are mounted. These local
integrations do not authorize real participant data, live sending or public signup.

The owner-private password-change notice reader and account security UI are now
implemented for synthetic validation. Scoped restriction/suspension guards now
enforce ADR-090 for laptop draft creation/editing, including retries, with
synthetic database verification. Other marketplace commands must apply their
own scope checks as implemented. See `docs/LAPTOP_DRAFT_LOCAL_TESTING.md`. Terms/privacy
draft pages are implemented, while operator/contact, final text and processing
grounds remain unresolved. ADR-092 accepts the agreement flow and record retention
after document approval; dependent capture/storage remains unimplemented. See
`docs/ACCOUNT_POLICY_REVIEW.md` and `docs/SLICE_2_CLOSEOUT.md`. Audited staff recovery, provider/hosted worker
operations, backup/restore and ADR-081 readiness remain separate operational or
later-slice gates. See `docs/ACCOUNT_FLOW_INTEGRATION.md` and
`docs/PASSWORD_CHANGE_LOCAL_TESTING.md` for current boundaries.

## Cross-slice acceptance checks

- Every state-changing command checks actor, authorization, eligibility, current state, revision, and deadline as applicable; concurrency and retries preserve invariants.
- Every read selects the correct public, account-private, negotiation-private, reserved-transaction-private, restricted-evidence, or staff/audit projection.
- Immutable or auditable revisions, proposals, appointments, confirmations, cases, and operator actions preserve required history and retention limits.
- Critical flows meet WCAG 2.2 AA and include required paired English and human-reviewed Cebuano/Bisaya content.
- Deferred decisions in `PROJECT.md` §34 and `architecture.md` §8.2 remain gates; this tracker does not resolve them.

## Sequencing notes

ADR-067 establishes the laptop create-to-completion path as the reference thin slice. Build slices 1–9 into that vertical path before broad category rollout; slices 10–13 provide required trust and pilot operations. The exact order can change when dependencies require it, but launch gates and MVP invariants do not.
