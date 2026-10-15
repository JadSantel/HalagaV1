import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { hasAdultEligibility } from "../account-access.ts";
import { decryptAccountEmailToken, type EmailTokenContext } from "../account-email-crypto.ts";
import { accountEmailActionUrl, sendBrevoEmail, BrevoSendError } from "../account-email-provider.ts";
import { renderAccountEmail, type AccountEmailKind, type AccountEmailMessage } from "../account-email-templates.ts";
import { getPrisma } from "../prisma.ts";
import { emailChangeBindingSchema } from "./email-change.ts";

const tokenKinds = {
  "account.verification-email-requested": { kind: "VERIFY", namespace: "halaga-email-verification:", key: "verification-email:" },
  "account.password-reset-email-requested": { kind: "RESET", namespace: "halaga-password-reset:", key: "password-reset-email:" },
  "account.email-change-verification-requested": { kind: "EMAIL_CHANGE", namespace: "halaga-email-change:", key: "email-change-verification:" },
} as const;
const maxAttempts = 5;
const leaseMs = 120_000;
const retentionMs = 30 * 24 * 60 * 60 * 1000;
const emailSchema = z.email().refine((value) => value === value.toLowerCase());

type DispatchResult = Readonly<{ status: "EMPTY" | "ACCEPTED" | "RETRY_SCHEDULED" | "SUPPRESSED" | "FAILED" | "UNKNOWN" }>;
type Job = { id: string; leaseId: string; attemptCount: number };

function contextOf(event: { id: string; accountId: string; eventType: string; eventVersion: number; deduplicationKey: string }): EmailTokenContext {
  return { outboxEventId: event.id, accountId: event.accountId, eventType: event.eventType,
    eventVersion: event.eventVersion, deduplicationKey: event.deduplicationKey };
}

function isEmail(value: unknown): value is string { return emailSchema.safeParse(value).success; }

export function createAccountEmailDispatcher(
  database: ReturnType<typeof getPrisma>,
  send: typeof sendBrevoEmail = sendBrevoEmail,
  clock: () => Date = () => new Date(),
) {
  async function claim(): Promise<Job | null> {
    const now = clock();
    return database.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; state: string; attemptCount: number }>>`
        SELECT id, state, "attemptCount" FROM "account_email_delivery"
        WHERE ((state = 'READY' AND "availableAt" <= ${now}) OR
               (state = 'LEASED' AND "leaseExpiresAt" <= ${now}))
          AND "expiresAt" > ${now} AND "attemptCount" < ${maxAttempts}
        ORDER BY "availableAt", "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
      `;
      const row = rows[0];
      if (!row) return null;
      const leaseId = randomUUID();
      const updated = await tx.accountEmailDelivery.updateMany({
        where: { id: row.id, state: row.state, attemptCount: row.attemptCount },
        data: { state: "LEASED", leaseId, leaseExpiresAt: new Date(now.getTime() + leaseMs),
          attemptCount: { increment: 1 } },
      });
      return updated.count === 1 ? { id: row.id, leaseId, attemptCount: row.attemptCount + 1 } : null;
    });
  }

  async function markTerminal(job: Job, state: "SUPPRESSED" | "FAILED", code: string, now: Date) {
    await database.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId },
      data: { state, leaseId: null, leaseExpiresAt: null, terminalAt: now, lastErrorCode: code,
        ciphertext: new Uint8Array() } });
  }

  async function prepare(job: Job): Promise<{ message: AccountEmailMessage; kind: AccountEmailKind } | null> {
    return database.$transaction(async (tx) => {
      const delivery = await tx.accountEmailDelivery.findUnique({ where: { id: job.id }, select: {
        state: true, leaseId: true, leaseExpiresAt: true, keyId: true, ciphertext: true, expiresAt: true, outboxEvent: { select: {
          id: true, accountId: true, eventType: true, eventVersion: true, deduplicationKey: true,
          createdAt: true, dispatchedAt: true, recipientEmail: true,
        } },
      } });
      const event = delivery?.outboxEvent;
      const now = clock();
      if (!delivery || !event || delivery.state !== "LEASED" || delivery.leaseId !== job.leaseId ||
          !delivery.leaseExpiresAt || delivery.leaseExpiresAt <= now) return null;
      if (delivery.expiresAt <= now || event.dispatchedAt || event.eventVersion !== 1) {
        await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
          state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
          lastErrorCode: "STALE_OR_EXPIRED", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      if (event.eventType === "account.email-changed-security-notice") {
        const account = await tx.userAccount.findUnique({ where: { id: event.accountId }, select: { deletedAt: true } });
        if (!account || account.deletedAt || !isEmail(event.recipientEmail) ||
            !/^email-changed-notice:halaga-email-change:[a-f0-9]{64}$/.test(event.deduplicationKey)) {
          await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
            state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "STALE_NOTICE", ciphertext: new Uint8Array(),
          } });
          return null;
        }
        await tx.accountEmailDelivery.update({ where: { id: job.id }, data: { state: "SENDING" } });
        return { kind: "EMAIL_CHANGED" as const, message: renderAccountEmail("EMAIL_CHANGED", event.recipientEmail) };
      }

      const config = Object.hasOwn(tokenKinds, event.eventType)
        ? tokenKinds[event.eventType as keyof typeof tokenKinds] : undefined;
      if (!config || !event.deduplicationKey.startsWith(config.key) ||
          !/^[a-f0-9]{64}$/.test(event.deduplicationKey.slice(config.key.length))) {
        await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
          state: "FAILED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
          lastErrorCode: "UNSUPPORTED_INTENT", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      const accountRows = await tx.$queryRaw<Array<{
        userId: string; email: string; emailVerified: boolean; accountId: string;
        emailVerifiedAt: Date | null; deletedAt: Date | null; dateOfBirth: Date | null; adultAttestedAt: Date | null;
      }>>`
        SELECT u.id AS "userId", u.email, u."emailVerified", a.id AS "accountId", a."emailVerifiedAt",
               a."deletedAt", a."dateOfBirth", a."adultAttestedAt"
        FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
        WHERE a.id = ${event.accountId}::uuid FOR UPDATE OF u, a
      `;
      const account = accountRows[0];
      if (!account || account.deletedAt || !isEmail(account.email) || event.createdAt > now) {
        await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
          state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
          lastErrorCode: "STALE_ACCOUNT", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      const token = decryptAccountEmailToken(delivery.keyId, delivery.ciphertext, contextOf(event));
      const tokenId = config.namespace + createHash("sha256").update(token).digest("hex");
      const isSignup = config.kind === "VERIFY" && event.deduplicationKey === `signup-verification:${event.accountId}`;
      if (!isSignup && event.deduplicationKey.slice(config.key.length) !== tokenId) {
        await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
          state: "FAILED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
          lastErrorCode: "PAYLOAD_BINDING_INVALID", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      const tokenRows = await tx.$queryRaw<Array<{ identifier: string; value: string; createdAt: Date; expiresAt: Date }>>`
        SELECT identifier, value, "createdAt", "expiresAt" FROM "verification" WHERE id = ${tokenId} FOR UPDATE
      `;
      const tokenRow = tokenRows[0];
      let recipient: string | undefined;
      if (!tokenRow || tokenRow.identifier !== config.namespace + account.userId || tokenRow.createdAt > now ||
          tokenRow.expiresAt <= now || tokenRow.expiresAt.getTime() !== delivery.expiresAt.getTime()) {
        await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
          state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
          lastErrorCode: "STALE_TOKEN", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      if (config.kind === "EMAIL_CHANGE") {
        let binding;
        try { binding = emailChangeBindingSchema.safeParse(JSON.parse(tokenRow.value)); }
        catch { binding = { success: false as const }; }
        if (!binding.success || binding.data.accountId !== event.accountId || binding.data.currentEmail !== account.email ||
            !account.emailVerified || !account.emailVerifiedAt || account.emailVerifiedAt > now ||
            !hasAdultEligibility(account.dateOfBirth, account.adultAttestedAt, now) ||
            await tx.user.findUnique({ where: { email: binding.data.proposedEmail }, select: { id: true } })) {
          await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
            state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "STALE_EMAIL_CHANGE", ciphertext: new Uint8Array(),
          } });
          return null;
        }
        recipient = binding.data.proposedEmail;
      } else {
        if (tokenRow.value !== account.email ||
            (config.kind === "VERIFY" && (account.emailVerified || account.emailVerifiedAt !== null))) {
          await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
            state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "STALE_ADDRESS", ciphertext: new Uint8Array(),
          } });
          return null;
        }
        if (config.kind === "RESET") {
          const credential = await tx.$queryRaw<Array<{ hasPassword: boolean }>>`
            SELECT (password IS NOT NULL AND password <> '') AS "hasPassword" FROM "account"
            WHERE "userId" = ${account.userId} AND "providerId" = 'credential' FOR UPDATE
          `;
          if (credential.length !== 1 || !credential[0].hasPassword) {
            await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
              state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
              lastErrorCode: "STALE_CREDENTIAL", ciphertext: new Uint8Array(),
            } });
            return null;
          }
        }
        recipient = account.email;
      }
      const latest = clock();
      if (tokenRow.expiresAt <= latest || delivery.expiresAt <= latest) {
        await tx.accountEmailDelivery.update({ where: { id: job.id }, data: {
          state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: latest,
          lastErrorCode: "TOKEN_EXPIRED", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      await tx.accountEmailDelivery.update({ where: { id: job.id }, data: { state: "SENDING" } });
      const origin = process.env.HALAGA_PUBLIC_ORIGIN;
      if (!origin) throw new Error("EMAIL_ORIGIN_CONFIG");
      const actionUrl = accountEmailActionUrl(config.kind, token);
      return { kind: config.kind, message: renderAccountEmail(config.kind, recipient!, actionUrl) };
    });
  }

  async function finish(job: Job, state: "ACCEPTED" | "FAILED" | "UNKNOWN", code: string | null,
    messageId?: string | null) {
    const now = clock();
    await database.$transaction(async (tx) => {
      const updated = await tx.accountEmailDelivery.updateMany({ where: {
        id: job.id, state: "SENDING", leaseId: job.leaseId,
      }, data: { state, leaseId: null, leaseExpiresAt: null, terminalAt: now,
        lastErrorCode: code, providerMessageId: messageId ?? null, acceptedAt: state === "ACCEPTED" ? now : null,
        ciphertext: state === "ACCEPTED" ? new Uint8Array() : undefined },
      });
      if (updated.count === 1 && state === "ACCEPTED") {
        const row = await tx.accountEmailDelivery.findUnique({ where: { id: job.id }, select: { outboxEventId: true } });
        if (row) await tx.outboxEvent.update({ where: { id: row.outboxEventId }, data: { dispatchedAt: now } });
      }
    });
  }

  async function retry(job: Job, code: "RATE_LIMIT") {
    const now = clock();
    if (job.attemptCount >= maxAttempts) return finish(job, "FAILED", code);
    const delay = Math.min(60 * 60_000, 30_000 * 2 ** (job.attemptCount - 1));
    await database.accountEmailDelivery.updateMany({ where: { id: job.id, state: "SENDING", leaseId: job.leaseId },
      data: { state: "READY", leaseId: null, leaseExpiresAt: null, availableAt: new Date(now.getTime() + delay),
        lastErrorCode: code } });
  }

  return {
    async dispatchOne(): Promise<DispatchResult> {
      const job = await claim();
      if (!job) return { status: "EMPTY" };
      let prepared: Awaited<ReturnType<typeof prepare>>;
      try { prepared = await prepare(job); }
      catch {
        await markTerminal(job, "FAILED", "PREPARATION_FAILED", clock());
        return { status: "FAILED" };
      }
      if (!prepared) return { status: "SUPPRESSED" };
      try {
        const messageId = await send(prepared.message);
        await finish(job, "ACCEPTED", null, messageId);
        return { status: "ACCEPTED" };
      } catch (error) {
        if (error instanceof BrevoSendError && error.category === "RATE_LIMIT") {
          await retry(job, "RATE_LIMIT");
          return job.attemptCount >= maxAttempts ? { status: "FAILED" } : { status: "RETRY_SCHEDULED" };
        }
        await finish(job, error instanceof BrevoSendError && error.category === "REJECTED" ? "FAILED" : "UNKNOWN",
          error instanceof BrevoSendError && error.category === "REJECTED" ? "PROVIDER_REJECTED" : "PROVIDER_OUTCOME_UNKNOWN");
        return error instanceof BrevoSendError && error.category === "REJECTED" ? { status: "FAILED" } : { status: "UNKNOWN" };
      }
    },

    async recoverAndClean(): Promise<void> {
      const now = clock();
      await database.$transaction(async (tx) => {
        await tx.accountEmailDelivery.updateMany({ where: { state: "LEASED", leaseExpiresAt: { lte: now }, attemptCount: { lt: maxAttempts } },
          data: { state: "READY", leaseId: null, leaseExpiresAt: null, lastErrorCode: "LEASE_RECOVERED" } });
        await tx.accountEmailDelivery.updateMany({ where: { state: "LEASED", leaseExpiresAt: { lte: now }, attemptCount: { gte: maxAttempts } },
          data: { state: "FAILED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "LEASE_RETRY_LIMIT" } });
        await tx.accountEmailDelivery.updateMany({ where: { state: "SENDING", leaseExpiresAt: { lte: now } },
          data: { state: "UNKNOWN", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "WORKER_CRASH_AFTER_SEND_STARTED" } });
        await tx.accountEmailDelivery.updateMany({ where: { state: "READY", expiresAt: { lte: now } },
          data: { state: "SUPPRESSED", terminalAt: now, lastErrorCode: "EXPIRED", ciphertext: new Uint8Array() } });
        await tx.accountEmailDelivery.updateMany({ where: { expiresAt: { lte: now } },
          data: { ciphertext: new Uint8Array() } });
        await tx.outboxEvent.deleteMany({ where: { emailDelivery: { is: { terminalAt: { lte: new Date(now.getTime() - retentionMs) } } } } });
        for (const identifier of ["halaga-email-verification:", "halaga-password-reset:", "halaga-email-change:"]) {
          await tx.verification.deleteMany({ where: { identifier: { startsWith: identifier }, expiresAt: { lte: now } } });
        }
      });
    },
  };
}

export async function dispatchOneAccountEmail() {
  return createAccountEmailDispatcher(getPrisma()).dispatchOne();
}
