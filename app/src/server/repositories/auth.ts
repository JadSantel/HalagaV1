import "server-only";
import { betterAuth } from "better-auth";
import { createAuthPolicy } from "../auth-policy.ts";
import { getAuthDatabase } from "../prisma.ts";

// Internal session/hasher source. Raw library sign-in does not share account locks;
// use the unmounted sign-in.ts operation for serialized credential authentication.
export function createAccountAuth() {
  const policy = createAuthPolicy(process.env);
  return betterAuth({
    ...policy,
    database: getAuthDatabase(),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
  });
}
