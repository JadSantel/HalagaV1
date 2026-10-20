import "server-only";

export type AccountEmailKind = "VERIFY" | "RESET" | "EMAIL_CHANGE" | "EMAIL_CHANGED" | "PASSWORD_CHANGED";
export type AccountEmailMessage = Readonly<{ to: string; subject: string; text: string; html: string }>;

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderAccountEmail(
  kind: AccountEmailKind, recipient: string, actionUrl?: string, eventTime?: Date,
): AccountEmailMessage {
  if (kind === "PASSWORD_CHANGED") {
    if (actionUrl || !eventTime || !Number.isFinite(eventTime.getTime())) throw new Error("EMAIL_TEMPLATE_INPUT_INVALID");
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", day: "2-digit", month: "short",
      year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(eventTime);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
    const timestamp = `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")}:${part("second")} PHT (UTC+08:00)`;
    const paragraphs = [`The password for your Halaga account changed on ${timestamp}.`,
      "At that time, other sessions were signed out. The session used for this change remained signed in.",
      "If you did not expect this change, open Halaga directly and use the password reset option."];
    return { to: recipient, subject: "Your Halaga password changed", text: paragraphs.join("\n\n"),
      html: `<!doctype html><html lang="en"><body>${paragraphs.map((value) => `<p>${escapeHtml(value)}</p>`).join("")}</body></html>` };
  }
  const labels: Record<Exclude<AccountEmailKind, "PASSWORD_CHANGED">, { subject: string; lead: string; action?: string; expiry?: string; tail: string }> = {
    VERIFY: { subject: "Verify your Halaga email", lead: "Confirm this email address to finish setting up your Halaga account.",
      action: "Verify email", expiry: "This link expires in 24 hours.", tail: "If you did not create this account, you can ignore this message." },
    RESET: { subject: "Reset your Halaga password", lead: "A password reset was requested for your Halaga account.",
      action: "Reset password", expiry: "This link expires in 1 hour.", tail: "If you did not request a reset, ignore this message. Your password has not changed." },
    EMAIL_CHANGE: { subject: "Confirm your Halaga email change", lead: "Confirm this address to change the email on your Halaga account.",
      action: "Confirm email change", expiry: "This link expires in 24 hours. Your current address remains active until you confirm.", tail: "If you did not request this change, ignore this message." },
    EMAIL_CHANGED: { subject: "Your Halaga email address changed", lead: "The email address on your Halaga account changed, and your existing sessions were revoked.",
      tail: "If you did not expect this change, open Halaga directly." },
  };
  const copy = labels[kind];
  if ((kind === "EMAIL_CHANGED") === Boolean(actionUrl)) throw new Error("EMAIL_TEMPLATE_INPUT_INVALID");
  const text = [copy.lead, actionUrl, copy.expiry, copy.tail].filter(Boolean).join("\n\n");
  const htmlAction = actionUrl
    ? `<p><a href="${escapeHtml(actionUrl)}">${escapeHtml(copy.action!)}</a></p><p>${escapeHtml(copy.expiry!)}</p>` : "";
  const html = `<!doctype html><html lang="en"><body><p>${escapeHtml(copy.lead)}</p>${htmlAction}<p>${escapeHtml(copy.tail)}</p></body></html>`;
  return { to: recipient, subject: copy.subject, text, html };
}
