import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../prisma.ts";

const namespace = "halaga-email-verification:";
const emailSchema = z.email().transform((email) => email.toLowerCase());
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const tokenId = (token: string) => namespace + createHash("sha256").update(token).digest("hex");

export class EmailVerificationRejected extends Error {
  readonly code: "INVALID_INPUT" | "INVALID_TOKEN" | "INTERNAL_ERROR";

  constructor(code: EmailVerificationRejected["code"]) {
    super(code);
    this.name = "EmailVerificationRejected";
    this.code = code;
  }
}

/** Account-private guard projection. Lock the same identity/mapping for issue and consume. */
async function lockAccount(database: Pick<ReturnType<typeof getPrisma>, "$queryRaw">, userId: string) {
  const rows = await database.$queryRaw<Array<{
    userId: string; email: string; emailVerified: boolean;
    accountId: string; emailVerifiedAt: Date | null; deletedAt: Date | null;
  }>>`
    SELECT u.id AS "userId", u.email, u."emailVerified", a.id AS "accountId",
           a."emailVerifiedAt", a."deletedAt"
    FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
    WHERE u.id = ${userId} FOR UPDATE OF u, a
  `;
  return rows[0];
}

function currentTime(clock: () => Date) {
  const now = clock();
  if (!Number.isFinite(now.getTime())) throw new EmailVerificationRejected("INTERNAL_ERROR");
  return now;
}

/** Internal only. No route, Server Action, library verification endpoint or delivery callback.
 * issue returns restricted transport material for synthetic/trusted callers, NOT a request
 * response. Future resend handlers must return the same generic confirmation for token/null.
 * The namespaced opaque tokens deliberately do not use Better Auth's JWT/default lifecycle.
 */
export function createEmailVerificationOperations(
  database: ReturnType<typeof getPrisma>,
  clock: () => Date = () => new Date(),
) {
  return {
    async issue(input: unknown): Promise<{ token: string; expiresAt: Date } | null> {
      const parsed = emailSchema.safeParse(input);
      if (!parsed.success) throw new EmailVerificationRejected("INVALID_INPUT");
      try {
        return await database.$transaction(async (transaction) => {
          const identity = await transaction.user.findUnique({ where: { email: parsed.data }, select: { id: true } });
          if (!identity) return null;
          const account = await lockAccount(transaction, identity.id);
          if (!account || account.deletedAt || account.email !== parsed.data ||
              account.emailVerified || account.emailVerifiedAt) return null;
          const now = currentTime(clock); // After any wait for the account lock.
          const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          const token = randomBytes(32).toString("hex");
          const id = tokenId(token);
          const identifier = namespace + account.userId;
          await transaction.verification.deleteMany({ where: { identifier } });
          await transaction.verification.create({
            data: { id, identifier, value: account.email, expiresAt, createdAt: now, updatedAt: now },
            select: { id: true },
          });
          await transaction.outboxEvent.create({
            data: { accountId: account.accountId, eventType: "account.verification-email-requested", eventVersion: 1,
              deduplicationKey: `verification-email:${id}`, createdAt: now },
            select: { id: true },
          });
          // Returned only after COMMIT. No raw token, email or DOB is copied into the outbox.
          return { token, expiresAt };
        });
      } catch {
        throw new EmailVerificationRejected("INTERNAL_ERROR");
      }
    },

    async consume(input: unknown): Promise<{ status: "EMAIL_VERIFIED" }> {
      const parsed = tokenSchema.safeParse(input);
      if (!parsed.success) throw new EmailVerificationRejected("INVALID_TOKEN");
      try {
        return await database.$transaction(async (transaction) => {
          const id = tokenId(parsed.data);
          const candidate = await transaction.verification.findUnique({ where: { id }, select: { identifier: true } });
          if (!candidate?.identifier.startsWith(namespace)) throw new EmailVerificationRejected("INVALID_TOKEN");
          const account = await lockAccount(transaction, candidate.identifier.slice(namespace.length));
          // Reread after locking: a competing resend/consume may have removed the candidate.
          const verification = await transaction.verification.findUnique({
            where: { id }, select: { identifier: true, value: true, expiresAt: true, createdAt: true },
          });
          const now = currentTime(clock);
          if (!account || account.deletedAt || account.emailVerified || account.emailVerifiedAt ||
              !verification || verification.identifier !== namespace + account.userId ||
              verification.value !== account.email || verification.createdAt > now || verification.expiresAt <= now) {
            throw new EmailVerificationRejected("INVALID_TOKEN");
          }
          const consumed = await transaction.verification.deleteMany({ where: { id, expiresAt: { gt: now } } });
          if (consumed.count !== 1) throw new EmailVerificationRejected("INVALID_TOKEN");
          await transaction.user.update({ where: { id: account.userId }, data: { emailVerified: true }, select: { id: true } });
          await transaction.userAccount.update({ where: { id: account.accountId }, data: { emailVerifiedAt: now }, select: { id: true } });
          await transaction.session.deleteMany({ where: { userId: account.userId } });
          return { status: "EMAIL_VERIFIED" as const };
        });
      } catch (error) {
        if (error instanceof EmailVerificationRejected) throw error;
        // No raw database exception/cause, credential or token reaches errors or logs.
        throw new EmailVerificationRejected("INTERNAL_ERROR");
      }
    },
  };
}
