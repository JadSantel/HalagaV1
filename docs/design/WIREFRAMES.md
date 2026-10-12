# Halaga MVP Mobile-First Wireframes

- Status: Low-fidelity interaction specification
- Scope: Critical marketplace, transaction, evidence, and operator flows
- Last updated: 2026-10-11
- Product authority: `PROJECT.md`
- Architecture context: `architecture.md`

## 1. Purpose

These wireframes validate information hierarchy, privacy boundaries, state comprehension, responsive behavior, and accessibility before visual design or implementation begins. They are not a final brand system and do not select a frontend stack.

The provisional visual direction is restrained, high-contrast, and trust-oriented. The wireframes use one primary action per view, explicit status text, cards rather than wide tables on mobile, and minimal non-essential motion.

Exact category-specific diagnostic wording remains deferred except for the accepted English-language laptop prototype in `docs/design/LAPTOP_DIAGNOSTICS.md`. The listing wireframes specify the shared question behavior without inventing the remaining category sets.

Laptops are the accepted reference category for the first diagnostic-question prototype, moderated usability test, and thin end-to-end implementation slice. Other approved MVP categories remain in scope and require their own validated question sets before pilot launch.

## 2. Shared interaction model

### 2.1 Mobile navigation

Signed-out visitors use a compact header with `Browse`, `Sign in`, and `Create listing`. Signed-in participants use at most four top-level destinations:

1. Browse
2. Activity
3. Sell
4. Account

`Activity` contains inquiries, offers, reservations, completion tasks, reports, and notifications. Unread or required-action counts use a numeric badge plus an accessible contextual announcement such as “Activity, 2 items need action.”

Operator tools use a separate role-gated entry and navigation hierarchy. They are never exposed merely by hiding links in the participant interface.

### 2.2 Shared page anatomy

```text
┌──────────────────────────────────┐
│ Skip to main content             │
│ Halaga                 [Account] │
├──────────────────────────────────┤
│ Breadcrumb or Back + page title  │
│ Status / deadline banner         │
│                                  │
│ Main content                     │
│                                  │
│ [Secondary]       [Primary CTA]  │
├──────────────────────────────────┤
│ Browse  Activity  Sell  Account  │
└──────────────────────────────────┘
```

Rules:

- Browser Back restores prior scroll, filters, and draft state.
- Route changes move screen-reader focus to the main heading.
- A sticky mobile action bar reserves content space and never covers the focused control.
- Every status uses text and, where helpful, an icon; color is supplementary.
- All prices use locale-aware PHP formatting and tabular figures.
- All deadlines state the PHT date, time, and remaining duration.
- Critical transactional English is paired with the required Cebuano/Bisaya translation.

### 2.3 Forms and errors

- Inputs have persistent visible labels and helper text.
- Required fields are identified in text, not only with an asterisk.
- Validation normally occurs on blur and again on submit.
- Failed multi-field submission places keyboard focus on a top error summary whose entries link to the invalid fields.
- Inline errors remain beside fields and state both the problem and recovery action.
- Long forms auto-save drafts and show last-saved state without interrupting input.
- Destructive or irreversible actions require an explicit confirmation view, not a transient toast.

## 3. Marketplace browsing and listing detail

### 3.1 Browse results — mobile

```text
┌──────────────────────────────────┐
│ Halaga                    Sign in│
│ Find unwanted electronics       │
│ [ Search title, brand, model   ] │
│ [Filters 3]        [Newest  v]   │
├──────────────────────────────────┤
│ 24 listings                     │
│ ┌────────┐ Dell Inspiron 15     │
│ │ photo  │ Functional w/ issues │
│ │        │ Carmen · Single item │
│ └────────┘ Listed Oct 11         │
│                                  │
│ ┌────────┐ Mixed computer lot   │
│ │ photo  │ Mixed conditions     │
│ └────────┘ Lapasan · Bundle/lot  │
│                                  │
│            [Load more]           │
└──────────────────────────────────┘
```

Privacy checks:

- No offer count, offer amount, popularity indicator, seller expectation, exact location, or precise map point.
- Cards expose only the approved public projection.
- Search suggestions never reveal private or held listings.

Responsive behavior:

- At 768 px, filter controls may become a persistent row.
- At 1024 px and above, filters use a left rail and results use a two- or three-column grid.
- The same result order and filter meaning are preserved across layouts.

### 3.2 Filter sheet — mobile

```text
┌──────────────────────────────────┐
│ Filters                  [Close] │
├──────────────────────────────────┤
│ Category                         │
│ [Choose categories]              │
│                                  │
│ Condition                        │
│ [ ] Fully functional             │
│ [ ] Functional with issues       │
│ [ ] Not functional               │
│ [ ] Untested/unknown             │
│                                  │
│ Barangay       [Choose]          │
│ Listing type   [Any          v]  │
│                                  │
│ [Clear]          [Show 24 items] │
└──────────────────────────────────┘
```

The filter opens as a page or accessible dialog with trapped focus, a clear close action, and focus returned to the invoking button. Condition is multi-select. A mixed-condition bundle matches when any included item has a selected condition; explanatory text appears beside the filter help control.

### 3.3 Public listing detail — mobile

```text
┌──────────────────────────────────┐
│ ‹ Results            [Share]     │
│ [ actual item photo 1 of 4 ]     │
│                                  │
│ Dell Inspiron 15                 │
│ Functional with issues           │
│ Single item · Carmen, CDO        │
│                                  │
│ Condition facts                 │
│ • Powers on                     │
│ • Display works                 │
│ • Keyboard has failed keys      │
│ • Battery condition unknown     │
│ • Lock status: No known lock    │
│                                  │
│ Included / missing              │
│ Charger included · Battery built-in│
│                                  │
│ Seller                          │
│ Alex R. · Member since 2026     │
│ 2 completed as seller           │
│                                  │
│ Pickup / meetup availability    │
│ Buyer pickup · Agreed meetup    │
│                                  │
│ [Ask a question] [Make an offer]│
└──────────────────────────────────┘
```

The seller's own view replaces buyer actions with `Edit listing` and `Manage offers`. Signed-out action attempts preserve the return URL through registration and eligibility checks.

The photo viewer supports buttons, keyboard navigation, swipe as an additional—not exclusive—gesture, meaningful alternatives, and a stable reserved aspect ratio.

## 4. Listing creation

### 4.1 Wizard structure

```text
1 Type & category
2 Item identity
3 Condition & safety
4 Contents & fulfillment
5 Photos & description
6 Review & publish
```

Mobile shows `Step n of 6` plus the current step name rather than six cramped labels. Desktop may show the full step list in a side rail. Back navigation retains answers. Leaving offers `Save draft and leave`; an unsaved destructive exit requires confirmation.

### 4.2 Type and category

```text
┌──────────────────────────────────┐
│ Create listing        Step 1 of 6│
│ What are you listing?            │
│                                  │
│ ( ) Single item                  │
│     One physical item            │
│                                  │
│ ( ) Bundle / lot                 │
│     Multiple items sold together │
│                                  │
│ Category                         │
│ [Choose a supported category  v] │
│                                  │
│ Bundle family (when applicable)  │
│ [Computed / choose valid family] │
│ All offers cover the whole bundle│
│                                  │
│ [Save & leave]        [Continue] │
└──────────────────────────────────┘
```

Unsupported categories do not get silently mapped to `Accessories & Small Electronics`. The eventual rejected-versus-waitlist behavior remains deferred.

### 4.3 Item identity and group editor

```text
┌──────────────────────────────────┐
│ Create listing        Step 2 of 6│
│ Describe item 1                  │
│ Item name [                    ] │
│ Brand     [Known v] [          ] │
│ Model     [Known v] [          ] │
│ Quantity  [1]                    │
│ Approx. age [Unknown v]          │
│                                  │
│ If Unknown:                      │
│ Identification evidence required │
│ [Add markings photo]             │
│ [Describe identifying details]   │
│                                  │
│ Bundle only: [Add another group] │
│                                  │
│ [Back]                [Continue] │
└──────────────────────────────────┘
```

Each group in a bundle remains independently editable and exposes its own condition result later. Reordering is available through `Move up` and `Move down` buttons, not drag alone.

### 4.4 Condition and safety questions

```text
┌──────────────────────────────────┐
│ Create listing        Step 3 of 6│
│ Check what you can observe       │
│ Dell Inspiron 15                 │
│                                  │
│ Testing guidance (English)       │
│ Giya sa pagsulay (Cebuano)       │
│ [Show safe testing steps]        │
│                                  │
│ [Laptop questions use accepted  │
│  diagnostic prototype]           │
│ Each answer includes:            │
│ • Yes / No / Could not test      │
│ • “How to check” help            │
│ • “Do not test” safety branch    │
│ • optional defect detail         │
│                                  │
│ Battery condition                │
│ ( ) No known safety issue        │
│ ( ) Unknown                      │
│ ( ) Swollen/leaking/hot/damaged  │
│                                  │
│ Lock / management status         │
│ [Structured answer          v]   │
│                                  │
│ Derived result                   │
│ Functional with issues           │
│ Based on your answers; not a     │
│ professional diagnosis.          │
│ [Back]                [Continue] │
└──────────────────────────────────┘
```

Condition-design requirements:

- Questions ask observable facts, never “Is it repairable?” or “Is it for parts?”
- `Could not test` remains available and is not treated as failure.
- The derived label updates as answers change and explains which facts produced it.
- The seller cannot override the label; `Change answers` links back to the relevant question.
- Safety branches stop unsafe testing and provide safe guidance. A known hazardous battery blocks ordinary publication.
- Lock status is prominent, structured, and visible in review and public listing projections.
- Laptop wording and branching follow `LAPTOP_DIAGNOSTICS.md`; remaining categories require later accepted product/design decisions.

### 4.5 Photos, IMEI, and public/private review

```text
┌──────────────────────────────────┐
│ Review listing        Step 6 of 6│
│ What everyone will see           │
│ [Public listing preview]         │
│ Barangay only · Public photos    │
│                                  │
│ Private to you / authorized use  │
│ Price expectation: ₱1,500        │
│ IMEI provided: Yes               │
│ Exact address: Not collected     │
│                                  │
│ Required declarations            │
│ [ ] I own this item or am        │
│     authorized to transfer it.   │
│                                  │
│ [Back]          [Publish listing]│
└──────────────────────────────────┘
```

Public and private sections are spatially separated and explicitly labeled. The public preview is rendered from the actual public projection. It never receives the private expectation or full IMEI.

### 4.6 Publication outcomes

- **Published:** confirmation, public link, expiry date, and next steps.
- **Held for review:** neutral language, reason category, what happens next, and no implication of wrongdoing.
- **Rejected:** specific ineligibility, safe next step, and correction path where allowed.
- **Upload/processing pending:** draft remains non-public; progress and retry are visible.

## 5. Inquiry and private negotiation

### 5.1 Buyer conversation — mobile

```text
┌──────────────────────────────────┐
│ ‹ Listing      Dell Inspiron 15  │
│ Private conversation with Alex R.│
│ [Listing changed — review facts] │
├──────────────────────────────────┤
│ Alex: Battery condition unknown. │
│ You: Does it stay on when plugged│
│      in?                          │
│                                  │
│ ┌ Your active offer ───────────┐ │
│ │ ₱1,800 · expires in 46h      │ │
│ │ Intended use: Refurbish      │ │
│ │ [Withdraw]                   │ │
│ └──────────────────────────────┘ │
│                                  │
│ [Message seller…              ] │
│ [Send]                           │
│ [Make / revise offer]            │
└──────────────────────────────────┘
```

Privacy text states that only this buyer and the seller can see the conversation and proposal history. Before reservation, attempted contact details receive inline guidance and are not sent. Proposal countdowns include an exact PHT deadline.

Material edits place a blocking review card before new proposals or messages that imply acceptance. The buyer must open the changed facts and choose `Reactivate same offer`, `Revise offer`, or `Withdraw`.

### 5.2 Proposal form

```text
Amount in PHP (required) [ 1,800 ]
Intended use (optional)  [Refurbish v]
Message (optional)       [             ]

Your amount and message are private to you
and the seller. Other buyers cannot see them.

This proposal expires Oct 14, 4:20 PM PHT.
[Cancel]                         [Submit]
```

The amount uses a numeric keyboard but accepts accessible paste and editing. The interface never claims the proposal is a bid in a public auction.

## 6. Seller offer comparison

### 6.1 Mobile cards

```text
┌──────────────────────────────────┐
│ Offers for Dell Inspiron 15      │
│ Your private expectation ₱1,500  │
│ Only you can see all offers.     │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ CDO Tech · Verified Business│ │
│ │ ₱1,800 · expires in 46h     │ │
│ │ Refurbish · Buyer pickup     │ │
│ │ 8 completed as buyer        │ │
│ │ [Open] [Counter] [Accept]   │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Jamie P.                    │ │
│ │ ₱2,000 · expires in 61h     │ │
│ │ Intended use not provided   │ │
│ │ [Open] [Counter] [Accept]   │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

Cards are not ranked as “best,” and the highest amount is not automatically preferred. Sorting may be by newest proposal or amount as a private seller tool, but the current sort is announced and never changes acceptance rules.

Accept opens a confirmation page naming the buyer, reserved price, effects on other negotiations, inspection requirement, and cancellation rules. The server revalidates the proposal on confirmation.

### 6.2 Desktop comparison

Desktop may use a comparison grid only when each row remains readable at 200% zoom. Essential action buttons and buyer identity stay in the first visible columns. At narrower widths or increased zoom, it collapses to the same cards as mobile rather than forcing horizontal page scroll.

## 7. Reservation and appointment

### 7.1 Reservation overview

```text
┌──────────────────────────────────┐
│ Reserved · inspection pending    │
│ Reserved price: ₱1,800           │
│ Alex R. ↔ CDO Tech               │
├──────────────────────────────────┤
│ Next step                        │
│ Agree on pickup or meetup        │
│ First appointment must be within │
│ 7 days. Reservation ends after   │
│ 14 days at the latest.           │
│                                  │
│ [Propose appointment]            │
│                                  │
│ Private messages                 │
│ [Open conversation]              │
│                                  │
│ [Cancel reservation]             │
└──────────────────────────────────┘
```

### 7.2 Appointment proposal

```text
Method (required)
( ) Buyer pickup  ( ) Agreed meetup

Date (PHT) [ Oct 15, 2026 ]
Time (PHT) [ 2:00 PM       ]
Private location details
[ Building / landmark / instructions ]

Only the reserved buyer, seller, and authorized
staff can access these details.

Appointment must fall within the allowed horizon.
[Cancel]                       [Propose]
```

The receiving participant sees a read-only summary and chooses `Accept` or `Propose changes`. Accepting a revised appointment increments the reschedule count. The view shows `Reschedule 1 of 2 used` and the absolute 14-day limit. Free-form times in chat are visually labeled “Not the agreed appointment.”

After acceptance, the status view shows the exact appointment, the expiry threshold 12 hours later, safety guidance, and actions to reschedule or cancel.

## 8. Inspection and completion

### 8.1 Record outcome

```text
┌──────────────────────────────────┐
│ What happened at inspection?     │
│ Reserved price: ₱1,800           │
│                                  │
│ ( ) Completed at reserved price  │
│ ( ) Completed at another price   │
│ ( ) Did not complete             │
│                                  │
│ Final price [₱ 1,800]            │
│ [Continue]                       │
└──────────────────────────────────┘
```

`Did not complete` routes to cancellation while cancellation remains permitted. Completion review repeats that payment occurred outside Halaga and asks the participant to confirm both transfer and the exact final price.

### 8.2 First confirmation review

```text
You are confirming:
• The item was transferred.
• The transaction completed.
• The final price was ₱1,800.

The other participant must independently confirm.
After this, ordinary cancellation is unavailable.

[Back]                  [Submit confirmation]
```

### 8.3 Waiting, match, and mismatch states

- **Waiting:** exact original 72-hour deadline, immediate-notice status, and scheduled reminder explanation.
- **Matched:** completion timestamp, final price, and 48-hour buyer dispute window.
- **Mismatch:** both submitted amounts shown to the participant within the shared transaction, correction deadline, `Correct my confirmation`, and `Report a problem`.
- **Total non-response:** administrative closure explanation that it is not completion and no support case was automatically created.
- **Unresolved mismatch:** support-case link and explanation that the transaction is not completed.

Corrections create a new confirmation; the interface labels earlier entries as superseded rather than deleting them.

## 9. Cancellation, reports, and evidence

### 9.1 Cancel reservation

The confirmation view explains the immediate effect, requires a reason, and clearly states that cancellation alone is not a misconduct finding. After cancellation, it shows whether the listing reopened and that backup offers do not resume automatically.

### 9.2 Choose report type

```text
┌──────────────────────────────────┐
│ Report a problem                 │
│ What best describes the issue?   │
│                                  │
│ [No-show at agreed appointment]  │
│ [Item materially misrepresented] │
│ [Safety or hazardous item]       │
│ [Suspected stolen property]      │
│ [Threats or harassment]          │
│ [Fraud or account abuse]         │
│                                  │
│ Not sure? [See examples]         │
└──────────────────────────────────┘
```

Material-misrepresentation is shown only to the buyer during its 48-hour eligibility window. Other safety/account reports remain available outside that window.

### 9.3 Evidence form

```text
Your statement (required)
[ What happened, when, and why it matters… ]

Images              3 of 10 · 10 MB each
[thumbnail] [thumbnail] [Add images]

PDF documents       0 of 3 · 15 MB each
[Add PDF]

Supplemental links
[Add link]

Already attached from Halaga
• Appointment version 2
• Listing revision accepted by buyer
• Completion confirmations

[Save draft]                 [Submit case]
```

Rejected/quarantined files remain visible with a specific reason and replacement action. Upload progress is per file. The form does not imply external links have been preserved. Video, audio, archives, and executables are identified as unsupported before file selection where the browser permits.

### 9.4 Response, decision, and appeal

The accused view presents allegations, accessible evidence, notice timestamp, original response deadline, and `Request two-business-day extension`. The extension control disappears after use or the original deadline. Silence is never labeled admission.

Decision view includes:

- Finding: Substantiated, Unsubstantiated, or Inconclusive
- Plain-language reasons and evidence relied upon
- Separate platform actions and their duration/scope
- Statement of Halaga's limited authority
- Appeal deadline and qualifying grounds

Appeal is a full page rather than a modal. It shows each allowed ground as a selectable field with explanation and accepts evidence under the same limits. It states whether existing safety restrictions remain active.

## 10. Operator workflows

### 10.1 Queue dashboard

```text
┌──────────────────────────────────────────────────┐
│ Operator queues                                  │
│ [Urgent safety 2] [Held 7] [Cases 4] [Verify 3] │
│ [Appeals 1] [Due soon 5]                         │
├──────────────────────────────────────────────────┤
│ Priority | Age/SLA | Type | Subject | Trigger    │
│ Urgent   | 1h 12m  |Safety| Listing | Battery   │
│ Routine  | 8h      |Held  | Listing | Category  │
└──────────────────────────────────────────────────┘
```

Urgency, deadline, and status never rely on color alone. Queue filters and sort state are URL-addressable. The dashboard exposes the least information required for triage; restricted evidence appears only after opening an authorized case.

### 10.2 Held-listing review

The review page separates:

1. Public-candidate listing projection
2. Validation triggers
3. Restricted evidence, collapsed until purpose-confirmed access
4. Revision and prior decision history
5. Decision form with required reason

Available outcomes reflect policy: approve the reviewed revision, capture/request correction, reject, remove, or escalate. Approving states exactly which revision will publish. `Held for review` is described neutrally.

### 10.3 Verification review

Business and technician applications use distinct evidence checklists. The operator compares claimed public profile fields with private evidence, records an approval/rejection/re-review decision and reasons, and previews exactly what badge/profile data becomes public. Evidence-retention timing is visible when a badge is withdrawn or revoked.

### 10.4 Case and appeal review

The case view presents an ordered timeline of report, notice, response deadline, extension, participant statements, internally attached records, evidence access, temporary restrictions, finding, actions, and appeal. Original files require an explicit open/download action that is audited.

The decision form requires finding, reasons, evidence relied upon, and separate proportional actions. Appeal review addresses each submitted ground. If the original operator must reconsider, the interface labels this and requires a new review entry rather than editing the first decision.

## 11. Responsive validation

| Area | Mobile default | Desktop adaptation | Failure to avoid |
| --- | --- | --- | --- |
| Browse | One-column cards; filter sheet | Filter rail plus card grid | Hidden filters or changed result semantics |
| Listing wizard | One step per page | Step rail plus bounded form column | Very wide fields or side-by-side questions with ambiguous order |
| Conversation | Single timeline | Timeline plus listing summary rail | Separate scroll traps or hidden proposal state |
| Offer comparison | Stacked buyer cards | Comparison grid when zoom-safe | Wide table requiring page-level horizontal scrolling |
| Reservation | Status-first single column | Status/timeline plus actions rail | Exact location appearing in shared/public summary |
| Operator | Queue cards on narrow viewport | Sortable table and detail split view | Triage rows containing unnecessary sensitive evidence |

Required layout checks: 320 px emergency minimum, 375 px primary phone, 768 px tablet, 1024 px small desktop, and 1440 px large desktop. At 400% browser zoom, core workflows must reflow without two-dimensional scrolling except for intrinsically tabular evidence where an accessible alternative is provided.

## 12. Accessibility validation matrix

| Requirement | Design acceptance check |
| --- | --- |
| Keyboard | Every action, disclosure, file control, carousel, and dialog works without a pointer; no traps |
| Focus | Visible indicator; route-change focus; dialog return focus; sticky UI never fully obscures focus |
| Structure | One descriptive page heading; sequential headings; fieldsets and legends for grouped choices |
| Errors | Linked focusable summary plus retained inline messages; errors announced without repeated interruption |
| Status | Async save, upload, proposal, deadline, and state changes use concise live announcements |
| Touch | Primary targets are at least 44 by 44 CSS px with at least 8 px separation |
| Text resize | No clipped status chips, prices, deadlines, or actions at 200%; reflow checked at 400% |
| Color | Normal text at least 4.5:1; UI boundaries and meaningful icons at least 3:1; text/icons supplement state colors |
| Images | Item photos have seller-provided or generated descriptive alternatives; decorative imagery is ignored |
| Maps | Barangay map always has equivalent barangay text; appointment location never requires map use |
| Language | English and required Cebuano/Bisaya pairs remain associated and do not break reading order |
| Timing | Deadlines are explained; session behavior does not erase drafts; no critical action depends on a fleeting toast |
| Motion | Non-essential motion disabled under reduced motion; correctness never depends on animation completion |
| Authentication | Paste, password managers, and accessible non-cognitive authentication paths remain available |

## 13. Review findings and open design decisions

### Validated by this low-fidelity pass

- Public browsing can remain useful without exposing marketplace demand.
- Public/private review is necessary during listing creation, not only after publication.
- Condition must be displayed as a derived explanation adjacent to its source answers.
- Offer comparison should use cards on mobile and treat amount as one factor among several.
- Reservation, appointment, and completion require separate status views and actions.
- Total non-response and mismatched confirmation need visibly different terminal/escalation paths.
- Case evidence and operator access need separate original, derivative, and platform-record treatments.

### Still requires a decision or usability test

- Exact laptop diagnostic questions and safe testing instructions, followed by the remaining supported category sets.
- Unsupported-category rejection versus request waitlist.
- Appointment reminder schedule.
- Listing renewal limits, grace period, and newest-sort behavior.
- Formal moderation and verification appeals.
- Final participant navigation labels and whether `Activity` is understood without onboarding.
- Whether sellers can accurately distinguish public and private fields in moderated usability testing.
- Whether users understand reservation versus completed sale and reserved versus final price.

## 14. Usability-test script

Test with representative household sellers, individual buyers, electronics buyers, and the pilot operator. Do not coach unless the participant is blocked.

1. Create a damaged-laptop listing without choosing a condition label directly.
2. Identify what information will be public and whether the IMEI or expectation is public.
3. As a buyer, ask a question and submit a private offer.
4. As the seller, compare two offers and explain what the other buyers can see.
5. Reserve one offer and arrange a permitted appointment.
6. Explain the difference between reserved price, final price, and completed transaction.
7. Submit one completion confirmation, then resolve a mismatched amount.
8. Report a material problem with an image and identify the response/appeal deadlines.
9. As operator, resolve a held listing and identify which evidence access is audited.

Observe completion, errors, hesitation, privacy misconceptions, backtracking, and requests for help. Repeat keyboard-only, screen-reader, 200% zoom, 400% reflow, narrow-phone, landscape, and desktop checks. Record failures as design findings; do not redefine product policy inside a prototype.
