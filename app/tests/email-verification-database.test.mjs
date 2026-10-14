import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { createEmailVerificationOperations, EmailVerificationRejected } from "../src/server/repositories/email-verification.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { createAccountAccessReader } from "../src/server/repositories/accounts.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

const rejects = (code) => (error) => error instanceof EmailVerificationRejected &&
  error.code === code && error.message === code && error.cause === undefined;
const tokenId = (token) => "halaga-email-verification:" + createHash("sha256").update(token).digest("hex");

test("verification rejects malformed input before touching the database", async () => {
  const operations = createEmailVerificationOperations({ $transaction() { assert.fail("No database access"); } });
  for (const input of [null, {}, "invalid", "private@example.invalid\n"]) {
    await assert.rejects(operations.issue(input), rejects("INVALID_INPUT"));
  }
  for (const input of [null, {}, "", "x".repeat(64), "a".repeat(65)]) {
    await assert.rejects(operations.consume(input), rejects("INVALID_TOKEN"));
  }
});

test("isolated PostgreSQL email verification transactions", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  let now = new Date();
  const operations = createEmailVerificationOperations(database, () => now);
  const signup = createSignupOperation(database, auth, () => now);
  const password = "synthetic-verification-password-only";
  const fixture = async () => {
    const email = `verification-${randomUUID()}@example.invalid`;
    await signup({ email, password, displayName: "Synthetic verification adult", dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    const identity = await database.user.findUnique({ where: { email }, select: { id: true } });
    const account = await database.userAccount.findUnique({ where: { authUserId: identity.id }, select: { id: true } });
    return { email, userId: identity.id, accountId: account.id };
  };
  const state = async ({ userId, accountId }) => ({
    identity: await database.user.findUnique({ where: { id: userId }, select: { emailVerified: true } }),
    account: await database.userAccount.findUnique({ where: { id: accountId }, select: { emailVerifiedAt: true } }),
    sessions: await database.session.count({ where: { userId } }),
    tokens: await database.verification.findMany({ where: { identifier: `halaga-email-verification:${userId}` },
      select: { id: true, identifier: true, value: true, expiresAt: true, createdAt: true } }),
    intents: await database.outboxEvent.findMany({ where: { accountId }, orderBy: { deduplicationKey: "asc" },
      select: { accountId: true, eventType: true, eventVersion: true, deduplicationKey: true, dispatchedAt: true } }),
  });
  const signIn = async (account) => auth.api.signInEmail({ body: { email: account.email, password }, returnHeaders: true });
  const cookieHeaders = (result) => new Headers({ cookie: result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
  try {
    await connection.query(`CREATE FUNCTION synthetic_verification_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic-private-token-database-error'; END $$`);

    await t.test("24-hour token stores only a digest and private binding; success revokes sessions and requires fresh sign-in", async () => {
      const account = await fixture();
      const firstSession = await signIn(account);
      await signIn(account);
      const issued = await operations.issue(account.email.toUpperCase());
      assert.equal(issued.expiresAt.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
      const before = await state(account);
      assert.equal(before.sessions, 2);
      assert.equal(before.tokens.length, 1);
      assert.equal(before.tokens[0].id, tokenId(issued.token));
      assert.equal(before.tokens[0].value, account.email);
      assert.equal(before.tokens[0].createdAt.getTime(), now.getTime());
      assert.ok(!JSON.stringify(before).includes(issued.token));
      assert.equal(before.intents.length, 2); // Signup intent and token-specific intent.
      assert.ok(before.intents.every((intent) => intent.dispatchedAt === null));
      assert.ok(!JSON.stringify(before.intents).includes(account.email));
      const reader = createAccountAccessReader(auth, database);
      const oldHeaders = cookieHeaders(firstSession);
      assert.equal((await reader(oldHeaders, () => {})).emailVerified, false);
      assert.deepEqual(await operations.consume(issued.token), { status: "EMAIL_VERIFIED" });
      const after = await state(account);
      assert.deepEqual(after.identity, { emailVerified: true });
      assert.equal(after.account.emailVerifiedAt.getTime(), now.getTime());
      assert.equal(after.sessions, 0);
      assert.equal(after.tokens.length, 0);
      assert.deepEqual(after.intents, before.intents);
      assert.equal(await reader(oldHeaders, () => {}), null);
      const fresh = await signIn(account);
      assert.equal(fresh.response.user.emailVerified, true);
      assert.equal((await reader(cookieHeaders(fresh), () => {})).emailVerified, true);
      await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
    });

    await t.test("expiry at exactly 24 hours and later leaves verification, sessions and token unchanged", async () => {
      const account = await fixture();
      await signIn(account);
      const issued = await operations.issue(account.email);
      const before = await state(account);
      const savedNow = now;
      try {
        for (const offset of [0, 1]) {
          now = new Date(issued.expiresAt.getTime() + offset);
          await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
          assert.deepEqual(await state(account), before);
        }
      } finally { now = savedNow; }
    });

    await t.test("token remains valid one millisecond before expiry", async () => {
      const account = await fixture();
      const issued = await operations.issue(account.email);
      const savedNow = now;
      try {
        now = new Date(issued.expiresAt.getTime() - 1);
        assert.deepEqual(await operations.consume(issued.token), { status: "EMAIL_VERIFIED" });
      } finally { now = savedNow; }
    });

    await t.test("replacement invalidates the old token and resets the full 24-hour lifetime", async () => {
      const account = await fixture();
      const first = await operations.issue(account.email);
      const savedNow = now;
      let replacement;
      try {
        now = new Date(now.getTime() + 60 * 60 * 1000);
        replacement = await operations.issue(account.email);
        assert.notEqual(first.token, replacement.token);
        assert.equal(replacement.expiresAt.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
        assert.equal((await state(account)).tokens.length, 1);
        await assert.rejects(operations.consume(first.token), rejects("INVALID_TOKEN"));
        assert.deepEqual(await operations.consume(replacement.token), { status: "EMAIL_VERIFIED" });
      } finally { now = savedNow; }
    });

    await t.test("issue failures including deferred commit restore the old token and add no intent", async () => {
      const account = await fixture();
      const first = await operations.issue(account.email);
      const before = await state(account);
      for (const [table, timing, action, deferred] of [
        ["verification", "BEFORE", "DELETE", ""], ["verification", "BEFORE", "INSERT", ""],
        ["outbox_event", "BEFORE", "INSERT", ""], ["outbox_event", "AFTER", "INSERT", "DEFERRABLE INITIALLY DEFERRED"],
      ]) {
        await connection.query(`CREATE ${deferred ? "CONSTRAINT " : ""}TRIGGER synthetic_failure ${timing} ${action} ON "${table}" ${deferred} FOR EACH ROW EXECUTE FUNCTION synthetic_verification_failure()`);
        try {
          await assert.rejects(operations.issue(account.email), rejects("INTERNAL_ERROR"));
          assert.deepEqual(await state(account), before);
        } finally { await connection.query(`DROP TRIGGER synthetic_failure ON "${table}"`); }
      }
      assert.deepEqual(await operations.consume(first.token), { status: "EMAIL_VERIFIED" });
    });

    await t.test("each consume write and deferred commit failure rolls back; the same token succeeds on retry", async () => {
      for (const [table, timing, action, deferred] of [
        ["verification", "BEFORE", "DELETE", ""], ["user", "BEFORE", "UPDATE", ""],
        ["user_account", "BEFORE", "UPDATE", ""], ["session", "BEFORE", "DELETE", ""],
        ["user_account", "AFTER", "UPDATE", "DEFERRABLE INITIALLY DEFERRED"],
      ]) {
        const account = await fixture();
        await signIn(account);
        const issued = await operations.issue(account.email);
        const before = await state(account);
        await connection.query(`CREATE ${deferred ? "CONSTRAINT " : ""}TRIGGER synthetic_failure ${timing} ${action} ON "${table}" ${deferred} FOR EACH ROW EXECUTE FUNCTION synthetic_verification_failure()`);
        try {
          await assert.rejects(operations.consume(issued.token), rejects("INTERNAL_ERROR"));
          assert.deepEqual(await state(account), before, `Rollback after ${table} ${timing} ${action}`);
        } finally { await connection.query(`DROP TRIGGER synthetic_failure ON "${table}"`); }
        assert.deepEqual(await operations.consume(issued.token), { status: "EMAIL_VERIFIED" });
        assert.equal((await state(account)).sessions, 0);
      }
    });

    await t.test("unknown/verified/deleted/unmapped identities issue no token or intent; tokens bind the current address", async () => {
      const account = await fixture();
      const issued = await operations.issue(account.email);
      await database.user.update({ where: { id: account.userId }, data: { email: `changed-${randomUUID()}@example.invalid` } });
      const before = await state(account);
      await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
      assert.deepEqual(await state(account), before);
      await database.user.update({ where: { id: account.userId }, data: { email: account.email } });
      await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: now } });
      const deleted = await state(account);
      assert.equal(await operations.issue(account.email), null);
      await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
      assert.deepEqual(await state(account), deleted);
      const totals = async () => [await database.verification.count(), await database.outboxEvent.count()];
      const counts = await totals();
      assert.equal(await operations.issue("missing@example.invalid"), null);
      const verified = await database.user.findFirst({ where: { emailVerified: true }, select: { email: true } });
      assert.equal(await operations.issue(verified.email), null);
      await database.user.create({ data: { id: randomUUID(), name: "Synthetic unmapped", email: "unmapped@example.invalid" }, select: { id: true } });
      assert.equal(await operations.issue("unmapped@example.invalid"), null);
      await assert.rejects(operations.consume("a".repeat(64)), rejects("INVALID_TOKEN"));
      assert.deepEqual(await totals(), counts);
    });

    await t.test("concurrent resends leave one outstanding token; concurrent consumption succeeds exactly once", async () => {
      const account = await fixture();
      const issued = await Promise.all(Array.from({ length: 4 }, () => operations.issue(account.email)));
      const persisted = (await state(account)).tokens;
      assert.equal(persisted.length, 1);
      const winner = issued.find((result) => tokenId(result.token) === persisted[0].id);
      for (const result of issued.filter((result) => result !== winner)) {
        await assert.rejects(operations.consume(result.token), rejects("INVALID_TOKEN"));
      }
      const results = await Promise.allSettled(Array.from({ length: 4 }, () => operations.consume(winner.token)));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      for (const result of results.filter((result) => result.status === "rejected")) assert.ok(rejects("INVALID_TOKEN")(result.reason));
      assert.equal((await state(account)).tokens.length, 0);
    });

    await t.test("resend racing consume has only serialized outcomes and preserves unrelated account sessions", async () => {
      const unrelated = await fixture();
      await signIn(unrelated);
      const unrelatedBefore = await state(unrelated);
      const account = await fixture();
      await signIn(account);
      const first = await operations.issue(account.email);
      const [resend, consume] = await Promise.allSettled([operations.issue(account.email), operations.consume(first.token)]);
      assert.equal(resend.status, "fulfilled");
      const after = await state(account);
      if (consume.status === "fulfilled") {
        assert.equal(resend.value, null);
        assert.equal(after.identity.emailVerified, true);
        assert.equal(after.tokens.length, 0);
        assert.equal(after.sessions, 0);
      } else {
        assert.ok(rejects("INVALID_TOKEN")(consume.reason));
        assert.ok(resend.value);
        assert.equal(after.identity.emailVerified, false);
        assert.equal(after.account.emailVerifiedAt, null);
        assert.equal(after.sessions, 1);
        assert.equal(after.tokens[0].id, tokenId(resend.value.token));
        await operations.consume(resend.value.token);
      }
      assert.deepEqual(await state(unrelated), unrelatedBefore);
    });
  } finally { await sandbox.close(); }
});
