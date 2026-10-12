# ADR-073: Use PostgreSQL-Backed Durable Jobs for the MVP

- Status: Accepted
- Date: 2026-10-12

## Context

Halaga needs durable deadline processing, email and in-app notification delivery, media/evidence processing, search and analytics projection, and retention work. These operations must survive web-request completion, worker crashes, retries, and free-tier interruptions.

ADR-069 already requires an atomic outbox/equivalent between authoritative transactions and asynchronous work. ADR-071 requires a free-first approach. Introducing a separate message broker or hosted queue now would add another vendor, availability dependency, and potential cost before the pilot has demonstrated need.

## Decision

- Use PostgreSQL as the initial persistence layer for the transactional outbox and durable-job records.
- The transaction that changes domain state atomically records any required outbox event and durable job.
- The proposed Node.js worker claims eligible jobs through a concurrency-safe, expiring lease.
- A worker verifies its claim and invokes idempotent guarded application commands; it must not force a transition over newer authoritative state.
- A job whose worker crashes or fails to renew its lease becomes reclaimable after lease expiry.
- Retryable transient failures use bounded exponential backoff.
- Permanent failures and jobs that exhaust their configured retry allowance enter a role-restricted failed-job queue with diagnostic context.
- An authorized operator may initiate a controlled retry. That action is audited and creates a new attempt; it does not erase failure history.
- Deadline jobs preserve their original due instant. Late execution evaluates current state against the original policy deadline rather than shifting the deadline forward.
- Use deduplication keys and processed-work records where duplicate scheduling or consumption could otherwise duplicate a logical effect.
- Do not introduce an external broker or queue for the MVP unless a later ADR documents measured capacity, availability, operational, or feature need.

## Consequences

- The system can preserve domain-event handoff and job scheduling without a paid queue vendor.
- PostgreSQL load, job-table growth, indexing, cleanup, lease expiry, and worker concurrency become operational concerns that must be monitored.
- Every job class needs a versioned retry policy, idempotency boundary, failure classification, and ownership.
- The worker may process a job more than once after a crash/reclaim; correctness must come from idempotent handlers and guarded domain transitions.
- Failed jobs become visible operational work rather than silent data loss.
- Background work may be delayed during provider suspension or worker outage, but delayed work cannot redefine business deadlines or completion semantics.
- The final separate Node.js worker decision still depends on implementation ADRs for worker deployment, polling/scheduling, lease duration, heartbeat, retry allowances, alert thresholds, and recovery operations.

## Source

- ADR-069, ADR-070, ADR-071, and ADR-072
- `PROJECT.md` sections 20, 25, 27, 28, 30, and 33
- Architecture interview decision made on 2026-10-12
