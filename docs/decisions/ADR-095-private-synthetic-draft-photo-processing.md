# ADR-095: Private Photo Processing for Synthetic Laptop Drafts

- Status: Accepted; groups A, B and C explicitly approved by the owner for local synthetic implementation
- Date: 2026-10-21 PHT
- Supplements: ADR-038, ADR-069, ADR-073, ADR-079, ADR-081 and ADR-084
- Scope: local/private synthetic laptop drafts; no publication or real-data grant

## Context and approval

The owner requested upload, view, removal, ordering, safe processing, immutable
revision references and accessible recovery. The same request explicitly requires
proposals and a pause where storage, processing, limits, cleanup or jobs remain
undecided. Implementation was paused with this reviewable proposal. The owner then
explicitly approved groups A, B and C, including whole-draft expiry, on 2026-10-21
PHT. The choices below are now binding for this local synthetic slice. Hosted
storage, real-data use, public publication and operational readiness remain gated.

ADR-038 leaves maximum count, file size, formats, retention and quality checks
open. PROJECT.md sections 11.1/28/34 and architecture.md sections 4.1/8.2 preserve
the private-original, safe-derivative and recorded-decision requirements. ADR-073
requires a versioned policy for each job class. ADR-088's account-email numbers
do not establish a media-job policy. ADR-065's case image/PDF limits and original
retention apply to cases, not listing uploads. Neither the six-month negotiation
period nor the 24-month closed-transaction period defines draft-media retention.
These are scope distinctions, not conflicting rules. Later ADRs through ADR-094
do not settle draft media; ADR-094 itself remains proposed.

The working tree was clean at inspection. Existing code has:

- Owner-authorized draft list/create/read/save and pinned saved-revision review;
  stored-session, owner, restriction, stale-version and retry guards.
- Strict draft validation rejecting `photos` and `media`; no upload/image route.
- An unused `ListingMedia` foundation attached to one revision, with unique
  original/derivative keys and revision/order, a hash and nullable retention time.
  It lacks an asset owner, immutable reusable revision links, processing attempts,
  approval provenance and completed cleanup records. Its states are `PENDING`,
  `QUARANTINED`, `APPROVED`, `REJECTED`, `DELETION_PENDING` and `DELETED`; there is
  no processing-failure state. The schema is not a working media pipeline.
- Explicit owner-detail/review projections that omit media. Saved review correctly
  reported photo handling as unavailable before this implementation. Separate browser-only SVG illustrations
  are fictional practice fixtures and cannot qualify as actual-item evidence.

## Accepted decisions

All numbers below are accepted local synthetic validation budgets, not measured
pilot capacity. The owner approved groups A, B and C together.

### A. Private storage, validation and display processing

Use a private local filesystem blob directory for this synthetic slice, configured
explicitly outside `public`, source assets, build output and served directories.
It must be excluded from Git and readable only by the local web/worker identity.
Do not silently fall back to a temporary/public directory. Server-generated opaque
keys, exclusive writes, resolved-path containment and symlink/reparse-point guards
must prevent traversal and replacement. No external bucket, hosting plan, billing
path or paid scanner is selected. Hosted object storage remains a later decision.

Accept JPEG and single-frame PNG only; reject SVG, GIF, WebP, HEIC, PDFs, archives,
executables and remote URLs for this slice. Filename extension and browser MIME
are untrusted. Match a permitted signature with a successful full strict decode;
reject truncation, malformed containers, animation, unsupported data and excessive
dimensions. Validate before displaying or accepting a processing result. Accepted
budgets: 10 current photo references per revision, 10 MiB (10,485,760 bytes) per
original, 24,000,000 decoded pixels, 10,000 pixels on either axis and one upload
per HTTP request. Stream the file with the byte cap; do not first buffer an
unbounded multipart body. Count pending/failed slots toward the current-photo cap.
Apply a 256 MiB aggregate stored-byte admission budget per owner,
including pending originals, historical derivatives and reserved output capacity.
Serialize quota reservations; repeated replacement must not bypass the budget.
Budget exhaustion preserves saved work and rejects new admission with safe feedback.

Use a directly pinned `sharp` dependency for full decode, orientation and
re-encoding, and local ClamAV scanning before approval. Verify exact compatible
versions and scanner/signature installation before adding or enabling them.
Missing/unhealthy scanning fails closed; a test double is permitted only inside
the disposable synthetic test harness and never grants runtime approval. These
are local processing tools. Runtime scanner installation, signatures and version
verification remain setup prerequisites; no external or paid service is authorized.

Create a fresh JPEG derivative, longest edge at most 1,600 pixels without
upscaling, quality 85, orientation applied, transparency flattened on white.
Convert pixels to sRGB and omit source metadata, including EXIF/GPS, XMP, IPTC,
comments, ICC payloads, filenames and embedded thumbnails. Decode and inspect the
output before committing approval. An original is never an image response or a
fallback for a missing derivative. Scanner and codec success establish technical
safety only; they do not establish actual-item identity, clarity or defect coverage.
Synthetic photos remain visibly labeled and never satisfy real publication evidence.

Technical basis checked on 2026-10-21 PHT: sharp documents default metadata removal
in its [output API](https://sharp.pixelplumbing.com/api-output/) and explicit
decode limits, strict failure and orientation options in its
[constructor API](https://sharp.pixelplumbing.com/api-constructor/). These support
the accepted approach; neither documentation nor header inspection proves the
pipeline safe without adversarial fixtures and full-decode tests. ClamAV's
[scanner documentation](https://docs.clamav.net/manual/Usage/Scanning.html) requires
signature setup and warns that its TCP daemon is unauthenticated. Keep scanning
local and inaccessible to untrusted clients. No scanner is installed by this ADR.

### B. Revision references, removal and bounded cleanup

Separate an owner/listing-bound asset and mutable processing attempts from
immutable ordered revision references. Use database relationships to enforce that
each reference's asset and revision belong to the same listing and owner. Server
commands must enforce those relationships too. Do not trust a submitted owner,
object key, processing state, derivative URL or approval flag. No cross-owner or
cross-listing reuse/deduplication is allowed, even for identical bytes.

Upload admission, attach/remove/order and draft saves use the existing account,
exact-session and owner-listing lock order and applicable edit restrictions.
Attach/remove/order append a revision and advance the pointer atomically using an
expected version and request UUID. Every later ordinary draft save carries the
current ordered references into its new snapshot. Existing photo-free revisions
stay photo-free. Review of revision N resolves N's references in N's order;
processing completion never changes that set or order. Historical status may
reflect current asset availability, with fixed attempt/approval provenance.

Removing a current reference excludes it from the new revision. It does not delete
or reorder old reference rows. A derivative required by an earlier revision remains
available only through the owner's authorized historical review until that draft's
retention cutoff or an applicable scoped deletion. Explain this before removal.
Keep immutable reference/attempt history separate from blob availability: deleted
bytes produce an unavailable placeholder, never a different photo or an original.

Ordinary cleanup for this synthetic-only capability:

- Delete originals after a committed approved derivative, or immediately after a
  permanent rejection. Preserve only minimized hash/type/size and attempt provenance
  until the draft cutoff. Do not preserve filenames or copied embedded metadata.
- Pending/transiently failed originals expire 24 elapsed hours after admission.
  Expiry is never reset by retries or worker recovery; processing checks that cutoff.
  After expiry, require a new upload rather than reviving deleted bytes.
- Draft content, revisions, photo references, derivatives, processing/audit metadata
  and retry records expire together after 30 elapsed days without a successful
  owner content/photo mutation. Reads, retries of committed commands and worker
  activity do not extend this clock. This would introduce a draft-expiry policy,
  including text-only drafts. The owner explicitly accepted it; the interface
  must explain it before owners save or upload.
- Eligible explicit draft/account deletion removes this synthetic draft content
  sooner. Recheck unresolved workflows and documented scoped exceptions first;
  this policy does not bypass PROJECT.md section 28.3. It does not create a
  general deletion UI or authorize rewriting retained transaction/case records.
- Cancel unattached upload intents explicitly and delete their objects; abandoned
  uploads share the original 24-hour admission cutoff. Track interrupted writes and
  orphan objects against server-owned intents, with that same cutoff, so a crash
  cannot leave bytes outside cleanup. Delete unused attempt output on recovery.

Use guarded relational deletion intents and restart-safe idempotent blob deletion,
then record completion. Recheck all revision references, current state and scoped
exceptions before erasure. A worker with an expired lease must not recreate bytes
or change a deleted asset back to approved. Preserve a truthful minimized deletion
outcome only until its approved cutoff; history is not indefinite retention.

Run cleanup explicitly with the local run-once worker. Expired data is
unavailable on reads even if physical erasure awaits the next invocation. A manual
worker cannot promise a bounded physical-erasure latency during downtime; synthetic
operators must invoke cleanup and verify it before abandoning an environment.
This selects no hosted schedule. Provider/backup purge and operational guarantees
remain launch gates. A future publication/case workflow needs its own retention
classification before it can adopt these assets; it must not extend draft retention
silently. Discard all disposable test blobs and schemas in test `finally` cleanup.

### C. Durable processing, recovery and owner interaction

Version the processing policy as `synthetic-laptop-photo-v1`. Admission
records an upload intent before writing bytes; finalization atomically records the
asset, initial revision reference, outbox event and processing job. Blob writes
cannot join a PostgreSQL transaction; intent reconciliation handles rollback and
crash orphans. No media bytes, filenames, metadata or private object keys belong
in generic job payloads, logs, analytics or client errors. Jobs refer to internal
asset/attempt identifiers and load restricted processing data through guarded paths.

Use one logical job per asset with recorded execution attempts, a two-minute lease, renewal every 30 seconds,
at most five executions with 30/60/120/240-second backoff, and a 30-second processing
execution timeout. These are accepted media-policy parameters, not reuse of an
accepted email policy. An explicitly invoked local worker handles at most one
processing job after recovery/cleanup; no polling, daemon or hosted schedule.
Fenced commits recheck owner/deletion, draft state, original expiry and current
attempt. Stale leases cannot approve or overwrite a later attempt/removal/deletion.

Separate pending, processing, approved, failed, rejected and quarantined outcomes.
Only a fully validated safe derivative with committed approval provenance is
technically usable. Failed, rejected, quarantined, pending, missing or deleted
derivatives never count as evidence. Publication remains unimplemented and
synthetic fixtures never meet the actual-item requirement.

Malformed/unsupported/unsafe files are permanent rejections. Scanner unavailability,
transient I/O and worker interruption are retryable within the original cutoff;
exhaustion is failed work. Restricted operator controlled retries require purpose,
audit and a new attempt, preserving old failure history under ADR-073. The owner's
Retry control may recover an uncertain upload/finalization with its original UUID,
or re-upload after a terminal failure; it must not bypass the operator-only failed-job
retry rule. Changed bytes/input under an existing UUID conflict. Duplicate worker
delivery must not duplicate assets, revisions, jobs or approvals. Retries check
current authorization/restrictions before recognizing prior committed results.

Owner paths are upload admission/finalization, current-photo list, guarded
remove/order and an authorized derivative response beneath `/api/laptop-drafts/{id}`.
Exact endpoint names are implementation details after acceptance. Every read checks
the stored session, owner, draft/no-publication state, selected revision membership,
asset status and retention cutoff. Responses use the existing no-store, Cookie Vary,
no-referrer, noindex and nosniff contract. Derivatives use a fixed server content type;
no original-byte endpoint, public route, permanent object URL or image optimizer
cache is added. Draft shells/metadata, minimal list, search, other owners,
notifications and analytics gain no image content or private media metadata.

Use existing editor styling and native labeled file inputs/buttons; no drag-only
ordering. Expose upload-byte progress and processing as distinct announced states.
Provide labeled Move earlier/Move later, Remove, Retry upload and refresh-status
controls with disabled-boundary explanations, linked errors and visible focus.
On removal focus the next surviving control or upload input; preserve focused asset
identity on reorder and announce its position. Preserve unsaved text when a photo
command conflicts; require explicit reload/reconciliation rather than losing edits.
Uncertain writes freeze exact request/bytes/order for retry. Show failure/rejection
with text, image alternatives, synthetic labels and historical-retention explanation.
Do not store private bytes in browser persistence or display originals via object URLs.

## Required verification

Extend existing suites and their disposable synthetic PostgreSQL/browser seam.
Inspect script definitions first; add no substitute unbounded smoke test.

| Acceptance area | Required evidence |
| --- | --- |
| Owner authorization | Owner succeeds; other-owner read/upload/attach/remove/order fails without disclosure or writes; same-owner different-listing attachment also fails. Revoked/expired/replaced sessions, deletion and edit restrictions are rechecked after lock waits and before retries. |
| Validation | Generated JPEG/PNG pass; MIME/signature mismatch, truncation, SVG/script, animation, executable/archive, zero-byte, oversize and pixel-bomb fixtures fail; byte/count/quota admission remains bounded under concurrency. |
| Safe derivatives | Fictional EXIF/GPS/XMP/IPTC/comments/thumbnail sentinels disappear from output; decode succeeds with correct orientation; original endpoints/keys/filenames/bytes are absent from owner/public/metadata/cache/log paths. |
| Failure/retry | Scanner/codec/I/O failure and crash injection never approve media. Duplicate HTTP finalization, reordered response delivery, stale leases, exhausted retries, expired originals and controlled new attempts preserve one logical result and failure history. |
| Revision history | Upload, later text save, reorder and remove append exact references; prior revisions remain unchanged. Cross-owner/listing links fail at server and database. Missing/deleted historical derivatives never fall back to originals. |
| Cleanup | Original purge after approval/rejection; interrupted upload/output cleanup; original/draft cutoff boundaries; retries/reads never restart clocks; shared historical references, scoped holds, lease races, deletion failure and resume remain safe. All fixtures are removed. |
| Accessibility | Mounted upload/progress/failure/retry/removal/order work by keyboard with visible focus, announced status, useful alternative text and no lost edits. Check narrow/zoomed reflow and manually review screen-reader behavior. |

The pre-approval baseline established only existing draft/practice behavior.
Post-implementation verification covers the photo behavior and limits recorded in
the linked local testing guide. It does not establish real-scanner or launch readiness.

## Implementation and remaining gates

The owner-authorized implementation adds private photo admission/binary upload,
ordered revision references, derivative reads, removal, a local run-once durable
worker, cleanup and keyboard controls. Legacy `ListingMedia` rows are preserved,
not reinterpreted. A new migration enforces owner/listing/revision membership and
reference/attempt/event history. The worker handles only synthetic draft work.

Local sharp is directly pinned at the already installed 0.35.5. Real ClamAV is
not installed/configured by this change; an explicit executable/version and working
signatures are required for runtime approval. Missing scanning fails closed.
Positive tests inject a scanner only through the internal test constructor, never
an environment or HTTP bypass. Actual-item evidence/publication, staff authorization,
controlled retry and hold-review interfaces, general deletion, hosted scheduling,
NTFS access review, provider/backup purge and ADR-081 readiness remain gates.
Existing unimplemented deletion commands must adopt this policy when added; no
unsupported active workflow is erased. Overdue holds require authorized review,
not automatic release. See [local testing](../DRAFT_PHOTO_LOCAL_TESTING.md).
