import "server-only";
import { betterAuth } from "better-auth";
import { runWithAdapter } from "@better-auth/core/context";
import { z } from "zod";
import { getTransactionAuthDatabase, type getPrisma } from "../prisma.ts";
import type { createAccountAuth } from "./auth.ts";

const inputSchema = z.strictObject({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export class SignInRejected extends Error {
  readonly code: "INVALID_INPUT" | "INVALID_CREDENTIALS" | "INTERNAL_ERROR";

  constructor(code: SignInRejected["code"]) {
    super(code);
    this.name = "SignInRejected";
    this.code = code;
  }
}

/** Trusted-server operation behind sign-in-http.ts. Direct auth.api calls have no HTTP limiter.
 * The account auth configuration has no secondary storage, plugins or email callbacks.
 * Recheck this boundary on library/adapter/configuration/hook changes.
 */
export function createAccountSignInOperation(
  database: ReturnType<typeof getPrisma>,
  auth: Pick<ReturnType<typeof createAccountAuth>, "options">,
) {
  return async (headers: Headers, input: unknown) => {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new SignInRejected("INVALID_INPUT");
    try {
      return await database.$transaction(async (transaction) => {
        // Same identity/mapping -> credential order as account-owned commands.
        // This lookup only chooses locks; Better Auth rereads state AFTER any wait.
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT u.id FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
          WHERE u.email = ${parsed.data.email} FOR UPDATE OF u, a
        `;
        // ADR-074: deletion disables login. Reread after any identity/account lock wait.
        const account = locked.length === 1 ? await transaction.userAccount.findUnique({
          where: { authUserId: locked[0].id }, select: { deletedAt: true },
        }) : null;
        // An address can appear while email proof/signup commits. Never let a
        // later library lookup authenticate an identity this transaction did not lock.
        if (!account || account.deletedAt) {
          const { password } = await betterAuth(auth.options).$context;
          if (parsed.data.password.length <= password.config.maxPasswordLength) {
            await password.hash(parsed.data.password);
          }
          throw new SignInRejected("INVALID_CREDENTIALS");
        }
        await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT c.id FROM "account" c JOIN "user" u ON u.id = c."userId"
          WHERE u.email = ${parsed.data.email} AND c."providerId" = 'credential' FOR UPDATE OF c
        `;
        // All adapter closures capture this transaction client, including the
        // credential join and session create. No before/after hook spans the flow.
        // transaction:false prevents nested transactions; the outer one owns commit.
        const transactionalAuth = betterAuth({
          ...auth.options,
          database: getTransactionAuthDatabase(transaction),
        });
        // HTTP handlers install an ambient adapter which otherwise wins over the
        // internal adapter's fallback, even for a separately constructed auth instance.
        // Explicitly scope the installed core context to this transaction adapter.
        const { adapter } = await transactionalAuth.$context;
        return await runWithAdapter(adapter, () => transactionalAuth.api.signInEmail({
          headers, body: parsed.data, returnHeaders: true,
        }));
      });
      // Response/cookies remain local until the transaction has committed.
    } catch (error) {
      if (error instanceof SignInRejected) throw error;
      // Never expose library/database errors, causes, credentials or partial cookies.
      if (error && typeof error === "object" && "body" in error &&
          error.body && typeof error.body === "object" && "code" in error.body &&
          error.body.code === "INVALID_EMAIL_OR_PASSWORD") {
        throw new SignInRejected("INVALID_CREDENTIALS");
      }
      throw new SignInRejected("INTERNAL_ERROR");
    }
  };
}
