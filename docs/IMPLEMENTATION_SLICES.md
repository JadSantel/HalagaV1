# Halaga MVP Implementation Slices

This tracker maps the approved MVP to implementation work. Product behavior comes from `PROJECT.md`, accepted decisions from `docs/decisions/`, architecture from `architecture.md`, and interface guidance from `design.md`.

**Status means code present in this repository.** An accepted ADR or installed dependency is not an implemented user flow. “Prototype complete” means the local synthetic-data exercise works; it is not production-ready or pilot-ready.

## Implemented

| Slice | Status | Evidence and boundary |
| --- | --- | --- |
| Laptop diagnostic rules | Prototype complete | `app/src/domain/laptop-diagnostics.ts` derives the four accepted condition states, validates answers, handles safety stops, and provides synthetic examples. No server enforcement or persistence. |
| Laptop draft and privacy preview | Prototype complete | `app/src/domain/laptop-listing.ts` validates a local draft and creates an explicit public-field allowlist. `app/src/app/laptop-draft-form.tsx` renders the practice flow and three fictional sample-image fixtures. Data stays in browser memory; barangays and listing are fictional; sample images do not count as actual-item evidence; no publication. |
| Web stack bootstrap | Foundation only | Next.js/TypeScript app, Tailwind, selected packages, and the first account/listing migration exist. PostgreSQL storage constraints and synthetic rollback tests are implemented. Auth and marketplace user flows remain absent. |

No production marketplace flow is implemented yet.

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
and its accessible email/password form now work for local synthetic testing.
Only that protected handler is added to the six existing email commands. Success
stays on-screen, with no session reader or marketplace grant. Application-route
tests use the existing development client-reuse seam with a disposable schema;
browser sign-in persisted a session there. Signup and password change stay closed.
This supersedes historical mounting/client status below for sign-in only.
Password-change email work and all existing launch gates remain incomplete.

## To implement

| Order | Slice | Scope / completion boundary | Status |
| --- | --- | --- | --- |
| 1 | Application and data foundation | Configure validated runtime, PostgreSQL connection, Prisma migrations, shared server validation, module boundaries, and privacy-safe logging. Keep local/private development on synthetic data. | **Complete:** runtime configuration reports field-only validation errors; local PostgreSQL connection and reviewed migration workflow are configured; the first migration is installed and its checksum, 15 constraints, and seven triggers verify locally. Shared Zod validation, server-only/database import boundaries, guarded-command transaction behavior, and privacy-safe operational logging pass synthetic checks. Exact direct dependency pins match the lockfile; `.nvmrc` matches Node 24.21.0. Slice 1 added no persisted product reads or commands; slice 2 now provides account prerequisite reads, while other authorized projections and flow-specific safeguards belong to their owning slices. See `docs/architecture/SERVER_BOUNDARY_REVIEW.md`, `docs/architecture/PHYSICAL_SCHEMA_REVIEW.md`, `app/README.md`, and `app/src/server/repositories/README.md`. |
| 2 | Adult account and access | Registration, 18+ attestation and private DOB, Better Auth sessions, email verification, account eligibility/restrictions, and server-enforced action gates. | **Partial, synthetic only:** ADR-086 policies plus stored-session-to-account resolution, explicit owner-only prerequisite projection, PHT-calendar adult/DOB and attestation checks, matching identity/domain email checks, and server prerequisite rejection for publication, inquiry and proposal submission. DOB/email/tokens never enter that projection or logs. Local isolated PostgreSQL tests cover ownership, missing mapping, deletion, eligibility, renewal, expiry, revocation and safe failures. ADR-087 settles onboarding, token, resend, recovery, email-change, generic-response, atomicity and session policies. Unmounted signup atomically creates Better Auth identity/credential, domain mapping, private DOB, attestation version/timestamp and durable verification-email outbox intent. Unmounted verification issues/replaces 24-hour tokens with private outbox intent and atomically consumes a token, synchronizes both verification states and revokes sessions. Unmounted reset issues/replaces one-hour tokens with private outbox intent and atomically replaces the credential, consumes the token and revokes every stored session while preserving both verification states. Unmounted email change rechecks the owner's fresh stored session under locks, leaves the existing verified address primary during bound 24-hour token issue/replacement, and atomically consumes proof, switches/verifies the address, revokes sessions and records minimized old-address security-notice intent. A narrow additive recipient-snapshot migration is necessary for that notice and replayed only in disposable schemas. Dedicated PostgreSQL checks cover freshness, conflicts, mapping/eligibility, write/commit rollback, same-token retry, expiry, replacement, reuse, concurrency, isolation and fresh sign-in compatibility. No routes/UI, account action grants or worker deployment: route/link integration, sign-in racing reset/email proof, cookie-response integration, restrictions/blocks, full command authorization, audited staff recovery, provider setup and deployment readiness remain gated. See `docs/SIGNUP_LOCAL_TESTING.md`, `docs/EMAIL_VERIFICATION_LOCAL_TESTING.md`, `docs/PASSWORD_RESET_LOCAL_TESTING.md` and `docs/EMAIL_CHANGE_LOCAL_TESTING.md`. |
| 3 | Listing creation and publication | Convert laptop prototype into a server-validated flow; real supported CDO barangays; ownership declaration history; listing/revision lifecycle; required photos, safe image handling, publication risk checks and held-review path; private price expectation. | Prototype exists; backend not started |
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

Slice 2 additionally implements the synthetic, unmounted authenticated password-change
operation under ADR-087. Stored-session ownership and original creation age below
15 minutes are rechecked with the mapping and credential under transaction locks.
Configured Better Auth limits/hasher/current-password verification apply. Credential
replacement atomically revokes all other stored sessions and retains the initiating
session exactly; verification, token families, account history and unrelated accounts
survive. Twenty-one reported PostgreSQL/input tests and eight direct exercises cover
freshness, missing state, hash/write/commit failure, rollback/retry, cookies, isolation
and concurrent account changes. No dependency is added. The owner-
approved ADR-087 supplement now requires in-app notice for every success, with
email only to a commit-time primary address verified in both stores. As of
2026-10-17 PHT, the independent in-app portion is implemented: credential/revocation/
notice commit atomically; both verification stores determine a fixed eligibility
outcome under account locks; opaque event/work keys distinguish successes. Owner-only
detail remains unmounted. The additive in-app migration is replayed only in disposable
schemas; no recipient constraint is expanded. Final password-change email copy and
ordinary recipient/metadata cleanup remain unaccepted, so no password-change email
intent, snapshot or delivery is implemented, even for eligible changes. No later
email backfill is authorized. This partial slice remains incomplete for mounting.
Sign-in races and existing readiness gates also remain.
See `docs/PASSWORD_CHANGE_LOCAL_TESTING.md`. Password-change command/detail routes
and email delivery remain unmounted; its preview remains disabled.

The current verification record and remaining decisions are in
`docs/PASSWORD_CHANGE_LOCAL_TESTING.md`. Existing direct exercises now assert one
in-app notice per success and none after a rejected/rolled-back change. The installed
Prisma adapter requires UTC connections for accurate instants; application and shared
sandbox connections now pin UTC, preserving the existing PHT business/display rules.

Slice 2 now also has an **unmounted protected integration** and **mounted disabled
screen previews** at `/account` (2026-10-15 PHT). The Better Auth plugin/handler
composes existing operations, verifies actual endpoint/IP limits including shared
PostgreSQL concurrency, rejects direct API bypasses, returns fixed generic request
confirmations, sanitizes failures and handles committed revocation cookies while
preserving the initiating password-change cookie. No application API route or
Server Action imports it. Preview fields/submission are disabled and collect no data.
This supersedes earlier “no UI/endpoint integration” implementation-status wording,
not the unmounted-command boundary or any accepted product decision.

**Mounting remains blocked:** routes and worker deployment remain off. ADR-088 now
settles encrypted token handoff, account email templates/fragment links, stale-work
suppression, bounded dispatch/recovery and retention. Remaining gates include
password-change notice writes, sign-in/session creation races, functional client
states and fragment consumption, terms/privacy content, restrictions/blocks,
audited staff recovery, provider setup and ADR-081 readiness. Slice 2 remains
partial and synthetic only. See `docs/ACCOUNT_FLOW_INTEGRATION.md`.

Slice 2 account email delivery is implemented as an unmounted internal path under
ADR-088. Signup now creates its first verification token and encrypted payload in
the same transaction as its identity and intent. Resend/reset/email-change writes
the same encrypted transport and suppresses queued work for the replaced token.
The dispatcher rechecks bindings and expiry, claims with fenced PostgreSQL leases,
sends the four approved templates through Brevo, retries explicit 429 responses
up to five attempts, quarantines ambiguous outcomes, and recovers/cleans expired
work. Terminal outbox and delivery rows purge after 30 days. No route or worker is
deployed; fake-provider dispatch/recovery checks remain unrun. Provider setup,
link-page handling, audited staff recovery and launch checks remain gates. See
`docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`.

## Cross-slice acceptance checks

- Every state-changing command checks actor, authorization, eligibility, current state, revision, and deadline as applicable; concurrency and retries preserve invariants.
- Every read selects the correct public, account-private, negotiation-private, reserved-transaction-private, restricted-evidence, or staff/audit projection.
- Immutable or auditable revisions, proposals, appointments, confirmations, cases, and operator actions preserve required history and retention limits.
- Critical flows meet WCAG 2.2 AA and include required paired English and human-reviewed Cebuano/Bisaya content.
- Deferred decisions in `PROJECT.md` §34 and `architecture.md` §8.2 remain gates; this tracker does not resolve them.

## Sequencing notes

ADR-067 establishes the laptop create-to-completion path as the reference thin slice. Build slices 1–9 into that vertical path before broad category rollout; slices 10–13 provide required trust and pilot operations. The exact order can change when dependencies require it, but launch gates and MVP invariants do not.
