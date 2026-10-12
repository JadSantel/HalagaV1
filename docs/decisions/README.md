# Architecture and Product Decision Records

The files in this directory preserve decisions in chronological order.

`PROJECT.md` is the current authoritative product and domain specification. Earlier ADRs may contain an `unresolved` consequence that was answered by a later ADR. Read the later decision and `PROJECT.md` before treating an older open item as current uncertainty.

Use the ADRs to understand why a rule exists and what tradeoffs were accepted. Add or update an ADR when a decision changes product behavior, domain semantics, operational responsibility, privacy, retention, or safety controls.

Do not silently resolve items listed in `PROJECT.md` under **Deferred Decisions**.

Recent architecture decisions: ADR-076 selects PostgreSQL for MVP marketplace search; ADR-077 sets six-month retention for private content in uncompleted inquiries/negotiations; ADR-078 extends the one-appeal process to listing moderation and verification decisions; ADR-079 restricts retention exceptions and requires periodic review; ADR-080 requires trained operator backup and pauses onboarding/publication when coverage is unavailable; ADR-081 gates real data and public pilot on hosting readiness; ADR-082 sets 24-hour pilot RPO/RTO targets; ADR-083 selects Prisma ORM 7, Zod 4, Tailwind CSS 4, and stable stack release lines, with exact patches pinned at application bootstrap; ADR-084 records centavo precision and the first physical schema review decisions.
