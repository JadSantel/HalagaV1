# Serialized sign-in: local synthetic verification

Implemented 2026-10-17 PHT, Slice 2. This implements ADR-086/087 without
changing policy. Signup, sign-in and password-change routes remain closed;
account previews remain disabled. No password-change email path is added.

## Installed-library trace and boundary

Inspected Better Auth, core and Prisma adapter **1.7.7**, not an assumed hook
contract. Relevant installed files under `app/node_modules/`:

- `better-auth/dist/api/routes/sign-in.mjs`: `signInEmail` validates the email
  and password length, calls `internalAdapter.findUserByEmail` with accounts,
  selects the bound credential, verifies its hash, reads identity verification,
  calls `internalAdapter.createSession`, then creates cookies and the response.
- `better-auth/dist/db/internal-adapter.mjs`: the email lookup uses the current
  adapter's user/account join. Session creation uses `createWithHooks`.
- `better-auth/dist/db/with-hooks.mjs`: session `create.before` runs before the
  adapter insert; `create.after` queues after-transaction work where applicable.
  Neither supplies a boundary covering the earlier credential/state read.
- `better-auth/dist/api/to-auth-endpoints.mjs`, `api/dispatch.mjs` and
  `@better-auth/core/dist/context/transaction.mjs`: endpoint/request context and
  sequential before/after hooks do not automatically enclose sign-in in a
  transaction. A before hook's completed transaction cannot protect later reads.
- `@better-auth/prisma-adapter/dist/index.mjs`: `findOne` uses its captured
  client's `findFirst` and joined account queries; `create` uses that client's
  model create. `transaction: true` enables an adapter transaction callback;
  it does not make every endpoint use it. The adapter accepts an existing
  Prisma transaction client; `transaction: false` avoids nested transactions.

`app/src/server/repositories/sign-in.ts` provides
`createAccountSignInOperation(database, auth)(headers, input)`. It is composed
as `account-flows.signIn` but no endpoint invokes it. Input permits only email,
password and optional rememberMe. No owner ID, callback URL or alternate auth
flow is accepted. Successful authentication still runs the installed library's
unchanged `api.signInEmail`, password verifier, session persistence and cookies.

One outer Prisma transaction locks the identity/domain mapping by normalized
email, then its credential, in the account commands' existing order. After any
wait, the library rereads credentials and identity verification through an
adapter bound exclusively to that transaction client. Locks remain held through
session insertion and commit. An empty identity/mapping lock result fails with
generic credentials rejection, using the configured dummy hash for bounded
passwords. A later email proof/signup therefore cannot cause an unlocked identity
to appear in the library lookup and authenticate. No eligibility repair occurs.

`getTransactionAuthDatabase` stays in `src/server/prisma.ts`, preserving the
existing database-driver import boundary. The temporary auth instance uses the
account auth options, with only its database adapter replaced. The current
configuration has no secondary session storage, custom plugins, database hooks
or email callbacks. Reinspect and rerun these checks on library/schema/adapter,
password, hook/plugin or storage changes. Raw `createAccountAuth().api.signInEmail`
and its handler remain unserialized library primitives; they are not a supported
route integration. Do not expose them in place of this operation.

The operation returns Better Auth's private `{ response, headers }` only after
commit. That internal result includes session material and account-private identity
fields; do not log it, cache it, publish it or send it to unrelated users. On
failure no partial cookie/result escapes. Errors expose only `INVALID_INPUT`,
`INVALID_CREDENTIALS` or `INTERNAL_ERROR`, without raw messages or causes.
The existing disabled library logger is preserved; the operation adds no logs.

## Serialized outcomes

| First lock owner | Result |
| --- | --- |
| Sign-in | Its credential/state read and session commit finish first. Password change then removes that new session while retaining its own initiating session. Reset, verification and email proof revoke every stored session. The sign-in cookie can arrive after revocation, but resolves to no session; no session is recreated. |
| Password change/reset | Waiting sign-in reads the replacement hash; the old password fails and creates no session. A later sign-in with the new password succeeds. |
| Email proof | Waiting sign-in to the old address fails. A later sign-in to the proved address reads current verified state. |
| Verification | Waiting sign-in reads the newly committed verification state. It authenticates after proof using the current state. Proof itself creates no session; a sign-in committed before proof is revoked. |
| Verification-state maintenance (synthetic fixture) | Waiting sign-in reads the changed verification state. Unverified users can still sign in. This fixture tests locking; it introduces no new maintenance command or product policy. |

## Running checks

Use the existing local PostgreSQL instance and a dedicated loopback database named
`halaga_signup_test`. Supply its connection URL privately as
`SIGNUP_TEST_DATABASE_URL`; the sandbox has no application-URL fallback. From `app`:

```powershell
npm.cmd run test:sign-in
```

The shared sandbox creates a random `signup_test_*` schema, replays checked-in
migrations only there, pins UTC for accurate stored instants, and drops the schema
afterward. All accounts/passwords/addresses/tokens are synthetic. No email is sent.

Tests use gates around the real configured verifier, real adapter session insert
and real account-command precommit. They require an observed PostgreSQL
`wait_event_type = 'Lock'` whose `pg_blocking_pids` contains the exact expected
blocking backend. They check both orders for password change, reset, verification,
email proof and synthetic verification clearing. Sign-in-first checks observe waits
both after the credential read and after the uncommitted session insert. Another
connection cannot see that session before commit; no result has returned yet.
Adapter-call tracing checks the same backend PID and transaction ID for library
user/account lookup and session persistence. An unrelated account can sign in while
the target account remains locked. Assertions check resulting hashes, both
verification stores, primary address and stored sessions, including revoked-cookie
resolution and fresh sign-in. Additional coverage includes an address appearing
after an empty lookup, session-write/deferred-commit rollback and retry, writer
rollback followed by same-token reset retry, wrong/unknown credentials, verifier
failure, fixed errors and log silence. No race relies on relative sleep timing;
short polling only observes actual database lock waits. Gates have bounded deadlines.

## Remaining gates

The internal transaction race is covered for this operation; HTTP sign-in is
**not implemented or mounted**. A future route must use it under ADR-086 endpoint/IP
limits and reviewed origin/CSRF protection, handle its private result/cookies after
commit, and provide safe response/client states. Direct `auth.api` calls bypass
the HTTP limiter. Signup and password-change mounting remain independently gated.
Final password-change email copy, ordinary recipient/metadata retention and cleanup,
atomic eligible email intent/binding/delivery, functional signup/sign-in clients,
terms/privacy content, restrictions/full authorization, audited staff recovery,
session/token/counter cleanup, provider/secrets/proxy review and ADR-081 readiness
remain unresolved or incomplete. No credentials, service, schedule, deployment,
new migration or persistent database change is introduced.

## Verification record (2026-10-17 PHT)

The initial working tree was clean. Repository and
application instructions, PROJECT, relevant architecture/design/glossary sections,
current ADR-086/087/088, affected repositories, installed library code and package
scripts were inspected before editing. Existing historical documents describe
earlier unmounted email routes and unresolved raw-library races; the later email
integration records and this operation's explicit boundary supersede those status
statements only. No authoritative product conflict or new policy decision arose.

Commands ran from `app`, except the final Git check. A local stdin launcher loaded
existing development configuration privately, changed only the database name to
`halaga_signup_test` and supplied the explicit sandbox URL to subprocesses. It
printed no connection material. Existing foundation tests use rolled-back synthetic
data and session-local temporary tables. All migration replays occurred in the
signup sandbox's disposable schemas; no persistent/shared migration ran.

| Command | Final result |
| --- | --- |
| `npm.cmd run test:sign-in` | 16 passed; no failures/skips. Initial runs had 15 before the appearing-address regression was added. |
| `npm.cmd run test:auth` | 21 passed. |
| `npm.cmd run test:signup` | 7 passed. |
| `npm.cmd run test:verification` | 11 passed. |
| `npm.cmd run test:reset` | 12 passed. |
| `npm.cmd run test:email-change` | 16 passed. |
| `npm.cmd run test:password-change` | 21 passed. |
| `npm.cmd run test:account-email` | 20 passed, including unchanged six-path route admission and fake-provider delivery. |
| `npm.cmd run test:foundation` | 21 passed. |
| `npm.cmd run test:logging` | 5 passed. |
| `npm.cmd run lint` | Passed after correcting the initial driver-import boundary failure. |
| `npx.cmd tsc --noEmit` | Passed. |
| `npm.cmd run build` | Passed compilation, TypeScript and page generation. Existing disabled account previews and the email-only catch-all remain; no command was enabled. |
| `git diff --check` (repository root) | Passed; existing LF/CRLF conversion notices appeared. |

Latest results across those ten test scripts total **150 passed**, zero failures
or skips. The initial lint attempt correctly rejected importing the Prisma adapter
from a repository. Moving the transaction adapter factory into the existing Prisma
infrastructure module fixed it; full lint and TypeScript then passed. Node emitted
the existing `MODULE_TYPELESS_PACKAGE_JSON` warning. The temporary npm launcher
emitted `DEP0190` for fixed shell arguments; no credential or user input entered
those arguments. No dependency/module configuration changed to hide warnings.
No browser/accessibility or live-provider check was run for this backend-only slice;
no interface was enabled or changed. Password-change email delivery/binding and
HTTP sign-in integration remain unimplemented, and no coverage for them is claimed.

Implementation files: `app/src/server/repositories/sign-in.ts`,
`account-flows.ts`, the raw-auth boundary comment in `auth.ts`,
`app/src/server/prisma.ts`, `app/tests/sign-in-database.test.mjs` and the new
package test script. PROJECT, architecture, ADR-087's implementation record,
slice/integration/password-change guides and app/repository READMEs now identify
the completed internal boundary and remaining mounting gates. No glossary term
or accepted product/retention policy changes, so no new ADR is introduced.
