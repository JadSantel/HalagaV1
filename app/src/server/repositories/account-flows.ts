import "server-only";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { createSignupOperation } from "./signup.ts";
import { createEmailVerificationOperations } from "./email-verification.ts";
import { createPasswordResetOperations } from "./password-reset.ts";
import { createEmailChangeOperations } from "./email-change.ts";
import { createPasswordChangeOperation } from "./password-change.ts";
import { createAccountSignInOperation } from "./sign-in.ts";

/** Composition only. HTTP callers restrict exposed paths; password change remains gated. */
export function createAccountFlowOperations(
  database: ReturnType<typeof getPrisma>,
  auth: ReturnType<typeof createAccountAuth>,
  clock: () => Date = () => new Date(),
) {
  return {
    signIn: createAccountSignInOperation(database, auth),
    signup: createSignupOperation(database, auth, clock),
    verification: createEmailVerificationOperations(database, clock),
    reset: createPasswordResetOperations(database, auth, clock),
    emailChange: createEmailChangeOperations(database, auth, clock),
    passwordChange: createPasswordChangeOperation(database, auth, clock),
  };
}
