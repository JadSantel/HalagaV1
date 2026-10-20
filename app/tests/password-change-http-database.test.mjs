import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { createAuthPolicy } from "../src/server/auth-policy.ts";
import { createAccountPasswordChangeHandler } from "../src/server/repositories/password-change-http.ts";
import { createAccountFlowOperations } from "../src/server/repositories/account-flows.ts";
import { createAccountFlowPlugin } from "../src/server/account-flow-plugin.ts";
import { passwordChangeEmailEvent } from "../src/server/password-change-notice-policy.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

test("password-change protected handler shares limits and preserves the initiating session", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth } = sandbox;
  const origin = "http://127.0.0.1:3000";
  const configuration = { ...createAuthPolicy({ NODE_ENV: "test", BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: "synthetic-signup-secret-for-local-tests-only", AUTH_TRUSTED_IP_HEADER: "x-synthetic-ip" }),
    database: prismaAdapter(database, { provider: "postgresql", transaction: true }) };
  const handler = createAccountPasswordChangeHandler(database, auth, configuration);
  const second = createAccountPasswordChangeHandler(database, auth, configuration);
  const operations = createAccountFlowOperations(database, auth);
  const request = (body = {}, cookie = "", path = "/change-password", method = "POST") => new Request(`${origin}/api/auth${path}`, {
    method, headers: { origin, cookie, "content-type": "application/json", "x-synthetic-ip": "192.0.2.221" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
  const check = async (response, status, body) => {
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(response.headers.getSetCookie(), []);
    assert.deepEqual(await response.json(), body);
  };
  try {
    await t.test("two instances atomically share the 60/minute endpoint/IP limit", async () => {
      const responses = await Promise.all(Array.from({ length: 66 }, (_, index) => (index % 2 ? handler : second)(request())));
      assert.equal(responses.filter((response) => response.status === 401).length, 60);
      assert.equal(responses.filter((response) => response.status === 429).length, 6);
      for (const response of responses) {
        if (response.status === 429) assert.match(response.headers.get("x-retry-after"), /^\d+$/);
        await check(response, response.status, { code: response.status === 429 ? "RATE_LIMITED" : "UNAUTHORIZED" });
      }
      const [{ count }] = await database.rateLimit.findMany();
      assert.equal(count, 60);
      await database.rateLimit.deleteMany();
    });
    await t.test("only the one POST path is admitted; direct API and reader bypasses fail closed", async () => {
      for (const path of ["/get-session", "/list-sessions", "/sign-in/email", "/sign-up/email", "/change-email",
        "/change-password?newPassword=synthetic-query-sentinel", "/change-password/", "/password-change-notices"]) {
        await check(await handler(request({}, "", path)), 404, { code: "NOT_FOUND" });
      }
      await check(await handler(request({}, "", "/change-password", "GET")), 404, { code: "NOT_FOUND" });
      const privateAuth = betterAuth({ ...configuration, plugins: [createAccountFlowPlugin(() => operations, ["/change-password"])] });
      await assert.rejects(privateAuth.api.changePassword({ body: { currentPassword: "synthetic", newPassword: "synthetic-replacement" },
        headers: new Headers({ origin }), asResponse: true }), (error) => error.statusCode === 401);
    });
    await t.test("short-lived fresh session cannot be renewed by the outer library hook; logs contain no private material", async () => {
      const email = "http-password-change@example.invalid", password = "synthetic-http-old-password";
      await operations.signup({ email, password, displayName: "Synthetic HTTP", dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
      const signed = await operations.signIn(new Headers(), { email, password });
      const cookie = signed.headers.getSetCookie()[0].split(";")[0];
      const privateAuth = betterAuth({ ...configuration, plugins: [createAccountFlowPlugin(() => operations, ["/change-password"])] });
      const direct = await privateAuth.api.changePassword({ body: { currentPassword: password, newPassword: "synthetic-new-password" },
        headers: new Headers({ origin, cookie }), asResponse: true });
      assert.equal(direct.status, 403);
      assert.deepEqual(await direct.json(), { code: "FORBIDDEN" });
      await database.session.updateMany({ data: { expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
      const before = await database.session.findMany();
      const output = [], originals = Object.fromEntries(["log", "info", "warn", "error", "debug"].map((key) => [key, console[key]]));
      try {
        for (const key of Object.keys(originals)) console[key] = (...args) => output.push(args);
        await check(await handler(request({ currentPassword: "private-wrong-password-sentinel", newPassword: "synthetic-new-password" }, cookie)),
          400, { code: "INVALID_INPUT" });
        await check(await handler(request({ currentPassword: password, newPassword: "synthetic-new-password" }, cookie)),
          200, { status: "PASSWORD_CHANGED" });
      } finally { Object.assign(console, originals); }
      assert.deepEqual(output, []);
      assert.deepEqual(await database.session.findMany(), before);
      assert.ok(await auth.api.getSession({ headers: new Headers({ cookie }), query: { disableRefresh: true } }));
      assert.equal(await database.passwordChangeNotice.count(), 1);
      assert.equal(await database.outboxEvent.count({ where: { eventType: passwordChangeEmailEvent } }), 0);
    });
    await t.test("deleted accounts receive fixed password-change denial without effects on them or unrelated accounts", async () => {
      const password = "synthetic-deleted-account-password";
      const fixture = async (email) => {
        await operations.signup({ email, password, displayName: "Synthetic deletion guard",
          dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
        const signed = await operations.signIn(new Headers(), { email, password });
        const user = await database.user.findUnique({ where: { email }, select: { id: true } });
        return { userId: user.id, cookie: signed.headers.getSetCookie()[0].split(";")[0] };
      };
      const deleted = await fixture("deleted-maintenance@example.invalid");
      const unrelated = await fixture("unrelated-maintenance@example.invalid");
      await database.userAccount.update({ where: { authUserId: deleted.userId }, data: { deletedAt: new Date() } });
      const snapshot = (userId) => Promise.all([
        database.user.findUnique({ where: { id: userId } }),
        database.userAccount.findUnique({ where: { authUserId: userId } }),
        database.account.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        database.session.findMany({ where: { userId }, orderBy: { id: "asc" } }),
        database.verification.findMany({ orderBy: { id: "asc" } }),
        database.passwordChangeNotice.findMany({ where: { account: { authUserId: userId } } }),
        database.outboxEvent.findMany({ where: { account: { authUserId: userId } }, include: { emailDelivery: true } }),
      ]);
      const before = await snapshot(deleted.userId), otherBefore = await snapshot(unrelated.userId);
      const body = { currentPassword: password, newPassword: "synthetic-unrelated-new-password" };
      await check(await handler(request(body, deleted.cookie)), 400, { code: "INVALID_INPUT" });
      await check(await handler(request(body)), 401, { code: "UNAUTHORIZED" });
      assert.deepEqual(await snapshot(deleted.userId), before);
      assert.deepEqual(await snapshot(unrelated.userId), otherBefore);
      await check(await handler(request(body, unrelated.cookie)), 200, { status: "PASSWORD_CHANGED" });
      assert.deepEqual(await snapshot(deleted.userId), before);
      assert.equal(await database.passwordChangeNotice.count({ where: { account: { authUserId: unrelated.userId } } }), 1);
    });
  } finally { await sandbox.close(); }
});
