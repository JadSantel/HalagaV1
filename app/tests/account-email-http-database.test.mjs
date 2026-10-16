import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { createAuthPolicy } from "../src/server/auth-policy.ts";
import { createAccountEmailHandler } from "../src/server/repositories/account-email-http.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { createAccountEmailDispatcher } from "../src/server/repositories/account-email-dispatch.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

test("mounted email-handler boundary completes fragment-link commands with fake delivery", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth } = sandbox;
  const origin = "http://127.0.0.1:3000";
  const savedOrigin = process.env.HALAGA_PUBLIC_ORIGIN;
  process.env.HALAGA_PUBLIC_ORIGIN = origin;
  const policy = createAuthPolicy({ NODE_ENV: "development", BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: "synthetic-signup-secret-for-local-tests-only", AUTH_TRUSTED_IP_HEADER: "x-synthetic-ip" });
  const handler = createAccountEmailHandler(database, auth, {
    ...policy, database: prismaAdapter(database, { provider: "postgresql", transaction: true }),
  });
  let counter = 0;
  const request = (path, body = {}, overrides = {}) => handler(new Request(`${origin}/api/auth/${path}`, {
    method: "POST", headers: { origin, "content-type": "application/json", "x-synthetic-ip": `192.0.2.${++counter}`, ...overrides },
    body: JSON.stringify(body),
  }));
  const password = "synthetic-http-password-only";
  const email = `http-${randomUUID()}@example.invalid`;
  const messages = [];
  const dispatcher = createAccountEmailDispatcher(database, async (message) => { messages.push(message); return "synthetic-accept"; });
  const token = () => new URL(messages.at(-1).text.match(/https?:\/\/\S+#token=[a-f0-9]+/)[0]).hash.slice(7);
  const read = async (response, status, body) => {
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.deepEqual(await response.json(), body);
  };
  try {
    await createSignupOperation(database, auth)({ email, password, displayName: "Synthetic adult",
      dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    await t.test("only the six reviewed POST commands are exposed", async () => {
      for (const path of ["sign-up/email", "sign-in/email", "change-password", "get-session", "delete-user", "verify-email?token=private-sentinel"]) {
        await read(await request(path), 404, { code: "NOT_FOUND" });
      }
      await read(await handler(new Request(`${origin}/api/auth/verify-email`)), 404, { code: "NOT_FOUND" });
      await read(await request("verify-email", { token: "a".repeat(64) }, { origin: "https://hostile.example.invalid" }), 403, { code: "FORBIDDEN" });
      await read(await request("change-email", { proposedEmail: "new@example.invalid" }), 401, { code: "UNAUTHORIZED" });
    });
    await t.test("verification consumes once and clears cookies only after commit", async () => {
      assert.equal((await dispatcher.dispatchOne()).status, "ACCEPTED");
      const proof = token();
      const response = await request("verify-email", { token: proof });
      assert.ok(response.headers.getSetCookie().some((cookie) => cookie.includes("Max-Age=0")));
      await read(response, 200, { status: "EMAIL_VERIFIED" });
      await read(await request("verify-email", { token: proof }), 400, { code: "INVALID_INPUT" });
    });
    await t.test("reset request is generic, replacement invalidates old proof, password reset revokes all sessions", async () => {
      for (const requested of [email, "absent@example.invalid"]) {
        await read(await request("request-password-reset", { email: requested }), 200, { status: "REQUEST_RECEIVED" });
      }
      assert.equal((await dispatcher.dispatchOne()).status, "ACCEPTED");
      const oldToken = token();
      await read(await request("request-password-reset", { email }), 200, { status: "REQUEST_RECEIVED" });
      await read(await request("reset-password", { token: oldToken, newPassword: password }), 400, { code: "INVALID_INPUT" });
      assert.equal((await dispatcher.dispatchOne()).status, "ACCEPTED");
      const latestToken = token();
      await auth.api.signInEmail({ body: { email, password } });
      const response = await request("reset-password", { token: latestToken, newPassword: password });
      assert.ok(response.headers.getSetCookie().some((cookie) => cookie.includes("Max-Age=0")));
      await read(response, 200, { status: "PASSWORD_RESET" });
      assert.equal(await database.session.count(), 0);
      await read(await request("reset-password", { token: latestToken, newPassword: password }), 400, { code: "INVALID_INPUT" });
    });
    await t.test("fresh-session email request and single-use proof switch both stores and queue old-address notice", async () => {
      const session = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
      const cookie = session.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
      const proposedEmail = `proposed-${randomUUID()}@example.invalid`;
      await read(await request("change-email", { proposedEmail }, { cookie }), 200, { status: "REQUEST_RECEIVED" });
      assert.equal((await dispatcher.dispatchOne()).status, "ACCEPTED");
      assert.equal(messages.at(-1).to, proposedEmail);
      const proof = token();
      await read(await request("confirm-email-change", { token: proof }), 200, { status: "EMAIL_CHANGED" });
      assert.equal(await database.session.count(), 0);
      await read(await request("confirm-email-change", { token: proof }), 400, { code: "INVALID_INPUT" });
      assert.equal((await dispatcher.dispatchOne()).status, "ACCEPTED");
      assert.equal(messages.at(-1).to, email);
      assert.ok(!messages.at(-1).text.includes(proposedEmail));
    });
    await t.test("resend stays generic and handler limits cannot be bypassed", async () => {
      const absent = "absent-resend@example.invalid";
      for (const requested of [email, absent]) {
        await read(await request("send-verification-email", { email: requested }), 200, { status: "REQUEST_RECEIVED" });
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        await read(await request("send-verification-email", { email: absent }, { "x-synthetic-ip": "198.51.100.10" }), 200, { status: "REQUEST_RECEIVED" });
      }
      await read(await request("send-verification-email", { email: absent }, { "x-synthetic-ip": "198.51.100.10" }), 429, { code: "RATE_LIMITED" });
    });
  } finally {
    if (savedOrigin === undefined) delete process.env.HALAGA_PUBLIC_ORIGIN;
    else process.env.HALAGA_PUBLIC_ORIGIN = savedOrigin;
    await sandbox.close();
  }
});
