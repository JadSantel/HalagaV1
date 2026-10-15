import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { accountEmailTokenRecord } from "../account-email-crypto.ts";
import { suppressReplacedEmailWork } from "./account-email-work.ts";
import { hasAdultEligibility } from "../account-access.ts";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";

const namespace = "halaga-email-change:";
const emailSchema = z.email().transform((email) => email.toLowerCase());
const requestSchema = z.strictObject({ proposedEmail: emailSchema });
export const emailChangeBindingSchema = z.strictObject({
  accountId: z.uuid(), currentEmail: z.email(), proposedEmail: z.email(),
}).refine((value) => value.currentEmail === value.currentEmail.toLowerCase() &&
  value.proposedEmail === value.proposedEmail.toLowerCase() && value.currentEmail !== value.proposedEmail);
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const tokenId = (token: string) => namespace + createHash("sha256").update(token).digest("hex");

export class EmailChangeRejected extends Error {
  readonly code: "INVALID_INPUT" | "UNAUTHORIZED" | "INVALID_STATE" | "INVALID_TOKEN" | "INTERNAL_ERROR";

  constructor(code: EmailChangeRejected["code"]) {
    super(code);
    this.name = "EmailChangeRejected";
    this.code = code;
  }
}

/** Account-private guard projection; same identity/mapping locks as verification/reset. */
async function lockAccount(database: Pick<ReturnType<typeof getPrisma>, "$queryRaw">, userId: string) {
  const rows = await database.$queryRaw<Array<{
    userId: string; email: string; emailVerified: boolean; accountId: string;
    emailVerifiedAt: Date | null; deletedAt: Date | null; dateOfBirth: Date | null; adultAttestedAt: Date | null;
  }>>`
    SELECT u.id AS "userId", u.email, u."emailVerified", a.id AS "accountId",
           a."emailVerifiedAt", a."deletedAt", a."dateOfBirth", a."adultAttestedAt"
    FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
    WHERE u.id = ${userId} FOR UPDATE OF u, a
  `;
  return rows[0];
}

function eligible(account: Awaited<ReturnType<typeof lockAccount>>, now: Date) {
  return account && !account.deletedAt && account.emailVerified && account.emailVerifiedAt &&
    account.emailVerifiedAt <= now && hasAdultEligibility(account.dateOfBirth, account.adultAttestedAt, now);
}

function currentTime(clock: () => Date) {
  const now = clock();
  if (!Number.isFinite(now.getTime())) throw new EmailChangeRejected("INTERNAL_ERROR");
  return now;
}

/** Internal only. No route, Server Action, library change-email hook or delivery.
 * issue returns restricted token transport AFTER commit, never a public response.
 * The caller supplies server request headers, never a chosen account/session ID.
 */
export function createEmailChangeOperations(
  database: ReturnType<typeof getPrisma>,
  auth: Pick<ReturnType<typeof createAccountAuth>, "api">,
  clock: () => Date = () => new Date(),
) {
  return {
    async issue(headers: Headers, input: unknown, applySessionHeaders: (headers: Headers) => void):
      Promise<{ token: string; expiresAt: Date }> {
      const parsed = requestSchema.safeParse(input);
      if (!parsed.success) throw new EmailChangeRejected("INVALID_INPUT");
      try {
        const resolved = await auth.api.getSession({ headers, returnHeaders: true, query: { disableCookieCache: true } });
        applySessionHeaders(resolved.headers);
        const actor = resolved.response;
        if (!actor || actor.session.userId !== actor.user.id) throw new EmailChangeRejected("UNAUTHORIZED");
        return await database.$transaction(async (transaction) => {
          const account = await lockAccount(transaction, actor.user.id);
          // Resolve owner first, then recheck the stored session under lock, including
          // revocation while waiting. Rolling renewal never changes createdAt.
          const sessions = await transaction.$queryRaw<Array<{ createdAt: Date; expiresAt: Date }>>`
            SELECT "createdAt", "expiresAt" FROM "session"
            WHERE id = ${actor.session.id} AND "userId" = ${actor.user.id} AND token = ${actor.session.token}
            FOR UPDATE
          `;
          const now = currentTime(clock);
          const session = sessions[0];
          if (!session || session.expiresAt <= now || session.createdAt > now ||
              now.getTime() - session.createdAt.getTime() >= 15 * 60 * 1000) {
            throw new EmailChangeRejected("UNAUTHORIZED");
          }
          if (!eligible(account, now) || !account || account.email !== account.email.toLowerCase() ||
              !emailSchema.safeParse(account.email).success || account.email === parsed.data.proposedEmail ||
              await transaction.user.findUnique({ where: { email: parsed.data.proposedEmail }, select: { id: true } })) {
            throw new EmailChangeRejected("INVALID_STATE");
          }
          const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          const token = randomBytes(32).toString("hex");
          const id = tokenId(token);
          const outboxEventId = randomUUID();
          const identifier = namespace + account.userId;
          await suppressReplacedEmailWork(transaction, account.accountId,
            "account.email-change-verification-requested", [`email-change-verification:${namespace}`], now);
          await transaction.verification.deleteMany({ where: { identifier } });
          await transaction.verification.create({
            data: { id, identifier, value: JSON.stringify({ accountId: account.accountId,
              currentEmail: account.email, proposedEmail: parsed.data.proposedEmail }),
              expiresAt, createdAt: now, updatedAt: now }, select: { id: true },
          });
          const eventType = "account.email-change-verification-requested";
          const deduplicationKey = `email-change-verification:${id}`;
          await transaction.outboxEvent.create({
            data: { id: outboxEventId, accountId: account.accountId, eventType, eventVersion: 1,
              deduplicationKey, createdAt: now }, select: { id: true },
          });
          await transaction.accountEmailDelivery.create({ data: accountEmailTokenRecord(token,
            { outboxEventId, accountId: account.accountId, eventType, eventVersion: 1, deduplicationKey }, expiresAt),
            select: { id: true }, });
          return { token, expiresAt };
        });
      } catch (error) {
        if (error instanceof EmailChangeRejected) throw error;
        throw new EmailChangeRejected("INTERNAL_ERROR");
      }
    },

    async consume(input: unknown): Promise<{ status: "EMAIL_CHANGED" }> {
      const parsed = tokenSchema.safeParse(input);
      if (!parsed.success) throw new EmailChangeRejected("INVALID_TOKEN");
      try {
        return await database.$transaction(async (transaction) => {
          const id = tokenId(parsed.data);
          const candidate = await transaction.verification.findUnique({ where: { id }, select: { identifier: true } });
          if (!candidate?.identifier.startsWith(namespace)) throw new EmailChangeRejected("INVALID_TOKEN");
          const account = await lockAccount(transaction, candidate.identifier.slice(namespace.length));
          const tokens = await transaction.$queryRaw<Array<{
            identifier: string; value: string; createdAt: Date; expiresAt: Date;
          }>>`SELECT identifier, value, "createdAt", "expiresAt" FROM "verification" WHERE id = ${id} FOR UPDATE`;
          const token = tokens[0]; // Reread after any competing request/consume.
          const now = currentTime(clock);
          let binding;
          try { binding = emailChangeBindingSchema.safeParse(token ? JSON.parse(token.value) : null); }
          catch { throw new EmailChangeRejected("INVALID_TOKEN"); }
          if (!account || !eligible(account, now) || !token || !binding.success ||
              token.identifier !== namespace + account.userId || token.createdAt > now || token.expiresAt <= now ||
              binding.data.accountId !== account.accountId || binding.data.currentEmail !== account.email ||
              await transaction.user.findUnique({ where: { email: binding.data.proposedEmail }, select: { id: true } })) {
            throw new EmailChangeRejected("INVALID_TOKEN");
          }
          const consumed = await transaction.verification.deleteMany({ where: { id, expiresAt: { gt: now } } });
          if (consumed.count !== 1) throw new EmailChangeRejected("INVALID_TOKEN");
          // The database unique email also arbitrates claims racing signup/another account.
          await transaction.user.update({ where: { id: account.userId },
            data: { email: binding.data.proposedEmail, emailVerified: true }, select: { id: true } });
          await transaction.userAccount.update({ where: { id: account.accountId },
            data: { emailVerifiedAt: now }, select: { id: true } });
          await transaction.session.deleteMany({ where: { userId: account.userId } });
          const outboxEventId = randomUUID();
          const eventType = "account.email-changed-security-notice";
          const deduplicationKey = `email-changed-notice:${id}`;
          const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          await transaction.outboxEvent.create({
            data: { id: outboxEventId, accountId: account.accountId, eventType, eventVersion: 1,
              deduplicationKey, recipientEmail: binding.data.currentEmail, createdAt: now }, select: { id: true },
          });
          await transaction.accountEmailDelivery.create({ data: accountEmailTokenRecord("",
            { outboxEventId, accountId: account.accountId, eventType, eventVersion: 1, deduplicationKey }, expiresAt),
            select: { id: true }, });
          return { status: "EMAIL_CHANGED" as const };
        });
      } catch (error) {
        if (error instanceof EmailChangeRejected) throw error;
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
          throw new EmailChangeRejected("INVALID_TOKEN");
        }
        // Private SQL/library failures, addresses, sessions and tokens never escape.
        throw new EmailChangeRejected("INTERNAL_ERROR");
      }
    },
  };
}
