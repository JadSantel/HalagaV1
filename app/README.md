# Halaga local laptop listing prototype

The English prototype now covers Q1–Q13 and their follow-ups from
`../docs/design/LAPTOP_DIAGNOSTICS.md` (ADR-068). It calculates the four accepted
conditions, explains the source answers, and shows battery safety, battery
operation, lock status, and test coverage separately.

The listing form also captures approximate age (optional; blank means Unknown),
a fictional practice barangay, buyer pickup/meetup/both, and an explicit sample
ownership declaration. An optional made-up PHP expectation appears only in the
private seller review. The public preview renders an explicit public projection
from `src/domain/laptop-listing.ts`, excluding the expectation and seller checklist.
Both panels are local practice views, not authenticated access controls.

The sample photo practice section offers three code-authored, fictional laptop
illustrations. Selected image IDs live in React browser memory; the inline SVG
data URLs require no upload, image optimizer, remote asset request, or object URL.
There is no file picker, so real participant images cannot enter this practice
flow. The fixtures are not stock/catalog evidence or qualifying actual-item
photos. The practice count and the missing real-photo requirement stay separate.

Everything remains a local, synthetic-data exercise. Drafts are held only in
React browser memory. There are no form submission endpoints, database calls,
uploads, authentication, analytics, local-storage saves, emails, or publication
actions. Refreshing or closing the tab loses the draft. Metadata is static;
`noindex` is not an access control or permission to deploy this prototype.

## Local database foundation

`app/.env` is ignored by Git and holds your local `DATABASE_URL`. Use
`.env.example` as a format example; its username and password are placeholders.
Prisma CLI reads this setting through the shared Zod configuration and reports
invalid field names without printing the URL or its credentials.

From the `app` folder, run `npm.cmd run db:check` to test a PostgreSQL
connection on your own computer. It runs `SELECT 1`, which checks the connection
without reading or changing Halaga data. The check rejects non-local database
hosts. Run `npm.cmd run db:generate` to generate the Prisma client after schema
changes.

The first account/listing migration includes Better Auth core tables, revision
foreign keys, publication history, quantity/media checks, immutable history
triggers, and publication-availability constraints. See
[`PHYSICAL_SCHEMA_REVIEW.md`](../docs/architecture/PHYSICAL_SCHEMA_REVIEW.md)
for enforcement details and remaining application gates. ADR-084 settles UUIDs,
centavo precision, and diagnostic storage. The laptop form remains in browser memory.

From `app`, use `npm.cmd run db:migrate:local` for the reviewed migration
workflow. It accepts only a loopback database's public schema and refuses
populated schemas without Prisma migration history. Run `npm.cmd run db:generate`
after migration/schema changes. `npm.cmd run test:foundation` replays the
migration with synthetic records in an isolated schema inside a transaction,
then rolls back the verification schema and fixtures. PostgreSQL must be running.
The native `btree_gist` extension is required for availability exclusions;
future hosting must support it.

`npm.cmd run db:foundation:check` verifies the installed migration checksum,
15 constraints and seven publication/history triggers without reading participant records.

No authentication routes, publication commands, audit service, or completion
workflow are implemented. The schema-only Better Auth configuration in
`scripts/auth-schema.config.ts` must never be used by application routes.
Signup now has an internal atomic writer and persistence-only verification-email
outbox; see [local direct signup testing](../docs/SIGNUP_LOCAL_TESTING.md).
Separate server-only verification commands now issue/replace 24-hour, single-use
opaque tokens with private outbox intent. Consumption atomically sets both
verification states, removes the token and revokes existing sessions. Failed writes
or commit preserve prior state and the token for retry. No schema/dependency is added.
Use `npm.cmd run test:verification` with the dedicated synthetic test database;
[local verification testing](../docs/EMAIL_VERIFICATION_LOCAL_TESTING.md) provides
setup, five direct manual scenarios and cleanup. Routes, UI, private link transport,
job dispatch and email delivery remain unmounted.

## Authentication policy foundation

[ADR-086](../docs/decisions/ADR-086-mvp-authentication-policies.md) records the approved
policy. `src/server/auth-policy.ts` configures seven-day rolling sessions with daily
renewal, a 15-minute freshness gate for email/password changes, host-only HttpOnly
SameSite=Lax cookies, HTTPS/Secure production settings, and explicit endpoint limits.
Rolling renewal never renews sign-in freshness. Cookie caching stays disabled.

`src/server/repositories/auth.ts` constructs Better Auth with the shared Prisma
adapter; no page or route consumes it yet. `BETTER_AUTH_URL` must be one origin,
and `BETTER_AUTH_SECRET` must contain at least 32 characters. Nonempty
`BETTER_AUTH_TRUSTED_ORIGINS` settings are rejected to preserve one origin.
Production and non-loopback origins require HTTPS and `AUTH_TRUSTED_IP_HEADER`. Set that header
only after verifying the proxy overwrites it with one client IP and direct access
to the origin is blocked. No deployment header/provider is assumed. HTTP loopback
development works without Secure cookies or forwarding-header trust.

Registration, reset requests, and verification resends allow three requests per
15-minute inactivity window; sign-in allows five per minute; other endpoints allow
60 per minute. Buckets are per IP/endpoint. Production/non-local counters use the
shared PostgreSQL `RateLimit` table with atomic increments; loopback development
uses memory. Direct `auth.api` calls bypass the HTTP limiter, so future externally
reachable wrappers need equivalent protection. Raw library logging is disabled
under ADR-085; future handlers need safe outcome logging and error serialization.

The additive rate-limit migration is checked in but not applied to the persistent
database by this slice. Apply it through `db:migrate:local` locally and the reviewed
deployment migration workflow before database-backed authentication is used.
The core schema-generation fixture/snapshot excludes this additional counter model.

Run `npm.cmd run test:auth` from `app` for synthetic handler checks and concurrent
requests through two Prisma-backed auth instances. The database test requires local
PostgreSQL, creates only a uniquely named synthetic schema, and removes it afterward.
The account-access test creates made-up identities/accounts in its own disposable
schema and sends no emails. [ADR-087](../docs/decisions/ADR-087-account-onboarding-and-email-credential-flows.md)
settles account-flow policy; atomic route integration, durable email delivery,
cleanup/retention, and deployment readiness remain gates before routes mount or
real participant data is accepted.

## Account access prerequisites (slice 2, synthetic only)

`src/server/repositories/accounts.ts` resolves a stored Better Auth session to its
unique existing domain account. Callers cannot choose an account ID. Missing mappings,
deleted accounts, invalid/expired/revoked sessions deny access. Reads do not create
mappings or collect DOB/attestations. No account routes, UI or domain writes are mounted.

The explicit account-private guard query selects ID, display name, DOB, attestation
timestamp, email-verification timestamp and deletion timestamp. The returned owner-only
projection contains ID, display name and adult, email-verification and recent-sign-in
flags. It excludes DOB, email, credentials, session/token material and staff data.
Do not use it as a public profile, cache it, or pass it to unrelated users, metadata
or analytics. No staff reader is implemented.

Adult eligibility requires DOB showing at least 18 on the current PHT calendar date
and a non-future attestation timestamp. This is self-declared eligibility, not verified
age. Signup rejects an under-18 DOB without retaining it. Treatment of an existing
account later found underage remains deferred. Email
prerequisites require agreement between the current auth identity and domain verification
timestamp; disagreement fails closed until verification integrates them. Freshness
uses session creation, never renewal time.

`requireAccountPrerequisites` rejects missing accounts, failed adult eligibility and
unverified email for publication, inquiry and proposal submission. This is only a
prerequisite check, never permission to execute an action. Restrictions/blocks are
not stored or evaluated yet. Full commands remain unmounted until those checks,
transaction-scoped rechecks, target/state guards, audit/outbox and retry safeguards
exist. No permission or restriction defaults are invented here.

The reader requires a callback for Better Auth response headers so a future response
handler can propagate renewal/deletion cookies. These are private auth transport:
never serialize them into JSON, client props or logs. Refresh and cookie policies
remain unchanged. Direct internal session reads are not exposed wrappers; future
external handlers still need the ADR-086 limiter. Fixed `account-access` outcome logs
and generic `INTERNAL_ERROR` failures exclude raw errors and submitted data.

`npm.cmd run test:auth` covers these prerequisites and synthetic Prisma/session reads in
an isolated local synthetic schema, removed afterward. The unmounted signup operation
now captures the attestation version and atomically creates identity/credential,
mapping/eligibility and verification-email intent. `npm.cmd run test:signup` requires
an explicit separate local `SIGNUP_TEST_DATABASE_URL` for `halaga_signup_test`.
Follow [the step-by-step synthetic exercise](../docs/SIGNUP_LOCAL_TESTING.md) for setup,
direct calls, expected counts, failure/concurrency tests and cleanup. Separate
verification transactions now pass synthetic checks; see the local verification guide.
Restrictions, reset/email-change transactions, durable token/delivery integration, cleanup,
proxy trust and launch readiness remain gated. All account endpoints remain unmounted.

Slice 2 verification on 2026-10-14 PHT, from `app`: `npm.cmd run test:auth`
(8 passed), `npm.cmd run test:foundation` (21 passed), `npm.cmd run test:logging`
(5 passed), `npm.cmd run lint` and `npm.cmd run build` (passed). The first auth
run failed because Node's strip-only TypeScript loader rejects parameter
properties; using an explicit class field fixed it. Tests retain the existing
`MODULE_TYPELESS_PACKAGE_JSON` warning. `git diff --check` passed from the root.
No persistent migration, dependency install, real-data or deployment check ran.
No UI changed; browser/accessibility checks were not run for this server-only step.

## Server data-access boundary

`src/server/prisma.ts` is the only application module that creates a Prisma
client. `getPrisma()` uses the installed PostgreSQL adapter and shared runtime
configuration parser. It creates the client lazily, reuses it within the process,
and preserves it across development module reloads. Query logging is disabled.
No request should disconnect this shared client after a read.

Only modules in `src/server/repositories/` may import that client. ESLint rejects
database/client imports in pages, components, domain code, and other application
modules, including literal dynamic imports and `require()` calls. Infrastructure
and repository modules must import `server-only`, which Next.js rejects in client
import graphs. Local SQL tooling remains separate with its existing loopback
guards and synthetic rollback fixtures.

Slice 2 adds the server-internal account prerequisite reader described above.
Other persisted reads remain absent. Each new repository reader must verify
the caller and select only the explicit projection permitted for that caller.
No ID parameter grants account ownership or staff access. See
[`src/server/repositories/README.md`](src/server/repositories/README.md) for module
access and projection requirements. The browser-memory prototype still has no
database calls or authenticated access control.

`npm.cmd run test:foundation` also checks the import restrictions with synthetic
module text. Account prerequisites are implemented; other domain projections and
flow-specific commands remain pending. The server-only logger emits fixed operation/outcome/code
fields and an optional primitive UUID request ID. Synthetic sentinel checks cover
rejection, unexpected failures in every command phase, and successful results.
Sink failures preserve command results and original errors; an event may be lost
when output fails. Run `npm.cmd run test:logging` for these checks. Slice 1 is still
complete. Product reads and commands remain for their owning slices. See the [combined boundary review](../docs/architecture/SERVER_BOUNDARY_REVIEW.md)
for findings, verification, and limits.

## Guarded-command foundation

`src/server/guarded-command.ts` provides `defineGuardedCommand`. It requires a
Zod schema, actor resolver, database transaction runner, minimal state loader,
authorization predicate, current-state predicate, and write callback. No callback
is optional and neither predicate has an implicit allow result.

Execution order is:

1. Validate the raw input, including schema transforms, before resolving the actor
   or starting a transaction. Invalid input raises `CommandRejected` with the
   `INVALID_INPUT` code without exposing raw input or Zod issues.
2. Resolve a trusted actor from server context. A missing actor raises
   `UNAUTHORIZED`; a caller-supplied ID is not authentication.
3. Inside one database transaction, load only the state needed by the guards.
   Authorization must return exactly `true`, then the current-state predicate
   must return exactly `true`. Otherwise the helper raises `UNAUTHORIZED` or
   `INVALID_STATE` before calling the write callback.
4. Perform all related writes using the supplied transaction handle. Return a
   named, minimal projection. Commit happens only after the callback succeeds;
   any thrown error must roll back the transaction.

The transaction runner is required infrastructure supplied by the owning server
repository. Prisma wiring uses `transaction: work => getPrisma().$transaction(work)`
with its interactive transaction handle; see the
[Prisma ORM 7 transaction contract](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions).
The helper itself does not import a database driver, create clients, or implement
actor authentication. Schema transforms, actor resolution, state loading, and
guards must not perform writes. Write callbacks must use the transaction handle,
not the shared client, and must not perform network or other external side effects.
Request handlers must translate internal rejection codes into authorized,
accessible feedback; arbitrary infrastructure errors must not be serialized.

`tests/guarded-command.test.mjs` is the only command definition in this slice.
It resolves fictional session identities and requires ownership of an editable
synthetic target. It atomically updates a title and related detail in two
session-local PostgreSQL temporary tables. The test checks invalid input, missing
actors, non-owners, missing targets, disallowed current state, successful commit,
and a real second-write failure that rolls back the first. No Halaga domain
records or policies are used, and temporary fixtures disappear on disconnect.
`test:foundation` sets Node's `react-server` condition to load the server-only
helper during verification.

This is a sequencing foundation, not a complete domain-command implementation.
No publication, negotiation, audit/outbox, locking, isolation customization,
automatic retries, or idempotency behavior is added. Concrete commands still need
their accepted flow-specific safeguards and verification under `architecture.md`
section 5 and ADR-084. ADR-086 settles Better Auth session, cookie, freshness and
endpoint rate-limit policies; ADR-087 settles account-flow behavior and token lifetimes.
Reviewed deployment proxy trust, onboarding/mapping creation, restrictions, durable
email execution and full command authorization remain pending. Slice 2 resolves
existing account mappings from stored sessions.
This generic example does not authorize a product endpoint. The
application/data foundation slice is complete; product reads and commands remain
for their owning slices.

## Try it locally

From PowerShell at the repository root:

```powershell
cd app
npm.cmd run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000 (or the port printed by Next.js). The command binds
to the local loopback interface. Stop the server with Ctrl+C.

Choose an example, click **Load example**, and confirm replacement if asked.
For ordinary examples, click **Review sample draft** to see the explanation.

For the new listing details:

1. Load **Safe**. It includes About 4 years, Practice barangay A, both fulfillment
   methods, an accepted practice declaration, and a private PHP 2500 expectation.
2. Change the age, practice barangay, or availability, then review. Those facts
   appear in **Public listing preview** alongside condition and diagnostics.
3. Find PHP 2500 only in **Private seller review**. Change that amount and review
   again; the public preview must stay the same. Leave it blank to omit it.
4. Leave age blank to see **Unknown**. Uncheck ownership or clear barangay or
   availability and attempt review to see linked errors.
5. Check **Real item photos missing: 0 of 2 required** and **Publish listing (disabled)**.
   Review is allowed without photos for this exercise; no publication action exists.
6. Clear the form or refresh the tab: all listing details and the declaration reset.

To try the sample photo step:

1. Load **Safe**, scroll to **Sample photo practice**, choose **Front view**, and
   click **Add selected sample image**. The preview and count show one selection.
2. Choose **Closed lid with cosmetic scratch** and add it. The count reaches
   two, but real photos remain missing and publishing remains disabled.
3. Click **Review sample draft**. Both labeled sample images appear inside
   **Public listing preview**. Click **Change sample images** to return with focus
   on the selector; selections survive ordinary review/edit navigation.
4. Remove one sample: its preview disappears and the count returns to one.
   You can select it again; the same image cannot be added twice.
5. Click **Clear sample images** to empty the selection while retaining the form.
   **Clear form**, confirmed **Load example**, and refresh also clear the images.
   Canceling draft replacement preserves the current images.
6. Review with zero or one sample to see an incomplete practice count. Review is
   allowed at any count, since no real listing can be published in this prototype.

| Made-up example | Expected result | Why |
| --- | --- | --- |
| Safe | Fully functional | All primary checks pass; optional checks remain untested. Cosmetic scratches do not affect condition. |
| Defective | Functional with issues | Battery does not power the laptop and the camera fails; the laptop still performs an intended function. |
| Insufficiently tested | Untested/unknown | No compatible charger was available, so required external-power testing is incomplete. |
| Not functional | Not functional | Nothing happens when powered on and external-power testing conclusively fails. Downstream checks can truthfully remain Could not test. |
| Unsafe battery | Stop testing, no ordinary condition | A suspected hazardous battery blocks ordinary review. No actual rejection or publication occurs. |
| Uncertain safety | Stop testing, no ordinary condition | Ambiguous safety would require human review in the marketplace. No actual hold or operator request is created here. |

In review, click **Change battery presence and operation** or another source
correction button. It returns to the relevant field with focus. Correcting a
source answer recomputes the condition immediately without moving focus.

Try these additional checks:

- In Defective, change the battery to normal and the camera to Works or Did not
  test. With the other checks still passing, the result becomes Fully functional.
- In Safe, change a required check to Could not test. The result becomes
  Untested/unknown, with that check identified in review.
- For Not applicable on a primary feature, explain why it is genuinely absent
  by design/configuration. A missing or broken expected component is not Not
  applicable. Described defects also require explanatory text.
- Change safety to an unsafe/uncertain answer: testing controls disappear,
  previous diagnostics are cleared, and review is disabled. Returning to a
  safe answer requires fresh answers. Included-item selections are retained.
- Use **Stop testing — safety concern** if a later observation suggests a
  hazardous battery or electrical condition. It enters the uncertain-safety
  stop and returns focus to safety.
- Clear the form and attempt review to see linked errors. Before a safety
  answer, errors refer only to visible controls. Try keyboard navigation,
  narrow widths, and zoom manually.

## Checks

Inspected package scripts: `dev`, `build`, `start`, `lint`, and
`test:diagnostics`, `test:listing`, and `test:photos`. The checks use Node 24's built-in test runner
and TypeScript support; no dependency or separate test framework was added.

```powershell
npm.cmd run test:diagnostics
npm.cmd run test:listing
npm.cmd run test:photos
npm.cmd run lint
npm.cmd run build
```

The checks cover all six examples plus rule priorities, battery cases,
applicability, optional tests, missing parts, lock disclosures, contradictory
observations, correction validation, and clearing answers after a safety stop.
Listing checks cover public-field exclusion, unsupported geography/methods,
required declaration, optional age/expectation, and independent preview copies.
Photo checks cover selection, deduplication, rejection of arbitrary sources,
removal, re-selection, clearing, fixture labeling, and the public image projection.
Node may print `MODULE_TYPELESS_PACKAGE_JSON` while detecting the TypeScript
module format; that warning is not a failed test. The whole application's
module configuration has not been changed solely to silence it.

Local Chromium verification covered selecting 0/1/2 images, deduplication,
image decoding, review/edit preservation, removal/re-selection, clearing images
without losing the draft, confirmed/canceled draft replacement, photo-only draft
confirmation, full-form clearing, refresh, phone-width reflow, and keyboard
removal with focus returning to the selector. It also checked that public review
excluded the private price and that there were no uploads, external image or
optimizer requests, or page errors. The temporary browser check used an existing
local Playwright/Chromium installation, without adding an application dependency.

Full screen-reader, contrast, zoom, and broader keyboard/accessibility testing
remain manual. These checks do not establish WCAG compliance.

## Scope and mapping notes

- `../PROJECT.md`, accepted ADRs, and `../architecture.md` govern behavior;
  `../design.md` governs proposed layout and accessibility guidance.
- Question metadata and in-memory drafts carry `laptop-diagnostics-en-v1`.
  No schema version, listing revision, or diagnostic history is persisted.
- Derivation evaluates safety first, then conclusive terminal failure, then
  insufficient primary testing, then disclosed defects, then fully functional.
  Lights, fans, and battery status alone do not prove an intended computing
  function. Contradictory positive/negative observations remain unknown.
- The live result reflects current diagnostic answers; entering review also
  requires all mandatory disclosures and applicable explanations to validate.
- **Locked startup mapping:** Q5's "Stops at a disclosed ... lock" is treated
  as preventing the condition-required test of startup to a usable system
  state (prototype §2.2), so it yields Untested/unknown. A responsive locked
  screen can establish an intended function, so it is not treated as terminal
  failure or as a defect merely because it is locked. Q13's lock disclosure
  alone never changes condition when Q5 reaches a usable system state. This
  records the bounded interpretation used in this prototype, not a broader
  policy that every locked device is unknown. Validate this distinction in
  the accepted English prototype's usability review before participant use.
- English usability validation and human-reviewed paired Cebuano/Bisaya
  wording remain required before participant/pilot use. No translation has
  been invented or marked accepted.
- Barangay choices are explicitly fictional sample fixtures, not a maintained
  Cagayan de Oro directory. Controlled real geography and a representative map
  remain required for the real listing flow; no map provider is selected here.
- Ownership acceptance is a browser-memory practice flag. There is no seller
  identity, saved declaration/version/timestamp, or independent ownership check.
  A real publication command must record the required declaration audit data.
- Qualifying real photos remain absent (0 of 2 required) regardless of the sample
  image count. No upload or publication handler exists. Actual-item photos,
  authenticated server validation,
  persistence, and publication remain future slices. No hosting, storage, worker,
  or paid service decision is made here.
