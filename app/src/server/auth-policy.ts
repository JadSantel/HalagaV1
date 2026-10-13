import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { createAuthMiddleware, freshSessionMiddleware } from "better-auth/api";
import { z } from "zod";

const configuration = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BETTER_AUTH_URL: z.url().refine((value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
        url.pathname === "/" && !url.search && !url.hash;
    } catch {
      return false;
    }
  }),
  BETTER_AUTH_SECRET: z.string().min(32),
  // Better Auth merges this environment variable into trustedOrigins; forbid extra trust.
  BETTER_AUTH_TRUSTED_ORIGINS: z.literal("").optional(),
  // Set only after verifying that the deployment overwrites this single-IP header.
  AUTH_TRUSTED_IP_HEADER: z.string().regex(/^[a-zA-Z0-9-]+$/).optional(),
}).superRefine((value, context) => {
  let url: URL;
  try { url = new URL(value.BETTER_AUTH_URL); } catch { return; }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((value.NODE_ENV === "production" || !local) && url.protocol !== "https:") {
    context.addIssue({ code: "custom", path: ["BETTER_AUTH_URL"], message: "HTTPS required" });
  }
  if (!local || value.NODE_ENV === "production") {
    if (!value.AUTH_TRUSTED_IP_HEADER) {
      context.addIssue({ code: "custom", path: ["AUTH_TRUSTED_IP_HEADER"], message: "Deployment review required" });
    }
  }
});

/** Policy only: do not mount routes before eligibility and durable-email integration. */
export function createAuthPolicy(environment: Record<string, string | undefined>) {
  const parsed = configuration.safeParse(environment);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Invalid authentication configuration for ${fields.join(", ")}. Check app/.env.example.`);
  }
  const settings = parsed.data;
  const origin = new URL(settings.BETTER_AUTH_URL).origin;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
  const secure = settings.NODE_ENV === "production" || origin.startsWith("https:");

  return {
    baseURL: origin,
    secret: settings.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    logger: { disabled: true }, // Library errors can contain secrets; ADR-085 forbids raw logs.
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      freshAge: 15 * 60,
      disableSessionRefresh: false,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: secure,
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure, path: "/" },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      trustedProxyHeaders: false,
      // No default trust in client-supplied forwarding headers.
      ipAddress: { ipAddressHeaders: settings.AUTH_TRUSTED_IP_HEADER ? [settings.AUTH_TRUSTED_IP_HEADER] : [] },
    },
    rateLimit: {
      enabled: true,
      storage: settings.NODE_ENV === "development" && local ? "memory" : "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-up/email": { window: 15 * 60, max: 3 },
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 15 * 60, max: 3 },
        "/send-verification-email": { window: 15 * 60, max: 3 },
        // Last so explicit rules win; replaces the library's other special defaults.
        "*": { window: 60, max: 60 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (["/change-email", "/change-password"].includes(context.path)) {
          await freshSessionMiddleware(context);
        }
      }),
    },
  } satisfies BetterAuthOptions;
}
