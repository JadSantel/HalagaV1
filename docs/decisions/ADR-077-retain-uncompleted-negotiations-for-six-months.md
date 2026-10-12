# ADR-077: Retain Uncompleted Negotiations for Six Months

- Status: Accepted
- Date: 2026-10-12

## Context

Inquiries and negotiations may contain private messages, offer amounts, intended-use information, and other participant data even when no reservation results. Keeping this content indefinitely increases privacy risk; deleting it immediately would prevent participants from resuming a temporarily paused negotiation and would impair short-term support and abuse review.

## Decision

- For an inquiry/negotiation that closes without producing a reservation, retain its private message and proposal content for six months from its final closure timestamp.
- If the negotiation is reopened or reactivated before deletion, a later final closure starts a new six-month period.
- At expiry, delete or irreversibly anonymize private message/proposal content and associated personal data unless a separately documented, case-specific retention exception applies.
- Retain only the minimal non-content audit/event metadata required to explain the workflow and its state changes, under its own retention classification; do not preserve message bodies or offer amounts merely as audit metadata.
- If content is relevant to an active report or case, handle it under the case's separate access and retention rules. This decision does not shorten case-evidence retention or the 24-month closed-transaction rule.

## Consequences

- The retention worker must identify the final closure time and process eligible negotiation content idempotently.
- Reopening a negotiation must update its retention eligibility without erasing prior closure history.
- Backup purge timing and the duration/authority for documented exceptions remain separate deferred decisions.

## Source

- `PROJECT.md` section 28
- Architecture interview decision made on 2026-10-12
