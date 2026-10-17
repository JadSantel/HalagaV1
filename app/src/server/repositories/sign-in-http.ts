import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAccountFlowHandler, createAccountFlowPlugin } from "../account-flow-plugin.ts";
import type { getPrisma } from "../prisma.ts";
import type { createAccountAuth } from "./auth.ts";
import { createAccountFlowOperations } from "./account-flows.ts";

/** Unmounted protected integration. No application route, action or runtime enable flag. */
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
