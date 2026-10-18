import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthPolicy } from "../auth-policy.ts";
import { createAccountFlowHandler, createAccountFlowPlugin } from "../account-flow-plugin.ts";
import { getAuthDatabase, getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { createAccountFlowOperations } from "./account-flows.ts";

/** Protected sign-in only. Never expose the raw library handler or auth.api. */
export function createAccountSignInHandler(
  database: ReturnType<typeof getPrisma>, auth: ReturnType<typeof createAccountAuth>, configuration: BetterAuthOptions,
) {
  const operations = createAccountFlowOperations(database, auth);
  return createAccountFlowHandler(betterAuth({
    ...configuration,
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    plugins: [createAccountFlowPlugin(() => operations, ["/sign-in/email"])],
  }));
}

let handler: ReturnType<typeof createAccountSignInHandler> | undefined;

export async function handleAccountSignInRequest(request: Request): Promise<Response> {
  try {
    handler ??= createAccountSignInHandler(getPrisma(), createAccountAuth(), {
      ...createAuthPolicy(process.env), database: getAuthDatabase(),
    });
    return await handler(request);
  } catch {
    return Response.json({ code: "INTERNAL_ERROR" }, { status: 500, headers: {
      "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
    } });
  }
}
