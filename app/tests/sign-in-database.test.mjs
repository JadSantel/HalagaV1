import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { createAccountSignInOperation, SignInRejected } from "../src/server/repositories/sign-in.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { createPasswordChangeOperation } from "../src/server/repositories/password-change.ts";
import { createPasswordResetOperations } from "../src/server/repositories/password-reset.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createEmailChangeOperations } from "../src/server/repositories/email-change.ts";
import { accountEmailPaths } from "../src/server/account-flow-plugin.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

const password = "synthetic-sign-in-old-password";
const replacement = "synthetic-sign-in-new-password";
const rejected = (code) => (error) => error instanceof SignInRejected &&
  error.code === code && error.message === code && error.cause === undefined;
const cookies = (result) => new Headers({ cookie: result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
const gate = () => {
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const deadline = setTimeout(10000, undefined, { ref: false }).then(() => { throw new Error("Synthetic gate was not reached"); });
  return { entered: Promise.race([entered.promise, deadline]), release: release.resolve,
    async pause(value) { entered.resolve(value); await release.promise; } };
};

// Observe real installed-adapter model calls and their PostgreSQL backend/transaction.
// Gates wrap real writes; no auth result, adapter query or database lock is simulated.
function observe(database, { trace = [], sessionGate, commitGate, lockGate } = {}) {
  return new Proxy(database, { get(target, key) {
    if (key !== "$transaction") return Reflect.get(target, key);
    return (work) => target.$transaction(async (transaction) => {
      const observed = new Proxy(transaction, { get(client, model) {
        if (model === "$queryRaw" && lockGate) return async (...args) => {
          const rows = await client.$queryRaw(...args);
          if (args[0].join("").includes('WHERE u.email =')) await lockGate.pause(rows.length);
          return rows;
        };
        if (!["user", "account", "session"].includes(model)) return Reflect.get(client, model);
        return new Proxy(client[model], { get(delegate, method) {
          if (typeof delegate[method] !== "function") return delegate[method];
          return async (...args) => {
            const [identity] = await client.$queryRaw`SELECT pg_backend_pid() AS pid, txid_current()::text AS xid`;
            trace.push({ model, method, ...identity });
            const result = await delegate[method](...args);
            if (model === "session" && method === "create" && sessionGate) await sessionGate.pause(identity.pid);
            return result;
          };
        } });
      } });
      const result = await work(observed);
      if (commitGate) {
        const [{ pid }] = await transaction.$queryRaw`SELECT pg_backend_pid() AS pid`;
        await commitGate.pause(pid);
      }
      return result;
    });
  } });
}

test("sign-in input and raw-operation boundary stay private", async () => {
  const operation = createAccountSignInOperation({ $transaction() { assert.fail("No database access"); } }, {});
  for (const input of [null, {}, { email: "bad", password }, { email: "adult@example.invalid", password: "" },
    { email: "adult@example.invalid", password, userId: randomUUID() },
    { email: "adult@example.invalid", password, callbackURL: "https://example.invalid" }]) {
    await assert.rejects(operation(new Headers(), input), rejected("INVALID_INPUT"));
  }
  for (const path of ["/sign-in/email", "/sign-up/email", "/change-password"]) assert.ok(!accountEmailPaths.includes(path));
  const route = await readFile(new URL("../src/app/api/auth/[...all]/route.ts", import.meta.url), "utf8");
  assert.match(route, /handleAccountSignInRequest/);
  assert.doesNotMatch(route, /createAccountSignInOperation|createAccountAuth|auth\.handler/);
});

test("synthetic PostgreSQL serializes installed Better Auth credential reads through session commit", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  const context = await auth.$context;
  const signIn = createAccountSignInOperation(database, auth);
  const login = (account, operation = signIn, value = password) => operation(new Headers(), { email: account.email, password: value });
  const fixture = async (verified = false) => {
    const email = `sign-in-${randomUUID()}@example.invalid`;
    await createSignupOperation(database, auth)({ email, password, displayName: "Synthetic sign-in adult",
      dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    const { id: userId } = await database.user.findUnique({ where: { email }, select: { id: true } });
    if (verified) await createEmailVerificationOperations(database).consume((await createEmailVerificationOperations(database).issue(email)).token);
    const result = await login({ email });
    return { email, userId, headers: cookies(result), initiatingToken: result.response.token };
  };
  const state = async (account) => ({
    identity: await database.user.findUnique({ where: { id: account.userId }, select: { id: true, email: true, emailVerified: true } }),
    domain: await database.userAccount.findUnique({ where: { authUserId: account.userId }, select: { id: true, emailVerifiedAt: true } }),
    credentials: await database.account.findMany({ where: { userId: account.userId }, orderBy: { id: "asc" }, select: { id: true, password: true } }),
    sessions: await database.session.findMany({ where: { userId: account.userId }, orderBy: { id: "asc" }, select: {
      id: true, userId: true, token: true, createdAt: true, expiresAt: true } }),
  });
  const assertCredential = async (account, expected) => {
    const current = await state(account);
    assert.equal(current.credentials.length, 1);
    assert.ok(await context.password.verify({ hash: current.credentials[0].password, password: expected }));
    return current;
  };
  const waitForBlock = async (blocker) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      await connection.query("SELECT pg_stat_clear_snapshot()");
      const result = await connection.query(`SELECT pid FROM pg_stat_activity WHERE datname = current_database()
        AND wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))`, [blocker]);
      if (result.rowCount) return result.rows[0].pid;
      await setTimeout(10);
    }
    assert.fail("Must observe PostgreSQL lock wait with the expected blocking backend");
  };
  const mutation = async (kind, account) => {
    if (kind === "password-change") return {
      run: (db) => createPasswordChangeOperation(db, auth)(account.headers, { currentPassword: password, newPassword: replacement }, () => {}),
    };
    if (kind === "reset") {
      const { token } = await createPasswordResetOperations(database, auth).issue(account.email);
      return { run: (db) => createPasswordResetOperations(db, auth).consume({ token, newPassword: replacement }) };
    }
    if (kind === "verification") {
      const { token } = await createEmailVerificationOperations(database).issue(account.email);
      return { run: (db) => createEmailVerificationOperations(db).consume(token) };
    }
    if (kind === "email-proof") {
      const newEmail = `proved-${randomUUID()}@example.invalid`;
      const { token } = await createEmailChangeOperations(database, auth).issue(account.headers, { proposedEmail: newEmail }, () => {});
      return { newEmail, run: (db) => createEmailChangeOperations(db, auth).consume(token) };
    }
    // Synthetic verification-state maintenance uses the same account locks and revocation.
    return { run: (db) => db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT u.id FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
        WHERE u.id = ${account.userId} FOR UPDATE OF u, a`;
      await tx.user.update({ where: { id: account.userId }, data: { emailVerified: false }, select: { id: true } });
      await tx.userAccount.update({ where: { authUserId: account.userId }, data: { emailVerifiedAt: null }, select: { id: true } });
      await tx.session.deleteMany({ where: { userId: account.userId } });
    }) };
  };
  try {
    await t.test("ordinary verified and unverified sign-in uses one backend/transaction for lookup and persistence", async () => {
      for (const verified of [false, true]) {
        const account = await fixture(verified);
        const before = await state(account);
        const trace = [];
        const result = await login({ ...account, email: account.email.toUpperCase() }, createAccountSignInOperation(observe(database, { trace }), auth));
        const after = await state(account);
        assert.equal(result.response.user.emailVerified, verified);
        assert.deepEqual(after.credentials, before.credentials);
        assert.deepEqual(after.domain, before.domain);
        assert.equal(after.sessions.length, before.sessions.length + 1);
        assert.ok(after.sessions.some((row) => row.token === result.response.token));
        assert.ok(await auth.api.getSession({ headers: cookies(result) }));
        assert.ok(trace.some((row) => row.model === "user" && row.method === "findFirst"));
        assert.ok(trace.some((row) => row.model === "session" && row.method === "create"));
        assert.equal(new Set(trace.map((row) => `${row.pid}:${row.xid}`)).size, 1);
      }
    });

    for (const kind of ["password-change", "reset", "verification", "email-proof", "verification-clear"]) {
      await t.test(`${kind}: sign-in holds locks after credential read and through stored session; writer waits then revokes`, async () => {
        const account = await fixture(["email-proof", "verification-clear"].includes(kind));
        const other = await fixture();
        const otherBefore = await state(other);
        const command = await mutation(kind, account);
        const verified = gate();
        const persisted = gate();
        const trace = [];
        const pausedAuth = { options: { ...auth.options, emailAndPassword: { ...auth.options.emailAndPassword,
          password: { hash: context.password.hash, verify: async (value) => {
            const result = await context.password.verify(value);
            await verified.pause();
            return result;
          } } } } };
        let returned = false;
        const pendingLogin = login(account, createAccountSignInOperation(observe(database, { trace, sessionGate: persisted }), pausedAuth))
          .then((result) => { returned = true; return result; });
        const loginOutcome = Promise.allSettled([pendingLogin]);
        let writerOutcome;
        try {
          await verified.entered;
          const blocker = trace[0].pid;
          writerOutcome = Promise.allSettled([command.run(database)]);
          await waitForBlock(blocker);
          // An unrelated account can sign in while this account's lock is held.
          const independent = await login(other);
          assert.deepEqual((await state(other)).credentials, otherBefore.credentials);
          assert.deepEqual((await state(other)).domain, otherBefore.domain);
          assert.ok((await state(other)).sessions.some((row) => row.token === independent.response.token));
          verified.release();
          assert.equal(await persisted.entered, blocker);
          await waitForBlock(blocker);
          assert.equal(returned, false, "No cookie/result before session commit");
          // Another connection cannot yet see the inserted session.
          assert.equal((await state(account)).sessions.length, 1);
        } finally { verified.release(); persisted.release(); }
        const [signedIn] = await loginOutcome;
        assert.equal(signedIn.status, "fulfilled");
        assert.equal((await writerOutcome)[0].status, "fulfilled");
        const after = await assertCredential(account, ["reset", "password-change"].includes(kind) ? replacement : password);
        assert.equal(after.sessions.length, kind === "password-change" ? 1 : 0);
        if (kind === "password-change") assert.equal(after.sessions[0].token, account.initiatingToken);
        assert.ok(!after.sessions.some((row) => row.token === signedIn.value.response.token));
        assert.equal(await auth.api.getSession({ headers: cookies(signedIn.value) }), null);
        assert.equal(after.identity.emailVerified, kind !== "password-change" && kind !== "reset" && kind !== "verification-clear");
        assert.equal(after.domain.emailVerifiedAt !== null, after.identity.emailVerified);
        assert.equal(after.identity.email, command.newEmail ?? account.email);
      });

      await t.test(`${kind}: writer commits first; waiting sign-in rereads current credentials and verification`, async () => {
        const account = await fixture(["email-proof", "verification-clear"].includes(kind));
        const command = await mutation(kind, account);
        const held = gate();
        const writer = Promise.allSettled([command.run(observe(database, { commitGate: held }))]);
        const blocker = await held.entered;
        const pendingLogin = Promise.allSettled([login(account)]);
        try { await waitForBlock(blocker); } finally { held.release(); }
        assert.equal((await writer)[0].status, "fulfilled");
        const [result] = await pendingLogin;
        const invalidated = ["password-change", "reset", "email-proof"].includes(kind);
        assert.equal(result.status, invalidated ? "rejected" : "fulfilled");
        if (invalidated) assert.ok(rejected("INVALID_CREDENTIALS")(result.reason));
        else assert.equal(result.value.response.user.emailVerified, kind === "verification");
        const after = await assertCredential(account, ["password-change", "reset"].includes(kind) ? replacement : password);
        assert.equal(after.sessions.length, kind === "password-change" || !invalidated ? 1 : 0);
        assert.equal(after.identity.email, command.newEmail ?? account.email);
        assert.equal(after.identity.emailVerified, ["verification", "email-proof"].includes(kind));
        assert.equal(after.domain.emailVerifiedAt !== null, after.identity.emailVerified);
        // A fresh sign-in uses the new state, including a new address/password.
        const fresh = await login({ ...account, email: after.identity.email }, signIn,
          ["password-change", "reset"].includes(kind) ? replacement : password);
        assert.equal(fresh.response.user.emailVerified, after.identity.emailVerified);
        assert.ok((await state(account)).sessions.some((row) => row.token === fresh.response.token));
      });
    }

    await t.test("an address appearing after an empty lock lookup cannot authenticate without account locks", async () => {
      const account = await fixture(true);
      const newEmail = `appearing-${randomUUID()}@example.invalid`;
      const { token } = await createEmailChangeOperations(database, auth).issue(account.headers, { proposedEmail: newEmail }, () => {});
      const held = gate();
      const pending = Promise.allSettled([login({ email: newEmail }, createAccountSignInOperation(observe(database, { lockGate: held }), auth))]);
      try {
        assert.equal(await held.entered, 0);
        await createEmailChangeOperations(database, auth).consume(token);
      } finally { held.release(); }
      const [result] = await pending;
      assert.equal(result.status, "rejected");
      assert.ok(rejected("INVALID_CREDENTIALS")(result.reason));
      const after = await assertCredential(account, password);
      assert.equal(after.identity.email, newEmail);
      assert.equal(after.identity.emailVerified, true);
      assert.ok(after.domain.emailVerifiedAt);
      assert.equal(after.sessions.length, 0);
      await login({ email: newEmail });
    });

    await t.test("session write and deferred commit failure discard cookies, roll back and allow retry without logs", async () => {
      const account = await fixture();
      await connection.query(`CREATE FUNCTION synthetic_sign_in_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'private-sign-in-error-password-token-email'; END $$`);
      const messages = [];
      const originals = [console.error, console.warn, console.log];
      console.error = console.warn = console.log = (...args) => messages.push(args);
      try {
        for (const deferred of [false, true]) {
          const before = await state(account);
          await connection.query(`CREATE ${deferred ? "CONSTRAINT " : ""}TRIGGER synthetic_failure
            ${deferred ? "AFTER" : "BEFORE"} INSERT ON "session" ${deferred ? "DEFERRABLE INITIALLY DEFERRED" : ""}
            FOR EACH ROW EXECUTE FUNCTION synthetic_sign_in_failure()`);
          try { await assert.rejects(login(account), rejected("INTERNAL_ERROR")); }
          finally { await connection.query('DROP TRIGGER synthetic_failure ON "session"'); }
          assert.deepEqual(await state(account), before);
          const retried = await login(account);
          assert.equal((await state(account)).sessions.length, before.sessions.length + 1);
          assert.ok(await auth.api.getSession({ headers: cookies(retried) }));
        }
        const before = await state(account);
        await assert.rejects(login(account, signIn, "wrong-synthetic-password"), rejected("INVALID_CREDENTIALS"));
        await assert.rejects(login({ email: "unknown@example.invalid" }), rejected("INVALID_CREDENTIALS"));
        const failingAuth = { options: { ...auth.options, emailAndPassword: { ...auth.options.emailAndPassword,
          password: { hash: context.password.hash, verify() { throw new Error("private-password-hash-material"); } } } } };
        await assert.rejects(login(account, createAccountSignInOperation(database, failingAuth)), rejected("INTERNAL_ERROR"));
        assert.deepEqual(await state(account), before);
      } finally { [console.error, console.warn, console.log] = originals; }
      assert.deepEqual(messages, []);
    });

    await t.test("writer rollback releases waiting sign-in on original state; same command retries and revokes it", async () => {
      const account = await fixture();
      const before = await state(account);
      const { token } = await createPasswordResetOperations(database, auth).issue(account.email);
      const held = gate();
      const rollbackDatabase = new Proxy(database, { get(target, key) {
        if (key !== "$transaction") return Reflect.get(target, key);
        return (work) => target.$transaction(async (tx) => {
          await work(tx);
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          await held.pause(pid);
          throw new Error("synthetic-private-rollback");
        });
      } });
      const reset = createPasswordResetOperations(rollbackDatabase, auth);
      const writer = Promise.allSettled([reset.consume({ token, newPassword: replacement })]);
      const blocker = await held.entered;
      const pendingLogin = Promise.allSettled([login(account)]);
      try { await waitForBlock(blocker); } finally { held.release(); }
      assert.equal((await writer)[0].status, "rejected");
      const [result] = await pendingLogin;
      assert.equal(result.status, "fulfilled");
      const rolledBack = await state(account);
      assert.deepEqual(rolledBack.credentials, before.credentials);
      assert.deepEqual(rolledBack.identity, before.identity);
      assert.deepEqual(rolledBack.domain, before.domain);
      assert.equal(rolledBack.sessions.length, 2);
      await createPasswordResetOperations(database, auth).consume({ token, newPassword: replacement });
      assert.equal((await assertCredential(account, replacement)).sessions.length, 0);
    });
  } finally { await sandbox.close(); }
});
