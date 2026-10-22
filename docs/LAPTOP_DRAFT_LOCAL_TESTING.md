# Local synthetic laptop draft workspace: bounded Slice 3

Later evaluation supplement (2026-10-22 PHT): saved owner review now runs the
read-only accepted-rule evaluator. Missing, deterministically ineligible,
review-required and unavailable checks remain separate; current runtime gaps
prevent eligibility. No lifecycle or notification effect occurs. See
[scope, pending risk decisions and verification](LAPTOP_PUBLICATION_EVALUATION.md).
This supersedes historical statements below that all publication checks are absent;
detector rules, qualifying evidence and publication commands remain unavailable.

Later photo supplement (2026-10-21 PHT): accepted ADR-095 and
[DRAFT_PHOTO_LOCAL_TESTING.md](DRAFT_PHOTO_LOCAL_TESTING.md) supersede older
media-unimplemented statements here. Owner-private synthetic upload, derivatives,
ordered immutable references and a bounded processing/cleanup worker are present.
Whole synthetic drafts now expire after 30 inactive days, including text-only
history. Actual-item publication evidence and real-data readiness remain gated.

Updated 2026-10-21 PHT. Synthetic data only, on a local/private installation.
No public deployment, real participant data or completion of a launch gate.

## Saved revision review supplement (2026-10-21 PHT)

From an owner editor, choose **Review saved revision N**. This opens
`/drafts/[listingId]/review?revision=N`; unsaved edits are explicitly excluded.
The server reads that exact immutable version after current owner/session/draft
checks and reports listing identity, version and original save time in PHT. A later
save does not change the selected review; a newer-version notice explains this.
Correction links open/focus the current editor field after its authorized load.
Save corrections to append a new version, then review that version.

The review has separate proposed-public and owner-private projections. The optional
private PHP expectation appears only in the latter. Both remain account-private;
there is no public listing reader. The page HTML/RSC and metadata contain no saved
content; only the authenticated, no-store API supplies it. Responses vary by Cookie,
use no-referrer/noindex, and disclose only fixed error codes on rejection. No content
logger, analytics, shared content cache or browser persistence is added. A restored
browser document reloads for current authorization.

Accepted laptop validation/derivation runs on the server against the saved facts,
with source reasons and separate battery, lock and test-coverage disclosures.
Incomplete/invalid disclosures have no validated condition; known and uncertain
safety stops have no ordinary label. Both explain that no actual publication,
hold/rejection or operator request occurred. All accepted safe-testing guidance
remains visible. Source corrections for hidden diagnostics go through the safety
gate; missing fields have explanatory links. Unavailable geography, photo evidence,
ownership capture, publication checks and language/readiness gates link to focusable
explanations. No checkbox or publication command is present. Fictional practice
geography/photos are never substituted. ADR-094 remains proposed; media/hosting,
publication checks/audit/outbox, human-reviewed paired Cebuano/Bisaya, usability and
ADR-081 launch gates remain outstanding. This increment does not settle them.

Verification commands from `app` (all final runs pass; no skipped tests):

| Command | Result |
| --- | --- |
| `npm.cmd run test:laptop-drafts` | 19 passed. Owner isolation, exact saved-version pinning after later saves, private-field separation, incomplete/invalid states, four derived conditions and both safety stops, fixed errors/no-store headers, restrictions preserving reads, deleted/revoked/expired/replaced sessions, lock-wait revocation, non-draft/prior-publication exclusions and existing guarded write/retry history. |
| `npm.cmd run test:sign-in-app` | 19 passed with installed Agent Browser and Chrome enabled. Mounted review endpoint, anonymous rejection, HTML/metadata omission, captured stdout/stderr excluding synthetic content/amount/cookie, private/no-store/Vary behavior; keyboard review entry, newer-version notice, supported correction focus and unavailable-explanation links, all accepted condition/safety sample reviews, private amount only in owner section, signed-out review with no content. |
| `npm.cmd run test:diagnostics` | 40 passed, including separate battery/lock/applicability and terminal-failure rules. |
| `npm.cmd run test:listing` | 4 passed; existing practice/public-preview separation. |
| `npm.cmd run test:logging` | 5 passed; fixed allowlist and synthetic-secret exclusion. |
| `npm.cmd run lint` | Passed without warnings on the final application changes. |
| `npm.cmd run build` | Passed with TypeScript; private review API remains dynamic and review HTML contains only the loading shell. |
| `git diff --check` (repository root) | Passed; Git reports LF/CRLF conversion notices. |

Database suites use the existing private Node launcher: load local configuration,
derive only the dedicated loopback `/halaga_signup_test` URL, set
`SIGNUP_TEST_DATABASE_URL`, then invoke the existing npm script. Browser opt-ins
use the installed `SIGNUP_BROWSER_EXECUTABLE` and
`AGENT_BROWSER_EXECUTABLE_PATH`. No credentials are printed, dependencies installed,
real participants used or persistent application migration applied. The existing
sandbox replays checked-in migrations into disposable schemas and cleans them up.

Review and editor automated WCAG audits found zero violations. Keyboard focus,
1440/375/320px reflow and 200% text at 320px passed. Desktop/mobile review screenshots
were inspected at `app/.next/draft-review-1440.png` and `draft-review-375.png`.
These checks do not replace human screen-reader, translation or pilot validation.

Earlier runs exposed an overstrict mounted `Vary` assertion (Next adds framework
tokens), browser waits returning DOM objects, a test targeting an already-complete
title instead of a missing brand, and a Next URL-data/Suspense warning. Assertions,
waits and the page Suspense boundary were corrected. A build run concurrently with
the nested Next integration server cleared its output and interrupted that run;
the final harness ran after the build, without that conflict. Node's existing
`MODULE_TYPELESS_PACKAGE_JSON` warning remains non-fatal.

Changed files:

- Server projection: `app/src/server/laptop-draft-review.ts`; operations/HTTP dispatch:
  `app/src/server/repositories/laptop-drafts.ts` and `laptop-drafts-http.ts`;
  route: `app/src/app/api/laptop-drafts/[listingId]/review/route.ts`.
- Review shell/client: `app/src/app/drafts/[listingId]/review/page.tsx` and
  `app/src/app/drafts/review.tsx`; editor entry/focus: `app/src/app/drafts/workspace.tsx`.
- Tests: `app/tests/laptop-drafts-database.test.mjs`,
  `app/tests/sign-in-app-database.test.mjs`, `app/tests/helpers/laptop-drafts-browser.mjs`.
- Records: `PROJECT.md`, `architecture.md`, `design.md`,
  `docs/domain/GLOSSARY.md`, `docs/decisions/ADR-084-first-physical-schema-review.md`,
  `docs/decisions/README.md`, `docs/IMPLEMENTATION_SLICES.md`, and this guide.

## Availability supplement (2026-10-21 PHT)

Owner-private drafts now save/resume buyer pickup, mutually agreed meetup, both
or an unselected value. This supersedes older fulfillment-input deferral in the
original Slice 3 record below. Availability reuses the replacement snapshot,
immutable revision, retry UUID, expected-version, owner/session and restriction
controls. Only `DRAFT` and its owner-detail projection are affected; list, page
shell, metadata, public, buyer, staff, search and notification boundaries are
unchanged. No exact pickup address, meeting location or precise coordinates are
collected. The English synthetic surface remains subject to human-reviewed paired
Cebuano/Bisaya and full accessibility validation before launch.

The additive `20261021120000_draft_fulfillment_availability` migration stores
nullable revision `fulfillment` under a SQL choices check. Pre-existing revisions
remain null; the reader maps null to the empty selection. No migration history is
edited, and no existing snapshot is rewritten. Migration verification uses only
disposable schemas; no persistent application migration is applied by this slice.

Verification from `app`, using synthetic data only:

| Command | Result |
| --- | --- |
| `npm.cmd run db:generate` | Passed; local Prisma client regenerated. |
| `npm.cmd run test:laptop-drafts` | 18 passed, none skipped. All three choices, omission/clearing, unchanged prior snapshots, SQL choices and immutability, other-owner/signed-out reads and writes, stale saves, identical/changed-body retries, concurrent retries and current restrictions. |
| `npm.cmd run test:sign-in-app` | 19 passed, none skipped, with installed Agent Browser and Chrome enabled. Actual private route persistence plus keyboard choice, saved/resumed meetup, both after conflict reload, unselected resume, lost-response exact-body retry and preserved stale availability. Existing axe WCAG checks found zero violations; 1440/375/320px and 200% text reflow checks passed. |
| `npm.cmd run test:foundation` | 21 passed; existing foundation SQL, guarded commands and repository access boundary. |
| `npm.cmd run test:listing` | 4 passed; existing practice choices and public-preview privacy contract. |
| `npm.cmd exec tsc -- --noEmit` | Passed. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed; private draft APIs remain dynamic. |
| `git diff --check` (repository root) | Passed; LF/CRLF notices only. |

Draft and mounted-route suites used the existing launcher pattern to derive only
the loopback `/halaga_signup_test` URL from local configuration, without printing
credentials. Disposable schemas replayed all migrations and were cleaned up. The
browser used the existing `SIGNUP_BROWSER_EXECUTABLE` and
`AGENT_BROWSER_EXECUTABLE_PATH` opt-ins; no dependency/browser was downloaded.
The first PowerShell inline `node --input-type=module -e` draft-suite launcher
lost JavaScript quotes and failed before any test ran; stdin quoting corrected it.
Existing Node module-type warnings remain non-fatal. Automated accessibility and
keyboard checks do not complete manual screen-reader or translation review.
No unresolved decision blocks this slice; the launch gates below remain.

Changed files:

- Storage: `app/prisma/schema.prisma` and
  `app/prisma/migrations/20261021120000_draft_fulfillment_availability/migration.sql`.
- Draft flow: `app/src/server/laptop-draft-validation.ts`,
  `app/src/server/repositories/laptop-drafts.ts`, `app/src/app/drafts/workspace.tsx`.
- Checks: `app/tests/laptop-drafts-database.test.mjs`,
  `app/tests/sign-in-app-database.test.mjs`, `app/tests/helpers/laptop-drafts-browser.mjs`.
- Synced implementation records: `PROJECT.md`, `architecture.md`, `design.md`,
  `docs/domain/GLOSSARY.md`, `docs/decisions/ADR-084-first-physical-schema-review.md`,
  `docs/decisions/README.md`, `docs/architecture/PHYSICAL_SCHEMA_REVIEW.md`, and this file.

## Latest restriction guard verification (2026-10-21 PHT)

ADR-090 now applies to create/save, including successful-request retries. Current
`CREATE_LAPTOP_DRAFT` and `EDIT_LAPTOP_DRAFT` scopes block only their corresponding
action; unrelated publication/inquiry/proposal scopes permit both. `SUSPENSION`
blocks both writes. Existing draft list/detail, sign-in and password changes remain
available. An active denial returns only `{code: "ACTION_RESTRICTED"}` with status
403 and existing private headers, without enforcement metadata or cookies. The
workspace retains unsaved edits and reports that nothing was saved.

The additive `20261021090000_draft_marketplace_restrictions` migration stores
scoped staff/audit decisions. SQL changes serialize on the account row; guards
read current state after lock waits and recheck before commit. Decision history
is immutable except explicit, attributed revocation and authorized retention
deletion. Start time is inclusive; review time does not automatically lift a
restriction. No staff reader, staff writer or notice delivery is mounted.

Checks run from `app` (database suites use only local synthetic data):

| Command | Result |
| --- | --- |
| `npm.cmd run db:generate` | Passed; Prisma client regenerated. |
| `npm.cmd run test:laptop-drafts` | 17 passed. Includes allowed/blocked/combined scopes, suspension, reads, explicit revocation, start boundaries, unchanged listing/revision/answer/session state after rejection, no rolling refresh on denial, retry checks, observed concurrent account-lock waits and guarded sign-in/password changes. |
| `npm.cmd run test:foundation` | 21 passed. |
| `npm.cmd run test:sign-in` | 38 passed. |
| `npm.cmd run test:password-change` | 35 passed. |
| `npm.cmd exec tsc -- --noEmit` | Passed. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed; draft API routes remain dynamic. |
| `git diff --check` (repository root) | Passed; existing LF/CRLF notices only. |

The draft/sign-in/password suites use the existing launcher to set
`SIGNUP_TEST_DATABASE_URL` to the dedicated loopback `/halaga_signup_test`
database without printing credentials. They replay migrations into disposable
schemas and clean up. No persistent database migration, deployment, real data,
email or browser run was performed in this slice. Existing Node module-type
warnings remain non-fatal. Staff authorization/access auditing, retention execution,
other marketplace commands and ADR-081 readiness remain gates. This record
supersedes older claims that draft restriction checks are unimplemented.

## Authority, affected flows and boundaries

The root/application instructions, clean working tree, schema/migrations,
validation, stored-session account checks, routes and existing scripts were
inspected before editing. Relevant authority: PROJECT §§8/10–15/26/28–29/33–34,
architecture §§3/4.1/5/6/8.2, design §§5.3–5.4/9, glossary and accepted
ADRs 006/032/035/058/068/081/084–087. Installed Next route documentation was read.
Later account implementation records supersede historical blanket route closure;
none supplies listing publication authorization. The owner's explicit request
authorizes this bounded private draft capability, including authenticated
unverified accounts. Existing publication eligibility remains required later.

The affected flow is stored-session authentication → undeleted domain mapping →
owner-private draft list/create/read/replacement and resume. The only lifecycle state available
here is `DRAFT`. There are no buyer, staff, search, notification, public listing
or image readers. Private expectation, answers and unfinished content stay within
the owner's explicit detail projection. Only the owner editor renders detail data,
fetched through the authorized API after the page shell loads. Page HTML and static
metadata never include stored draft content or expectation. The existing fictional
browser practice exercise remains in memory.

## API contract

Use the configured `BETTER_AUTH_URL` origin and the session cookie from protected
synthetic sign-in. Writes require that exact `Origin` and JSON content type;
missing/foreign origins and cross-site Fetch Metadata are rejected. GET permits
an absent Origin, checks any supplied Origin, and still requires a live session.
Origin trust never comes from Host or proxy headers. No CORS grant is added.

| Method and path | Input | Owner-private response |
| --- | --- | --- |
| GET `/api/laptop-drafts` | No seller/account selector | `{drafts: [{id, title, revision, updatedAt, condition}]}` |
| POST `/api/laptop-drafts` | `{requestId, draft}` | `{id, revision: 1}` |
| GET `/api/laptop-drafts/{id}` | Opaque listing UUID in path | `{id, status: "DRAFT", revision, createdAt, updatedAt, condition, draft}` |
| PUT `/api/laptop-drafts/{id}` | `{requestId, expectedRevision, draft}` | `{id, revision}` |

`requestId` is a fresh UUID per logical create/save. Preserve the UUID and body
when retrying an uncertain response. The server generates the listing ID and
chooses the seller/author exclusively from the authenticated mapping. Request IDs
become immutable revision IDs; do not reuse them across operations. An identical
successful retry returns its original ID/version even after later edits, provided
the account's current matching restriction/suspension guards still permit it. Reusing
an owned request ID for a different snapshot/target or a stale expected revision
returns `INVALID_STATE`. Global UUID collisions roll back and yield a fixed
internal error without inspecting another owner's content.

`draft` is a **full replacement snapshot**, not a patch. Omitted fields reset to
unfinished defaults. It may be `{}`. Supported fields:

- `diagnosticVersion`: optional; only `laptop-diagnostics-en-v1` is accepted.
- `title`, `brand`, `model`, `description`, `approximateAge`: strings.
- `fulfillment`: `"pickup"`, `"meetup"`, `"both"` or `""` (unselected). Omission
  resets availability to unselected, consistent with full replacement semantics.
- `answers`: partial map of accepted laptop question keys to defined choices or
  empty strings; `notes`: partial map of the same keys to strings.
- `behavior`, `behaviorNotes`, `included`, `includedNotes`: the existing accepted
  diagnostic multi-select choices and accompanying strings.
- `privatePriceExpectation`: empty or an exact PHP decimal **string**, normalized
  to two decimal places. Uses the existing storage parser, including its precision
  and signed-amount behavior; no new business amount limit is invented.

Unknown fields/choices/versions, numeric money, excess decimal precision, seller,
account, author, lifecycle, condition, type/category, quantity, barangay, location,
media, exact pickup address, meeting location, precise coordinates and declaration
inputs are rejected. Unsupported fulfillment choices, including shipping, are
rejected. No fictional practice barangay is persisted as geography.
There is no controlled CDO registry yet;
`barangayCode` remains null. Ownership submission/history remains
later work, alongside media and publication validation.

For a manual local request, while signed in on the configured local origin, use
the browser console with synthetic content only:

```javascript
const requestId = crypto.randomUUID();
const body = { requestId, draft: { title: "Synthetic unfinished laptop", privatePriceExpectation: "2500.50" } };
const response = await fetch("/api/laptop-drafts", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const created = await response.json();
// After confirming response.ok, GET /api/laptop-drafts/{created.id} with the same session.
// PUT uses a new requestId, expectedRevision: created.revision and the full desired draft.
```

Responses use `no-store`, `no-referrer`, `nosniff`, `Vary: Cookie` and
`X-Robots-Tag: noindex, nofollow`. Authorization supplies privacy; noindex does
not. Writes return only ID/version. Other users and nonexistent/non-draft targets
receive the same fixed 404. Missing/revoked/expired/unmapped/deleted-owner sessions
receive 401, invalid input 400, state conflicts 409, unexpected failures 500.
Errors contain only a fixed code and no cookie, private input, raw validation issue
or database/library exception. No draft content or expectation is logged.

## Persistence and concurrency

The additive `20261019090000_incomplete_laptop_drafts` migration makes only
`ListingRevision.barangayCode` and `ListedItemGroup.condition` nullable. Empty
identity/description strings represent unfinished fields. No placeholder condition
or geographic code is invented. Existing history triggers, FKs and publication
constraints remain intact. No previous migration is edited.

Every list/detail read and command uses identity/domain → exact stored session →
owner-scoped listing locks. Revocation and deletion cannot be authorized from an
earlier auth snapshot alone. Expiry is checked after waiting and again before
the transaction returns. Existing auth rolling renewal/cookie handling is reused.
Per-owner serialization is deliberate for local validation; no distributed lock
or runtime is added.

Each save appends a revision, one quantity-one laptop group and per-question JSON
answers. Behavior/included multi-selects use their own versioned question rows,
with detail stored separately. No revision, group or answer is overwritten.
The guarded current-revision pointer advances in the same transaction. Existing
whole-draft validation and server per-question validation must both pass before
condition derivation is persisted. Missing explanations, inconsistent disclosures,
unfinished required data and safety stops can be saved privately with null group
and summary conditions. Hazard/uncertainty never transitions the listing to held,
rejected or published in this slice.

Revision ID, author, listing target, version and timestamp preserve this private
command's retry identity and history; prior version is the preceding numbered
revision, and state stays `DRAFT`. No asynchronous effect, publication interval,
moderation action or notification is generated, so this slice adds no generic
audit/outbox model or job policy. It does not waive those requirements for later
consequential publication commands. Retention/deletion execution remains gated;
immutability is not permission for indefinite retention. Disposable fixtures are
removed in finally cleanup.

## Repeating verification

From `app`, privately configure `SIGNUP_TEST_DATABASE_URL` for the dedicated
loopback `halaga_signup_test` database. The existing sandbox helper refuses other
database names/non-loopback targets, replays all migrations into a random schema,
and drops it after disconnecting. No fallback to application storage.

```powershell
npm.cmd run test:laptop-drafts
npm.cmd run test:sign-in-app
```

The second command needs port 3102 free and must run separately from development
or build processes sharing `.next`. It exercises real Next routes with the existing
development client-reuse seam pointed only at the disposable schema. No test
endpoint, dependency or hosted service is added. Browser UI checks use that script's
existing `SIGNUP_BROWSER_EXECUTABLE` opt-in pointing to an installed agent-browser
executable. Set `AGENT_BROWSER_EXECUTABLE_PATH` to installed Chrome if needed.
No browser or dependency is downloaded. A separate synthetic owner exercises the
workspace against the disposable schema; its sessions are revoked on cleanup.

For manual local persistence, run the existing `db:migrate:local` workflow against
the reviewed loopback development database before starting `dev`. This slice tests
the migration in disposable schemas only; persistent application migration status
is reported separately below.

## Manual workspace validation

1. Apply existing migrations to the reviewed loopback development database using
   `npm.cmd run db:migrate:local`, then `npm.cmd run dev`. Use the configured local
   `BETTER_AUTH_URL` origin. Do not run dev/build/the route harness against one
   shared `.next` directory concurrently.
2. Open `/drafts` while signed out. Follow Sign in, use a synthetic account at
   `/account/sign-in`, then follow Open your private laptop drafts. No session-reader
   endpoint is mounted. Unverified accounts may use private drafts only.
3. Check the empty state. Create a laptop draft. Enter made-up title/answers and an
   optional made-up exact PHP amount. Save with unanswered diagnostics, then return
   to the list: the summary must omit answers and price expectation.
4. Resume from the list, or reload the editor URL. Saved data must survive refresh.
   The server remains the source of truth; no local/session storage is used.
5. Edit in two tabs. Save one, then save the stale tab. Expect a conflict, retained
   local edits and an explicit Reload saved draft action with discard confirmation.
6. For an ambiguous network result, keep the tab open and choose Retry same save
   (or Retry same create). The UI freezes controls and retains the exact request
   UUID/body until certainty. Reload after a lost tab to find committed drafts;
   retry identity is in memory, never browser-persisted private data.
7. With a second synthetic account, check that the list has only its own drafts
   and the first owner's detail URL yields the same unavailable state as a missing
   draft. Revoke/expire a session in a disposable fixture and check signed-out
   recovery; no further save should succeed.
8. Check keyboard/focus, announcements, narrow viewports and zoom. Safety stops
   allow private saving but stop testing, hide further checks and create no hold.
   The browser-only exercise at `/` still loses its practice answers on refresh.

## Previous backend verification record

All final checks below passed on 2026-10-19 PHT. Database-backed checks used
synthetic fixtures; draft and mounted-route checks replayed migrations in
disposable dedicated-database schemas. A private launcher derived the test URL
from existing local configuration without printing connection material.

| Command (from `app`) | Result |
| --- | --- |
| `npm.cmd run db:generate` | Passed; generated Prisma client with nullable draft fields. |
| `npm.cmd run test:laptop-drafts` | 9 passed. Strict input/version/choice/centavo validation; incomplete and safety-stop snapshots; exact owner-private projection; owner isolation; missing/deleted mappings; stale, revoked, expired, future-dated and replaced-token sessions; immutable history; concurrent retry/stale edits; observed lock waits behind revocation for create/read/save; required-write and deferred-commit rollback/retry; origin/JSON and lifecycle gates; no publication/media/declaration/outbox effects. |
| `npm.cmd run test:sign-in-app` | 13 passed, including actual Next private create/read/save, retries, stale-edit rejection, private headers, signed-out/revoked rejection, unchanged signup/verification flows, absent public listing endpoint and no persisted draft content/price in homepage HTML. Optional browser check was not enabled. |
| `npm.cmd run test:foundation` | 21 passed; baseline storage/history, server boundaries, validation and guarded transactions. |
| `npm.cmd run test:diagnostics` | 40 passed; existing accepted laptop derivation/validation. |
| `npm.cmd run test:listing` | 4 passed; existing browser preview privacy/validation. |
| `npm.cmd exec tsc -- --noEmit` | Passed. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed; both draft route paths are dynamic. |
| `git diff --check` (repository root) | Passed; Git emitted existing LF/CRLF conversion notices. |

An initial PowerShell inline launcher lost JavaScript string quotes and exited
before tests ran; corrected quoting then ran the checks successfully. The first
mounted draft-route run rejected a valid request because it compared Next's
internally reconstructed request URL origin to the configured public origin.
Removed that unsuitable URL comparison; admission still requires the exact
configured Origin for writes and rejects cross-site Fetch Metadata. The complete
mounted-route suite then passed. No origin trust is derived from Host/proxy input.
Node's existing module-type warning remains non-fatal.

That backend-only record did not migrate the persistent database, deploy, use real
data/email or verify browser-based draft UI. The workspace verification below
supersedes its UI limitation only; all launch gates remain.

## Workspace verification record (2026-10-19 PHT)

| Command (from `app` unless noted) | Result |
| --- | --- |
| `npm.cmd run test:laptop-drafts` | 11 passed. Includes minimal owner-only list, current stored-session and mapping checks, observed lock waits behind revocation, all non-draft states, exclusion of any publication cycle, immutable snapshots, validation, rollback and retries. |
| `npm.cmd run test:sign-in-app` with the existing installed-browser opt-in | 15 passed. Mounted no-store list/detail/create/save and static metadata shells; actual browser sign-in, empty list, create/save response loss with exact retry/no duplicate, incomplete save, resume, stale-edit retention/reload, invalid amount correction, safety-stop save, revoked-session data clearing and unchanged memory-only practice review/reload. |
| Browser checks within that script | Keyboard activation/focus, pending controls, desktop 1440px and mobile 375px/320px reflow, 200% text at 320px, and automated WCAG 2.2 AA tags passed with no violations. Desktop/mobile screenshots were inspected. This is not full manual screen-reader or pilot accessibility certification. |
| `npm.cmd run test:diagnostics`, `npm.cmd run test:listing`, `npm.cmd run test:photos` | Passed; accepted laptop rules and practice privacy/image projections. |
| `npm.cmd run test:foundation`, `npm.cmd run test:logging` | 21 and 5 passed; storage/history, boundaries, transactions and safe logs. |
| `npm.cmd run lint`, `npm.cmd exec tsc -- --noEmit`, `npm.cmd run build` | Passed. API routes are dynamic; workspace HTML/metadata are content-free shells and detail has a loading boundary. |
| `git diff --check` (repository root) | Passed, with existing LF/CRLF conversion notices. |

Initial runs found the installed Next runtime-params loading-boundary requirement;
adding the route loading state fixed it. Browser checks initially failed in the
sandbox because Chrome CDP closed; they passed outside it. Browser-driver text
selectors and Next development-overlay pointer interception were corrected using
supported role selectors and keyboard activation. Existing signup browser checks
also pass. A PowerShell inline launcher lost JavaScript quotes before any test ran;
stdin-based quoting corrected it. Node's existing module-type warning is non-fatal.

Only synthetic fixtures were used. Draft and route/browser checks replay all
migrations in disposable schemas and clean them up. No persistent database
migration, service/dependency, deployment, real mail/data, new session reader or
rate policy was added. Human-reviewed paired Cebuano/Bisaya, moderated English
usability and full manual accessibility validation remain gates.

## Remaining gates

Publication is unavailable. Controlled CDO barangay data/maintenance, qualifying
actual-item evidence and metadata-stripped safe image processing,
ownership submission/history, sensitive-text/risk checks and restrictions beyond
the implemented draft scopes, held-review
workflow, audit/outbox and required operational readiness remain unimplemented.
No provider, registry, geography, image upload, publication fallback, marketplace
grant, worker schedule, retention schedule, public discovery or public projection
is selected by this work. ADR-081 real-data/launch gates remain in force.
