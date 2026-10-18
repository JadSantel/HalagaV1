import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthPolicy } from "../auth-policy.ts";
import { createAccountFlowHandler, createAccountFlowPlugin } from "../account-flow-plugin.ts";
import { getAuthDatabase, getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { createAccountFlowOperations } from "./account-flows.ts";

/** Protected atomic signup only. Never mount raw Better Auth signup. */
export function createAccountSignupHandler(
  database: ReturnType<typeof getPrisma>, auth: ReturnType<typeof createAccountAuth>, configuration: BetterAuthOptions,
) {
  const operations = createAccountFlowOperations(database, auth);
  return createAccountFlowHandler(betterAuth({
    ...configuration,
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    plugins: [createAccountFlowPlugin(() => operations, ["/sign-up/email"])],
  }));
}

let handler: ReturnType<typeof createAccountSignupHandler> | undefined;

export async function handleAccountSignupRequest(request: Request): Promise<Response> {
  try {
    handler ??= createAccountSignupHandler(getPrisma(), createAccountAuth(), {
      ...createAuthPolicy(process.env), database: getAuthDatabase(),
    });
    return await handler(request);
  } catch {
    return Response.json({ code: "INTERNAL_ERROR" }, { status: 500, headers: {
      "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
    } });
  }
}
