# Slice 2 implementation and approval status

- Reviewed: 2026-10-21 PHT
- Scope: local/private synthetic accounts and currently mounted actions
- Status: current account implementation verified; final document approval blocked

## Acceptance inventory

| Requirement | Implemented behavior / evidence | Status |
| --- | --- | --- |
| Registration and adult eligibility | Strict server validation, private DOB, separate versioned unchecked attestation, PHT age calculation, atomic signup and generic responses. | Implemented and verified locally |
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

## Current changes

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

## Verification

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

Latest owner input (2026-10-21 PHT): team/brand “JCA” supersedes the earlier
“Halaga business team” description. The owner requests no individual names and
confirms `support@halaga.ph` for both support and privacy, without a designated
privacy handler yet. The current private-DOB design remains selected for specific
consent/withdrawal review. Responsible legal identity/address and operational
privacy responsibility remain open. Processing wording/retention and final
document approval remain open; these inputs do not complete the approval gate.

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
