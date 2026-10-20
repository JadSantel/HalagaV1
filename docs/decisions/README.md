# Architecture and Product Decision Records

The files in this directory preserve decisions in chronological order.

Latest local integration (2026-10-20 PHT, after ADR-089): explicit owner authorization
now mounts only protected POST `/api/auth/change-password` and its existing form for
synthetic validation. This supersedes older mounting/client/direct-write-review
status below. Notice readers, notification UI and staff tools remain unmounted;
all accepted policy and real-sending/data/operational gates remain. See
[PASSWORD_CHANGE_LOCAL_TESTING.md](../PASSWORD_CHANGE_LOCAL_TESTING.md).

Latest password-change policy (2026-10-20 PHT): accepted
[ADR-089](ADR-089-password-change-email-and-retention.md) resolves exact version-1
copy, seven-day delivery, recipient erasure, bounded metadata/in-app retention,
cleanup and delayed/deleted-account behavior. It supersedes older statements below
that these decisions remain open. The unmounted synthetic pipeline and separate
retention/deletion cleanup are implemented with fake delivery; mounting and real-data readiness
remain separate gates.

`PROJECT.md` is the current authoritative product and domain specification. Earlier ADRs may contain an `unresolved` consequence that was answered by a later ADR. Read the later decision and `PROJECT.md` before treating an older open item as current uncertainty.

Current listing boundary (2026-10-19 PHT): ADR-084's implementation record covers
the owner's requested local synthetic, authenticated owner-private laptop drafts.
Incomplete snapshots append immutable revisions and versioned diagnostic answers;
nullable draft geography/condition avoid invented data. The owner-private list/
create/read/save API and local workspace at `/drafts` are mounted, with no public
listing reader, publication/hold or marketplace grant. Publication audit/outbox,
evidence, safety and readiness gates remain.
See [LAPTOP_DRAFT_LOCAL_TESTING.md](../LAPTOP_DRAFT_LOCAL_TESTING.md).

Use the ADRs to understand why a rule exists and what tradeoffs were accepted. Add or update an ADR when a decision changes product behavior, domain semantics, operational responsibility, privacy, retention, or safety controls.

Do not silently resolve items listed in `PROJECT.md` under **Deferred Decisions**.

Latest signup implementation (2026-10-18 PHT, after sign-in mounting): the owner
authorizes local synthetic signup only. Protected POST `/api/auth/sign-up/email`
and the accessible registration form now call the existing atomic operation with
origin/first-login CSRF/rate protection, fixed generic responses and no session.
Actual-route rollback/retry and fake-delivery verification use disposable schemas.
This supersedes older signup mounting/client status below. Password-change and
terms/privacy/ADR-081 launch gates remain incomplete; email sending stays disabled.
See [SIGNUP_LOCAL_TESTING.md](../SIGNUP_LOCAL_TESTING.md) and ADR-087's latest record.

Current sign-in implementation (2026-10-18 PHT): the protected HTTP handler and
accessible form are mounted for local synthetic testing only. It calls the serialized sign-in operation under ADR-086
limiter/origin/CSRF protection and emits only fixed success plus the required
session cookie after commit. Explicit ambient adapter binding preserves the
transaction inside Better Auth's HTTP context. Only POST `/api/auth/sign-in/email`
is added to the existing six email commands. Success stays on-screen without a
session reader or marketplace grant. Signup/password change
stay closed, their previews disabled, and password-change email/readiness gates
remain. This supersedes older HTTP-integration status below; raw library sign-in
remains unsafe to expose. See `docs/SIGN_IN_LOCAL_TESTING.md` and ADR-087's record.

ADR-088 accepts the account-email transport, templates/link contract, bounded
dispatch/recovery and cleanup choices at the owner's explicit request. The internal
dispatcher, six email routes, fragment forms and local run-once Node.js job command
are implemented. Hosted worker deployment and scheduling remain gated. See
`docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`.

ADR-086 records MVP session, freshness, cookie, and numerical authentication rate-limit policies. ADR-087 defines signup/attestation, verification, reset, email-change, generic response, and session-revocation behavior. ADR-088 accepts private token transport, account email content/link rules, dispatch/recovery and delivery cleanup. Its 2026-10-16 implementation record mounts only the six email request/completion commands for synthetic validation, with provider sending off by default. Signup, sign-in and password change stay closed. Hosting/proxy trust, worker deployment/scheduling, provider setup, sign-in races, restrictions, and full marketplace authorization remain open.

ADR-087 also records synthetic unmounted authenticated password change: locked
stored-session/mapping/credential checks and atomic credential replacement plus
other-session revocation retain the initiating fresh session. The owner approved
its password-change notice supplement on 2026-10-15 PHT: mandatory account-private
in-app notice for every success and email only to a primary address verified in both
stores at commit, with immutable recipient binding and no later backfill/retargeting.
Atomic in-app notices and locked eligibility recording are now implemented; the
operation and owner-only detail reader stay unmounted. Password-change email copy
and ordinary recipient/metadata cleanup remain unaccepted; no password-change email
intent, recipient snapshot or delivery is implemented, even for eligible changes.
ADR-088's four supported messages do not implicitly approve these missing rules.
Email implementation, sign-in races and integration/readiness gates remain before
mounting. See `docs/PASSWORD_CHANGE_NOTICE_DECISION_BRIEF.md` for approval and tradeoffs
and `docs/PASSWORD_CHANGE_LOCAL_TESTING.md` for the current implementation boundary.

Recent architecture decisions: ADR-076 selects PostgreSQL for MVP marketplace search; ADR-077 sets six-month retention for private content in uncompleted inquiries/negotiations; ADR-078 extends the one-appeal process to listing moderation and verification decisions; ADR-079 restricts retention exceptions and requires periodic review; ADR-080 requires trained operator backup and pauses onboarding/publication when coverage is unavailable; ADR-081 gates real data and public pilot on hosting readiness; ADR-082 sets 24-hour pilot RPO/RTO targets; ADR-083 selects Prisma ORM 7, Zod 4, Tailwind CSS 4, and stable stack release lines, with exact patches pinned at application bootstrap; ADR-084 records centavo precision and the first physical schema review decisions; ADR-085 establishes privacy-safe operational logging; ADR-087 settles account onboarding and credential-flow policies; ADR-088 settles account email delivery and recovery.
