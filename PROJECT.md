# Halaga Project Source of Truth

- Status: MVP product definition approved for architecture and implementation planning
- Product phase: Invite-first seeding followed by an eight-week public pilot
- Launch market: Cagayan de Oro City, Philippines
- Last updated: 2026-10-12

## 1. Document Authority

This document is the authoritative product and domain specification for the Halaga MVP. Developers and AI coding agents must use it to determine intended behavior, scope, invariants, and acceptance criteria.

Supporting material:

- `product.md` records the original discovery and product direction.
- `docs/decisions/` records the reasoning and consequences behind accepted decisions.
- `docs/domain/GLOSSARY.md` defines agreed domain language.

When an older statement conflicts with this document, this document reflects the latest agreed product decision. Do not invent behavior when this document marks a decision as deferred. Create or update an ADR before implementing behavior that would resolve a deferred decision or materially change this specification.

## 2. Product Definition

Halaga is a local value-discovery marketplace for unwanted electronics.

It helps an owner answer:

> What is this device still worth to real buyers?

The MVP discovers value through private competing offers. It connects electronics owners with individuals, technicians, repair businesses, refurbishers, resellers, parts buyers, recyclers, and junk shops that may value the same item differently.

Halaga is not a guaranteed disposal or collection service. A listing does not guarantee an offer, removal, pickup, recycling, or sale.

## 3. Problem and Product Hypothesis

Households already have disposal options such as junk shops, but often do not know whether an old, damaged, or unused device has greater value through reuse, repair, refurbishment, resale, parts recovery, or recycling.

The core seller hypothesis is:

> Individual and household owners will be more willing to release unwanted electronics when they can compare independent offers instead of defaulting immediately to a flat scrap price.

The core buyer hypothesis is:

> Local buyers will repeatedly use the marketplace when it gives them relevant electronics they can reuse, repair, refurbish, resell, salvage, or recycle.

The MVP tests those behaviors through completed local exchanges and competing-offer coverage, not registrations alone.

## 4. Goals

The MVP must:

- Let a non-technical household seller create an evidence-rich listing without first knowing the item's value.
- Let independent buyers privately evaluate the listing and submit offers.
- Let a seller compare, negotiate, and reserve one offer without exposing competing demand to buyers.
- Support local inspection, final-price adjustment, and mutually confirmed completion.
- Preserve sufficient history for moderation, disputes, trustworthy metrics, and later valuation research.
- Operate safely within a deliberately narrow category, geography, logistics, and support model.

## 5. MVP Non-Goals

The MVP does not provide:

- Guaranteed collection, disposal, recycling, pickup, or buyer interest.
- Shipping, carrier delivery, seller delivery as a first-class method, or platform-operated logistics.
- Integrated payments, escrow, refunds, chargebacks, or payment guarantees.
- Platform-generated prices, price ranges, appraisals, or AI valuation.
- Native Android or iOS applications.
- Public auctions, public offer amounts, or public offer counts.
- Public star ratings or written reviews.
- Saved searches, new-listing alerts, personalized recommendations, or map-radius search.
- Native push, browser push, or SMS notifications.
- Large appliances, televisions, random consumer electronics, institutional asset workflows, or hazardous-item logistics.
- Guardian accounts or marketplace participation by minors.
- Full Filipino localization or automatic translation.
- Lock-removal or security-control-bypass assistance.
- A general waste-management, repair-management, or government asset-management system.

## 6. Users and Stakeholders

### 6.1 Primary seller

The MVP design center is an individual or household owner in Cagayan de Oro City with an occasional unwanted electronic item.

Small businesses and offices may use the same standard account and listing flow. The MVP does not provide organization accounts, batch import, inventory management, approval chains, procurement, audit documentation, or other institution-specific workflows.

### 6.2 Buyers

Any eligible registered individual may submit offers. Electronics businesses and professional technicians may also participate and may apply for a human-reviewed verification badge.

Potential buyers include hobbyists, end users, repair technicians, repair shops, refurbishers, resellers, parts buyers, recyclers, and junk shops.

### 6.3 Contextual roles

One account may both list items and submit offers. `Seller` and `Buyer` are roles within a particular listing or transaction, not mutually exclusive account types.

A listing owner cannot submit an offer on their own listing.

### 6.4 Platform operator

A designated human operator is an MVP launch requirement. The pilot must have a named primary and at least one trained alternate operator authorized for the queues they cover. They review verification applications, held listings, reports, disputes, evidence, no-show allegations, appeals, and account or listing enforcement. If neither trained operator is available during coverage, pause new onboarding and listing publication until coverage resumes; reports remain available and display the actual response window (ADR-080).

### 6.5 MVP business model

The MVP is free for sellers and buyers. There is no listing fee, offer fee, subscription, transaction commission, verification fee, paid promotion, or priority-access fee.

Revenue is not an MVP success criterion. Monetization is deferred until the core marketplace behavior is validated.

## 7. Geography and Access

- The MVP launch market is Cagayan de Oro City.
- Marketplace participation is limited to eligible users and items within the launch market during the pilot.
- Active listings are browseable without signing in.
- Public listing pages are shareable by direct link but must use `noindex` and appropriate crawler controls during the pilot.
- `Noindex` is not an access-control mechanism; private fields must never be present in public responses.
- Publishing a listing, sending a pre-offer inquiry, or submitting an offer requires an eligible registered account.

## 8. Accounts and Eligibility

### 8.1 Adult participation

Marketplace participation is restricted to users age 18 or older. Ordinary users provide:

- A self-declared date of birth.
- An explicit 18+ eligibility attestation.

This is self-declared eligibility, not government-ID-verified age. Date of birth is private.

### 8.2 Email verification

Email verification is required before a user may publish a listing or submit an offer. Pre-offer inquiries also require a registered, eligible, email-verified adult account.

Email verification proves control of an email address; it does not prove legal identity, ownership, age, professional status, or trustworthiness.

### 8.3 Public identity

Individual users appear under a chosen display name, not a legal or full name. A display name is not proof of identity.

Public trust signals are limited to:

- Verified Business or Verified Professional Technician badge, where applicable.
- Mutually confirmed transactions completed as seller.
- Mutually confirmed transactions completed as buyer.
- Account age or member-since information.

The MVP has no public star rating or written review.

### 8.4 Blocking

Either user may block the other. A block:

- Prevents new inquiries, offers, counteroffers, and ordinary direct messages between the accounts.
- Mutually hides profiles and future listings while both users are signed in.
- Does not cancel, delete, or conceal an active reservation, completion process, report, dispute, or retained transaction record.
- Does not guarantee that otherwise-public content is invisible while signed out.

Active workflows must still reach a terminal state through cancellation, completion, administrative closure, or support resolution.

### 8.5 Authentication protection

Authentication sessions use a seven-day rolling lifetime, renewed on use at most once per day. Inactivity beyond the expiry requires sign-in again. Sensitive email and password changes require a session created less than 15 minutes ago; rolling renewal does not count as a new sign-in.

Cookies remain host-only for the single application, with HttpOnly and SameSite=Lax protection. Production requires HTTPS and Secure cookies; local loopback HTTP development remains supported. Registration allows three requests per 15-minute inactivity window, sign-in five per minute, password-reset requests and verification-email resends each three per 15 minutes, and other authentication endpoints 60 per minute. Limits are per resolved client IP and endpoint, with shared PostgreSQL counters outside local development. Shared-IP participants may need to wait (ADR-086).

These policies are accepted; account endpoints remain unimplemented. Token expiry, durable email integration, reviewed deployment proxy trust, and launch-readiness gates must be settled before affected account flows accept participants.

## 9. Supported Inventory

### 9.1 Top-level categories

The MVP supports:

1. Smartphones & Tablets
2. Laptops
3. Desktop Computers
4. Computer Components & Peripherals
5. Monitors
6. Printers & Scanners
7. Networking Devices
8. UPS & Small Backup Power
9. Accessories & Small Electronics

### 9.2 Constrained accessory category

`Accessories & Small Electronics` is not a catch-all. It accepts only accessories and peripherals intended for a supported MVP device class.

Supported examples include:

- Chargers and power adapters
- USB, HDMI, Ethernet, and similar cables
- Headsets and earphones
- Keyboards and mice
- Webcams
- Laptop docks
- USB hubs and dongles
- Small computer speakers
- Replacement laptop or phone accessories
- Bundles of supported accessories

Unsupported examples include cameras, game consoles, smartwatches, drones, vapes, medical devices, power tools, and standalone consumer electronics without a supported parent category.

### 9.3 Battery restrictions

Standalone batteries and standalone battery products, including power banks, are excluded.

An integrated battery is allowed within an otherwise supported device when the seller discloses its known condition. A device with a known swollen, leaking, punctured, overheating, or otherwise hazardous battery is not eligible for a normal marketplace listing.

The platform must not encourage a user to transport, open, repair, compress, puncture, or otherwise handle a hazardous battery.

### 9.4 Locked devices

Activation-locked, account-locked, BIOS/firmware-locked, or organization-managed devices are allowed when their status is accurately and prominently disclosed through a required structured attribute where applicable.

Buyers see lock status before offering. The platform does not guarantee or assist with lock removal. Suspicious ownership or device-identity indicators trigger review or enforcement.

## 10. Listing Types and Bundles

A listing is explicitly either:

- `Single item`
- `Bundle/lot`

Every offer on a bundle covers the entire bundle. Partial-item bidding and partial completion are not supported. A seller who wants separate outcomes must create separate listings before accepting an offer.

A bundle may contain different condition states but must stay within one allowed family:

- **Mobile:** smartphones and tablets plus supported accessories intended for them.
- **Computing:** laptops, desktops, computer components/peripherals, monitors, and compatible supported accessories.
- **Printing:** printers and scanners plus compatible supported accessories.
- **Networking:** networking devices plus compatible supported accessories.
- **Power protection:** UPS and small backup-power devices plus non-battery supported accessories.

Each materially distinct item or grouped quantity records its own condition and disclosed issues.

If every included item has the same condition, that condition is the listing summary. If conditions differ, the listing displays `Mixed conditions` with quantities by condition. `Mixed conditions` is not a fifth item condition. A bundle matches a condition filter when any included item has the selected condition.

## 11. Listing Data and Evidence

A listing must capture information sufficient for a buyer to identify and evaluate the item, including where applicable:

- Listing type and category
- Title
- Brand and model, or explicit `Unknown`
- Approximate age when known
- Structured diagnostic answers and derived condition
- Power-on status where meaningful
- Known problems, functional defects, intermittent behavior, and cosmetic damage
- Missing components
- Included accessories or bundle contents and quantities
- Known battery condition for devices with integrated batteries
- Lock or management status where applicable
- Barangay
- At least two clear photos of the actual item
- Written description
- Pickup and meetup availability
- Seller ownership declaration

The seller may enter an optional PHP price expectation. It is private to the seller, shown only as a benchmark during offer comparison, and is not an asking price or platform valuation.

Halaga records monetary amounts exactly to two decimal places, including centavos. This defines supported precision, not a business maximum.

### 11.1 Photos

- At least two clear photos of the actual item are required.
- Stock images, catalog images, and screenshots alone do not qualify.
- Known visible defects must not be intentionally omitted.
- Image processing must remove embedded location metadata and must not publish original private metadata.

### 11.2 Unknown brand or model

`Unknown` is permitted for brand, model, or both; guessing is not.

If identifying markings exist, the seller must provide a clear photo of them plus a written description. If no markings exist, the seller must provide multiple clear angles and sufficient descriptive facts for reasonable buyer evaluation.

### 11.3 Ownership and device identifiers

Every seller must attest that they own the item or are authorized by its owner to list and transfer it. This declaration is required but is not independent proof of ownership.

IMEI entry is optional but strongly encouraged for smartphones and cellular-capable tablets. An omitted IMEI does not block publication. When provided:

- It is sensitive evidence, not public listing content.
- Before reservation, buyers see only that an IMEI was provided.
- The platform never shows a masked portion publicly.
- After reservation, the seller may explicitly disclose the full IMEI to that reserved buyer.
- Otherwise, it is limited to the seller and authorized staff with an operational need.
- Providing an IMEI does not prove ownership, authenticity, or theft-free status.

## 12. Condition Model

The seller does not select a judgment label directly. The platform asks simple, observable diagnostic questions, derives a condition, and shows the result before publication. The label cannot be overridden; the seller must correct the underlying answers.

The four universal item conditions are:

- **Untested/unknown:** the seller cannot or did not test the item sufficiently.
- **Fully functional:** tested, all expected primary functions work, and there is no known functional defect.
- **Functional with issues:** tested and performs at least one intended function, but has a disclosed defect, intermittent behavior, or missing functionality.
- **Not functional:** tested and performs no intended function in its current state.

Power state, cosmetics, missing accessories, battery condition, lock status, and specific defects are separate facts. `Repair Needed`, `For Parts`, and `End of Life` are not factual condition labels.

The platform stores the material diagnostic answers as well as the derived label. Buyers see relevant answers and defects. Condition is guidance based on seller-provided facts, not a professional diagnosis, repairability guarantee, disposition recommendation, or valuation.

### 12.1 Laptop diagnostic prototype

Laptops are the first accepted English-language category diagnostic prototype. The canonical question wording, applicability rules, safe-testing guidance, and deterministic derivation are defined in `docs/design/LAPTOP_DIAGNOSTICS.md` and ADR-068.

For laptops:

- A suspected hazardous battery stops testing and enters the existing ineligible-or-held safety path. It does not derive ordinary `Untested/unknown`.
- Power response, built-in display, startup behavior, keyboard, built-in pointing device, and power-input/charging behavior are separate facts.
- Each check is classified as publication-required, condition-required when applicable, or optional enhanced testing.
- Battery presence and operation are prominently disclosed but are not treated as proof that the laptop as a whole is nonfunctional.
- An absent or failed battery derives `Functional with issues` when battery operation is expected for that configuration and the laptop otherwise performs an intended function. A battery that is genuinely not applicable to the configuration does not prevent `Fully functional`.
- Lock or management status remains separate from condition. A disclosed lock does not itself change the derived condition, although it may limit which functions the seller can test and therefore lead to `Untested/unknown`.
- Before publication, the seller sees the derived label, the answers that caused it, prominent separate battery and lock disclosures, and a link back to each answer that can be corrected.

## 13. Listing Location and Privacy

Public listing location consists of:

- Cagayan de Oro City
- Selected barangay
- A barangay-level representative map area or boundary

The public map is not generated from, randomized around, or otherwise derived from a seller's exact home location. Listing creation does not require an exact home address or private point.

Exact pickup or meetup details are private to the reserved transaction. Public pages, APIs, metadata, images, analytics, and caches must not reveal an exact address or precise coordinate.

## 14. Listing Publication and Moderation

Universal human pre-approval is not required.

A listing publishes immediately when it passes required-field, taxonomy, bundle, ownership, evidence, and safety validation without a review trigger.

A listing is held from public visibility for human review when checks detect:

- Unsupported or ambiguous category classification
- Uncertain constrained-accessory eligibility
- Suspected hazardous battery or prohibited item
- Stolen-item indicators or duplicate/inconsistent identifiers
- Repeated duplicate or manipulative listings
- Apparent public phone numbers, exact addresses, full device identifiers, financial details, or other sensitive information
- Invalid or ambiguous bundle-family composition
- Account restrictions or relevant prior support findings
- Failed or ambiguous ownership, identity, photo, or unknown-brand/model evidence

Deterministically ineligible listings are rejected with safe guidance. Ambiguous listings are held, not automatically treated as violations. Published listings remain reportable and subject to post-publication moderation.

A user may file one internal appeal within seven calendar days after notice of a listing moderation rejection or removal. The appeal must identify new evidence, a material factual error, misapplication of platform policy, or a material procedural failure. Halaga acknowledges within two business days and targets a decision within five business days. A different authorized operator reviews when available; otherwise, the original operator records a separate reconsideration addressing each ground. An appeal does not automatically restore a listing or lift a safety restriction. There is no second internal appeal during the MVP (ADR-078).

## 15. Listing Lifecycle

An active listing has a 30-day lifetime from publication or renewal. Renewal is an explicit seller confirmation that the item remains available and the listing remains accurate.

At the 30-day boundary:

- The listing stops accepting new offers unless renewed.
- Existing reservations continue normally.
- Existing proposals retain their original 72-hour deadlines and may resolve normally.
- An existing accepted proposal may create a reservation.
- If not renewed, the listing becomes `Expired` after all existing activity ends without completion.

### 15.1 Material edits

A material edit is any change that could reasonably affect valuation or intent, including identity, specifications, condition answers, defects, lock or safety status, missing or included items, photos, or material fulfillment availability.

After offers exist, a material edit pauses every affected active and backup offer. Each buyer must explicitly reactivate, revise, or withdraw. Offers never carry forward silently.

If the item is already reserved, a material edit changes the reservation to `Buyer reconfirmation required`. The prior appointment and terms are suspended. The buyer has 24 hours to reconfirm, revise, or withdraw. No response automatically cancels the reservation and permits the listing and backups to reopen.

Non-material spelling, formatting, and non-substantive clarification changes do not trigger reapproval.

## 16. Discovery

Required MVP discovery controls are:

- Keyword search over title, brand, model, description, and keywords
- Category filter
- Condition filter
- Barangay/location filter
- Listing type filter
- Sort by newest

Buyers discover inventory through browsing and manual search. There are no saved searches or automatic new-listing alerts.

There is no public price filter because seller expectation and offers are private. There is no exact-distance filter because listings use barangay-level geography.

## 17. Messaging, Offers, and Negotiation

### 17.1 Pre-offer inquiry

An eligible, registered, email-verified adult buyer may privately ask the seller questions before offering. The inquiry is tied to the listing and buyer-seller pair. It is not an offer and does not count toward marketplace metrics.

The conversation remains attached when that buyer later offers. Pre-reservation phone numbers and external contact handles may not be exchanged.

### 17.2 Offer privacy

- Each buyer's amount, messages, and proposal history are private to that buyer and the seller.
- Buyers cannot see another buyer's identity, amount, messages, or offer count.
- Public pages do not show offer amounts, valid-offer counts, demand ranges, or popularity badges.
- The seller and authorized staff may see the offer activity needed for their roles.
- Halaga is not a public auction.

### 17.3 Structured proposals

A buyer offer and seller counteroffer is a structured PHP proposal with:

- Positive amount
- Proposer
- Submission timestamp
- Fixed expiration timestamp
- Status and immutable history

Every proposal is actionable for 72 hours. Users cannot choose the deadline. A new counterproposal becomes the current actionable proposal and receives a new 72-hour period. Expired proposals remain historical and cannot be accepted.

Buyers may withdraw an active proposal at any time before seller acceptance without support approval. Withdrawal is immediate and historical; it does not delete the conversation.

The seller may accept any active proposal they prefer. The highest amount is not automatically selected or required; the seller may also consider buyer verification, intended use, fulfillment fit, communication, and other visible trust context.

Negotiation before acceptance occurs inside Halaga through private messages and structured proposals.

### 17.4 Optional intended use

A buyer may optionally state `Reuse`, `Repair`, `Refurbish`, `Resell`, `Parts/salvage`, `Recycle`, or `Other` with explanation. This is private offer-comparison context, is non-binding, and is not verified environmental-outcome data.

## 18. Reservation and Competing Offers

Seller acceptance creates one reservation subject to physical inspection. It is intent to transact, not a completed, binding, or guaranteed sale.

When a reservation is created:

- The listing stops accepting new offers.
- Existing competing negotiations become paused backups.
- The seller cannot reserve the same listing for another buyer.
- Backup buyers are told only that another offer is reserved.

When the reserved transaction completes, backup offers close as unsuccessful. When it ends without completion:

- The listing reopens to every eligible buyer immediately.
- Backup buyers are notified but receive no priority or exclusive window.
- A backup proposal does not resume automatically.
- The backup buyer must reactivate the same amount or revise it, creating a fresh 72-hour proposal.

## 19. Pickup, Meetup, and Appointment

Supported fulfillment methods are:

- Buyer pickup
- Mutually agreed meetup

Shipping and platform logistics are not supported.

After reservation, scheduling and location coordination remain available inside Halaga. Phone numbers and external handles are not disclosed automatically. Either participant may voluntarily send them in the private conversation only after reservation, with a warning that off-platform communication may not be available to support.

A reservation requires a structured appointment accepted by both parties, with:

- Pickup or meetup method
- PHT-aware date and time
- Private location details
- Proposal, acceptance, and revision history

The first accepted appointment must be scheduled no later than seven calendar days after the reservation is created. The parties may mutually accept no more than two reschedules. No accepted appointment may be later than 14 calendar days after reservation creation. The system rejects a proposal or attempted acceptance outside these limits; free-form agreement does not extend them.

Free-form chat does not establish or change the system appointment.

The reservation automatically expires 12 hours after the agreed appointment unless:

- Completion confirmation has already started, or
- Both parties agreed to a structured rescheduled appointment before the deadline.

Automatic expiry does not prove a no-show or fault.

## 20. Inspection, Final Price, Payment, and Completion

The buyer may inspect the item at pickup or meetup. The parties may proceed at the reserved price, cancel, or renegotiate a different final price.

Halaga preserves both reserved price and final price. The final price never overwrites proposal history.

Payments occur entirely outside the platform using a method chosen by the parties. Halaga does not process, hold, verify, refund, reverse, or guarantee funds.

A transaction becomes completed only when buyer and seller both confirm:

- The same final PHP price.
- That the transfer and transaction completed.

The first confirmation creates `Pending completion confirmation`; it does not complete the transaction. Once either party submits completion confirmation, ordinary direct cancellation is disabled.

The other party has 72 hours from the first confirmation to respond. Halaga notifies that participant immediately, then, while no response has been submitted, sends reminders with 48 hours and 12 hours remaining.

If the other party provides no completion confirmation by the original 72-hour deadline, the workflow is administratively closed as unconfirmed without automatically creating a support case. Administrative closure is not completion and is excluded from completed-sale and valuation data.

If the parties submit mismatched final prices, both are notified and may self-correct through a new confirmation that supersedes their own prior confirmation without deleting its history. The mismatch correction deadline is the earlier of:

- 120 hours after the first completion confirmation, or
- The later of the original 72-hour deadline and 48 hours after the first mismatch.

Further mismatched corrections do not restart or extend either deadline. A matching pair received by the correction deadline completes the transaction. A mismatch that remains unresolved at that deadline creates a support case rather than being administratively closed as ordinary non-response. Either participant may report a problem sooner.

## 21. Cancellation and No-Shows

Before the first completion confirmation, either buyer or seller may cancel a reservation directly without mutual agreement or support approval. Cancellation requires a reason, is immediate, notifies the other party, and remains in history.

Cancellation alone does not establish misconduct.

Reservation expiry does not automatically penalize either party. A no-show case begins only when one participant reports the other. The accused participant must be notified and given an opportunity to respond before an adverse finding or penalty.

The accused participant has three business days after case notice to respond. They may obtain one two-business-day extension by requesting it before the original response deadline. Business days are Monday through Saturday in PHT. Failure to respond is not an automatic adverse finding; after the applicable deadline, support decides from the available platform records and submitted evidence.

When necessary to contain an urgent safety or marketplace risk, support may apply a temporary restriction before the response deadline. A temporary restriction is precautionary, must record its reason and scope, and is not itself a final finding.

## 22. Disputes and Material Misrepresentation

A material misrepresentation is an inaccurate or undisclosed fact that would reasonably have changed the buyer's offer, reservation decision, or completion decision. Intent is not required for materiality. Intent, care, cooperation, repetition, and history affect the platform remedy or sanction.

Potential examples include:

- Wrong device identity, model, or material specifications
- Material functional defect inconsistent with disclosed diagnostics
- Missing represented components or accessories
- Undisclosed activation, account, firmware, or management lock
- Materially inauthentic identity claim
- Undisclosed hazardous condition

Minor cosmetic variation, buyer's remorse, subjective value disagreement, and accurately disclosed defects do not qualify by themselves.

A buyer has 48 hours after mutual completion to open a material-misrepresentation dispute. The clock begins when the second matching confirmation completes the transaction.

Safety, suspected stolen property, prohibited items, threats, harassment, fraud patterns, and account abuse may be reported outside the 48-hour transaction-dispute window.

For a material-misrepresentation case, the accused participant has the same three-business-day response period, optional one-time two-business-day extension, non-response treatment, and temporary-safety-restriction rules defined for no-show cases in section 21.

### 22.1 Case evidence

Each participant's evidence submission requires a structured written statement and may include:

- Up to 10 image files, no more than 10 MB each
- Up to three PDF documents, no more than 15 MB each
- Supplemental external links, which are not treated as durable or authoritative because their content may change or disappear

Video, audio, archive, and executable uploads are not supported in the MVP. Relevant Halaga listings, revisions, messages, proposals, reservations, appointments, confirmations, notifications, and audit events are attached internally when authorized; users do not need to re-upload platform records.

Evidence originals are private, integrity-hashed, malware-checked, access-controlled, and retained according to the applicable case and transaction rules. Unsafe or unprocessable files are quarantined and are not available to ordinary case viewers. Metadata-stripped derivatives are used for ordinary image preview. Notifications link to the authorized case view and do not embed original evidence; if a notification surface later displays an evidence preview, it may use only an authorized safe derivative.

## 23. Human Support Scope

Human support may review platform records and submitted evidence, record a platform finding, and:

- Correct transaction status where policy and evidence permit
- Remove listings
- Issue warnings
- Restrict marketplace privileges
- Suspend accounts

Support cannot:

- Guarantee or issue a refund
- Reverse an external payment
- Legally determine ownership
- Legally determine damages or liability

A platform finding is an operational policy finding, not a judicial or payment-provider decision.

### 23.1 Case findings, remedies, and appeals

A no-show or material-misrepresentation case ends with one of these platform findings:

- `Substantiated`
- `Unsubstantiated`
- `Inconclusive`

Any platform action must be reasoned and proportionate to the finding, risk, intent where relevant, cooperation, repetition, and account history. Available actions remain limited to permitted transaction-status correction, listing removal, warning, marketplace restriction, or account suspension. A finding does not issue or guarantee a refund, reverse payment, determine legal ownership, award damages, or determine legal liability.

Each affected participant may file one internal appeal within seven calendar days after the decision notice. An appeal must identify at least one of:

- New evidence
- A material factual error
- Misapplication of platform policy
- A material procedural failure

Halaga acknowledges the appeal within two business days and targets a decision within five business days. A different authorized operator reviews the appeal when available. If no different authorized operator is available, the original operator performs and records a separate reconsideration. Existing safety restrictions remain in effect during appeal unless an authorized operator changes them. There is no second internal appeal during the MVP.

## 24. Professional and Business Verification

Verification is optional and human-reviewed. It is a trust signal, not a prerequisite for offering and not a guarantee of expertise, honesty, valuation quality, or transaction outcome.

### 24.1 Electronics business

Required evidence:

- Business name
- Public-facing business address
- At least one official supporting record, such as DTI/SEC registration, barangay/business permit, BIR registration, or accepted equivalent
- At least one public contact channel, such as a Facebook page, website, or business phone

Storefront or workshop photos are optional supporting evidence.

### 24.2 Professional technician

Required evidence:

- Real name and contact details, kept private
- Evidence of actual technical work, such as shop affiliation, service page, portfolio, work samples, training certificate, TESDA-related credential where applicable, or equivalent proof

A verifiable professional reference or public business presence should be included when available but is not an automatic disqualifier when other evidence is sufficient.

### 24.3 Badge lifecycle

Badges do not expire periodically during the MVP. Material profile changes, credible reports, suspected fraudulent evidence, closure, changed identity, or relevant policy violations trigger re-review.

Verification documents are retained while the badge is valid and for six months after revocation, withdrawal, or account closure, unless a documented case-specific exception applies.

A user may file one internal appeal within seven calendar days after notice of a verification denial or revocation, using the grounds, review process, and service targets in ADR-078. An appeal does not automatically restore a badge or pause an interim safety restriction. There is no second internal appeal during the MVP.

## 25. Notifications

The MVP requires:

- In-app notifications with durable read/unread state
- Email notifications

Critical events include inquiries, offers, counteroffers, material edits, reservation changes, appointment proposals and reminders, cancellations, expiry, completion confirmation, disputes, safety actions, and verification decisions.

Email must not leak private offer amounts, IMEI values, exact locations, or unnecessary message content.

SMS, browser push, and native push are out of scope.

## 26. Language and Accessibility

### 26.1 Language

English is authoritative for the interface, policies, terms, privacy content, moderation rules, support procedures, and staff operations.

Cebuano/Bisaya appears as a paired translation for:

- Listing diagnostics and condition questions
- Battery and hazardous-item safety warnings
- Offer, counteroffer, reservation, and expiry states
- Pickup/meetup coordination and safety
- Completion and final-price confirmation
- Cancellation and rescheduling
- Reporting, no-show, and dispute flows
- Corresponding critical transactional emails

Full Filipino localization and automatic translation are out of scope. User-generated listings and messages may use the user's chosen language subject to policy.

### 26.2 Accessibility

All core public, user, transaction, evidence, support, and staff workflows target WCAG 2.2 Level AA.

Acceptance criteria include keyboard operation, visible focus, semantic structure, sufficient contrast, accessible validation and errors, announced status changes, non-color-only cues, zoom and responsive behavior, image alternatives, and text alternatives to maps. Automated checks do not replace manual keyboard, screen-reader, zoom, and responsive testing.

## 27. Human Operations

A trained primary and alternate operator must provide coverage throughout seeding and the formal pilot (ADR-080).

Coverage is 8:00 AM through 10:00 PM Philippine Time (UTC+8), every day.

Service targets:

- Urgent safety reports: initial human review within four hours occurring inside coverage hours.
- Routine verification applications and disputes: initial human review within two business days.
- Case appeals: acknowledgement within two business days and target decision within five business days.

Business days are Monday through Saturday in PHT. Sunday remains covered for urgent safety reports but does not count toward the routine target.

These are initial-review targets, not guaranteed final-resolution times.

Staff access to messages, identifiers, verification evidence, location, and dispute evidence must be role-restricted, purpose-limited, and auditable.

## 28. Data Protection and Retention

### 28.1 Sensitive data

Sensitive or restricted data includes:

- Date of birth
- Email and private contact details
- IMEI and other persistent device identifiers
- Exact pickup/meetup details
- Private messages and proposals
- Verification identity and documents
- Reports, disputes, evidence, findings, and moderation history
- Private seller price expectation

These fields must never appear in public listing payloads, public metadata, logs without redaction, public analytics, or unrelated-user responses.

Server operational logs may contain only allowlisted operational metadata, such as a validated request ID, fixed command/event name, outcome, and internal error code. They must exclude credentials, session or verification tokens, date of birth, private listing data, evidence, submitted form contents, and raw validation errors or exception messages. Request handlers must not log full request bodies.

### 28.2 Closed transactions

Closed transaction records are retained for 24 months from terminal closure, then personal data is deleted or irreversibly anonymized unless a valid, documented, case-specific reason requires longer retention.

Retained history may include listing snapshots, revisions, offers, messages, appointments, confirmations, cancellation/expiry, support findings, and audit events.

Aggregated analytics may remain only when they cannot reasonably be linked back to a person or private transaction.

### 28.2.1 Inquiries and negotiations without a reservation

Private message and proposal content for an inquiry/negotiation that closes without producing a reservation is retained for six months from its final closure timestamp, then deleted or irreversibly anonymized unless a separately documented, case-specific retention exception applies. If the workflow is reopened or reactivated before deletion, its later final closure starts a new six-month period. Minimal non-content audit/event metadata follows its own retention classification; message bodies and offer amounts are not retained merely as audit metadata. Content relevant to an active report or case follows the separate case access and retention rules.

### 28.3 Account deletion

Full deletion is blocked while the account has an active listing, proposal, backup offer, reconfirmation, reservation, appointment, confirmation, report, dispute, verification review, or other unresolved workflow.

After eligible deletion:

- Login is permanently disabled.
- Public profile and public content are removed.
- Retained transaction-facing identity becomes `Deleted user`.
- Only records required by an applicable retention purpose remain non-public.
- Those records are later deleted or irreversibly anonymized when their retention period ends, absent a documented exception such as legal hold.

### 28.4 Retention exceptions

Records may be retained past their standard period only when necessary for an active case/safety investigation or a documented legal obligation or hold. An authorized operator must record the minimum affected data and subjects, purpose/reason, authorizing identity, start date, and review/expiry date. Review active exceptions at least every 30 calendar days. Release the exception promptly when its purpose or legal basis ends, then delete or irreversibly anonymize under the ordinary rule without undue delay. An exception does not make private data public or permit unrelated reuse. Provider-specific backup purge timing and deletion propagation must be verified after storage is selected (ADR-079).

## 29. Core Domain Model

The implementation must represent these concepts explicitly rather than collapsing them into a single listing status or chat record:

- **User account:** eligibility, email verification, display name, private attributes, blocks, restrictions, deletion lifecycle.
- **Professional/business profile:** claimed type, public fields, verification application, evidence, badge state, review history.
- **Listing:** seller, type, category/family, public location, lifecycle, current revision, publication cycle, private expectation.
- **Listing revision:** immutable or auditable material facts, diagnostic answers, photos/evidence references, materiality, author, timestamp.
- **Listed item/group:** identity, quantity, specifications, condition facts, battery status, lock status, included/missing items.
- **Inquiry/negotiation:** one listing, one buyer, one seller, private messages, state, listing revision acknowledged.
- **Structured proposal:** amount, proposer, timestamps, expiration, status, and history.
- **Reservation:** accepted proposal, reserved price, buyer and seller, reconfirmation state, competing-offer relationship.
- **Appointment:** method, agreed time, private location, acceptance and revision history, expiry threshold.
- **Completion confirmation:** party, submitted final price, completion assertion, timestamp.
- **Transaction outcome:** completed, canceled, expired, administratively closed, or support-resolved, with final price only when mutually confirmed.
- **Report/dispute case:** type, reporter, accused/subject, evidence, response, state, finding, actions, audit history.
- **Notification:** event, recipient, channel, delivery/read state, privacy-safe content.
- **Audit event:** actor, action, target, prior/new state or reason, timestamp.

### 29.1 Critical invariants

- A listing has at most one active reservation.
- A seller cannot offer on their own listing.
- Only the seller sees all offers on their listing.
- One buyer never sees another buyer's offer, messages, identity, or offer count.
- A proposal cannot be accepted after expiry, withdrawal, or a material edit requiring reapproval.
- Material edits never silently carry buyer intent forward.
- Reservation acceptance is not transaction completion.
- Reserved price and final price are distinct and historical.
- Completion requires matching confirmations from both parties.
- Administrative timeout never implies successful completion.
- Automatic reservation expiry never implies a no-show finding.
- Blocking and account deletion never erase an unresolved workflow or required audit record.
- Public projections never include sensitive listing, identity, offer, appointment, moderation, or evidence fields.

## 30. Lifecycle Summary

### 30.1 Listing

```text
Draft
  -> Validating
  -> Held for review -> Published | Rejected
  -> Published
       -> Paused by reservation
       -> Resolving existing activity after day 30
       -> Expired
       -> Closed by completed transaction
       -> Removed by seller or support
```

### 30.2 Buyer-seller interaction

```text
Inquiry
  -> Active proposal (72 hours)
  -> Counterproposal (new 72 hours)
  -> Withdrawn | Rejected | Expired
  -> Accepted / Reserved
```

### 30.3 Reservation and transaction

```text
Reserved
  -> Appointment agreed
  -> Buyer reconfirmation required (only after material edit)
  -> Inspection
  -> Canceled | Automatically expired
  -> Pending completion confirmation
       -> Mutually confirmed completed
       -> Administratively closed as unconfirmed after 72 hours of total non-response
       -> Mismatch correction -> Matched completion | Support case at correction deadline
       -> Support-resolved
```

Exact state names may vary in code, but the semantic distinctions and invariants may not be collapsed.

## 31. Pilot Plan

### 31.1 Invite-first seeding

The team first recruits sellers and active buyers. Public registration opens only when all conditions are met:

- At least 25 eligible active listings
- At least eight transaction-ready buyers
- Inventory across at least three supported category families
- At least five distinct buyers have submitted one or more valid offers
- No one buyer accounts for more than 40% of seeding-period valid offers at the checkpoint

A transaction-ready buyer is an eligible, non-suspended, email-verified adult in the launch market who completed required onboarding and can offer immediately.

The 40% concentration criterion is analytics-only and never caps legitimate buyer activity.

### 31.2 Formal pilot window

The formal eight-week pilot begins at the recorded timestamp when public registration opens. Seeding activity is tracked separately and does not count toward formal thresholds.

Seeded listings may remain active. They do not need republishing and do not receive artificial recency. For formal metrics:

- Only qualifying events at or after formal start count.
- Pre-pilot public exposure does not satisfy the 24-hour eligible-listing rule.
- A seeded listing's formal exposure clock begins at formal start.
- A reservation or completion occurring after formal start may qualify a listing through the early-resolution path.

## 32. Success Criteria

The formal pilot is meaningfully promising only if all of these conditions hold:

1. At least 30 mutually confirmed completed transactions occur during the eight-week window.
2. At least 40% of eligible published listings receive valid offers from at least two distinct buyers during the window.
3. There is no unresolved critical safety incident.
4. There is no demonstrated systemic failure in privacy, fraud prevention, prohibited-item controls, transaction integrity, or urgent support operations.

### 32.1 Eligible published listing

An otherwise legitimate listing enters the denominator when it either:

- Accumulates at least 24 hours of public availability during the formal pilot, or
- Becomes reserved or completed sooner.

Draft, held, paused, reserved, and removed time does not count toward the 24-hour exposure path.

### 32.2 Valid offer

A valid offer:

- Has a positive PHP amount.
- Comes from a distinct eligible, non-suspended buyer.
- Is submitted while the listing is active.
- Remains active until seller response or listing/reservation resolution, or receives a seller accept, reject, or counteroffer response.
- Is not test, spam, fraudulent, self-dealing, duplicate/manipulative, or immediately withdrawn activity.

Proposal revisions by one buyer count as one buyer's offer, not additional competition.

### 32.3 Safety override

Numerical success never overrides a critical or systemic failure. Expansion and further investment pause until the issue is contained, remediated, and the affected controls are revalidated with documented evidence.

Reaching the thresholds is a continuation signal, not proof of product-market fit, profitability, or organic acquisition.

## 33. Technology and Architecture Constraints

The product definition is technology-neutral. It does not select a language, framework, database vendor, cloud, authentication provider, email provider, or map provider.

The eventual architecture must support:

- Responsive mobile-first and desktop web experiences
- Server-enforced authorization and public/private field projections
- Transaction-safe state transitions and single-reservation enforcement
- Immutable or auditable listing, proposal, confirmation, moderation, and staff-action history
- Private messaging and structured proposals
- Image upload, processing, metadata stripping, and controlled access
- Durable in-app notifications and email delivery
- Scheduled proposal, reservation, confirmation, listing, and retention deadlines
- PHT-aware timestamps and Monday-through-Saturday business-day calculations
- Sensitive-data access controls and log redaction
- Human review queues and role-restricted staff tooling
- Search over public listing fields without indexing private data
- Pilot cohort and event-time analytics
- WCAG 2.2 AA verification
- Data deletion, anonymization, and retention workflows

Technology decisions must be recorded separately. AI coding agents must not choose a stack or vendor silently.

### 33.1 Free-first operating constraint

Development and invite-first seeding target ₱0 in recurring third-party technical-service fees. Architecture evaluation must prefer free tiers, free allowances, and local or open-source development tools. No paid subscription, usage-based billing path, or automatic paid upgrade may be enabled without the project owner's explicit approval.

Free-first does not permit weakening privacy boundaries, authorization, audit history, evidence protection, backup validation, safety workflows, or required retention behavior. Before public registration opens, the team must verify that the selected free services and their then-current limits can support the expected pilot workload and required controls. If they cannot, public launch pauses until the architecture is changed or a paid exception is explicitly approved and recorded.

Early development and usability validation use local/private environments and synthetic data. Real participant personal, transaction, verification, or case/evidence data must not be accepted until the selected deployment passes documented privacy/access-control, backup/restore, retention/deletion, worker-recovery, availability, and quota checks. Public-pilot deployment is gated on a compliant free architecture or a specifically costed paid exception approved by the project owner (ADR-081).

The public-pilot recovery acceptance targets are RPO no greater than 24 hours and RTO no greater than 24 hours. A tested recovery procedure must cover authoritative PostgreSQL state and private objects needed by active workflows. These are launch targets, not a provider SLA. If no free setup demonstrates them, the ADR-081 launch gate remains in force (ADR-082).

Usage and quota consumption must be observable. Where a provider supports them, hard spending caps or billing-disabled configurations are preferred over alerts alone. Free-tier suspension, sleep, quota exhaustion, retention limits, and lack of service-level guarantees must be included in availability and recovery planning.

## 34. Deferred Decisions

These items are intentionally not invented in this specification. They require a focused product, policy, legal, operational, design, or architecture decision before the affected behavior is implemented or the pilot launches:

- Diagnostic question wording and safe-testing guidance for supported categories other than the accepted laptop prototype.
- Whether unsupported category attempts are only rejected or may join a category-request waitlist.
- Renewal limits and any post-expiry renewal grace period.
- The exact timestamp behavior for `Newest` after renewal or material republication.
- Provider-specific backup purge timing and deletion propagation.
- Treatment of an account later found to be underage.
- External emergency or law-enforcement escalation procedure.
- IMEI or device-identifier blocklist integrations.
- Availability, performance, browser-support, PWA, and storage-capacity targets.
- Remaining hosting, deployment, database, storage, processing, worker, observability, and analytics choices listed in `architecture.md` section 8.2.

These deferred items do not authorize arbitrary defaults. Record the decision before relying on it.

## 35. Future Opportunities, Not MVP Commitments

Possible later work includes:

- Historical comparable ranges after sufficient trustworthy transaction data exists
- AI-assisted item identification or valuation
- Saved searches and category alerts
- Public reputation or role-specific reviews after enough transaction density exists
- Integrated payments or escrow
- Delivery or logistics partners
- Certified recycling outcomes
- Native mobile applications
- More device categories, televisions, appliances, and large-item logistics
- Institutional bulk listings, approvals, asset records, audit trails, and bidding
- Expansion beyond Cagayan de Oro City

Each requires validation and a new product or architecture decision.

## 36. Implementation Rule for Developers and AI Agents

Before changing behavior:

1. Identify the relevant section and ADR.
2. Preserve the stated privacy, state, evidence, and audit invariants.
3. Do not convert a deferred decision into an implicit default.
4. Do not expose private data to simplify a query or interface.
5. Do not collapse reservation, completion, administrative closure, cancellation, and dispute into one generic status.
6. Add or update an ADR when a decision changes product behavior, domain semantics, operational responsibility, retention, or safety controls.
7. Update this document and the glossary when an accepted decision changes the source of truth.
