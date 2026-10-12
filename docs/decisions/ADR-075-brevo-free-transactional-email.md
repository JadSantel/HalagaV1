# ADR-075: Use Brevo Free for Initial Transactional Email

- Status: Accepted
- Date: 2026-10-12

## Context

Halaga requires transactional email for account verification, password reset, inquiries, proposals, reservation and appointment changes, completion confirmations, case notices, verification decisions, and other critical workflow events. These messages are delivered through the durable notification path and must not expose private offer amounts, IMEI values, exact locations, original evidence, or unnecessary message content.

The project follows ADR-071's free-first constraint and currently has no paid technical-services budget. The MVP pilot volume is expected to be modest, but provider quotas, sender requirements, and service behavior must be checked against current terms before public registration opens.

## Decision

- Use Brevo's Free plan for development, invite-first seeding, and the initial pilot transactional email delivery.
- At the time of this decision, Brevo documents a free allowance of 300 email sends per day, no time limit, and no credit card requirement. Recheck the allowance and billing behavior before launch.
- Do not enable a paid Brevo plan, paid add-on, usage billing, or automatic upgrade without explicit owner approval.
- Internal testing may use a verified temporary sender where permitted by Brevo.
- Public registration may open only after Halaga has a sender domain it controls and that domain is authenticated for deliverability. A free Gmail/Yahoo sender is not an acceptable public-pilot sender configuration.
- Verification, password reset, and transactional notices use privacy-reviewed templates. Email never includes private proposal amounts, full IMEI, exact pickup/meetup details, original evidence, or unnecessary private message content.
- Email sending is asynchronous through the PostgreSQL outbox/job mechanism. Provider rejection, quota exhaustion, and transient delivery errors remain visible, retryable notification states and never roll back the originating domain action or falsely mark an address verified.
- Retry behavior follows the durable-job policy; permanent configuration or sender-authentication failures enter the failed-job queue for operator diagnosis.
- Revalidate current free-plan quota, sender authentication, account approval, terms, and overage behavior before the public pilot. If any condition could create a charge or prevent required delivery, disable the billing path and pause launch until corrected or an explicitly approved paid exception is recorded.

## Consequences

- Halaga can begin transactional email integration without a recurring subscription or payment card, subject to current account and sender setup requirements.
- The provider's daily quota can delay or block messages; queue age, failed sends, and quota rejection need operational visibility.
- A daily quota of 300 sends can be consumed by retries or misconfiguration, so retry limits and duplicate suppression must be in place.
- Public launch requires control of an authenticated sending domain, which may have a separate registration cost and is not included in the ₱0 recurring service target.
- Email is a delivery channel, not the authoritative notification record. Durable in-app notification remains available when email is delayed or unavailable.
- A different provider or paid tier requires a new ADR based on current primary provider documentation and explicit cost approval.

## Source

- `PROJECT.md` sections 25, 27, and 33
- ADR-031, ADR-071, ADR-073, and ADR-074
- [Brevo free-plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
- [Brevo transactional email](https://www.brevo.com/products/transactional-email/)
- [Brevo sender-domain authentication](https://help.brevo.com/hc/en-us/articles/17286219877778-FAQs-About-domain-authentication-Brevo-code-DKIM-DMARC)
- Architecture interview decision made on 2026-10-12
