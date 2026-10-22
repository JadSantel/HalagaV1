import "server-only";
import { diagnosticVersion, deriveCondition, validateDraft } from "../domain/laptop-diagnostics.ts";
import { fulfillmentOptions } from "../domain/laptop-listing.ts";
import { laptopDraftSchema, type LaptopDraftSnapshot } from "./laptop-draft-validation.ts";

export const publicationEvaluationVersion = "laptop-publication-evaluation-v1";
type Assessment = "pass" | "missing" | "review" | "unavailable";
type CheckStatus = Assessment | "ineligible";
export const reviewChecks = ["classification", "hazard-signals", "device-identity", "duplicate-listings",
  "sensitive-public-text", "bundle-composition", "support-findings", "ownership-evidence"] as const;

/** Internal assessment seam, not HTTP input or a processing approval. All facts
 * must concern this exact revision. No runtime assessment provider exists yet.
 * Synthetic tests can exercise accepted rules without asserting real evidence.
 */
export type PublicationAssessments = {
  revisionId: string;
  geography?: Assessment;
  ownership?: Assessment;
  photos?: { id: string; approved: boolean; derivativeAvailable: boolean;
    kind: "actual-item" | "synthetic" | "stock" | "catalog" | "screenshot" | "unknown";
    clear: Assessment }[];
  defectCoverage?: Assessment;
  markings?: "present" | "absent" | "unknown";
  markingPhotoIds?: string[];
  differentAnglePhotoIds?: string[];
  descriptiveFacts?: Assessment;
  risk?: Partial<Record<typeof reviewChecks[number], Assessment>>;
  readiness?: Assessment;
};

export type SavedLaptopPublicationInput = {
  listingId: string; revisionId: string; revision: number;
  listingType: string; category: string; quantity: number;
  draft: LaptopDraftSnapshot; barangayCode: string | null; photoIds: string[]; ownershipDeclarationPresent: boolean;
  account: { adultEligible: boolean; emailVerified: boolean; publicationRestricted: boolean };
};

/** Pure, read-only evaluation. Fixed messages only: never serialize an assessment,
 * matched text, identifiers, staff findings, evidence or private price expectation.
 * Unavailable/unknown checks cannot be interpreted as passing.
 */
export function evaluateLaptopPublication(saved: SavedLaptopPublicationInput, supplied?: PublicationAssessments) {
  const checks: { field: string; status: CheckStatus; message: string }[] = [];
  const add = (field: string, status: CheckStatus, message: string) => checks.push({ field, status, message });
  const assessment = (value: Assessment | undefined): Assessment =>
    value && ["pass", "missing", "review", "unavailable"].includes(value) ? value : "unavailable";
  const evidence = supplied?.revisionId === saved.revisionId ? supplied : undefined;
  const draft = saved.draft;
  const supported = saved.listingType === "SINGLE_ITEM" && saved.category === "LAPTOPS" && saved.quantity === 1;
  add("taxonomy", supported ? "pass" : "unavailable", "This evaluator supports one single-item laptop only; other categories and bundles require their own validation.");
  const schemaSupported = draft.diagnosticVersion === diagnosticVersion && laptopDraftSchema.safeParse(draft).success;
  add("diagnostic-schema", schemaSupported ? "pass" : "unavailable", "Only the accepted laptop diagnostic schema can be evaluated.");
  if (schemaSupported) {
    const errors = validateDraft(draft);
    const safety = deriveCondition(draft).safety;
    const messages: Record<string, string> = {
      title: "Enter a listing title.", brand: "Enter a brand or explicit Unknown; do not guess.",
      model: "Enter a model or explicit Unknown; do not guess.",
      description: "Describe the laptop, known problems and cosmetic damage.",
      included: "Include the laptop and make the contents match the saved disclosures.",
    };
    for (const [field, message] of Object.entries(errors)) {
      if (field !== "safety") add(field, "missing", messages[field] ?? message);
    }
    add("safety", safety === "blocked" ? "ineligible" : safety === "hold" ? "review" : safety === "unanswered" ? "missing" : "pass",
      safety === "blocked" || safety === "hold" ? "Stop testing. Do not charge or handle the battery. This safety concern prevents normal publication."
        : "Answer the battery safety question before publication.");
    if (!Object.keys(errors).length) add("required-fields", "pass", "Supported saved fields and laptop disclosures are complete.");
  }
  add("fulfillment", Object.hasOwn(fulfillmentOptions, draft.fulfillment) ? "pass" : "missing",
    "Choose buyer pickup, mutually agreed meetup, or both. No exact location is needed.");
  if (!saved.barangayCode) add("barangay", "missing", "Select a controlled CDO barangay when selection is available.");
  add("geography", assessment(evidence?.geography), "Controlled CDO geography validation awaits an accepted registry and implementation (ADR-094).");
  if (!saved.ownershipDeclarationPresent) add("ownership-declaration", "missing", "An ownership or owner-authorization declaration must be recorded for this saved revision. Capture is unavailable in this increment.");
  add("ownership", assessment(evidence?.ownership), "A versioned seller ownership or owner-authorization declaration is required for this revision. It is not proof of ownership.");
  add("adult-eligibility", saved.account.adultEligible ? "pass" : "missing", "Adult eligibility evidence is required before publication.");
  add("email-verification", saved.account.emailVerified ? "pass" : "missing", "A verified account email is required before publication.");
  add("account-clearance", saved.account.publicationRestricted ? "review" : "pass", "Publication requires account review. No operator request has been created.");

  const photos = evidence?.photos ?? [];
  const memberIds = new Set(saved.photoIds);
  const qualifying = new Set(photos.filter((photo) => memberIds.has(photo.id) && photo.approved &&
    photo.derivativeAvailable && photo.kind === "actual-item" && photo.clear === "pass").map((photo) => photo.id));
  const ambiguous = photos.some((photo) => memberIds.has(photo.id) && photo.approved && photo.derivativeAvailable &&
    (photo.kind === "unknown" || photo.clear === "review"));
  add("photos", qualifying.size >= 2 ? "pass" : ambiguous ? "review" : "missing",
    "At least two distinct clear actual-item photos are required. Synthetic, stock, catalog and screenshot images cannot count; processing approval alone proves neither identity nor clarity.");
  const photoAssessmentUnavailable = !evidence?.photos || [...memberIds].some((id) => {
    const entries = photos.filter((photo) => photo.id === id);
    return entries.length !== 1 || assessment(entries[0].clear) === "unavailable" ||
      !["actual-item", "synthetic", "stock", "catalog", "screenshot", "unknown"].includes(entries[0].kind);
  });
  add("photo-assessment", photoAssessmentUnavailable ? "unavailable" : "pass", "Actual-item identity and clarity assessment is unavailable in the synthetic photo pipeline.");
  if (ambiguous) add("photo-evidence", "review", "Photo evidence requires human review. Ambiguity does not establish a violation.");
  add("visible-defects", assessment(evidence?.defectCoverage), "Known visible defects must not be intentionally omitted from photo evidence.");
  if ([draft.brand, draft.model].some((value) => value.trim().toLowerCase() === "unknown")) {
    const distinctQualifying = (ids: string[] = []) => new Set(ids.filter((id) => qualifying.has(id))).size;
    const state = evidence?.markings;
    add("unknown-identity", state === "present" ? (distinctQualifying(evidence?.markingPhotoIds) >= 1 ? "pass" : "missing")
      : state === "absent" ? (distinctQualifying(evidence?.differentAnglePhotoIds) >= 2 ? "pass" : "missing")
        : state === "unknown" ? "review" : "unavailable",
    "Unknown brand/model requires a clear markings photo when markings exist; otherwise provide multiple clear angles. This supplements the two-photo minimum.");
    add("identifying-description", assessment(evidence?.descriptiveFacts), "Unknown brand/model requires sufficient observable descriptive facts; do not guess identity.");
  }
  // Do not reveal which private finding triggered review, or echo its contents.
  const riskStatuses = reviewChecks.map((field) => assessment(evidence?.risk?.[field]));
  if (riskStatuses.includes("unavailable")) add("publication-checks", "unavailable",
    "Sensitive public text, hazard signals, identity, duplicate/manipulative listings, classification, bundle and private evidence/support checks require documented detection rules and authorized assessment paths. No external identifier check or automated ownership verification occurs.");
  if (riskStatuses.includes("missing")) add("publication-requirements", "missing", "Required publication assessments are incomplete.");
  if (riskStatuses.every((status) => status === "pass")) add("publication-checks", "pass", "All required review assessments are complete without a trigger.");
  if (riskStatuses.includes("review")) add("publication-review", "review",
    "This revision requires private publication review. No violation is established and no review request has been created.");
  add("readiness", assessment(evidence?.readiness), "English laptop usability validation, human-reviewed paired Cebuano/Bisaya and operational/publication readiness remain required. Synthetic draft access grants no publication permission.");
  const status = checks.some((check) => check.status === "ineligible") ? "ineligible"
    : checks.some((check) => check.status === "review") ? "review-required"
      : checks.some((check) => check.status === "missing") ? "incomplete"
        : checks.some((check) => check.status === "unavailable") ? "unavailable" : "eligible";
  return { policyVersion: publicationEvaluationVersion, listingId: saved.listingId, revision: saved.revision,
    status, eligible: status === "eligible", checks };
}
