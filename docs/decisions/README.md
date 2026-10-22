# Architecture and Product Decision Records

The files in this directory preserve decisions in chronological order.

Latest submission boundary (2026-10-22 PHT): the owner confirmed keeping dependent
submission behavior gated. A mounted read-only exact-revision recheck and shared
public-facts projection are implemented for synthetic validation; declaration
capture, submission lifecycle and publication remain paused. This does not accept
the pending contracts or complete Slice 3. See
[scope and verification](../LAPTOP_SUBMISSION_GATES.md).

Latest held-review policy (2026-10-22 PHT): the owner explicitly accepted the six
initial choices and full E1-E3 package in
[ADR-096](ADR-096-held-review-authorization-and-operations.md): owner-only grants,
claimed purposeful evidence review, authoritative confirmed coverage, access/action
audit, six-month review/access history, exact moderation notices and original
in-app appeal clock, authenticated text-only appeal intake, and versioned bounded
moderation jobs/recovery/cleanup. See the
[operations runbook](../runbooks/HELD_LISTING_REVIEW_OPERATIONS.md) and
[completed interview brief](../HELD_REVIEW_OPERATIONS_DECISION_BRIEF.md).
This resolves policy choices, not absent runtime controls, staffing or independent
submission/evidence/geography/declaration/translation/launch prerequisites.

Latest laptop evaluation (2026-10-22 PHT): ADR-058's implementation record adds a
versioned read-only evaluation to exact saved-revision owner review. It distinguishes
missing requirements, deterministic exclusions, human-review requirements and
unavailable checks; only all-pass can be eligible. Current runtime checks cannot
clear geography, real evidence or undocumented detectors. No publication, hold,
operator request or notification is created. See
[scope, risk decisions and verification](../LAPTOP_PUBLICATION_EVALUATION.md).

Latest photo decision (2026-10-21 PHT): the owner explicitly accepted groups A/B/C
in [ADR-095](ADR-095-private-synthetic-draft-photo-processing.md). Private synthetic
photo paths, immutable ordered references, safe derivatives and a local run-once
PostgreSQL worker implement the limits, recovery and cleanup policy. Whole drafts,
including text-only history, expire after 30 inactive days; originals expire after
processing or their original 24-hour window. Runtime approval requires local
ClamAV setup. Synthetic images never qualify as actual-item publication evidence.
No public image path, paid service, hosted schedule or launch grant is added.
See [local testing](../DRAFT_PHOTO_LOCAL_TESTING.md).

Latest saved laptop revision review (2026-10-21 PHT): ADR-084's implementation
supplement adds an owner-authorized, server-derived saved-version review with
separate proposed-content/private-expectation projections, correction links and
honest missing/unavailable publication requirements. Saved content is absent from
HTML/metadata; the private API is no-store. No declaration capture, public reader,
publication command or actual hold/rejection is added. ADR-094 remains proposed.
See [local testing](../LAPTOP_DRAFT_LOCAL_TESTING.md).

Pending geography proposal (2026-10-21 PHT): [ADR-094](ADR-094-controlled-cdo-barangay-registry.md)
proposes a PSA PSGC source, identifiers, versioned provenance, maintenance ownership
and historical/retry behavior for owner-private laptop drafts. It is **not accepted**;
dependent registry and selection implementation remains paused for owner review.
Current drafts still store null barangay; no map provider or geocoding is selected.

Latest age-data decision (2026-10-21 PHT): [ADR-093](ADR-093-check-age-without-retaining-birth-date.md)
supersedes DOB retention/repeated age checks in ADR-042/087. Check transient DOB
once at signup in PHT, discard it on success and rejection, and retain only the
passed-check time plus existing adult-attestation version/time. Current account
and email-change eligibility guards use that minimal private evidence. A forward
migration conservatively derives supported legacy synthetic results at the original
attestation date, then drops DOB. Final privacy grounds/documents, operational
contact readiness and real-data/launch gates remain open.

Latest account-document decision (2026-10-21 PHT): [ADR-092](ADR-092-account-document-agreement-capture.md)
accepts a separate unchecked Terms agreement and atomic server-owned document
versions/time after final documents are approved. The minimal private agreement
record is erased on eligible deletion absent a scoped exception. Read-only Terms
and Privacy Notice drafts are linked from registration; operator/contact, final
wording and processing grounds remain open. No agreement capture is implemented.
See [ACCOUNT_POLICY_REVIEW.md](../ACCOUNT_POLICY_REVIEW.md).

Latest local integration (2026-10-20 PHT, after ADR-089): explicit owner authorization
now mounts only protected POST `/api/auth/change-password` and its existing form for
synthetic validation. This supersedes older mounting/client/direct-write-review
status below. Notice readers, notification UI and staff tools remain unmounted;
all accepted policy and real-sending/data/operational gates remain. See
[PASSWORD_CHANGE_LOCAL_TESTING.md](../PASSWORD_CHANGE_LOCAL_TESTING.md).

Latest account-security reader integration (2026-10-21 PHT): owner-private password-
change notice list/read surfaces are mounted for synthetic validation at
`/account/security` and the two protected notice API paths. They expose no general
session reader, email eligibility, recipient or delivery details. This supersedes
the older notice-reader/UI-unmounted status below, without changing ADR-087/089 policy.

Latest password-change policy (2026-10-20 PHT): accepted
[ADR-089](ADR-089-password-change-email-and-retention.md) resolves exact version-1
copy, seven-day delivery, recipient erasure, bounded metadata/in-app retention,
cleanup and delayed/deleted-account behavior. It supersedes older statements below
that these decisions remain open. The later 2026-10-20 integration record above
also supersedes the earlier unmounted status: a protected password-change route
and form now work for local synthetic validation. Real-data readiness remains a
separate gate.

`PROJECT.md` is the current authoritative product and domain specification. Earlier ADRs may contain an `unresolved` consequence that was answered by a later ADR. Read the later decision and `PROJECT.md` before treating an older open item as current uncertainty.

ADR-090 resolves MVP listing renewal and `Newest` behavior, appointment
reminders, unsupported-category requests, later-discovered underage accounts,
urgent external escalation, external device-identifier checks, and scoped
restrictions/suspension behavior, and the requirement for validated,
category-relevant diagnostics before a category enters the pilot. Provider/hosting
decisions remain pending. See
[ADR-090](ADR-090-remaining-mvp-policy-decisions.md).
ADR-091 sets service targets, browser support, responsive web scope, and
quota-based capacity. Provider selection and hosted operations remain pending;
[ADR-091](ADR-091-pilot-service-and-browser-targets.md).

Latest draft guard integration (2026-10-21 PHT): ADR-090's implementation record
covers current scoped restrictions and suspension on create/save, including
retries and concurrent updates. Owner list/detail, sign-in and account security
remain available. This supersedes older draft-restriction-unimplemented status;
staff tools, other marketplace enforcement and launch gates remain pending.

Current listing boundary (2026-10-19 PHT): ADR-084's implementation record covers
the owner's requested local synthetic, authenticated owner-private laptop drafts.
Incomplete snapshots append immutable revisions and versioned diagnostic answers;
nullable draft geography/condition avoid invented data. The owner-private list/
create/read/save API and local workspace at `/drafts` are mounted, with no public
listing reader, publication/hold or marketplace grant. Publication audit/outbox,
evidence, safety and readiness gates remain.
See [LAPTOP_DRAFT_LOCAL_TESTING.md](../LAPTOP_DRAFT_LOCAL_TESTING.md).

Availability supplement (2026-10-21 PHT): ADR-084's later record implements
ADR-014's pickup/meetup/both choices in owner-private laptop draft revisions.
Incomplete drafts may leave availability unselected. Existing revision/retry,
ownership and restriction guards apply. This supersedes older fulfillment-input
deferral only; no exact location, appointment or publication behavior is added.

Use the ADRs to understand why a rule exists and what tradeoffs were accepted. Add or update an ADR when a decision changes product behavior, domain semantics, operational responsibility, privacy, retention, or safety controls.

Do not silently resolve items listed in `PROJECT.md` under **Deferred Decisions**.

Latest signup implementation (2026-10-18 PHT, after sign-in mounting): the owner
authorizes local synthetic signup only. Protected POST `/api/auth/sign-up/email`
and the accessible registration form now call the existing atomic operation with
origin/first-login CSRF/rate protection, fixed generic responses and no session.
Actual-route rollback/retry and fake-delivery verification use disposable schemas.
This supersedes older signup mounting/client status below. Terms/privacy and
ADR-081 launch gates remain incomplete; email sending stays disabled.
See [SIGNUP_LOCAL_TESTING.md](../SIGNUP_LOCAL_TESTING.md) and ADR-087's latest record.

Current sign-in implementation (2026-10-18 PHT): the protected HTTP handler and
accessible form are mounted for local synthetic testing only. It calls the serialized sign-in operation under ADR-086
limiter/origin/CSRF protection and emits only fixed success plus the required
session cookie after commit. Explicit ambient adapter binding preserves the
transaction inside Better Auth's HTTP context. Only POST `/api/auth/sign-in/email`
is added to the existing six email commands. Success stays on-screen without a
session reader or marketplace grant. Protected signup and password-change routes
and forms are also mounted for local synthetic testing under their own guards.
No flow grants marketplace access. This supersedes older HTTP-integration status
below; raw library sign-in remains unsafe to expose. See `docs/SIGN_IN_LOCAL_TESTING.md`
and ADR-087's record.

ADR-088 accepts the account-email transport, templates/link contract, bounded
dispatch/recovery and cleanup choices at the owner's explicit request. The internal
dispatcher, six email routes, fragment forms and local run-once Node.js job command
are implemented. Hosted worker deployment and scheduling remain gated. See
`docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`.

ADR-086 records MVP session, freshness, cookie, and numerical authentication rate-limit policies. ADR-087 defines signup/attestation, verification, reset, email-change, generic response, and session-revocation behavior. ADR-088 accepts private token transport, account email content/link rules, dispatch/recovery and delivery cleanup. The six email request/completion commands and signup, sign-in, and password-change integrations are mounted for synthetic validation, with sending off by default. Hosting/proxy trust, worker deployment/scheduling, provider setup and full marketplace authorization remain implementation or launch gates; ADR-090 settles restriction and suspension policy.

The following ADR-087 password-change status was a historical snapshot and is
superseded by ADR-089 and the latest integration record at the top of this file.
Password-change policy, email delivery/retention, and protected local synthetic
HTTP/client integration are now accepted or implemented as documented there.
Earlier ADR-087/089 implementation snapshots state that notice readers and UI were
unmounted; the 2026-10-21 integration record above supersedes that status. Staff
tools remain unmounted.

Recent architecture decisions: ADR-076 selects PostgreSQL for MVP marketplace search; ADR-077 sets six-month retention for private content in uncompleted inquiries/negotiations; ADR-078 extends the one-appeal process to listing moderation and verification decisions; ADR-079 restricts retention exceptions and requires periodic review; ADR-080 requires trained operator backup and pauses onboarding/publication when coverage is unavailable; ADR-081 gates real data and public pilot on hosting readiness; ADR-082 sets 24-hour pilot RPO/RTO targets; ADR-083 selects Prisma ORM 7, Zod 4, Tailwind CSS 4, and stable stack release lines, with exact patches pinned at application bootstrap; ADR-084 records centavo precision and the first physical schema review decisions; ADR-085 establishes privacy-safe operational logging; ADR-087 settles account onboarding and credential-flow policies; ADR-088 settles account email delivery and recovery.
