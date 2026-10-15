import "server-only";
import { z } from "zod";
import { hasAdultEligibility } from "../account-access.ts";
import { getPrisma } from "../prisma.ts";
import { emailChangeBindingSchema } from "./email-change.ts";

export class AccountEmailIntentRejected extends Error {
  readonly code: "INVALID_INPUT" | "INTERNAL_ERROR";

  constructor(code: AccountEmailIntentRejected["code"]) {
    super(code);
    this.name = "AccountEmailIntentRejected";
    this.code = code;
  }
}

export type AccountEmailIntentInspection = Readonly<{
  status: "MISSING" | "UNSUPPORTED" | "STALE" | "DISPATCH_RECORDED" |
    "SIGNUP_TOKEN_UNBOUND" | "TOKEN_CURRENT" | "NOTICE_RECORDED";
}>;

const idSchema = z.uuid();
const normalizedEmail = z.email().refine((email) => email === email.toLowerCase());
const tokenKinds = {
  "account.verification-email-requested": {
    key: "verification-email:", namespace: "halaga-email-verification:",
  },
  "account.password-reset-email-requested": {
    key: "password-reset-email:", namespace: "halaga-password-reset:",
  },
  "account.email-change-verification-requested": {
    key: "email-change-verification:", namespace: "halaga-email-change:",
  },
} as const;

/** Trusted account-module inspection only; no request, staff or generic outbox reader.
 * Returns fixed status only: no recipient, binding, digest, token, body or diagnostic.
 * This is NOT delivery authorization, a lease or a processed-work record. Locks end
 * when this inspection commits. A future sender must recheck under its accepted
 * dispatch/race contract. No job is created, suppressed, acknowledged or sent here.
 */
export function createAccountEmailIntentInspector(
  database: ReturnType<typeof getPrisma>,
  clock: () => Date = () => new Date(),
) {
  return async (input: unknown): Promise<AccountEmailIntentInspection> => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) throw new AccountEmailIntentRejected("INVALID_INPUT");
    try {
      return await database.$transaction(async (transaction): Promise<AccountEmailIntentInspection> => {
        const intent = await transaction.outboxEvent.findUnique({
          where: { id: parsed.data }, select: {
            accountId: true, eventType: true, eventVersion: true, deduplicationKey: true,
            createdAt: true, dispatchedAt: true,
          },
        });
        if (!intent) return { status: "MISSING" };
        if (intent.eventVersion !== 1) return { status: "UNSUPPORTED" };
        if (intent.dispatchedAt) return { status: "DISPATCH_RECORDED" };

        if (intent.eventType === "account.email-changed-security-notice") {
          // Deliberately never read the identity/current (new) email for this notice.
          // This checks the recorded snapshot only; deletion/delay/recovery policy
          // and approved message copy remain unresolved delivery gates.
          const snapshot = await transaction.outboxEvent.findUnique({
            where: { id: parsed.data }, select: { recipientEmail: true },
          });
          return { status: /^email-changed-notice:halaga-email-change:[a-f0-9]{64}$/.test(intent.deduplicationKey) &&
            normalizedEmail.safeParse(snapshot?.recipientEmail).success ? "NOTICE_RECORDED" : "STALE" };
        }

        const kind = Object.hasOwn(tokenKinds, intent.eventType)
          ? tokenKinds[intent.eventType as keyof typeof tokenKinds] : undefined;
        if (!kind) return { status: "UNSUPPORTED" };
        const accounts = await transaction.$queryRaw<Array<{
          userId: string; email: string; emailVerified: boolean;
          emailVerifiedAt: Date | null; deletedAt: Date | null;
        }>>`
          SELECT u.id AS "userId", u.email, u."emailVerified", a."emailVerifiedAt", a."deletedAt"
          FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
          WHERE a.id = ${intent.accountId}::uuid FOR UPDATE OF u, a
        `;
        const account = accounts[0];
        const now = clock(); // After any wait for account commands.
        if (!Number.isFinite(now.getTime())) throw new AccountEmailIntentRejected("INTERNAL_ERROR");
        if (!account || account.deletedAt || !normalizedEmail.safeParse(account.email).success || intent.createdAt > now) {
          return { status: "STALE" };
        }
        if (intent.eventType === "account.verification-email-requested") {
          if (account.emailVerified || account.emailVerifiedAt) return { status: "STALE" };
          if (intent.deduplicationKey === `signup-verification:${intent.accountId}`) {
            // Signup has no token-specific association. Do not silently issue or
            // attach a later resend token to this older logical intent.
            return { status: "SIGNUP_TOKEN_UNBOUND" };
          }
        }
        const prefix = kind.key + kind.namespace;
        if (!intent.deduplicationKey.startsWith(prefix) ||
            !/^[a-f0-9]{64}$/.test(intent.deduplicationKey.slice(prefix.length))) return { status: "STALE" };
        const token = await transaction.verification.findUnique({
          where: { id: intent.deduplicationKey.slice(kind.key.length) },
          select: { identifier: true, value: true, createdAt: true, expiresAt: true },
        });
        if (!token || token.identifier !== kind.namespace + account.userId ||
            token.createdAt > now || token.expiresAt <= now) return { status: "STALE" };

        if (intent.eventType === "account.email-change-verification-requested") {
          let binding;
          try { binding = emailChangeBindingSchema.safeParse(JSON.parse(token.value)); }
          catch { return { status: "STALE" }; }
          if (!binding.success || binding.data.accountId !== intent.accountId ||
              binding.data.currentEmail !== account.email || !account.emailVerified ||
              !account.emailVerifiedAt || account.emailVerifiedAt > now) return { status: "STALE" };
          const eligibility = await transaction.userAccount.findUnique({
            where: { id: intent.accountId }, select: { dateOfBirth: true, adultAttestedAt: true },
          });
          if (!eligibility || !hasAdultEligibility(eligibility.dateOfBirth, eligibility.adultAttestedAt, now) ||
              await transaction.user.findUnique({ where: { email: binding.data.proposedEmail }, select: { id: true } })) {
            return { status: "STALE" };
          }
        } else {
          if (token.value !== account.email) return { status: "STALE" };
          if (intent.eventType === "account.password-reset-email-requested") {
            const credentials = await transaction.$queryRaw<Array<{ accountId: string; hasPassword: boolean }>>`
              SELECT "accountId", (password IS NOT NULL AND password <> '') AS "hasPassword"
              FROM "account" WHERE "userId" = ${account.userId} AND "providerId" = 'credential' FOR UPDATE
            `;
            if (credentials.length !== 1 || credentials[0].accountId !== account.userId || !credentials[0].hasPassword) {
              return { status: "STALE" };
            }
          }
        }
        const checkedAt = clock(); // Credential locking/other reads may also wait.
        if (!Number.isFinite(checkedAt.getTime())) throw new AccountEmailIntentRejected("INTERNAL_ERROR");
        if (token.createdAt > checkedAt || token.expiresAt <= checkedAt) return { status: "STALE" };
        return { status: "TOKEN_CURRENT" };
      });
    } catch {
      // Never retain an arbitrary DB exception/cause, recipient or binding in diagnostics.
      throw new AccountEmailIntentRejected("INTERNAL_ERROR");
    }
  };
}
