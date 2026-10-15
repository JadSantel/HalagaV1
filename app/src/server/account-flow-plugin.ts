import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { deleteSessionCookie, parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { z } from "zod";
import type { createAccountFlowOperations } from "./repositories/account-flows.ts";

type Operations = ReturnType<typeof createAccountFlowOperations>;
const emailInput = z.strictObject({ email: z.email() });
const proofInput = z.strictObject({ token: z.string().regex(/^[a-f0-9]{64}$/) });
const paths = ["/sign-up/email", "/send-verification-email", "/verify-email",
  "/request-password-reset", "/reset-password", "/change-email", "/confirm-email-change", "/change-password"];
const confirmation = { status: "REQUEST_RECEIVED" } as const;
const failure = (status: number) => ({ code: ({ 400: "INVALID_INPUT", 401: "UNAUTHORIZED",
  403: "FORBIDDEN", 404: "NOT_FOUND", 429: "RATE_LIMITED" } as Record<number, string>)[status] ?? "INTERNAL_ERROR" });

/** Wrap the supported handler, never auth.api. Limiter early returns skip plugin onResponse. */
export function createAccountFlowHandler(auth: { handler: (request: Request) => Promise<Response> }) {
  return async (request: Request): Promise<Response> => {
    let response: Response;
    try { response = await auth.handler(request); }
    catch { response = Response.json(failure(500), { status: 500 }); }
    const safe = response.status >= 400 ? Response.json(failure(response.status), { status: response.status }) : response;
    const retry = response.headers.get("x-retry-after");
    if (response.status === 429 && retry && /^\d+$/.test(retry)) safe.headers.set("x-retry-after", retry);
    safe.headers.set("cache-control", "no-store");
    safe.headers.set("referrer-policy", "no-referrer");
    safe.headers.set("x-content-type-options", "nosniff");
    return safe;
  };
}

/** Unmounted integration, exercised only by synthetic handlers. This is NOT token delivery.
 * Do not install in createAccountAuth or expose auth.api: see ACCOUNT_FLOW_INTEGRATION.md.
 * Core endpoint keys deliberately replace library account transactions/default tokens.
 */
export function createAccountFlowPlugin(getOperations: () => Operations) {
  const admitted = new WeakSet<Request>();
  function endpoint(path: string, run: (operations: Operations, body: unknown, headers: Headers,
    applyHeaders: (headers: Headers) => void) => Promise<{ status: string }>, revoke = false) {
    return createAuthEndpoint(path, { method: "POST", body: z.unknown(), requireHeaders: true }, async (context) => {
      // Direct auth.api calls skip the handler limiter; reject even valid bodies/headers.
      if (!context.request || !admitted.delete(context.request)) {
        context.setStatus(403);
        return context.json(failure(403));
      }
      try {
        const sessionHeaders: Headers[] = [];
        const result = await run(getOperations(), context.body, context.headers, (headers) => sessionHeaders.push(headers));
        if (revoke) deleteSessionCookie(context);
        else if (path !== "/change-password") {
          for (const headers of sessionHeaders) for (const cookie of headers.getSetCookie()) {
            parseSetCookieHeader(cookie).forEach((attributes, name) => {
              context.setCookie(name, attributes.value, toCookieOptions(attributes));
            });
          }
        }
        return context.json(result);
      } catch (error) {
        // Never serialize input, Zod issues, library/database errors or causes.
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        const status = code === "UNAUTHORIZED" ? 401 :
          ["INVALID_INPUT", "INVALID_TOKEN", "INVALID_STATE", "INVALID_PASSWORD", "ADULT_ELIGIBILITY_REQUIRED"].includes(String(code)) ||
            error instanceof z.ZodError ? 400 : 500;
        context.setStatus(status);
        return context.json(failure(status));
      }
    });
  }

  return {
    id: "halaga-account-flows",
    // Better Auth executes its endpoint/IP limiter BEFORE this supported plugin hook.
    onRequest: async (request, context) => {
      const url = new URL(request.url);
      const base = new URL(context.baseURL);
      const path = url.pathname.slice(base.pathname.replace(/\/$/, "").length);
      if (!paths.includes(path) || url.search || request.method !== "POST") {
        return { response: Response.json(failure(404), { status: 404 }) };
      }
      // Require the configured origin even without cookies. Do not infer proxy origins.
      if (request.headers.get("origin") !== base.origin) {
        return { response: Response.json(failure(403), { status: 403 }) };
      }
      admitted.add(request);
    },
    endpoints: {
      signUpEmail: endpoint("/sign-up/email", async (operations, body) => {
        await operations.signup(body);
        return confirmation;
      }),
      sendVerificationEmail: endpoint("/send-verification-email", async (operations, body) => {
        await operations.verification.issue(emailInput.parse(body).email);
        return confirmation; // Restricted issue result NEVER becomes a response.
      }),
      verifyEmail: endpoint("/verify-email", async (operations, body) => {
        await operations.verification.consume(proofInput.parse(body).token);
        return { status: "EMAIL_VERIFIED" };
      }, true),
      requestPasswordReset: endpoint("/request-password-reset", async (operations, body) => {
        await operations.reset.issue(emailInput.parse(body).email);
        return confirmation;
      }),
      resetPassword: endpoint("/reset-password", async (operations, body) => {
        await operations.reset.consume(body);
        return { status: "PASSWORD_RESET" };
      }, true),
      changeEmail: endpoint("/change-email", async (operations, body, headers, applyHeaders) => {
        await operations.emailChange.issue(headers, body, applyHeaders);
        return confirmation;
      }),
      confirmEmailChange: endpoint("/confirm-email-change", async (operations, body) => {
        await operations.emailChange.consume(proofInput.parse(body).token);
        return { status: "EMAIL_CHANGED" };
      }, true),
      changePassword: endpoint("/change-password", async (operations, body, headers, applyHeaders) => {
        await operations.passwordChange(headers, body, applyHeaders);
        return { status: "PASSWORD_CHANGED" };
      }),
    },
  } satisfies BetterAuthPlugin;
}
