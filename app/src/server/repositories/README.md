# Server repository boundary

Current sign-in boundary (2026-10-17 PHT): `sign-in.ts`, composed as
`account-flows.signIn`, uses the installed Better Auth API with an adapter bound
to the identity/mapping/credential-locking Prisma transaction. Its private
response/headers return after commit; fixed errors contain no causes or raw
library output. The transaction adapter factory stays in `server/prisma.ts`.
The operation adds no public/domain reader, route or authorization grant.
Raw `auth.api.signInEmail` and the library handler do not acquire these locks;
`sign-in-http.ts` now supplies an unmounted protected handler using that operation,
the installed limiter/origin/first-login CSRF checks and a fixed success/session-cookie
projection. The operation explicitly binds the installed ambient adapter context to
the transaction adapter even inside another handler. Failures expose no cookies.
See [the trace and tests](../../../../docs/SIGN_IN_LOCAL_TESTING.md).
This supersedes internal sign-in race and HTTP-integration status below for this path.
Signup/sign-in/password-change mounting and password-change email remain gated.

The laptop practice draft stays in browser memory. Slice 2 adds an unmounted
account-private prerequisite reader for existing synthetic account mappings.
No public, staff or marketplace workflow reader is implemented. An unmounted signup
writer now coordinates private identity, credentials, eligibility and outbox intent.
Unmounted verification commands issue/replace private tokens and atomically consume
them, synchronize verification states and revoke sessions.
Unmounted password reset atomically replaces credentials, consumes its separate
one-hour token and revokes sessions while preserving verification states.
Unmounted email change keeps the old verified address active during pending proof,
then atomically switches/verifies the address, revokes sessions and records the
private old-address notice intent. Its initiating session must be fresh under locks.
Unmounted authenticated password change rechecks the stored-session owner, mapping,
credential and original session freshness under locks, then atomically replaces the
credential and revokes other sessions while retaining the initiating session exactly.
Its security-notice contract is accepted under ADR-087's owner-approved supplement:
in-app notice for every success, email only to the primary address verified in both
stores at commit. Atomic in-app notices and fixed locked eligibility are implemented;
email intent/snapshot/delivery stay gated on password-change copy and ordinary
recipient/metadata cleanup decisions. Keep the operation and owner detail unmounted.

## Module access

| Module | Permitted access |
| --- | --- |
| `src/server/repositories/account-email-intents.ts` | Trusted internal account-module inspection. Explicit guard projections check token work and old-recipient snapshots; output is fixed status without addresses/tokens/bindings/digests. Notice branch never reads the new address. It is not dispatch authorization. |
| `src/server/repositories/account-email-dispatch.ts` | Internal dispatcher and cleanup only. Claims one job under a fenced PostgreSQL lease, rechecks account/token/binding/expiry, renders fixed templates and sends through Brevo. Fixed status output; no route, participant/staff reader or operator retry. UNKNOWN work is not retried automatically. |
| `src/server/prisma.ts` | Construct and share the generated Prisma client using the installed PostgreSQL adapter and validated server configuration. This is infrastructure, not an authorization service. |
| `src/server/repositories/auth.ts` | Construct the unmounted Better Auth account instance with ADR-086 policy and the infrastructure adapter. Better Auth owns private identity/session/token/counter tables; this is not a domain authorization grant or a public data reader. |
| `src/server/repositories/accounts.ts` | Stored-session owner resolution and explicit account-private prerequisite projection; no DOB/email/token output, cache, staff access or action grant. Cookie headers remain private auth transport. |
| `src/server/repositories/signup.ts` | Internal account-owned transaction coordinating identity/credential, password limits, mapped account, private DOB/attestation, initial verification token/digest, encrypted delivery payload and minimized outbox intent. No session, route, Server Action or synchronous email. |
| `src/server/repositories/email-verification.ts` | Internal account-owned, namespaced token issue/replacement with encrypted delivery payload and minimized intent; suppresses queued replaced work in the same transaction. Consumption atomically verifies both stores and revokes sessions. No route, Server Action or synchronous email. |
| `src/server/repositories/password-reset.ts` | Internal account-owned, one-hour reset-token issue/replacement with encrypted delivery payload and minimized intent; suppresses queued replaced work atomically. Credential replacement, token consumption and session revocation remain atomic. No route or synchronous email. |
| `src/server/repositories/email-change.ts` | Internal account-owned, fresh-session 24-hour bound-token replacement with encrypted delivery payload; proof atomically switches the address, revokes sessions and records an old-address notice plus seven-day delivery job. No route or synchronous email. |
| `src/server/repositories/password-change.ts` | Internal credential replacement with stored-session owner resolution, locked mapping/credential/session rechecks and original creation age below 15 minutes. Atomic credential/revocation/in-app-notice writes preserve the initiating session, verification and tokens. Fixed eligibility reads both verification stores after account locks; no email intent/snapshot. Separate unmounted owner-only detail rechecks the exact stored session and undeleted mapping and selects only ID/type/version/event/read time. No generic/staff reader, cache or log. Email and mounting remain gated. |
| `src/server/account-access.ts` | Server-only adult eligibility and publication/inquiry/proposal prerequisite rejection; restrictions, blocks and target/state authorization remain separate gates. |
| `src/server/repositories/` | Other server-only reads belong to the owning module, after verifying the caller and selecting an explicit authorized projection. |
| `src/app/` and other application modules | Consume scoped repository methods when they exist. No direct Prisma, generated database client, or PostgreSQL driver imports. Current pages read no persisted records. |
| `src/server/runtime-config.ts` | Parse configuration; no database access. It is also used by Prisma CLI and local tooling. |
| `src/server/guarded-command.ts` | Sequence validation, trusted actor resolution, state/authorization checks and transaction-scoped writes supplied by the owning repository. It has no database imports, concrete product command, or default permission policy. |
| `src/server/operational-log.ts` | Emit fixed operational metadata and an optional primitive UUID string. No database access, request/input/error serialization, or restricted audit access. Sink failures cannot alter command results or errors. |
| `src/server/foundation-validation.ts` and `src/domain/` | Validate inputs and derive domain values; no database access or authorization grant. |
| `scripts/` and database verification tests | Local operator tooling with existing loopback guards, metadata checks, and rolled-back synthetic fixtures. They are not request handlers or repository APIs. |

`account-flows.ts` now composes these existing operations for the unmounted
`src/server/account-flow-plugin.ts` integration. It adds no transaction or reader.
The plugin and safe handler adapter run only in synthetic fixtures; no API route,
Server Action or application auth instance installs them. `/account` renders disabled
static previews without persisted data. These additions supersede older “no UI/
endpoint integration” status statements below, while account API commands remain
unmounted. See `docs/ACCOUNT_FLOW_INTEGRATION.md` for protected admission and real
limiter/cookie verification. ADR-088 resolves account email transport and delivery
mechanics; link-page handling,
password-change notice writes, worker/staff deployment and sign-in races remain gates.

## Current email-only integration (2026-10-16 PHT)

This update supersedes historical unmounted email-route statements in this guide.
`account-email-http.ts` composes the protected installed handler with an explicit
six-path email allowlist. The Next.js POST route calls that boundary; pages never
import database infrastructure. Other library/account endpoints remain closed.
`account-email-worker.ts` runs recovery/cleanup and at most one dispatch, exposed
by the local `jobs:account-email` command. Only fixed outcomes reach the logger;
provider sends default off. Hosted scheduling and staff/audited retry remain gates.
See `docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md` for verification and limitations.

## Data scopes and ownership

This matrix maps the accepted information scopes and module boundaries from
`architecture.md` section 3 and ADRs 069, 070, and 074 to the logical modules in
`docs/architecture/DOMAIN_MODEL.md`. Only the owner account prerequisite reader
is implemented; remaining scope entries describe requirements for future APIs.
Internal signup, email-verification, password-reset, email-change and password-change writes are implemented; no marketplace action grants exist.

| Data scope | Permitted server reader when implemented | Permitted writer when implemented |
| --- | --- | --- |
| Public marketplace | Listings repository: explicit approved public listing/profile projection, after visibility and applicable blocking checks. Search consumes only that projection. Public candidates and held/draft revisions are not public records. | Listings module's guarded commands own revisions and lifecycle. Profiles/accounts own their public profile fields. Derived search updates use committed events and cannot publish a listing. |
| Account-private | Accounts/eligibility or profiles repository for the verified owner; listings repository for the seller's private expectation. Staff access requires explicit role, purpose, and audit. | Owning accounts, profiles/verification, or listings guarded commands, with actor/eligibility/state checks. The accounts module coordinates signup identity/credential writes with domain state and outbox intent under ADR-087 using the installed Better Auth format and hasher. Better Auth owns session, token and private operational counter writes under ADRs 074/086. No account routes or domain authorization grants are mounted. |
| Negotiation-private | Negotiation repository for that buyer and seller; seller comparison may read the seller's negotiations. Staff reads require purpose authorization and audit. Buyers never receive competing-buyer activity. | Negotiation guarded commands own inquiries, messages, and proposal history. Cross-module transitions use defined commands/services in the shared transaction. |
| Reserved-transaction-private | Reservations/transactions repository for the reserved buyer and seller; purpose-authorized, audited staff only. | Reservations/transactions guarded commands own reservation, appointment, confirmation, and outcome records. They preserve revisions, deadlines, bilateral completion, and one active reservation. |
| Restricted evidence | Owning profiles/verification, listings identifier, or cases repository: submitting-user access only where permitted; staff need explicit role, purpose, and access audit. No general evidence reader. | Owning profiles/verification, listings, or cases guarded commands and authorized processing/retention work own metadata/state. Private object bytes do not establish domain state or publication. |
| Staff/audit | Audit or owning staff/case repository for role-authorized staff/system auditors. Participant findings/notifications require a separate authorized projection. | Owning commands atomically record required action/history metadata through the audit boundary. Operational logs cannot substitute for audit/access history. |

Notification workers read recipient/channel-specific projections through owning
services. Schedulers and retention jobs use trusted system actors and guarded
commands; worker identity does not permit unrestricted reads or cross-module
writes. Jobs/outbox, search, analytics, notifications, staff access, and retention
execution are not implemented. Their accepted requirements remain gates.

## Adding the first repository method

- Import `server-only` in every repository module. Import `getPrisma` from
  `../prisma`; never create another database client or re-export the client.
- Verify the request/session or trusted system actor on the server. An account
  ID supplied by a caller is not proof of ownership. Staff reads additionally
  require the documented role, purpose, and access audit.
- Apply the relevant visibility, ownership, workflow state, revision, deadline,
  and blocking checks before returning data. Account prerequisites do not make
  incomplete restrictions or other command guards authoritative.
- Use an explicit Prisma `select` for the scope in `architecture.md` section 3.
  Return only a named, minimal projection. Do not expose full records, credentials,
  session/reset/verification tokens, private media object keys, or raw errors.
- Keep private responses out of public caches, metadata, logs, and client props
  that are outside the caller's permitted scope. Database credentials and a
  server-only marker do not grant access to a record.
- Server logs use `logOperationalEvent` with fixed operation/outcome/code fields
  and an optional UUID request ID. Never log request bodies, parsed input,
  session data, validation issues, or raw exceptions. Convert unexpected errors
  to `INTERNAL_ERROR`; preserve details only in restricted, purpose-limited
  audit records when the product flow explicitly requires them.
- Verify authorized and denied callers with synthetic fixtures when adding the
  method. Do not add publication, negotiation, or discovery reads as a shortcut.

`npm.cmd run lint` enforces the import boundary and server-only markers. These
rules are development checks, not runtime authorization. The shared client is
created lazily on first use and reused across development module reloads. A
running web request must not disconnect it after each query. Hosting connection
limits and worker runtime integration remain open decisions.

## Command integration

A repository defining a concrete command may supply the shared client's
interactive `$transaction` as the runner for `defineGuardedCommand`. Its state
loader and write callback must use only that transaction handle. State loading
selects the minimum authorized guard data; the write callback returns an explicit
result projection. The helper does not sanitize an arbitrary result or make an
unverified actor trustworthy. Validation, actor resolution and guards do no writes.

The generic helper is currently demonstrated only with session-local synthetic
PostgreSQL tables in `tests/guarded-command.test.mjs`. No account or marketplace
command is implemented by that helper. Separate account-owned signup and verification
commands, plus password reset and email change, have their own synthetic transaction
checks. See `docs/PASSWORD_RESET_LOCAL_TESTING.md` and
`docs/EMAIL_CHANGE_LOCAL_TESTING.md` for direct manual exercises.
Email-change request resolves the session owner and rechecks freshness under locks;
proof rechecks token/mapping/address/eligibility/deadline guards and atomically
switches/verifies the address, revokes sessions and records old-address notice intent.
The outbox's private old-recipient snapshot is restricted to that notice type;
never expose it in generic event readers or log it. ADR-088 supplies encrypted
transport and dispatch/recovery; routes, worker deployment, cookie response
integration and sign-in racing account changes remain unmounted/gated.
Password change has separate isolated transaction checks and direct manual exercises
in `docs/PASSWORD_CHANGE_LOCAL_TESTING.md`. Session resolution disables refresh for
that operation to avoid pretransaction renewal writes. It preserves the initiating
session exactly. The accepted contract's required in-app write is implemented,
while email intents/recipient binding are not; password
change stays unmounted pending final email copy/recipient cleanup and other gates.
Atomicity alone does not enforce retry idempotency,
concurrency, revision/deadline policy, history, or audit/outbox requirements.
Those remain mandatory before implementing the affected flow. See `app/README.md`
for the command sequence, verification boundary, and unresolved auth settings.
