# Halaga MVP Architecture

- Status: In discovery
- Scope: Invite-first seeding and eight-week public pilot
- Launch market: Cagayan de Oro City, Philippines
- Last updated: 2026-10-18

## 1. Purpose and authority

This document translates the approved Halaga product and domain rules into an implementable architecture. It records user-flow boundaries, system responsibilities, domain boundaries, data flows, and the architecture decisions that must be settled before implementation.

`PROJECT.md` remains authoritative for product scope, policy, domain meaning, and invariants. Accepted records in `docs/decisions/` explain why those rules exist. `docs/domain/GLOSSARY.md` defines canonical domain language. If this document conflicts with those sources, the product source of truth and the most recent accepted ADR take precedence until the conflict is explicitly resolved.

Architecture work follows this order:

1. Map and validate critical user and operator flows.
2. Design and test the key mobile-first screens, then validate desktop and accessibility behavior.
3. Define the domain model, trust boundaries, and system boundaries.
4. Record material technology and operational choices as ADRs.
5. Implement and validate a thin end-to-end transaction slice.

This document must not silently resolve an item listed under `PROJECT.md` section 34, **Deferred Decisions**.

## 2. Architecture-driving principles

1. **Privacy is structural.** Public listing data, participant-private transaction data, sensitive evidence, and staff-only case data require separate server-enforced projections. Hiding fields in the interface is not access control.
2. **Workflow state is explicit.** Listing, proposal, reservation, appointment, completion, dispute, verification, notification, and audit state are separate concepts with their own histories.
3. **State changes are commands.** Accepting an offer, confirming an appointment, confirming completion, and recording a support finding must pass current-state, actor, deadline, and authorization checks on the server.
4. **History is not overwritten.** Material listing revisions, proposals, appointments, confirmations, moderation actions, and support actions remain auditable.
5. **Deadlines are durable.** Proposal expiry, buyer reconfirmation, appointment expiry, completion timeout, listing expiry, reminders, and retention actions must survive process restarts and delayed job execution.
6. **Human judgment stays human.** Ambiguous listing eligibility, verification, disputes, no-show allegations, and enforcement findings enter role-restricted operator queues rather than being inferred as guilt by automation.
7. **Completion is bilateral.** A reservation, appointment, payment claim, one-sided confirmation, timeout, or operator inactivity never becomes a completed transaction by implication.
8. **The pilot remains operable by a small team.** The architecture should prefer a small number of well-bounded deployable components until measured scale or reliability needs justify distribution.
9. **Start at zero recurring service cost.** Development and invite-first seeding prefer free tiers and local/open-source tools. Paid subscriptions, usage billing, and automatic paid upgrades require explicit owner approval. Free-tier constraints do not override privacy, safety, audit, backup, or retention requirements.

The MVP application is a modular monolith in one repository and codebase. The accepted web runtime uses Next.js and TypeScript. Background-job responsibilities remain a distinct boundary. PostgreSQL-backed durable-job persistence, retries, idempotency, stale-lease recovery, and failed-job handling are accepted by ADR-073. A local run-once Node.js account-email entrypoint is implemented; separately deployed worker hosting and polling remain proposed until deployment and operational parameters are settled. Domain modules communicate through defined application services and committed events; they do not manipulate another module's tables through ad hoc queries.

### 2.1 Accepted stack foundation

- TypeScript across the web, server endpoint, domain, and shared validation code
- Next.js for the responsive web application and server endpoints
- Shared TypeScript domain and validation modules that do not depend on client-side trust
- PostgreSQL as the authoritative relational database standard
- Better Auth for in-application email/password authentication and session management, backed by PostgreSQL
- Brevo Free as the initial transactional email delivery provider, subject to current free-tier limits and sender-domain setup

Tailwind CSS 4 is the selected utility-first styling framework (ADR-083). Tailwind supplies styling utilities; it does not settle Halaga's visual design, component system, or design tokens, which remain governed by `design.md` and accepted design decisions.

The database access and migration tool is Prisma ORM 7, with `prisma` schema and checked-in Prisma Migrate migrations as the versioned database change path. Zod 4 is the shared TypeScript runtime validation library. The initial stable release lines are Node.js 24 LTS, Next.js 16, React 19, TypeScript 5.9, Prisma ORM 7, PostgreSQL 18, Better Auth 1.x, Zod 4, and Tailwind CSS 4 (ADR-083). Exact patch versions must be recorded in the package manifest, runtime pin, and lockfile when the runnable application is bootstrapped, and maintained with security updates. Choosing Next.js does not choose Vercel, and choosing PostgreSQL does not choose a database host. MVP listing search uses PostgreSQL under ADR-076; query tuning and performance targets remain open.

Prisma's schema and checked-in migration history must be kept aligned, with any intentionally SQL-only database features documented as schema exceptions. Migrations may contain reviewed PostgreSQL SQL for constraints and indexes that the Prisma schema cannot represent; the database remains authoritative for those invariants, and a later generated migration must not silently remove them. Do not use schema-push workflows against shared or persistent environments. Use parameterized raw SQL only where a reviewed query needs PostgreSQL-specific behavior or Prisma cannot express the required atomic operation. Zod validates untrusted inputs at server boundaries and may provide client feedback, but it does not replace domain-command checks, authorization, database constraints, or safe projections.

## 3. Actors and information scopes

### 3.1 Actors

- **Visitor:** browses and searches public active listings.
- **Eligible participant:** an adult, registered, email-verified user who may publish, inquire, offer, buy, or sell.
- **Seller:** the owner of a listing within that listing context.
- **Buyer:** a user interacting with another user's listing.
- **Reserved buyer:** the buyer attached to the listing's one active reservation.
- **Operator:** authorized staff handling held listings, verification, reports, disputes, and enforcement.
- **Scheduler:** a trusted system actor that evaluates durable deadlines and requests state transitions.
- **Notification worker:** a trusted system actor that delivers privacy-safe in-app and email notifications from recorded domain events.

### 3.2 Information scopes

| Scope | Examples | Permitted readers |
| --- | --- | --- |
| Public marketplace | title, category, derived condition, disclosed defects, approved photos, barangay | anyone |
| Account-private | date of birth, email, private contact details, private price expectation | account owner; authorized staff only when required |
| Negotiation-private | inquiry messages, proposals, intended use, acknowledged listing revision | that buyer, the seller, purpose-authorized staff |
| Reserved-transaction-private | exact appointment location, voluntary contact details, reserved price, confirmations | reserved buyer, seller, purpose-authorized staff |
| Restricted evidence | IMEI, verification documents, dispute evidence, safety reports | submitting user where appropriate and explicitly authorized staff |
| Staff/audit | review notes, findings, restrictions, prior/new state, access records | role-authorized staff and system auditors |

Every read path must select an explicit projection for one of these scopes. Public API responses, rendered metadata, search documents, logs, analytics, notifications, and caches must be treated as possible disclosure surfaces.

Server operational logs use an allowlist of fixed operation, outcome, and internal error-code values, plus a request ID only when it passes the UUID format check. Do not log request bodies, parsed inputs, credentials, session or verification tokens, date of birth, private listing fields, evidence, raw validation issues, or raw exception messages. Unexpected failures map to a generic operational code. A request handler must keep this logger call separate from error serialization so detailed errors cannot enter logs or responses by accident.

## 4. Critical flow map

### 4.1 Create and publish a listing

**Goal:** let a non-technical seller publish an evidence-rich eligible listing without choosing a value or condition judgment.

```text
Seller starts draft
  -> chooses Single item or Bundle/lot
  -> selects supported category/family
  -> describes each item/group and answers observable diagnostics
  -> system derives condition; seller corrects answers rather than overriding it
  -> seller adds barangay, fulfillment availability, description, and private expectation
  -> uploads at least two qualifying item photos
  -> supplies lock, battery, ownership, and optional IMEI facts
  -> reviews public/private summary and submits
  -> deterministic validation
       -> ineligible: reject with safe guidance
       -> ambiguous/risky: Held for review
       -> eligible: Published
```

Architecture consequences:

- Drafts may be incomplete; publication commands may not be.
- Bundle-family validation and per-item condition facts are domain rules, not interface-only validation.
- Image originals must enter a private processing path. Public derivatives are published only after metadata stripping and validation.
- The public preview must use the same public projection as the published page so private fields cannot leak through preview code.
- Submission records the ownership declaration and the exact listing revision evaluated.
- Immediate publication and held-for-review are outcomes of one validation policy; a held listing is never publicly searchable.

### 4.2 Browse, inspect, and inquire

**Goal:** let a visitor evaluate public facts and an eligible buyer privately ask questions without exposing marketplace demand or contact details.

```text
Visitor browses/searches public listings
  -> filters by category, condition, barangay, and listing type
  -> sorts by newest
  -> opens public listing projection
  -> signs in or registers to act
  -> eligibility and email verification gate
  -> buyer opens or resumes one private inquiry for the listing/seller pair
  -> sends question
  -> seller receives durable notification
```

Architecture consequences:

- Public search indexes only approved public listing fields.
- The buyer view never receives competing buyer identity, activity, messages, amounts, or offer count.
- A self-listing cannot create a buyer inquiry or proposal.
- Pre-reservation messages require moderation controls that prevent exchange of phone numbers and external handles without exposing unrelated private conversations.
- The conversation remains attached if the buyer later begins structured negotiation.

### 4.3 Submit, counter, and compare private proposals

**Goal:** preserve independent price discovery while allowing a seller to compare complete private histories.

```text
Buyer reviews current listing revision
  -> enters positive PHP amount and optional intended use/message
  -> server creates immutable proposal with fixed 72-hour expiry
  -> seller sees it in seller-only comparison view
  -> seller may reject, counter, continue messaging, or accept
  -> counter creates a new proposal and a new fixed 72-hour expiry
  -> buyer may withdraw an active proposal before acceptance
  -> material listing edit pauses affected negotiations for explicit buyer action
```

Architecture consequences:

- A negotiation groups messages and proposal history for exactly one listing, buyer, and seller.
- Only one proposal in a negotiation is currently actionable; old proposals remain historical.
- Proposal acceptance must atomically verify eligibility, current listing revision, expiry, withdrawal state, listing availability, and absence of another active reservation.
- Seller comparison is a privileged projection, not a public aggregation.
- Deadlines are stored timestamps. A delayed expiry job must be safe to retry and must never expire a proposal that was validly accepted first.

### 4.4 Accept an offer and reserve the listing

**Goal:** reserve exactly one buyer while retaining competing negotiations as privacy-preserving backups.

```text
Seller accepts active proposal
  -> transaction atomically creates Reservation with reserved price
  -> listing pauses and stops new inquiries/offers
  -> other negotiations become Paused backup offers
  -> reserved buyer and seller enter coordination
  -> backup buyers learn only that another offer is reserved
```

Architecture consequences:

- The database must enforce at most one active reservation per listing, including concurrent accept attempts.
- The reserved price copies the accepted amount but does not replace or mutate proposal history.
- Backup state belongs to each competing negotiation and cannot reveal which buyer was selected.
- Ending without completion reopens the listing and makes backups eligible for explicit reactivation; no prior proposal resumes automatically.

### 4.5 Arrange pickup or meetup

**Goal:** create a mutually accepted, structured appointment without publishing precise location.

```text
Reserved participant proposes method, PHT date/time, and private location
  -> other participant accepts or proposes a revision
  -> accepted version becomes current appointment
       -> first appointment must be within 7 calendar days of reservation
       -> no more than 2 mutually accepted reschedules
       -> appointment must remain within 14 calendar days of reservation
  -> scheduler records expiry threshold at appointment + 12 hours
  -> any appointment reminders use the appointment-specific policy when accepted
  -> before expiry, both parties may accept a structured reschedule
```

Architecture consequences:

- Free-form messages cannot create or revise the system appointment.
- Appointment acceptance atomically enforces the seven-day initial limit, two-reschedule limit, and absolute 14-day reservation horizon.
- Appointment proposals, acceptances, revisions, and current version remain distinct and auditable.
- Exact location is excluded from public projections, search, analytics, ordinary logs, and privacy-unsafe email.
- All instants are stored unambiguously; date entry, display, deadline explanations, and business-day calculations use Philippine Time rules.
- Appointment reminder timing and delivery points are not specified in ADR-063, which governs reminders after a completion confirmation. Keep this appointment-specific policy open; do not infer reminders from completion deadlines. Any eventual reminder must follow the privacy-safe notification contract in section 6.

### 4.6 Inspect, renegotiate, and confirm completion

**Goal:** distinguish the reserved price from the inspected final price and count only bilateral agreement as completion.

```text
Buyer inspects item at appointment
  -> parties proceed at reserved price, agree a different final price, or cancel
  -> either participant submits completion assertion + final PHP price
  -> state becomes Pending completion confirmation; ordinary cancellation is disabled
  -> counterpart is notified immediately and, while no response exists,
     reminded with 48h and 12h remaining
  -> counterpart submits assertion
       -> same price and completed: Mutually confirmed completed
       -> mismatch: both may self-correct through historical superseding confirmations
            -> correction deadline = earlier of 120h absolute cap or
               later of original 72h deadline and 48h after first mismatch
            -> matching pair by deadline: Mutually confirmed completed
            -> unresolved at deadline: Support case
       -> total non-response at original 72h deadline:
          Administratively closed as unconfirmed without automatic support case
```

Architecture consequences:

- Each party has its own append-only completion confirmation record.
- The transaction outcome is derived by a guarded state transition, not by updating a generic status from the client.
- Final price exists on a completed outcome only after matching confirmations; the reserved price remains historical.
- The first confirmation starts one durable 72-hour deadline and disables ordinary direct cancellation.
- A correction supersedes only that party's prior confirmation; it does not delete history or restart a deadline.
- The first mismatch fixes a correction deadline at the earlier of the 120-hour absolute cap or the later of the original 72-hour deadline and 48 hours after that mismatch.
- Total non-response and unresolved mismatch are separate outcomes: the former closes administratively without automatic support, while the latter creates a support case at its correction deadline.
- External payment status is neither collected nor inferred by Halaga.

### 4.7 Cancel, expire, and report a no-show

**Goal:** let a reservation end without falsely assigning misconduct.

```text
Before first completion confirmation:
  buyer or seller cancels with reason
    -> reservation closes immediately and historically
    -> listing/backups reopen when eligible

At appointment + 12 hours:
  scheduler attempts automatic expiry
    -> no completion started and no accepted reschedule: reservation expires
    -> listing/backups reopen when eligible

Separately:
  participant reports no-show
    -> case created
    -> accused participant notified and may respond
         -> 3 business days under Monday-Saturday PHT calendar
         -> one 2-business-day extension if requested before original deadline
    -> operator reviews evidence and records finding/action
         -> Substantiated | Unsubstantiated | Inconclusive
         -> each affected participant may appeal once within 7 calendar days
```

Architecture consequences:

- Cancellation, automatic expiry, and no-show finding are different records and outcomes.
- Scheduled expiry uses compare-and-transition semantics so it cannot race through a completion or reschedule.
- Cancellation and expiry may be evidence in a case but never create an adverse finding automatically.
- Non-response after the applicable deadline permits a decision from available evidence but never creates an automatic adverse finding.
- Urgent temporary restrictions may be applied before the deadline, but are precautionary, scoped, reasoned, and distinct from the final finding.
- Findings and actions remain operational platform decisions rather than refund, ownership, damages, or liability determinations.

### 4.8 Report material misrepresentation or safety concerns

**Goal:** collect evidence and enable bounded human remedies without claiming payment-provider or judicial authority.

```text
Eligible reporter selects report type and subject
  -> system applies type-specific timing and eligibility rules
  -> reporter supplies required structured statement and bounded evidence
       -> up to 10 images at 10 MB each
       -> up to 3 PDFs at 15 MB each
       -> external links are supplemental only
       -> relevant platform records are attached internally when authorized
  -> case is queued with urgency and service target
  -> subject is notified when policy permits
       -> 3 business days to respond under Monday-Saturday PHT calendar
       -> one 2-business-day extension if requested before original deadline
  -> operator reviews authorized platform records and submitted evidence
  -> operator records Substantiated, Unsubstantiated, or Inconclusive finding
  -> operator records reasoned and proportionate permitted actions
  -> parties receive privacy-safe outcome notifications
  -> each affected participant may appeal once within 7 calendar days
       -> new evidence, material factual error, policy misapplication,
          or material procedural failure required
       -> acknowledge within 2 business days; target decision within 5
       -> different authorized operator when available, otherwise separately
          logged reconsideration by original operator
```

Architecture consequences:

- A transaction material-misrepresentation case is buyer-only and opens within 48 hours after mutual completion.
- Safety, suspected stolen property, prohibited items, threats, harassment, fraud patterns, and account abuse use separate timing rules.
- Evidence storage is private, access-controlled, purpose-limited, and auditable.
- Originals are integrity-hashed and malware-checked; unsafe or unprocessable uploads are quarantined.
- Ordinary image preview uses metadata-stripped derivatives. Notifications link to authorized case views rather than embedding original evidence.
- Video, audio, archive, and executable evidence uploads are rejected in the MVP.
- Case priority must support urgent safety review within covered hours without promising final resolution.
- Non-response permits an evidence-based decision after the deadline, not an automatic adverse finding.
- Support may impose a reasoned, scoped temporary restriction earlier when needed to contain urgent risk; it is not a final finding.
- An appeal does not automatically stay a safety restriction; an authorized operator must change it explicitly.
- The MVP permits one appeal per affected participant and no second internal appeal.
- Case type, report, evidence, subject response, finding, and enforcement action must not collapse into a generic support ticket.

### 4.9 Operator reviews a held listing

**Goal:** resolve ambiguous safety, policy, ownership, privacy, taxonomy, or evidence triggers before publication.

```text
Validation creates Held for review with explicit trigger(s)
  -> operator queue prioritizes risk and age
  -> authorized operator opens public candidate data and necessary restricted evidence
  -> operator approves, requests/captures correction, rejects, removes, or escalates
  -> decision, reason, actor, evidence access, and state change are audited
  -> seller receives privacy-safe decision notification
```

Architecture consequences:

- Review access is role- and purpose-restricted; sensitive evidence is not copied into general notes or logs.
- Approval publishes a known reviewed revision. Subsequent material edits undergo validation again.
- A hold is neutral workflow state, not a violation finding.
- Queue age and service targets are observable operational metrics.

### 4.10 Operator reviews professional/business verification

**Goal:** issue a bounded trust signal after human review of private evidence.

```text
User chooses Business or Professional Technician application
  -> submits required public profile fields and private evidence
  -> operator reviews source evidence and records decision
  -> approved badge becomes visible on public profile
  -> rejected/withdrawn application remains private
  -> material profile change, credible report, or suspected fraud triggers re-review
  -> revoked/withdrawn evidence enters six-month retention period
```

Architecture consequences:

- Public profile data, private applicant identity/contact data, evidence objects, review history, and badge state are separate projections.
- Badge display communicates only the accepted verification meaning; it is not an expertise or outcome guarantee.
- Evidence access and review actions are auditable.
- A denial or revocation may be appealed once under ADR-078; restricted evidence remains private during appeal review.

## 5. Cross-flow state and race requirements

The following transitions require a transaction or equivalent concurrency control around the authoritative records:

- publishing a validated listing revision;
- accepting a proposal and creating the one active reservation;
- applying a material edit and pausing offers or requiring buyer reconfirmation;
- accepting or revising an appointment while computing its expiry threshold;
- canceling or expiring a reservation;
- submitting the first completion confirmation and disabling ordinary cancellation;
- matching the second completion confirmation and completing the transaction;
- administratively closing an unconfirmed transaction;
- applying operator corrections or enforcement;
- blocking account deletion while any unresolved workflow exists.

Each command must be idempotent for client retries and background-job retries. A command records the actor, target, causation/correlation identifier, prior state, resulting state, timestamp, and reason where applicable.

The authoritative transactional state is stored in one relational system of record. Search documents, analytics facts, notification deliveries, and other read-optimized projections are derived and rebuildable. Images, verification documents, and case evidence are private object-storage blobs referenced by relational metadata; object storage does not own workflow state.

Durable asynchronous work initially uses PostgreSQL rather than an external queue. The transaction that changes domain state atomically records an outbox event and any required durable job. A proposed Node.js worker claims work under an expiring lease, invokes idempotent guarded commands, records the outcome, and can recover work from a stale lease after a crash. Transient failures use bounded exponential backoff; permanent or exhausted failures enter a role-restricted failed-job queue for diagnosis and controlled retry. Deadline jobs retain their original due instant even when a worker executes them late.

The initial logical model and system-boundary diagrams are maintained in `docs/architecture/DOMAIN_MODEL.md`.

Slice 2 signup now commits its initial verification token digest, AES-GCM-encrypted private delivery payload, minimized intent and job row atomically with identity, credential and account state. Verification resend, reset and email-change issue/replacement do the same for their token family. The internal dispatcher checks current account/token/binding/expiry under the established locks, suppresses stale work, and uses the ADR-088 fenced lease and recovery rules. Raw tokens never enter generic intents, responses, logs or rendered-message storage. Routes and worker deployment remain unmounted. Route integration must also settle sign-in/reset concurrency; current library sign-in does not share account-owned locks. See `docs/SIGNUP_LOCAL_TESTING.md`, `docs/EMAIL_VERIFICATION_LOCAL_TESTING.md`, `docs/PASSWORD_RESET_LOCAL_TESTING.md` and ADR-087/088.

Slice 2 also implements unmounted email change under ADR-087. Request resolves
the session owner, locks identity/domain mapping and rechecks the exact stored
session for validity and creation age below 15 minutes. It leaves the old verified
address active while replacing only its own 24-hour token and recording minimized
verification intent. Token storage binds the identity, domain account ID, current
and proposed addresses. Proof locks and rereads account/token/eligibility/address/
expiry guards; the unique email constraint arbitrates competing address claims.
One transaction consumes proof, switches/verifies the address, updates the domain
verification timestamp, removes stored sessions and records old-address notice intent.
Write/commit failure preserves old state and proof for retry. Other token families
and account history remain intact. Because an account reference alone resolves to
the new address after a switch, a narrow additive private `recipientEmail` snapshot
is required for that security-notice event only; an SQL check excludes it from
other intent types. The notice omits the proposed address and other unnecessary
private data. See `docs/EMAIL_CHANGE_LOCAL_TESTING.md` and ADR-087 for the privacy
review and synthetic checks. The migration is replayed only in disposable schemas.
Delivery transport and internal dispatch/recovery are implemented under ADR-088.
Cookie integration remains in the unmounted handler. Library sign-in/session creation racing reset or email proof does
not share these account-owned locks and requires integration review before mounting.

Unmounted authenticated password change resolves the stored-session owner without
refreshing the session, snapshots the domain mapping and hashes using Better Auth's
configured limits/hasher. It locks identity/domain mapping, credential and initiating
session in that order. It rechecks mapping, deletion, credential binding, exact
session/token ownership, expiry and creation age below 15 minutes, verifies the
current locked password and rechecks freshness before writing. One transaction
replaces the existing credential and deletes every other session; the initiating
session remains unchanged. Failures roll back both effects for same-session retry.
Other account state, tokens and history are preserved. Synthetic checks cover these
guards and account-owned reset/verification/email-proof races. Library sign-in still
does not share these locks; sign-in racing replacement remains an integration gate.
ADR-087's owner-approved 2026-10-15 supplement now settles the notice contract:
mandatory durable account-private in-app notice for every success, with email only
to a primary address verified in both stores at commit. The independent in-app part
now commits one notice and its fixed eligibility outcome with credentials/sessions.
After acquiring identity/domain locks, a separate statement reads both verification
stores; event time is checked after current-password verification. A random event ID
and unique channel work key make the synchronous notice its processed-work record;
no in-app worker or additional delivery boundary is needed. No email intent or
recipient snapshot is created while password-change copy and ordinary recipient
retention/cleanup remain unresolved. This remains partial compliance and unmounted.
See `docs/PASSWORD_CHANGE_LOCAL_TESTING.md`. The additive in-app migration is replayed
only in disposable schemas; no dependency or mounted flow is added. Prisma application
and shared signup-sandbox connections explicitly use UTC because the installed
adapter normalizes timestamptz offsets without conversion; PHT domain/display rules
remain unchanged.

The 2026-10-15 Slice 2 integration adds an unmounted Better Auth plugin and handler
response boundary over these same operations. Synthetic requests traverse the
installed library limiter and origin/CSRF checks; only admitted requests reach the
account commands. Direct API calls cannot bypass admission. Fixed generic request
responses exclude issue material. Committed verification/reset/email proof clear
cookies; password change preserves its initiating cookie. `/account` mounts static,
disabled previews only. This supersedes earlier statements that no UI or endpoint
integration code exists, while all account API commands remain unmounted.
ADR-088 now supplies encrypted token handoff, approved templates/fragment links,
stale-intent suppression and account-email dispatch/recovery. Password-change notice
writes, link-page integration, worker deployment, staff recovery and library sign-in
races remain mounting gates. See `docs/ACCOUNT_FLOW_INTEGRATION.md` and
`docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`.

Independent Slice 2 intent inspection returns fixed statuses. The separate internal
dispatcher has its own PostgreSQL claim, account/token recheck, stale suppression,
Brevo send and fenced outcome write; inspector results are not send authorization.
Initial signup now owns its verification token and encrypted delivery payload.
ADR-088 accepts templates/link behavior, retry and crash recovery, token replacement,
and bounded retention. The dispatcher is not mounted and no worker is deployed;
staff retry/audit and link-page integration remain gates. See
`docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`.

### Serialized sign-in and local mounting (updated 2026-10-18 PHT)

`account-flows.signIn` now coordinates the unchanged Better Auth 1.7.7 sign-in API
with account-owned commands. An outer Prisma transaction locks identity/mapping
and credential rows; an adapter bound to that transaction client handles all library
credential/state reads and session insertion. An empty lock lookup fails generically
rather than authenticating an identity that appears later. Response/cookies return
only after commit. No hook or adapter `transaction: true` flag alone spans this flow.
Backend/transaction tracing and PostgreSQL blocking-backend observations prove the
boundary through the installed adapter. Both command lock orders, rollback/retry,
verification state, stored sessions and unrelated-account isolation are checked.

This supersedes earlier internal race-gate wording in this document for the new
operation. The protected HTTP integration now uses this operation with
ADR-086 endpoint/IP limits, configured-origin admission, Better Auth's first-login
CSRF middleware and fixed safe response/cookie handling. `auth/base.mjs` installs
an ambient adapter for HTTP requests; the operation must explicitly use core
`runWithAdapter` to bind its transaction adapter, because `getCurrentAdapter`
otherwise overrides the new auth instance's fallback adapter. Only fixed success
status and the configured session cookie leave after commit; failures emit no
cookies. PostgreSQL handler tests cover shared counters, both revocation orders,
rollback/retry and commit visibility. POST `/api/auth/sign-in/email` and its
accessible email/password form are now mounted for local synthetic testing only,
in addition to the unchanged six email commands. Exact route dispatch opts into
the protected sign-in handler; generic plugin defaults still exclude sign-in.
Success remains on-screen. No dashboard, redirect, session reader or marketplace
authorization is added. This supersedes earlier mounting/client status and the
sign-in mounting gate in section 8.2 only. Raw library sign-in remains
unserialized. Signup and password-change routes remain closed.
Unverified users retain sign-in access; verification/proof never creates a session
and revokes sessions committed before it. See `docs/SIGN_IN_LOCAL_TESTING.md` for
the trace, tests and configuration/upgrade limits. No accepted policy, glossary
meaning, scheduler, delivery rule or deployment choice changes.

### Current account-email integration (2026-10-16 PHT)

This update supersedes the historical unmounted email-route/link statements above.
Only six POST paths under `/api/auth` are mounted: verification resend/completion,
reset request/completion and email-change request/proof. The shared installed
Better Auth handler still enforces endpoint/IP limits, configured origin, CSRF,
exact path/body validation and single-use request admission. Signup, sign-in,
password change and every other library endpoint remain unreachable. No session
creation path is exposed, so unresolved library sign-in races are not activated.
Email change requires an existing fresh synthetic stored session.

Account-owned commands retain their locked account/token guards, atomic completion
and revocation. Completion clears cookies after commit. Client pages read and clear
the fragment on hydration, hold tokens only in component memory, and POST to the
same origin. Navigation clears the token; refresh requires reopening the email.
Responses use no-store/no-referrer, and pages load no third-party resources.

`npm.cmd run jobs:account-email` invokes recovery/cleanup followed by at most one
fenced dispatch in the existing Node.js runtime. No persistent web background task,
polling interval, hosted scheduler or additional queue is introduced. Provider sends
require explicit `ACCOUNT_EMAIL_SENDING_ENABLED=true`; credentials alone do not
enable delivery. Disabled invocations still recover/clean without claiming work.
Before SENDING, the job checks its lease again after account/credential/token waits.
Job recovery and expired-token cleanup commit separately to avoid holding job locks
while waiting on token locks. Accepted/suppressed/expired payloads can be erased
under a forward SQL constraint correction; minimal metadata retains ADR-088's period.

Hosted execution, provisioning, staff reconciliation/audited retry, session/counter
cleanup and ADR-081 real-data readiness remain open. This adds no operational
cadence or new product policy. See `docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`.

## 6. Flow-level notification contract

State changes first commit the domain record and a durable notification intent in the same transaction. Delivery occurs asynchronously.

Notification rendering uses channel-specific, privacy-reviewed templates:

- In-app notifications may link to authorized private detail but still reveal only what the recipient may access.
- Email omits private offer amounts, IMEI values, exact locations, unnecessary message text, and restricted evidence.
- Failed email delivery does not roll back the domain action.
- Read/unread state belongs to in-app delivery, not to the underlying domain event.
- Duplicate worker execution must not create duplicate logical notifications.

Authenticated password change follows ADR-087's owner-approved notice contract.
Every successful change requires one account-private in-app notice; email is
mandatory only if the locked primary address has Better Auth `emailVerified = true`
and a non-null domain `emailVerifiedAt` no later than the event time. Unverified,
mismatched or future-dated verification receives no email intent/snapshot, without
blocking password maintenance, repairing verification or granting marketplace access.
Later verification does not backfill the notice.

Under the existing identity/domain, credential, initiating-session lock order,
reread the primary address and both verification states. Credential replacement,
other-session revocation, in-app intent and eligible email intent/immutable recipient
snapshot must commit together. Intent-write failure rolls back all effects; later
delivery failure does not. Use one opaque committed-change identity and channel-
specific work keys/processed-work records, never password/session/address-derived
keys. Distinct changes in one session remain distinct; rejected commands add no notice.

If password change at verified A commits before email proof switches to B, its
notice remains bound to A even after the switch; changed primary alone must not
suppress it. The email-switch notice is separate. Proof first revokes the initiating
session and prevents that password change and its notice; a later fresh-session
change binds to B. Pending email changes cannot redirect notices. Verification races
use commit-time eligibility with no later backfill.

Allow only the change fact, PHT event time, accurate session-revocation facts and
approved recovery guidance. Omit credentials/tokens, session IDs, IP/device/location,
DOB, display name, addresses in subject/body and marketplace/private content.
Owner-only in-app detail, purpose/role/audited staff access and minimized worker
projections apply. Snapshots are delivery-private, excluded from generic readers,
logs, analytics, caches and responses. ADR-073/075 govern duplicate suppression,
retry/recovery and delivery failure; provider-accept/crash reconciliation remains
unresolved. Recipient/attempt retention, cleanup, deletion propagation and final
templates remain gates; neither transaction retention nor intent history authorizes
indefinite recipient storage. The independent in-app store now contains only account
reference, opaque event/work identity, versioned event type, event time, fixed email
eligibility and nullable read time. Its unmounted owner-only reader returns event
identity/type/version/time/read state after a current stored-session and undeleted
mapping check in the read statement; it excludes email eligibility/work metadata.
No final copy, email snapshot, generic/staff reader, analytics or cache is added.
ADR-088's four approved messages do not settle password-change copy or its ordinary
recipient/metadata cleanup and delayed/deleted-account rules. Email intent/binding
and dispatch coverage stay blocked on those decisions. In-app retention/deletion
execution remains a real-data readiness gate, not indefinite retention permission.

## 7. Screen-design handoff

The current low-fidelity specification is maintained in `docs/design/WIREFRAMES.md`.
The accepted laptop diagnostic prototype is maintained in `docs/design/LAPTOP_DIAGNOSTICS.md`.

The flow map implies the following first mobile-first screen set:

1. Listing wizard with category/bundle branching, diagnostics, safety/lock questions, photo evidence, public/private review, and hold/rejection outcomes.
2. Marketplace results and public listing detail with no demand leakage.
3. Private inquiry and negotiation thread with structured proposal cards.
4. Seller offer comparison with private expectation visible only to the seller.
5. Reservation overview and structured appointment proposal/acceptance.
6. Inspection outcome and two-party final-price confirmation.
7. Cancellation, no-show report, and material-misrepresentation/safety report flows.
8. Operator queues and detail views for held listings, verification, cases, evidence, and findings.

Each screen must be tested for narrow mobile widths, desktop layouts, keyboard-only use, visible focus, semantic reading order, screen-reader announcements, 200% and 400% zoom/reflow, non-color state cues, accessible validation, image alternatives, and text alternatives to maps.

## 8. Decision and readiness status

Latest local signup implementation record (2026-10-18 PHT): the catch-all now
dispatches exact POST `/api/auth/sign-up/email` to `signup-http.ts`, alongside
protected sign-in and the six email commands. Its one-path plugin allowlist calls
the existing atomic signup operation; raw library signup remains unexposed.
Configured-origin, installed first-login CSRF, endpoint/IP limits, fixed safe
responses and no-store/no-referrer apply. No session or private response projection
is introduced. Private DOB/attestation and identity/credential/token/encrypted
delivery-intent writes remain one transaction. The registration form is functional
for local synthetic data only. Email sending stays disabled; tests inject a fake
provider. This supersedes earlier signup closure/client statements, not accepted
policy or the open decisions in §8.2. Password-change mounting, terms/privacy,
restrictions, staff recovery, hosted operations and ADR-081 readiness remain gated.
See `docs/SIGNUP_LOCAL_TESTING.md` for the verified boundary and limitations.

This is an architecture working draft, not an implementation-ready specification. Product and architecture decisions are authoritative in `PROJECT.md` and accepted ADRs; this section tracks what is settled and what still blocks implementation or pilot readiness.

### 8.1 Accepted architecture decisions

- TypeScript, Next.js, shared TypeScript domain/validation modules, and PostgreSQL are the stack foundation (ADR-072).
- The application is a modular monolith; PostgreSQL is the relational system of record (ADRs 069–070).
- PostgreSQL-backed outbox and durable jobs, bounded retries, expiring leases, idempotency, failed-job handling, and controlled retries are accepted. A separate Node.js worker remains the proposed runtime, not a final deployment decision (ADR-073).
- Better Auth and Brevo Free are selected for authentication and transactional email (ADRs 074–075).
- ADR-086 sets seven-day rolling sessions with daily renewal, 15-minute sign-in freshness for sensitive changes, host-only secure production cookies, and explicit endpoint rate limits. ADR-087 sets atomic signup, adult attestation, verification, reset and email-change behavior. ADR-088 sets encrypted account-email handoff, templates/links, delivery retries/recovery and retention. Slice 2 implements internal account transactions, six protected email-only routes, fragment forms and a local run-once Node.js dispatcher. Signup/sign-in/password change stay closed; hosted worker scheduling, password-change notice writes, sign-in races, staff recovery and provider/readiness setup remain gates. Restrictions and full command authorization are separate gates. See `docs/IMPLEMENTATION_SLICES.md` and `app/README.md` for implemented versus gated boundaries.
- MVP search uses PostgreSQL, not a separate search service (ADR-076).
- Prisma ORM 7 and versioned migrations follow ADR-083. ADR-084 settles the first foundation's UUIDs, exact centavo money and versioned per-question JSON diagnostic storage. The first account/listing migration enforces revision FKs, storage checks and publication history constraints; the physical review records SQL-only triggers and the native `btree_gist` availability exclusion. Marketplace commands and their authorization/audit/outbox gates remain unimplemented.
- Public-pilot recovery targets are RPO ≤24 hours and RTO ≤24 hours; these must be demonstrated in a restore test, not assumed from a provider's marketing (ADR-082).
- Uncompleted private negotiation content has six-month retention (ADR-077); retention exceptions are narrowly scoped and periodically reviewed (ADR-079).
- Moderation and verification decisions have one bounded internal appeal (ADR-078); pilot operations require a trained alternate and a coverage gate (ADR-080).
- Completion reminders and mismatch deadlines follow ADR-063. Appointment reminder timing remains an open, separate policy because ADR-063 addresses completion confirmations only.

### 8.2 Open decisions before implementation or public pilot

These decisions must be recorded rather than inferred in code. Some are needed before implementing the affected feature; others are explicit launch gates.

**Product, policy, and operations**

- Listing renewal limits, grace period, and the `Newest` timestamp behavior after renewal/material republication.
- Whether to send appointment reminders and, if so, their timing and delivery rules (separate from ADR-063 completion reminders).
- Handling an account discovered to be underage.
- Password-change notice implementation: ADR-087's owner-approved supplement settles mandatory in-app notices, verified-only commit-bound email and content/privacy limits. Atomic in-app persistence/eligibility recording is implemented. Final password-change email copy, ordinary recipient/metadata retention and cleanup, dependent atomic email intent/binding/delivery and sign-in races remain gates before mounting. ADR-088 supplies generic account-email transport, dispatch/recovery and terminal retention mechanics for its four supported messages; do not silently extend the unresolved event-specific rules. The unmounted operation remains partial for the approved contract.
- Category-request waitlist behavior and diagnostic questions/safe-testing guidance for supported categories beyond the laptop prototype.
- External emergency or law-enforcement escalation procedure.
- Service availability, performance, browser support, PWA position, and storage-capacity targets.
- Backup purge timing and deletion propagation under the eventual providers.
- IMEI/device-identifier blocklist integration remains deferred unless a pilot requirement is established.

**Deployment, infrastructure, and operations**

- Web and worker hosting/deployment, PostgreSQL hosting/connection model, backup/restore implementation, object storage and image/evidence processing providers, and observability/analytics implementation.
- Final Node.js worker deployment, polling schedule, alert thresholds, rollout compatibility and recovery runbook. ADR-088 sets the account-email two-minute lease and bounded 429 retry policy; other job classes still need policies.
- ADR-087 settles signup, adult attestation, verification (24-hour single-use), password reset (one-hour single-use), email change, generic account-request responses, and session-revocation behavior. ADR-088 settles encrypted private handoff, account email content/links, dispatch and terminal retention. Session, cookie, freshness and endpoint/IP limits remain as accepted in ADR-086. The six email-only routes and cookie/link integration are implemented. Signup, sign-in and password-change mounting still require their remaining flow protection, notice writes and sign-in race work. Session/token/counter cleanup, password-change notice writes, restricted staff reconciliation and production secret provisioning/rotation remain open. Production origin and trusted client-IP header require deployment review; no proxy/provider is assumed. Endpoint limits do not cover direct `auth.api` calls, so future external wrappers need equivalent protection. Exact dependency/runtime patches are pinned at application bootstrap; provider-supported PostgreSQL minor patch and upgrade policy are verified when hosting is selected.
- Early validation uses local/private environments and synthetic data. Real participant data and public-pilot deployment are gated on documented privacy, backup/restore (RPO ≤24h/RTO ≤24h), retention/deletion, worker-recovery, availability, and quota checks or an explicitly approved, costed exception (ADRs 071, 081, 082).

**Validation and design completeness**

- Wireframes and domain boundaries exist as drafts, but have not been validated with users, tested across desktop/mobile/accessibility criteria, or expanded into complete state-transition tables.
- The logical model is not a physical schema; privacy projections, constraints, and race requirements still need implementation-level verification.

## 9. Remaining architecture deliverables

Several deliverables from the original sequence now exist in draft form; their validation or completion is outstanding:

| Deliverable | Current artifact/status | Remaining work |
| --- | --- | --- |
| Critical user/operator flows | Section 4; detailed policy is in `PROJECT.md` and ADRs | Validate flow comprehension with intended users; resolve open policy decisions before affected implementation |
| Mobile-first screen design | `docs/design/WIREFRAMES.md`, low-fidelity specification | Usability tests, desktop layouts, keyboard/screen-reader/zoom/reflow checks, and accessibility verification |
| Laptop condition prototype | `docs/design/LAPTOP_DIAGNOSTICS.md`, accepted first English prototype | Test task comprehension and safe completion with sellers; other supported categories still need validated question sets before pilot |
| Domain model and boundaries | `docs/architecture/DOMAIN_MODEL.md`, initial logical model and diagrams | Complete state-transition tables, refine physical constraints/projections, and validate privacy and concurrency requirements |
| Architecture decisions | ADR-069 through ADR-082 plus earlier product ADRs | Decide remaining providers/operations through evidence-based ADRs; reconcile accepted choices here and in `PROJECT.md` where product policy changes |
| Thin end-to-end slice | Acceptance path identified below; not implemented or tested | Build and verify listing creation -> private offer -> seller acceptance -> appointment -> matching completion confirmations, including durable-job and authorization behavior |

The reference category for diagnostic prototyping, usability testing, and the thin slice is **Laptops**. This sequencing choice does not remove or postpone the other supported MVP categories from pilot readiness.
