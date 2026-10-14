# ADR-087: Define Account Onboarding and Email/Credential Flows

- Status: Accepted
- Date: 2026-10-14
- Supplements: ADR-032, ADR-042, ADR-074, ADR-075, ADR-086

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
delivery remain unmounted. Separate verification implementation is recorded below;
reset/email-change atomic flows remain unimplemented. This record changes no
accepted policy or deployment setting.

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

## Sources

- `PROJECT.md` sections 8, 26, 28, 33, and 34
- `architecture.md` sections 3, 5, 6, and 8.2
- ADR-032, ADR-042, ADR-073, ADR-074, ADR-075, ADR-081, ADR-085, and ADR-086
- Owner's account-flow decision interview, 2026-10-14
