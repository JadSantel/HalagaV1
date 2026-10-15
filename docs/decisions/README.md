# Architecture and Product Decision Records

The files in this directory preserve decisions in chronological order.

`PROJECT.md` is the current authoritative product and domain specification. Earlier ADRs may contain an `unresolved` consequence that was answered by a later ADR. Read the later decision and `PROJECT.md` before treating an older open item as current uncertainty.

Use the ADRs to understand why a rule exists and what tradeoffs were accepted. Add or update an ADR when a decision changes product behavior, domain semantics, operational responsibility, privacy, retention, or safety controls.

Do not silently resolve items listed in `PROJECT.md` under **Deferred Decisions**.

ADR-088 accepts the account-email transport, templates/link contract, bounded
dispatch/recovery and cleanup choices at the owner's explicit request. The internal
dispatcher is implemented but routes and worker deployment remain gated. See
`docs/ACCOUNT_EMAIL_DELIVERY_LOCAL_TESTING.md`.

ADR-086 records MVP session, freshness, cookie, and numerical authentication rate-limit policies. ADR-087 defines signup/attestation, verification, reset, email-change, generic response, and session-revocation behavior. ADR-088 accepts private token transport, account email content/link rules, dispatch/recovery and delivery cleanup. Account routes remain unmounted pending link-page handling, remaining flow protection, cookie responses and sign-in race integration. Hosting/proxy trust, worker deployment, provider setup, restrictions, and full marketplace authorization remain open.

ADR-087 also records synthetic unmounted authenticated password change: locked
stored-session/mapping/credential checks and atomic credential replacement plus
other-session revocation retain the initiating fresh session. The owner approved
its password-change notice supplement on 2026-10-15 PHT: mandatory account-private
in-app notice for every success and email only to a primary address verified in both
stores at commit, with immutable recipient binding and no later backfill/retargeting.
Required atomic notice writes remain unimplemented. Final templates, recipient/
attempt retention, dispatch/recovery and integration/readiness gates remain before
mounting. See `docs/PASSWORD_CHANGE_NOTICE_DECISION_BRIEF.md` for approval and tradeoffs.

Recent architecture decisions: ADR-076 selects PostgreSQL for MVP marketplace search; ADR-077 sets six-month retention for private content in uncompleted inquiries/negotiations; ADR-078 extends the one-appeal process to listing moderation and verification decisions; ADR-079 restricts retention exceptions and requires periodic review; ADR-080 requires trained operator backup and pauses onboarding/publication when coverage is unavailable; ADR-081 gates real data and public pilot on hosting readiness; ADR-082 sets 24-hour pilot RPO/RTO targets; ADR-083 selects Prisma ORM 7, Zod 4, Tailwind CSS 4, and stable stack release lines, with exact patches pinned at application bootstrap; ADR-084 records centavo precision and the first physical schema review decisions; ADR-085 establishes privacy-safe operational logging; ADR-087 settles account onboarding and credential-flow policies; ADR-088 settles account email delivery and recovery.
