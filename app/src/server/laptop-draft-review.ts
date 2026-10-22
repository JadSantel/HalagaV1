import "server-only";
import { answerText, behaviorOptions, deriveCondition, questions, type QuestionKey } from "../domain/laptop-diagnostics.ts";
import { fulfillmentOptions } from "../domain/laptop-listing.ts";
import { validatedDraftCondition, type LaptopDraftSnapshot } from "./laptop-draft-validation.ts";
import type { evaluateLaptopPublication } from "./laptop-publication-evaluation.ts";

/** Owner-only review projection. Proposed content is not a public read grant. */
export function buildLaptopDraftReview(listingId: string, revision: number, currentRevision: number,
  savedAt: Date, draft: LaptopDraftSnapshot, evaluation: ReturnType<typeof evaluateLaptopPublication>) {
  const result = deriveCondition(draft);
  const editor = `/drafts/${listingId}`;
  const correction = (field: string) => {
    const diagnostic = field in questions || field.endsWith("-note") || ["behavior", "included"].includes(field);
    return `${editor}#${diagnostic && result.safety !== "clear" ? "safety" : field}`;
  };
  const editable = new Set(["title", "brand", "model", "description", "fulfillment", "behavior", "behavior-note", "included", "included-note"]);
  const missingRequirements = evaluation.checks.filter((check) => check.status === "missing").map(({ field, message }) => ({
    field, message, href: editable.has(field) || field in questions || field.endsWith("-note")
      ? correction(field) : `#requirement-${field}`,
  }));
  const unavailableRequirements = evaluation.checks.filter((check) => check.status === "unavailable").map(({ field, message }) => ({ field, message }));

  return {
    listingId, revision, currentRevision, savedAt, status: "DRAFT" as const, evaluation,
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
    unavailableRequirements,
  };
}

export type LaptopDraftReview = ReturnType<typeof buildLaptopDraftReview>;
