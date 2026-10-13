# Server data-access, command, and logging boundary review

- Reviewed: 2026-10-13, PHT
- Baseline: `3be42d4`; working tree was clean before review.
- Boundary task diffs: `624642b..3be42d4`, covering `842da12` (data access),
  `82567c9` (guarded command), and `3be42d4` (logging).
- Result: current foundation verified with two logging fixes. Persisted
  repository projections and real product commands remain unimplemented.

## Authority and scope

Read root and application `AGENTS.md`, `PROJECT.md` sections 5, 26, 28, 29.1,
33, and 34; `architecture.md` sections 2, 3, 5, 6, and 8.2; `design.md` privacy,
interaction, source-authority, and open-decision guidance; the domain glossary;
and ADRs 069, 070, 072, 073, 074, 081, 083, 084, and 085. Inspected the current
source tree, package scripts, local tooling, tests, and boundary-task diffs.
The installed Next.js data-security guide was consulted before code edits.

ADR-072 amends ADR-070's separate-worker acceptance; ADR-073 accepts the durable
job contract without accepting deployment parameters. ADR-083 settles the older
open ORM and validation choices. ADR-085's allowlist is the current operational
logging rule. No unresolved authoritative conflict blocks this foundation review.
No new product, provider, authentication, worker, or retention decision is made.

The affected paths are the browser-memory synthetic laptop practice UI, the
shared server infrastructure, and the synthetic command's validation, denial,
commit, rollback, and error handling. There are no account endpoints, listing
publication commands, negotiations, scheduler, notification worker, or staff
views. No such flow was added.

## Boundary results

| Boundary | Evidence and result | Remaining limit |
| --- | --- | --- |
| Module/data ownership | The [repository contract](../../app/src/server/repositories/README.md) documents existing modules and permitted readers/writers for all six information scopes. Only `src/server/prisma.ts` constructs the application client; it is lazy, server-only, and disables Prisma query logging. | The six-scope matrix describes requirements for future owning modules, not implemented APIs or current record-access grants. Infrastructure does not authenticate or authorize callers. |
| Pages/components | Inspected all application imports and database/logging call sites. `page.tsx` renders the practice form; the client form imports pure domain modules. No page/component imports Prisma or a driver, or executes a database query. ESLint and synthetic import checks pass. Static imports/re-exports and literal dynamic imports/`require()` are restricted. | These development checks do not prove authorization and do not analyze computed import specifiers or prevent a future repository from exposing its client. No current bypass call site was found. |
| Repository projections | `src/server/repositories/` contains only its README: zero executable read methods. The contract requires explicit Prisma `select`, caller verification, a named minimal result, and role/purpose/access audit for staff. Synthetic command state reads select only `owner_id` and `state`; its result contains only `id` and `title`. The separate local public preview uses an explicit field allowlist and passes its exclusion tests. | Persisted repository projection behavior is **not applicable yet**, not a tested implementation. The browser preview is not an authenticated access boundary. Future repositories need authorized/denied caller and projection tests. |
| Guarded writes | `defineGuardedCommand` validates asynchronously before actor resolution; missing actors fail before a transaction. State loading, exact-`true` authorization/state guards, and writes run inside the supplied transaction. The only command definition is synthetic: strict input, trusted fictional session map, ownership/current-state checks, parameterized SQL, two transaction-handle writes, explicit result. PostgreSQL tests prove denials leave data unchanged, both writes commit, and a real second-write NOT NULL violation rolls back the first. | The generic helper cannot force callback purity, real session authentication, transaction-handle use, explicit results, locks, isolation, deadline/revision checks, retry idempotency, audit, or outbox. Those remain concrete-command requirements. Prisma interactive transaction wiring is documented but no production runner exists to exercise. |
| Operational logs | Logger and command are server-only. Fresh records contain fixed operation/outcome/internal codes, plus a primitive UUID string if valid. Command errors are rethrown without serializing them. Sentinel tests cover validation issues, request/actor/state/result data, all command failure phases, real PostgreSQL rollback, and success. Two reproduced defects are fixed below. Configuration errors expose field names only; inspected local checks print fixed messages. | No request handler or worker logging exists. Tests do not certify hosting/provider logs or inherited Prisma migration CLI output. No restricted audit implementation exists. An output-sink failure can lose an operational event. |

## Findings and fixes

1. **Request-ID coercion could leak sensitive content.** The UUID regex coerced
   a non-string object through `toString()`, then JSON serialization could use a
   different `toJSON()` value. A synthetic object reproduced a session-token
   sentinel in the output. Added primitive string and exact-length checks before
   the UUID regex, also excluding trailing line terminators accepted by `$`.
   Current typed callers do not pass such an object; this fixes runtime validation
   rather than claiming an existing endpoint disclosure.
2. **Logging errors could replace command results/errors.** A throwing sink
   caused a command to reject after its transaction runner had committed, and
   could mask the original exception. Logger output now catches sink errors
   without serializing or retrying them. Tests preserve a committed result,
   the original write exception, and a validation rejection. This implements
   ADR-085's exception/control-flow separation; it does not add durable logging.
3. **Verification and documentation gaps.** The prior logging suite checked an
   actor-resolution failure and direct logger calls, but did not exercise actual
   invalid-input command execution, all failure phases, successful private
   results, or PostgreSQL error details. Added those synthetic checks. Updated
   documentation that still described operational logging as pending. The
   foundation slice remains in progress.

## Changed files

- `app/src/server/operational-log.ts`: primitive, exact-length request-ID validation and sink
  failure containment.
- `app/tests/operational-logging.test.mjs`: coercion/sink regressions and sentinel
  coverage across validation, actor, transaction, state/guards, write, commit,
  and success. Non-database runners here test logging only.
- `app/tests/guarded-command.test.mjs`: capture real transaction logs and assert
  exact metadata while excluding private synthetic input, actor/session, and
  PostgreSQL diagnostic details.
- `app/src/server/repositories/README.md`: module and six-scope access matrix.
- `app/README.md` and `docs/IMPLEMENTATION_SLICES.md`: synchronize foundation
  logging status, verification, and remaining work.
- `docs/architecture/SERVER_BOUNDARY_REVIEW.md`: this review record.

## Verification

All npm commands ran from `app` using existing, inspected package scripts.

| Command | Result |
| --- | --- |
| `npm.cmd run test:foundation` | Before changes: 19 passed. Final: 20 passed, including real local PostgreSQL commit/rollback and safe-log checks. Migration fixtures use a transaction-scoped isolated schema and roll back; command fixtures use temporary tables removed on disconnect. |
| `npm.cmd run test:logging` | Baseline: 2 passed. Regression reproduction before fixes: 3 passed, 2 failed for the two defects above. Final: 5 passed. |
| `npm.cmd run test:listing` | 4 passed, including public preview field/sentinel exclusions. |
| `npm.cmd run lint` | Passed, including current source import restrictions. |
| `npm.cmd run build` | Passed compilation, TypeScript checks, and static page generation. |
| `git diff --check` (repository root) | Passed for tracked changes; Git reports existing LF/CRLF conversion notices. |

Node's existing `MODULE_TYPELESS_PACKAGE_JSON` warning appeared in tests; it did
not fail checks. No package, schema, migration, UI, or runtime topology was changed.
No dependency installation, persistent migration, hosting check, browser/UI
exercise, or unrelated diagnostic/photo suite was needed for these changes.
All fixtures are synthetic; no participant records were read or modified.

Before adding real reads/commands, resolve the applicable open authentication
settings and verify each concrete projection, authorization, concurrency,
idempotency, history, audit/outbox, and response-serialization boundary. Real
participant data remains gated by ADR-081. This review does not certify a public
pilot or completion of the application/data foundation slice.
