import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { hasAdultEligibility } from "../account-access.ts";
import { accountEmailTokenRecord } from "../account-email-crypto.ts";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";

export const adultAttestationVersion = "adult-eligibility-en-v1";

const inputSchema = z.strictObject({
  displayName: z.string().trim().min(1),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  dateOfBirth: z.iso.date(),
  adultAttestationAccepted: z.literal(true),
});

export class SignupRejected extends Error {
  readonly code: "INVALID_INPUT" | "ADULT_ELIGIBILITY_REQUIRED" | "INTERNAL_ERROR";

  constructor(code: SignupRejected["code"]) {
    super(code);
    this.name = "SignupRejected";
    this.code = code;
  }
}

const received = Object.freeze({ status: "SIGNUP_RECEIVED" as const });
class IdentityConflict extends Error {}

/** Internal command only: not a Server Action or an HTTP/auth.api wrapper.
 * This account-owned integration writes the installed Better Auth credential schema
 * inside the same Prisma transaction as domain state. No session/token is issued.
 */
export function createSignupOperation(
  database: ReturnType<typeof getPrisma>,
  auth: Pick<ReturnType<typeof createAccountAuth>, "$context">,
  clock: () => Date = () => new Date(),
) {
  return async (input: unknown): Promise<typeof received> => {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new SignupRejected("INVALID_INPUT");
    const data = parsed.data;
    const now = clock();
    if (!Number.isFinite(now.getTime())) throw new SignupRejected("INTERNAL_ERROR");
    const dateOfBirth = new Date(`${data.dateOfBirth}T00:00:00.000Z`);
    // Reject before hashing, database access, identity creation or outbox writes.
    if (!hasAdultEligibility(dateOfBirth, now, now)) {
      throw new SignupRejected("ADULT_ELIGIBILITY_REQUIRED");
    }

    try {
      const { password } = await auth.$context;
      if (data.password.length < password.config.minPasswordLength ||
          data.password.length > password.config.maxPasswordLength) {
        throw new SignupRejected("INVALID_INPUT");
      }
      const hash = await password.hash(data.password);
      await database.$transaction(async (transaction) => {
        const authUserId = randomUUID();
        const outboxEventId = randomUUID();
        const token = randomBytes(32).toString("hex");
        const tokenId = "halaga-email-verification:" + createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        try {
          await transaction.user.create({
            data: { id: authUserId, name: data.displayName, email: data.email, emailVerified: false },
            select: { id: true },
          });
        } catch (error) {
          if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
            throw new IdentityConflict();
          }
          throw error;
        }
        // Matches Better Auth 1.7.7 sign-up: providerId=credential, accountId=user.id.
        await transaction.account.create({
          data: { id: randomUUID(), userId: authUserId, accountId: authUserId, providerId: "credential", password: hash },
          select: { id: true },
        });
        const account = await transaction.userAccount.create({
          data: { authUserId, displayName: data.displayName, dateOfBirth,
            adultAttestedAt: now, adultAttestationVersion },
          select: { id: true },
        });
        await transaction.verification.create({
          data: { id: tokenId, identifier: "halaga-email-verification:" + authUserId,
            value: data.email, expiresAt, createdAt: now, updatedAt: now }, select: { id: true },
        });
        const eventType = "account.verification-email-requested";
        const deduplicationKey = `signup-verification:${account.id}`;
        await transaction.outboxEvent.create({
          data: { id: outboxEventId, accountId: account.id, eventType, eventVersion: 1, deduplicationKey },
          select: { id: true },
        });
        await transaction.accountEmailDelivery.create({
          data: accountEmailTokenRecord(token, { outboxEventId, accountId: account.id, eventType,
            eventVersion: 1, deduplicationKey }, expiresAt), select: { id: true },
        });
      });
      return received;
    } catch (error) {
      if (error instanceof SignupRejected) throw error;
      // The unique normalized email is the concurrency arbiter. Never reveal duplicates.
      if (error instanceof IdentityConflict) {
        try {
          const existing = await database.user.findUnique({ where: { email: data.email }, select: { id: true } });
          if (existing) return received;
        } catch {
          // A failed duplicate check is an internal failure, never a raw DB error.
        }
      }
      // Raw database/library errors may contain private input. Do not attach a cause.
      throw new SignupRejected("INTERNAL_ERROR");
    }
  };
}

/** No route imports this operation. Future external callers need reviewed rate limits. */
export async function signup(input: unknown) {
  try {
    return await createSignupOperation(getPrisma(), createAccountAuth())(input);
  } catch (error) {
    if (error instanceof SignupRejected) throw error;
    throw new SignupRejected("INTERNAL_ERROR");
  }
}
