import { z } from "zod";
import { questions, type Draft, type QuestionKey } from "./laptop-diagnostics.ts";
import type { SamplePhoto } from "./sample-laptop-photos";

// Synthetic choices only; this is not the maintained CDO geography required for launch.
export const practiceBarangays = {
  "sample-a": "Practice barangay A (fictional)",
  "sample-b": "Practice barangay B (fictional)",
  "sample-c": "Practice barangay C (fictional)",
};
export const fulfillmentOptions = {
  pickup: "Buyer pickup",
  meetup: "Mutually agreed meetup",
  both: "Buyer pickup or mutually agreed meetup",
};
export const ownershipDeclaration = "I own this item or am authorized by its owner to list and transfer it.";
export type ListingDetails = {
  approximateAge: string;
  barangay: string;
  fulfillment: string;
  ownershipDeclared: boolean;
  privatePriceExpectation: string;
};
export type LocalLaptopDraft = Draft & ListingDetails;
export const emptyListingDetails: ListingDetails = {
  approximateAge: "", barangay: "", fulfillment: "", ownershipDeclared: false, privatePriceExpectation: "",
};
export const sampleListingDetails: ListingDetails = {
  approximateAge: "About 4 years", barangay: "sample-a", fulfillment: "both",
  ownershipDeclared: true, privatePriceExpectation: "2500",
};

const detailsSchema = z.object({
  approximateAge: z.string(),
  barangay: z.enum(["sample-a", "sample-b", "sample-c"], { error: "Choose a fictional practice barangay." }),
  fulfillment: z.enum(["pickup", "meetup", "both"], { error: "Choose buyer pickup, meetup, or both." }),
  ownershipDeclared: z.literal(true, { error: "Accept the sample ownership declaration before reviewing." }),
  privatePriceExpectation: z.string().refine((value) => !value.trim() || /^\d+(\.\d{1,2})?$/.test(value.trim()),
    "Enter a made-up PHP amount with up to two decimal places, or leave it blank."),
});

export function validateListingDetails(draft: ListingDetails): Record<string, string> {
  const result = detailsSchema.safeParse(draft);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

// Shared public facts allowlist for practice previews and saved revision review.
// This does not authorize public access or clear sensitive text/evidence checks.
export function projectPublicLaptopFacts(draft: Draft & { approximateAge: string; fulfillment: string }) {
  const keys = Object.keys(questions) as QuestionKey[];
  return {
    diagnosticVersion: draft.diagnosticVersion,
    title: draft.title, brand: draft.brand, model: draft.model, description: draft.description,
    approximateAge: draft.approximateAge.trim() || "Unknown",
    fulfillment: fulfillmentOptions[draft.fulfillment as keyof typeof fulfillmentOptions] ?? "Not selected",
    answers: Object.fromEntries(keys.map((key) => [key, draft.answers[key] ?? ""])) as Draft["answers"],
    notes: Object.fromEntries(keys.filter((key) => Object.hasOwn(draft.notes, key)).map((key) => [key, draft.notes[key]])) as Draft["notes"],
    behavior: [...draft.behavior], behaviorNotes: draft.behaviorNotes,
    included: [...draft.included], includedNotes: draft.includedNotes,
  };
}

export function toPublicLaptopPreview(draft: LocalLaptopDraft, samplePhotos: readonly SamplePhoto[] = []) {
  return {
    ...projectPublicLaptopFacts(draft),
    city: "Cagayan de Oro City",
    barangay: practiceBarangays[draft.barangay as keyof typeof practiceBarangays] ?? "Not selected",
    samplePhotos: samplePhotos.map((photo) => ({ id: photo.id, label: photo.label, alt: photo.alt, src: photo.src })),
  };
}
