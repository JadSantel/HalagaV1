import "server-only";
import { z } from "zod";
import type { AccountEmailMessage } from "./account-email-templates.ts";

const email = z.email();
const apiOrigin = "https://api.brevo.com/v3/smtp/email";

export class BrevoSendError extends Error {
  constructor(readonly category: "RATE_LIMIT" | "REJECTED" | "AMBIGUOUS") {
    super(category);
    this.name = "BrevoSendError";
  }
}

function config() {
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.HALAGA_EMAIL_FROM;
  if (!key || !email.safeParse(sender).success) throw new BrevoSendError("REJECTED");
  return { key, sender };
}

export async function sendBrevoEmail(message: AccountEmailMessage): Promise<string | null> {
  const { key, sender } = config();
  let response: Response;
  try {
    response = await fetch(apiOrigin, {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: sender, name: "Halaga" }, to: [{ email: message.to }],
        subject: message.subject, textContent: message.text, htmlContent: message.html,
        // No contact tracking consent is asserted; no tracking data is part of Halaga's email flow.
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new BrevoSendError("AMBIGUOUS");
  }
  if (response.status === 429) throw new BrevoSendError("RATE_LIMIT");
  if (response.status >= 500) throw new BrevoSendError("AMBIGUOUS");
  if (!response.ok) throw new BrevoSendError("REJECTED");
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "messageId" in body &&
        typeof body.messageId === "string" && body.messageId.length <= 200) return body.messageId;
  } catch {
    // A 2xx send may have been accepted even when its response body is unreadable.
    throw new BrevoSendError("AMBIGUOUS");
  }
  return null;
}

export function accountEmailActionUrl(kind: "VERIFY" | "RESET" | "EMAIL_CHANGE", token: string) {
  const rawOrigin = process.env.HALAGA_PUBLIC_ORIGIN;
  if (!rawOrigin) throw new Error("HALAGA_PUBLIC_ORIGIN_REQUIRED");
  let origin: URL;
  try { origin = new URL(rawOrigin); } catch { throw new Error("HALAGA_PUBLIC_ORIGIN_INVALID"); }
  const local = origin.hostname === "localhost" || origin.hostname === "127.0.0.1" || origin.hostname === "[::1]";
  if (!origin.origin || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      (origin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && local && origin.protocol === "http:"))) {
    throw new Error("HALAGA_PUBLIC_ORIGIN_INVALID");
  }
  const paths = { VERIFY: "/account/verify-email", RESET: "/account/reset-password", EMAIL_CHANGE: "/account/confirm-email-change" };
  return `${origin.origin}${paths[kind]}#token=${encodeURIComponent(token)}`;
}
