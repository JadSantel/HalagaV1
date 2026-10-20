import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthPolicy } from "../auth-policy.ts";
import { createAccountFlowHandler, createAccountFlowPlugin } from "../account-flow-plugin.ts";
import { getAuthDatabase, getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { createAccountFlowOperations } from "./account-flows.ts";

/** Protected password maintenance only; notice readers and raw library APIs stay private. */
export function createAccountPasswordChangeHandler(
  database: ReturnType<typeof getPrisma>, auth: ReturnType<typeof createAccountAuth>, configuration: BetterAuthOptions,
) {
  const operations = createAccountFlowOperations(database, auth);
  return createAccountFlowHandler(betterAuth({
    ...configuration,
    // The guarded operation owns stored-session freshness without rolling renewal.
    // Preserve even an unusually short-lived fresh initiating session exactly.
    session: { ...configuration.session, disableSessionRefresh: true },
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    plugins: [createAccountFlowPlugin(() => operations, ["/change-password"])],
  }));
}

let handler: ReturnType<typeof createAccountPasswordChangeHandler> | undefined;

export async function handleAccountPasswordChangeRequest(request: Request): Promise<Response> {
  try {
    handler ??= createAccountPasswordChangeHandler(getPrisma(), createAccountAuth(), {
      ...createAuthPolicy(process.env), database: getAuthDatabase(),
    });
    return await handler(request);
  } catch {
    return Response.json({ code: "INTERNAL_ERROR" }, { status: 500, headers: {
      "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
    } });
  }
}
