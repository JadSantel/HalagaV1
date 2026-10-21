import "server-only";
import { answerText, behaviorOptions, deriveCondition, questions, validateDraft, type QuestionKey } from "../domain/laptop-diagnostics.ts";
import { fulfillmentOptions } from "../domain/laptop-listing.ts";
import { validatedDraftCondition, type LaptopDraftSnapshot } from "./laptop-draft-validation.ts";

/** Owner-only review projection. Proposed content is not a public read grant. */
export function buildLaptopDraftReview(listingId: string, revision: number, currentRevision: number,
  savedAt: Date, draft: LaptopDraftSnapshot) {
  const result = deriveCondition(draft);
  const errors = validateDraft(draft);
  const editor = `/drafts/${listingId}`;
  const correction = (field: string) => {
    const diagnostic = field in questions || field.endsWith("-note") || ["behavior", "included"].includes(field);
    return `${editor}#${diagnostic && result.safety !== "clear" ? "safety" : field}`;
  };
  // Existing prototype validation includes practice-only phrasing. Keep its rules,
  // with saved-draft wording for identity and contents feedback.
  const messages: Record<string, string | undefined> = {
    title: "Enter a listing title.", brand: "Enter a brand, or write Unknown; do not guess.",
    model: "Enter a model, or write Unknown; do not guess.",
    description: "Describe the laptop, known problems and cosmetic damage.",
    included: errors.included?.includes("practice") ? "Include the laptop in this single-item listing." : errors.included,
  };
  const missingRequirements = Object.entries(errors).map(([field, message]) => ({
    field, message: messages[field] ?? message, href: correction(field),
  }));
  if (!draft.fulfillment) missingRequirements.push({ field: "fulfillment",
    message: "Choose buyer pickup, mutually agreed meetup, or both. No exact location is needed.", href: correction("fulfillment") });

  return {
    listingId, revision, currentRevision, savedAt, status: "DRAFT" as const,
    // Explicit allowlist: never spread the private draft into proposed content.
    proposedPublicContent: {
      listingType: "Single item", category: "Laptops", title: draft.title, brand: draft.brand, model: draft.model,
      description: draft.description, approximateAge: draft.approximateAge.trim() || "Unknown",
      fulfillment: fulfillmentOptions[draft.fulfillment as keyof typeof fulfillmentOptions] ?? "Not selected",
      barangay: "Not selected — controlled barangay selection is unavailable",
      diagnosticVersion: draft.diagnosticVersion,
      condition: validatedDraftCondition(draft) ? result.condition : null,
      safety: result.safety,
      reasons: result.reasons.map((reason) => ({ ...reason, href: correction(reason.field) })),
      disclosures: (Object.keys(questions) as QuestionKey[]).map((field) => ({ field,
        label: questions[field].short, value: answerText(draft, field), href: correction(field) })),
      behavior: draft.behavior.map((value) => behaviorOptions[value]), behaviorNotes: draft.behaviorNotes,
      included: [...draft.included], includedNotes: draft.includedNotes,
    },
    ownerPrivate: { privatePriceExpectation: draft.privatePriceExpectation },
    missingRequirements,
    unavailableRequirements: [
      { field: "geography", message: "Barangay is missing. Controlled CDO registry selection awaits an accepted decision; fictional practice geography cannot be used." },
      { field: "photos", message: "At least two clear actual-item photos are required. Upload, processing, metadata removal and evidence checks are unavailable. Practice images do not qualify. Unknown brand/model also requires the applicable markings or multiple-angle evidence." },
      { field: "ownership", message: "An ownership or owner-authorization declaration is required before submission. This increment does not collect it or establish proof of ownership." },
      { field: "publication-checks", message: "Publication eligibility, taxonomy, evidence, sensitive-content, risk and moderation checks have not run. Private draft access does not establish adult/email eligibility, account clearance or operational readiness for publication." },
      { field: "language", message: "Accepted English laptop prototype only. Usability validation, human-reviewed paired Cebuano/Bisaya and launch readiness remain required." },
    ],
  };
}

export type LaptopDraftReview = ReturnType<typeof buildLaptopDraftReview>;
