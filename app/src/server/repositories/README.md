# Server repository boundary

The current application has no persisted domain reads. Its laptop practice draft
stays in browser memory. This directory defines the permitted location for reads
when a supported flow first needs them; no repository method or caller identity
is invented for this foundation step.

## Module access

| Module | Permitted access |
| --- | --- |
| `src/server/prisma.ts` | Construct and share the generated Prisma client using the installed PostgreSQL adapter and validated server configuration. This is infrastructure, not an authorization service. |
| `src/server/repositories/` | Future server-only reads for the owning domain module, after verifying the caller and selecting an explicit authorized projection. No domain reads are implemented today. |
| `src/app/` and other application modules | Consume scoped repository methods when they exist. No direct Prisma, generated database client, or PostgreSQL driver imports. Current pages read no persisted records. |
| `src/server/runtime-config.ts` | Parse configuration; no database access. It is also used by Prisma CLI and local tooling. |
| `src/server/guarded-command.ts` | Sequence validation, trusted actor resolution, state/authorization checks and transaction-scoped writes supplied by the owning repository. It has no database imports, concrete product command, or default permission policy. |
| `src/server/foundation-validation.ts` and `src/domain/` | Validate inputs and derive domain values; no database access or authorization grant. |
| `scripts/` and database verification tests | Local operator tooling with existing loopback guards, metadata checks, and rolled-back synthetic fixtures. They are not request handlers or repository APIs. |

## Adding the first repository method

- Import `server-only` in every repository module. Import `getPrisma` from
  `../prisma`; never create another database client or re-export the client.
- Verify the request/session or trusted system actor on the server. An account
  ID supplied by a caller is not proof of ownership. Staff reads additionally
  require the documented role, purpose, and access audit.
- Apply the relevant visibility, ownership, workflow state, revision, deadline,
  and blocking checks before returning data. This foundation does not provide
  authentication or make incomplete eligibility/restriction data authoritative.
- Use an explicit Prisma `select` for the scope in `architecture.md` section 3.
  Return only a named, minimal projection. Do not expose full records, credentials,
  session/reset/verification tokens, private media object keys, or raw errors.
- Keep private responses out of public caches, metadata, logs, and client props
  that are outside the caller's permitted scope. Database credentials and a
  server-only marker do not grant access to a record.
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
command is implemented. Atomicity alone does not enforce retry idempotency,
concurrency, revision/deadline policy, history, or audit/outbox requirements.
Those remain mandatory before implementing the affected flow. See `app/README.md`
for the command sequence, verification boundary, and unresolved auth settings.
