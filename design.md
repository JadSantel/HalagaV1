# HalagaV1 Interface Design Guide

- Status: Design proposals and implementation guidance; product behavior remains governed by `PROJECT.md` and accepted ADRs.
- Scope: Responsive web interface for invite-first seeding and the Cagayan de Oro public pilot.
- Related drafts: `docs/design/WIREFRAMES.md`, `docs/design/LAPTOP_DIAGNOSTICS.md`.

## 1. Product and design goals

Halaga is a local value-discovery marketplace for unwanted electronics. Its MVP lets an individual or household owner describe an item without estimating its price, lets eligible buyers privately evaluate it and make competing proposals, then supports a mutually coordinated pickup or meetup and bilateral completion confirmation.

The interface serves:

- **Sellers:** usually non-technical household owners with occasional unwanted devices. Help them make an evidence-rich listing, understand what is public, compare private offers, and finish or close a transaction confidently.
- **Buyers:** eligible individuals, technicians, repair businesses, refurbishers, resellers, parts buyers, recyclers, and junk shops. Help them find supported local inventory, assess disclosed facts, ask questions, and submit or manage a private proposal.
- **Operators:** authorized human reviewers. Help them triage held listings, verification applications, reports, disputes, evidence, appeals, and enforcement with purpose-limited access and an auditable decision trail.
- **Visitors:** anyone may browse active public listings without an account. Acting (publishing, inquiry, offer) requires an eligible, email-verified adult account.

The design should communicate practical trust, local relevance, clarity, and low effort. It should distinguish observable seller-provided facts from platform decisions and avoid implying that Halaga appraises, guarantees a buyer, arranges logistics, verifies payment, or guarantees reuse/recycling. One clear primary action, plain language, explicit next steps, and visible privacy explanations should carry through each workflow.

**Responsive intent (proposal):** mobile-first web, because listing photos, coordination, and local browsing are likely to happen on phones. On mobile, use a single-column hierarchy, short wizard steps, bottom navigation for signed-in users, and full-width actions. On desktop, use more space for search filters, offer comparison, operator queues, and side-by-side public/private review without changing permissions or workflow semantics. No native app or PWA behavior is implied.

## 2. Visual direction (proposals)

Use a restrained, practical marketplace style: warm off-white surfaces, deep ink text, and a clear green-teal action color, with a small amber safety accent and red reserved for errors or destructive outcomes. The visual language should feel approachable to households and credible to local repair and reuse businesses, without looking like a scrap-yard directory or a financial trading screen.

| Choice | Proposal | Purpose |
| --- | --- | --- |
| Brand palette | Deep forest/teal primary with warm paper backgrounds and neutral gray surfaces | Signals steadiness and usefulness; avoids defaulting to a loud “eco” aesthetic |
| Accent | Muted amber for pending/attention; restrained red for errors or danger | Separates caution from ordinary workflow and avoids making every pending state alarming |
| Typography | Highly legible sans serif with broad language support; system sans fallback | Works across devices and English/Cebuano/Bisaya text; avoids dependence on an undecided licensed font |
| Spacing | 4 px base scale, generous section spacing, compact field groups | Makes forms readable without wasting small-screen space |
| Borders | Subtle neutral 1 px boundaries, stronger contrast on inputs and focus | Defines groups and control edges without relying on shadows |
| Elevation | Mostly flat; modest shadow only for overlays and raised action surfaces | Keeps listing facts and states visually calm and easy to scan |
| Icons | Simple familiar line icons paired with text labels for meaningful states | Improves scanning while keeping meaning understandable without icon knowledge |
| Photography | Actual-item photography, consistent crop in cards, uncropped detail viewer, neutral backgrounds where possible | Supports evaluation; never substitutes stock/catalog imagery for actual-item evidence |
| Motion | Minimal, short, and nonessential; honor reduced-motion settings | Avoids distracting users during forms and deadline-sensitive actions |

Do not use green to claim an environmental outcome. A buyer's intended use is optional, private, and non-binding. Never use color alone for condition, safety, moderation, reservation, or case state.

## 3. Design foundations

All values below are **proposed starting tokens**, not accepted brand decisions. Adjust after visual review and contrast checks; changing them must not alter product semantics.

### 3.1 Tokens

| Token family | Proposed values |
| --- | --- |
| Color | `ink #17231F`; `text-muted #53615C`; `surface #FFFFFF`; `canvas #F6F5F0`; `border #D9DFDA`; `primary #176B59`; `primary-hover #105746`; `primary-soft #E7F2EE`; `attention #855600`; `attention-soft #FFF3D6`; `danger #A83232`; `danger-soft #FCE8E7`; `info #285C83`; `info-soft #EAF3FA` |
| Type | 12, 14, 16, 18, 20, 24, 30, 36 px; body 16 px / 1.5 line-height; compact metadata never below 14 px except legally/technically necessary text, which should be avoided |
| Weight | 400 body, 500 labels, 600 section headings, 700 page title or strong emphasis |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64 px |
| Radii | 6 px controls, 10 px cards, 14 px dialogs; pill only for compact status tags, not large controls |
| Borders | 1 px standard; 2 px focus/selected; avoid using border color as the only state distinction |
| Shadows | `none` for most cards; `0 4px 18px / 10% ink` for menus/dialogs; `0 1px 3px / 8% ink` for sticky action rail |
| Focus | 3 px visible outer ring in high-contrast blue/teal plus 2 px offset; never suppress browser focus without replacement |
| Touch | At least 44 × 44 CSS px target, with spacing between adjacent targets |

### 3.2 Layout and breakpoints (proposals)

Use content-first layouts and let controls wrap. Suggested breakpoints: **640 px** compact-to-wide phone; **768 px** tablet/filter-row transition; **1024 px** desktop filter rail and split panes; **1440 px** large desktop maximum content width. Validate at 320 px emergency width, 375 px phone, 768 px, 1024 px, and 1440 px. Avoid horizontal page scrolling. At 400% zoom, core flows reflow to one column; only inherently tabular evidence may scroll within a bounded region and must have a non-table alternative.

### 3.3 Accessibility requirements

Target WCAG 2.2 AA across public, participant, transaction, evidence, support, and staff workflows.

- Every flow works with keyboard only; all controls have visible focus, sensible order, and no keyboard traps. Dialogs manage focus and return it to the opener. Sticky controls must not obscure focused content.
- Use semantic landmarks, one descriptive H1, sequential headings, fieldsets/legends for grouped inputs, descriptive button/link names, and meaningful alternatives for item images. Decorative imagery is ignored by assistive technology.
- Contrast targets: normal text at least 4.5:1; large text at least 3:1; control boundaries and meaningful non-text graphics at least 3:1. Verify actual combinations, including disabled and hover states.
- Support text resizing to 200% and reflow at 400% without lost content or function. Preserve readable line lengths and do not truncate status, amount, deadline, or error text.
- Labels remain visible; requiredness and formats are written out. On submit, show a focusable error summary linking to fields, plus inline errors that explain the problem and correction. Announce asynchronous save/upload/status changes with concise live feedback.
- Status is expressed by words and, where useful, an icon; color is supplementary. Provide text equivalent for barangay maps. Gestures such as swipe have button/keyboard alternatives.
- Respect reduced motion. Do not use disappearing toast messages as the only confirmation or deadline notice.
- English is authoritative. Pair Cebuano/Bisaya translation on diagnostics, safety, offer/counteroffer/reservation/expiry, pickup/meetup, completion/final price, cancellation/rescheduling, reporting/no-show/dispute flows, and corresponding critical transactional emails. Keep the paired text associated in screen-reader reading order; have safety translations reviewed by a human.
- Authentication should support password managers and paste. Do not add cognitive puzzles as the only authentication path.

## 4. Navigation and information hierarchy

**Participant navigation proposal based on the wireframes:** signed-out header offers `Browse`, `Sign in`, and `Create listing`. Signed-in navigation has at most four destinations: `Browse`, `Activity`, `Sell`, and `Account`. Activity groups inquiries, offers, reservations, completion tasks, cases/reports, and in-app notifications; distinguish unread from action-required counts. Account includes profile, email/eligibility state, blocks, notification preferences where supported, and optional professional/business verification. Exact labels remain a usability question.

Operator navigation is a separate role-gated surface, not a participant menu item hidden only with CSS. It groups queues for held listings, verification, reports/disputes, appeals, and failed operational work only if that operator function is built; it exposes only authorized queues and records access.

| Information area | Hierarchy and privacy |
| --- | --- |
| Public browsing/search | Search title, brand, model, description, keywords; filters category, condition, barangay, listing type; sort newest. No public price filter, exact-distance filter, offer count, or popularity signal. |
| Account and verification | Account owner sees private account details and status. Email verification confirms address control only. Optional approved badge is public; application and evidence remain private. |
| Seller listing/review | Draft → type/category → identity/groups → observable diagnostics and safety/lock disclosures → location/fulfillment and description → photos/private fields → public/private review → publish/held/rejected result. |
| Buyer inquiry/negotiation | One private buyer-seller conversation per listing pair; messages and structured proposal history visible only to buyer, seller, and purpose-authorized staff. Before reservation, block exchange of phone numbers/external handles. |
| Reservation/appointment/completion | Reserved transaction private to seller, reserved buyer, and authorized staff. Show reserved price separately from any final price. Appointment is structured; chat does not change it. |
| Operator review/cases | Queue summary → authorized detail → evidence and relevant records → response → finding/action → appeal/reconsideration history. Restrict evidence and sensitive identity/location by purpose. |

## 5. Screen and flow specifications

The architecture handoff names eight screen groups. The details below decompose them into implementable screens and states. Across all screens, server authorization and explicit data projections are required; hiding a field in the client is not privacy control. Any unlisted response is an error state, not permission to infer a successful transition.

### 5.1 Account creation, eligibility, sign-in, and verification

- **Goal:** create an eligible account and verify email before publishing, inquiring, or offering.
- **Hierarchy:** display name; email/password; private date of birth; separate unchecked 18+ eligibility attestation using the exact wording/version in ADR-087; terms/privacy links; verification pending/sent/verified state. Explain that age is self-declared and email verification proves address control only.
- **Actions:** create account, sign in, resend verification, continue after verification. Secondary links to sign-in or return to the intended listing/action.
- **States:** loading while submitting; field-level and summary errors; non-enumerating generic signup/resend/reset confirmations; verification pending/delayed with safe resend; verification completion then fresh sign-in; disabled protected action until account eligibility and email verification pass. A signup DOB under 18 is rejected before account creation and discarded. Preserve return destination without prematurely submitting protected action.
- **Responsive/privacy:** single column on mobile; date of birth/email private to account owner and authorized staff only. Do not put them in URLs, public profiles, listings, or unnecessary email content. Do not design an underage-account resolution path for an existing account; that policy remains deferred. Email changes keep the old verified address active until the new address is verified, then switch atomically and require fresh sign-in (ADR-087).

### 5.2 Marketplace results, filters, and public listing detail

- **Goal:** visitors find eligible local inventory and assess only public facts.
- **Hierarchy:** keyword search; category, condition, barangay, and listing-type filters; newest sort; result count; cards. Detail page: actual photos; title/category/type; derived condition and disclosed diagnostic facts/defects; contents and known lock/battery disclosures; CDO/barangay; fulfillment availability; display name, member-since and permitted completed transaction counts; verification badge if approved; description.
- **Actions:** search, filter, clear filters, open detail, share direct link; eligible signed-in buyer may ask a question or make an offer. Listing owner sees edit/manage actions rather than buyer actions. Signed-out action continues through account/eligibility gate and returns to the listing.
- **States:** loading skeleton; no listings and no filter matches with clear reset action; search failure with retry; published/active only; removed, expired, held, paused/reserved pages give safe unavailability without exposing private workflow/demand. Disabled buyer actions explain the exact eligibility gate.
- **Responsive:** mobile filter sheet and stacked cards/detail, sticky action area that does not obscure content/focus. Desktop left filter rail and two/three-column results; detail can have content plus action rail. Preserve filter and scroll state on back.
- **Privacy:** no amounts, offer counts, demand/rank/popularity, seller expectation, exact address or point, private contact, date of birth, IMEI, messages, or moderation details. Public barangay map area is representative and has barangay text equivalent. Public detail is shareable, `noindex`, and crawler-controlled; noindex is not access control. A signed-in block hides profiles/listings mutually but does not promise signed-out invisibility.

### 5.3 Listing wizard, review, and publication outcome

- **Goal:** seller creates an evidence-rich eligible listing without guessing value or selecting a condition label.
- **Hierarchy:** six steps (wireframe proposal): (1) single item/bundle and supported category/family; (2) item identity/groups, brand/model or Unknown, age, quantities; (3) applicable diagnostics, safety, battery, lock; (4) contents, barangay, buyer pickup/meetup availability, private price expectation; (5) actual photos and description; (6) public preview, private-data summary, ownership declaration and submit. Each bundle group records condition and facts; whole-bundle offers only.
- **Actions:** back/continue, save draft and leave, add/edit bundle group, upload/remove/reorder photos, review/edit answer, submit/publish. Exact step grouping is inherited from the low-fidelity wireframe and may be adjusted for usability without changing required data or policy.
- **Validation:** at least two clear actual-item photos; no stock/catalog/screenshot-only evidence; unknown identity needs markings photo plus description when markings exist, otherwise multiple angles/descriptive facts; required category-specific disclosures; ownership declaration; safety restrictions; no exact address collected. Optional expectation is PHP and private. Optional IMEI is sensitive. For laptops use accepted diagnostic wording/rules in `docs/design/LAPTOP_DIAGNOSTICS.md`; other category question sets/safe-testing guidance remain undecided and must not be invented here.
- **States:** save/loading and last-saved; incomplete step with linked errors; photo upload progress, failure/retry/remove; validation pending; published success with public link and lifecycle next step; neutral held-for-review explanation and status; deterministically ineligible rejection with safe guidance; submit failure preserves draft. A hold is not an accusation. A moderation appeal, where applicable, shows one appeal within seven calendar days, grounds, acknowledgment/target timing, pending/decided state, and no automatic restoration.
- **Responsive:** one step per mobile view with `Step n of 6`, retained answers and safe back; desktop may use step rail and wider grouped fields. Photo upload buttons work without drag/drop. Public and private review sections are visibly separated and labeled.
- **Privacy:** public preview uses the exact public projection. Show the seller that expectation is visible only to them, and IMEI is not public; pre-reservation buyer sees only that an IMEI was provided. Full IMEI is shown to reserved buyer only after seller explicitly discloses it, otherwise seller and operationally authorized staff. No full or masked IMEI in public screens, metadata, logs, or notifications. Exact pickup details are not collected during listing.

### 5.4 Seller listing management and revision review

- **Goal:** manage availability, correct facts, respond to reports/moderation, and explicitly renew an active listing.
- **Hierarchy:** current lifecycle state, publication/expiry context, listing facts and current revision, inquiries/proposals activity available only to seller, edit/renew/remove controls, any buyer reconfirmation requirement.
- **Actions:** edit, explicitly confirm still available/accurate for renewal, remove/close as permitted, answer inquiries, handle paused offer reactivation context. After offers exist, material edit requires affected buyers to reactivate/revise/withdraw; after reservation it suspends prior appointment/terms and gives buyer 24 hours to reconfirm/revise/withdraw.
- **States:** published/active; draft; held; rejected; removed; paused by reservation; resolving existing activity at 30 days; expired after activity resolves; renewal confirmation; material edit validating; pending buyer responses; reservation reconfirmation deadline. Preserve existing proposals' fixed deadlines and reservation flow as source rules require.
- **Responsive/privacy:** mobile status-first cards; desktop history and activity columns. Seller-only expectation and proposal activity never appear in public preview or buyer view. Renewal limit/grace period and newest timestamp behavior remain open; do not invent them.

### 5.5 Private inquiry and negotiation thread

- **Goal:** ask questions and negotiate privately while preserving message/proposal history.
- **Hierarchy:** listing summary based on the revision buyer acknowledged; participant names/display names; message chronology; structured proposal cards with PHP amount, proposer, submitted/expiry times, status, optional intended use; contextual deadline and next action.
- **Actions:** eligible buyer asks question, sends private message, submits positive-amount proposal, optionally selects intended use (Reuse, Repair, Refurbish, Resell, Parts/salvage, Recycle, Other with explanation); seller replies, counters, rejects or accepts; buyer withdraws active proposal before acceptance. Counter is a fresh proposal with fixed 72-hour period. Block controls remain available.
- **States:** loading/history; empty thread; send failure/retry; proposal active, countered, withdrawn, rejected, expired, paused for material revision, accepted/reserved; blocked interaction; listing unavailable. Deadlines are fixed, PHT-aware and explained. A counter replaces current actionable proposal but not history.
- **Responsive/privacy:** chronological single column on mobile; desktop may pair thread and listing summary. Avoid wide tables. Buyer sees only their own negotiation; seller sees all negotiations in seller-only views; buyers never see another buyer identity, offer, message, count, or intended use. Pre-reservation disallow phone numbers/external handles and offer an inline explanation. Uncompleted negotiation content retention is six months after final closure (reopened workflow closure restarts that period); do not imply indefinite archive.

### 5.6 Seller private offer comparison

- **Goal:** compare independent private offers and choose based on seller preference, not automatic highest-price selection.
- **Hierarchy:** listing/revision; each buyer's display name and permitted trust context (approved verification badge, completed transaction counts in role, member-since); proposal amount and history; optional intended use; messages; fulfillment fit/context; current status and expiry; seller's private price expectation shown as a labeled personal benchmark, never asking price or Halaga estimate.
- **Actions:** open conversation, counter, reject, accept any active proposal. Acceptance confirmation explains one reservation is created, new offers stop, competing negotiations become private paused backups, and reservation is not completed sale.
- **States:** loading/empty; active/countered/expired/withdrawn/paused proposals; accepted proposal; listing revision requires buyer action; another proposal already reserved; stale-action conflict with refresh. Highest amount is not auto-selected.
- **Responsive/privacy:** stacked comparison cards on mobile; desktop comparison grid/table only if zoom-safe and an equivalent readable card list exists. This view and seller expectation are seller-only (plus authorized staff); buyers see only their own thread. Public pages never show amounts/counts.

### 5.7 Reservation overview and appointment proposal/acceptance

- **Goal:** coordinate one private buyer/seller reservation for buyer pickup or mutually agreed meetup.
- **Hierarchy:** `Reserved` state and accepted reserved price; parties; structured appointment current version/history; method; PHT date/time; exact private location; listing revision and material disclosure; appointment horizon/reschedule count; expiry at appointment +12 hours; next required action.
- **Actions:** propose/accept/revise structured appointment; cancel with reason before first completion confirmation; continue private messaging; after reservation, participants may voluntarily share contact details with warning that off-platform communication may not be available to support. Appointment proposals must meet first appointment within 7 calendar days, at most two mutually accepted reschedules, and no appointment beyond 14 days from reservation.
- **States:** awaiting appointment; proposal pending; accepted; revised; invalid date/time with rule explanation; buyer reconfirmation required after material edit (24-hour response); canceled; expired; completion started. Free-form chat does not set appointment. Expiry does not imply no-show or fault. Appointment reminder schedule/delivery is undecided; do not display an assumed reminder promise.
- **Responsive/privacy:** mobile status-first summary with one action at a time; desktop timeline plus action panel. Exact location and voluntary contact details are visible only to the reserved buyer, seller, and purpose-authorized staff. Never show in public listing, search, analytics, ordinary logs, or privacy-unsafe email. Render and enter times in Philippine Time with explicit timezone.

### 5.8 Inspection outcome and completion confirmation

- **Goal:** record whether parties completed transfer and the same final PHP price after physical inspection.
- **Hierarchy:** reserved price distinct from final price; inspection decision; final amount entry; explicit confirmation that transfer/transaction completed; counterpart response/deadline; confirmation history; support/report route when available.
- **Actions:** before confirmation, parties can proceed at reserved price, agree a different final price, or cancel. Either participant can submit completion assertion and final price. Counterpart confirms; after a mismatch each party can submit a superseding confirmation. Ordinary direct cancellation is disabled once first confirmation starts.
- **States:** ready for inspection; cancellation; pending counterpart confirmation (72 hours from first confirmation, immediate notice; reminders at 48 and 12 hours remaining while no response); mutually confirmed completed only when both assert completion at the same price; mismatch correction with fixed deadline (earlier of 120 hours after first confirmation or later of original 72-hour deadline and 48 hours after first mismatch); administrative closure after total non-response at 72 hours, not completion and no automatic case; unresolved mismatch creates support case. Keep these outcomes distinct and historical.
- **Responsive/privacy:** simple one-column mobile confirmation; desktop can show timeline and both confirmation records. Final amount is private to transaction participants and authorized staff. Do not ask or infer payment method/status; payment occurs outside Halaga and is not processed, held, verified, refunded, reversed, or guaranteed by the platform.

### 5.9 Cancellation, reservation expiry, no-show report, and appeals

- **Goal:** let either party end a reservation or report a no-show without the interface assigning blame automatically.
- **Hierarchy/actions:** cancellation requires a reason and confirmation before first completion assertion; it is immediate, notifies counterpart and remains historical. Automatic expiry occurs at appointment +12 hours if no completion started and no accepted reschedule. Separately, participant can report no-show with structured statement/evidence. Accused sees notice, response deadline, response form, one extension request before original deadline, finding, action if any, and one appeal option.
- **States:** cancel confirmation/canceled; scheduled expiry/expired; no-show case open; subject response pending; extension requested/accepted per policy; evidence review; `Substantiated`, `Unsubstantiated`, or `Inconclusive`; appeal available within seven calendar days, submitted, acknowledged within two business days, under review with five-business-day target, decided. Nonresponse is not an automatic adverse finding. Operator may impose reasoned scoped precautionary restriction before deadline when urgent; label it temporary, not a final finding.
- **Responsive/privacy:** form and evidence uploader stack on mobile; desktop may show case timeline and evidence list. Case detail is only for participants as authorized and assigned staff; case evidence must not appear in email or shared previews. Deadlines use PHT and Monday–Saturday business day calendar.

### 5.10 Material-misrepresentation and safety report flows

- **Goal:** report a material issue or safety concern with bounded evidence and route it to human review.
- **Hierarchy:** report type and subject; eligibility/timing explanation; structured written statement; allowed file types/count/size; evidence upload state; submission receipt and service target. Material-misrepresentation report is buyer-only within 48 hours after mutual completion. Safety, suspected stolen property, prohibited items, threats, harassment, fraud patterns, and account abuse follow separate reporting timing rules.
- **Actions:** select type, explain facts, attach up to 10 images (10 MB each) and up to 3 PDFs (15 MB each), optionally add external links as supplemental only, submit; subject can respond and request one two-business-day extension before initial three-business-day deadline; parties may appeal one time on accepted grounds.
- **States:** eligibility window open/closed; validation errors; upload progress, rejected type/size, quarantined/unsafe and unavailable; submitted/queued with urgency and initial review target; subject response pending; finding and proportionate permitted action; appeal pending/decision. Video/audio/archive/executable files are not accepted. Nonresponse permits review of available evidence, not automatic adverse finding.
- **Responsive/privacy:** accessible file picker and upload list; never require drag/drop. Keep original private and use metadata-stripped safe derivatives for ordinary preview. Evidence is purpose-limited, access-controlled, audited. Notifications link to authorized case views and omit evidence/needless detail. Do not suggest platform can refund, reverse payment, determine ownership/damages/liability, or guarantee final resolution.

### 5.11 Professional/business verification application

- **Goal:** apply for an optional, human-reviewed trust badge.
- **Hierarchy:** choose Business or Professional Technician; public profile fields; private evidence checklist; review status and badge meaning. Business evidence includes business name, public-facing address, official supporting record, and public contact channel; storefront/workshop photos optional. Technician evidence includes private real name/contact and evidence of actual technical work; reference/business presence encouraged when available, not an automatic disqualifier.
- **Actions:** save/submit application, withdraw while permitted, respond to correction/review request if provided by the workflow, view decision, appeal denial/revocation once within seven calendar days on accepted grounds.
- **States:** draft/submission; under human review; approved badge; rejected/withdrawn private application; re-review triggered; revoked; appeal pending/decided. State service target is initial review within two business days; this is not guaranteed final resolution.
- **Responsive/privacy:** checklist and upload list on mobile; desktop evidence/detail split. Only approved badge meaning and public profile fields appear publicly. Application, identity/contact and documents remain private, access-audited, and never embedded in notifications. Badge is not an expertise, honesty, valuation, or outcome guarantee. Evidence retention is while valid and six months after revocation, withdrawal, or account closure, subject to documented exception.

### 5.12 In-app notifications and account/profile controls

- **Goal:** see actionable state changes and manage public display profile/blocking without exposing private data.
- **Hierarchy/actions:** durable read/unread notifications with authorized links; profile display name and permitted public trust signals; block/unblock controls; account deletion request/status where eligible; optional verification entry. Blocking prevents new ordinary interactions and mutually hides profiles/future listings while signed in, but does not erase or conceal active reservation/completion/case/history. Deletion is blocked while unresolved workflows remain.
- **States:** unread/read; destination unavailable due to changed authorization; email delivery failure (domain action remains committed); deletion blocked with unresolved workflow types; deletion complete with public removal and `Deleted user` on retained transaction identity.
- **Privacy/responsive:** notifications may link to permitted private detail but reveal only recipient-authorized content. Email omits offer amounts, IMEI, exact location, unnecessary message text, and restricted evidence. Mobile list rows become cards; desktop may use a two-pane list/detail.

### 5.13 Operator queues and detail views

- **Goal:** let authorized staff handle held listings, verification, cases/evidence, findings, actions, and appeals consistently.
- **Queues:** held listings; verification applications; no-show/material-misrepresentation/safety cases; appeals. Show priority/urgency, age, status, service target, and minimal identifiers needed for triage. Do not surface sensitive evidence in queue rows.
- **Detail hierarchy:** case/review type and neutral state; trigger/reason; public candidate/listing revision; necessary restricted evidence behind explicit access; authorized relevant platform records; subject response; decision choices permitted by policy; rationale; affected participant notification preview; audit history/access trail.
- **Actions:** held listing approve reviewed revision, request/capture correction where supported, reject, remove, escalate; verification approve/reject/revoke/re-review; case find substantiated/unsubstantiated/inconclusive and record proportionate permitted action; temporary scoped restriction for urgent risk; appeal review by different operator when available, otherwise separately logged reconsideration addressing each ground. All decisions require actor, reason, state transition and audit trail.
- **States:** queue loading/empty/error; assigned/unassigned if supported; pending/overdue target; evidence unavailable/quarantined; awaiting participant response; decision draft/committed; appeal; escalated. Do not treat held as violation, expiry/cancellation as proof, or participant nonresponse as automatic adverse finding.
- **Responsive/privacy:** compact queue cards on phone; sortable table and queue/detail split at desktop, with a card alternative. Explicit purpose-gated evidence access; no copying restricted evidence into general notes/logs. Access is role-restricted and auditable. Operations coverage is 8:00–22:00 PHT daily; urgent safety initial review target is four covered hours; routine verification/dispute initial review is two business days. Present these as initial review targets, not resolution promises.

## 6. Reusable components

- **Listing card:** first actual-item photo, title, type/category, derived condition text, barangay, display name, member-since or approved badge only when applicable, listing date. Never show price, offer count, private expectation, or exact location. Bundle card shows `Bundle/lot` and `Mixed conditions` with quantity/condition summary when relevant.
- **Listing detail facts:** structured condition answer groups, known defects, missing/included items, battery/lock facts, photos, description, pickup/meetup availability, public location. Distinguish facts from derived condition and include a concise non-diagnosis explanation.
- **Condition/safety disclosure:** derived label with explanatory text; battery safety separate from battery operation; lock separate from condition; mixed condition not a fifth condition. Safety branch uses direct stop instructions and no unsafe testing suggestions. Status always has text and icon.
- **Form field/group:** persistent label, helper, required text, format example, inline error, disabled reason, appropriate autocomplete/input type; never rely on placeholder as label.
- **Photo uploader:** accessible file-picker and camera-friendly control, local preview, reorder buttons, remove action, upload progress/retry, file guidance, alt-text prompt or descriptive summary. Strip embedded location metadata before public derivatives. Do not accept stock images as item evidence.
- **Review summary:** side-by-side/labeled `Public listing preview` and `Private to you / authorized use`; explicit privacy badges and links to edit source fields. Preview must use the real public projection.
- **Proposal card:** amount formatted PHP with tabular figures; proposer, timestamp, fixed expiration, status, optional private intended-use context, actionable proposal control. No shared/public aggregate.
- **Offer comparison item:** seller-only view with offer and relevant context separated; private expectation labeled as seller's benchmark, never a Halaga estimate; no automatic highest-price emphasis.
- **Reservation/appointment summary:** reserved price, state, method, PHT date/time, action owner, deadlines, exact location only in authorized transaction context, revision/reschedule history.
- **Status indicator:** plain-language status, optional familiar icon, supplementary color; include next step and deadline where actionable. Avoid ambiguous labels like “done” when outcome is administratively closed.
- **Alert/banner:** concise heading, impact, next step, deadline if relevant. Distinguish informational, pending, safety stop, error, and success with icon/text and accessible announcement.
- **Dialog/confirmation:** use for consequential action with clear effect, cancel/back option, focus management, and explicit confirmation; do not rely on transient toast for cancellation/publication/submission.
- **Operator queue item:** urgency and age, service target, neutral case/review label, minimum needed identifier; no restricted evidence preview in queue.
- **Evidence item:** filename/type/size, upload/security processing state, safe derivative preview where authorized, original access separately permissioned, audit record.

## 7. Content and interaction rules

- Use plain, respectful English. Avoid implying a seller is careless, a device is worthless, or a held listing is wrongdoing. Pair required critical English content with human-reviewed Cebuano/Bisaya as specified in `PROJECT.md`.
- Describe observable facts: “does not power on during your check,” not “unrepairable”; “seller reports,” not “verified condition.” Never offer price estimates, appraisals, or unsupported value/environmental claims.
- Do not call the product guaranteed collection, disposal, pickup, sale, or recycling. Use “may receive offers” and “buyer pickup or mutually agreed meetup.” Shipping is not supported.
- Keep these distinct in every status and content surface: listing state; offer/proposal state; reservation; appointment; completion confirmation; completed outcome; canceled/expired; administrative closure; support case finding. Reservation is not a completed sale. Administrative closure is not completion. Expiry is not fault.
- Show who acts next, what they can do, and the relevant PHT deadline. Explain fixed proposal expiry (72 hours), appointment constraints, buyer reconfirmation (24 hours after material edit), response windows and appeal windows only in the relevant workflow.
- Use locale-aware PHP amount formatting and preserve the distinction between private seller expectation, reserved proposal amount, and mutually confirmed final price.
- Before publication and before consequential actions, explain audience and visibility of relevant fields. Privacy summaries must match actual projections. Apply the same boundaries to previews, cards, browser metadata, notifications, logs, analytics, caches, and responsive layouts.
- Email and in-app notifications must be recipient-specific. Email must omit private offer amounts, IMEI, exact locations, unnecessary message text, and restricted evidence. A failure to deliver email does not undo a committed action.
- Avoid urgency language that invents service guarantees. Operator response windows are initial-review targets. Appointment reminder timing remains undecided.

## 8. Conflicts and source authority

`PROJECT.md` states that it is authoritative for MVP behavior; `product.md` preserves original discovery and explicitly defers to `PROJECT.md`; `architecture.md` translates behavior and also defers to `PROJECT.md` and accepted ADRs. The following older product statements therefore must not be implemented as current MVP behavior:

| Topic | Older `product.md` direction | Current authoritative rule |
| --- | --- | --- |
| Condition labels | Partially Functional, Repair Needed, For Parts, End of Life | Four derived conditions: Untested/unknown, Fully functional, Functional with issues, Not functional. User answers facts; system derives label. |
| Public demand | Listing card may show current offer count | Public pages show no offer amounts, valid-offer counts, demand ranges, or popularity badges. |
| Category scope | Smartwatches, TVs, broad appliance/random electronics suggestions | Only supported categories in `PROJECT.md` section 9; constrained accessory category; standalone batteries excluded. |
| Public identity/trust | Early-stage/basic ratings may be used | No public star ratings or written reviews. Only bounded verification badge, mutually confirmed transaction counts by role, and member-since. |
| Account roles | Seller / Buyer account types; both-role allowance framed as future | One account may act as either role; Seller/Buyer are contextual roles. |
| Logistics | General marketplace examples imply broader pickup possibilities | Only buyer pickup and mutually agreed meetup; no shipping or platform logistics. |
| Routing/value | Suggested route cards or valuations appear as possible guidance | MVP has no platform-generated price/range/appraisal or authoritative disposition recommendation; intended use is optional, private, non-binding buyer context. |

No unresolved contradiction among the three current source documents changes this design. The open decisions in `PROJECT.md` section 34 and `architecture.md` section 8.2 remain open: appointment reminder policy; diagnostics and safe-testing guidance for categories beyond laptops; unsupported-category waitlist behavior; renewal limits/grace/newest timestamp; underage-account handling; and other listed operational/technical choices. This design deliberately supplies no product behavior for those items. Where the architecture lists low-fidelity six-step wizard structure or navigation labels, treat those as design proposals to validate, not new product requirements.

## 9. Open design decisions

Recommended direction is included where useful; none of these proposals are accepted product decisions.

| Decision still needed | Recommendation / note |
| --- | --- |
| Exact brand colors, logo, and visual identity | Test the proposed forest/teal + warm neutral palette with local participants; approve a brand system separately. |
| Typography and font files | Prefer a system-friendly, language-complete sans family; check Cebuano diacritics and available weights. |
| Final spacing, radius, elevation, and breakpoints | Start from section 3 tokens; validate phone, tablet, desktop, 200% zoom, and 400% reflow. |
| Final top-level navigation names and account layout | Test `Activity` comprehension; retain no more than four participant destinations unless evidence shows a need. |
| Final wizard step grouping and progressive disclosure | Validate task completion for household sellers; keep all required disclosures and public/private review. |
| Non-laptop category diagnostics and safe-testing instructions | Product decision and usability/safety validation required before those category flows are implementation-ready; do not reuse laptop rules blindly. |
| Unsupported category rejection vs request waitlist | Product decision required; do not create an implied waitlist interaction. |
| Appointment reminders | Policy is explicitly undecided; no reminder schedule or promise in design until resolved. |
| Listing renewal limit, grace period, and newest sort timestamp | Product decision required before implementing associated controls/copy. |
| Underage account handling | Product policy deferred; do not invent restriction, appeal, or deletion flow. |
| Map provider and exact map presentation | Preserve barangay-only representative map and text alternative; provider/layout can be selected later. |
| Browser support, PWA, performance, storage capacity | Operational decisions are open; this document assumes responsive web and makes no browser/PWA commitment. |
| Cebuano/Bisaya wording and translation review | Human review required, especially for safety, deadlines, and legal/policy meaning. |
| Usability validation | Test seller privacy comprehension, derived condition, reservation vs completion, price distinctions, Activity label, and operator review with representative users. |

