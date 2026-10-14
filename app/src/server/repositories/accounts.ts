import "server-only";
import { AccountAccessRejected, hasAdultEligibility, type AccountAccess } from "../account-access.ts";
import { logOperationalEvent } from "../operational-log.ts";
import { createAccountAuth } from "./auth.ts";
import { getPrisma } from "../prisma.ts";

/** Concrete dependencies also permit isolated synthetic auth/database verification. */
export function createAccountAccessReader(
  auth: Pick<ReturnType<typeof createAccountAuth>, "api">,
  database: Pick<ReturnType<typeof getPrisma>, "userAccount">,
) {
  return async (headers: Headers, applySessionHeaders: (headers: Headers) => void): Promise<AccountAccess | null> => {
    try {
      // Stored sessions only. Preserve rolling renewal and pass cookies to the future response boundary.
      const session = await auth.api.getSession({ headers, returnHeaders: true, query: { disableCookieCache: true } });
      applySessionHeaders(session.headers);
      const identity = session.response;
      const now = new Date();
      if (!identity || identity.session.userId !== identity.user.id ||
          identity.session.expiresAt <= now || identity.session.createdAt > now) return null;
      // Owner comes exclusively from the verified session, never an input account ID.
      const account = await database.userAccount.findUnique({
        where: { authUserId: identity.user.id },
        select: {
          id: true, displayName: true, dateOfBirth: true, adultAttestedAt: true,
          emailVerifiedAt: true, deletedAt: true,
        },
      });
      if (!account || account.deletedAt) return null;
      const result: AccountAccess = {
        accountId: account.id,
        displayName: account.displayName,
        adultEligible: hasAdultEligibility(account.dateOfBirth, account.adultAttestedAt, now),
        // A stale domain verification timestamp cannot override an unverified auth identity.
        emailVerified: identity.user.emailVerified === true && account.emailVerifiedAt !== null && account.emailVerifiedAt <= now,
        recentSignIn: now.getTime() - identity.session.createdAt.getTime() < 15 * 60 * 1000,
      };
      logOperationalEvent({ operation: "account-access", outcome: "success" });
      return result;
    } catch {
      logOperationalEvent({ operation: "account-access", outcome: "failed", code: "INTERNAL_ERROR" });
      throw new AccountAccessRejected("INTERNAL_ERROR");
    }
  };
}

let reader: ReturnType<typeof createAccountAccessReader> | undefined;

/** Server-internal only: no cache, staff reader, public reader, or mounted endpoint. */
export async function readAccountAccess(headers: Headers, applySessionHeaders: (headers: Headers) => void) {
  if (!reader) {
    try {
      reader = createAccountAccessReader(createAccountAuth(), getPrisma());
    } catch {
      logOperationalEvent({ operation: "account-access", outcome: "failed", code: "INTERNAL_ERROR" });
      throw new AccountAccessRejected("INTERNAL_ERROR");
    }
  }
  return reader(headers, applySessionHeaders);
}
