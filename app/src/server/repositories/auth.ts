import "server-only";
import { betterAuth } from "better-auth";
import { createAuthPolicy } from "../auth-policy.ts";
import { getAuthDatabase } from "../prisma.ts";

// No routes consume this yet. Domain prerequisites and durable email remain separate concerns.
export function createAccountAuth() {
  const policy = createAuthPolicy(process.env);
  return betterAuth({
    ...policy,
    database: getAuthDatabase(),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
  });
}
