# Slice 2 implementation and approval status

- Reviewed: 2026-10-21 PHT
- Scope: local/private synthetic accounts and currently mounted actions
- Status: current account implementation verified; final document approval blocked

## Latest age-data implementation (ADR-093, 2026-10-21 PHT)

The owner confirmed birthdays are for “age check only” and approved checking once
then discarding them. Signup now validates transient DOB in PHT and atomically
stores only `adultEligibilityCheckedAt` with the existing attestation version/time.
The account, email-change command, intent-inspection and dispatcher guards all use
that evidence. Missing/invalid/future evidence denies eligibility. Strict signup
rejects client-supplied result/time fields. The submitted date field clears on
completed responses, including errors and uncertain outcomes.

The forward migration `20261021110000_minimize_age_eligibility` derives supported
legacy synthetic checks only where the original finite DOB, accepted attestation
version/time and original PHT date establish adulthood. It never grants eligibility
just because someone became 18 later. It then drops DOB for every row. Existing
migrations are unchanged. No persistent/shared migration was applied; the reviewed
local workflow is required before manually using the updated app against storage.
This is not evidence of backup/provider erasure or complete retention execution.

ADR-093, PROJECT.md, architecture, design, glossary, schema review, policy-review
documents, signup/integration guides and tracker now reflect the decision. The
rendered Terms/Notice remain drafts and describe both minimization and the actual
contact status. No Terms agreement or new consent has been activated. The earlier
retained-DOB consent/withdrawal proposal is explicitly superseded; processing
grounds for transient age checking and retained evidence remain under review.

Latest verification (from `app`; synthetic dedicated DB/fake delivery only):

| Command | Result |
| --- | --- |
| `npm.cmd run db:generate` | Passed |
| `npm.cmd run test:signup` | 8 passed, including forward-migration PHT/leap-day/missing-version/evidence cases and absent DOB column |
| `npm.cmd run test:auth` | 22 passed, including minimal stored-evidence prerequisites and explicit private projection |
| `npm.cmd run test:verification` / `test:reset` / `test:email-change` | 11 / 12 / 16 passed |
| `npm.cmd run test:password-change` / `test:sign-in` | 35 / 38 passed |
| `npm.cmd run test:account-email-intents` / `test:account-email` | 13 / 27 passed |
| `npm.cmd run test:laptop-drafts` / `test:foundation` / `test:logging` | 17 / 21 / 5 passed |
| `npm.cmd run test:sign-in-app` with installed-browser opt-in | 19 passed, including date-field clearing, document navigation, focus, 1440/375/320px reflow, 200% text and zero automated WCAG-tagged violations |
| `npm.cmd exec tsc -- --noEmit` / `npm.cmd run lint` / `npm.cmd run build` | Passed |
| Impeccable detector over the two changed UI sources | Passed, `[]` |

Total: 244 passing checks, no final failures/skips. Existing module-type warnings
remain non-fatal. Two initial mounted-route launches exited before tests because
an existing dev server held the default output lock. Passing `conf` to Next's
custom server did not isolate its config loader; the existing config now selects
the fixed `.next/account-integration` directory only for the harness's explicit
`HALAGA_ACCOUNT_INTEGRATION_TEST=true` flag. Default app output is unchanged.
The harness uses port 3102; avoid concurrent harnesses or a build cleaning `.next`.
Next's additional TypeScript includes for that directory are retained. The existing
development server was not manually stopped. No real participant data, email,
deployment, new dependency or billing path was used. Human accessibility,
translation, privacy review and all real-data readiness gates remain open.

Desktop/mobile signup and both policy-document screenshots were inspected. A
final browser rerun recaptured them after the production build cleaned the earlier
`.next` images; all 19 checks passed again. The two empty disposable schemas left
by Next's pre-test process exits were identified by the new age-check schema and
zero records, then removed by exact name after locking and verifying every table
was empty. An initial inspection raced normal successful-test cleanup, and the
first removal attempt rejected a camel-case table name; neither attempt deleted
data. The corrected conservative identifier check completed cleanup. The temporary
inspection script was removed. Final `git diff --check` passed with existing
LF/CRLF notices only.

## Acceptance inventory

| Requirement | Implemented behavior / evidence | Status |
| --- | --- | --- |
| Registration and adult eligibility | Strict server validation, transient DOB then discard, stored passed-check time, separate versioned unchecked attestation, PHT age calculation, atomic signup and generic responses (ADR-093). | Implemented and verified locally |
| Sign-in and stored sessions | Transaction-bound credential/session writes, current deletion checks, fixed responses, origin/CSRF/rate protection and session/revocation races. | Implemented and verified locally |
| Email verification | Single-use 24-hour proof, replacement, atomic verification synchronization and session revocation. | Implemented and verified locally |
| Password reset | Single-use one-hour proof, atomic credential replacement and all-session revocation. | Implemented and verified locally |
| Email change | Recent sign-in, old primary preserved until proof, bound single-use proof, atomic switch/revocation and old-address notice. | Implemented and verified locally |
| Password change | Fresh stored initiating session, current password, atomic credential/other-session revocation, exact initiating session preserved, mandatory in-app and eligible email work. | Implemented and verified locally |
| Owner security notices | Minimal owner-only list/read, explicit mark-read, stored authorization and 90-day event window. | Implemented and verified locally |
| Account email work | Atomic encrypted handoff, fake-provider dispatch/recovery, deadline/retry/lease fencing and bounded cleanup; local run-once worker. | Implemented; real sending remains off |
| Action eligibility | Adult/email prerequisite projection and gates; no general marketplace grant. | Implemented prerequisites; each later command must also check actor, target and current state |
| Restrictions and suspension | Live matching create/edit scopes, suspension denial, preserved reads/security, unchanged rejected state and retry/concurrency checks. | Implemented for current laptop draft commands |
| Terms/privacy discoverability | Read-only draft pages linked before registration and from the account footer, with status and missing operator/contact disclosed. | Implemented review surfaces |
| Final terms/privacy and agreement capture | ADR-092 agreement flow/retention accepted; final wording, operator/contact and processing grounds unresolved. | Approval blocked; dependent capture/storage not implemented |

The acceptance boundary has not been narrowed to declare completion. Future
publication/inquiry/proposal commands belong to their marketplace slices and must
enforce their corresponding scope before mounting. Staff enforcement/appeal
tooling, deletion/retention execution, operator coverage, provider/hosting,
backup/restore and ADR-081 real-data readiness remain separate gates. No accepted
ADR, dependency, prototype, or passing test stands in for those capabilities.

## Earlier review-page changes (before ADR-093)

`policy-content.ts` holds the two review drafts; `policy-document.tsx` and the
explicit account `terms`/`privacy` pages render them. Existing registration,
footer and account-index copy link and accurately describe them. Existing CSS
supplies the reading layout, heading spacing, focus and draft notice.

The actual Next test harness now verifies static draft documents without any
session/cookie/account side effect, rejects invented acceptance fields and tests
restriction/suspension denial through mounted draft routes while sign-in remains
available. The existing browser helper exercises both document links, heading
focus, return to registration, responsive layouts, text zoom and accessibility.

No signup field, database table, migration, consent, effective document version,
new auth endpoint, dependency, paid service or deployment was added. ADR-092
records the owner's conditional agreement/retention approval. PROJECT.md,
architecture, glossary, decision index and integration/slice documentation reflect
the accepted policy and the remaining implementation boundary.

## Earlier review-page verification (before ADR-093)

Commands ran from `app`, except the repository diff check. The database launcher
set `SIGNUP_TEST_DATABASE_URL` to the dedicated loopback `/halaga_signup_test`
database without printing credentials. Existing sandbox helpers replay migrations
into disposable schemas and clean up; foundation/auth checks use existing
isolated synthetic fixtures. Email tests inject fake delivery.

| Command | Final result |
| --- | --- |
| `npm.cmd run test:auth` | 21 passed |
| `npm.cmd run test:signup` | 7 passed |
| `npm.cmd run test:verification` | 11 passed |
| `npm.cmd run test:reset` | 12 passed |
| `npm.cmd run test:email-change` | 16 passed |
| `npm.cmd run test:password-change` | 35 passed |
| `npm.cmd run test:sign-in` | 38 passed |
| `npm.cmd run test:account-email-intents` | 13 passed |
| `npm.cmd run test:account-email` | 27 passed |
| `npm.cmd run test:logging` | 5 passed |
| `npm.cmd run test:foundation` | 21 passed |
| `npm.cmd run test:laptop-drafts` | 17 passed |
| `npm.cmd run test:sign-in-app` with the installed-browser opt-in | 19 passed |
| `npm.cmd exec tsc -- --noEmit` | Passed |
| `npm.cmd run lint` | Passed |
| `npm.cmd run build` | Passed; both document pages are static, private APIs remain dynamic |
| `git diff --check` | Passed; existing LF/CRLF conversion notices only |

Total: 242 passing checks, no final failures or skips. The browser run covered
actual signup and credential/draft behavior, document navigation and focus,
1440/375/320px reflow, 200% text at 320px, and the helper's automated WCAG 2.2 AA
tags with no violations. Desktop/mobile document-section screenshots were
inspected. This is not full manual screen-reader or human translation validation.

The first mounted-route run failed an overly strict text assertion because React
inserts HTML comments between text nodes. Normalizing only the heading's comments
corrected the assertion. That run also failed all three browser helpers with
`CDP response channel closed` inside the sandbox. The same synthetic browser
suite passed outside it using the already installed Chrome/agent-browser.

The required Impeccable detector exited 1 for an existing thick left border in
`account.module.css` line 10. That declaration predates this task and was preserved;
the new document notice uses a plain one-pixel border. This is a recorded existing
style warning, not a test or accessibility failure. The context loader also
identified legacy discovery-document metadata; no unrelated document migration
was performed. Existing Node module-type warnings remain non-fatal.

No persistent database migration, deployment, real email/data or paid path was
used. Human accessibility/usability and required paired Cebuano/Bisaya review,
provider/processor disclosures, remaining retention execution, rights operations
and all real-data/public-launch checks remain outstanding.

## Remaining owner/content work

Latest owner input (2026-10-21 PHT): JCA is an informal, unregistered team/brand;
the team jointly decides data uses. A team member will serve as Privacy Lead;
no public individual name is supplied. `support@halaga.ph` is intended for both
support and privacy but is still being set up. No physical mailing address was
supplied. Responsible operator disclosure/address and operational confidential
handling remain open. ADR-093 supersedes the earlier retained-DOB review direction.
Processing grounds, remaining retention execution and final document approval
remain open; these facts do not complete the approval gate.

The rendered drafts now show JCA and the confirmed shared email, omit individual
names and retain explicit unresolved legal-operator/address/privacy-responsibility
labels. Follow-up verification after this copy change: `test:sign-in-app` passed
16 mounted-route checks with the optional browser helpers not enabled; lint,
`tsc --noEmit` and `git diff --check` passed. The first follow-up launcher failed
before tests because PowerShell replaced a Unicode output-filter character;
an ASCII-only filter corrected the launcher and the actual suite then passed.
No signup schema, consent capture or activation change was made.

Use [ACCOUNT_POLICY_REVIEW.md](ACCOUNT_POLICY_REVIEW.md) for the reviewable text,
processing-ground questions and operator/contact inputs. ADR-092 governs future
agreement capture only after final document approval. Keep Slice 2 overall in
progress until that approval dependency and the resulting required capture
implementation/checks are complete; do not label review drafts effective.
