import "server-only";
import { betterAuth } from "better-auth";
import { createAuthPolicy } from "../auth-policy";
import { getAuthDatabase } from "../prisma";

// No routes consume this yet. Account eligibility and durable email remain separate gates.
export function createAccountAuth() {
  const policy = createAuthPolicy(process.env);
  return betterAuth({
    ...policy,
    database: getAuthDatabase(),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
  });
}
