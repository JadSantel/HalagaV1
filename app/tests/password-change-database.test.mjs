import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { createPasswordChangeOperation, createPasswordChangeNoticeReader, createPasswordChangeNoticeListReader,
  createPasswordChangeNoticeReadMarker, PasswordChangeRejected } from "../src/server/repositories/password-change.ts";
import { createPasswordChangeNoticeHandler } from "../src/server/repositories/password-change-notices-http.ts";
import { accountEmailPaths } from "../src/server/account-flow-plugin.ts";
import { createAccountEmailDispatcher } from "../src/server/repositories/account-email-dispatch.ts";
import { BrevoSendError } from "../src/server/account-email-provider.ts";
import { createPasswordResetOperations } from "../src/server/repositories/password-reset.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createEmailChangeOperations } from "../src/server/repositories/email-change.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";
import { createAccountEmailIntentInspector } from "../src/server/repositories/account-email-intents.ts";
import { renderAccountEmail } from "../src/server/account-email-templates.ts";
import { passwordChangeEmailEvent, passwordChangeDeliveryMs, passwordChangeNoticeMs } from "../src/server/password-change-notice-policy.ts";

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

test("password change and owner notice reads use only their protected handlers", async () => {
  for (const path of ["/change-password", "/sign-up/email", "/sign-in/email"]) assert.ok(!accountEmailPaths.includes(path));
  const appDirectory = new URL("../src/app/", import.meta.url);
  const files = (await readdir(appDirectory, { recursive: true })).filter((name) => /\.[cm]?[jt]sx?$/.test(name));
  for (const name of files) {
    const source = await readFile(new URL(name.replaceAll("\\", "/"), appDirectory), "utf8");
    assert.doesNotMatch(source,
      /account-flow-plugin|repositories\/(?:auth["']|account-flows|password-change["'])|createPasswordChangeOperation|createPasswordChangeNoticeReader/,
      `${name} must not expose raw account commands or notice readers`);
  }
  const auth = await readFile(new URL("../src/server/repositories/auth.ts", import.meta.url), "utf8");
  assert.doesNotMatch(auth, /account-flow-plugin|createAccountFlowPlugin/);
  const screens = await readFile(new URL("../src/app/account/screens.tsx", import.meta.url), "utf8");
  assert.match(screens, /AccountPasswordChangeForm/);
  assert.doesNotMatch(screens, /onSubmit|formAction|onClick|fetch\(/);
  const page = await readFile(new URL("../src/app/account/security/page.tsx", import.meta.url), "utf8");
  assert.match(page, /PasswordChangeSecurityNotices/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  const route = await readFile(new URL("../src/app/api/account/security-notices/route.ts", import.meta.url), "utf8");
  assert.match(route, /handlePasswordChangeNoticeRequest/);
});

test("isolated PostgreSQL password change with atomic notices and ADR-089 email retention", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  let now = new Date();
  const change = createPasswordChangeOperation(database, auth, () => now);
  const readNotice = createPasswordChangeNoticeReader(database, auth, () => now);
  const listNotices = createPasswordChangeNoticeListReader(database, auth, () => now);
  const markNoticeRead = createPasswordChangeNoticeReadMarker(database, auth, () => now);
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
      id: true, accountId: true, eventType: true, eventVersion: true, deduplicationKey: true, recipientEmail: true, createdAt: true, dispatchedAt: true } }),
    notices: await database.passwordChangeNotice.findMany({ where: { accountId }, orderBy: { id: "asc" }, select: {
      id: true, accountId: true, eventType: true, eventVersion: true, inAppWorkKey: true, emailEligibility: true, createdAt: true, readAt: true } }),
  });
  const assertPreserved = (before, after) => {
    for (const key of ["identity", "account", "tokens"]) assert.deepEqual(after[key], before[key]);
    assert.deepEqual(after.intents.filter((row) => row.eventType !== passwordChangeEmailEvent),
      before.intents.filter((row) => row.eventType !== passwordChangeEmailEvent));
    assert.deepEqual(after.credentials.filter((row) => row.providerId !== "credential"),
      before.credentials.filter((row) => row.providerId !== "credential"));
    const { password: oldHash, updatedAt: oldUpdate, ...oldCredential } = before.credentials.find((row) => row.providerId === "credential");
    const { password: newHash, updatedAt: newUpdate, ...newCredential } = after.credentials.find((row) => row.providerId === "credential");
    assert.ok(oldUpdate && newUpdate);
    assert.notEqual(newHash, oldHash);
    assert.notEqual(newHash, newPassword);
    assert.deepEqual(newCredential, oldCredential);
    assert.equal(after.notices.length, before.notices.length + 1);
    assert.deepEqual(after.notices.filter((row) => before.notices.some(({ id }) => id === row.id)), before.notices);
    const [notice] = after.notices.filter((row) => !before.notices.some(({ id }) => id === row.id));
    assert.equal(notice.accountId, before.account.id);
    assert.equal(notice.eventType, "account.password-changed");
    assert.equal(notice.eventVersion, 1);
    assert.equal(notice.inAppWorkKey, `password-changed-in-app:${notice.id}`);
    assert.equal(notice.createdAt.getTime(), now.getTime());
    assert.equal(notice.readAt, null);
    assert.equal(notice.emailEligibility, before.identity.emailVerified && before.account.emailVerifiedAt &&
      before.account.emailVerifiedAt <= now ? "ELIGIBLE" : "INELIGIBLE");
    const emails = after.intents.filter((row) => !before.intents.some(({ id }) => id === row.id));
    assert.equal(emails.length, notice.emailEligibility === "ELIGIBLE" ? 1 : 0);
    if (emails.length) assert.deepEqual(emails[0], { id: emails[0].id, accountId: notice.accountId,
      eventType: passwordChangeEmailEvent, eventVersion: 1, deduplicationKey: `password-changed-email:${notice.id}`,
      recipientEmail: before.identity.email, createdAt: now, dispatchedAt: null });
  };
  const context = await auth.$context;
  const customAuth = (overrides) => ({ api: auth.api, $context: Promise.resolve({ ...context,
    password: { ...context.password, ...overrides } }) });
  const pausePassword = (method) => {
    const entered = Promise.withResolvers();
    const released = Promise.withResolvers();
    const operation = createPasswordChangeOperation(database, customAuth({ async [method](value) {
      const result = await context.password[method](value);
      entered.resolve();
      await released.promise;
      return result;
    } }), () => now);
    return { operation, entered: entered.promise, release: released.resolve };
  };
  const waitForAccountLock = async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      await connection.query("SELECT pg_stat_clear_snapshot()");
      const result = await connection.query(`SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
        AND wait_event_type = 'Lock' AND query LIKE '%FROM "user" u JOIN%' AND pid <> pg_backend_pid()`);
      if (result.rowCount) return true;
      await setTimeout(10);
    }
    return false;
  };
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
        ["password_change_notice", "BEFORE", "INSERT", ""],
        ["password_change_notice", "AFTER", "INSERT", "DEFERRABLE INITIALLY DEFERRED"],
        ["outbox_event", "BEFORE", "INSERT", ""],
        ["outbox_event", "AFTER", "INSERT", "DEFERRABLE INITIALLY DEFERRED"],
        ["account_email_delivery", "BEFORE", "INSERT", ""],
        ["account_email_delivery", "AFTER", "INSERT", "DEFERRABLE INITIALLY DEFERRED"],
      ]) {
        const account = await fixture(true);
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
        const account = await fixture(true);
        const second = sameSession ? account : { ...account, headers: cookieHeaders(await signIn(account)) };
        const passwords = [newPassword, "synthetic-competing-password-only"];
        const results = await Promise.allSettled([account, second].map((actor, index) => perform(actor, change, { ...input, newPassword: passwords[index] })));
        assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
        const winner = results.findIndex((row) => row.status === "fulfilled");
        assert.ok(rejects(sameSession ? "INVALID_PASSWORD" : "UNAUTHORIZED")(results[1 - winner].reason));
        assert.equal((await state(account)).sessions.length, 1);
        assert.equal((await state(account)).notices.length, 1);
        assert.equal(await database.outboxEvent.count({ where: { accountId: account.accountId, eventType: passwordChangeEmailEvent } }), 1);
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
        assert.equal(after.notices.length, changed.status === "fulfilled" ? 1 : 0);
        assert.equal(after.sessions.length, 0);
        assert.equal(await auth.api.getSession({ headers: account.headers }), null);
        if (competing === "reset") await signIn(account, "synthetic-reset-race-password");
        else {
          assert.equal(after.identity.emailVerified, true);
          await signIn({ email: after.identity.email }, changed.status === "fulfilled" ? newPassword : oldPassword);
        }
      }
    });

    await t.test("only commit-time verified-in-both-stores eligibility creates email intent and snapshot", async () => {
      for (const [emailVerified, timestamp] of [[false, "none"], [true, "none"], [false, "past"],
        [false, "future"], [true, "future"], [true, "past"], [true, "equal"]]) {
        const account = await fixture();
        await database.user.update({ where: { id: account.userId }, data: { emailVerified } });
        await database.userAccount.update({ where: { id: account.accountId }, data: { emailVerifiedAt:
          timestamp === "none" ? null : new Date(now.getTime() + (timestamp === "future" ? 1 : timestamp === "past" ? -1 : 0)) } });
        const before = await state(account);
        await perform(account);
        const after = await state(account);
        assertPreserved(before, after);
        assert.equal(after.notices[0].emailEligibility, emailVerified && ["past", "equal"].includes(timestamp) ? "ELIGIBLE" : "INELIGIBLE");
        assert.equal(await database.outboxEvent.count({ where: { accountId: account.accountId, recipientEmail: { not: null } } }),
          after.notices[0].emailEligibility === "ELIGIBLE" ? 1 : 0);
      }
    });

    await t.test("eligibility rereads after actual account-lock waits and after password verification advances event time", async () => {
      for (const verifiedAtCommit of [false, true]) {
        const account = await fixture(!verifiedAtCommit);
        await connection.query("BEGIN");
        await connection.query('SELECT u.id FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id WHERE a.id = $1 FOR UPDATE OF u, a', [account.accountId]);
        const pending = perform(account);
        let waiting = false;
        try {
          for (let attempt = 0; attempt < 100; attempt++) {
            await connection.query("SELECT pg_stat_clear_snapshot()");
            const result = await connection.query(`SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
              AND wait_event_type = 'Lock' AND query LIKE '%FROM "user" u JOIN%' AND pid <> pg_backend_pid()`);
            if (result.rowCount) { waiting = true; break; }
            await setTimeout(10);
          }
          await connection.query('UPDATE "user" SET "emailVerified" = $1 WHERE id = $2', [verifiedAtCommit, account.userId]);
          await connection.query('UPDATE "user_account" SET "emailVerifiedAt" = $1 WHERE id = $2', [verifiedAtCommit ? now.toISOString() : null, account.accountId]);
        } finally { await connection.query("COMMIT"); }
        await pending;
        assert.ok(waiting, "Observed the real account lock wait");
        const after = await state(account);
        assert.equal(after.identity.emailVerified, verifiedAtCommit);
        assert.deepEqual(after.account.emailVerifiedAt, verifiedAtCommit ? now : null);
        assert.equal(after.notices[0].emailEligibility, verifiedAtCommit ? "ELIGIBLE" : "INELIGIBLE");
      }
      const account = await fixture(true);
      await database.userAccount.update({ where: { id: account.accountId }, data: { emailVerifiedAt: new Date(now.getTime() + 1) } });
      const delayed = createPasswordChangeOperation(database, customAuth({ async verify(value) {
        const result = await context.password.verify(value);
        now = new Date(now.getTime() + 1);
        return result;
      } }), () => now);
      await perform(account, delayed);
      assert.equal((await state(account)).notices[0].emailEligibility, "ELIGIBLE");
    });

    await t.test("both verification lock orders never backfill; verification first rejects the resolved session and fresh change is eligible", async () => {
      for (const first of ["password", "verification"]) {
        const account = await fixture();
        const token = (await verification.issue(account.email)).token;
        if (first === "password") {
          const paused = pausePassword("verify");
          const pending = perform(account, paused.operation);
          await paused.entered;
          const consumed = verification.consume(token);
          let waiting;
          try { waiting = await waitForAccountLock(); } finally { paused.release(); }
          await Promise.all([pending, consumed]);
          assert.ok(waiting, "Verification waited on password-change locks");
          assert.equal((await state(account)).notices[0].emailEligibility, "INELIGIBLE");
        } else {
          const paused = pausePassword("hash");
          const pending = assert.rejects(perform(account, paused.operation), rejects("UNAUTHORIZED"));
          await paused.entered; // Owner/session resolved, transaction has not locked yet.
          try { await verification.consume(token); } finally { paused.release(); }
          await pending;
          assert.equal((await state(account)).notices.length, 0);
          account.headers = cookieHeaders(await signIn(account));
          now = new Date();
          await perform(account);
          assert.equal((await state(account)).notices[0].emailEligibility, "ELIGIBLE");
        }
        assert.equal(await database.outboxEvent.count({ where: { accountId: account.accountId, recipientEmail: { not: null } } }),
          first === "verification" ? 1 : 0);
      }
    });

    await t.test("pending email changes and both email-proof lock orders preserve in-app notices without email backfill", async () => {
      for (const first of ["password", "proof"]) {
        const account = await fixture(true);
        const proposedEmail = `notice-proof-${randomUUID()}@example.invalid`;
        const issued = await emailChange.issue(account.headers, { proposedEmail }, () => {});
        if (first === "password") {
          const paused = pausePassword("verify");
          const pending = perform(account, paused.operation);
          await paused.entered;
          const consumed = emailChange.consume(issued.token);
          let waiting;
          try { waiting = await waitForAccountLock(); } finally { paused.release(); }
          await Promise.all([pending, consumed]);
          assert.ok(waiting, "Email proof waited on password-change locks");
          assert.equal((await state(account)).notices[0].emailEligibility, "ELIGIBLE");
        } else {
          const paused = pausePassword("hash");
          const pending = assert.rejects(perform(account, paused.operation), rejects("UNAUTHORIZED"));
          await paused.entered;
          try { await emailChange.consume(issued.token); } finally { paused.release(); }
          await pending;
          assert.equal((await state(account)).notices.length, 0);
          account.headers = cookieHeaders(await signIn({ email: proposedEmail }));
          now = new Date();
          await perform(account);
          assert.equal((await state(account)).notices[0].emailEligibility, "ELIGIBLE");
        }
        const notices = (await state(account)).notices;
        assert.ok(!JSON.stringify(notices).includes(account.email));
        assert.ok(!JSON.stringify(notices).includes(proposedEmail));
        // Both warnings bind to their own commit-time recipient, independently.
        const snapshots = await database.outboxEvent.findMany({ where: { accountId: account.accountId, recipientEmail: { not: null } },
          select: { eventType: true, recipientEmail: true } });
        assert.deepEqual(snapshots.sort((a, b) => a.eventType.localeCompare(b.eventType)), [
          { eventType: "account.email-changed-security-notice", recipientEmail: account.email },
          { eventType: passwordChangeEmailEvent, recipientEmail: first === "password" ? account.email : proposedEmail },
        ]);
      }
    });

    await t.test("failed retry, successful replay and distinct changes preserve one in-app record per committed event", async () => {
      const account = await fixture();
      await perform(account);
      const first = (await state(account)).notices[0];
      await assert.rejects(perform(account), rejects("INVALID_PASSWORD"));
      assert.deepEqual((await state(account)).notices, [first]);
      // Duplicate materialization of the committed identity/work key cannot add a row.
      await assert.rejects(database.passwordChangeNotice.create({ data: first, select: { id: true } }));
      await assert.rejects(database.passwordChangeNotice.create({ data: { ...first, id: randomUUID() }, select: { id: true } }));
      assert.deepEqual((await state(account)).notices, [first]);
      await perform(account, change, { currentPassword: newPassword, newPassword: oldPassword });
      const after = (await state(account)).notices;
      assert.equal(after.length, 2);
      assert.equal(new Set(after.map(({ id }) => id)).size, 2);
      assert.equal(new Set(after.map(({ inAppWorkKey }) => inAppWorkKey)).size, 2);
      assert.equal(after[0].createdAt.getTime(), after[1].createdAt.getTime());
    });

    await t.test("notice detail is owner-only, rereads stored authorization, and exposes only the approved projection without logs", async () => {
      const account = await fixture(true);
      const other = await fixture();
      const lines = [];
      const original = { error: console.error, log: console.log, warn: console.warn };
      try {
        console.error = console.log = console.warn = (...values) => lines.push(values);
        assert.deepEqual(await perform(account), { status: "PASSWORD_CHANGED" });
        const notice = (await state(account)).notices[0];
        const projected = await readNotice(account.headers, notice.id, () => {});
        assert.deepEqual(projected, { id: notice.id, eventType: "account.password-changed", eventVersion: 1,
          createdAt: notice.createdAt, readAt: null });
        assert.deepEqual(await listNotices(account.headers, () => {}), [projected]);
        for (const headers of [new Headers(), new Headers({ cookie: "better-auth.session_token=forged" }), other.headers]) {
          assert.equal(await readNotice(headers, notice.id, () => {}), null);
        }
        assert.equal(await readNotice(account.headers, randomUUID(), () => {}), null);
        assert.deepEqual(await listNotices(other.headers, () => {}), []);
        const marked = await markNoticeRead(account.headers, notice.id, () => {});
        assert.deepEqual(marked, { id: notice.id, readAt: now });
        assert.deepEqual(await markNoticeRead(account.headers, notice.id, () => {}), marked);
        assert.deepEqual((await listNotices(account.headers, () => {}))[0], { ...projected, readAt: now });
        assert.equal(await markNoticeRead(other.headers, notice.id, () => {}), null);
        await assert.rejects(markNoticeRead(new Headers(), notice.id, () => {}), rejects("UNAUTHORIZED"));

        const handler = createPasswordChangeNoticeHandler(database, auth, "https://halaga.invalid");
        const listResponse = await handler(new Request("https://halaga.invalid/api/account/security-notices", {
          headers: { cookie: account.headers.get("cookie") ?? "" },
        }));
        assert.equal(listResponse.status, 200);
        assert.equal(listResponse.headers.get("cache-control"), "no-store");
        assert.deepEqual(await listResponse.json(), { notices: [{ ...projected,
          createdAt: projected.createdAt.toISOString(), readAt: now.toISOString() }] });
        const deniedWrite = await handler(new Request("https://halaga.invalid/api/account/security-notices/x/read", {
          method: "POST", headers: { cookie: account.headers.get("cookie") ?? "", origin: "https://evil.invalid",
            "content-type": "application/json" }, body: "{}",
        }), notice.id);
        assert.equal(deniedWrite.status, 401);
        const readResponse = await handler(new Request(`https://halaga.invalid/api/account/security-notices/${notice.id}/read`, {
          method: "POST", headers: { cookie: account.headers.get("cookie") ?? "", origin: "https://halaga.invalid",
            "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: "{}",
        }), notice.id);
        assert.equal(readResponse.status, 200);
        assert.deepEqual(await readResponse.json(), { status: "NOTICE_READ", readAt: now.toISOString() });
        await assert.rejects(readNotice(account.headers, account.email, () => {}), rejects("INVALID_INPUT"));
        const revoking = createPasswordChangeNoticeReader(database, { api: { async getSession(options) {
          const resolved = await auth.api.getSession(options);
          await database.session.deleteMany({ where: { userId: account.userId } });
          return resolved;
        } } }, () => now);
        assert.equal(await revoking(account.headers, notice.id, () => {}), null);
        account.headers = cookieHeaders(await signIn(account, newPassword));
        await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: now } });
        assert.equal(await readNotice(account.headers, notice.id, () => {}), null);
        const failing = createPasswordChangeNoticeReader(database, { api: { getSession() { throw new Error(account.email); } } });
        await assert.rejects(failing(account.headers, notice.id, () => {}), rejects("INTERNAL_ERROR"));
      } finally { Object.assign(console, original); }
      assert.deepEqual(lines, []);
    });

    const emailFor = (account) => database.outboxEvent.findFirst({ where: { accountId: account.accountId,
      eventType: passwordChangeEmailEvent }, include: { emailDelivery: true } });
    const emailFixture = async () => {
      await database.outboxEvent.deleteMany();
      const account = await fixture(true);
      await perform(account);
      await database.outboxEvent.deleteMany({ where: { eventType: { not: passwordChangeEmailEvent } } });
      return account;
    };
    const dispatcherFor = (send) => createAccountEmailDispatcher(database, send, () => now);
    const day = 24 * 60 * 60 * 1000;

    await t.test("approved text/HTML uses PHT event facts, no links, tracking, addressing or credentials in content", async () => {
      const message = renderAccountEmail("PASSWORD_CHANGED", "synthetic@example.invalid", undefined, new Date("2026-10-20T06:30:00Z"));
      assert.equal(message.subject, "Your Halaga password changed");
      assert.equal(message.text, "The password for your Halaga account changed on 20 Oct 2026, 14:30:00 PHT (UTC+08:00).\n\n" +
        "At that time, other sessions were signed out. The session used for this change remained signed in.\n\n" +
        "If you did not expect this change, open Halaga directly and use the password reset option.");
      assert.equal((message.html.match(/<p>/g) ?? []).length, 3);
      assert.match(message.html, /<html lang="en">/);
      assert.doesNotMatch(message.text + message.html, /synthetic@example|href|<img|https?:|token|synthetic-old/);
      assert.throws(() => renderAccountEmail("PASSWORD_CHANGED", message.to));
      assert.throws(() => renderAccountEmail("PASSWORD_CHANGED", message.to, "https://example.invalid", new Date()));
    });

    await t.test("email binding is mandatory, immutable and cannot be recreated after erasure; email write failures roll back delivery too", async () => {
      const account = await emailFixture();
      const event = await emailFor(account);
      assert.equal(event.emailDelivery.expiresAt.getTime(), event.createdAt.getTime() + passwordChangeDeliveryMs);
      await assert.rejects(database.accountEmailDelivery.update({ where: { id: event.emailDelivery.id },
        data: { expiresAt: new Date(event.emailDelivery.expiresAt.getTime() + 1) } }));
      for (const data of [{ recipientEmail: "other@example.invalid" }, { accountId: (await fixture()).accountId },
        { deduplicationKey: `password-changed-email:${randomUUID()}` }, { eventType: "unsupported" },
        { createdAt: new Date(event.createdAt.getTime() + 1) }]) {
        await assert.rejects(database.outboxEvent.update({ where: { id: event.id }, data }));
      }
      await assert.rejects(database.outboxEvent.create({ data: { id: randomUUID(), accountId: account.accountId,
        eventType: passwordChangeEmailEvent, eventVersion: 1, deduplicationKey: `password-changed-email:${randomUUID()}` } }));
      await database.outboxEvent.update({ where: { id: event.id }, data: { recipientEmail: null } });
      await assert.rejects(database.outboxEvent.update({ where: { id: event.id }, data: { recipientEmail: account.email } }));
      assert.deepEqual(await createAccountEmailIntentInspector(database, () => now)(event.id), { status: "STALE" });
    });

    await t.test("pending/later email switches never retarget committed password mail and accepted delivery erases only its recipient", async () => {
      const account = await emailFixture();
      const proposedEmail = `immutable-${randomUUID()}@example.invalid`;
      const proof = await emailChange.issue(account.headers, { proposedEmail }, () => {});
      await emailChange.consume(proof.token);
      // Isolate the password email from the separate email-switch notice and proof.
      await database.outboxEvent.deleteMany({ where: { eventType: { not: passwordChangeEmailEvent } } });
      const event = await emailFor(account);
      assert.deepEqual(await createAccountEmailIntentInspector(database, () => now)(event.id), { status: "NOTICE_RECORDED" });
      const messages = [];
      const dispatcher = dispatcherFor(async (message) => { messages.push(message); return "synthetic-password-accept"; });
      const before = await state(account);
      assert.deepEqual(await Promise.all([dispatcher.dispatchOne(), dispatcher.dispatchOne()]).then((values) => values.map((v) => v.status).sort()), ["ACCEPTED", "EMPTY"]);
      assert.equal(messages.length, 1);
      assert.equal(messages[0].to, account.email);
      const after = await emailFor(account);
      assert.equal(after.recipientEmail, null);
      assert.equal(after.emailDelivery.state, "ACCEPTED");
      assert.equal(after.emailDelivery.ciphertext.length, 0);
      assert.ok(after.dispatchedAt);
      for (const key of ["credentials", "sessions", "notices", "identity", "account"]) assert.deepEqual((await state(account))[key], before[key]);
      assert.deepEqual(await dispatcher.dispatchOne(), { status: "EMPTY" });
    });

    await t.test("provider failure and ambiguity preserve credentials/notices; recipients expire without resend or late-clock extension", async () => {
      for (const category of ["REJECTED", "AMBIGUOUS"]) {
        const account = await emailFixture();
        const before = await state(account);
        const event = await emailFor(account);
        let sends = 0;
        const dispatcher = dispatcherFor(async () => { sends++; throw new BrevoSendError(category); });
        assert.deepEqual(await dispatcher.dispatchOne(), { status: category === "REJECTED" ? "FAILED" : "UNKNOWN" });
        assert.equal((await emailFor(account)).recipientEmail, account.email);
        assert.deepEqual(await dispatcher.dispatchOne(), { status: "EMPTY" });
        for (const key of ["credentials", "sessions", "notices"]) assert.deepEqual((await state(account))[key], before[key]);
        now = new Date(event.emailDelivery.expiresAt.getTime() - 1);
        await dispatcher.recoverAndClean();
        assert.equal((await emailFor(account)).recipientEmail, account.email);
        now = event.emailDelivery.expiresAt;
        await dispatcher.recoverAndClean();
        await dispatcher.recoverAndClean();
        assert.equal((await emailFor(account)).recipientEmail, null);
        assert.equal((await emailFor(account)).emailDelivery.state, category === "REJECTED" ? "FAILED" : "UNKNOWN");
        assert.deepEqual(await dispatcher.dispatchOne(), { status: "EMPTY" });
        assert.equal(sends, 1);
      }
    });

    await t.test("password notice 429 retries, crashed leases and expired SENDING use existing bounds and fencing", async () => {
      const account = await emailFixture();
      const event = await emailFor(account);
      let sends = 0;
      const dispatcher = dispatcherFor(async () => { sends++; throw new BrevoSendError("RATE_LIMIT"); });
      for (const delay of [30, 60, 120, 240]) {
        assert.deepEqual(await dispatcher.dispatchOne(), { status: "RETRY_SCHEDULED" });
        const job = (await emailFor(account)).emailDelivery;
        assert.equal(job.availableAt.getTime(), now.getTime() + delay * 1000);
        assert.deepEqual(job.expiresAt, event.emailDelivery.expiresAt);
        now = job.availableAt;
      }
      assert.deepEqual(await dispatcher.dispatchOne(), { status: "FAILED" });
      assert.equal(sends, 5);
      for (const state of ["LEASED", "SENDING"]) {
        const next = await emailFixture();
        const work = await emailFor(next);
        await database.accountEmailDelivery.update({ where: { id: work.emailDelivery.id }, data: {
          state, leaseId: randomUUID(), leaseExpiresAt: now, attemptCount: 1 } });
        await dispatcher.recoverAndClean();
        assert.equal((await emailFor(next)).emailDelivery.state, state === "LEASED" ? "READY" : "UNKNOWN");
        if (state === "SENDING") assert.deepEqual(await dispatcher.dispatchOne(), { status: "EMPTY" });
      }
    });

    await t.test("exact seven-day expiry suppresses queued/leased mail, quarantines sending, and erases recipients", async () => {
      for (const state of ["READY", "LEASED", "SENDING"]) {
        const account = await emailFixture();
        const event = await emailFor(account);
        if (state !== "READY") await database.accountEmailDelivery.update({ where: { id: event.emailDelivery.id }, data: {
          state, leaseId: randomUUID(), leaseExpiresAt: new Date(event.emailDelivery.expiresAt.getTime() + day), attemptCount: 1 } });
        const dispatcher = dispatcherFor(async () => assert.fail("Expired email must not send"));
        now = event.emailDelivery.expiresAt;
        assert.deepEqual(await dispatcher.dispatchOne(), { status: "EMPTY" });
        await dispatcher.recoverAndClean();
        const after = await emailFor(account);
        assert.equal(after.recipientEmail, null);
        assert.equal(after.emailDelivery.state, state === "SENDING" ? "UNKNOWN" : "SUPPRESSED");
        assert.deepEqual(after.emailDelivery.terminalAt, event.emailDelivery.expiresAt);
        assert.equal(after.emailDelivery.leaseId, null);
      }
      const account = await emailFixture();
      const event = await emailFor(account);
      now = new Date(event.emailDelivery.expiresAt.getTime() - 1);
      assert.deepEqual(await dispatcherFor(async () => "synthetic-last-millisecond").dispatchOne(), { status: "ACCEPTED" });
    });

    await t.test("deletion atomically erases notices/recipients, fences a provider in flight, and rollback restores all records", async () => {
      const account = await emailFixture();
      const event = await emailFor(account);
      const before = await state(account);
      await assert.rejects(database.$transaction(async (tx) => {
        await tx.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: now } });
        throw new Error("synthetic-deletion-rollback");
      }));
      assert.deepEqual(await state(account), before);
      assert.equal((await emailFor(account)).emailDelivery.state, "READY");
      const entered = Promise.withResolvers();
      const released = Promise.withResolvers();
      const dispatcher = dispatcherFor(async () => { entered.resolve(); await released.promise; return "synthetic-late-accept"; });
      const pending = dispatcher.dispatchOne();
      await entered.promise;
      try {
        await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: now } });
        const after = await emailFor(account);
        assert.equal(after.recipientEmail, null);
        assert.equal(after.emailDelivery.state, "UNKNOWN");
        assert.equal(await database.passwordChangeNotice.count({ where: { accountId: account.accountId } }), 0);
      } finally { released.resolve(); }
      assert.deepEqual(await pending, { status: "UNKNOWN" });
      assert.equal((await emailFor(account)).dispatchedAt, null);
      assert.equal((await emailFor(account)).emailDelivery.providerMessageId, null);
      assert.deepEqual(await dispatcher.dispatchOne(), { status: "EMPTY" });
      assert.equal((await emailFor(account)).id, event.id);
      for (const state of ["READY", "LEASED", "FAILED", "UNKNOWN", "ACCEPTED"]) {
        const next = await emailFixture();
        const work = await emailFor(next);
        if (state === "ACCEPTED") await dispatcherFor(async () => "synthetic-accept").dispatchOne();
        else if (state !== "READY") await database.accountEmailDelivery.update({ where: { id: work.emailDelivery.id }, data: {
          state, leaseId: state === "LEASED" ? randomUUID() : null,
          leaseExpiresAt: state === "LEASED" ? new Date(now.getTime() + 120000) : null,
          terminalAt: ["FAILED", "UNKNOWN"].includes(state) ? now : null } });
        await database.userAccount.update({ where: { id: next.accountId }, data: { deletedAt: now } });
        const after = await emailFor(next);
        assert.equal(after.recipientEmail, null);
        assert.equal(after.emailDelivery.state, ["READY", "LEASED"].includes(state) ? "SUPPRESSED" : state);
        assert.equal(await database.passwordChangeNotice.count({ where: { accountId: next.accountId } }), 0);
      }
    });

    await t.test("account-lock waits recheck lease/expiry and expiry fences a provider acknowledgement already in flight", async () => {
      const account = await emailFixture();
      const event = await emailFor(account);
      let sends = 0;
      const dispatcher = dispatcherFor(async () => { sends++; return "synthetic-accept"; });
      await connection.query("BEGIN");
      await connection.query('SELECT id FROM "user_account" WHERE id = $1 FOR UPDATE', [account.accountId]);
      const pending = dispatcher.dispatchOne();
      let waiting = false;
      try {
        for (let attempt = 0; attempt < 100; attempt++) {
          await connection.query("SELECT pg_stat_clear_snapshot()");
          const { rowCount } = await connection.query(`SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
            AND wait_event_type = 'Lock' AND query LIKE '%FROM "user_account" WHERE id =%' AND pid <> pg_backend_pid()`);
          if (rowCount) { waiting = true; break; }
          await setTimeout(10);
        }
        now = event.emailDelivery.expiresAt;
      } finally { await connection.query("COMMIT"); }
      assert.deepEqual(await pending, { status: "LEASE_LOST" });
      assert.ok(waiting, "Observed password notice waiting on its account lock");
      assert.equal(sends, 0);
      await dispatcher.recoverAndClean();
      assert.equal((await emailFor(account)).recipientEmail, null);

      const next = await emailFixture();
      const work = await emailFor(next);
      const entered = Promise.withResolvers();
      const released = Promise.withResolvers();
      const paused = dispatcherFor(async () => { entered.resolve(); await released.promise; return "synthetic-late-accept"; });
      const inFlight = paused.dispatchOne();
      await entered.promise;
      try { now = work.emailDelivery.expiresAt; await paused.recoverAndClean(); }
      finally { released.resolve(); }
      assert.deepEqual(await inFlight, { status: "UNKNOWN" });
      const after = await emailFor(next);
      assert.equal(after.recipientEmail, null);
      assert.equal(after.emailDelivery.state, "UNKNOWN");
      assert.equal(after.dispatchedAt, null);
      assert.equal(after.emailDelivery.providerMessageId, null);
      assert.deepEqual(await paused.dispatchOne(), { status: "EMPTY" });
    });

    await t.test("metadata purge and in-app expiry use separate original clocks and repeated cleanup cannot backfill", async () => {
      for (const outcome of ["ACCEPTED", "FAILED", "UNKNOWN", "SUPPRESSED", "late-cleanup", "late-terminal"]) {
        const account = await emailFixture();
        const event = await emailFor(account);
        const eventTime = now;
        const dispatcher = dispatcherFor(async () => {
          if (outcome === "FAILED") throw new BrevoSendError("REJECTED");
          if (outcome === "UNKNOWN") throw new BrevoSendError("AMBIGUOUS");
          if (outcome === "late-terminal") now = new Date(eventTime.getTime() + 35 * day);
          return "synthetic-retention-accept";
        });
        if (outcome === "SUPPRESSED") {
          now = event.emailDelivery.expiresAt;
          await dispatcher.recoverAndClean();
        } else if (outcome !== "late-cleanup") await dispatcher.dispatchOne();
        const deadline = new Date(eventTime.getTime() + (["SUPPRESSED", "late-cleanup", "late-terminal"].includes(outcome) ? 37 : 30) * day);
        now = new Date(deadline.getTime() - 1);
        await dispatcher.recoverAndClean();
        assert.ok(await emailFor(account));
        now = deadline;
        await dispatcher.recoverAndClean();
        assert.equal(await emailFor(account), null);
        assert.equal(await database.accountEmailDelivery.count({ where: { id: event.emailDelivery.id } }), 0);
        assert.equal(await database.passwordChangeNotice.count({ where: { accountId: account.accountId } }), 1);
        now = new Date(eventTime.getTime() + passwordChangeNoticeMs);
        await dispatcher.recoverAndClean();
        await dispatcher.recoverAndClean();
        assert.equal(await database.passwordChangeNotice.count({ where: { accountId: account.accountId } }), 0);
        assert.deepEqual(await dispatcher.dispatchOne(), { status: "EMPTY" });
      }
      const account = await fixture();
      await perform(account);
      const notice = (await state(account)).notices[0];
      const cutoff = new Date(now.getTime() - passwordChangeNoticeMs);
      await database.passwordChangeNotice.update({ where: { id: notice.id }, data: { createdAt: cutoff } });
      assert.equal(await readNotice(account.headers, notice.id, () => {}), null);
      await database.passwordChangeNotice.update({ where: { id: notice.id }, data: { createdAt: new Date(cutoff.getTime() + 1) } });
      assert.ok(await readNotice(account.headers, notice.id, () => {}));
    });

    await t.test("existing email delivery failure, duplicate dispatch and cleanup never alter committed credentials or in-app notices", async () => {
      // Exercise an already approved signup email, not an invented password-change template.
      await database.outboxEvent.deleteMany();
      const account = await fixture();
      await perform(account);
      const before = await state(account);
      const savedOrigin = process.env.HALAGA_PUBLIC_ORIGIN;
      process.env.HALAGA_PUBLIC_ORIGIN = "http://127.0.0.1:3000";
      let sends = 0;
      const dispatcher = createAccountEmailDispatcher(database, async () => {
        sends++;
        throw new BrevoSendError("REJECTED");
      }, () => now);
      try {
        assert.deepEqual(await dispatcher.dispatchOne(), { status: "FAILED" });
        assert.deepEqual(await dispatcher.dispatchOne(), { status: "EMPTY" });
        await dispatcher.recoverAndClean();
        await dispatcher.recoverAndClean();
      } finally {
        if (savedOrigin === undefined) delete process.env.HALAGA_PUBLIC_ORIGIN;
        else process.env.HALAGA_PUBLIC_ORIGIN = savedOrigin;
      }
      assert.equal(sends, 1);
      assert.deepEqual(await state(account), before);
    });
  } finally { await sandbox.close(); }
});
