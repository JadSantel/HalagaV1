import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthPolicy } from "../auth-policy.ts";
import { accountEmailPaths, createAccountFlowHandler, createAccountFlowPlugin } from "../account-flow-plugin.ts";
import { getAuthDatabase, getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { createAccountFlowOperations } from "./account-flows.ts";

/** Only email commands are reachable. Library sign-in, signup and password change stay closed. */
export function createAccountEmailHandler(
  database: ReturnType<typeof getPrisma>, auth: ReturnType<typeof createAccountAuth>, configuration: BetterAuthOptions,
) {
  const operations = createAccountFlowOperations(database, auth);
  return createAccountFlowHandler(betterAuth({
    ...configuration,
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    plugins: [createAccountFlowPlugin(() => operations, accountEmailPaths)],
  }));
}

let handler: ReturnType<typeof createAccountEmailHandler> | undefined;

export async function handleAccountEmailRequest(request: Request): Promise<Response> {
  try {
    handler ??= createAccountEmailHandler(getPrisma(), createAccountAuth(), {
      ...createAuthPolicy(process.env), database: getAuthDatabase(),
    });
    return await handler(request);
  } catch {
    return Response.json({ code: "INTERNAL_ERROR" }, { status: 500, headers: {
      "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
    } });
  }
}
