# First Physical Domain Schema: Review Draft

## Later synthetic-photo supplement (2026-10-21 PHT)

Accepted ADR-095 is implemented by
`app/prisma/migrations/20261021150000_private_draft_photos/migration.sql`.
The original foundation/SQL suffix and legacy `ListingMedia` rows are unchanged.
`draft_photo` owns private upload identity/hash, owner/listing scope, byte/type/quota,
original cutoff, processing state and fenced job data. Immutable composite revision
references preserve exact order. Revision `photoCommand` stores normalized retry
identity/order, never bytes/metadata. Ordinary text saves carry references forward.
Attempts allow one final outcome; immutable events preserve minimized outbox/audit
history. Checks constrain types, bytes/order, executions, policy and lease/status
shape. Authorization, quota/count and eligibility remain server responsibilities.

Scoped retention holds preserve immutable authorizer/purpose/start/review facts and
one attributed release. No staff reader/review/write endpoint or role grant exists.
Overdue holds block erasure, not expired owner reads. Cleanup erases eligible blobs
before deleting references/jobs/draft history and never cascades unsupported legacy
or published records. See [verification](../DRAFT_PHOTO_LOCAL_TESTING.md).

- Status: Foundation migrated and verified locally; application commands pending
- Date: 2026-10-12
- Candidate: `app/prisma/schema.prisma`
- Product authority: `PROJECT.md`
- Logical model: `DOMAIN_MODEL.md`

## Draft restriction supplement (2026-10-21 PHT)

`20261021090000_draft_marketplace_restrictions` adds staff/audit-only scoped
decisions with reason, start/review instants, authorizing staff reference, optional
appeal route and paired revocation time/actor. SQL checks scope and metadata,
preserves decision history, rejects revocation reversal and acquires the affected
account row lock for all changes. The draft guard selects only matching decision
IDs. No staff access or retention job is mounted; authorized retention deletion
remains possible under PROJECT.md §28. See ADR-090's implementation record.

## Scope

Availability supplement (2026-10-21 PHT): the additive
`20261021120000_draft_fulfillment_availability` migration adds nullable text
`ListingRevision.fulfillment`. Its SQL-only `listing_revision_fulfillment_choices`
check permits only `pickup`, `meetup`, `both` or null (unselected). Empty client
selection maps to null; existing revisions stay null without a history rewrite.
The existing revision update trigger also protects this field. Preserve this
constraint in future generated migrations; the original foundation SQL suffix
remains unchanged. No exact location columns or appointment records are added.

This foundation covers the domain account mapping, Better Auth core tables, listing identity and lifecycle, listing revisions, publication/renewal cycles and public-availability intervals, listed item groups, versioned diagnostic answers, ownership attestations, and listing media metadata. SQL triggers reject in-place updates to revision content and cycle history. Negotiations, reservations, cases, notifications, durable jobs, audit/access records, and retention exceptions remain for later slices.

ADR-084 settled the physical choices. The Better Auth CLI-generated core models are aligned, and the SQL constraints are included in `app/prisma/migrations/20261012130000_account_listing_foundation/migration.sql`. The migration was verified with rolled-back synthetic data and applied to the loopback development database. This does not authorize real participant data or public deployment.

### Local synthetic incomplete-draft supplement (2026-10-19 PHT)

The additive `20261019090000_incomplete_laptop_drafts` migration makes
`ListingRevision.barangayCode` and `ListedItemGroup.condition` nullable. No other
column, trigger or SQL constraint changes. Null means unselected controlled
geography or no validated condition; it is not a new condition enum. Publication
must still require controlled geography and validated diagnostic/evidence/safety
facts before exposure. There is no publication command in this slice.

Draft create/save appends immutable revisions/groups/versioned answers and updates
the current pointer transactionally. Existing SQL history triggers continue to
reject updates. Request UUIDs use revision IDs for idempotency; guarded expected
versions prevent stale overwrites. Accepted behavior/included diagnostic arrays
use their own per-question JSON rows with separate details. Owner-private reads
select only draft fields; private expectation is never a public projection.
No audit/outbox schema is added for publication. See ADR-084's implementation record
and [LAPTOP_DRAFT_LOCAL_TESTING.md](../LAPTOP_DRAFT_LOCAL_TESTING.md).

## Accepted physical choices

These are the reviewed implementation choices recorded in ADR-084. Their product-level implications are synchronized in `PROJECT.md` and the glossary where needed:

| Concern | Choice | Reason / cost |
| --- | --- | --- |
| Primary identifiers | PostgreSQL UUID columns generated by Prisma | Opaque IDs and native UUID storage; IDs are generated by the application client. |
| Better Auth boundary | Separate generated `User`, `Session`, `Account`, and `Verification` models with a unique domain mapping FK | CLI output is preserved in `app/prisma/better-auth.generated.prisma`; the main schema adds timestamptz precision and a restrictive domain mapping. Runtime authentication settings and deletion orchestration remain future work. |
| Money | `Decimal(12,2)` for seller price expectation | Exact PHP values without floating-point rounding; centavos are supported. Precision is not a product maximum. Server validation remains required. |
| Time | `timestamptz(3)` for instants, including passed adult-check time | ADR-093 removes the original DOB `date` column through a forward migration. PHT age checking uses transient signup input; only minimal check/attestation evidence persists. |
| Listing history | Separate `ListingRevision` rows with per-listing version number | A composite foreign key from `(Listing.id, currentRevisionNumber)` to `(ListingRevision.listingId, version)` selects an existing revision of the same listing. The pointer starts null during transactional creation, then is set before publication. |
| Publication history | A numbered `PublicationCycle` per initial publication or successful renewal, linked to its listing revision and confirming account | Records each cycle's original start and deadline. Prior cycles remain intact. The latest cycle number supplies the current deadline; no renewal limits, grace period, or newest-sort rule are decided here. |
| Public exposure | Separate `PublicationAvailabilityInterval` records per cycle | Measures actual publicly active time, excluding held, paused, reserved, and removed time. A cycle's 30-day lifetime is not itself evidence of 30 days of public exposure. |
| Diagnostics | One row per question answer, keyed by item group, schema version, and question key, with a PostgreSQL JSON value | Preserves the laptop prototype version and submitted answer history while allowing answer forms to evolve. Does not define diagnostics for other categories. |
| Taxonomy and condition | PostgreSQL enums represented as Prisma enums | Rejects invalid controlled values in storage; taxonomy changes require reviewed migrations. |
| Media | Relational object keys and processing metadata; bytes remain in private object storage | Provider-neutral metadata; does not grant public access by itself. |
| Deletion | Restrict FK deletion from accounts/revisions to dependent domain rows | Prevents accidental cascade loss; authorized retention workflows must explicitly delete/anonymize eligible records. |

## Review findings and required follow-up

1. The migrated composite current-revision FK enforces existence and same-listing membership. The SQL check forbids a null pointer outside `DRAFT`. Create the listing, insert its first revision, and set the pointer in one transaction. Application commands must still reject exposing incomplete drafts.
2. The schema has no database audit-event model yet. Before listing publication or other consequential commands, add the audit/outbox records required by the architecture and commit them with state changes.
3. The lifecycle field is mutable. It does not preserve state-transition history alone; audit/event modeling must cover transitions before implementation uses it as authoritative state.
4. `ListingMedia` captures object identity, hash, processing state, order, and retention deadline, but not upload authorization, scan details, deletion completion history, or public-derivative approval provenance. Those belong in the media-processing slice.
5. `ListingRevision` stores an optional price expectation. All server read paths must continue to use explicit privacy projections; field presence is not permission to expose it.
6. SQL-only checks, triggers, and indexes are installed and recorded in `PHYSICAL_SCHEMA_CONSTRAINTS.sql`. The fragment matches the migration suffix. The native PostgreSQL `btree_gist` extension supplies the UUID operator class for an exclusion constraint preventing overlapping availability for one listing, including across cycles. Verify extension support on the eventual host. This slice does not include the active-reservation invariant.
7. The exact accepted category diagnostic readiness, barangay registry, retention exception workflow, and auth security settings remain governed by existing deferred decisions; this schema does not settle them.

## Accepted behavior represented by the revised draft

`ListingStatus` distinguishes `VALIDATING`, `HELD`, `REJECTED`, `REMOVED`, `EXPIRED`, and `CLOSED`, following `PROJECT.md` §30.1 and ADR-058. `CLOSED` means closed by mutually confirmed completed transaction, never administrative transaction closure. `PAUSED_BY_RESERVATION` represents the listing pause; reservation-specific states remain in the future reservation aggregate.

`RESOLVING_EXISTING_ACTIVITY` distinguishes an unreserved listing past its cycle deadline with outstanding activity from a listing accepting new offers. A reserved listing remains paused when day 30 passes. New-offer eligibility must check the current cycle deadline and authoritative state even if a deadline worker is late. Existing proposals retain their deadlines and may still produce a reservation; renewal cannot reset those deadlines. ADR-047 governs these rules. Publication and renewal commands add a cycle atomically; pauses/removals close public-availability intervals instead of changing old cycle deadlines.

## Reviewed migration checks and guarded validation

`PHYSICAL_SCHEMA_CONSTRAINTS.sql` is installed through the migration. Storage enforcement covers:

- Positive item quantity, revision number, and publication cycle number.
- A current revision must exist outside `DRAFT`, using the null-pointer check plus the composite foreign key.
- Exact 30-day PHT publication cycle deadlines, sequential cycle numbers, initial-publication/renewal kinds, and confirmation by the listing's seller.
- Availability interval ordering and membership in its immutable cycle's window; exclusion across all cycles of a listing; at most one open interval per listing.
- Cycle, revision, item-group, answer, and ownership history reject updates. Availability may close an open interval once. Deletion remains possible through authorized retention workflows, which are not implemented yet; history must not become indefinite retention.
- `CLOSED` requires a closure timestamp; `EXPIRED` requires an expiry timestamp. These checks do not prove bilateral completion or resolution of outstanding proposals.
- Publication/renewal must verify the actor is the listing seller, the referenced revision is validated, and required ownership/photo/taxonomy/safety gates pass. A foreign key does not establish eligibility or authorization.
- Positive media byte size and nonnegative sort order; evidence limits and processing approval still require server enforcement.
- Money uses exact two-decimal PHP precision. `numeric(12,2)` capacity is not a business maximum. This review does not add a seller-expectation lower or upper bound absent an accepted rule.

Server validation must supplement database checks. `prisma validate` and client generation establish schema/tooling compatibility; neither proves privacy, state transitions, database enforcement, or retention behavior.

`app/src/server/foundation-validation.ts` adds exact-string PHP parsing (no floating-point coercion or silent third-decimal rounding), positive-integer quantity validation, and per-question laptop answer/version/choice/explanation validation. Future commands must call these parsers and the whole-draft safety/condition validator. No application endpoint invokes a publication or completion command yet.

Readers must clip an open availability interval to its cycle deadline and the observation time. A late worker must not count elapsed time after expiry as public exposure. Renewal commands must close the prior open interval before opening the next one, then commit with the required audit/outbox records. Database metadata cannot replace server eligibility, ownership, moderation, revision, deadline, and authorization checks.

## Local verification of this revision

Prisma schema validation and client generation pass. `npm.cmd run test:foundation` passes 11 tests/subtests, including a full migration replay in a fresh transactional schema with synthetic fixtures, negative PostgreSQL writes, installed Better Auth core-schema compatibility, exact centavo storage, and server input parsers. Fixtures and the verification schema are rolled back. `npm.cmd exec tsc -- --noEmit` passes after enabling TypeScript extension imports for native Node 24 scripts. `npm.cmd run db:migrate:local` applied the migration successfully; it refuses non-loopback targets and populated untracked public schemas. Node emits the existing module-type warning; it does not prevent these commands from succeeding.

The first attempt to run a pinned `auth@1.7.7` CLI failed because that independently versioned CLI package has no such release. Registry access also needed Node's system CA trust. The CLI then generated the stock schema successfully using a tooling-only config; compatibility is checked against the installed Better Auth 1.7.7 core definitions. TLS verification remained enabled.

`npm.cmd run db:foundation:check` verified the installed migration checksum, 15 constraints and seven enabled publication/history triggers. Prisma migration status reports the schema up to date. ESLint passes. No browser/UI, real participant, lifecycle-command, or public-deployment verification was performed; those flows are not implemented by this foundation.

## Slice 2 old-address notice schema review (2026-10-14)

The later password-change in-app review below leaves this recipient restriction intact.

ADR-087 requires a durable security notice to the previously verified address
when an email change commits. The signup outbox's account-reference-only shape
cannot retain that recipient: the referenced identity now contains the new
address. A consumed token also cannot serve as its durable recipient record.
Encoding an address in a deduplication key or retaining a consumed credential
would spread private data or conflate token and notification lifecycles.

The narrow migration `20261014100000_email_change_notice_recipient` adds nullable
private `outbox_event.recipientEmail`. Its SQL-only check
`outbox_event_security_notice_recipient` requires a nonempty recipient for
`account.email-changed-security-notice` and requires null for every other event
type. Existing intent rows stay null; no old recipient is fabricated. Prisma
represents the column; retain the SQL-only purpose check in future migrations.
The token binding fits the existing private verification table, so no token,
account or session schema change is needed. No package is added.

The security intent omits the proposed/new address, raw token/link and other
unnecessary private data. Recipient reads are restricted to the delivery purpose
and authorized/audited diagnosis; general logs/readers/caches must exclude it.
Retention/deletion integration remains gated and this snapshot does not justify
indefinite retention. See ADR-087's implementation record and
`docs/EMAIL_CHANGE_LOCAL_TESTING.md` for privacy review and verification.
The migration is replayed in random disposable test schemas only, not applied
to persistent local/deployed data. Future use requires reviewed migration rollout.

## Settled review questions

ADR-084 records the decisions:

- Keep UUIDs generated by Prisma.
- Support centavos with exact `Decimal(12,2)` storage; no product maximum is set.
- Store one JSON answer per question under an item group and schema version.
- Keep content, diagnostics, ownership declarations, and media revision-scoped.
- Scope the first domain migration to the account/listing foundation; add the active-reservation invariant before negotiation/reservation implementation.

The first migration's alignment and SQL prerequisites are satisfied. Full lifecycle transitions, bilateral completion, server authorization, privacy projections, idempotent commands, retention execution, and audit/outbox support remain required before implementing consequential marketplace flows.

## Slice 2 password-change in-app notice review (2026-10-17 PHT)

`20261017090000_password_change_in_app_notice` adds one account-private table;
it does not alter `outbox_event.recipientEmail` or its email-switch-only constraint.
There was no existing in-app notification store to reuse. The row holds only an
application-generated random UUID (the committed event identity), account FK,
versioned event type, unique in-app work key, event time, fixed email-eligibility
outcome and nullable read time. It is materialized in the credential transaction
and doubles as the synchronous in-app processed-work record. No job is necessary
for this atomic local write. Separate successes have separate UUIDs even at the
same timestamp/session; duplicate event/work insertion cannot add another notice.

SQL-only checks fix the event type/version, bind the channel work key to its UUID,
restrict eligibility to ELIGIBLE/INELIGIBLE, and prevent a read time before creation.
The account FK restricts deletion; it is not permission for indefinite retention.
The owner-only unmounted detail projection returns ID/type/version/time/read state
after checking the current stored session and undeleted mapping. No recipient,
password/hash/session reference, rendered content, public/staff reader or cache is
introduced. Nullable read storage does not mount a mark-read command or interface.

ADR-089's later implementation below supersedes this record's earlier email and
ordinary-retention gaps. No later backfill is implemented or authorized.
Only disposable synthetic schemas replay this migration. Application Prisma and
shared sandbox connections pin UTC to satisfy the installed adapter's timestamp
normalization assumption; no database/server-wide timezone is changed. PHT domain
and display rules remain in force. See `docs/PASSWORD_CHANGE_LOCAL_TESTING.md`.

## Password-change email and retention supplement (2026-10-20 PHT)

Accepted ADR-089 governs migration
`20261020090000_password_change_email_retention`. It leaves Prisma's nullable
recipient column and existing email-switch rule intact, adding password-change
purpose support with SQL-only guards:

- An initial password-change intent requires its recipient. Its event/account/
  work/time binding cannot change; addressing can only stay fixed or become null.
  Erased addressing cannot be restored. Other event types cannot be relabeled.
- Password-change job creation/updates enforce the exact original 168-hour expiry
  and event creation time. Existing jobs cannot change their outbox binding or
  extend the delivery deadline.
- Committed account deletion triggers job fencing and recipient/in-app erasure in
  that account transaction. READY/LEASED become SUPPRESSED; SENDING becomes UNKNOWN;
  prior terminal outcomes stay truthful. Job updates precede outbox erasure,
  matching dispatch completion and account-locked cleanup order.

No new table, role, endpoint, staff reader or schedule is added. Cleanup purges
email work/metadata together at 30 terminal days capped by 37 event days, with
independent 90-event-day owner-notice retention. SQL triggers/checks are intentional
schema exceptions; future generated migrations must preserve them. Disposable
synthetic schemas replay all migrations, including failure/rollback/race checks;
no persistent/shared migration was applied. Hold enforcement, actual deletion
workflow, provider/backup propagation and operations remain real-data gates.

