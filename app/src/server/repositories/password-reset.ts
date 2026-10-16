import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { accountEmailTokenRecord } from "../account-email-crypto.ts";
import { suppressReplacedEmailWork } from "./account-email-work.ts";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";

const namespace = "halaga-password-reset:";
const emailSchema = z.email().transform((email) => email.toLowerCase());
const consumeSchema = z.strictObject({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  newPassword: z.string().min(1),
});
const tokenId = (token: string) => namespace + createHash("sha256").update(token).digest("hex");

export class PasswordResetRejected extends Error {
  readonly code: "INVALID_INPUT" | "INVALID_TOKEN" | "INTERNAL_ERROR";

  constructor(code: PasswordResetRejected["code"]) {
    super(code);
    this.name = "PasswordResetRejected";
    this.code = code;
  }
}

/** Account-private guards; share identity/mapping lock order with email verification. */
async function lockAccount(database: Pick<ReturnType<typeof getPrisma>, "$queryRaw">, userId: string) {
  const rows = await database.$queryRaw<Array<{
    userId: string; email: string; accountId: string; deletedAt: Date | null;
  }>>`
    SELECT u.id AS "userId", u.email, a.id AS "accountId", a."deletedAt"
    FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
    WHERE u.id = ${userId} FOR UPDATE OF u, a
  `;
  const account = rows[0];
  if (!account || account.deletedAt) return null;
  const credentials = await database.$queryRaw<Array<{ id: string; accountId: string; hasPassword: boolean }>>`
    SELECT id, "accountId", (password IS NOT NULL AND password <> '') AS "hasPassword"
    FROM "account" WHERE "userId" = ${userId} AND "providerId" = 'credential' FOR UPDATE
  `;
  // Reset existing credentials only. Never repair missing/ambiguous legacy identities.
  if (credentials.length !== 1 || credentials[0].accountId !== userId || !credentials[0].hasPassword) return null;
  return { ...account, credentialId: credentials[0].id };
}

function currentTime(clock: () => Date) {
  const now = clock();
  if (!Number.isFinite(now.getTime())) throw new PasswordResetRejected("INTERNAL_ERROR");
  return now;
}

/** Account-owned commands; external calls use the protected email handler.
 * issue returns restricted transport material AFTER commit, never a public response.
 * Request handlers give the same generic confirmation for token/null and
 * enforce ADR-086 protection. Direct writes deliberately bypass library reset hooks.
 */
export function createPasswordResetOperations(
  database: ReturnType<typeof getPrisma>,
  auth: Pick<ReturnType<typeof createAccountAuth>, "$context">,
  clock: () => Date = () => new Date(),
) {
  return {
    async issue(input: unknown): Promise<{ token: string; expiresAt: Date } | null> {
      const parsed = emailSchema.safeParse(input);
      if (!parsed.success) throw new PasswordResetRejected("INVALID_INPUT");
      try {
        return await database.$transaction(async (transaction) => {
          const identity = await transaction.user.findUnique({ where: { email: parsed.data }, select: { id: true } });
          if (!identity) return null;
          const account = await lockAccount(transaction, identity.id);
          if (!account || account.email !== parsed.data) return null;
          const now = currentTime(clock);
          const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
          const token = randomBytes(32).toString("hex");
          const id = tokenId(token);
          const outboxEventId = randomUUID();
          const identifier = namespace + account.userId;
          await suppressReplacedEmailWork(transaction, account.accountId, "account.password-reset-email-requested",
            [`password-reset-email:${namespace}`], now);
          await transaction.verification.deleteMany({ where: { identifier } });
          await transaction.verification.create({
            data: { id, identifier, value: account.email, expiresAt, createdAt: now, updatedAt: now },
            select: { id: true },
          });
          const eventType = "account.password-reset-email-requested";
          const deduplicationKey = `password-reset-email:${id}`;
          await transaction.outboxEvent.create({
            data: { id: outboxEventId, accountId: account.accountId, eventType, eventVersion: 1,
              deduplicationKey, createdAt: now },
            select: { id: true },
          });
          await transaction.accountEmailDelivery.create({ data: accountEmailTokenRecord(token,
            { outboxEventId, accountId: account.accountId, eventType, eventVersion: 1, deduplicationKey }, expiresAt),
            select: { id: true }, });
          return { token, expiresAt };
        });
      } catch {
        throw new PasswordResetRejected("INTERNAL_ERROR");
      }
    },

    async consume(input: unknown): Promise<{ status: "PASSWORD_RESET" }> {
      const parsed = consumeSchema.safeParse(input);
      if (!parsed.success) throw new PasswordResetRejected("INVALID_INPUT");
      try {
        const { password } = await auth.$context;
        if (parsed.data.newPassword.length < password.config.minPasswordLength ||
            parsed.data.newPassword.length > password.config.maxPasswordLength) {
          throw new PasswordResetRejected("INVALID_INPUT");
        }
        // Hash outside the transaction; expiry and all guards are reread afterward.
        const hash = await password.hash(parsed.data.newPassword);
        return await database.$transaction(async (transaction) => {
          const id = tokenId(parsed.data.token);
          const candidate = await transaction.verification.findUnique({ where: { id }, select: { identifier: true } });
          if (!candidate?.identifier.startsWith(namespace)) throw new PasswordResetRejected("INVALID_TOKEN");
          const account = await lockAccount(transaction, candidate.identifier.slice(namespace.length));
          const verification = await transaction.verification.findUnique({
            where: { id }, select: { identifier: true, value: true, expiresAt: true, createdAt: true },
          });
          const now = currentTime(clock); // After hashing and any wait for locks.
          if (!account || !verification || verification.identifier !== namespace + account.userId ||
              verification.value !== account.email || verification.createdAt > now || verification.expiresAt <= now) {
            throw new PasswordResetRejected("INVALID_TOKEN");
          }
          const consumed = await transaction.verification.deleteMany({ where: { id, expiresAt: { gt: now } } });
          if (consumed.count !== 1) throw new PasswordResetRejected("INVALID_TOKEN");
          await transaction.account.update({ where: { id: account.credentialId }, data: { password: hash }, select: { id: true } });
          await transaction.session.deleteMany({ where: { userId: account.userId } });
          // Neither verification state nor the separate verification token is changed.
          // No replacement session is created; successful reset requires fresh sign-in.
          return { status: "PASSWORD_RESET" as const };
        });
      } catch (error) {
        if (error instanceof PasswordResetRejected) throw error;
        // No raw database/library error, credential, token or cause escapes.
        throw new PasswordResetRejected("INTERNAL_ERROR");
      }
    },
  };
}
