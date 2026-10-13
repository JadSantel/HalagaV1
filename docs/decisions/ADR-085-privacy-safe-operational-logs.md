# ADR-085: Privacy-Safe Operational Logs

- Status: Accepted
- Date: 2026-10-13
- Supplements: ADR-069, ADR-070, ADR-081

## Context

Operational failures need enough context for diagnosis, while request and command paths can handle credentials, private account/listing data, and restricted evidence. The existing project rules prohibit sensitive data in logs without redaction, but the application had no shared operational logging contract.

## Decision

- Application operational logs contain only allowlisted fixed operation names, outcomes, and internal error codes. A request ID is allowed only in validated UUID form.
- Never log complete request bodies, parsed request/command inputs, credentials, session/reset/verification tokens, date of birth, private listing data, restricted evidence, raw validation issues, or exception messages.
- Record validation failures with a stable internal rejection code. Record unexpected exceptions as a generic internal failure; preserve the original exception for control flow, but do not serialize it into logs.
- Do not add a logging service or package for the current application. Use the server runtime's existing output sink through the shared server-only logger.
- Apply these rules to web, command, scheduler, and notification-worker code as those paths are added. Provider and deployment log retention remain subject to launch readiness review.

## Consequences

- Logs retain event outcome and stable failure category while omitting submitted content and raw error details.
- Developers must inspect the underlying failure through a controlled local debugger or a separately authorized diagnostic path; general application logs are not a substitute for restricted, purpose-limited audit records.
- Current request handlers, scheduler, and notification worker are not implemented. Their future logging must use the same allowlist and pass focused sentinel verification.

## Sources

- `PROJECT.md` sections 28 and 33
- `architecture.md` sections 3 and 8
- ADR-069, ADR-070, and ADR-081
