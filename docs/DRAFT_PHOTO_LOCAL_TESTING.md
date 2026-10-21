# Private synthetic laptop draft photos

Date: 2026-10-21 PHT. The owner explicitly approved groups A/B/C of
[ADR-095](decisions/ADR-095-private-synthetic-draft-photo-processing.md), including
whole-draft expiry, after reviewing the proposal. No real participant data or
publication is enabled.

## Implemented owner paths

Changed-file map:

- `app/src/domain/draft-photo-policy.ts`, `app/src/server/draft-photo-processing.ts`
  and the four `draft-photo*` repository modules implement budgets, private bytes,
  processing, commands, HTTP and worker runtime. `laptop-drafts.ts` carries scoped
  references and expiry; `laptop-draft-review.ts` preserves honest evidence guidance.
- The two `app/src/app/api/laptop-drafts/[listingId]/photos` route files mount the
  owner paths. `app/src/app/drafts/photos.tsx`, `workspace.tsx` and `review.tsx` add
  controls, safe images and pinned history.
- `app/prisma/schema.prisma` and `20261021150000_private_draft_photos/migration.sql`
  add integrity/history/job/hold storage. `app/scripts/draft-photo-worker.mjs`
  exposes only the explicit run-once command.
- `app/package.json`/lock pin sharp and wire existing/new scripts; `.env.example`,
  `.gitignore` and `next.config.ts` document private setup and exclude blob artifacts.
- `app/tests/draft-photos.test.mjs`, existing draft/Next suites and the browser
  helper verify the feature against disposable synthetic schemas and images.
- PROJECT, architecture, design, ADR-095/index, glossary, schema review, repository/
  app READMEs, slice tracker and the two local testing guides synchronize behavior,
  approval, retention, verification and remaining gates.

| Method/path under `/api/laptop-drafts/{listingId}` | Behavior |
| --- | --- |
| POST `/photos` | Admit an owner-bound intent with request UUID, expected revision, SHA-256, byte count and JPEG/PNG type; reserve slots/storage. |
| PUT `/photos/{photoId}` | Read one bounded binary file, verify type/signature/hash/length, finalize private bytes and atomically append pending references, processing-requested outbox event and durable job state. Exact retries return the original revision. |
| GET `/photos[?revision=N]` | Fixed owner-private ordered reference/status projection. Explicit N never substitutes current history. |
| GET `/photos/{photoId}?revision=N` | Only an approved safe JPEG derivative with exact authorized revision membership and approval provenance. Never originals. |
| PATCH `/photos` | Guarded removal or complete current-order permutation; append a revision and preserve history. |
| DELETE `/photos/{photoId}` | Cancel an unfinished upload through a committed deletion intent; erase idempotently unless held. Finalized references use PATCH removal instead. |

Stored sessions, undeleted owner mapping, never-published draft state and editing
restrictions are rechecked under existing locks, including retries. Composite FKs
and commands enforce same-owner/same-listing references. Ordinary saves carry
current ordered references forward. Owner projections exclude hashes, object paths,
filenames, owner IDs, scanner details and original metadata. Responses are no-store,
Cookie Vary, no-referrer, noindex and nosniff. There is no original-byte endpoint,
public image path, permanent object URL or shared image optimizer. Shell metadata,
HTML and minimal draft lists stay content-free. The private blob directory is
excluded from build tracing; runtime scanner/path checks are not bundled assets.

The editor uses labeled native file selection, byte progress separate from
processing, exact-request recovery, explicit unfinished-upload discard, refresh,
Remove and Move earlier/later buttons. Save text before photo mutations; conflicts
preserve edits. Moving announces position and retains focus on that asset's control;
upload/removal focuses file selection. No drag-only action, browser persistence or
original object-URL preview is used. Saved review includes only that revision's
ordered private references/derivatives. Synthetic photos never qualify as actual-item
publication evidence; actual-item clarity/identity/defect coverage remain unavailable.

## Processing and retention

`draft_photo` owns the asset and one logical durable PostgreSQL job.
`draft_photo_attempt` preserves fenced execution history; `draft_photo_event` is
the minimized immutable outbox/audit record. Initial pending references/event/job
commit together. Account-email jobs are separate.

Accepted limits: JPEG/single-frame PNG, 10 current slots, 10 MiB originals,
24,000,000 decoded pixels, 10,000 pixels per axis and 256 MiB per owner including
pending/output reservations and history. Explicit APNG rejection supplements strict
decode/signature checks. ClamAV scanning and sharp 0.35.5 fresh sRGB JPEG encoding
gate approval: quality 85, at most 1,600 pixels on the long edge, no enlargement,
correct orientation, transparency flattened on white. Output is decoded and checked
for retained EXIF/GPS/XMP/IPTC/comments/ICC data before approval. Codec success alone
is never malware clearance.

Policy `synthetic-laptop-photo-v1`: two-minute fenced lease, 30-second renewal,
30-second execution timeout, five executions and 30/60/120/240-second backoff.
Permanent unsafe/unsupported files are rejected; transient scanner/I/O failures
retry within the original admission window; exhaustion becomes failed work.
Stale leases record interruption and recover. Owners may repeat an uncertain upload
or submit new bytes as a new upload; no owner failed-job reset or scanner bypass
exists. Role/purpose/audited staff retry remains unmounted.

Originals are erased after approval/permanent rejection; pending/transiently failed
originals expire 24 elapsed hours from admission. Whole never-published synthetic
drafts, including text-only history, expire after 30 inactive elapsed days. Only
successful current-revision content/photo mutations update that clock. Reads,
committed retries, upload admission/cancellation and worker activity do not renew it.
Expired draft reads fail immediately; physical cleanup awaits explicit invocation.
Removal never rewrites old links. Historical derivatives remain private under the
draft cutoff, not indefinitely without a valid exception.

Run-once cleanup precedes processing of at most one job and also cleans its outcome.
Deletion intents commit before bulk byte erasure; interrupted writes, missing
objects and failed erasure are restart-safe. Stale workers cannot approve through
new deletion state. Orphans use the intent's original cutoff, or creation time plus
the same 24-hour window if no intent survived. Scoped holds prevent erasure, never
expired owner access. Hold facts are immutable and release is attributed; overdue
holds need review and never auto-release. Unsupported legacy media/ownership history
is not cascaded. General deletion and staff recovery/hold-review surfaces remain
unimplemented; future deletion commands must adopt the accepted safeguards.

## Local setup

Run from `app`, using fictional/generated photos and synthetic accounts only:

1. Use `npm.cmd run db:generate` and `npm.cmd run db:migrate:local`. The migration
   script permits loopback/public-schema tracked databases only and deploys **all**
   pending migrations; inspect them first.
2. Set absolute `DRAFT_PHOTO_ROOT`. Inside this repo only `app/private-draft-photos`
   is allowed; it is Git-ignored and excluded from build tracing. External roots
   must be private and unmapped by any static server. Symlink/reparse-point ancestors
   and served/source/build roots are rejected. Windows operators must verify NTFS
   permissions for the web/worker identity; POSIX private modes alone do not do that.
3. Install/review local ClamAV and signatures. Set absolute `DRAFT_PHOTO_CLAMSCAN`
   and the exact installed `DRAFT_PHOTO_CLAMSCAN_VERSION`, the `ClamAV major.minor.patch`
   prefix before the slash in version output. No version or executable is guessed.
   Missing/unhealthy scanning fails closed. No real scanner was installed for this task.
4. Use existing `npm.cmd run dev`; sign in and create/resume `/drafts`. Save text,
   then select/upload a fictional JPEG/PNG with the keyboard.
5. In a separate terminal with the same environment/database/root, explicitly run
   `npm.cmd run jobs:draft-photos`; Refresh photo status. Repeat manual invocations
   for other jobs; no polling or hosted schedule is installed.
6. Verify retry after uncertain response, rejected-file re-upload, ordering/removal,
   retained historical order and another synthetic owner's denial.
7. Invoke cleanup before abandoning the environment. Downtime delays physical
   erasure, not access cutoffs. Keep backups synthetic and erase disposable artifacts.

Tests require explicit `SIGNUP_TEST_DATABASE_URL` naming the dedicated loopback
`halaga_signup_test` database. The existing helper replays all migrations in a random
schema and drops it in `finally`, without app-data fallback. This session derived
the URL in memory from local `DATABASE_URL`, replacing only its database path;
connection strings were not printed. The existing browser opt-in used installed
agent-browser/Chrome. Positive processing tests inject a scanner only through an
internal constructor; runtime has no equivalent environment or HTTP switch.

## Verification record

Commands run from `app` on 2026-10-21 PHT:

| Command | Result |
| --- | --- |
| `npm.cmd run db:generate` | Passed; Prisma 7.10.0 client generated. |
| `npm.cmd run test:laptop-drafts` with dedicated test URL | 29 passed. Owner/listing denial; invalid signature/type/size/pixel/APNG; fictional metadata removal; private derivative projections; concurrent/exact retry; outbox rollback; immutable references; slot/quota guards; transient/permanent/exhausted failure; stale lease and deletion fencing; failed erase recovery; expiry/holds. |
| `npm.cmd run test:sign-in-app` with existing browser opt-in | 19 passed. Real mounted routes/auth/file input/XHR progress, lost-response retry without duplicates, rejection recovery, derivative display, keyboard order/removal/focus, history, and existing account/practice flows. Zero photo-screen automated WCAG violations; 1440/375/320px reflow and 200% text sizing passed. Disposable schemas/blobs/browser sessions cleaned up. |
| `npm.cmd run test:foundation` | 21 passed; repository boundaries, guarded transactions, foundation history/storage. |
| `npm.cmd run test:logging` | 5 passed; operational log allowlist regressions. |
| `npm.cmd run test:photos` | 4 passed; fictional browser-only practice remains separate. |
| `npm.cmd run lint`; `npm.cmd exec tsc -- --noEmit` | Passed. |
| `npm.cmd run build` | Passed. Initial dynamic-filesystem tracing warnings were fixed; final build has no such warnings. |
| `npm.cmd run db:migrate:local` | Passed against local `halaga_dev`: 11 earlier pending migrations plus the new photo migration. No existing migration file was rewritten. |
| `git diff --check` | Passed; existing Git LF/CRLF conversion warnings only. |

Earlier failures: missing dedicated test URL; one shell-quoted Node wrapper parse
error; synthetic session newer than injected clock; render-time ref access caught
by lint. Each was corrected before passing checks. Sandbox Chrome initially closed
CDP channels; the permitted rerun reached the UI and exposed an unsupported new
test CLI focus action. Explicit focus plus Enter then passed. Lock refresh needed
npm-cache permission, an online optional bundled-package lookup and Node system CA
trust, then succeeded without changing sharp's already installed version. npm
reported nine high-severity audit findings; no force-upgrade or unrelated dependency
change was attempted. The existing Node module-type warnings remain non-fatal.

Real ClamAV positive scanning, NTFS access review, native 400% zoom, human screen
reader/Cebuano review, staff recovery/hold review, hosted/backup erasure and real-data
readiness remain unverified or unimplemented. Manual worker downtime has no promised
physical-erasure latency. Automated accessibility checks do not replace human review.
