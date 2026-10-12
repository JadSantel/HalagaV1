# ADR-021: Keep MVP Payments Outside the Platform

- Status: Accepted
- Date: 2026-10-05

## Context

The MVP's core promise is offer-based value discovery. Processing or holding funds would introduce payment-provider integration, identity and compliance obligations, chargebacks, refunds, payout timing, platform fees, and escrow-like operational responsibilities.

Transactions already culminate in local pickup or meetup with physical inspection, which provides a natural point for the parties to use a mutually chosen payment method.

## Decision

The MVP will not process, hold, transfer, or escrow transaction payments.

Buyer and seller will arrange and execute payment outside the platform at their own discretion, typically in connection with pickup or meetup. A platform-recorded reserved price or final price is a transaction record, not a payment instruction, payment guarantee, or proof that funds moved.

## Consequences

- Payment credentials and fund-transfer functionality are outside MVP scope.
- The platform cannot issue payment refunds, reverse transfers, adjudicate chargebacks, or guarantee that either party pays.
- Completion still requires both parties to confirm the same final price and that the transaction completed, but this is mutual attestation rather than processor verification.
- The product must warn users about common payment scams and should not encourage advance payment before inspection.
- In-app messages may contain discussion of payment method, but the platform should avoid collecting unnecessary financial-account details.
- Revenue models based on automatically deducting transaction fees are not available without a later payment decision.
- Dispute remedies must be designed around evidence, account or listing action, reputation, and safety escalation rather than forced refunds.

## Source

- `product.md`, especially sections 17, 28, and 33
- ADR-009: Treat Offer Acceptance as a Reservation Pending Inspection
- ADR-011: Require Dual Confirmation of Final Price and Completion
- Project interview decision made on 2026-10-05
