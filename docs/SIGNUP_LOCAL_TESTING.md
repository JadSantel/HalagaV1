# Local synthetic signup: Slice 2

Latest age-data implementation (2026-10-21 PHT): accepted ADR-093 supersedes
the DOB-storage/repeated-age-check statements below. The existing strict payload
and PHT 18+ validation remain; successful signup now atomically saves only
`adultEligibilityCheckedAt` and the unchanged attestation version/time. Both
successful and rejected DOB are discarded, including clearing submitted form DOB.
Server-owned eligibility fields in a client payload are rejected. Account access,
email-change issue/consume, intent inspection and dispatch use the saved evidence.
The forward migration `20261021110000_minimize_age_eligibility` conservatively
derives supported earlier synthetic checks at their original attestation date,
then drops the DOB column. Do not edit historical migrations. Use the existing
reviewed migration workflow before manual persistence; no persistent/shared
database was migrated in this task. Final policy approval and ADR-092 capture
remain open. Verification is recorded in `SLICE_2_CLOSEOUT.md`.

The actual Next harness now sets `HALAGA_ACCOUNT_INTEGRATION_TEST=true`, selecting
the fixed `.next/account-integration` output directory in the existing config.
It still requires port 3102 and must not run concurrently with another instance
of itself or with a build cleaning `.next`. This preserves the normal app config/
default output and avoids stopping an existing default development server.

Updated 2026-10-18 PHT, after local sign-in mounting. The owner authorizes local
synthetic signup only. POST `/api/auth/sign-up/email` now uses the existing
protected HTTP integration and `createSignupOperation`. `/account/register` has
an accessible form using the existing account styles. Password change remains
closed. No real participant use, public deployment, email-delivery change or
completion of a launch gate is authorized.

## Authority and affected flows

Before editing, the clean working tree, root/application instructions, package
scripts, PROJECT §§8/26/28/33/34, architecture §§3/5/6/8.2, design account/form/
accessibility guidance and §9, glossary, ADR-086/087/088, current implementation
records, installed Next/library documentation, account screens/routes and signup
operation/tests were inspected. Later 2026-10-18 sign-in mounting records supersede
older blanket closure and sign-in-race statements. ADR-088's later delivery record
supersedes historical digest-only signup transport status. Neither resolves
password-change email policy or launch readiness. The explicit local synthetic
authorization permits this bounded mounting; terms/privacy content remains an
incomplete launch gate, with no invented copy, consent or acceptance default.

The flow is registration form → exact signup route → protected library handler →
existing atomic account command. The email-only and sign-in factories retain their
own allowlists. Raw Better Auth signup is never exposed. Replacing the signup
endpoint preserves its installed `formCsrfMiddleware` as well as configured-origin
admission, HTTP endpoint/IP limits and sanitized responses. Direct library API
bypasses, query input, aliases and unrelated commands stay rejected.

Signup validates the strict payload and PHT-calendar adult eligibility on the
server before hashing/persistence. It atomically creates identity, credential,
domain mapping, passed-check time, `adult-eligibility-en-v1` and server acceptance time,
initial verification digest, encrypted token transport and delivery intent/job.
A failed required write or deferred commit leaves none of those records. Retry
uses the existing unique normalized-email arbiter. Duplicate signup creates no
resend work and does not repair existing eligibility or verification state.

## Projections, privacy and session states

The form submits only display name, email, password, DOB and the checkbox boolean.
Version and acceptance time are server-owned. The exact checkbox is initially
unchecked: “I confirm that I am at least 18 years old and eligible to participate
in Halaga.” Client validation assists entry; it never grants adult eligibility.
DOB, credentials and tokens stay out of metadata, storage, general logs and
responses. Display name is intended for public identity, but this slice adds no
public account reader. Private repository writes/reads use explicit projections;
the delivery worker retains its existing purpose-limited token/recipient scope.
No new staff, session, marketplace, analytics or cache reader is introduced.

| State | Result |
| --- | --- |
| New valid synthetic adult | Fixed `{"status":"REQUEST_RECEIVED"}`, no cookie/session; account remains unverified; durable verification work waits. |
| Duplicate, normalized retry or already-verified address | Identical confirmation, no new verification work or session; existing session records are unchanged. |
| Underage/future DOB or invalid/unaccepted input | Fixed `INVALID_INPUT`, no identity/domain/token/delivery records. Rejected DOB is discarded. |
| Required write/commit fails | Fixed `INTERNAL_ERROR`, no partial account or cookies; same request can retry. |
| Foreign/missing origin or first-login CSRF rejection | Fixed `FORBIDDEN`, no signup writes. |
| Fourth request in the endpoint/IP bucket | Fixed `RATE_LIMITED`, existing retry header retained; no signup writes. |
| Separate verification proof succeeds | Both verification stores update, old sessions revoke, no session is created; sign in again. |

Responses retain no-store/no-referrer/nosniff. Signup never calls the sender or
dispatcher. `ACCOUNT_EMAIL_SENDING_ENABLED=false` remains the local setting;
provider behavior, job policy, templates and defaults are unchanged. Tests use a
fake provider to obtain a synthetic fragment token and exercise the mounted
verification command. Email delivery failure is independent of committed signup.

The form supports labels, password-manager autocomplete, paste, keyboard submit,
linked inline errors and a focused error summary, pending/live status, guarded
submission and persistent focused results. Inputs become read-only during pending;
checkbox and submit disable. Confirmed success clears every field and checkbox;
every submitted result clears the password. Fixed 400/403/429 and uncertain/network
messages never display server bodies or raw errors. Success stays on the screen,
without claiming account existence, verification, sign-in or marketplace access.

## Repeating verification

From `app`, privately supply `SIGNUP_TEST_DATABASE_URL` pointing to the dedicated
loopback `halaga_signup_test` database. No fallback to application storage is used.
Port 3102 must be free. Run this separately from Next development/build processes
that share `.next`:

```powershell
npm.cmd run test:sign-in-app
```

The existing script now checks actual signup and sign-in routes. It starts Next
in development, reuses the existing development Prisma-client seam with a random
synthetic schema, replays checked-in migrations only there, and closes the server,
restores environment and drops the schema in finally. No persistent/shared
migration, application schema override or test endpoint is added.

Optionally set `SIGNUP_BROWSER_EXECUTABLE` to an already installed agent-browser
native CLI, and `AGENT_BROWSER_EXECUTABLE_PATH` to an installed Chrome/Chromium.
The same script then also runs the browser helper against that schema in a unique
headless session, closed in finally. It downloads no dependency and reuses no
personal browser profile. Without that variable, only the route suite runs; browser
coverage must not be inferred from a default run.

## Verification record

All checks run through scripts defined in `app/package.json`. A private launcher
derived the dedicated test URL from existing local configuration without printing
connection material. Package scripts and dependencies are unchanged.

| Command | Result |
| --- | --- |
| `npm.cmd run test:sign-in-app` | 12 passed, no failures/skips: actual Next pages/routes, underage zero-write rejection, each required write and deferred-commit rollback/retry, generic normalized duplicates/verified state, no signup session/cookie, origin/first-login CSRF, rate protection, six email commands, fake-delivery verification, unrelated closed routes. |
| `npm.cmd run test:sign-in-app` with installed-browser variables | Final run: 13 passed, no failures/skips; includes the same route checks and browser keyboard/focus, linked errors, Enter submission, one-request pending guard, real signup/duplicate/underage/rate responses, fixed network/unrecognized-response feedback, field clearing, no stored browser signup session, 1440/375/320px reflow and 200% text at 320px. Axe WCAG 2 A/AA, 2.1 A/AA and 2.2 AA audit of the final error state: zero violations. |
| `npm.cmd run test:signup` | 7 passed, including PHT eighteenth birthday, rejection before auth/database, atomic writes, concurrent normalization and stored credential compatibility. |
| `npm.cmd run test:sign-in` | 34 passed, serialized operation/protected HTTP race, rollback, cookie and shared-counter coverage. |
| `npm.cmd run test:account-email` | 27 passed, fake delivery/recovery, unchanged email-only admission and fragment handling. |
| `npm.cmd run test:auth` | 21 passed, including shared PostgreSQL concurrent signup counters and safe response/log boundaries. |
| `npm.cmd run test:foundation` | 21 passed, including import boundaries, storage constraints and guarded commands. |
| `npm.cmd run test:logging` | 5 passed. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed compilation, TypeScript and page generation. |

Initial optional browser attempts failed during sandbox startup and Windows CLI
pipe handling; read-only process inspection and test-process cleanup were denied
inside the sandbox and completed with escalation. Only identified test-owned
processes were stopped. The helper now bounds each CLI call and handles CLI exit
without waiting for pipes inherited by its daemon. Later failures exposed the
CLI's inability to fill Chromium's segmented date control with generic keystrokes;
the helper uses a native value assignment for its synthetic date fixture. Date
picker/segmented keyboard entry therefore remains a manual check. A final reflow
failure exposed the form grid's intrinsic minimum width at 200% text/320px; a
single `minmax(0, 1fr)` track fixes it without hiding overflow. The final browser
run passed and closed its unique session; all test schemas were dropped by the
harness's finally cleanup, including failed runs. Browser fetch substitutions
exercise only uncertain-network/unrecognized-result states; successful signup,
duplicates, underage rejection and limiting use the actual application route.

The existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains; no configuration
change hides it. Human screen-reader, native zoom and wider browser/device review
remain outstanding, as does visual screenshot review. Automated results cannot
establish full WCAG conformance. No extra detector or standalone TypeScript check
was run outside the defined package scripts; build includes the TypeScript check.

## Remaining gates

Slice 2 stays partial and synthetic only. Password-change email copy, recipient/
metadata cleanup and atomic eligible email work; approved terms/privacy content;
restrictions/full command authorization; audited staff recovery; hosted worker/
scheduling and session/counter cleanup; provider/secrets/proxy configuration;
real-data privacy/access, backup/restore, retention/deletion, recovery, availability
and quota readiness remain incomplete. No glossary or accepted product policy
changes. No commit, real mail, participant data, paid service or deployment.
