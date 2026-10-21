import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { accountEmailTokenRecord } from "../account-email-crypto.ts";
import { passwordChangeEmailEvent, passwordChangeDeliveryMs, passwordChangeNoticeMs } from "../password-change-notice-policy.ts";

const inputSchema = z.strictObject({ currentPassword: z.string().min(1), newPassword: z.string().min(1) });

export class PasswordChangeRejected extends Error {
  readonly code: "INVALID_INPUT" | "UNAUTHORIZED" | "INVALID_STATE" | "INVALID_PASSWORD" | "INTERNAL_ERROR";

  constructor(code: PasswordChangeRejected["code"]) {
    super(code);
    this.name = "PasswordChangeRejected";
    this.code = code;
  }
}

function requireFreshSession(session: { createdAt: Date; expiresAt: Date } | undefined, clock: () => Date) {
  const now = clock();
  if (!Number.isFinite(now.getTime())) throw new PasswordChangeRejected("INTERNAL_ERROR");
  if (!session || session.expiresAt <= now || session.createdAt > now ||
      now.getTime() - session.createdAt.getTime() >= 15 * 60 * 1000) {
    throw new PasswordChangeRejected("UNAUTHORIZED");
  }
}

/** Account-owned command behind the protected password-change HTTP handler only.
 * Request headers resolve the owner; no caller-selected account/session ID is accepted.
 * Direct writes bypass library hooks. ADR-087/089 notices commit with credentials.
 */
export function createPasswordChangeOperation(
  database: ReturnType<typeof getPrisma>,
  auth: Pick<ReturnType<typeof createAccountAuth>, "api" | "$context">,
  clock: () => Date = () => new Date(),
) {
  return async (headers: Headers, input: unknown, applySessionHeaders: (headers: Headers) => void):
    Promise<{ status: "PASSWORD_CHANGED" }> => {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new PasswordChangeRejected("INVALID_INPUT");
    try {
      // No rolling-renewal write before the transaction: failed changes preserve sessions.
      const resolved = await auth.api.getSession({ headers, returnHeaders: true,
        query: { disableCookieCache: true, disableRefresh: true } });
      applySessionHeaders(resolved.headers);
      const actor = resolved.response;
      if (!actor || actor.session.userId !== actor.user.id) throw new PasswordChangeRejected("UNAUTHORIZED");
      requireFreshSession(actor.session, clock);
      const owner = await database.userAccount.findUnique({ where: { authUserId: actor.user.id }, select: { id: true } });
      if (!owner) throw new PasswordChangeRejected("INVALID_STATE");
      const { password } = await auth.$context;
      if (parsed.data.newPassword.length < password.config.minPasswordLength ||
          parsed.data.newPassword.length > password.config.maxPasswordLength ||
          parsed.data.currentPassword.length > password.config.maxPasswordLength) {
        throw new PasswordChangeRejected("INVALID_INPUT");
      }
      // Expensive new hash outside locks; all authoritative guards are reread afterward.
      const hash = await password.hash(parsed.data.newPassword);
      return await database.$transaction(async (transaction) => {
        // Share identity/domain -> credential -> session lock order with reset/verification.
        await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT a.id
          FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
          WHERE u.id = ${actor.user.id} FOR UPDATE OF u, a
        `;
        // Read both verification stores in a new statement after acquiring both locks.
        const account = await transaction.userAccount.findUnique({ where: { authUserId: actor.user.id },
          select: { id: true, deletedAt: true, emailVerifiedAt: true, authUser: { select: { email: true, emailVerified: true } } } });
        if (!account || account.id !== owner.id || account.deletedAt) throw new PasswordChangeRejected("INVALID_STATE");
        const credentials = await transaction.$queryRaw<Array<{ id: string; accountId: string; password: string | null }>>`
          SELECT id, "accountId", password FROM "account"
          WHERE "userId" = ${actor.user.id} AND "providerId" = 'credential' FOR UPDATE
        `;
        const credential = credentials[0];
        if (credentials.length !== 1 || credential.accountId !== actor.user.id || !credential.password) {
          throw new PasswordChangeRejected("INVALID_STATE");
        }
        const sessions = await transaction.$queryRaw<Array<{ createdAt: Date; expiresAt: Date }>>`
          SELECT "createdAt", "expiresAt" FROM "session"
          WHERE id = ${actor.session.id} AND "userId" = ${actor.user.id} AND token = ${actor.session.token}
          FOR UPDATE
        `;
        requireFreshSession(sessions[0], clock);
        // Verify the CURRENT locked hash, so competing changes cannot reuse an old password.
        if (!await password.verify({ hash: credential.password, password: parsed.data.currentPassword })) {
          throw new PasswordChangeRejected("INVALID_PASSWORD");
        }
        const eventTime = clock();
        // Verification can cross the freshness/expiry boundary.
        requireFreshSession(sessions[0], () => eventTime);
        const emailEligible = account.authUser.emailVerified && account.emailVerifiedAt !== null && account.emailVerifiedAt <= eventTime;
        // Opaque event identity: never derive work keys from passwords, sessions or addresses.
        const changeId = randomUUID();
        await transaction.account.update({ where: { id: credential.id }, data: { password: hash }, select: { id: true } });
        await transaction.session.deleteMany({ where: { userId: actor.user.id, id: { not: actor.session.id } } });
        // The unique row is both the in-app notice and its processed-work record.
        // No asynchronous materializer can duplicate it. Rollback removes all effects.
        await transaction.passwordChangeNotice.create({ data: {
          id: changeId, accountId: account.id, eventType: "account.password-changed", eventVersion: 1,
          inAppWorkKey: `password-changed-in-app:${changeId}`, createdAt: eventTime,
          emailEligibility: emailEligible ? "ELIGIBLE" : "INELIGIBLE",
        }, select: { id: true } });
        if (emailEligible) {
          const outboxEventId = randomUUID();
          const deduplicationKey = `password-changed-email:${changeId}`;
          await transaction.outboxEvent.create({ data: {
            id: outboxEventId, accountId: account.id, eventType: passwordChangeEmailEvent,
            eventVersion: 1, deduplicationKey, recipientEmail: account.authUser.email, createdAt: eventTime,
          }, select: { id: true } });
          await transaction.accountEmailDelivery.create({ data: {
            ...accountEmailTokenRecord("", { outboxEventId, accountId: account.id,
              eventType: passwordChangeEmailEvent, eventVersion: 1, deduplicationKey },
            new Date(eventTime.getTime() + passwordChangeDeliveryMs)),
            availableAt: eventTime, createdAt: eventTime,
          }, select: { id: true } });
        }
        // Preserve current session exactly, verification, tokens and account history.
        return { status: "PASSWORD_CHANGED" as const };
      });
    } catch (error) {
      if (error instanceof PasswordChangeRejected) throw error;
      // No raw database/library failure, password, hash, session or cause escapes.
      throw new PasswordChangeRejected("INTERNAL_ERROR");
    }
  };
}

export type PasswordChangeNoticeDetail = Readonly<{
  id: string; eventType: string; eventVersion: number; createdAt: Date; readAt: Date | null;
}>;

/** Owner-only security history. No generic/staff reader or email status. */
export function createPasswordChangeNoticeReader(
  database: ReturnType<typeof getPrisma>,
  auth: Pick<ReturnType<typeof createAccountAuth>, "api">,
  clock: () => Date = () => new Date(),
) {
  return async (headers: Headers, noticeId: unknown, applySessionHeaders: (headers: Headers) => void):
    Promise<PasswordChangeNoticeDetail | null> => {
    const parsed = z.uuid().safeParse(noticeId);
    if (!parsed.success) throw new PasswordChangeRejected("INVALID_INPUT");
    try {
      const resolved = await auth.api.getSession({ headers, returnHeaders: true,
        query: { disableCookieCache: true, disableRefresh: true } });
      applySessionHeaders(resolved.headers);
      const actor = resolved.response;
      if (!actor || actor.session.userId !== actor.user.id) return null;
      const now = clock();
      if (!Number.isFinite(now.getTime())) throw new PasswordChangeRejected("INTERNAL_ERROR");
      // One statement rechecks ownership/deletion and the exact stored session;
      // the earlier auth snapshot alone cannot authorize reading this event.
      return await database.passwordChangeNotice.findFirst({ where: {
        id: parsed.data, createdAt: { gt: new Date(now.getTime() - passwordChangeNoticeMs), lte: now },
        account: { authUserId: actor.user.id, deletedAt: null,
          authUser: { sessions: { some: { id: actor.session.id, userId: actor.user.id,
            token: actor.session.token, expiresAt: { gt: now }, createdAt: { lte: now } } } } },
      }, select: { id: true, eventType: true, eventVersion: true, createdAt: true, readAt: true } });
    } catch {
      throw new PasswordChangeRejected("INTERNAL_ERROR");
    }
  };
}

/** Lists only unexpired notices for the exact current stored session and owner. */
export function createPasswordChangeNoticeListReader(
  database: ReturnType<typeof getPrisma>,
  auth: Pick<ReturnType<typeof createAccountAuth>, "api">,
  clock: () => Date = () => new Date(),
) {
  return async (headers: Headers, applySessionHeaders: (headers: Headers) => void):
    Promise<readonly PasswordChangeNoticeDetail[] | null> => {
    try {
      const resolved = await auth.api.getSession({ headers, returnHeaders: true,
        query: { disableCookieCache: true, disableRefresh: true } });
      applySessionHeaders(resolved.headers);
      const actor = resolved.response;
      if (!actor || actor.session.userId !== actor.user.id) return null;
      const now = clock();
      if (!Number.isFinite(now.getTime())) throw new PasswordChangeRejected("INTERNAL_ERROR");
      return await database.passwordChangeNotice.findMany({ where: {
        createdAt: { gt: new Date(now.getTime() - passwordChangeNoticeMs), lte: now },
        account: { authUserId: actor.user.id, deletedAt: null,
          authUser: { sessions: { some: { id: actor.session.id, userId: actor.user.id,
            token: actor.session.token, expiresAt: { gt: now }, createdAt: { lte: now } } } } },
      }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, eventType: true, eventVersion: true, createdAt: true, readAt: true } });
    } catch {
      throw new PasswordChangeRejected("INTERNAL_ERROR");
    }
  };
}

/** Marks one unexpired notice read under account -> session -> notice locks. */
export function createPasswordChangeNoticeReadMarker(
  database: ReturnType<typeof getPrisma>,
  auth: Pick<ReturnType<typeof createAccountAuth>, "api">,
  clock: () => Date = () => new Date(),
) {
  return async (headers: Headers, noticeId: unknown, applySessionHeaders: (headers: Headers) => void):
    Promise<Readonly<{ id: string; readAt: Date }> | null> => {
    const parsed = z.uuid().safeParse(noticeId);
    if (!parsed.success) throw new PasswordChangeRejected("INVALID_INPUT");
    try {
      const resolved = await auth.api.getSession({ headers, returnHeaders: true,
        query: { disableCookieCache: true, disableRefresh: true } });
      applySessionHeaders(resolved.headers);
      const actor = resolved.response;
      if (!actor || actor.session.userId !== actor.user.id) throw new PasswordChangeRejected("UNAUTHORIZED");
      const now = clock();
      if (!Number.isFinite(now.getTime())) throw new PasswordChangeRejected("INTERNAL_ERROR");
      return await database.$transaction(async (transaction) => {
        const owners = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT a.id FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
          WHERE u.id = ${actor.user.id} AND a."deletedAt" IS NULL
          FOR UPDATE OF u, a
        `;
        if (owners.length !== 1) throw new PasswordChangeRejected("UNAUTHORIZED");
        const sessions = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "session" WHERE id = ${actor.session.id} AND "userId" = ${actor.user.id}
            AND token = ${actor.session.token} AND "expiresAt" > ${now} AND "createdAt" <= ${now}
          FOR UPDATE
        `;
        if (sessions.length !== 1) throw new PasswordChangeRejected("UNAUTHORIZED");
        const notices = await transaction.$queryRaw<Array<{ id: string; readAt: Date | null }>>`
          SELECT id, "readAt" FROM "password_change_notice"
          WHERE id = ${parsed.data} AND "accountId" = ${owners[0].id}
            AND "createdAt" > ${new Date(now.getTime() - passwordChangeNoticeMs)} AND "createdAt" <= ${now}
          FOR UPDATE
        `;
        if (notices.length !== 1) return null;
        if (notices[0].readAt === null) {
          await transaction.passwordChangeNotice.update({ where: { id: parsed.data }, data: { readAt: now }, select: { id: true } });
        }
        return { id: parsed.data, readAt: notices[0].readAt ?? now };
      });
    } catch (error) {
      if (error instanceof PasswordChangeRejected) throw error;
      throw new PasswordChangeRejected("INTERNAL_ERROR");
    }
  };
}
