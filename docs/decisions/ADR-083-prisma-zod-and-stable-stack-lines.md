# ADR-083: Select Prisma, Zod, Tailwind, and Stable Stack Release Lines

- Status: Accepted
- Date: 2026-10-12
- Supplements: ADR-072, ADR-074

## Context

ADR-072 selected TypeScript, Next.js, and PostgreSQL but left the access/migration tooling, validation library, styling framework, and runtime/framework versions open. ADR-074 selected Better Auth and requires its schema changes to share the versioned database migration path. Halaga needs a small TypeScript toolchain, reviewed PostgreSQL constraints for concurrency and privacy invariants, and repeatable installs while remaining free-first and provider-neutral.

At decision time, Prisma's release-status documentation identifies Prisma ORM 8 as a release candidate, while Prisma ORM 7 remains the supported stable line. Better Auth documents adapters for Prisma and Zod is its current major release line for TypeScript runtime schemas.

## Decision

- Use Prisma ORM 7 for relational data access and Prisma Migrate for versioned schema migrations.
- Keep Prisma schema and checked-in migration history aligned, and document any intentionally SQL-only database features as schema exceptions. Review generated migrations before applying them. Hand-edit checked-in migration SQL when needed for PostgreSQL-specific constraints or indexes that the Prisma schema cannot represent; preserve those invariants in the database and ensure later generated migrations do not silently remove them.
- Apply migrations through the migration workflow in local development and deployment. Do not use schema-push workflows against shared or persistent environments. Keep Better Auth schema changes in the same reviewed migration history.
- Use Zod 4 for runtime validation of untrusted data at server boundaries. Shared schemas may also support client-side feedback, but the server remains authoritative. Domain commands, authorization, privacy-safe projections, and database constraints remain separate required controls.
- Use Tailwind CSS 4 as the styling framework with the official Next.js integration. Tailwind selection does not select visual design, design tokens, or a component library; those remain governed by `design.md` and separate accepted decisions.
- Adopt these stable release lines for initial implementation: Node.js 24 LTS, Next.js 16, React 19, TypeScript 5.9, Prisma ORM 7, PostgreSQL 18, Better Auth 1.x, and Zod 4. Tailwind CSS 4.3 is the current stable line at the time of this decision.
- Do not freeze patch versions in this ADR. At application bootstrap, pin exact package versions in the manifest and lockfile and the Node.js patch/runtime in the runtime pin. The bootstrap is complete: `app/package.json` and `app/package-lock.json` use exact direct dependency versions, and `app/.nvmrc` pins Node.js `24.21.0` (verified with Node.js `v24.21.0`). Keep dependencies on maintained security releases; review major upgrades as needed. PostgreSQL minor patch support and upgrade procedure are confirmed with the selected host.
- Prisma ORM 8 may be reconsidered after general availability and a compatibility review; it is not selected by this ADR.

## Consequences

- Prisma's schema and migration history need review together, especially when PostgreSQL-specific checks, partial indexes, exclusion rules, or concurrency controls are required.
- The database remains the enforcement point for transaction-critical invariants even when the Prisma client provides application types.
- Zod schemas help parse and report malformed inputs but do not become the definition of domain eligibility or authorization by themselves.
- Exact direct package patches are reproducible through the manifest and lockfile, and the Node.js patch is selected in the runtime pin. Keep these pins updated through reviewed maintenance changes.
- No hosting provider, package manager, PostgreSQL host, paid service, or billing path is selected.

## Sources

- ADR-069, ADR-071, ADR-072, ADR-073, ADR-074, and ADR-076
- [Prisma ORM release status](https://www.prisma.io/docs/orm/release-status)
- [Prisma ORM 7 migration documentation](https://www.prisma.io/docs/orm/prisma-migrate)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Zod packages](https://zod.dev/packages/zod)
- [Tailwind CSS Next.js installation](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [Tailwind CSS v4.3 release](https://tailwindcss.com/blog/tailwindcss-v4-3)
- [Next.js 16 release](https://nextjs.org/blog/next-16)
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [PostgreSQL 18 release](https://www.postgresql.org/about/news/postgresql-18-released-3142/)
- Architecture interview decision made on 2026-10-12
