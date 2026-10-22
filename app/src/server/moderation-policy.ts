import "server-only";

export const moderationReasons = {
  REQUIRED_INFORMATION: "Required listing information is missing or inconsistent. Review the marked fields, save a new revision and submit it again.",
  SAFETY_INELIGIBLE: "The disclosed item does not meet Halaga's safety requirements. Stop testing or using an item that may be hazardous. Do not relist it to bypass this decision.",
  OWNERSHIP_DECLARATION: "The required ownership declaration is missing or invalid for this revision. Complete the accepted declaration process before submitting again.",
  ACCOUNT_PUBLICATION_RESTRICTED: "Your account is currently restricted from publishing. Open your private restriction notice for its status and any available review path.",
  ORIGINAL_DECISION_CONFIRMED: "The original decision remains in effect after review of your appeal grounds. No second internal appeal is available.",
  DECISION_CORRECTED: "The decision was corrected after review of your appeal grounds. Open the listing or restriction notice to check the explicitly updated status.",
} as const;
export const moderationCopy = {
  HELD: "Your listing is awaiting review and is not public. A hold is not a finding that you broke a rule.",
  CORRECTION_REQUESTED: "Changes are needed before this review can continue. Open the decision details for the required corrections.",
  APPROVED: "Review of this listing revision is complete. Open the listing to check its current status.",
  REJECTED: "This listing revision was rejected. Open the decision details for the reason, correction guidance and appeal deadline.",
  APPEAL_RECEIVED: "Your appeal was received. We aim to acknowledge it within two business days and decide it within five business days. Current restrictions remain in place unless explicitly changed.",
  APPEAL_UNDER_REVIEW: "An operator has acknowledged your appeal and is reviewing it. Open the appeal details for its status and target date.",
  APPEAL_RESOLVED: "A decision on your appeal is available. Open the appeal details for the outcome and any next steps. There is no second internal appeal.",
} as const;
export const moderationEmail = {
  subject: "An update is available in Halaga",
  text: "An update is available in your Halaga account.\n\nOpen Halaga directly and sign in to view it and any applicable deadline.",
  html: "<p>An update is available in your Halaga account.</p><p>Open Halaga directly and sign in to view it and any applicable deadline.</p>",
};
export function elapsedDays(date: Date, days: number) { return new Date(date.getTime() + days * 86400000); }
export function moderationExpiry(date: Date) {
  const local = new Date(date.getTime() + 8 * 3600000);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + 6);
  const last = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, last));
  return new Date(local.getTime() - 8 * 3600000);
}
export function moderationBusinessTarget(date: Date, days: number) {
  const local = new Date(date.getTime() + 8 * 3600000);
  while (days > 0) { local.setUTCDate(local.getUTCDate() + 1); if (local.getUTCDay() !== 0) days--; }
  return new Date(local.getTime() - 8 * 3600000);
}
