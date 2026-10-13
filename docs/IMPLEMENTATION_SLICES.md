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

## To implement

| Order | Slice | Scope / completion boundary | Status |
| --- | --- | --- | --- |
| 1 | Application and data foundation | Configure validated runtime, PostgreSQL connection, Prisma migrations, shared server validation, module boundaries, and privacy-safe logging. Keep local/private development on synthetic data. | In progress: first migration applied locally with aligned auth tables, revision FKs, publication history and SQL constraints; foundation input parsers and synthetic PostgreSQL verification pass. Shared server-only Prisma client and enforced repository import boundary exist. Current app has no persisted reads; authorized projection methods are deferred to the first supported read. Guarded commands, remaining module boundaries and logging still need work; see `docs/architecture/PHYSICAL_SCHEMA_REVIEW.md` and `app/src/server/repositories/README.md` |
| 2 | Adult account and access | Registration, 18+ attestation and private DOB, Better Auth sessions, email verification, account eligibility/restrictions, and server-enforced action gates. | Not started |
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

## Cross-slice acceptance checks

- Every state-changing command checks actor, authorization, eligibility, current state, revision, and deadline as applicable; concurrency and retries preserve invariants.
- Every read selects the correct public, account-private, negotiation-private, reserved-transaction-private, restricted-evidence, or staff/audit projection.
- Immutable or auditable revisions, proposals, appointments, confirmations, cases, and operator actions preserve required history and retention limits.
- Critical flows meet WCAG 2.2 AA and include required paired English and human-reviewed Cebuano/Bisaya content.
- Deferred decisions in `PROJECT.md` §34 and `architecture.md` §8.2 remain gates; this tracker does not resolve them.

## Sequencing notes

ADR-067 establishes the laptop create-to-completion path as the reference thin slice. Build slices 1–9 into that vertical path before broad category rollout; slices 10–13 provide required trust and pilot operations. The exact order can change when dependencies require it, but launch gates and MVP invariants do not.
