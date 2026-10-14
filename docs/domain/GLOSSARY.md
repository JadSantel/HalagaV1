# Project Domain Glossary

This glossary records agreed meanings for product and domain terms. It should be updated when interviews establish or change a term.

## Administratively Closed Transaction

A transaction workflow closed after the original 72-hour completion-confirmation deadline because the other participant provided no completion confirmation. Total non-response closes without automatically creating a support case. An unresolved mismatch follows the bounded correction and support workflow instead. Administrative closure is not evidence of a successful exchange and is excluded from completed-sale and valuation data.

## Completion Correction Deadline

The deadline for resolving mismatched final-price confirmations. It is the earlier of 120 hours after the first completion confirmation or the later of the original 72-hour deadline and 48 hours after the first mismatch. Further corrections do not restart it. An unresolved mismatch at this deadline creates a support case.

## Accessory

For MVP eligibility, a non-standalone product or peripheral intended for use with at least one supported device category. The accessory category is not a catch-all for any small electronic product.

## Recent Sign-In

A valid authentication session created less than 15 minutes ago. Required for sensitive email and password changes. Rolling session renewal does not change this timestamp or satisfy the requirement; the participant must sign in again after freshness expires (ADR-086).

## Adult Eligibility Attestation

The explicit, versioned signup statement that a participant is at least 18 and eligible to participate. Halaga stores the accepted text version and timestamp alongside private self-declared DOB. `adult-eligibility-en-v1` is the current approved wording identifier (ADR-042, ADR-087).

## Email Verification Token

A single-use credential proving control of the target email address. Signup verification and email-change tokens expire after 24 hours; a resend replaces the outstanding token. Password-reset tokens are separate and expire after one hour (ADR-087).

## Pending Email Change

An email change requested with a recent sign-in but not yet verified at the proposed address. The current verified address remains primary and marketplace actions remain available until proof atomically switches the account to the new verified address. Completion revokes all sessions and records a privacy-reviewed security notice to the old address (ADR-087).

## Old-Address Security-Notice Recipient

The private snapshot of the previously verified email address needed to deliver the security notice after an email switch. It is restricted to that delivery purpose and authorized, audited staff diagnosis. The notice intent excludes the proposed/new address and unnecessary private data; preserving intent history does not authorize indefinite recipient retention (ADR-087 implementation record).

## Rolling Session

An authentication session with a seven-day expiry renewed on use when at least one day has elapsed since the previous renewal. Inactive sessions expire; renewal does not count as a recent sign-in (ADR-086).

## Buyer

The registered user acting as the prospective acquirer within a particular listing, offer negotiation, reservation, or transaction. Buyer is a contextual role, not a permanent account type.

## Completed Transaction

An exchange for which both buyer and seller confirmed the same final price and confirmed that transfer and payment were completed.

## Derived Condition

A normalized observable-state label calculated from a seller's answers to simple diagnostic questions. It is shown before publication and is not a professional diagnosis, repairability judgment, disposition recommendation, or valuation.

The canonical values are `Fully functional`, `Functional with issues`, `Not functional`, and `Untested/unknown`. Power-on status is a separate diagnostic fact where relevant.

## Condition-Required Applicable Check

A category-specific observable-function check that must have a conclusive passing answer before an item may derive `Fully functional`, but only when that feature genuinely exists in the item's design or configuration. A missing or broken expected component is not `Not applicable`. Optional enhanced checks may remain untested, although a defect found through one still affects condition.

## Display Name

A user-chosen public account name shown on listings and marketplace interactions. It is distinct from a legal name, contact information, and verified business identity, and is not proof of identity.

## Final Price

The price mutually confirmed by both parties after inspection and any permitted post-inspection renegotiation. It may differ from the reserved price.

## Hazardous Battery Condition

A known or observed battery condition such as swelling, leaking, puncture, overheating, or another indication that ordinary marketplace handling would be unsafe. A supported device with such a battery is ineligible for a normal MVP listing.

## Platform Finding

A human support conclusion based on available platform records, policy, and submitted evidence. The MVP outcomes are `Substantiated`, `Unsubstantiated`, and `Inconclusive`. A finding may support a reasoned, proportionate platform action but is not a legal determination of ownership, damages, or liability and does not compel an off-platform refund.

## Case Appeal

One internal reconsideration available to each participant affected by a no-show or material-misrepresentation decision. It must be filed within seven calendar days and identify new evidence, a material factual error, policy misapplication, or a material procedural failure. There is no second internal appeal in the MVP.

## Held for Review

A non-public listing state caused by a defined safety, policy, fraud, or evidence trigger. The listing awaits human review and is not treated as published, removed, or proof of wrongdoing.

## Paused Backup Offer

An existing competing offer negotiation temporarily made inactive because the seller reserved the item for another buyer. It is neither accepted nor rejected and may be eligible to reopen if the reservation ends without completion.

## Transaction Appointment

A structured pickup or meetup time and private location agreed by the reserved buyer and seller. The first accepted appointment must occur within seven calendar days after reservation creation, no more than two mutually accepted reschedules are allowed, and no appointment may occur later than 14 calendar days after reservation creation. The reservation reaches its expiry threshold 12 hours after the current accepted appointment; mentioning a time in free-form chat does not establish or extend the system appointment.

## Valid Offer

For pilot measurement, an offer with a positive PHP amount submitted on an active listing by a distinct, eligible, non-suspended buyer. It must remain active until seller response or listing/reservation resolution, or receive a seller response. Test, spam, fraudulent, self-dealing, duplicate or manipulative, and immediately withdrawn offers are excluded. Revisions within one buyer's negotiation do not create additional competing offers.

## Monetary Amount

A PHP amount recorded by Halaga with exact centavo precision (two decimal places). This precision does not define a product maximum.

## Integrated Battery

A battery installed as part of an otherwise supported device. Integrated batteries are permitted only when no hazardous condition is known, and the seller must disclose known battery condition.

## IMEI

A persistent identifier for a cellular device. In the MVP it is optional but strongly encouraged for smartphones and cellular-capable tablets, and it is treated as sensitive device evidence rather than public listing data.

## Intended Use

An optional, self-reported, non-binding statement from a buyer describing a planned route such as reuse, repair, refurbishment, resale, parts/salvage, or recycling. It is not verified environmental-outcome data.

## Standalone Battery Product

A battery or product whose primary function is portable stored power, including a power bank. Standalone battery products are outside MVP scope even when intact.

## Offer Negotiation

A private interaction between one buyer and a listing's seller containing messages and a history of structured price proposals and counterproposals.

## Structured Proposal

A monetary buyer offer or seller counteroffer recorded within an offer negotiation. It is actionable for 72 hours under the pause rules and remains in history after it ceases to be actionable.

## No-Show Finding

A platform finding, made after one participant reports a missed transaction appointment and the other has an opportunity to respond, that the accused participant failed to attend. Automatic reservation expiry is not itself a no-show finding.

## Case Response Deadline

The deadline for an accused participant to respond to a no-show or material-misrepresentation case. It begins when case notice is issued and lasts three business days under Halaga's Monday-through-Saturday PHT calendar. The participant may obtain one two-business-day extension by requesting it before the original deadline. Non-response permits an evidence-based decision but is not an automatic adverse finding.

## Case Evidence Submission

A participant's structured written statement and permitted supporting files for a report or dispute. Each participant may attach up to 10 images of at most 10 MB each and up to three PDFs of at most 15 MB each. Platform records are attached internally when authorized. External links are supplemental, while video, audio, archives, and executable uploads are outside MVP scope.

## Material Misrepresentation

An undisclosed or inaccurate fact that would reasonably have changed a buyer's offer, reservation decision, or completion decision. Materiality does not require proof of intent; intent and conduct affect the platform remedy or sanction.

## Material Listing Edit

A listing change that could reasonably affect buyer valuation or transaction intent, including identity, specification, condition, defect, safety, included-item, photo/evidence, or material fulfillment changes. It pauses affected offers until each buyer explicitly reviews and acts.

## Mixed Conditions

A bundle-level summary shown when included items have more than one of the four universal condition states. It displays quantities by condition and is not a fifth item-condition value. A mixed bundle matches a condition filter when any included item has that condition.

## Listing Renewal

An explicit seller action confirming that an item remains available and its listing facts remain accurate for a new 30-day active lifetime. Renewal does not erase prior history.

## Lock Status

A structured disclosure of an activation lock, linked account lock, BIOS or firmware password, organization-management control, or similar restriction. Locked devices may be listed when accurately disclosed; the platform does not guarantee or assist with removal.

## Competing-Offer Listing

An eligible published listing that receives valid offers from at least two distinct buyers during the pilot measurement rules. At least 40% of eligible published listings must meet this definition for the MVP pilot to be meaningfully promising.

## Eligible Published Listing

For the pilot's competing-offer denominator, an otherwise legitimate listing that either accumulates at least 24 hours of public availability while active or becomes reserved or completed sooner. Draft, paused, reserved, or removed time does not count toward the 24-hour exposure path.

## Transaction Dispute Window

The 48-hour period beginning when the second matching completion confirmation makes a transaction completed. A buyer must open a material-misrepresentation dispute within this window; general safety, stolen-item, and account-abuse reporting is not limited by it.

## Transaction Closure Timestamp

The timestamp at which a transaction enters its terminal completed, canceled, expired, administratively closed, or support-resolved state. It starts the standard 24-month closed-record retention period.

## Systemic Trust Failure

A demonstrated failure that materially undermines a class of marketplace controls or users rather than an isolated ordinary case, including failures in privacy, fraud prevention, prohibited-item enforcement, transaction integrity, or urgent support operations. It blocks pilot continuation until remediated and revalidated.

## Mutually Confirmed Completed Transaction

A completed transaction for which buyer and seller submitted matching final-price and completion confirmations. Only this state counts toward the MVP pilot's primary completion threshold.

## Off-Platform Payment

A payment method chosen and executed directly by the buyer and seller without the platform processing, holding, transferring, verifying, refunding, or guaranteeing the funds.

## Ownership Declaration

A seller's recorded attestation that they own an item or are authorized by its owner to list and transfer it. It is required for publication but is not independent proof or platform verification of ownership.

## Price Expectation

An optional amount entered by the seller as a private personal benchmark. It is not shown to buyers and is not a platform valuation, asking price, minimum price, or completed-sale price.

## Professional or Business Verification

A human-reviewed platform status indicating that an electronics business appears real and operating or that a technician provided evidence of actual technical work under ADR-036. It is a trust signal, not a requirement for submitting offers and not a guarantee of expertise, honesty, valuation, or transaction quality.

## Reservation

The state created when a seller accepts a buyer's proposal. It records mutual intent to transact at the reserved price, subject to physical inspection. It is not a completed or guaranteed sale.

## Buyer Reconfirmation Required

A suspended reservation state caused by a material listing edit. The reserved buyer must review the new listing version and reconfirm, revise terms, or withdraw before the appointment and transaction can proceed.

## Bundle/Lot Listing

An explicit listing type covering multiple described physical items offered together. Contents may have different condition states but must belong to one supported category or predefined closely related category family. It records contents and quantities and must not be analyzed as though its total price were the price of one item.

## Reserved Price

The proposal amount accepted before inspection. It remains part of the transaction history even when the parties later agree to a different final price.

## Seller

The registered user who owns and manages a particular listing. Seller is a contextual role, not a permanent account type.

## Supported Device Category

A controlled category in which the MVP permits listings. Supported categories are defined by ADR-016; accepting a new category is a scope decision rather than merely adding a free-text label.

## Unsupported Standalone Device

An electronic product that does not belong to an approved top-level MVP category and is not merely an accessory or peripheral for a supported category. It cannot be listed through `Accessories & Small Electronics`.
