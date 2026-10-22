import "server-only";

// Accepted prerequisites, not new policy defaults. No runtime switch can clear
// these gates before the missing contracts and their implementations are reviewed.
export const laptopSubmissionGates = [
  { code: "DECLARATION", message: "The ownership declaration is not ready. Saving or rechecking a draft does not attest ownership." },
  { code: "GEOGRAPHY", message: "CDO barangay selection is not available yet." },
  { code: "ASSESSMENTS", message: "Required publication risk and actual-item evidence assessments are unavailable. Synthetic photos cannot qualify." },
  { code: "ATOMIC_LIFECYCLE", message: "Submission safeguards are incomplete. Ownership records and publication outcomes are not yet available." },
  { code: "REVIEW_OPERATIONS", message: "The review service is not ready to receive submissions from this draft." },
  { code: "ACCOUNT_DOCUMENTS", message: "Final account documents and their required agreement capture remain pending." },
  { code: "READINESS", message: "Language, accessibility, usability and operational readiness checks remain required before pilot publication." },
] as const;
