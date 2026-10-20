import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { hasAdultEligibility } from "../account-access.ts";
import { decryptAccountEmailToken, type EmailTokenContext } from "../account-email-crypto.ts";
import { accountEmailActionUrl, sendBrevoEmail, BrevoSendError } from "../account-email-provider.ts";
import { renderAccountEmail, type AccountEmailKind, type AccountEmailMessage } from "../account-email-templates.ts";
import { getPrisma } from "../prisma.ts";
import { emailChangeBindingSchema } from "./email-change.ts";
import { passwordChangeEmailEvent, passwordChangeDeliveryMs, passwordChangeMetadataMs,
  passwordChangeMetadataCapMs, passwordChangeNoticeMs } from "../password-change-notice-policy.ts";

const tokenKinds = {
  "account.verification-email-requested": { kind: "VERIFY", namespace: "halaga-email-verification:", key: "verification-email:" },
  "account.password-reset-email-requested": { kind: "RESET", namespace: "halaga-password-reset:", key: "password-reset-email:" },
  "account.email-change-verification-requested": { kind: "EMAIL_CHANGE", namespace: "halaga-email-change:", key: "email-change-verification:" },
} as const;
const maxAttempts = 5;
const leaseMs = 120_000;
const retentionMs = 30 * 24 * 60 * 60 * 1000;
const emailSchema = z.email().refine((value) => value === value.toLowerCase());

type DispatchResult = Readonly<{ status: "DISABLED" | "EMPTY" | "LEASE_LOST" | "ACCEPTED" | "RETRY_SCHEDULED" | "SUPPRESSED" | "FAILED" | "UNKNOWN" }>;
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

  async function preparePasswordNotice(tx: Parameters<Parameters<typeof database.$transaction>[0]>[0], job: Job, accountId: string) {
    // Never select the current address/verification: the committed snapshot owns delivery.
    const accounts = await tx.$queryRaw<Array<{ deletedAt: Date | null }>>`
      SELECT "deletedAt" FROM "user_account" WHERE id = ${accountId}::uuid FOR UPDATE
    `;
    await tx.$queryRaw`SELECT id FROM "account_email_delivery" WHERE id = ${job.id}::uuid FOR UPDATE`;
    const delivery = await tx.accountEmailDelivery.findUnique({ where: { id: job.id }, select: {
      state: true, leaseId: true, leaseExpiresAt: true, expiresAt: true, outboxEvent: { select: {
        id: true, accountId: true, eventType: true, eventVersion: true, deduplicationKey: true,
        createdAt: true, dispatchedAt: true, recipientEmail: true,
      } },
    } });
    const now = clock(); // Reread state, snapshot and time after all lock waits.
    if (!delivery || delivery.state !== "LEASED" || delivery.leaseId !== job.leaseId ||
        !delivery.leaseExpiresAt || delivery.leaseExpiresAt <= now) return null;
    const event = delivery.outboxEvent;
    if (!accounts[0] || accounts[0].deletedAt || event.accountId !== accountId ||
        event.eventType !== passwordChangeEmailEvent || event.eventVersion !== 1 ||
        !/^password-changed-email:[0-9a-f-]{36}$/.test(event.deduplicationKey) || !isEmail(event.recipientEmail) ||
        event.createdAt > now || event.dispatchedAt || delivery.expiresAt <= now ||
        delivery.expiresAt.getTime() !== event.createdAt.getTime() + passwordChangeDeliveryMs) {
      await tx.accountEmailDelivery.update({ where: { id: job.id }, data: { state: "SUPPRESSED",
        leaseId: null, leaseExpiresAt: null, terminalAt: delivery.expiresAt <= now ? delivery.expiresAt : now,
        lastErrorCode: "STALE_NOTICE", ciphertext: new Uint8Array() } });
      await tx.outboxEvent.update({ where: { id: event.id }, data: { recipientEmail: null } });
      return null;
    }
    await tx.accountEmailDelivery.update({ where: { id: job.id }, data: { state: "SENDING" } });
    return { kind: "PASSWORD_CHANGED" as const,
      message: renderAccountEmail("PASSWORD_CHANGED", event.recipientEmail, undefined, event.createdAt) };
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
      if (event?.eventType === passwordChangeEmailEvent) return preparePasswordNotice(tx, job, event.accountId);
      const now = clock();
      if (!delivery || !event || delivery.state !== "LEASED" || delivery.leaseId !== job.leaseId ||
          !delivery.leaseExpiresAt || delivery.leaseExpiresAt <= now) return null;
      if (delivery.expiresAt <= now || event.dispatchedAt || event.eventVersion !== 1) {
        await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
          state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
          lastErrorCode: "STALE_OR_EXPIRED", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      if (event.eventType === "account.email-changed-security-notice") {
        const accounts = await tx.$queryRaw<Array<{ deletedAt: Date | null }>>`
          SELECT "deletedAt" FROM "user_account" WHERE id = ${event.accountId}::uuid FOR UPDATE
        `;
        const account = accounts[0];
        if (!account || account.deletedAt || !isEmail(event.recipientEmail) ||
            !/^email-changed-notice:halaga-email-change:[a-f0-9]{64}$/.test(event.deduplicationKey)) {
          await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
            state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "STALE_NOTICE", ciphertext: new Uint8Array(),
          } });
          return null;
        }
        const started = await tx.accountEmailDelivery.updateMany({ where: {
          id: job.id, state: "LEASED", leaseId: job.leaseId,
          leaseExpiresAt: { gt: clock() }, expiresAt: { gt: clock() },
        }, data: { state: "SENDING" } });
        if (started.count !== 1) return null;
        return { kind: "EMAIL_CHANGED" as const, message: renderAccountEmail("EMAIL_CHANGED", event.recipientEmail) };
      }

      const config = Object.hasOwn(tokenKinds, event.eventType)
        ? tokenKinds[event.eventType as keyof typeof tokenKinds] : undefined;
      const isSignup = config?.kind === "VERIFY" && event.deduplicationKey === `signup-verification:${event.accountId}`;
      if (!config || (!isSignup && (!event.deduplicationKey.startsWith(config.key + config.namespace) ||
          !/^[a-f0-9]{64}$/.test(event.deduplicationKey.slice((config.key + config.namespace).length))))) {
        await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
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
        await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
          state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
          lastErrorCode: "STALE_ACCOUNT", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      const token = decryptAccountEmailToken(delivery.keyId, delivery.ciphertext, contextOf(event));
      const tokenId = config.namespace + createHash("sha256").update(token).digest("hex");
      if (!isSignup && event.deduplicationKey.slice(config.key.length) !== tokenId) {
        await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
          state: "FAILED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
          lastErrorCode: "PAYLOAD_BINDING_INVALID", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      // Match command lock order: identity/mapping, credential, then token/job.
      if (config.kind === "RESET") {
        const credential = await tx.$queryRaw<Array<{ accountId: string; hasPassword: boolean }>>`
          SELECT "accountId", (password IS NOT NULL AND password <> '') AS "hasPassword" FROM "account"
          WHERE "userId" = ${account.userId} AND "providerId" = 'credential' FOR UPDATE
        `;
        if (credential.length !== 1 || credential[0].accountId !== account.userId || !credential[0].hasPassword) {
          await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
            state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: clock(),
            lastErrorCode: "STALE_CREDENTIAL", ciphertext: new Uint8Array(),
          } });
          return null;
        }
      }
      const tokenRows = await tx.$queryRaw<Array<{ identifier: string; value: string; createdAt: Date; expiresAt: Date }>>`
        SELECT identifier, value, "createdAt", "expiresAt" FROM "verification" WHERE id = ${tokenId} FOR UPDATE
      `;
      const tokenRow = tokenRows[0];
      let recipient: string | undefined;
      if (!tokenRow || tokenRow.identifier !== config.namespace + account.userId || tokenRow.createdAt > now ||
          tokenRow.expiresAt <= now || tokenRow.expiresAt.getTime() !== delivery.expiresAt.getTime()) {
        await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
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
          await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
            state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "STALE_EMAIL_CHANGE", ciphertext: new Uint8Array(),
          } });
          return null;
        }
        recipient = binding.data.proposedEmail;
      } else {
        if (tokenRow.value !== account.email ||
            (config.kind === "VERIFY" && (account.emailVerified || account.emailVerifiedAt !== null))) {
          await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
            state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "STALE_ADDRESS", ciphertext: new Uint8Array(),
          } });
          return null;
        }
        recipient = account.email;
      }
      const latest = clock();
      if (tokenRow.expiresAt <= latest || delivery.expiresAt <= latest) {
        await tx.accountEmailDelivery.updateMany({ where: { id: job.id, state: "LEASED", leaseId: job.leaseId }, data: {
          state: "SUPPRESSED", leaseId: null, leaseExpiresAt: null, terminalAt: latest,
          lastErrorCode: "TOKEN_EXPIRED", ciphertext: new Uint8Array(),
        } });
        return null;
      }
      const started = await tx.accountEmailDelivery.updateMany({ where: {
        id: job.id, state: "LEASED", leaseId: job.leaseId, leaseExpiresAt: { gt: latest },
      }, data: { state: "SENDING" } });
      if (started.count !== 1) return null;
      const origin = process.env.HALAGA_PUBLIC_ORIGIN;
      if (!origin) throw new Error("EMAIL_ORIGIN_CONFIG");
      const actionUrl = accountEmailActionUrl(config.kind, token);
      return { kind: config.kind, message: renderAccountEmail(config.kind, recipient!, actionUrl) };
    });
  }

  async function finish(job: Job, state: "ACCEPTED" | "FAILED" | "UNKNOWN", code: string | null,
    messageId?: string | null) {
    const now = clock();
    return database.$transaction(async (tx) => {
      const updated = await tx.accountEmailDelivery.updateMany({ where: {
        id: job.id, state: "SENDING", leaseId: job.leaseId,
      }, data: { state, leaseId: null, leaseExpiresAt: null, terminalAt: now,
        lastErrorCode: code, providerMessageId: messageId ?? null, acceptedAt: state === "ACCEPTED" ? now : null,
        ciphertext: state === "ACCEPTED" ? new Uint8Array() : undefined },
      });
      if (updated.count === 1 && state === "ACCEPTED") {
        const row = await tx.accountEmailDelivery.findUnique({ where: { id: job.id }, select: {
          outboxEventId: true, outboxEvent: { select: { eventType: true } },
        } });
        if (row) await tx.outboxEvent.update({ where: { id: row.outboxEventId }, data: { dispatchedAt: now,
          ...(row.outboxEvent.eventType === passwordChangeEmailEvent ? { recipientEmail: null } : {}) } });
      } else if (updated.count === 1) {
        const row = await tx.accountEmailDelivery.findUnique({ where: { id: job.id }, select: {
          outboxEventId: true, expiresAt: true, outboxEvent: { select: { eventType: true } },
        } });
        if (row?.outboxEvent.eventType === passwordChangeEmailEvent && row.expiresAt <= now) {
          await tx.outboxEvent.update({ where: { id: row.outboxEventId }, data: { recipientEmail: null } });
        }
      }
      return updated.count === 1;
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

  async function recoverPasswordChanges() {
    // ponytail: scan accounts with this bounded work; batch by account if measured volume requires it.
    const accounts = await database.userAccount.findMany({ where: { OR: [
      { outboxEvents: { some: { eventType: passwordChangeEmailEvent } } },
      { passwordChangeNotices: { some: {} } },
    ] }, orderBy: { id: "asc" }, select: { id: true } });
    for (const account of accounts) await database.$transaction(async (tx) => {
      const owners = await tx.$queryRaw<Array<{ deletedAt: Date | null }>>`
        SELECT "deletedAt" FROM "user_account" WHERE id = ${account.id}::uuid FOR UPDATE
      `;
      // Take job locks before any outbox erasure/purge, matching acknowledgement/deletion.
      const jobs = await tx.$queryRaw<Array<{ id: string; outboxEventId: string; state: string;
        attemptCount: number; leaseExpiresAt: Date | null; expiresAt: Date; terminalAt: Date | null; createdAt: Date }>>`
        SELECT d.id, d."outboxEventId", d.state, d."attemptCount", d."leaseExpiresAt", d."expiresAt",
               d."terminalAt", e."createdAt"
        FROM "account_email_delivery" d JOIN "outbox_event" e ON e.id = d."outboxEventId"
        WHERE e."accountId" = ${account.id}::uuid AND e."eventType" = ${passwordChangeEmailEvent}
        ORDER BY d.id FOR UPDATE OF d
      `;
      const now = clock();
      const deleted = !owners[0] || Boolean(owners[0].deletedAt);
      for (const job of jobs) {
        let state = job.state;
        let terminalAt = job.terminalAt;
        let code: string | undefined;
        if (deleted || job.expiresAt <= now) {
          if (["READY", "LEASED", "SENDING"].includes(state)) {
            state = state === "SENDING" ? "UNKNOWN" : "SUPPRESSED";
            terminalAt = deleted ? owners[0]?.deletedAt ?? now : job.expiresAt;
            code = deleted ? "ACCOUNT_DELETED" : "EXPIRED";
          }
        } else if (job.leaseExpiresAt && job.leaseExpiresAt <= now) {
          if (state === "SENDING") {
            state = "UNKNOWN"; terminalAt = job.leaseExpiresAt; code = "WORKER_CRASH_AFTER_SEND_STARTED";
          } else if (state === "LEASED") {
            state = job.attemptCount < maxAttempts ? "READY" : "FAILED";
            terminalAt = state === "FAILED" ? job.leaseExpiresAt : null;
            code = state === "FAILED" ? "LEASE_RETRY_LIMIT" : "LEASE_RECOVERED";
          }
        }
        const erase = deleted || job.expiresAt <= now || state === "ACCEPTED" || state === "SUPPRESSED";
        if (state !== job.state || erase) {
          await tx.accountEmailDelivery.update({ where: { id: job.id }, data: { state, terminalAt,
            ...(state !== job.state ? { leaseId: null, leaseExpiresAt: null, lastErrorCode: code } : {}),
            ...(erase ? { ciphertext: new Uint8Array() } : {}) } });
        }
        if (erase) await tx.outboxEvent.update({ where: { id: job.outboxEventId }, data: { recipientEmail: null } });
        if ((terminalAt && terminalAt.getTime() + passwordChangeMetadataMs <= now.getTime()) ||
            job.createdAt.getTime() + passwordChangeMetadataCapMs <= now.getTime()) {
          await tx.outboxEvent.delete({ where: { id: job.outboxEventId } });
        }
      }
      await tx.passwordChangeNotice.deleteMany({ where: { accountId: account.id,
        ...(deleted ? {} : { createdAt: { lte: new Date(now.getTime() - passwordChangeNoticeMs) } }) } });
    });
  }

  return {
    async dispatchOne(): Promise<DispatchResult> {
      // A configured API key alone must never enable provider sending or consume work.
      if (send === sendBrevoEmail && process.env.ACCOUNT_EMAIL_SENDING_ENABLED !== "true") return { status: "DISABLED" };
      const job = await claim();
      if (!job) return { status: "EMPTY" };
      let prepared: Awaited<ReturnType<typeof prepare>>;
      try { prepared = await prepare(job); }
      catch {
        await markTerminal(job, "FAILED", "PREPARATION_FAILED", clock());
        return { status: "FAILED" };
      }
      if (!prepared) {
        const current = await database.accountEmailDelivery.findUnique({ where: { id: job.id }, select: { state: true } });
        const status = current?.state;
        return { status: status === "FAILED" || status === "UNKNOWN" || status === "SUPPRESSED" ? status : "LEASE_LOST" };
      }
      try {
        const messageId = await send(prepared.message);
        const recorded = await finish(job, "ACCEPTED", null, messageId);
        return { status: recorded ? "ACCEPTED" : "UNKNOWN" };
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
      await recoverPasswordChanges();
      const now = clock();
      const legacy = { outboxEvent: { eventType: { not: passwordChangeEmailEvent } } };
      await database.$transaction(async (tx) => {
        await tx.accountEmailDelivery.updateMany({ where: { ...legacy, state: "LEASED", leaseExpiresAt: { lte: now }, attemptCount: { lt: maxAttempts } },
          data: { state: "READY", leaseId: null, leaseExpiresAt: null, lastErrorCode: "LEASE_RECOVERED" } });
        await tx.accountEmailDelivery.updateMany({ where: { ...legacy, state: "LEASED", leaseExpiresAt: { lte: now }, attemptCount: { gte: maxAttempts } },
          data: { state: "FAILED", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "LEASE_RETRY_LIMIT" } });
        await tx.accountEmailDelivery.updateMany({ where: { ...legacy, state: "SENDING", leaseExpiresAt: { lte: now } },
          data: { state: "UNKNOWN", leaseId: null, leaseExpiresAt: null, terminalAt: now,
            lastErrorCode: "WORKER_CRASH_AFTER_SEND_STARTED" } });
        await tx.accountEmailDelivery.updateMany({ where: { ...legacy, state: "READY", expiresAt: { lte: now } },
          data: { state: "SUPPRESSED", terminalAt: now, lastErrorCode: "EXPIRED", ciphertext: new Uint8Array() } });
        await tx.accountEmailDelivery.updateMany({ where: { ...legacy, expiresAt: { lte: now } },
          data: { ciphertext: new Uint8Array() } });
        await tx.outboxEvent.deleteMany({ where: { eventType: { not: passwordChangeEmailEvent },
          emailDelivery: { is: { terminalAt: { lte: new Date(now.getTime() - retentionMs) } } } } });
      });
      // Independent retention writes must not hold job locks while waiting on tokens:
      // dispatch holds token then job; account replacement serializes under account locks.
      for (const identifier of ["halaga-email-verification:", "halaga-password-reset:", "halaga-email-change:"]) {
        await database.verification.deleteMany({ where: { identifier: { startsWith: identifier }, expiresAt: { lte: now } } });
      }
    },
  };
}

export async function dispatchOneAccountEmail() {
  return createAccountEmailDispatcher(getPrisma()).dispatchOne();
}
