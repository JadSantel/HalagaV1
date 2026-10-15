import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createAuthPolicy } from "../src/server/auth-policy.ts";
import { openLocalDatabase } from "../scripts/local-database.mjs";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";
import { createAccountFlowHandler, createAccountFlowPlugin } from "../src/server/account-flow-plugin.ts";
import { createAccountFlowOperations } from "../src/server/repositories/account-flows.ts";

test("two auth instances share atomic PostgreSQL limits with synthetic isolated counters", async () => {
  const connection = await openLocalDatabase();
  const schema = `auth_test_${randomUUID().replaceAll("-", "")}`;
  const clients = [];
  try {
    await connection.query(`CREATE SCHEMA "${schema}"`);
    await connection.query(`SET search_path TO "${schema}"`);
    await connection.query(await readFile(new URL("../prisma/migrations/20261013090000_auth_rate_limits/migration.sql", import.meta.url), "utf8"));
    const policy = createAuthPolicy({
      NODE_ENV: "production", BETTER_AUTH_URL: "https://app.example.test",
      BETTER_AUTH_SECRET: "synthetic-database-policy-secret-for-tests-only",
      AUTH_TRUSTED_IP_HEADER: "x-synthetic-client-ip",
    });
    const instances = Array.from({ length: 2 }, () => {
      const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }), log: [] });
      clients.push(client);
      return betterAuth({ ...policy, database: prismaAdapter(client, { provider: "postgresql", transaction: true }), emailAndPassword: { enabled: true } });
    });
    const send = (index, ip = "192.0.2.1") => instances[index % 2].handler(new Request("https://app.example.test/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin: "https://app.example.test", "content-type": "application/json", "x-synthetic-client-ip": ip },
      body: "{}", // Invalid synthetic input: no user, session or email can be created.
    }));
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => send(index)));
    assert.equal(responses.filter((response) => response.status !== 429).length, 3);
    assert.equal(responses.filter((response) => response.status === 429).length, 9);
    assert.ok(responses.every((response) => response.status === 400 || response.status === 429));
    const { rows } = await connection.query('SELECT "count" FROM "RateLimit"');
    assert.deepEqual(rows.map((row) => row.count), [3]);
    assert.equal((await send(1)).status, 429);
    assert.equal((await send(0, "192.0.2.2")).status, 400, "A different reviewed client IP gets its own bucket");
    await connection.query('UPDATE "RateLimit" SET "lastRequest" = $1', [Date.now() - 901000]);
    assert.equal((await send(1)).status, 400, "Expired counters reset across instances");
  } finally {
    await Promise.all(clients.map((client) => client.$disconnect()));
    await connection.query("SET search_path TO public");
    await connection.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await connection.end();
  }
});

test("unmounted account handler integrates real PostgreSQL operations using synthetic recipients only", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, connection, auth: seedAuth } = sandbox;
  const origin = "http://127.0.0.1:3000";
  const oldPassword = "synthetic-integration-old-password";
  const newPassword = "synthetic-integration-new-password";
  let now = new Date();
  let ipIndex = 1;
  const instance = () => {
    let operations;
    const auth = betterAuth({
      ...createAuthPolicy({ NODE_ENV: "test", BETTER_AUTH_URL: origin,
        BETTER_AUTH_SECRET: "synthetic-signup-secret-for-local-tests-only",
        AUTH_TRUSTED_IP_HEADER: "x-synthetic-client-ip" }),
      database: prismaAdapter(database, { provider: "postgresql", transaction: true }),
      emailAndPassword: { enabled: true, requireEmailVerification: false },
      plugins: [createAccountFlowPlugin(() => operations)],
    });
    operations = createAccountFlowOperations(database, auth, () => now);
    return { auth, operations, handler: createAccountFlowHandler(auth) };
  };
  const primary = instance();
  const second = instance();
  const send = (path, body, cookie, handler = primary.handler, ip) => handler(new Request(`${origin}/api/auth${path}`, {
    method: "POST", headers: { origin, "content-type": "application/json",
      "x-synthetic-client-ip": ip ?? `203.0.113.${ipIndex++}`, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
  }));
  const input = (email = `integration-${randomUUID()}@example.invalid`) => ({ email, displayName: "Synthetic adult",
    password: oldPassword, dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
  const signIn = async (email, password = oldPassword) => {
    // Trusted synthetic fixture only; no sign-in HTTP route is mounted by this slice.
    const result = await seedAuth.api.signInEmail({ body: { email, password }, returnHeaders: true });
    return result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  };
  const fixture = async (verified = false) => {
    now = new Date();
    const body = input();
    assert.equal((await send("/sign-up/email", body)).status, 200);
    const user = await database.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (verified) await primary.operations.verification.consume((await primary.operations.verification.issue(body.email)).token);
    const cookie = await signIn(body.email);
    now = new Date();
    return { email: body.email, userId: user.id, cookie };
  };
  const assertCleared = (response) => {
    const cookie = response.headers.getSetCookie().find((value) => value.includes("session_token="));
    assert.ok(cookie && /Max-Age=0/i.test(cookie));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.doesNotMatch(cookie, /Domain=/i);
  };
  const assertSafeFailure = async (response, status) => {
    assert.equal(response.status, status);
    const json = await response.json();
    assert.deepEqual(Object.keys(json), ["code"]);
    assert.deepEqual(response.headers.getSetCookie(), []);
    assert.equal(response.headers.get("cache-control"), "no-store");
  };
  try {
    await t.test("generic signup/resend/reset responses hide duplicate and verification state; ownership selectors are rejected", async () => {
      const account = await fixture();
      const duplicate = await send("/sign-up/email", input(account.email));
      assert.deepEqual(await duplicate.json(), { status: "REQUEST_RECEIVED" });
      for (const path of ["/send-verification-email", "/request-password-reset"]) {
        for (const email of [account.email, `absent-${randomUUID()}@example.invalid`]) {
          const response = await send(path, { email });
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { status: "REQUEST_RECEIVED" });
          assert.deepEqual(response.headers.getSetCookie(), []);
        }
      }
      await primary.operations.verification.consume((await primary.operations.verification.issue(account.email)).token);
      const verified = await send("/send-verification-email", { email: account.email });
      assert.deepEqual(await verified.json(), { status: "REQUEST_RECEIVED" });
      for (const [path, body] of [["/sign-up/email", { ...input(), accountId: randomUUID() }],
        ["/send-verification-email", { email: account.email, accountId: randomUUID() }],
        ["/request-password-reset", { email: account.email, accountId: randomUUID() }]]) {
        await assertSafeFailure(await send(path, body), 400);
      }
    });

    await t.test("verification clears the browser cookie only after commit; reuse fails safely", async () => {
      const account = await fixture();
      const { token } = await primary.operations.verification.issue(account.email);
      const response = await send("/verify-email", { token }, account.cookie);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "EMAIL_VERIFIED" });
      assertCleared(response);
      assert.equal(await seedAuth.api.getSession({ headers: new Headers({ cookie: account.cookie }) }), null);
      await assertSafeFailure(await send("/verify-email", { token }, account.cookie), 400);
    });

    await t.test("reset revokes all sessions and clears cookies; invalid input leaves cookies alone", async () => {
      const account = await fixture();
      const otherCookie = await signIn(account.email);
      const { token } = await primary.operations.reset.issue(account.email);
      await assertSafeFailure(await send("/reset-password", { token, newPassword, accountId: randomUUID() }, account.cookie), 400);
      const response = await send("/reset-password", { token, newPassword }, account.cookie);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "PASSWORD_RESET" });
      assertCleared(response);
      for (const cookie of [account.cookie, otherCookie]) assert.equal(await seedAuth.api.getSession({ headers: new Headers({ cookie }) }), null);
      await assert.rejects(signIn(account.email));
      assert.ok(await signIn(account.email, newPassword));
    });

    await t.test("email request resolves the cookie owner; proof switches email and clears every session", async () => {
      const account = await fixture(true);
      const other = await fixture(true);
      const proposedEmail = `proposed-${randomUUID()}@example.invalid`;
      await assertSafeFailure(await send("/change-email", { proposedEmail }), 401);
      await assertSafeFailure(await send("/change-email", { proposedEmail, accountId: other.userId }, account.cookie), 400);
      const request = await send("/change-email", { proposedEmail }, account.cookie);
      assert.equal(request.status, 200);
      assert.deepEqual(await request.json(), { status: "REQUEST_RECEIVED" });
      assert.equal((await database.user.findUnique({ where: { id: account.userId }, select: { email: true } })).email, account.email);
      // Synthetic trusted issuer supplies proof; no public response/transport provides it.
      const { token } = await primary.operations.emailChange.issue(new Headers({ cookie: account.cookie }), { proposedEmail }, () => {});
      const response = await send("/confirm-email-change", { token }, account.cookie);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "EMAIL_CHANGED" });
      assertCleared(response);
      assert.equal(await seedAuth.api.getSession({ headers: new Headers({ cookie: account.cookie }) }), null);
      assert.ok(await seedAuth.api.getSession({ headers: new Headers({ cookie: other.cookie }) }));
      assert.ok(await signIn(proposedEmail));
      assert.equal(await database.outboxEvent.count({ where: { eventType: "account.email-changed-security-notice", recipientEmail: account.email } }), 1);
    });

    await t.test("password change preserves initiating cookie/session; ownership and original freshness stay enforced", async () => {
      const account = await fixture();
      const otherCookie = await signIn(account.email);
      await assertSafeFailure(await send("/change-password", { currentPassword: oldPassword, newPassword }), 401);
      await assertSafeFailure(await send("/change-password", { currentPassword: oldPassword, newPassword, accountId: randomUUID() }, account.cookie), 400);
      const session = await seedAuth.api.getSession({ headers: new Headers({ cookie: account.cookie }) });
      const before = await database.session.findUnique({ where: { id: session.session.id } });
      // Exactly 15 minutes fails even though the session remains valid and renewed.
      now = new Date(before.createdAt.getTime() + 900000);
      await database.session.update({ where: { id: before.id }, data: { updatedAt: now, expiresAt: new Date(now.getTime() + 604800000) } });
      await assertSafeFailure(await send("/change-password", { currentPassword: oldPassword, newPassword }, account.cookie), 401);
      now = new Date(before.createdAt.getTime() + 899999);
      const preserved = await database.session.findUnique({ where: { id: before.id } });
      const response = await send("/change-password", { currentPassword: oldPassword, newPassword }, account.cookie);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "PASSWORD_CHANGED" });
      assert.deepEqual(response.headers.getSetCookie(), []);
      assert.deepEqual(await database.session.findUnique({ where: { id: before.id } }), preserved);
      assert.ok(await seedAuth.api.getSession({ headers: new Headers({ cookie: account.cookie }) }));
      assert.equal(await seedAuth.api.getSession({ headers: new Headers({ cookie: otherCookie }) }), null);
      assert.ok(await signIn(account.email, newPassword));
    });

    await t.test("deferred commit failure preserves proof/state/cookie for retry through the same handler", async () => {
      const account = await fixture();
      const { token } = await primary.operations.verification.issue(account.email);
      await connection.query(`CREATE FUNCTION synthetic_integration_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'private-integration-sentinel'; END $$`);
      await connection.query(`CREATE CONSTRAINT TRIGGER synthetic_integration_failure AFTER UPDATE ON "user_account"
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION synthetic_integration_failure()`);
      try {
        const response = await send("/verify-email", { token }, account.cookie);
        await assertSafeFailure(response, 500);
        assert.equal((await database.user.findUnique({ where: { id: account.userId }, select: { emailVerified: true } })).emailVerified, false);
        assert.ok(await seedAuth.api.getSession({ headers: new Headers({ cookie: account.cookie }) }));
      } finally {
        await connection.query('DROP TRIGGER synthetic_integration_failure ON "user_account"');
      }
      const retry = await send("/verify-email", { token }, account.cookie);
      assert.equal(retry.status, 200);
      assertCleared(retry);
    });

    await t.test("shared PostgreSQL counters admit exactly three concurrent signup requests across two handlers", async () => {
      now = new Date();
      const body = input();
      const ip = "192.0.2.201";
      const responses = await Promise.all(Array.from({ length: 12 }, (_, index) =>
        send("/sign-up/email", body, undefined, index % 2 ? primary.handler : second.handler, ip)));
      assert.equal(responses.filter((response) => response.status === 200).length, 3);
      assert.equal(responses.filter((response) => response.status === 429).length, 9);
      assert.equal(await database.user.count({ where: { email: body.email } }), 1);
      const { rows } = await connection.query('SELECT "count", "lastRequest" FROM "RateLimit" WHERE "count" = 3');
      assert.ok(rows.length >= 1);
      const before = rows.map((row) => ({ ...row }));
      assert.equal((await send("/sign-up/email", body, undefined, second.handler, ip)).status, 429);
      assert.deepEqual((await connection.query('SELECT "count", "lastRequest" FROM "RateLimit" WHERE "count" = 3')).rows, before,
        "Denied requests must not move the inactivity deadline");
      assert.equal((await send("/sign-up/email", body, undefined, second.handler, "192.0.2.202")).status, 200);
      await connection.query('UPDATE "RateLimit" SET "lastRequest" = $1', [Date.now() - 901000]);
      assert.equal((await send("/sign-up/email", body, undefined, second.handler, ip)).status, 200);
    });
  } finally { await sandbox.close(); }
});
