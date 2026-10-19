# Local synthetic laptop drafts: first Slice 3 backend slice

Updated 2026-10-19 PHT. Synthetic data only, on a local/private installation.
No public deployment, real participant data or completion of a launch gate.

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
owner-private draft creation/read/replacement. The only lifecycle state available
here is `DRAFT`. There are no buyer, staff, search, notification, public listing
or image readers. Private expectation, answers and unfinished content stay within
the owner's explicit detail projection. No application page reads them, and the
existing fictional browser practice exercise remains in memory.

## API contract

Use the configured `BETTER_AUTH_URL` origin and the session cookie from protected
synthetic sign-in. Writes require that exact `Origin` and JSON content type;
missing/foreign origins and cross-site Fetch Metadata are rejected. GET permits
an absent Origin, checks any supplied Origin, and still requires a live session.
Origin trust never comes from Host or proxy headers. No CORS grant is added.

| Method and path | Input | Owner-private response |
| --- | --- | --- |
| POST `/api/laptop-drafts` | `{requestId, draft}` | `{id, revision: 1}` |
| GET `/api/laptop-drafts/{id}` | Opaque listing UUID in path | `{id, status: "DRAFT", revision, createdAt, updatedAt, condition, draft}` |
| PUT `/api/laptop-drafts/{id}` | `{requestId, expectedRevision, draft}` | `{id, revision}` |

`requestId` is a fresh UUID per logical create/save. Preserve the UUID and body
when retrying an uncertain response. The server generates the listing ID and
chooses the seller/author exclusively from the authenticated mapping. Request IDs
become immutable revision IDs; do not reuse them across operations. An identical
successful retry returns its original ID/version even after later edits. Reusing
an owned request ID for a different snapshot/target or a stale expected revision
returns `INVALID_STATE`. Global UUID collisions roll back and yield a fixed
internal error without inspecting another owner's content.

`draft` is a **full replacement snapshot**, not a patch. Omitted fields reset to
unfinished defaults. It may be `{}`. Supported fields:

- `diagnosticVersion`: optional; only `laptop-diagnostics-en-v1` is accepted.
- `title`, `brand`, `model`, `description`, `approximateAge`: strings.
- `answers`: partial map of accepted laptop question keys to defined choices or
  empty strings; `notes`: partial map of the same keys to strings.
- `behavior`, `behaviorNotes`, `included`, `includedNotes`: the existing accepted
  diagnostic multi-select choices and accompanying strings.
- `privatePriceExpectation`: empty or an exact PHP decimal **string**, normalized
  to two decimal places. Uses the existing storage parser, including its precision
  and signed-amount behavior; no new business amount limit is invented.

Unknown fields/choices/versions, numeric money, excess decimal precision, seller,
account, author, lifecycle, condition, type/category, quantity, barangay, location,
media, fulfillment and declaration inputs are rejected. No fictional practice
barangay is persisted as geography. There is no controlled CDO registry yet;
`barangayCode` remains null. Ownership submission/history and fulfillment are
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

Every command and detail read uses identity/domain → exact stored session →
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
endpoint, dependency or hosted service is added. Browser UI checks remain optional
under that script's existing opt-in; there is no new draft UI to check.

For manual local persistence, run the existing `db:migrate:local` workflow against
the reviewed loopback development database before starting `dev`. This slice tests
the migration in disposable schemas only; persistent application migration status
is reported separately below.

## Verification record

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

The persistent development database was not migrated. No deployment, real data,
real email, browser-based draft UI or pilot-readiness verification was performed.

## Remaining gates

Publication is unavailable. Controlled CDO barangay data/maintenance, qualifying
actual-item evidence and metadata-stripped safe image processing, fulfillment and
ownership submission/history, sensitive-text/risk/restriction checks, held-review
workflow, audit/outbox and required operational readiness remain unimplemented.
No provider, registry, geography, image upload, publication fallback, marketplace
grant, worker schedule, retention schedule, public discovery or public projection
is selected by this work. ADR-081 real-data/launch gates remain in force.
