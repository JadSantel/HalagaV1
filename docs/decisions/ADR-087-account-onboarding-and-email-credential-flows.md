# ADR-087: Define Account Onboarding and Email/Credential Flows

- Status: Accepted
- Date: 2026-10-14
- Password-change notice supplement approved by owner: 2026-10-15 PHT
- Account email delivery supplement: ADR-088, accepted 2026-10-15 PHT on explicit owner request
- Password-change copy/retention/deletion supplement: ADR-089, owner-approved 2026-10-20 PHT; supersedes historical open-policy statements below, without mounting commands/readers/UI.
- Supplements: ADR-032, ADR-042, ADR-074, ADR-075, ADR-086, ADR-088

## Context

ADR-074 selects Better Auth and requires a stable mapping to Halaga's account,
adult eligibility, verified email for marketplace actions, password reset, and
durable email. ADR-042 requires private DOB and an explicit, versioned adult
attestation. ADR-086 settles sessions, cookies, freshness, and endpoint limits,
but deliberately left token lifetime, resend and email-change behavior open.
No account route is mounted. These product and privacy decisions must precede
registration, verification, reset, and email-change routes.

## Decision

### Signup and eligibility

- Signup captures display name, email, password, DOB, and a separate unchecked
  adult-eligibility checkbox. The authoritative English attestation is: “I
  confirm that I am at least 18 years old and eligible to participate in
  Halaga.” Store version `adult-eligibility-en-v1` and its acceptance timestamp.
  Increment the version when the authoritative wording changes.
- Reject a DOB that does not establish age 18 or older before creating either
  identity or domain records. Discard that submitted DOB; do not create a pending
  underage account. This does not decide how to handle an account later found to
  be underage.
- Create the Better Auth identity and the mapped private `user_account` at
  signup. Unverified users may sign in and browse, as ADR-074 allows; marketplace
  commands still require adult eligibility, verified email and their other
  applicable authorization checks.
- Commit the auth identity, domain mapping, private DOB, attestation version and
  timestamp, and initial verification-email job intent atomically. If any write
  fails, roll back signup. If delivery later fails, keep the account unverified
  and retry through the durable job path; delivery failure does not undo signup.

### Verification and reset

- Email-verification tokens expire 24 hours after issue and are single-use. A
  verification resend replaces and invalidates the previous outstanding token.
- Consume a verification token, set Better Auth's identity verification state,
  and set the domain `emailVerifiedAt` atomically. If any write fails, none of
  those changes commits and the token remains usable for retry.
- Verification does not establish an authenticated session. Revoke existing
  sessions and require a fresh sign-in after successful verification.
- Password-reset tokens expire one hour after issue and are single-use. Issuing
  another reset token replaces and invalidates the previous outstanding token.
- Complete password replacement, token consumption, and revocation of every
  active session atomically. The user must sign in again after reset.
- Signup, verification-resend, and password-reset request responses do not
  reveal whether an email is registered, duplicated, or already verified. Use
  the same generic confirmation; create email work only for an eligible request.

### Password and email changes

- Keep ADR-086's requirement that password and email changes start with a valid
  session created less than 15 minutes earlier. Rolling renewal does not renew
  freshness.
- A successful password change revokes every other active session and keeps the
  fresh current session.
- An email change starts a 24-hour, single-use verification for the proposed
  address. Until it is proved, the current email remains primary and verified;
  marketplace actions continue under that existing verification.
- Successful proof consumes the token, atomically replaces the Better Auth
  address and updates the domain verification timestamp. The new address is
  verified at the switch; no second verification or intervening action lock is
  required. Revoke every session, require sign-in again, and send a
  privacy-reviewed security notice to the old address.
- A failed or expired email-change attempt leaves the old address active. A
  later change request supersedes the prior outstanding change token.

### Password-change security notices (owner-approved 2026-10-15)

This explicit decision resolves the earlier trigger/recipient gap. The general
account-security delivery clause alone did not require a password-change notice.
The owner approved the recommendation and contract in
[`docs/PASSWORD_CHANGE_NOTICE_DECISION_BRIEF.md`](../PASSWORD_CHANGE_NOTICE_DECISION_BRIEF.md).
It applies to authenticated password change, not password reset.

- Every successful change requires one mandatory, durable, account-private in-app
  security notice. Email is mandatory only when the primary address has both
  Better Auth `emailVerified = true` and a non-null domain `emailVerifiedAt` no
  later than the event time, reread under the committing transaction's locks.
- Unverified accounts, either mismatch direction and future verification timestamps
  receive the in-app notice but no email intent or recipient snapshot. Record a
  fixed private email-eligibility outcome without address copies. Do not block
  password maintenance, repair verification or grant marketplace access. Later
  verification does not backfill email for an earlier change. These notices are
  essential security messages, not an optional marketing preference.
- Reuse identity/domain, credential and initiating-session lock order. Atomically
  commit credential replacement, other-session revocation, the in-app notice intent
  and any required email intent with its immutable recipient snapshot. Required
  intent-write or commit failure rolls back all effects. The earlier session lookup
  is not authoritative for address or verification. Permit only account reference,
  versioned event type, opaque change/work identifier, event time, channel/eligibility
  outcome and eligible email recipient as needed. Deduplication keys must not derive
  from passwords, sessions or addresses.
- Bind email to the verified primary address at the successful change. If password
  change commits at A before email proof switches to B, deliver that warning to A;
  do not retarget or suppress it merely because the primary address later changes.
  Email proof still creates its separate old-address notice. If proof commits first,
  its session revocation rejects password change from the old initiating session:
  no password-change notice results. A subsequent fresh-session change binds to B.
  Pending email-change requests cannot select a recipient. Verification races use
  the same locked commit-time eligibility, without later backfill.
- Content may state that the password changed, its PHT event time and that other
  sessions were revoked while the initiating session remained signed in. Do not
  identify who acted or guarantee that no later session exists. Guidance may ask
  the recipient to open Halaga directly and use approved recovery if unexpected.
  Do not invent a support contact, origin, recovery URL or action token. Final
  subject/body/template review remains required.
- Omit passwords/hashes, tokens or credential-bearing links, session IDs, IP/device/
  location information, DOB, display name, current/new/pending addresses in subject
  or body, private messages, proposal amounts, IMEI and evidence. The recipient is
  delivery addressing only: exclude it from generic readers, operational logs,
  analytics, caches and command responses. In-app detail is owner-only. Staff
  access requires role, purpose and audit; workers use recipient/channel projections.
- Each committed change has one stable logical event identity with channel-specific
  work keys and processed-work records. Retries/lease recovery reuse those keys;
  distinct changes in the same session remain distinct. Failed/rejected commands
  create no notice. Apply ADR-073's expiring leases, recovery, bounded exponential
  backoff, restricted failed-job queue and audited controlled retries. Exactly-once
  mailbox delivery is not guaranteed across provider-accept/crash ambiguity;
  provider idempotency/reconciliation remains a dispatch gate. Email failure never
  undoes committed credentials, changes verification or chooses a fallback address.
  The durable in-app record remains available independently of email delivery.
- Recipient snapshots are private delivery data retained only for approved delivery/
  recovery purposes, then deleted or irreversibly anonymized under an approved
  cleanup rule. Minimal delivery metadata has its own classification. Transaction
  and negotiation periods do not set notice-recipient retention. Ordinary periods,
  cleanup, delayed-work/account-deletion handling and provider/backup deletion remain
  readiness gates. ADR-079's scoped exceptions require review at least every 30
  calendar days; they do not establish a missing ordinary retention period.

This favors avoiding disclosures to unproved mailboxes over external warnings for
unverified users. In-app notices cannot reliably reach an owner locked out by an
attacker, and verified email cannot protect a compromised mailbox or guarantee
prompt delivery. Existing password/session controls remain necessary.

Acceptance is not full implementation. The independent in-app notice writes are now
implemented, but email intent/binding/delivery remain blocked and the operation must
remain unmounted (see the 2026-10-17 implementation record below). The current
SQL recipient constraint permits only the email-switch notice; no schema expansion,
provider credentials, delivery or participant data is introduced by this supplement.
Separate job, template, retention, sign-in race and launch-readiness gates remain.

### Delivery, limits, and implementation boundary

- Verification, reset, and account-security email use the accepted durable
  PostgreSQL outbox/job path and privacy-reviewed templates (ADRs 073 and 075).
  Persist each email intent atomically with the token or account-state change
  that causes it, including the initial verification intent in the signup
  transaction. Delivery failure never marks an address verified and never
  rolls back a committed account, email change, or password change.
- Keep all ADR-086 endpoint/IP rate limits and shared-counter semantics. Do not
  add a per-account lockout, new numeric limit, or direct unprotected external
  `auth.api` wrapper through this decision.
- Do not inherit Better Auth token defaults. Implementations must demonstrate
  the specified atomic writes and token replacement with synthetic tests before
  mounting a route. If an atomic flow cannot be implemented, keep that route
  unmounted until it can.
- This ADR selects no cleanup schedule, production origin, trusted proxy/header,
  account-deletion process, hosting provider, or paid service. ADR-081's
  synthetic-data and launch-readiness gates remain in force.

## Consequences

- The account schema needs to store the adult-attestation text version. Signup
  and verification/reset/email-change handlers must coordinate Better Auth,
  domain state, and durable email intent under the agreed transaction boundaries.
- Email verification and email-change success invalidate active sessions, so
  their responses must clear the current host-only cookie. Reset also requires
  a new sign-in; password change preserves only its current fresh session.
- Token expiry does not select a retention or cleanup schedule. Expired token,
  pending email-change, session, and rate-counter cleanup remain separately
  gated by the approved retention and operations decisions.
- Discovery that an existing account is underage remains deferred in
  `PROJECT.md` section 34.

## Implementation record: unmounted signup (2026-10-14)

The account-owned signup repository now coordinates Better Auth's installed
identity/credential format, configured password hasher/limits, mapped domain
account, private DOB, approved attestation version/timestamp, and minimized
verification-email outbox intent inside one Prisma transaction. It does not call
the library signup endpoint or issue sessions/tokens. The adapter's unique email
constraint arbitrates concurrent normalized-email signup; duplicates return the
same confirmation without adding resend work or repairing legacy identities.

The additive migration leaves the new attestation-version column nullable for
legacy rows without fabricating acceptance history. New signup always fills it.
The persistence-only `outbox_event` stores the account reference, event type and
version, unique logical-work key, creation timestamp and null dispatch timestamp.
No email, DOB, credential or token copy is stored in the intent. Dispatch/job
materialization remains unimplemented; no lease, retry allowance or schedule is
selected. Future delivery must satisfy ADR-073 before consuming these records.

Synthetic tests require a separate loopback `halaga_signup_test` database and
remove their random schema afterward. They exercise validation, each required
write failure, deferred commit failure, durable intent, normalized-email races,
retry and actual Better Auth credential sign-in compatibility. Direct identity
writes do not run library signup hooks; review this integration on library/schema,
password configuration, plugin or database-hook changes. No signup hooks/plugins
are configured currently. See `docs/SIGNUP_LOCAL_TESTING.md` for direct local
testing, migration details and remaining boundaries. All account routes and email
delivery remain unmounted. Separate verification and reset implementations are
recorded below, including email-change atomic flows. This record
changes no accepted policy or deployment setting.

## Implementation record: unmounted email verification (2026-10-14)

The account-owned verification repository now issues opaque 32-byte random tokens
with a 24-hour lifetime. The existing private Better Auth verification table stores
the namespaced SHA-256 digest, identity reference, target-email binding and timestamps.
This does not use the library verification JWT/default lifecycle or invoke its hooks.
No schema migration or dependency is added.

Issue/replacement and consumption lock the same identity and domain mapping.
Issue replaces the prior outstanding namespaced token and records a minimized,
token-specific verification-email outbox intent in one transaction. Missing,
unmapped, deleted or already verified identities produce no token/work. The raw
token is returned only to trusted internal/synthetic callers after commit, never
as a public request response. Future resend handlers must use generic confirmations
and ADR-086 protection. Initial signup intent and pending intents are not dispatched.

Consume validates the reread token, current address, undeleted mapping, unverified
states and expiry after locking. One transaction consumes the token, sets both
verification states and deletes existing sessions for that identity. Write or
commit failure rolls back every effect and preserves the token for retry before
expiry. It creates no session; fresh Better Auth sign-in sees matching verified
states. Existing account-private projections remain unchanged.

Eleven local synthetic checks cover successful verification/fresh sign-in, expiry
at exactly 24 hours and the last valid millisecond, reuse, replacement, each required
write failure and deferred commit failure, retry, current-address binding, ineligible
requests, concurrent resends/consumes and unrelated-account isolation. The dedicated
signup sandbox sets its pooled search path so raw lock queries share model-query
isolation; fixtures and triggers are removed with the random schema afterward.

See `docs/EMAIL_VERIFICATION_LOCAL_TESTING.md` for direct manual examples and setup.
No route/UI, cookie response boundary or email delivery is mounted. Outbox records
contain no recoverable raw link; durable private token transport, stale-intent
handling and the full ADR-073 dispatch/job path remain integration work. No retry
allowance, cleanup schedule, retention change or deployment setting is selected.

## Implementation record: unmounted password reset (2026-10-14)

The account-owned password-reset repository issues opaque 32-byte random tokens
with a one-hour lifetime. The existing private verification table stores a
separate namespaced SHA-256 digest, identity reference, current-address binding
and timestamps. Issue/replacement locks the identity/domain mapping and existing
credential, replaces only the previous reset token and atomically records a
minimized, token-specific password-reset email outbox intent. Unknown, unmapped,
deleted or missing/ambiguous credential identities produce no token/work. Both
verified and unverified mapped password identities can reset. Raw issue material
returns after commit only to trusted internal/synthetic callers; future request
handlers must return generic confirmations and enforce ADR-086 protection.

Consume uses the configured Better Auth password hasher/limits outside the
transaction, then locks and rereads account, credential, token, current address
and original expiry. One transaction consumes the token, replaces the existing
credential hash and removes every stored session for that identity. Neither
verification state, private eligibility history, separate verification token nor
unrelated account/provider credential is changed. No new session is established.
Write, hash or commit failure leaves old state available for retry before expiry;
successful replay is rejected. Direct writes bypass library reset hooks, so
library/schema/password configuration/plugin/hook changes require integration review.

Local synthetic PostgreSQL checks cover expiry boundaries, replacement/reuse,
each required write and deferred commit failure, same-token retry, hasher/input
failures, private-safe errors, address/credential guards, verified/unverified and
mismatched verification states, concurrent issue/consume, verification/reset races,
unrelated isolation, old-cookie rejection and fresh Better Auth sign-in compatibility.
The existing dedicated loopback sandbox removes its random schema afterward.
See `docs/PASSWORD_RESET_LOCAL_TESTING.md` for manual success, expiry, replacement,
reuse, issue failure and write/commit failure/retry exercises.

No route, UI, cookie-response boundary or email delivery is mounted. Durable
private token transport, stale-intent handling, full ADR-073 dispatch/jobs and
sign-in/reset race integration remain gates; library sign-in currently does not
share these locks. No dependency, migration, cleanup schedule, retry allowance,
retention change or deployment setting is selected. This record changes no policy.

## Implementation record: unmounted email change (2026-10-14)

The account-owned email-change repository resolves the owner through Better
Auth's stored-session API, with cookie cache disabled, then locks the existing
identity/domain mapping and rechecks the exact stored session under lock. The
session must be valid and created less than 15 minutes earlier; renewal does not
renew freshness. Both commands require undeleted mapped adult prerequisites and
matching verified identity/domain state. No caller-selected account ID is accepted.

Request leaves the existing verified address primary. It atomically replaces
only the prior namespaced email-change token and records a minimized,
token-specific verification intent. The existing private verification table
stores a SHA-256 digest of a random 32-byte token and a strict binding of domain
account ID, current address and normalized proposed address. Expiry is 24 hours
after issue. Raw material returns only after commit to trusted synthetic/internal
callers; no private token transport is mounted.

Proof locks and rereads the account and token, rechecks mapping, eligibility,
creation time, original expiry, both addresses and proposed-address availability.
The existing unique email constraint arbitrates racing claims. One transaction
consumes the token, switches and verifies the auth address, updates domain
verification time, removes every stored session and records the old-address
security-notice intent. Write or commit failure preserves old state and the token
for retry before expiry. Account identity/history, eligibility data, credentials,
separate verification/reset tokens and unrelated accounts remain intact.

Schema review found one blocker: the original account-reference-only outbox
cannot identify the old recipient after the identity switches to the new address.
The narrow additive migration `20261014100000_email_change_notice_recipient`
adds a nullable private recipient snapshot. Its SQL check requires the snapshot
only for `account.email-changed-security-notice` and forbids it for other event
types. Earlier intents remain null. The migration is exercised only in disposable
schemas; it is not applied to persistent local/deployed data. No dependency is added.

The version-1 intent privacy review permits only the old recipient, account
reference, digest-based work key and event time. It excludes the proposed/new
address, raw token/link, DOB, password, session, IP and rendered message. Future
rendering may state that the email changed and sessions were revoked; it must
not fetch the new address into that notice. Recipient access remains delivery-
purpose-only or authorized/audited staff diagnosis. It is private delivery data,
excluded from generic/public readers, logs, analytics and caches. Approved
retention/deletion rules apply; intent history does not authorize indefinite
recipient retention. No template, retention period or cleanup schedule is selected.

Sixteen local synthetic PostgreSQL checks cover fresh-session boundaries,
replacement, expiry, single use, missing/deleted/remapped accounts, eligibility,
address conflicts, each write and deferred commit failure, same-token retry,
concurrent requests/proof/address claims, post-resolution session rechecks,
locked expiry, history/token/account isolation, stored-session revocation,
fresh Better Auth sign-in and old-recipient intent minimization/schema enforcement.
See `docs/EMAIL_CHANGE_LOCAL_TESTING.md` for direct manual exercises and results.

Routes, UI, cookie-response boundary, token transport and email delivery remain
unmounted. Durable dispatch/jobs and stale-intent suppression remain gates.
Library sign-in/session creation does not share account-owned locks; old-address
sign-in racing proof still requires route integration review. Direct writes
bypass library email-change hooks; recheck compatibility on library/schema/plugin
or hook changes. No deployment, paid service, retry allowance, deletion process,
retention change or marketplace authorization policy is selected by this record.

## Implementation record: unmounted authenticated password change (2026-10-15)

The account-owned password-change operation resolves ownership through Better
Auth's stored-session API, with cookie caching and refresh disabled for this call.
It accepts current/new passwords and server request headers, never an account ID.
Disabling refresh prevents renewal writes outside the credential transaction;
ordinary session reads retain ADR-086 rolling renewal. It snapshots the domain
mapping and uses the configured Better Auth password limits/hasher. Under the same
identity/domain lock order as verification/reset/email change, it rereads that
mapping, requires an undeleted account and exactly one existing correctly mapped
password credential, then locks/rechecks the exact stored initiating session.
Session creation age must be below 15 minutes, with a valid expiry and no future
creation timestamp. The existing library current-password requirement is retained:
the configured verifier checks the locked current hash, then freshness is checked
again. Concurrent changes cannot verify against an outdated credential hash.

One transaction updates only that credential and removes every other stored
session, preserving the initiating session exactly. No new session is created.
Verification states, private eligibility/history, separate verification/reset/
email-change tokens, other provider credentials, existing intents and unrelated
accounts remain intact. Write or deferred commit failure rolls back both effects;
the same fresh session and old credential can retry. Results and errors are fixed,
minimal values without private material, raw exceptions or causes. Missing legacy
credentials/mappings are rejected, never repaired. No migration or dependency is
needed for this bounded operation.

Thirteen reported local synthetic tests cover input and configured limits, exact
freshness/expiry boundaries, renewal without freshness, retained/revoked cookies,
missing/deleted/remapped accounts, malformed credentials, hash/verify/write/commit
failure, rollback/retry, lock waits, post-resolution changes, history/token/account
isolation, competing same/different-session changes and reset/verification/email-
proof races. Eight direct manual exercises also pass. The existing dedicated
loopback sandbox removes its random schema afterward. See
`docs/PASSWORD_CHANGE_LOCAL_TESTING.md` for commands, outcomes and integration gates.

**Historical notice gap, resolved by the owner-approved supplement above:** the
original password/email-change decision explicitly
requires an old-address notice for an email switch. The general delivery clause
mentions account-security email and committed password changes, but specifies no
password-change notice trigger or recipient. PROJECT section 8.5 states session
behavior; architecture section 6 requires atomic persistence of required intents,
without defining that missing trigger. These passages do not settle whether a
password change requires a notice. Trigger, recipient and minimized intent/template
privacy review need an explicit decision before dependent notice implementation.
This slice adds no notice intent and does not accept omission as product policy.
The credential/session transaction proceeds independently as requested.

The earlier gap analysis above records the state before owner approval; it is not
a current open policy. The operation still adds no required notice work.

Routes, UI, email delivery and endpoint integration remain unmounted. Implement the
approved required atomic intents, integrate origin/CSRF/endpoint
limits, safe errors and response cookies, and settle sign-in/session creation racing
credential replacement before mounting. Library sign-in does not share account-owned
locks. Direct writes bypass change-password hooks; review library/schema/password
configuration/plugin/database-hook compatibility on changes. Existing durable-job,
cleanup/retention, deployment and ADR-081 readiness gates remain. This record changes
no accepted product behavior, notice policy, operational parameter or launch gate.

## Implementation record: protected synthetic integration and screen previews (2026-10-15)

An unmounted Better Auth plugin now composes the existing account-owned operations
without duplicating transactions or accepting an account ID. Synthetic HTTP tests
exercise the installed handler's origin/CSRF checks and endpoint/IP limiter, with
request admission rejecting direct API calls even when supplied a Request. Fixed
generic request responses discard restricted issuance results. A handler response
boundary sanitizes failures and prevents caching, including early limiter returns
that bypass plugin response hooks. Successful verification/reset/email proof clear
configured cookies after commit; password change preserves its initiating cookie.

`/account` now mounts disabled, static previews for registration, sign-in,
verification/resend, reset request/completion and email/password changes. They
collect no information and invoke no command. All account API routes remain
unmounted. Integration code is used only in synthetic fixtures and is not installed
in application auth. No runtime enable flag is provided.

The token transport blocker is now explicit: digest-only private token storage
and minimized outbox intents cannot recover raw delivery material after the trusted
issuer returns. Signup has only an initial intent. No accepted decision specifies
durable private transport, crash-safe handoff or stale-intent suppression, and the
ADR-073 dispatcher/retry/recovery parameters remain unresolved. Discarding issued
tokens in public handlers is not a working delivery mechanism. No recoverable token
is added to generic outbox records, response, URL or log; no alternative transport,
cleanup schedule or operational parameter is selected.

At this integration record's creation the notice policy was unresolved. The later
owner-approved supplement resolves trigger/recipient; required atomic notice writes
remain a separate mounting gate. Sign-in/session creation racing account changes also
remains unresolved; this plugin does not expose sign-in. See
`docs/ACCOUNT_FLOW_INTEGRATION.md` for exact blockers, endpoint contracts, screens,
the 106 reported passing backend tests, build/lint results and accessibility limits.
This record changes no accepted policy, privacy boundary or launch gate.

## Implementation record: delivery blocker and independent intent inspection (2026-10-15)

The requested four-message durable delivery path remains blocked. ADR-073 accepts
durability mechanisms but explicitly defers polling/lease/heartbeat/retry allowances,
alerting and recovery operations. ADR-075 requires privacy-reviewed templates but
approves no account-message copy/link contract. This ADR's existing implementation
records explicitly leave recoverable private token transport and crash/stale-work
handling unresolved. PROJECT §28 and architecture §8.2 supply no transport/attempt/
notice-recipient retention or cleanup schedule. These passages are complementary;
the delivery mandate does not supersede the unresolved privacy/operations gates.
No new decision is accepted by this implementation record.

Schema review confirms digest-only `verification` rows and minimized intents cannot
recover links. Initial signup has no token association. Existing schema also lacks
job/attempt/lease/failure/processed-work state. A new migration must follow an
accepted transport/job design; none is introduced speculatively. Required decisions,
source passages and direct manual instructions are recorded in
`docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`. No encryption/storage choice,
template, token URL, operational number, retention period or provider adapter is
selected. Fake-provider rendering/retry/recovery tests remain blocked and unrun.

Independent synthetic work adds an unmounted account-owned intent inspector. It
returns fixed status only, never addresses, token/binding/digest material or raw
diagnostics. It rechecks existing token/account/recipient-binding/expiry guards
under account locks, including expiry after credential waits, without mutating
tokens/intents or dispatching. Email-change shares the existing strict binding
schema. The notice branch reads only the old-recipient snapshot and never the
identity's current/new address. Initial signup is explicitly unbound; no resend
token is borrowed or generated. Repeated inspection is read-only; its transaction
locks end at commit, so its result is not send authorization or job deduplication.
It defines no delayed/deleted-account notice policy.

Thirteen local tests cover intent bindings, stale/consumed/replaced/expired work,
cross-account isolation, malformed/header-injection bindings, snapshot-only notice
reads, minimized outputs/errors, deferred commit rollback/retry and actual lock
waits. The combined existing account/foundation/logging regression run passed 119
tests; all four direct manual intent exercises, lint and build passed. Initial
example-credential authentication and synthetic fixture-clock failures were
corrected and rerun; see the local guide for exact results. Delivery itself,
all job/provider checks and account API mounting remain
gated; disabled static previews collect no data. No migration, dependency, real
email, participant data, paid service, provider credential or deployment is added.

## Implementation update: account email delivery accepted (2026-10-15)

ADR-088 supersedes this ADR's historical delivery-blocker notes for durable private
transport, approved account-email copy/link behavior, dispatch, stale-intent
suppression, crash recovery and retention. Signup now commits its initial token and
encrypted payload; resend/reset/email-change issue commands write the encrypted
payload atomically and suppress queued replaced work. The separate dispatcher and
cleanup remain unmounted pending route/link integration, worker deployment, staff
recovery authorization and launch readiness. See ADR-088 and
`docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`.

## Implementation update: bounded email-link integration (2026-10-16 PHT)

The owner's next-slice request is implemented through ADR-088's latest record.
Six email-only POST commands now reuse the protected handler and guarded consumers;
fragment forms and the local run-once job runtime are implemented. Sending defaults
off. This supersedes older statements that all account APIs and link pages remain
unmounted. Registration, sign-in and authenticated password change stay closed;
required password-change notices and library sign-in races remain gates. Production
worker hosting/scheduling, staff retry/audit and ADR-081 readiness are not resolved.
No product rule, notice policy or operational cadence changes.

## Implementation record: independent password-change in-app notices (2026-10-17 PHT)

This record implements existing policy without changing its trigger or recipient.
ADR-088 approves exactly four version-1 email messages, none for password change.
Its retention rule covers those supported deliveries. PROJECT §§8.5/25/34 and this
ADR's specific password-change supplement still require final copy review and an
approved ordinary recipient/metadata cleanup rule, including delayed/deleted-account
handling. The newer generic mechanics do not silently settle that specific scope.
No password-change email intent, snapshot, template, send or email backfill is added,
even when the recorded eligibility outcome is ELIGIBLE. This is partial implementation,
not an accepted policy exception; password change stays unmounted.

The existing locked credential operation now atomically materializes one owner-private
`password_change_notice` row per successful change. The account's two verification
states are read after identity/domain locks and checked against event time after
password verification. Required notice-write/commit failure rolls back credentials,
all revocations and the notice. A random change UUID and unique in-app work key
identify the event independently of password, session, address or time; the row is
also its synchronous processed-work record. No async in-app materializer is added.
Distinct successes in one session at the same instant remain distinct. Rejected
commands create no notice; rollback/retry leaves one committed record.

An unmounted owner-only detail reader selects only event identity/type/version,
event time and nullable read time. Its read statement rechecks the exact stored
session and undeleted owner mapping. No recipient, rendered copy, generic/staff
reader, new logging or cache is added. The SQL recipient constraint remains limited
to the separate email-switch warning. The additive in-app migration is replayed
only in disposable synthetic schemas. No persistent/shared migration is run.
UTC is explicit on application Prisma and shared sandbox connections to avoid the
installed adapter's offset-stripping timestamp conversion; PHT rules are preserved.

Synthetic tests cover eligibility combinations/future timestamps, actual lock waits,
both verification/email-proof orders, pending changes, write/deferred-commit rollback,
retry, distinct and duplicate work, owner isolation, safe outputs/log silence and
independence from failure/repeated execution of already supported email work. This
does not test password-change email delivery or recipient binding; those remain
unimplemented. See `docs/PASSWORD_CHANGE_LOCAL_TESTING.md` for results and gates.

## Implementation record: serialized internal sign-in (2026-10-17 PHT)

`createAccountSignInOperation`, composed as `account-flows.signIn`, now invokes
the unchanged installed Better Auth 1.7.7 sign-in API with a Prisma adapter bound
to an outer account-locking transaction. Identity/mapping and credential locks
precede library credential/state reads and remain through session commit. Empty
lock results cannot authenticate an identity appearing afterward. Response/cookies
return only after commit; failures expose fixed codes without raw errors or logs.

PostgreSQL tests verify both orders and observed waits for password change, reset,
verification, email proof and synthetic verification clearing, including actual
stored state, rollback/retry, backend/transaction identity and unrelated-account
isolation. Unverified users may still sign in. Verification/proof creates no
session and revokes sign-ins committed earlier; a waiting sign-in authenticates
only against the state reread after proof. This implements existing policy.

This supersedes earlier internal sign-in race limitations only for this operation.
Raw library sign-in remains unserialized; HTTP limiter/origin/CSRF/cookie/client
integration is still required. Signup, sign-in and password-change routes remain
closed. Password-change email, retention and other readiness gates remain unchanged.
See [SIGN_IN_LOCAL_TESTING.md](../SIGN_IN_LOCAL_TESTING.md) for installed-source
trace, verification results and upgrade/configuration review requirements.

## Implementation record: protected unmounted HTTP sign-in (2026-10-17 PHT)

The protected plugin now replaces `signInEmail` and invokes only the serialized
`createAccountSignInOperation`, preserving ADR-086's configured origin, endpoint/IP
limiter and the installed first-login `formCsrfMiddleware`. Installed HTTP handling
sets an ambient adapter; the operation now explicitly scopes `runWithAdapter` to
its transaction adapter so nested API calls cannot escape the account transaction.
Success emits only `{"status":"SIGNED_IN"}` and the configured host-only session
cookie after commit. No auxiliary cookie, token/user body, redirect or private
account field is returned. Fixed safe failures emit no cookies or raw logs.

Disposable synthetic PostgreSQL handler tests cover unverified access, shared
five-per-minute counters across instances, origin/CSRF, safe errors, cookie
attributes, insert/commit rollback and retry, and both revocation lock orders.
Verification/proof still creates no session, revokes earlier sessions and requires
a new sign-in. This supersedes the preceding record's HTTP-integration gate only.
The sign-in factory is used only in tests: application wiring remains email-only;
signup/sign-in/password change stay unmounted and their previews disabled.
Functional clients, password-change email and existing operational/readiness gates
remain incomplete. No product policy, dependency, migration, service or schedule
changes. See [SIGN_IN_LOCAL_TESTING.md](../SIGN_IN_LOCAL_TESTING.md) for results.

## Implementation record: mounted local synthetic sign-in (2026-10-18 PHT)

The owner authorized local sign-in integration only. POST `/api/auth/sign-in/email`
now dispatches to the existing protected handler and serialized operation, alongside
the unchanged six email commands. The handler singleton uses the existing ADR-086
configuration. Generic plugin defaults and email-only paths still exclude sign-in;
raw Better Auth handlers/APIs remain unexposed. Fixed JSON, commit-before-cookie,
origin/CSRF, shared limits and cookie/header policies are preserved.

An accessible email/password form replaces the sign-in preview using existing
account styles. It provides pending, linked field errors, authentication failure,
rate-limit, uncertain/network and persistent success feedback with appropriate
focus/live regions. Success stays on-screen. No dashboard, redirect contract,
session endpoint, eligibility repair or marketplace grant is added. Unverified
sign-in remains permitted; adult/verified marketplace prerequisites remain intact.

Actual Next route checks and browser-to-route-to-database verification use a
disposable synthetic schema. Existing race/rollback tests remain passing. See
[SIGN_IN_LOCAL_TESTING.md](../SIGN_IN_LOCAL_TESTING.md) for commands and limitations.
This supersedes earlier sign-in mounting/client status only. Signup and password
change remain closed. Password-change copy/recipient retention/cleanup, staff
recovery and all ADR-081 launch gates remain unresolved or incomplete. No new
policy, dependency, migration, real mail, service or deployment is introduced.

## Implementation record: mounted local synthetic signup (2026-10-18 PHT)

After local sign-in mounting, the owner explicitly authorizes local synthetic
signup only. POST `/api/auth/sign-up/email` now uses a one-path protected handler
over the existing plugin and `createSignupOperation`. The installed library's
first-login `formCsrfMiddleware` is preserved when replacing signup, alongside
configured-origin admission and ADR-086 limits. Raw library signup remains closed.
The exact unchecked attestation is shown in the accessible registration form;
`adult-eligibility-en-v1` and acceptance time are stored only by the server.

The existing atomic identity/credential/mapping/eligibility/token/encrypted delivery
intent transaction remains unchanged. Underage DOB is rejected before persistence.
New, duplicate and already-verified email requests receive the same fixed
`REQUEST_RECEIVED`, without private data, session creation or signup cookies.
Verification remains separate, revokes prior sessions and requires sign-in again.
Sending stays disabled. Actual application-route and optional installed-browser
checks use disposable synthetic schemas; delivery is faked. See
[SIGNUP_LOCAL_TESTING.md](../SIGNUP_LOCAL_TESTING.md) for results and limits.

This implements existing policy and supersedes prior signup mounting/client status
only. It does not approve terms/privacy copy, real participant use, public deployment,
password-change mounting or email delivery changes. Password-change event-specific
email decisions/implementation and all existing ADR-081 readiness gates remain.
No dependency, migration, service, worker schedule or glossary change is introduced.

## Sources

- `PROJECT.md` sections 8, 26, 28, 33, and 34
- `architecture.md` sections 3, 5, 6, and 8.2
- ADR-032, ADR-042, ADR-073, ADR-074, ADR-075, ADR-081, ADR-085, and ADR-086
- Owner's account-flow decision interview, 2026-10-14
- Owner approval of the password-change notice brief and contract, 2026-10-15 PHT
