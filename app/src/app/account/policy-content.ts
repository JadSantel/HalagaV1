/** Review drafts only. These identifiers do not represent accepted terms or consent. */
export const accountPolicyContact = { teamBrand: "JCA", supportAndPrivacyEmail: "support@halaga.ph" } as const;

export const accountPolicyDrafts = {
  terms: {
    title: "Terms of Use",
    version: "terms-en-draft-2026-10-21",
    sections: [
      { id: "status", title: "Status and operator", paragraphs: [
        `This is a review draft for Halaga's intended MVP. ${accountPolicyContact.teamBrand} is an informal, unregistered team/brand. The team jointly decides data uses and plans for a team member to serve as Privacy Lead. The intended support and privacy email, ${accountPolicyContact.supportAndPrivacyEmail}, is still being set up. Responsible legal-operator disclosure, a correspondence address and operational privacy-request handling remain unresolved. This draft has no effective date and is not approved for real registration.`,
        "Only local account and private laptop draft testing is currently available. Use made-up information only. Email sending is disabled. The marketplace rules below describe accepted product policy for features as they become available; they do not promise that those features are already operating.",
      ] },
      { id: "eligibility", title: "Who may participate", paragraphs: [
        "Marketplace participation is for adults aged 18 or older in the Cagayan de Oro City launch market. Registration checks a private date of birth once, then discards it. Only the passed-check time and separate adult-eligibility attestation version/time are saved. Do not submit someone else's personal information or misrepresent your age.",
        "One account may act as a seller or a buyer. A seller cannot offer on their own listing. Email verification proves control of an address; it does not establish identity, ownership or device quality. Publishing, inquiries and offers require adult eligibility, verified email and the applicable action checks.",
      ] },
      { id: "security", title: "Account security", paragraphs: [
        "Use an email address you control and protect your password. Never share verification or reset links. Password reset ends all sessions. Password change requires your current password and a sign-in within the last 15 minutes; it preserves the initiating session and ends the others.",
        "An email change keeps the current address active until the proposed address is verified. Completion ends all sessions and sends a security notice to the old address when delivery is enabled. Verification and reset do not sign you in automatically.",
      ] },
      { id: "marketplace", title: "What Halaga provides", paragraphs: [
        "The MVP connects owners and potential buyers of supported electronics. It is free for sellers and buyers, without listing, offer, subscription, transaction, verification or priority-access fees.",
        "Halaga does not provide payment processing, escrow, refunds, chargebacks, shipping, platform logistics, price appraisals or guaranteed buyer interest. Buyer pickup and a mutually agreed meetup are the supported handover methods. Participants arrange payment directly.",
      ] },
      { id: "listings", title: "Accurate listings and safe items", paragraphs: [
        "Only supported device categories and their permitted accessories may be listed. Televisions, large appliances, standalone batteries and power banks are excluded. A supported device with a known hazardous battery cannot enter a normal listing. Do not open, repair, puncture or transport a hazardous battery to complete a platform check.",
        "Sellers must provide accurate descriptions, known defects, included parts, applicable lock or management status, required actual-item photos and an ownership declaration before publication. Seller answers guide a derived condition label; the label is not a professional diagnosis or guarantee. Halaga does not guarantee or assist with lock removal or run an external device-identifier blocklist check.",
        "Private draft saves do not publish an item. Incomplete or unsafe diagnostic answers may be saved privately without a derived condition. Publication has additional eligibility, evidence, safety and review requirements. Do not put private contact details, identifiers or exact pickup locations in public listing text or photos.",
      ] },
      { id: "transactions", title: "Offers, reservations and completion", paragraphs: [
        "Offers and negotiations are private to the relevant participants and purpose-authorized staff. Offer activity, amounts and competing buyers are not public demand signals. A reservation is not evidence of payment or a completed exchange.",
        "Use the recorded workflow for offer deadlines, appointment agreement, changes, cancellation and inspection. Material changes can require the buyer to review and reconfirm. A completed exchange requires both participants to confirm matching final prices; one person's confirmation alone does not establish completion.",
      ] },
      { id: "enforcement", title: "Restrictions, support and appeals", paragraphs: [
        "A scoped restriction blocks only its affected marketplace actions. Suspension blocks new marketplace activity while preserving sign-in for notices, appeals, account security and eligible deletion. Existing workflows continue under their own safeguards. Restrictions and suspension do not erase unresolved history.",
        "Human support handles the defined listing, verification, safety, no-show and material-misrepresentation cases. Findings are operational decisions, not court judgments. They do not determine legal ownership, issue refunds, award damages or establish legal liability. Eligible case, listing and verification decisions have one internal appeal within seven calendar days of notice. An appeal does not automatically lift an existing safety restriction.",
        `The intended support and privacy email is ${accountPolicyContact.supportAndPrivacyEmail}; the inbox is still being set up. The planned Privacy Lead and confidential handling process must be operational, and reporting/appeal routes established, before real participant use. These draft pages do not submit requests.`,
      ] },
      { id: "privacy", title: "Privacy, deletion and document changes", paragraphs: [
        "Read the draft Privacy Notice for data uses, visibility and retention. Eligible deletion ends sign-in and removes public content; unresolved workflows and required records follow their separate safeguards and retention limits. Deletion is not a promise to erase every record immediately.",
        "Final document wording, effective dates, change notifications and any specific consent remain publication decisions. After final document approval, signup will require a separate unchecked Terms agreement and record server-owned document versions and time. The minimal record will remain while the account is active, then be erased on eligible deletion unless a documented scoped exception applies. Viewing this draft or submitting the current local test form does not record acceptance of these terms or general privacy consent.",
      ] },
    ],
  },
  privacy: {
    title: "Privacy Notice",
    version: "privacy-en-draft-2026-10-21",
    sections: [
      { id: "status", title: "Status and responsible operator", paragraphs: [
        `This is a review draft, not an effective notice for real registration. ${accountPolicyContact.teamBrand} is an informal, unregistered team/brand whose team jointly decides data uses. A team member will serve as Privacy Lead. The intended support and privacy email, ${accountPolicyContact.supportAndPrivacyEmail}, is still being set up. Responsible legal-operator disclosure, a correspondence address and operational privacy handling remain unresolved. Use made-up information only in this local installation. Email sending is disabled.`,
        "The sections below describe the current account/private-draft implementation and accepted MVP privacy rules. Future marketplace, staff, rights-request and deletion workflows are not all implemented. Operator details, processing grounds and deployment disclosures must be finalized before real personal data is collected.",
      ] },
      { id: "account-data", title: "Account and security information", paragraphs: [
        "Registration collects a display name, email address, password and adult-eligibility attestation. A private date of birth is used once to check age 18 or older, then discarded on success and rejection. The server stores only the passed-check time and attestation version/time, not the birthday. Passwords are stored as password hashes. Dates that do not establish age 18 or older are rejected without creating an account.",
        "Account functions also use verification status, session records, essential authentication cookies, verification/reset tokens, email-change records and endpoint/IP rate-limit information. Session records may include IP address and browser information. These support sign-in, address proof, credential maintenance and abuse prevention. They do not authorize public disclosure of your email, date of birth or session information.",
        "Sessions have a seven-day lifetime and may renew during eligible activity. Choosing not to stay signed in uses a browser-session cookie. Signup compares the transient birth date with the current Philippine calendar date; later eligibility checks use the saved passed-check and attestation evidence. Marketplace action guards also check verified email and matching restrictions; suspension blocks new marketplace activity. These checks do not make an automated finding of wrongdoing or prove someone's identity or age.",
        "The processing basis and disclosures for the transient birth-date check and retained eligibility evidence still need privacy review. The earlier proposal to retain full birth dates with ongoing DOB consent/withdrawal is superseded. The adult attestation confirms eligibility; it does not silently serve as consent to every use of personal data. Viewing or acknowledging a notice is not consent to all processing. No new consent is collected through these draft pages.",
      ] },
      { id: "draft-data", title: "Private drafts and marketplace information", paragraphs: [
        "Private laptop drafts contain the details and diagnostic answers you choose to save, any private price expectation, and numbered revision history. The draft list shows only your draft's identifier, title, revision, update time and derived condition. Detailed answers and private price expectation are available in your owner-only detail view. Saving a draft does not publish it.",
        "As marketplace features become available, listing facts and approved actual-item photos form a separate public projection. Offers, messages, intended use and competing-buyer activity remain private to their workflow. Exact appointment locations are limited to the reserved participants and purpose-authorized staff. Full IMEI disclosure to a reserved buyer requires the seller's explicit disclosure; it is never public listing data.",
        "Verification evidence, reports, dispute material, restriction reasons and operator findings have restricted staff/audit purposes. Staff access must be authorized for a specific role and purpose and recorded. These draft pages do not expose that material or provide staff tools.",
      ] },
      { id: "purposes", title: "Purposes, sharing and safeguards", paragraphs: [
        "Account data supports eligibility, authentication, recovery and security notices. Draft data supports saving and resuming your work. Later marketplace records support publication, private negotiation, handover, completion and the defined safety/support workflows. These are bounded purposes, not permission for unrelated reuse.",
        "Operational logs are limited to approved fixed metadata. Credentials, tokens, date of birth, private messages, evidence and submitted draft contents must not enter general logs, public metadata, analytics or unrelated-user responses. A noindex instruction alone does not protect private data; access checks and explicit response fields do.",
        "Providers, hosting locations, processor access and any international transfers must be disclosed and reviewed before deployment. Account-email delivery uses the minimum recipient and purpose-bound content. Email failure does not undo a committed account action. No provider or overseas processing arrangement is approved by this draft notice.",
        "External disclosure in urgent cases is limited to a specific credible imminent risk of serious harm or a valid legal obligation. The procedure requires minimum necessary data, an authorized decision when practicable, and a record of the basis, recipient and disclosure. Ordinary marketplace allegations do not automatically become law-enforcement referrals.",
      ] },
      { id: "retention", title: "Retention and deletion", paragraphs: [
        "Closed-transaction records follow a 24-month retention period from terminal closure. Private content in inquiries or negotiations that close without a reservation follows six months from final closure. Reopening before deletion moves that content's start to its later final closure. These rules do not create a blanket 24-month period for every account field or unfinished draft.",
        "Password-change in-app notices last 90 days from the event or until committed account deletion. Their email recipient is erased after provider acceptance, suppression or deletion, and no later than the original seven-day delivery deadline. Password-change email metadata lasts 30 days after a terminal result, capped at 37 days from the event. These are separate clocks.",
        "Deletion eligibility preserves active listings, negotiations, reservations, appointments, cases and other unresolved workflows until safely resolved. Eligible deletion disables login, removes public content, and limits retained identity and records to their remaining required purpose. Necessary records are later deleted or irreversibly anonymized.",
        "A case-specific safety investigation or legal obligation may justify a documented, scoped retention exception. Authorized operators must record its reason, affected data, actor and review/expiry date and review it at least every 30 calendar days. History is not permission for indefinite retention.",
        "Birth dates are not retained after the signup check. Keep the minimal passed-check/attestation evidence while the account is active, then erase it on eligible deletion unless a documented scoped exception applies. Remaining account, unfinished-draft, restriction, session/rate-limit, other-email and backup retention details and execution still need verification before real data. Token expiry or a session lifetime does not by itself promise that every associated record is already physically deleted.",
      ] },
      { id: "rights", title: "Your privacy choices and rights", paragraphs: [
        "Subject to applicable law, you may request information about processing, access or correction of your data, an electronic copy where applicable, and blocking, erasure or objection where the legal conditions apply. Where processing depends on consent, its specific withdrawal route and consequences must be explained. You may raise a privacy complaint with the National Privacy Commission.",
        "The operator's verified request channel, proportionate identity-check procedure and response process remain to be supplied. Do not send identity documents or real personal data through this prototype. These pages provide information only; they do not submit a privacy or deletion request.",
      ] },
      { id: "review", title: "What must be settled before publication", paragraphs: [
        "The operator must confirm its identity and contact, the purposes and lawful grounds for each data category, any separate consent that is required, recipient and hosting/transfer details, outstanding retention periods and rights-request procedures. Final wording, effective dates and change/notification rules also need approval.",
        "The current local signup retains its existing explicit adult attestation. It does not record acceptance of this draft Privacy Notice or Terms of Use. Final notice publication and any future agreement/consent capture require their own approved wording and server checks.",
      ] },
    ],
  },
} as const;
