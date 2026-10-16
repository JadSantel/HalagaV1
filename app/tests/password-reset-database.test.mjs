import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { createPasswordResetOperations, PasswordResetRejected } from "../src/server/repositories/password-reset.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { createAccountAccessReader } from "../src/server/repositories/accounts.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

const rejects = (code) => (error) => error instanceof PasswordResetRejected &&
  error.code === code && error.message === code && error.cause === undefined;
const namespace = "halaga-password-reset:";
const tokenId = (token) => namespace + createHash("sha256").update(token).digest("hex");
const oldPassword = "synthetic-old-reset-password-only";
const newPassword = "synthetic-new-reset-password-only";

test("reset validates shape and configured password limits before database writes; errors stay private", async () => {
  const database = { $transaction() { assert.fail("No database access"); } };
  const noAuth = { get $context() { assert.fail("No auth access"); } };
  const operations = createPasswordResetOperations(database, noAuth);
  for (const input of [null, {}, "invalid", "private@example.invalid\n"]) {
    await assert.rejects(operations.issue(input), rejects("INVALID_INPUT"));
  }
  for (const input of [null, {}, { token: "x".repeat(64), newPassword },
    { token: "a".repeat(65), newPassword }, { token: "a".repeat(64), newPassword: "" },
    { token: "a".repeat(64), newPassword, extra: "private" }]) {
    await assert.rejects(operations.consume(input), rejects("INVALID_INPUT"));
  }
  const limited = createPasswordResetOperations(database, { $context: Promise.resolve({
    password: { config: { minPasswordLength: 10, maxPasswordLength: 20 }, hash() { assert.fail("No hashing"); } },
  }) });
  for (const value of ["short", "x".repeat(21)]) {
    await assert.rejects(limited.consume({ token: "a".repeat(64), newPassword: value }), rejects("INVALID_INPUT"));
  }
  const failingDatabase = createPasswordResetOperations({ $transaction() { throw new Error("synthetic-private-db-error"); } }, noAuth);
  await assert.rejects(failingDatabase.issue("private@example.invalid"), rejects("INTERNAL_ERROR"));
});

test("isolated PostgreSQL password-reset transactions", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  let now = new Date();
  const operations = createPasswordResetOperations(database, auth, () => now);
  const verification = createEmailVerificationOperations(database, () => now);
  const signup = createSignupOperation(database, auth, () => now);
  const consume = (token, password = newPassword) => operations.consume({ token, newPassword: password });
  const fixture = async (verified = false) => {
    const email = `reset-${randomUUID()}@example.invalid`;
    await signup({ email, password: oldPassword, displayName: "Synthetic reset adult", dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    const identity = await database.user.findUnique({ where: { email }, select: { id: true } });
    const account = await database.userAccount.findUnique({ where: { authUserId: identity.id }, select: { id: true } });
    if (verified) await verification.consume((await verification.issue(email)).token);
    return { email, userId: identity.id, accountId: account.id };
  };
  const state = async ({ userId, accountId }) => ({
    identity: await database.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true, updatedAt: true } }),
    account: await database.userAccount.findUnique({ where: { id: accountId },
      select: { emailVerifiedAt: true, deletedAt: true, dateOfBirth: true, adultAttestedAt: true, adultAttestationVersion: true, updatedAt: true } }),
    credentials: await database.account.findMany({ where: { userId }, orderBy: { id: "asc" },
      select: { id: true, accountId: true, providerId: true, password: true, updatedAt: true } }),
    sessions: await database.session.findMany({ where: { userId }, orderBy: { id: "asc" },
      select: { id: true, createdAt: true, updatedAt: true, expiresAt: true } }),
    tokens: await database.verification.findMany({ where: { identifier: { in: [namespace + userId, "halaga-email-verification:" + userId] } },
      orderBy: { id: "asc" }, select: { id: true, identifier: true, value: true, expiresAt: true, createdAt: true, updatedAt: true } }),
    intents: await database.outboxEvent.findMany({ where: { accountId }, orderBy: { deduplicationKey: "asc" },
      select: { accountId: true, eventType: true, eventVersion: true, deduplicationKey: true, createdAt: true, dispatchedAt: true } }),
  });
  const signIn = (account, password = oldPassword) => auth.api.signInEmail({ body: { email: account.email, password }, returnHeaders: true });
  const cookieHeaders = (result) => new Headers({ cookie: result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
  const assertUnchangedVerification = (before, after) => {
    assert.deepEqual(after.identity, before.identity);
    assert.deepEqual(after.account, before.account);
    assert.deepEqual(after.tokens.filter((row) => !row.identifier.startsWith(namespace)),
      before.tokens.filter((row) => !row.identifier.startsWith(namespace)));
    assert.deepEqual(after.intents, before.intents);
  };
  const injectFailure = async (table, timing, action, deferred, work) => {
    await connection.query(`CREATE ${deferred ? "CONSTRAINT " : ""}TRIGGER synthetic_failure ${timing} ${action} ON "${table}" ${deferred} FOR EACH ROW EXECUTE FUNCTION synthetic_reset_failure()`);
    try { await work(); } finally { await connection.query(`DROP TRIGGER synthetic_failure ON "${table}"`); }
  };
  try {
    await connection.query(`CREATE FUNCTION synthetic_reset_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic-private-reset-database-error'; END $$`);

    await t.test("one-hour digest token; verified/unverified reset preserves states and revokes all stored sessions", async () => {
      for (const verified of [false, true]) {
        const account = await fixture(verified);
        const unrelated = await fixture();
        await signIn(unrelated);
        const unrelatedBefore = await state(unrelated);
        const firstSession = await signIn(account);
        await signIn(account);
        // Expired sessions are also removed; no stale stored session remains.
        await database.session.create({ data: { id: randomUUID(), userId: account.userId, token: randomUUID(), expiresAt: new Date(now.getTime() - 1) } });
        if (!verified) await verification.issue(account.email);
        const issued = await operations.issue(account.email.toUpperCase());
        assert.match(issued.token, /^[a-f0-9]{64}$/);
        assert.equal(issued.expiresAt.getTime() - now.getTime(), 60 * 60 * 1000);
        const before = await state(account);
        const token = before.tokens.find((row) => row.identifier === namespace + account.userId);
        assert.equal(token.id, tokenId(issued.token));
        assert.equal(token.value, account.email);
        assert.equal(token.createdAt.getTime(), now.getTime());
        assert.ok(!JSON.stringify(before).includes(issued.token));
        const intent = before.intents.find((row) => row.eventType === "account.password-reset-email-requested");
        assert.equal(intent.deduplicationKey, `password-reset-email:${token.id}`);
        assert.equal(intent.eventVersion, 1);
        assert.equal(intent.dispatchedAt, null);
        assert.ok(!JSON.stringify(before.intents).includes(account.email));
        const reader = createAccountAccessReader(auth, database);
        assert.equal((await reader(cookieHeaders(firstSession), () => {})).emailVerified, verified);
        assert.deepEqual(await consume(issued.token), { status: "PASSWORD_RESET" });
        const after = await state(account);
        assertUnchangedVerification(before, after);
        assert.equal(after.sessions.length, 0);
        assert.equal(after.tokens.filter((row) => row.identifier.startsWith(namespace)).length, 0);
        assert.notEqual(after.credentials[0].password, before.credentials[0].password);
        assert.notEqual(after.credentials[0].password, newPassword);
        assert.equal(await reader(cookieHeaders(firstSession), () => {}), null);
        await assert.rejects(signIn(account));
        const fresh = await signIn(account, newPassword);
        assert.equal(fresh.response.user.emailVerified, verified);
        assert.equal((await reader(cookieHeaders(fresh), () => {})).emailVerified, verified);
        assert.deepEqual(await state(unrelated), unrelatedBefore);
        const committed = await state(account);
        await assert.rejects(consume(issued.token, "synthetic-replay-password-only"), rejects("INVALID_TOKEN"));
        assert.deepEqual(await state(account), committed);
      }
    });

    await t.test("expiry boundary, future issue, unknown token and last valid millisecond", async () => {
      const account = await fixture();
      await signIn(account);
      const issued = await operations.issue(account.email);
      const before = await state(account);
      const savedNow = now;
      try {
        for (const instant of [issued.expiresAt.getTime(), issued.expiresAt.getTime() + 1, now.getTime() - 1]) {
          now = new Date(instant);
          await assert.rejects(consume(issued.token), rejects("INVALID_TOKEN"));
          assert.deepEqual(await state(account), before);
        }
        now = savedNow;
        await assert.rejects(consume("a".repeat(64)), rejects("INVALID_TOKEN"));
        assert.deepEqual(await state(account), before);
        now = new Date(issued.expiresAt.getTime() - 1);
        assert.deepEqual(await consume(issued.token), { status: "PASSWORD_RESET" });
      } finally { now = savedNow; }
    });

    await t.test("replacement invalidates the previous token with a fresh full hour and preserves verification tokens", async () => {
      const account = await fixture();
      const emailToken = await verification.issue(account.email);
      const first = await operations.issue(account.email);
      const savedNow = now;
      try {
        now = new Date(now.getTime() + 30 * 60 * 1000);
        const replacement = await operations.issue(account.email);
        assert.notEqual(first.token, replacement.token);
        assert.equal(replacement.expiresAt.getTime() - now.getTime(), 60 * 60 * 1000);
        const before = await state(account);
        assert.equal(before.tokens.length, 2);
        await assert.rejects(consume(first.token), rejects("INVALID_TOKEN"));
        await assert.rejects(consume(emailToken.token), rejects("INVALID_TOKEN"));
        assert.deepEqual(await state(account), before);
        await consume(replacement.token);
        await verification.consume(emailToken.token);
        assert.equal((await state(account)).identity.emailVerified, true);
      } finally { now = savedNow; }
    });

    await t.test("each issue write and deferred commit failure restores the old token/intent; replacement retries safely", async () => {
      const account = await fixture();
      let issued = await operations.issue(account.email);
      for (const [table, timing, action, deferred] of [
        ["verification", "BEFORE", "DELETE", ""], ["verification", "BEFORE", "INSERT", ""],
        ["outbox_event", "BEFORE", "INSERT", ""], ["outbox_event", "AFTER", "INSERT", "DEFERRABLE INITIALLY DEFERRED"],
      ]) {
        const before = await state(account);
        await injectFailure(table, timing, action, deferred, async () => {
          await assert.rejects(operations.issue(account.email), rejects("INTERNAL_ERROR"));
          assert.deepEqual(await state(account), before);
        });
        const replacement = await operations.issue(account.email);
        await assert.rejects(consume(issued.token), rejects("INVALID_TOKEN"));
        assert.equal((await state(account)).intents.length, before.intents.length + 1);
        issued = replacement;
      }
      await consume(issued.token);
    });

    await t.test("token deletion, password update, session deletion and commit failures roll back; same-token retry succeeds", async () => {
      for (const [table, timing, action, deferred] of [
        ["verification", "BEFORE", "DELETE", ""], ["account", "BEFORE", "UPDATE", ""],
        ["session", "BEFORE", "DELETE", ""], ["account", "AFTER", "UPDATE", "DEFERRABLE INITIALLY DEFERRED"],
      ]) {
        const account = await fixture();
        await signIn(account);
        await signIn(account);
        const issued = await operations.issue(account.email);
        const before = await state(account);
        await injectFailure(table, timing, action, deferred, async () => {
          await assert.rejects(consume(issued.token), rejects("INTERNAL_ERROR"));
          assert.deepEqual(await state(account), before);
        });
        assert.deepEqual(await consume(issued.token), { status: "PASSWORD_RESET" });
        const after = await state(account);
        assertUnchangedVerification(before, after);
        assert.equal(after.sessions.length, 0);
        assert.equal(after.tokens.filter((row) => row.identifier.startsWith(namespace)).length, 0);
        await signIn(account, newPassword);
      }
    });

    await t.test("hasher failure and invalid password retain token/sessions; expiry is checked after hashing", async () => {
      const account = await fixture();
      await signIn(account);
      const issued = await operations.issue(account.email);
      const before = await state(account);
      const context = await auth.$context;
      const failing = createPasswordResetOperations(database, { $context: Promise.resolve({ ...context,
        password: { ...context.password, hash() { throw new Error("synthetic-private-hasher-error"); } },
      }) }, () => now);
      await assert.rejects(failing.consume({ token: issued.token, newPassword }), rejects("INTERNAL_ERROR"));
      for (const value of ["x", "x".repeat(context.password.config.maxPasswordLength + 1)]) {
        await assert.rejects(consume(issued.token, value), rejects("INVALID_INPUT"));
      }
      assert.deepEqual(await state(account), before);
      const delayed = createPasswordResetOperations(database, { $context: Promise.resolve({ ...context,
        password: { ...context.password, async hash(value) {
          const hash = await context.password.hash(value);
          now = issued.expiresAt;
          return hash;
        } },
      }) }, () => now);
      const savedNow = now;
      try {
        await assert.rejects(delayed.consume({ token: issued.token, newPassword }), rejects("INVALID_TOKEN"));
        assert.deepEqual(await state(account), before);
      } finally { now = savedNow; }
      await consume(issued.token);
    });

    await t.test("unknown, unmapped, deleted and malformed credentials cannot issue or consume; address is rechecked", async () => {
      assert.equal(await operations.issue("missing@example.invalid"), null);
      await database.user.create({ data: { id: randomUUID(), name: "Synthetic unmapped", email: "unmapped-reset@example.invalid" }, select: { id: true } });
      assert.equal(await operations.issue("unmapped-reset@example.invalid"), null);
      for (const change of ["deleted", "address", "missing-credential", "empty-password", "wrong-account", "duplicate-credential"]) {
        const account = await fixture();
        const issued = await operations.issue(account.email);
        const credential = await database.account.findFirst({ where: { userId: account.userId }, select: { id: true } });
        if (change === "deleted") await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: now } });
        if (change === "address") await database.user.update({ where: { id: account.userId }, data: { email: `changed-${randomUUID()}@example.invalid` } });
        if (change === "missing-credential") await database.account.delete({ where: { id: credential.id } });
        if (change === "empty-password") await database.account.update({ where: { id: credential.id }, data: { password: null } });
        if (change === "wrong-account") await database.account.update({ where: { id: credential.id }, data: { accountId: "unrelated-identity" } });
        if (change === "duplicate-credential") await database.account.create({ data: { id: randomUUID(), userId: account.userId,
          accountId: account.userId, providerId: "credential", password: "synthetic-ambiguous-hash" } });
        const before = await state(account);
        assert.equal(await operations.issue(account.email), null);
        await assert.rejects(consume(issued.token), rejects("INVALID_TOKEN"));
        assert.deepEqual(await state(account), before);
      }
    });

    await t.test("mismatched verification states stay mismatched; unrelated provider credential is unchanged", async () => {
      for (const identityVerified of [false, true]) {
        const account = await fixture();
        await database.user.update({ where: { id: account.userId }, data: { emailVerified: identityVerified } });
        await database.userAccount.update({ where: { id: account.accountId }, data: { emailVerifiedAt: identityVerified ? null : now } });
        await database.account.create({ data: { id: randomUUID(), userId: account.userId, accountId: "synthetic-provider-account",
          providerId: "synthetic-unused-provider", password: "synthetic-provider-value" } });
        const issued = await operations.issue(account.email);
        const before = await state(account);
        await consume(issued.token);
        const after = await state(account);
        assertUnchangedVerification(before, after);
        assert.deepEqual(after.credentials.filter((row) => row.providerId !== "credential"),
          before.credentials.filter((row) => row.providerId !== "credential"));
      }
    });

    await t.test("concurrent requests leave one token; concurrent consumes change password exactly once", async () => {
      const account = await fixture();
      await signIn(account);
      const issued = await Promise.all(Array.from({ length: 4 }, () => operations.issue(account.email)));
      const before = await state(account);
      const resetTokens = before.tokens.filter((row) => row.identifier.startsWith(namespace));
      assert.equal(resetTokens.length, 1);
      assert.equal(before.intents.length, 5); // Signup plus four distinct committed requests.
      const winner = issued.find((result) => tokenId(result.token) === resetTokens[0].id);
      for (const result of issued.filter((result) => result !== winner)) {
        await assert.rejects(consume(result.token), rejects("INVALID_TOKEN"));
      }
      const passwords = Array.from({ length: 4 }, (_, index) => `${newPassword}-${index}`);
      const results = await Promise.allSettled(passwords.map((value) => consume(winner.token, value)));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      for (const result of results.filter((result) => result.status === "rejected")) assert.ok(rejects("INVALID_TOKEN")(result.reason));
      const after = await state(account);
      assertUnchangedVerification(before, after);
      assert.equal(after.tokens.filter((row) => row.identifier.startsWith(namespace)).length, 0);
      assert.equal(after.sessions.length, 0);
      await signIn(account, passwords[results.findIndex((result) => result.status === "fulfilled")]);
    });

    await t.test("issue racing consume has serialized outcomes; verification racing reset commits both flows", async () => {
      const account = await fixture();
      await signIn(account);
      const first = await operations.issue(account.email);
      const before = await state(account);
      const [replacement, consumed] = await Promise.allSettled([operations.issue(account.email), consume(first.token)]);
      assert.equal(replacement.status, "fulfilled");
      assert.ok(replacement.value);
      const after = await state(account);
      const resetTokens = after.tokens.filter((row) => row.identifier.startsWith(namespace));
      assert.equal(resetTokens.length, 1);
      assert.equal(resetTokens[0].id, tokenId(replacement.value.token));
      if (consumed.status === "fulfilled") {
        assert.equal(after.sessions.length, 0);
        assert.notEqual(after.credentials[0].password, before.credentials[0].password);
      } else {
        assert.ok(rejects("INVALID_TOKEN")(consumed.reason));
        assert.deepEqual(after.sessions, before.sessions);
        assert.deepEqual(after.credentials, before.credentials);
      }
      const emailToken = await verification.issue(account.email);
      const results = await Promise.all([consume(replacement.value.token), verification.consume(emailToken.token)]);
      assert.deepEqual(results, [{ status: "PASSWORD_RESET" }, { status: "EMAIL_VERIFIED" }]);
      const final = await state(account);
      assert.equal(final.tokens.length, 0);
      assert.equal(final.sessions.length, 0);
      assert.equal(final.identity.emailVerified, true);
      assert.equal(final.account.emailVerifiedAt.getTime(), now.getTime());
    });
  } finally { await sandbox.close(); }
});
