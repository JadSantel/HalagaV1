# Laptop submission: explicit pause and exact-revision recheck

2026-10-22 PHT. Local/private synthetic data only. **Slice 3 remains partial.**

After the prerequisite review, the owner explicitly answered: “Keep dependent
submission behavior gated (Recommended).” This narrows the original implementation
request to independent privacy and fail-closed work. No undocumented declaration,
retention, detector, geography or publication-job policy is accepted by this change.

## Inspection, authority and existing prerequisites

The initial working trees were clean. The requested gym-management-system folder
contains only a README; the laptop application is in the adjacent writable
HalagaV1 repository. Root/app AGENTS.md, PROJECT §§11–15/26–29/33–34, architecture
§§3/4.1/4.9/5/6/8.2, design §§5.3–5.4/7/9, the glossary, current schema, routes,
repositories, tests and installed Next route/client documentation were inspected.
Relevant accepted ADRs include 019/058/080/084/090/092/093/095/096. ADR-094 remains
proposed. ADR-096 supersedes earlier held-review policy gaps, while ADR-090
supersedes historical design open items on restrictions and underage treatment.

| Prerequisite | Verified implementation boundary |
| --- | --- |
| Evidence processing | Private synthetic uploads, safe derivatives, attempts/recovery and bounded cleanup exist (ADR-095). Scanner installation remains an operational gate. Processing never establishes actual-item evidence; synthetic photos cannot qualify. |
| Publication evaluation | Exact-revision accepted-rule evaluator exists. Authorized risk/evidence assessment rules and provenance are absent; no supplied HTTP assessment can bypass this. |
| Atomic audit/outbox/jobs | The coordinator and disposable PostgreSQL adapter verify required-effect rollback and receipt replay. No application submission/publication adapter exists. Account email/photo jobs are not publication-job defaults. |
| Held review | ADR-096 service and protected HTTP adapter exist but remain unmounted. Approval returns unavailable. No submission producer, evidence adoption or complete required-job/retention integration exists. Actual installation/staffing/coverage evidence is still required. |
| Account documents | ADR-092 agreement capture remains conditional on approved final documents. Review drafts are not effective agreement versions. Operator/address, privacy handling and final processing review remain open. |
| Publication readiness | Geography under proposed ADR-094, declaration wording/version/capture/retention, authorized assessments, atomic effects, held intake/operations, paired translations/usability, full accessibility and ADR-081 readiness remain gates. |

## Implemented behavior and privacy

POST `/api/laptop-drafts/{id}/submission-check` accepts only an integer
`expectedRevision`. It is a read-only check, not a submission command. Exact origin
and JSON checks reuse the private draft handler. Stored-session resolution disables
cookie caching and session renewal. Identity/domain, initiating stored session,
then owner-listing locks recheck mapping/deletion, token/session ownership and time,
publication restriction/suspension, draft state, no publication history and draft
retention. The expected revision must still be current. It never silently evaluates
newer content. A final live session/restriction check includes time spent waiting.

Available rules recheck adult evidence, both email-verification stores, saved
fields/diagnostics/safety and exact photo/declaration membership. Missing runtime
assessments remain unavailable. Other action scopes do not block this publication
recheck. The result is always `outcome: PAUSED`, `status: DRAFT`, exact revision,
fixed evaluation guidance and independent gate explanations. Ineligibility and
review-required are evaluation results, never actual rejection or held status.
Current publication restriction returns fixed `ACTION_RESTRICTED`; stale version
returns `STALE_REVISION`; unauthorized and other-owner paths expose no content.

No domain, declaration, review request, receipt, audit/outbox, notification, job or
retention renewal is written. Concurrent/repeated checks cannot create publication
cycles, declarations or notifications. This does not substitute for idempotent
receipts or required transactional effects in a future submission command. Saving
remains a separate immutable-draft operation and never attests ownership. There is
no mounted `/submit` path and no declaration checkbox/version/capture activation.

The owner review remains available after check failures. Pending disables duplicate
checks; result/error text receives keyboard focus and uses live status/alert
semantics. Response loss offers explicit retry of the same saved revision, with no
automatic retry or optimistic success. Stale results retain the reviewed snapshot,
disable recheck and link to the current editor. Sign-in, restriction and unavailable
responses provide distinct safe next steps. Gate explanations use native expandable
details. No browser storage, public link, real participant data or sending is added.

Practice previews and saved-review content share `projectPublicLaptopFacts`.
Top-level public fields and nested diagnostic keys use explicit allowlists; unknown
answer/note properties and media metadata cannot hitchhike into previews. Private
expectation remains only in the separate authorized owner envelope. Recheck output
contains no listing text, expectation, actor/session, source revision UUID, private
findings, media keys or evidence. Existing content-free HTML/metadata shells and
no-store/Cookie Vary/no-referrer/noindex responses remain. This projection does not
sanitize sensitive information typed into public text: assessment/publication gates
still block its exposure. No public listing, media or discovery reader is installed.

## Original acceptance criteria and remaining work

| Criterion | Current status |
| --- | --- |
| Explicit unchecked ownership declaration for exact evaluated revision | Gated. No wording/version is invented or checkbox enabled. A future submission must require new explicit acceptance for its exact revision. |
| Server-owned immutable version, actor and timestamp | Existing storage uniqueness/immutability verified with a synthetic, non-policy fixture. Application capture and declaration retention remain gated. The storage test does not prove producer authorization. |
| Guarded submission rechecks | Implemented for the read-only recheck only. Live account/session/owner/restriction/state/version and available evidence/publication evaluation are verified. Document and operational gates remain closed, rather than manufactured as passes. |
| Publish / held review / deterministic rejection through lifecycle | Gated. Existing pure synthetic evaluator exercises these classifications; no application transition is claimed. |
| Atomic lifecycle/declaration/audit/outbox/required jobs | Gated application integration. Existing coordinator/held-service rollback and replay checks remain foundations. |
| Retry idempotency and stale submissions | Recheck has zero durable effects; concurrent stale recheck cannot overwrite newer work. Existing coordinator fixtures verify receipt replay separately. Full submission idempotency remains to implement. |
| Truthful accessible outcomes with work preserved | Recheck pending/paused/uncertain/stale/denied outcomes implemented and verified. Published/held/rejected lifecycle UI remains gated with its producer. |
| Explicit public projection | Shared allowlist implemented for existing previews; owner expectation remains private. Future published readers must use the same facts projection plus their own state/authorization/evidence guards. |

## Changed files

- `app/src/server/laptop-submission-gates.ts`: fixed, non-overridable prerequisite explanations.
- `app/src/server/repositories/laptop-drafts.ts`: shared live revision evaluator and guarded read-only recheck.
- `app/src/server/repositories/laptop-drafts-http.ts` and `app/src/app/api/laptop-drafts/[listingId]/submission-check/route.ts`: protected POST integration and private responses.
- `app/src/server/repositories/draft-photos-http.ts`: maps the shared stale-revision error type safely.
- `app/src/server/laptop-publication-evaluation.ts`: explicit outcome union for safe interface typing; evaluation rules unchanged.
- `app/src/domain/laptop-listing.ts` and `app/src/server/laptop-draft-review.ts`: shared public facts and nested allowlists.
- `app/src/app/drafts/review.tsx`: paused/recheck interface and accessible recovery.
- `app/tests/laptop-listing.test.mjs`, `laptop-drafts-database.test.mjs`, `foundation-database.test.mjs`, `sign-in-app-database.test.mjs`, and `helpers/laptop-drafts-browser.mjs`: existing-suite privacy, storage, concurrency, route and browser coverage.
- PROJECT, architecture, design, ADR-058 implementation record, decision index and slice tracker: current boundary and remaining gates.

## Verification

Commands run from `app` unless stated. Database suites use only the existing
loopback `halaga_signup_test` harness with disposable synthetic schemas and cleanup;
the URL is derived in memory from local configuration without printing credentials.
No persistent migration, live send, provider change or deployment occurs.

| Existing command | Result |
| --- | --- |
| `npm.cmd run test:laptop-drafts` | 57 passed, none failed/skipped. Includes three new recheck subtests; stored-session/restriction wait races; exact revision/history; current account guards; repeat/concurrent zero effects; safe output; non-draft/publication-history exclusion; existing evidence worker and held-review rollback/replay checks. |
| `npm.cmd run test:foundation` | Final run: 39 passed, none failed/skipped. Includes existing transaction/audit/intent/job/receipt/commit rollback and replay fixtures, plus one new rolled-back declaration storage fixture verifying uniqueness and immutability of revision, actor, wording identifier and timestamp. No wording version was accepted by the fixture. |
| `npm.cmd run test:diagnostics` | 40 passed, none failed/skipped. Accepted laptop condition/safety rules preserved. |
| `npm.cmd run test:listing` | 5 passed, none failed/skipped. Includes unknown nested diagnostic/photo metadata exclusion and independent mutable preview arrays. |
| `npm.cmd run test:sign-in-app` with existing installed Agent Browser opt-in | 19 passed, none failed/skipped, in both the initial and final confirmation runs. Mounted Next POST recheck, empty private metadata shells, disabled `/submit` path, lost-response retry, keyboard/focus, pending/paused/ineligible-evaluation/restricted/auth/unavailable/uncertain/stale handling, preserved review and unchanged workflow counts passed. Final run additionally verifies keyboard expansion/collapse of gate explanations. |
| Browser checks in that harness | 1440/375/320px reflow and 200% text checks passed; automated WCAG 2.2 AA-tagged checks found no violations. Desktop/mobile captures were inspected in one initial pass and one confirmation. Full manual screen-reader/browser-matrix certification was not performed. |
| `npm.cmd exec tsc -- --noEmit` | Passed after correcting the initial status-union typing and adding the shared error's photo-handler mapping. Final build also passes TypeScript. |
| `npm.cmd run lint` | Passed, including the final application changes. |
| `npm.cmd run build` | Passed, including final expandable gate UI. Recheck remains a dynamic protected API route. |
| Existing Impeccable `detect --json app/src/app/drafts/review.tsx` (root) | No findings (`[]`). |
| `git diff --check` (root) and `git -c core.autocrlf=false diff --no-index --check -- NUL <new-file>` | Passed whitespace checks. No-index difference exit 1 with no diagnostics is expected for new files. |

There are 160 passing checks across the five final test-suite results above.
Initial standalone TypeScript checking failed on two widened-status uses and the
photo handler's exhaustive error map; those were corrected. An initial Node test
launcher used PowerShell/native quoting incorrectly and failed with `SyntaxError`
before starting any suite; the corrected launcher ran successfully. Existing Node
module-type, pg concurrent-query and Git LF/CRLF notices were non-fatal.

The foundation declaration test checks existing storage safeguards, not approved
copy, account authorization, application declaration capture or retention. Existing
coordinator/held-review fixtures do not verify a nonexistent application submission
producer. No actual eligible publication, held intake, deterministic rejection
transition, notification delivery, ClamAV installation, human translation review,
full manual accessibility certification or operational readiness is claimed.
Impeccable reported its legacy PRODUCT.md context schema; that unrelated context
migration was left unchanged and can be requested through `init`.
