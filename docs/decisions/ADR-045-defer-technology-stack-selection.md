# ADR-045: Keep the Product Source of Truth Technology-Neutral

- Status: Accepted
- Date: 2026-10-06

## Context

The repository currently contains product documentation but no established application architecture or implementation whose constraints would justify locking a framework, database, hosting provider, authentication vendor, email provider, or map provider.

Premature vendor choices in `PROJECT.md` could be mistaken for validated product requirements and constrain later architecture evaluation.

## Decision

`PROJECT.md` will not prescribe a language, framework, database product, cloud or hosting provider, authentication service, email provider, or map provider.

Technology choices will be made through later architecture decisions. Those decisions must satisfy the agreed product capabilities, privacy boundaries, state transitions, audit requirements, scheduling, messaging, media, notification, moderation, and pilot analytics requirements.

## Consequences

- `PROJECT.md` may state required technical properties but not unselected vendors or frameworks.
- Architecture choices that materially change product behavior, operational responsibility, data location, security, or cost require ADRs.
- AI coding agents must not invent a stack merely because `PROJECT.md` is technology-neutral; they must inspect later architecture records or request a decision.
- The eventual architecture must support transactional state changes, private messaging, immutable or auditable histories, scheduled deadlines, image storage and processing, email delivery, role-based staff access, sensitive evidence, and metrics.
- Non-functional targets such as availability, retention, performance, accessibility, and budget remain to be defined separately.

## Source

- Current repository state as of 2026-10-06
- Project interview decision made on 2026-10-06
