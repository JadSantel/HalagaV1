# ADR-088: Account Email Delivery and Recovery

- Status: Accepted for slice 2 implementation on explicit owner request
- Date: 2026-10-15
- Supplements: ADR-073, ADR-075, ADR-087

## Context

Slice 2 has atomic account intents and single-use tokens, but no durable raw-token
handoff, dispatch, recovery or approved account-message copy. Digest-only tokens
cannot render a recoverable link. The owner requested a safe transport, approved
templates/link behavior, retention and cleanup, dispatch and crash recovery.

## Decision

### Private transport and replacement

- Add one private `account_email_delivery` row per supported account-email outbox
  intent. It contains only authenticated ciphertext for the raw token (empty for
  the link-free email-change notice), key ID, token/notice delivery expiry, and
  durable dispatch state. It contains no plaintext recipient, message body or
  rendered URL. The old-address notice recipient remains in the existing
  purpose-restricted `outbox_event.recipientEmail` snapshot.
- Encrypt tokens with Node AES-256-GCM. Bind ciphertext with associated data to
  outbox ID, account ID, event type/version and logical work key. Production must
  provide `ACCOUNT_EMAIL_KEYRING` as JSON containing one active key and retained
  old keys, each exactly 32 random bytes encoded as base64. Never log the key or
  plaintext. Development without a key uses an explicitly local-only fixed key;
  production fails closed without configured key material. Rotate by adding a new
  active key while retaining old key IDs until their ciphertext expires and has
  been purged; then remove old keys. Provisioning/rotation at a selected host stays
  a launch gate.
- Signup creates its initial 24-hour verification token, digest, ciphertext,
  minimized intent and delivery row atomically. Verification resend, password
  reset and email-change issue/replacement atomically write the same transport.
  Their token lifetimes remain ADR-087's 24 hours, one hour and 24 hours.
- In the same replacement transaction, mark older READY/LEASED work for that token
  family SUPPRESSED and erase its ciphertext. Do not affect other token families.
  A work item already in SENDING may finish after replacement races it; its link is
  invalid because the account command has already replaced the single-use token.
  The dispatcher checks token/account/binding/expiry under the established account
  lock order immediately before changing a job to SENDING. All verification,
  reset and email-change completion commands continue to reject replaced, expired,
  consumed or mismatched tokens.

### Templates and links

English is authoritative; ADR-087 and PROJECT §26.1 do not require paired Cebuano
copy for account emails. Approve exactly these four version-1 messages:

| Intent | Subject | Approved message |
| --- | --- | --- |
| Signup/resend verification | `Verify your Halaga email` | Confirm the address to finish setup. Link expires in 24 hours. If the recipient did not create the account, ignore the message. |
| Password reset | `Reset your Halaga password` | A reset was requested. Link expires in one hour. If unexpected, ignore it; the password has not changed. |
| Email-change proof | `Confirm your Halaga email change` | Confirm the proposed address. Link expires in 24 hours; the current address remains active until confirmation. If unexpected, ignore it. |
| Email-change security notice | `Your Halaga email address changed` | The address changed and existing sessions were revoked. If unexpected, open Halaga directly. No link, new address, support contact or identity detail. |

- Verification, reset and email-change action URLs use the configured
  `HALAGA_PUBLIC_ORIGIN`, never request headers. Put the opaque token in the URL
  fragment (`#token=...`), not query/path. The future page must read then immediately
  clear the fragment, POST the token to its same-origin account command, use
  `Referrer-Policy: no-referrer`, avoid third-party resources, and never cache or
  log the URL/token. No account action route is mounted by this decision.
- Disable Brevo transactional link and open tracking before sending. Do not rely on
  click redirects preserving fragments. Brevo documents default recipient-level
  open/click tracking and account-level anonymous tracking controls; confirm the
  sender account's tracking state during launch readiness. See [Brevo tracking
  settings](https://help.brevo.com/hc/en-us/articles/11643306229906-Can-I-anonymize-the-tracking-of-opens-and-clicks-for-my-emails).
- Render fixed text and escaped HTML in code; do not store rendered content. Send
  one recipient per request through the accepted Brevo API. Do not include names,
  DOB, passwords, session data, proposal content, exact locations or evidence.
  Do not assert recipient tracking consent or collect email analytics.

### Dispatch, retries and crash recovery

- The durable per-intent row is the job and deduplication record. Claim READY work
  with PostgreSQL `FOR UPDATE SKIP LOCKED`, a random fencing lease ID and a
  two-minute lease. One dispatch call handles one job; the eventual worker runtime
  and polling schedule remain deployment choices.
- Allow at most five provider attempts. Only explicit Brevo HTTP 429 rejection is
  retried automatically, after 30, 60, 120 and 240 seconds. A worker crash while
  only LEASED is recovered to READY if attempts remain. Once state reaches SENDING,
  a crash, timeout, network failure, malformed 2xx response or 5xx is UNKNOWN and
  is never automatically resent. A definite provider 4xx is FAILED. This favors
  avoiding duplicate credential mail over silent blind resend; exactly-once mailbox
  delivery is not claimed.
- Completion updates require the same lease ID. Provider acceptance and local
  acknowledgement can still be ambiguous. UNKNOWN work remains visible in the
  restricted internal state for reconciliation. No participant-facing retry,
  staff reader, or operator retry endpoint is added; that remains gated on the
  staff role, audit and recovery runbook. Recovery automation must not expose
  payloads or diagnostics.
- A stale/expired/deleted-account intent becomes SUPPRESSED and its ciphertext is
  erased. A send already in SENDING can race replacement/deletion; single-use and
  deletion guards make its action ineffective. Provider acceptance sets
  `dispatchedAt`; it does not claim inbox delivery.
- Require HTTPS public origin in production; permit loopback HTTP only outside
  production. Send with Brevo's documented `POST /v3/smtp/email` API using the
  configured sender. No provider credentials are committed. Recheck free quota,
  sender-domain authentication, account terms and billing behavior before launch.

### Retention and cleanup

- READY, LEASED, SENDING, FAILED and UNKNOWN transport ciphertext remains only while
  its token/notice delivery window is open. Token work expires with its source
  token. Email-change security notices have a seven-day delivery window. Suppression
  erases ciphertext immediately; accepted work erases it after provider acceptance.
- Retain terminal job and minimal delivery metadata, including the old-address
  snapshot, for 30 days after terminal outcome, then delete the outbox event and
  cascaded delivery row. No recipient is copied into job metadata, logs, analytics
  or provider request history under Halaga control. Brevo/provider retention and
  backup purge timing remain launch checks.
- `recoverAndClean` recovers expired leases, quarantines expired SENDING work as
  UNKNOWN, suppresses expired READY work, removes expired account token rows and
  purges terminal delivery/outbox records after 30 days. Scheduling this operation
  requires the eventual worker/deployment decision. The operation does not clean
  sessions, auth rate counters or other verification purposes.

## Consequences and limits

- Account token intent and ciphertext handoff now commit atomically. Dispatch,
  token replacement suppression, lease recovery, bounded 429 retry, ambiguous-send
  quarantine, fixed templates, configured-origin fragment links and bounded
  retention are implemented as an unmounted internal service.
- The API is not mounted and no worker is deployed. Account action pages remain
  disabled previews, so real sending stays off until command routes, fragment
  consumption, sign-in/session race protections, password-change notice writes,
  terms/privacy content, role-restricted recovery and ADR-081 readiness gates pass.
- Provider acceptance can precede a worker crash. Such work is UNKNOWN; an operator
  may need an audited reconciliation/retry policy before it can be retried. The
  implementation deliberately does not invent operator access.
- Brevo click tracking must remain disabled for fragment links to survive unchanged.
  Test this against the selected sender configuration before any real delivery.

## Sources

- ADR-073, ADR-075, ADR-087
- PROJECT.md §§ 26, 28, 33 and 34
- architecture.md §§ 3, 5, 6 and 8.2
- [Brevo transactional email API](https://developers.brevo.com/reference/send-transac-email)
- [Brevo transactional tracking](https://help.brevo.com/hc/en-us/articles/11643306229906-Can-I-anonymize-the-tracking-of-opens-and-clicks-for-my-emails)
