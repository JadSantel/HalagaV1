# ADR-091: Set MVP Service and Browser Targets

- Status: Accepted
- Date: 2026-10-21

## Context

Architecture §8.2 deferred service availability, performance, browser support, PWA position, and capacity targets. These targets guide later provider evaluation and verification; they do not make an unqualified free tier launch-ready.

## Decisions

- Target 99.5% monthly service availability. Count all service downtime in the reported measure; do not exclude planned maintenance from the headline result.
- Target p95 page route render time below 2 seconds and p95 server-side response time below 500 milliseconds for synchronous API endpoints. Establish repeatable test conditions and exclude durable background-job completion from the synchronous API measure.
- Support the latest stable and previous major releases of Chrome, Edge, Firefox, and Safari on desktop and mobile where each browser is available.
- The MVP is responsive web only and has no PWA/installability commitment.
- Use quota-based capacity: observe database, object storage, bandwidth, compute, job, and provider quotas; set alerts and safe admission/degradation behavior before real data. No fixed user-count or storage-volume commitment is made before workload measurement.
- Deployment-specific polling intervals, alert thresholds, and worker operations remain deferred. Until separately decided and deployed, worker and hosted operations stay local/manual; no public participant data is accepted.

## Consequences

- Provider selection must be evaluated against these targets and ADR-081's privacy, backup/restore, retention/deletion, recovery, quota, and cost gates.
- Performance and browser targets require repeatable synthetic measurement and human accessibility review before pilot readiness.
- Meeting a target in a local environment does not establish production availability or recovery readiness.

## Source

- Owner decisions provided 2026-10-21
- PROJECT.md §33; architecture.md §§8.2-9
- ADR-071, ADR-081, ADR-082
