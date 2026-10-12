# HalagaV1 agent instructions

## Sources and authority

- Agents must treat [PROJECT.md](PROJECT.md) as authoritative for MVP scope, product behavior, domain rules, privacy, safety, and acceptance criteria. Current accepted [ADRs](docs/decisions/README.md) are binding; read relevant later decisions before treating older unresolved statements as current.
- Agents must use [architecture.md](architecture.md) for flows, system boundaries, accepted technical decisions, concurrency, jobs, and notifications. Its draft status does not make accepted ADRs optional; proposals and open implementation choices remain unresolved.
- Agents must use [design.md](design.md) for screen, interaction, visual, and accessibility guidance. Proposed tokens, layouts, and visual choices must remain labeled proposals unless accepted; design guidance must not override product rules.
- [product.md](product.md) is discovery background, not authority for superseded MVP behavior. Agents must use the [glossary](docs/domain/GLOSSARY.md) for domain terminology.
- When sources conflict, agents must identify the conflicting passages and apply documented precedence or supersession explicitly. When authoritative sources still conflict, agents must explain the decision needed, pause dependent work, and continue independent work. Agents must not silently choose a rule or mark a proposal accepted.

## Approach each task

- Before editing, agents must inspect relevant source sections, ADRs, repository instructions, existing code, configuration, and working changes. They must identify affected user/operator flows, states, data readers, and privacy boundaries.
- Agents must make the smallest coherent change that completes the authorized task, follow existing conventions, and preserve unrelated work. When a convention is absent, they must say so rather than claim one exists.
- When an accepted decision changes product behavior, domain semantics, architecture, operations, privacy, retention, or safety, agents must add or update the relevant ADR and synchronize affected documentation, including PROJECT.md and the glossary where applicable. They must not rewrite policy merely to justify implementation shortcuts.

## Privacy and workflow invariants

- Agents must enforce authorization and validation on the server. Every read path must select an explicit projection for the public, account-private, negotiation-private, reserved-transaction-private, restricted-evidence, or staff/audit scope defined in [architecture.md §3](architecture.md#3-actors-and-information-scopes). UI hiding and `noindex` must not serve as access controls.
- Agents must prevent private data and competing-buyer activity from leaking through public responses, previews, metadata, search, images, analytics, caches, unrelated-user responses, unsafe logs, or notifications. They must apply the recipient/channel rules in [architecture.md §6](architecture.md#6-flow-level-notification-contract), with role-restricted, purpose-limited, audited staff access.
- Agents must preserve required immutable or auditable listing revisions, proposals, appointments, confirmations, and operator actions. Corrections must preserve history under the applicable retention/deletion rules in [PROJECT.md §28](PROJECT.md#28-data-protection-and-retention); history requirements must not become indefinite retention.
- State changes must use guarded server commands checking actor, eligibility, current state, revision, deadline, and authorization as applicable, with transactional concurrency control and retry idempotency. Agents must preserve the [critical invariants](PROJECT.md#291-critical-invariants), including one active reservation, explicit buyer reconfirmation, and bilateral matching completion; distinct outcomes must not collapse into a generic status.
- Durable jobs must follow [architecture.md §5](architecture.md#5-cross-flow-state-and-race-requirements): atomic domain/outbox/job writes, idempotent execution, expiring leases and recovery, bounded retries, restricted failed-job handling, and controlled retry. Late execution must retain the original deadline and recheck current state. Duplicate delivery must not duplicate logical notifications; email failure must not undo a committed action. Agents must use the documented PHT and business-day rules without inventing schedules or worker parameters.

## Interface implementation

- Agents must follow [design.md](design.md) for responsive screens, reusable components, privacy-aware states, and content. They must preserve WCAG 2.2 AA requirements, including keyboard/focus behavior, accessible errors/status feedback, contrast, zoom/reflow, and non-color cues.
- Agents must preserve authoritative English and required paired Cebuano/Bisaya content under [PROJECT.md §26](PROJECT.md#26-language-and-accessibility). Diagnostic wording must follow the accepted [laptop prototype](docs/design/LAPTOP_DIAGNOSTICS.md) where applicable; other categories' deferred diagnostics must not be invented.

## Code quality and verification

- At creation of this guide, the Git repository contains planning documents and .gitignore, but no application code, package manifest, runnable project scripts, or established code/test conventions. Agents must inspect the current tree again before assuming this remains true.
- Agents must follow conventions and tooling actually present. They must run only scripts that exist, inspect their definitions first, and must not assume build, lint, test, migration, or development commands from the selected stack alone.
- Agents must verify changes with available checks appropriate to affected flows, especially privacy, state transitions, retries, and accessibility. When tooling or an environment is unavailable, they must report the limitation. They must report commands run and outcomes accurately and must not claim unrun checks passed.

## Scope and unresolved decisions

- Agents must stay within [MVP scope](PROJECT.md#5-mvp-non-goals). They must consult [deferred product decisions](PROJECT.md#34-deferred-decisions), [architecture open decisions](architecture.md#82-open-decisions-before-implementation-or-public-pilot), and [open design decisions](design.md#9-open-design-decisions) before relying on an undecided behavior, provider, or implementation detail.
- When a task depends on an unresolved decision, agents must explain the blocker and continue independent work. They must not add defaults, features, dependencies, or infrastructure that silently settle it.
- Agents must honor [free-first and launch gates](PROJECT.md#331-free-first-operating-constraint): synthetic data in local/private early validation; no real participant data before required readiness checks; no paid service or billing path without explicit owner approval.

## Completion report

- Agents must summarize changed files and resulting behavior, verification commands/results (including failures or skipped checks), and remaining decisions or limitations. They must distinguish completed work from proposals and blocked work.
