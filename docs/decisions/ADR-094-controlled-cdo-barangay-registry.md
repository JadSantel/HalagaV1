# ADR-094: Controlled CDO Barangay Registry for Private Laptop Drafts

- Status: Proposed; owner review required before dependent implementation
- Date: 2026-10-21 PHT
- Would supplement: ADR-013, ADR-035 and ADR-084
- Scope: local/private synthetic owner-private laptop drafts only

## Why a decision is needed

ADR-035 requires controlled barangay data but explicitly leaves geography
maintenance undecided. PROJECT.md sections 11.4/13 and architecture.md section 4.1
retain that gate. ADR-084's later availability supplement does not resolve it.
Repository inspection found no accepted registry source, version or maintenance
policy. The owner explicitly requested a reviewable proposal and a pause if these
decisions were unresolved. This proposal does not accept them or change policy.

The working tree was clean before this task. Current implementation has a nullable
`ListingRevision.barangayCode`, always written as null by private draft commands.
The strict draft validator rejects geography, including fictional practice values.
The separate memory-only practice form uses `sample-a`, `sample-b` and `sample-c`;
these must never become supported listing identifiers.

## Official source evidence

Checked on 2026-10-21 PHT:

- The [Philippine Statistics Authority PSGC publication page](https://psa.gov.ph/classification/psgc)
  advertises the 30 September 2026 masterlist, released on 12 October 2026.
  It links the [publication datafile](https://psa.gov.ph/system/files/scd/PSGC-3Q-2026-Publication-Datafile.xlsx)
  and [summary of changes](https://psa.gov.ph/system/files/scd/PSGC-3Q-2026-Summary-of-Changes_0.xlsx).
- The [official CDO barangay directory](https://psa.gov.ph/classification/psgc/barangays/1030500000)
  identifies the city with ten-digit PSGC `1030500000`, alongside the separate
  correspondence code `104305000`. It lists 80 barangays with an explicit
  31 July 2025 reference date. That page is not evidence of a verified 2026 extract.
- The browser research tool could not parse the linked XLSX files. Their rows,
  hierarchy, reuse terms and checksums have not been verified or imported.
  No runtime registry or authoritative-looking substitute list was created.

## Proposed decisions for review

All choices below are recommendations, not accepted behavior.

### Source, identifiers and version

Use PSA's dated PSGC publication as the authority for names, codes and city
membership. Initially target the 30 September 2026 release, subject to artifact
verification. Import every barangay explicitly belonging to CDO in that release;
do not infer membership from a numeric prefix, numbered name or generated range.
Do not use crowdsourced directories, third-party PSGC APIs or fictional substitutes.

Use exact ten-digit PSGC strings as identifiers. Reject names, aliases, numeric
JSON values, nine-digit correspondence codes and codes absent from the approved
CDO extract. A syntactically valid code alone is insufficient.

Check in a small, immutable reference-data extract and provenance manifest. The
manifest must record publisher, exact source URLs/filename, publication/reference
date, retrieval date, source SHA-256, extraction method, city code, row count,
reviewer, attribution/reuse terms and extract SHA-256. Pin an application registry
version such as `psa-psgc-2026-09-30-cdo-v1`; correcting an extract creates a new
version. Never silently change the bytes behind an existing version. Verify reuse
terms before redistributing the extract; do not invent a license or checksum.
No network lookup is required during a draft read or write.

### Maintenance ownership and registry updates

The project owner would own registry review until explicitly delegating it to a
named maintainer. Review each new PSA release and reported correction manually,
and verify the pinned release before enabling the slice. Record each review,
including releases with no CDO change. No worker, polling interval or paid service
is selected.

A registry update requires a reviewed change containing official provenance,
added/renamed/retired code differences, history/retry verification and an explicit
active-version switch. Keep prior immutable extracts available for existing
references. Never rewrite listing history or automatically translate a split,
merge or retired code into a different barangay. If source integrity or city
membership cannot be established, do not activate the new extract. Historical
reference data contains no participants; retaining it does not extend the
retention of linked listing or account records under PROJECT.md section 28.

### Draft contract, history and retries

Proposed replacement input adds `barangayCode` and `barangayRegistryVersion`.
Both omitted or both empty mean unselected and persist as null, including on an
incomplete save. A selected code requires the active registry version and exact
membership. Mixed pairs, unsupported versions/codes and all practice choices are
invalid. Client-supplied labels, exact addresses, private points and coordinates
remain outside the strict input contract.

Persist the code, server-resolved official name and registry version together on
each immutable listing revision; an unselected revision has all three null. Use an
additive migration with an all-null-or-complete storage check; existing null
revisions remain null. Do not backfill synthetic locations or modify prior
migrations. Historical reads use the stored name/version and the archived registry,
independently of today's selectable codes. They must not run current-membership
validation against old revisions or relabel history through the current registry.

An owner can resume a historical selection even after retirement. Show its saved
name and version, with a clear requirement to choose a current entry or clear it
before a new save. A renamed code has its current name on a newly selected save;
old revisions keep the old name. Preserve edits on registry-validation errors;
do not silently clear, replace or upgrade a selection. Use a labeled optional
native select with an unselected option, linked field errors and announced status.
The current workspace's amount-specific handling of every 400 response must be
updated so a stale registry never appears to be a price error.

Preserve request UUIDs and expected-revision guards. After current authorization,
session, restriction and target checks, recognize a previously committed request
using its original code/version and normalized snapshot before applying the
active-registry rule to a new command. An exact successful retry must return its
original result after a registry switch, retirement or later edit. Changed input
under the same UUID remains a conflict. Reject a genuinely new command using an
inactive registry version, preserving its edits for explicit reselection. Do not
recompute server-owned historical names from the active registry during comparison.

### Flows, states, readers and privacy

Affected paths are POST/GET `/api/laptop-drafts`, GET/PUT
`/api/laptop-drafts/{id}`, and the `/drafts/{id}` editor. Writes remain atomic
owner-private `DRAFT` saves; diagnostic and availability behavior is unchanged.
Use the existing identity/domain, exact-session and owner-listing locks, restriction
checks, stale-version checks and rollback behavior.

Only the explicit authorized owner-detail projection gains selection metadata.
The minimal owner list, static page metadata and content-free HTML shell do not
gain it. Reference names/codes are public facts; their association with a draft
remains account-private. No public listing reader, search index, staff grant,
analytics payload, notification, cache disclosure or browser persistence is added.
The practice exercise remains separate. All participants and listing content stay
synthetic; authoritative geographic reference names/codes are not fictionalized.
Collect no exact address or private geographic point. Select no map provider,
geocoding, boundaries, map tiles or representative-point dataset. ADR-035's eventual
public map requirement and all publication/real-data gates remain outstanding.

## Verification required after acceptance

Use the existing `test:laptop-drafts` suite and disposable synthetic PostgreSQL
helper, then the existing `test:sign-in-app` route/browser seam where available.
Extend their current coverage rather than introducing a new harness:

| Case | Required evidence |
| --- | --- |
| Supported selection | Official extract membership; create/save/read/resume restores code, name and version. |
| Unsupported input | Reject nonexistent, out-of-city, correspondence/numeric codes, practice values, mixed pairs, client labels and exact-location fields without writes. |
| Incomplete replacement | Empty draft, omitted pair and cleared pair save nulls; no invented geography or derived condition. |
| Immutable history | New selection and clearing append revisions; prior names/codes/versions and null revisions remain unchanged. |
| Registry update | Rename/retirement remain readable; stale new commands fail; explicit current selection succeeds; no automatic remapping. |
| Retry/concurrency | Exact retry survives a registry switch and later edits; changed-body UUID reuse and stale revisions conflict; write/commit failure rolls back and can retry. |
| Authorization/privacy | Other-owner, missing/revoked/expired session, deleted mapping, live restriction/suspension, non-draft and prior-publication gates remain; list/metadata/public responses omit draft geography. |
| Interface | Keyboard, optional selection, linked errors/status, stale-version edit preservation, response-loss retry and narrow/zoomed resume. |

Inspect script definitions before running them. Record commands, failures, skips
and database cleanup accurately. The baseline suite can establish current draft
behavior; it cannot prove an unimplemented registry feature passes.

### Baseline verification record (2026-10-21 PHT)

- `npm.cmd run test:laptop-drafts` from `app`: 18 passed, none failed or skipped.
  A private Node launcher loaded existing local configuration and supplied only the
  dedicated loopback `halaga_signup_test` URL. The existing helper replayed checked-in
  migrations in a disposable schema and completed its cleanup. Fixtures were synthetic.
- Coverage includes rejected geography/practice and exact-location input,
  incomplete saves, immutable revision history, owner/session/deletion/restriction
  guards, stale revisions, concurrent retries and write/commit rollback/retry.
- Node emitted its existing non-fatal `MODULE_TYPELESS_PACKAGE_JSON` warning.
- `git diff --check`: passed; Git reported LF/CRLF conversion warnings for the index.
- Supported-registry round trips, registry-update/history/retry cases and the new
  selection interface were not run: their implementation is paused. No browser,
  build or lint check was run for this documentation-only change. Application code,
  registry data, dependencies and persistent database migrations are unchanged.

## Acceptance gate and follow-through

Owner review must accept or revise the proposed PSA release/source, ten-digit
identifiers, version/provenance contract, maintenance ownership, historical-value
handling and retry policy. Artifact verification remains required even if the
proposal is accepted. Until then, dependent registry import, migration, validator,
repository, API and UI work stays paused.

After acceptance, update this ADR's status and synchronize PROJECT.md sections
11.4/13, architecture.md sections 4.1/8, the glossary, draft local-testing guidance
and implementation trackers with the accepted and actually implemented boundary.
Do not present this proposal as an implemented selection flow or as pilot readiness.
