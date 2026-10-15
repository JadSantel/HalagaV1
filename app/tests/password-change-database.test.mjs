import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { createPasswordChangeOperation, PasswordChangeRejected } from "../src/server/repositories/password-change.ts";
import { createPasswordResetOperations } from "../src/server/repositories/password-reset.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createEmailChangeOperations } from "../src/server/repositories/email-change.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

const oldPassword = "synthetic-old-change-password-only";
const newPassword = "synthetic-new-change-password-only";
const input = { currentPassword: oldPassword, newPassword };
const rejects = (code) => (error) => error instanceof PasswordChangeRejected &&
  error.code === code && error.message === code && error.cause === undefined;
const cookieHeaders = (result) => new Headers({ cookie: result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });

test("password change rejects invalid shapes and maps auth failures to fixed safe errors", async () => {
  const noDatabase = { $transaction() { assert.fail("No transaction"); } };
  const noAuth = { get api() { assert.fail("No auth"); } };
  const change = createPasswordChangeOperation(noDatabase, noAuth);
  for (const value of [null, {}, "private", { ...input, currentPassword: "" }, { ...input, newPassword: "" },
    { ...input, accountId: randomUUID() }, { ...input, sessionId: randomUUID() }, { ...input, revokeOtherSessions: false }]) {
    await assert.rejects(change(new Headers(), value, () => {}), rejects("INVALID_INPUT"));
  }
  for (const response of [null, { session: { userId: "other" }, user: { id: "owner" } }]) {
    const invalid = createPasswordChangeOperation(noDatabase, { api: { getSession: async () => ({ response, headers: new Headers() }) } });
    await assert.rejects(invalid(new Headers(), input, () => {}), rejects("UNAUTHORIZED"));
  }
  const failing = createPasswordChangeOperation(noDatabase, { api: { getSession() { throw new Error("private-session-material"); } } });
  await assert.rejects(failing(new Headers(), input, () => {}), rejects("INTERNAL_ERROR"));
});

test("isolated PostgreSQL authenticated password-change transactions", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  let now = new Date();
  const change = createPasswordChangeOperation(database, auth, () => now);
  const reset = createPasswordResetOperations(database, auth, () => now);
  const verification = createEmailVerificationOperations(database, () => now);
  const emailChange = createEmailChangeOperations(database, auth, () => now);
  const signIn = (account, password = oldPassword) => auth.api.signInEmail({ body: { email: account.email, password }, returnHeaders: true });
  const fixture = async (verified = false) => {
    now = new Date();
    const email = `password-change-${randomUUID()}@example.invalid`;
    await createSignupOperation(database, auth, () => now)({ email, password: oldPassword,
      displayName: "Synthetic password change adult", dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    const { id: userId } = await database.user.findUnique({ where: { email }, select: { id: true } });
    const { id: accountId } = await database.userAccount.findUnique({ where: { authUserId: userId }, select: { id: true } });
    if (verified) await verification.consume((await verification.issue(email)).token);
    const signedIn = await signIn({ email });
    now = new Date();
    return { email, userId, accountId, headers: cookieHeaders(signedIn) };
  };
  const perform = (account, operation = change, value = input) => operation(account.headers, value, () => {});
  const state = async ({ userId, accountId }) => ({
    identity: await database.user.findUnique({ where: { id: userId }, select: {
      id: true, name: true, email: true, emailVerified: true, createdAt: true, updatedAt: true } }),
    account: await database.userAccount.findUnique({ where: { id: accountId }, select: {
      id: true, authUserId: true, displayName: true, dateOfBirth: true, adultAttestedAt: true, adultAttestationVersion: true,
      emailVerifiedAt: true, deletedAt: true, createdAt: true, updatedAt: true } }),
    credentials: await database.account.findMany({ where: { userId }, orderBy: { id: "asc" }, select: {
      id: true, accountId: true, providerId: true, userId: true, password: true, createdAt: true, updatedAt: true } }),
    sessions: await database.session.findMany({ where: { userId }, orderBy: { id: "asc" }, select: {
      id: true, userId: true, token: true, createdAt: true, expiresAt: true, updatedAt: true, ipAddress: true, userAgent: true } }),
    tokens: await database.verification.findMany({ where: { identifier: { in: ["halaga-email-verification:" + userId,
      "halaga-password-reset:" + userId, "halaga-email-change:" + userId] } }, orderBy: { id: "asc" }, select: {
      id: true, identifier: true, value: true, createdAt: true, updatedAt: true, expiresAt: true } }),
    intents: await database.outboxEvent.findMany({ where: { accountId }, orderBy: { id: "asc" }, select: {
      id: true, eventType: true, eventVersion: true, deduplicationKey: true, recipientEmail: true, createdAt: true, dispatchedAt: true } }),
  });
  const assertPreserved = (before, after) => {
    for (const key of ["identity", "account", "tokens", "intents"]) assert.deepEqual(after[key], before[key]);
    assert.deepEqual(after.credentials.filter((row) => row.providerId !== "credential"),
      before.credentials.filter((row) => row.providerId !== "credential"));
    const { password: oldHash, updatedAt: oldUpdate, ...oldCredential } = before.credentials.find((row) => row.providerId === "credential");
    const { password: newHash, updatedAt: newUpdate, ...newCredential } = after.credentials.find((row) => row.providerId === "credential");
    assert.ok(oldUpdate && newUpdate);
    assert.notEqual(newHash, oldHash);
    assert.notEqual(newHash, newPassword);
    assert.deepEqual(newCredential, oldCredential);
  };
  const context = await auth.$context;
  const customAuth = (overrides) => ({ api: auth.api, $context: Promise.resolve({ ...context,
    password: { ...context.password, ...overrides } }) });
  const injectFailure = async (table, timing, action, deferred, work) => {
    await connection.query(`CREATE ${deferred ? "CONSTRAINT " : ""}TRIGGER synthetic_failure ${timing} ${action} ON "${table}" ${deferred} FOR EACH ROW EXECUTE FUNCTION synthetic_password_change_failure()`);
    try { await work(); } finally { await connection.query(`DROP TRIGGER synthetic_failure ON "${table}"`); }
  };
  try {
    await connection.query(`CREATE FUNCTION synthetic_password_change_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic-private-password-change-error'; END $$`);

    await t.test("verified/unverified owners retain exactly the initiating session; history, tokens and other accounts survive", async () => {
      for (const verified of [false, true]) {
        const account = await fixture(verified);
        const other = await fixture();
        const otherBefore = await state(other);
        const second = await signIn(account);
        await database.session.create({ data: { id: randomUUID(), userId: account.userId, token: randomUUID(), expiresAt: new Date(now.getTime() - 1) } });
        await database.account.create({ data: { id: randomUUID(), userId: account.userId, accountId: "synthetic-provider",
          providerId: "synthetic-unused-provider", password: "synthetic-provider-value" } });
        // All three token families must survive even when their intents are stale.
        for (const prefix of ["halaga-email-verification:", "halaga-password-reset:", "halaga-email-change:"]) {
          await database.verification.create({ data: { id: randomUUID(), identifier: prefix + account.userId,
            value: "synthetic-private-binding", expiresAt: new Date(now.getTime() + 3600000) } });
        }
        const actor = await auth.api.getSession({ headers: account.headers });
        account.headers.set("x-account-id", other.accountId);
        const before = await state(account);
        let responseHeaders;
        assert.deepEqual(await change(account.headers, input, (headers) => { responseHeaders = headers; }), { status: "PASSWORD_CHANGED" });
        assert.ok(responseHeaders instanceof Headers);
        const after = await state(account);
        assertPreserved(before, after);
        assert.deepEqual(after.sessions, before.sessions.filter((row) => row.id === actor.session.id));
        assert.deepEqual(await state(other), otherBefore);
        assert.ok(await auth.api.getSession({ headers: account.headers }));
        assert.equal(await auth.api.getSession({ headers: cookieHeaders(second) }), null);
        await assert.rejects(signIn(account));
        assert.equal((await signIn(account, newPassword)).response.user.emailVerified, verified);
      }
    });

    await t.test("freshness rejects exactly 15 minutes, future creation and expiry; last valid millisecond succeeds", async () => {
      for (const boundary of ["15-minutes", "older", "future", "expired", "last-millisecond"]) {
        const account = await fixture();
        const session = await database.session.findFirst({ where: { userId: account.userId }, select: { id: true } });
        const createdAt = new Date(now.getTime() - (boundary === "last-millisecond" ? 899999 : boundary === "older" ? 900001 : 900000));
        await database.session.update({ where: { id: session.id }, data: { createdAt: boundary === "future" ? new Date(now.getTime() + 1) : createdAt,
          updatedAt: now, expiresAt: new Date(now.getTime() + 3600000) } });
        // Keep expiry in the library's future; advance the command clock to its exact boundary.
        if (boundary === "expired") {
          now = new Date(now.getTime() + 3600000);
          await database.session.update({ where: { id: session.id }, data: {
            createdAt: new Date(now.getTime() - 1000), expiresAt: now } });
        }
        const before = await state(account);
        if (boundary === "last-millisecond") await perform(account);
        else {
          await assert.rejects(perform(account), rejects("UNAUTHORIZED"));
          assert.deepEqual(await state(account), before);
        }
      }
    });

    await t.test("rolling renewal cannot refresh creation age; rejected change does not renew a stored session", async () => {
      const account = await fixture();
      const old = new Date(now.getTime() - 2 * 86400000);
      await database.session.updateMany({ where: { userId: account.userId }, data: {
        createdAt: old, updatedAt: old, expiresAt: new Date(old.getTime() + 7 * 86400000) } });
      let before = await state(account);
      await assert.rejects(perform(account), rejects("UNAUTHORIZED"));
      assert.deepEqual(await state(account), before);
      await auth.api.getSession({ headers: account.headers }); // Ordinary session use renews rolling expiry.
      before = await state(account);
      assert.deepEqual(before.sessions[0].createdAt, old);
      assert.ok(before.sessions[0].updatedAt > old);
      await assert.rejects(perform(account), rejects("UNAUTHORIZED"));
      assert.deepEqual(await state(account), before);
    });

    await t.test("missing/forged/revoked sessions and missing/deleted accounts or credentials fail closed", async () => {
      for (const mutation of ["missing-cookie", "forged-cookie", "revoked", "missing-account", "missing-identity", "deleted",
        "missing-credential", "null-password", "empty-password", "wrong-account", "duplicate-credential"]) {
        const account = await fixture();
        if (mutation === "missing-cookie") account.headers = new Headers();
        if (mutation === "forged-cookie") account.headers = new Headers({ cookie: "better-auth.session_token=forged-synthetic" });
        if (mutation === "revoked") await database.session.deleteMany({ where: { userId: account.userId } });
        if (["missing-account", "missing-identity"].includes(mutation)) {
          await database.outboxEvent.deleteMany({ where: { accountId: account.accountId } });
          await database.userAccount.delete({ where: { id: account.accountId } });
          if (mutation === "missing-identity") await database.user.delete({ where: { id: account.userId } });
        }
        if (mutation === "deleted") await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: now } });
        const credential = await database.account.findFirst({ where: { userId: account.userId }, select: { id: true } });
        if (mutation === "missing-credential") await database.account.delete({ where: { id: credential.id } });
        if (["null-password", "empty-password", "wrong-account"].includes(mutation)) await database.account.update({ where: { id: credential.id },
          data: mutation === "wrong-account" ? { accountId: "wrong-identity" } : { password: mutation === "null-password" ? null : "" } });
        if (mutation === "duplicate-credential") await database.account.create({ data: { id: randomUUID(), userId: account.userId,
          accountId: account.userId, providerId: "credential", password: "synthetic-ambiguous-hash" } });
        const before = await state(account);
        const unauthorized = ["missing-cookie", "forged-cookie", "revoked", "missing-identity"].includes(mutation);
        await assert.rejects(perform(account), rejects(unauthorized ? "UNAUTHORIZED" : "INVALID_STATE"));
        assert.deepEqual(await state(account), before);
      }
    });

    await t.test("configured limits, wrong current password, hashing and verification failures preserve state and permit retry", async () => {
      const account = await fixture();
      await signIn(account);
      const before = await state(account);
      const limited = createPasswordChangeOperation(database, customAuth({ config: { minPasswordLength: 10, maxPasswordLength: 40 },
        hash() { assert.fail("Invalid length must not hash"); } }), () => now);
      for (const value of [{ ...input, newPassword: "short" }, { ...input, newPassword: "x".repeat(41) },
        { ...input, currentPassword: "x".repeat(41) }]) {
        await assert.rejects(perform(account, limited, value), rejects("INVALID_INPUT"));
      }
      await assert.rejects(perform(account, change, { ...input, currentPassword: "wrong-synthetic" }), rejects("INVALID_PASSWORD"));
      for (const method of ["hash", "verify"]) {
        const failing = createPasswordChangeOperation(database, customAuth({ [method]() { throw new Error("private-hash-password-session-sentinel"); } }), () => now);
        await assert.rejects(perform(account, failing), rejects("INTERNAL_ERROR"));
        assert.deepEqual(await state(account), before);
      }
      const invalidClock = createPasswordChangeOperation(database, auth, () => new Date(NaN));
      await assert.rejects(perform(account, invalidClock), rejects("INTERNAL_ERROR"));
      assert.deepEqual(await state(account), before);
      await perform(account);
    });

    await t.test("each write and deferred commit failure restores credential and every session; same-session retry succeeds", async () => {
      for (const [table, timing, action, deferred] of [
        ["account", "BEFORE", "UPDATE", ""], ["session", "BEFORE", "DELETE", ""],
        ["account", "AFTER", "UPDATE", "DEFERRABLE INITIALLY DEFERRED"],
        ["session", "AFTER", "DELETE", "DEFERRABLE INITIALLY DEFERRED"],
      ]) {
        const account = await fixture();
        await signIn(account);
        const before = await state(account);
        await injectFailure(table, timing, action, deferred, async () => {
          await assert.rejects(perform(account), rejects("INTERNAL_ERROR"));
          assert.deepEqual(await state(account), before);
        });
        assert.deepEqual(await perform(account), { status: "PASSWORD_CHANGED" });
        const after = await state(account);
        assertPreserved(before, after);
        assert.equal(after.sessions.length, 1);
        await signIn(account, newPassword);
      }
    });

    await t.test("session identity/token/revocation, account mapping and credential are reread after resolution/hash", async () => {
      for (const mutation of ["revoke", "expire", "stale", "future", "token", "owner", "remap", "delete-account", "credential"]) {
        const account = await fixture();
        const other = await fixture();
        let afterMutation;
        const delayed = createPasswordChangeOperation(database, customAuth({ async hash(value) {
          const hash = await context.password.hash(value);
          const session = await database.session.findFirst({ where: { userId: account.userId }, select: { id: true } });
          if (mutation === "revoke") await database.session.delete({ where: { id: session.id } });
          if (mutation === "expire") await database.session.update({ where: { id: session.id }, data: { expiresAt: now } });
          if (mutation === "stale") now = new Date((await state(account)).sessions[0].createdAt.getTime() + 900000);
          if (mutation === "future") await database.session.update({ where: { id: session.id }, data: { createdAt: new Date(now.getTime() + 1) } });
          if (mutation === "token") await database.session.update({ where: { id: session.id }, data: { token: randomUUID() } });
          if (mutation === "owner") await database.session.update({ where: { id: session.id }, data: { userId: other.userId } });
          if (mutation === "delete-account") await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: now } });
          if (mutation === "remap") {
            await database.outboxEvent.deleteMany({ where: { accountId: account.accountId } });
            await database.userAccount.delete({ where: { id: account.accountId } });
            await database.userAccount.create({ data: { authUserId: account.userId, displayName: "Synthetic replacement mapping" } });
          }
          if (mutation === "credential") await database.account.updateMany({ where: { userId: account.userId }, data: { accountId: "wrong-identity" } });
          afterMutation = await state(account);
          return hash;
        } }), () => now);
        await assert.rejects(perform(account, delayed), rejects(["remap", "delete-account", "credential"].includes(mutation) ? "INVALID_STATE" : "UNAUTHORIZED"));
        assert.deepEqual(await state(account), afterMutation);
      }
    });

    await t.test("freshness is checked after hash, lock wait and current-password verification", async () => {
      for (const method of ["hash", "verify"]) {
        const account = await fixture();
        const before = await state(account);
        const delayed = createPasswordChangeOperation(database, customAuth({ async [method](value) {
          const result = await context.password[method](value);
          now = new Date(before.sessions[0].createdAt.getTime() + 900000);
          return result;
        } }), () => now);
        await assert.rejects(perform(account, delayed), rejects("UNAUTHORIZED"));
        assert.deepEqual(await state(account), before);
      }
      const account = await fixture();
      const before = await state(account);
      await connection.query("BEGIN");
      await connection.query('SELECT id FROM "user_account" WHERE id = $1 FOR UPDATE', [account.accountId]);
      const pending = assert.rejects(perform(account), rejects("UNAUTHORIZED"));
      let waiting = false;
      try {
        for (let attempt = 0; attempt < 100; attempt++) {
          await connection.query("SELECT pg_stat_clear_snapshot()");
          const result = await connection.query(`SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
            AND wait_event_type = 'Lock' AND query LIKE '%FROM "user" u JOIN%' AND pid <> pg_backend_pid()`);
          if (result.rowCount) { waiting = true; break; }
          await setTimeout(10);
        }
      } finally {
        now = new Date(before.sessions[0].createdAt.getTime() + 900000);
        await connection.query("COMMIT");
      }
      await pending;
      assert.ok(waiting, "Must observe the actual transaction waiting for its account lock");
      assert.deepEqual(await state(account), before);
    });

    await t.test("mismatched verification and missing eligibility stay unchanged; password maintenance grants no marketplace access", async () => {
      for (const identityVerified of [false, true]) {
        const account = await fixture();
        await database.user.update({ where: { id: account.userId }, data: { emailVerified: identityVerified } });
        await database.userAccount.update({ where: { id: account.accountId }, data: {
          emailVerifiedAt: identityVerified ? null : now, dateOfBirth: null, adultAttestedAt: null } });
        const before = await state(account);
        await perform(account);
        assertPreserved(before, await state(account));
      }
    });

    await t.test("concurrent changes from same or different sessions have one winner using the current locked hash", async () => {
      for (const sameSession of [true, false]) {
        const account = await fixture();
        const second = sameSession ? account : { ...account, headers: cookieHeaders(await signIn(account)) };
        const passwords = [newPassword, "synthetic-competing-password-only"];
        const results = await Promise.allSettled([account, second].map((actor, index) => perform(actor, change, { ...input, newPassword: passwords[index] })));
        assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
        const winner = results.findIndex((row) => row.status === "fulfilled");
        assert.ok(rejects(sameSession ? "INVALID_PASSWORD" : "UNAUTHORIZED")(results[1 - winner].reason));
        assert.equal((await state(account)).sessions.length, 1);
        assert.ok(await auth.api.getSession({ headers: [account, second][winner].headers }));
        await signIn(account, passwords[winner]);
        await assert.rejects(signIn(account, passwords[1 - winner]));
      }
    });

    await t.test("reset, verification and email proof serialize with password change without resurrecting revoked sessions", async () => {
      for (const competing of ["reset", "verification", "email-proof"]) {
        const account = await fixture(competing === "email-proof");
        let consume;
        if (competing === "reset") {
          const issued = await reset.issue(account.email);
          consume = () => reset.consume({ token: issued.token, newPassword: "synthetic-reset-race-password" });
        } else if (competing === "verification") {
          const issued = await verification.issue(account.email);
          consume = () => verification.consume(issued.token);
        } else {
          const issued = await emailChange.issue(account.headers, { proposedEmail: `proof-${randomUUID()}@example.invalid` }, () => {});
          consume = () => emailChange.consume(issued.token);
        }
        const [changed, consumed] = await Promise.allSettled([perform(account), consume()]);
        assert.equal(consumed.status, "fulfilled");
        if (changed.status === "rejected") assert.ok(rejects("UNAUTHORIZED")(changed.reason));
        const after = await state(account);
        assert.equal(after.sessions.length, 0);
        assert.equal(await auth.api.getSession({ headers: account.headers }), null);
        if (competing === "reset") await signIn(account, "synthetic-reset-race-password");
        else {
          assert.equal(after.identity.emailVerified, true);
          await signIn({ email: after.identity.email }, changed.status === "fulfilled" ? newPassword : oldPassword);
        }
      }
    });
  } finally { await sandbox.close(); }
});
