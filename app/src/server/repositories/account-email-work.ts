import "server-only";
import { getPrisma } from "../prisma.ts";

type EventKind = "account.verification-email-requested" | "account.password-reset-email-requested" |
  "account.email-change-verification-requested";

/** Suppress queued work for the replaced token family in the same account transaction. */
export async function suppressReplacedEmailWork(
  transaction: Pick<ReturnType<typeof getPrisma>, "outboxEvent" | "accountEmailDelivery">,
  accountId: string,
  eventType: EventKind,
  deduplicationPrefixes: string[],
  now: Date,
) {
  const events = await transaction.outboxEvent.findMany({ where: { accountId, eventType,
    OR: deduplicationPrefixes.map((prefix) => ({ deduplicationKey: { startsWith: prefix } })) }, select: { id: true } });
  if (!events.length) return;
  await transaction.accountEmailDelivery.updateMany({ where: { outboxEventId: { in: events.map((event) => event.id) },
    state: { in: ["READY", "LEASED"] } }, data: { state: "SUPPRESSED", leaseId: null,
    leaseExpiresAt: null, terminalAt: now, lastErrorCode: "TOKEN_REPLACED", ciphertext: new Uint8Array() } });
}
