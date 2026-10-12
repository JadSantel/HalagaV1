# ADR-074: Use Better Auth for Email/Password Authentication

- Status: Accepted
- Date: 2026-10-12

## Context

Halaga needs adult-attested accounts, email verification before marketplace actions, durable sessions, password reset, server-side authorization, and a clear account-deletion boundary. ADR-071 requires a free-first architecture. A hosted authentication SaaS would add a separate vendor, pricing/limit risk, and account-data boundary before the pilot requires its convenience.

The marketplace has a unified user account model: one person may act as buyer and seller, while staff access, verification badges, eligibility, restrictions, and blocks are domain concepts rather than generic identity-provider roles.

## Decision

- Use Better Auth inside the Next.js application for email/password authentication and session management.
- Store Better Auth identity, credential, session, verification-token, and password-reset data in the same PostgreSQL database standard selected in ADR-072.
- Support email/password registration and sign-in only in the MVP. Social login, passkeys, MFA, organizations, and external SSO are out of scope unless accepted later.
- Create a unique stable mapping between a Better Auth user identity and Halaga's domain `user_account`.
- Keep Better Auth identity/session records separate from the domain user-account record.
- Allow an authenticated but unverified user to sign in and browse.
- Enforce the existing email-verification requirement server-side for publishing listings, sending pre-offer inquiries, and submitting proposals.
- Treat marketplace roles, staff permissions, adult eligibility, blocks, restrictions, verification badges, and deletion lifecycle as Halaga domain authorization, not Better Auth roles alone.
- Deliver verification and password-reset email through the durable notification/job path where integration permits; failure to deliver an email must be observable and safely retryable.
- Verify sessions and domain authorization in every protected page, endpoint, server action, and worker command. Client-side route guards are only navigation assistance.
- Configure authentication rate limiting, session lifetime, cookie properties, token expiry, and reset/verification resend policy explicitly before implementation; do not rely on hidden defaults.

## Consequences

- Authentication remains in Halaga's codebase and PostgreSQL boundary, avoiding an authentication SaaS subscription during the free-first phase.
- The implementation must keep authentication secrets, credentials, token material, and session records out of public projections, logs, analytics, and client bundles.
- Better Auth schema migrations must be versioned alongside domain migrations and deployed compatibly with the web and future worker runtimes.
- Email-provider failure can delay verification/reset but must not falsely mark an email verified or block safe resend.
- Account deletion disables login in coordination with Better Auth while preserving only the domain/auth records required by the retention policy.
- Moving to a hosted provider or adding social/MFA/SSO requires a new ADR addressing privacy, migration, cost, and authorization effects.

## Source

- `PROJECT.md` sections 6, 8, 17, 28, and 33
- ADR-071, ADR-072, and ADR-073
- ADR-075
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth email/password and verification](https://better-auth.com/docs/authentication/email-password)
- Architecture interview decision made on 2026-10-12
