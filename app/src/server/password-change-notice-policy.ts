import "server-only";

// ADR-089: elapsed durations, original event clock; never reset on retry/cleanup.
const day = 24 * 60 * 60 * 1000;
export const passwordChangeEmailEvent = "account.password-changed-security-notice";
export const passwordChangeDeliveryMs = 7 * day;
export const passwordChangeMetadataMs = 30 * day;
export const passwordChangeMetadataCapMs = 37 * day;
export const passwordChangeNoticeMs = 90 * day;
