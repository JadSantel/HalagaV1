# ADR-090: Resolve Remaining MVP Product Policy Questions

- Status: Accepted
- Date: 2026-10-21

## Context

The MVP specifications left several product questions open: listing renewals and discovery recency, appointment reminders, unsupported-category requests, later-discovered underage accounts, urgent external escalation, and external device-identifier checks. These decisions are needed before implementing the corresponding behavior.

## Decisions

### Listing renewal and `Newest`

- A listing may be renewed at most twice after its initial publication. Each renewal is explicit seller confirmation that the item remains available and the current facts are accurate.
- No post-expiry renewal grace period applies. Once expired, a listing cannot be renewed; the seller may create a new listing subject to normal eligibility and review.
- A renewal without a material listing change does not change its `Newest` position. A materially changed republication updates the discovery timestamp only after the required review and publication succeed.
- Existing active proposals and reservations continue under ADR-047's draining rules. Renewal does not extend proposal deadlines or erase history.

### Category diagnostics

Keep ADR-018's universal four condition labels. Before a supported category is
included in a pilot, define and validate its category-relevant observable
questions and safe-testing guidance. Shared questions alone cannot support a
category whose essential functions or hazards require additional checks. The
seller-provided answers remain guidance, not professional diagnosis or a
guarantee. The accepted laptop prototype is the only category question set
currently established.

### Appointment reminders

The MVP sends no appointment-specific reminder. Existing appointment proposals, confirmations, expiry, and changes still produce their required transactional notifications. ADR-063 completion reminders remain unchanged.

### Unsupported categories

Unsupported items are rejected. The MVP does not collect category-request waitlist entries or associated contact information.

### Later-discovered underage account

- On a credible report or indication that an account holder may be under 18, restrict new marketplace actions while a trained, authorized operator reviews the claim.
- Request only the minimum private information needed to resolve a disputed date of birth. Do not expose it to other participants or ordinary support tooling.
- Give the account holder notice and a reasonable opportunity to correct an error and appeal the determination. Record the decision and access to any evidence.
- If the person is confirmed under 18, close the account and prevent new marketplace activity. Safely resolve or transfer active workflows under their existing rules; do not silently erase them or expose private data to counterparties. Then apply the ordinary deletion, retention, and documented-exception rules in PROJECT.md §28.
- If the claim is not substantiated, remove the temporary restriction and retain only the minimum audit record required by the applicable retention policy.

### Urgent external escalation

- Staff may contact emergency services or another competent authority only when a specific, credible case indicates imminent risk of serious harm, or when a valid legal obligation requires disclosure.
- A designated authorized lead must approve the escalation when practicable. If delay itself creates imminent danger, the staff member may act and promptly notify the lead.
- Disclose only the minimum necessary information, record the factual basis, recipient, data disclosed, decision-maker, and time, and preserve relevant evidence under a scoped retention exception. Do not promise confidentiality that prevents a required escalation. Seek qualified counsel for non-immediate legal requests and uncertain jurisdictional obligations.
- This procedure does not turn ordinary marketplace disputes, allegations, or policy findings into law-enforcement referrals.

### Device-identifier blocklists

The MVP will not integrate an external IMEI or device-identifier blocklist. Users may report suspected stolen or blocked devices; authorized staff assess reports under existing safety and evidence controls. No product copy may imply an external status check occurred.

### Marketplace restrictions and account suspension

- A scoped restriction blocks only the affected marketplace actions. It must not silently block unrelated account security, privacy, appeal, or deletion actions.
- Account suspension blocks new marketplace activity but does not disable sign-in. The participant may sign in to receive notices, appeal, secure the account, and complete eligible deletion steps.
- Existing active workflows continue under their existing rules and safeguards. Suspension does not silently cancel, erase, or disclose an unresolved workflow.
- The restriction or suspension record must state its scope, reason, start/review time, authorizing actor, and any appeal route. Staff access and changes are audited.

## Consequences

- Renewal count and publication timestamps must be persisted and guarded transactionally; repeated renewal cannot bypass the two-renewal limit.
- Category-specific question sets and safe-testing guidance remain implementation and user-validation deliverables; no unvalidated category may enter a pilot.
- The appointment job system must not schedule appointment reminders.
- Unsupported-category forms must reject without creating a waitlist record.
- Underage review and external escalation require restricted, audited staff access and must follow existing privacy, appeal, active-workflow, and retention rules.
- Restriction guards must check the specific action scope; suspension must not become an authentication lockout.
- No blocklist vendor, paid service, provider, or external data transfer is authorized by this ADR.

## Local synthetic draft enforcement record (2026-10-21 PHT)

The owner-requested bounded implementation enforces this accepted policy on laptop
draft creation and editing. `AccountMarketplaceRestriction` stores one scoped
staff/audit decision with reason, start/review instants, authorizing staff reference,
optional appeal route, and paired revocation time/actor. SQL preserves decision
fields and prevents revocation reversal; corrections append a new decision.
Authorized retention deletion remains possible under PROJECT.md §28. No staff
reader, staff command, role grant, notice delivery or retention schedule is added.
Staff operations, access auditing and retention execution remain gated before real data.

The internal scopes `CREATE_LAPTOP_DRAFT` and `EDIT_LAPTOP_DRAFT` guard their
respective commands. `PUBLISH_LISTING`, `SEND_INQUIRY` and `SUBMIT_PROPOSAL` name
existing separate actions and do not block drafts; their enforcement awaits those
commands. `SUSPENSION` blocks both draft writes as new marketplace activity.
An unrevoked record applies at its start instant; review time is not expiry.
Owner list/detail reads remain available. Sign-in and account-security commands
do not consult these marketplace scopes.

Restriction inserts, revocations and authorized retention deletes lock the same
account row as draft commands. Commands read live decisions after acquiring that
lock, before retry recognition or any write, and recheck time-sensitive guards
before commit. Rejection rolls back draft/revision/answer changes. Draft writes
disable pre-transaction rolling session refresh so rejection also preserves
sessions. HTTP responses expose only fixed `ACTION_RESTRICTED` (403), without
staff records; the editor retains unsaved work and reports the rejection.

Synthetic PostgreSQL checks cover individual/unrelated/combined scopes, suspension,
future starts and explicit revocation, retry denial, preserved reads and state,
observed lock waits, activation during a write, and successful guarded sign-in and
password changes. See [LAPTOP_DRAFT_LOCAL_TESTING.md](../LAPTOP_DRAFT_LOCAL_TESTING.md).
This record implements ADR-090 without changing product policy or launch gates.

## Source

- Owner decisions provided 2026-10-21
- PROJECT.md §§5, 21, 28, 33-34
- ADR-047, ADR-050, ADR-063, ADR-078, ADR-079, ADR-081
