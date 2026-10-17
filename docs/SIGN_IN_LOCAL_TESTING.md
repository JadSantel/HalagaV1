# Protected unmounted sign-in: local synthetic verification

Implemented 2026-10-17 PHT, Slice 2. This implements ADR-086/087 without
changing policy. Signup, sign-in and password-change routes remain closed;
registration/sign-in/password-change previews remain disabled. Protected HTTP
integration is implemented and tested only; no sign-in route is mounted.
No password-change email path is added.

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
- `better-auth/dist/auth/base.mjs` installs `runWithAdapter(handlerCtx.adapter)`
  for the entire HTTP handler. Core `getCurrentAdapter` prefers this ambient
  adapter over an internal adapter's fallback. A separate auth instance alone
  therefore does **not** preserve the transaction inside an HTTP handler. The
  operation explicitly scopes core `runWithAdapter` to its transaction adapter
  around the nested sign-in API call; the prior adapter is restored afterward.
- `better-auth/dist/api/index.mjs`: plugin endpoint keys replace core keys; the
  endpoint/IP limiter runs before plugin request admission and router middleware.
  Early limiter responses bypass plugin response hooks, so the outer safe handler
  remains necessary. `api/middlewares/origin-check.mjs` exports the first-login
  `formCsrfMiddleware` used by the default sign-in endpoint. The replacement must
  explicitly retain it in addition to global origin checks and exact-origin admission.
- `better-auth/dist/cookies/index.mjs`: session creation signs the configured
  session cookie; optional auxiliary remember-me/cache cookies are not response
  projections. Only the configured session cookie is forwarded by this integration.

`app/src/server/repositories/sign-in.ts` provides
`createAccountSignInOperation(database, auth)(headers, input)`. It is composed
as `account-flows.signIn`, called by the protected unmounted endpoint. Input permits only email,
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

## Protected HTTP boundary (test-only)

`app/src/server/repositories/sign-in-http.ts` constructs
`createAccountSignInHandler(database, auth, configuration)`. Like the existing
email-handler factory, trusted callers supply the ADR-086 policy and adapter;
the operation's auth options must use the same origin, secret and cookie policy.
There is no application singleton, runtime enable flag, route or Server Action.
Only synthetic tests import this factory. The application catch-all still exports
`handleAccountEmailRequest`, whose six-path allowlist excludes sign-in, signup
and password change. Generic plugin defaults also continue to exclude sign-in.

The plugin replaces the core `signInEmail` endpoint key, requires exact POST path
without query input, admits the configured origin once per Request, and runs the
installed first-login CSRF middleware. It never invokes the default handler or
exposes raw `auth.api.signInEmail`. Direct plugin API calls, including fabricated
Requests, cannot bypass admission or the handler limiter.

After `createAccountSignInOperation` commits, success returns exactly
`{"status":"SIGNED_IN"}` and one configured signed session cookie. It is
host-only, HttpOnly, SameSite=Lax, Path=/, and Secure on HTTPS/production.
Default remembered sessions receive Max-Age=604800; rememberMe=false's initial
cookie has no Max-Age/Expires. Auxiliary cookies are omitted. Tests cover this
initial response, not future client persistence preferences or browser renewal.
No token/user JSON, credentials, account fields, callback or redirect is returned.
Failures return only fixed codes: 400 INVALID_INPUT, 401 UNAUTHORIZED, 403 FORBIDDEN,
404 NOT_FOUND, 429 RATE_LIMITED or 500 INTERNAL_ERROR. Non-credential library errors
(including an overlong password) retain the operation's existing generic 500
mapping. Every failure has no Set-Cookie. Responses use no-store/no-referrer/nosniff;
429 preserves only numeric x-retry-after. No new logging is added.

Unverified adults can sign in. Verification/email proof creates no session and
revokes earlier sessions; a subsequent sign-in must use the current committed
state. The HTTP tests prove both orders against password change, reset,
verification and email proof, including backend-specific PostgreSQL lock waits,
no response before sign-in commit, and stale-cookie rejection after revocation.

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

The internal transaction and protected HTTP integration are implemented and tested;
sign-in is **not mounted**. Functional sign-in clients, their error/accessibility
states and any future mounting still require a separately authorized slice.
Direct raw `auth.api` calls bypass the HTTP limiter and remain unsafe to expose.
Signup and password-change mounting remain independently gated.
Final password-change email copy, ordinary recipient/metadata retention and cleanup,
atomic eligible email intent/binding/delivery, functional signup/sign-in clients,
terms/privacy content, restrictions/full authorization, audited staff recovery,
session/token/counter cleanup, provider/secrets/proxy review and ADR-081 readiness
remain unresolved or incomplete. No credentials, service, schedule, deployment,
new migration or persistent database change is introduced.

## Prior internal-operation verification record (2026-10-17 PHT)

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
HTTP sign-in integration remained unimplemented at that checkpoint. The following
record supersedes that HTTP status; password-change email remains unimplemented.

Implementation files: `app/src/server/repositories/sign-in.ts`,
`account-flows.ts`, the raw-auth boundary comment in `auth.ts`,
`app/src/server/prisma.ts`, `app/tests/sign-in-database.test.mjs` and the new
package test script. PROJECT, architecture, ADR-087's implementation record,
slice/integration/password-change guides and app/repository READMEs now identify
the completed internal boundary and remaining mounting gates. No glossary term
or accepted product/retention policy changes, so no new ADR is introduced.

## Protected HTTP verification record (2026-10-17 PHT)

Before editing, the working tree was clean. Repository/application instructions,
PROJECT, relevant architecture/design/glossary sections, current ADR-086/087/088,
operations/tests, plugin/handler, route wiring, installed Better Auth/core/adapter
1.7.7 behavior and package scripts were inspected. Later implementation records
supersede historical all-routes-unmounted/raw-race status only within their stated
boundaries. No accepted policy conflict or new product decision was found.

Commands ran from `app` except Git checks. A local stdin launcher privately loaded
existing development connection configuration, changed only its database name to
`halaga_signup_test`, and supplied explicit test URLs. It printed no connection
material. Account suites used disposable schemas; foundation used its rolled-back
disposable schema and session-local temporary tables. No migration ran against
persistent/shared schemas. A final read-only check found no remaining test schemas.

| Command | Final result |
| --- | --- |
| `node --conditions=react-server --test tests/sign-in-http-database.test.mjs` | 18 passed; zero failures/skips after the adapter fix. |
| `npm.cmd run test:sign-in` | 34 passed: 16 internal-operation and 18 HTTP tests. |
| `npm.cmd run test:auth` | 21 passed. |
| `npm.cmd run test:signup` | 7 passed. |
| `npm.cmd run test:verification` | 11 passed. |
| `npm.cmd run test:reset` | 12 passed. |
| `npm.cmd run test:email-change` | 16 passed. |
| `npm.cmd run test:password-change` | 21 passed. |
| `npm.cmd run test:account-email` | 20 passed; mounted email handler still rejects sign-in/signup/password change. |
| `npm.cmd run test:foundation` | 21 passed. |
| `npm.cmd run test:logging` | 5 passed. |
| `npm.cmd run lint` | Passed. |
| `npx.cmd tsc --noEmit` | Passed. |
| `npm.cmd run build` | Passed compilation, TypeScript and page generation. |
| Native Node assertions against built preview HTML | Registration/sign-in/password-change controls disabled, unavailable notice present, no Server Action fields. |
| `git diff --check` (repository root) | Passed; existing LF/CRLF conversion notices only. |

Final ten-script regression total: **168 passed**, zero failures/skips. The initial
combined run had 19 passes and 15 failures: inherited HTTP adapter context caused
transaction timeouts and dependent race failures; one overlong-password assertion
also expected a credentials error instead of the existing generic operation error.
Explicit transaction-adapter scoping fixed the integration; the assertion now
preserves existing behavior. The standalone HTTP and combined regression runs
then passed. No raw exception logging was enabled to diagnose failures.

Existing MODULE_TYPELESS_PACKAGE_JSON warnings remain. The temporary npm launcher
also emitted DEP0190 for fixed script arguments with shell=true; no credential or
request input entered shell arguments. No dependency/configuration change hides
warnings. No browser/accessibility, mounted sign-in or live-provider test ran;
no interface, delivery or operational gate is claimed complete.

Changed implementation: `account-flow-plugin.ts`, `repositories/sign-in-http.ts`,
the ambient adapter binding in `repositories/sign-in.ts`, the new
`tests/sign-in-http-database.test.mjs`, and the existing `test:sign-in` script.
PROJECT, architecture, ADR-087 implementation status, slice/integration guides,
password-change guide and READMEs reflect the boundary. No glossary meaning or
accepted policy changes; no new ADR, dependency, migration, credential, service,
worker, scheduler or deployment is added.
