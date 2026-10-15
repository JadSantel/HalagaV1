import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthPolicy } from "../src/server/auth-policy.ts";
import { createAccountFlowHandler, createAccountFlowPlugin } from "../src/server/account-flow-plugin.ts";

const environment = {
  NODE_ENV: "development",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  BETTER_AUTH_SECRET: "synthetic-auth-policy-secret-for-tests-only",
};

function fixture(overrides = {}) {
  const database = { user: [], session: [], account: [], verification: [], rateLimit: [] };
  const policy = createAuthPolicy({ ...environment, ...overrides });
  const auth = betterAuth({
    ...policy,
    database: memoryAdapter(database),
    emailAndPassword: { enabled: true },
    // Enabled only in this synthetic fixture to exercise the freshness gate.
    user: { changeEmail: { enabled: true } },
  });
  return { auth, database, policy };
}

function request(auth, path, { cookie, body, origin = environment.BETTER_AUTH_URL } = {}) {
  return auth.handler(new Request(`${origin}/api/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: { origin, ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
}

test("configuration rejects unsafe origins, absent production proxy trust, and secret leaks", () => {
  for (const url of ["https://user:secret@example.test", "https://example.test/path", "https://example.test?token=secret", "ftp://example.test", "http://example.test"]) {
    assert.throws(() => createAuthPolicy({ ...environment, BETTER_AUTH_URL: url }), /BETTER_AUTH_URL/);
  }
  assert.throws(() => createAuthPolicy({ ...environment, NODE_ENV: "production" }), /BETTER_AUTH_URL.*AUTH_TRUSTED_IP_HEADER/);
  assert.throws(() => createAuthPolicy({ ...environment, NODE_ENV: "production", BETTER_AUTH_URL: "https://example.test" }), /AUTH_TRUSTED_IP_HEADER/);
  assert.throws(() => createAuthPolicy({ ...environment, BETTER_AUTH_TRUSTED_ORIGINS: "https://hostile.example.test" }), /BETTER_AUTH_TRUSTED_ORIGINS/);
  assert.throws(() => createAuthPolicy({ ...environment, BETTER_AUTH_SECRET: "private-secret-sentinel" }), (error) =>
    error.message.includes("BETTER_AUTH_SECRET") && !error.message.includes("private-secret-sentinel"));
  assert.throws(() => createAuthPolicy({ ...environment, BETTER_AUTH_URL: "private-invalid-origin-sentinel" }), (error) =>
    error.message.includes("BETTER_AUTH_URL") && !error.message.includes("private-invalid-origin-sentinel"));
});

test("session cookies are host-only, secure on HTTPS, and usable on local HTTP", async () => {
  for (const overrides of [{}, {
    NODE_ENV: "production", BETTER_AUTH_URL: "https://app.example.test", AUTH_TRUSTED_IP_HEADER: "x-reviewed-client-ip",
  }]) {
    const { auth, policy } = fixture(overrides);
    const context = await auth.$context;
    const attributes = context.authCookies.sessionToken.attributes;
    assert.equal(attributes.domain, undefined);
    assert.equal(attributes.httpOnly, true);
    assert.equal(attributes.sameSite, "lax");
    assert.equal(attributes.secure, overrides.NODE_ENV === "production");
    assert.equal(attributes.maxAge, 604800);
    assert.deepEqual(policy.trustedOrigins, [overrides.BETTER_AUTH_URL ?? environment.BETTER_AUTH_URL]);
    assert.equal(policy.rateLimit.storage, overrides.NODE_ENV === "production" ? "database" : "memory");
    assert.deepEqual(policy.advanced.ipAddress.ipAddressHeaders, overrides.AUTH_TRUSTED_IP_HEADER ? [overrides.AUTH_TRUSTED_IP_HEADER] : []);
    const signup = await auth.api.signUpEmail({
      body: { name: "Synthetic Cookie", email: "cookie@example.test", password: "synthetic-password-for-tests" },
      asResponse: true,
    });
    assert.equal(signup.status, 200);
    const sessionCookie = signup.headers.getSetCookie().find((value) => value.includes("session_token="));
    assert.ok(sessionCookie);
    assert.equal(/;\s*Domain=/i.test(sessionCookie), false);
    assert.equal(/;\s*Secure(?:;|$)/i.test(sessionCookie), overrides.NODE_ENV === "production");
    const hostile = await auth.handler(new Request(`${policy.baseURL}/api/auth/sign-out`, {
      method: "POST", headers: { origin: "https://hostile.example.test", cookie: sessionCookie.split(";")[0], "content-type": "application/json" }, body: "{}",
    }));
    assert.equal(hostile.status, 403, "A different origin cannot initiate account actions");
  }
});

test("library sessions roll daily; old sessions cannot change email or password", async (t) => {
  const { auth, database } = fixture();
  const signup = await auth.api.signUpEmail({
    body: { name: "Synthetic Person", email: "synthetic@example.test", password: "synthetic-password-for-tests" },
    asResponse: true,
  });
  assert.equal(signup.status, 200);
  const cookie = signup.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  assert.ok(cookie.includes("session_token="));
  assert.ok(signup.headers.getSetCookie().some((value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)));
  const initial = database.session[0];
  const createdAt = new Date(initial.createdAt).getTime();
  const originalExpiry = new Date(initial.expiresAt).getTime();
  assert.ok(Math.abs(originalExpiry - createdAt - 604800000) < 1000);

  // Fresh sessions reach the existing endpoint implementation, not the freshness rejection.
  for (const [path, body] of [
    ["/change-password", { currentPassword: "wrong-synthetic-password", newPassword: "another-synthetic-password" }],
    ["/change-email", { newEmail: "other@example.test" }],
  ]) {
    const response = await request(auth, path, { cookie, body });
    assert.notEqual((await response.json()).code, "SESSION_NOT_FRESH");
  }
  const now = createdAt + 900000;
  t.mock.method(Date, "now", () => now);
  for (const [path, body] of [
    ["/change-password", { currentPassword: "synthetic-password-for-tests", newPassword: "another-synthetic-password" }],
    ["/change-email", { newEmail: "other@example.test" }],
  ]) {
    const response = await request(auth, path, { cookie, body });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "SESSION_NOT_FRESH");
  }
  t.mock.restoreAll();
  t.mock.method(Date, "now", () => originalExpiry - 604800000 + 86399000);
  let response = await request(auth, "/get-session", { cookie });
  assert.equal(response.status, 200);
  assert.equal(new Date((await response.json()).session.expiresAt).getTime(), originalExpiry);
  t.mock.restoreAll();
  const refreshAt = originalExpiry - 604800000 + 86400000;
  t.mock.method(Date, "now", () => refreshAt);
  response = await request(auth, "/get-session", { cookie });
  assert.equal(response.status, 200);
  const refreshed = (await response.json()).session;
  assert.equal(new Date(refreshed.expiresAt).getTime(), refreshAt + 604800000);
  assert.equal(new Date(refreshed.createdAt).getTime(), createdAt);
  assert.ok(response.headers.getSetCookie().some((value) => value.includes("session_token=")));
  response = await request(auth, "/change-password", {
    cookie, body: { currentPassword: "synthetic-password-for-tests", newPassword: "another-synthetic-password" },
  });
  assert.equal(response.status, 403, "Rolling refresh must not count as recent sign-in");

  database.session.length = 0;
  response = await request(auth, "/change-password", {
    cookie, body: { currentPassword: "synthetic-password-for-tests", newPassword: "another-synthetic-password" },
  });
  assert.equal(response.status, 401, "Revoked sessions must not survive in a cookie cache");
});

test("client requests hit explicit endpoint limits and recover after inactivity", async (t) => {
  const { auth, policy } = fixture();
  for (const [path, rule] of Object.entries(policy.rateLimit.customRules)) {
    const endpoint = path === "*" ? "/sign-out" : path;
    for (let index = 0; index < rule.max; index++) {
      assert.notEqual((await request(auth, endpoint, { body: {} })).status, 429, `${path}: permitted request ${index + 1}`);
    }
    const blocked = await request(auth, endpoint, { body: {} });
    assert.equal(blocked.status, 429, path);
    assert.ok(Number(blocked.headers.get("x-retry-after")) > 0);
  }
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 901000);
  assert.notEqual((await request(auth, "/sign-up/email", { body: {} })).status, 429);
});

test("account plugin uses the real handler limiter, safe projections and request boundary", async (t) => {
  let calls = 0;
  let issued = true;
  const operations = {
    signup: async () => { calls++; return { private: "private-sentinel" }; },
    verification: { issue: async () => { calls++; return issued ? { token: "private-sentinel", expiresAt: new Date() } : null; },
      consume: async () => { calls++; } },
    reset: { issue: async () => { calls++; return issued ? { token: "private-sentinel" } : null; }, consume: async () => { calls++; } },
    emailChange: { issue: async () => { calls++; return { token: "private-sentinel" }; }, consume: async () => { calls++; } },
    passwordChange: async () => { calls++; },
  };
  const policy = createAuthPolicy({ ...environment, AUTH_TRUSTED_IP_HEADER: "x-synthetic-client-ip" });
  const auth = betterAuth({ ...policy,
    database: memoryAdapter({ user: [], session: [], account: [], verification: [], rateLimit: [] }),
    emailAndPassword: { enabled: true }, plugins: [createAccountFlowPlugin(() => operations)],
  });
  let ipIndex = 1;
  const handler = createAccountFlowHandler(auth);
  const send = (path, body = {}, extra = {}) => handler(new Request(`${environment.BETTER_AUTH_URL}/api/auth${path}`, {
    method: "POST", headers: { origin: environment.BETTER_AUTH_URL, "content-type": "application/json",
      "x-synthetic-client-ip": `198.51.100.${ipIndex}`, ...extra }, body: JSON.stringify(body),
  }));

  await t.test("all three request confirmations match for eligible/ineligible requests and discard restricted results", async () => {
    for (const path of ["/sign-up/email", "/send-verification-email", "/request-password-reset"]) {
      ipIndex++;
      const body = path === "/sign-up/email" ? {} : { email: "synthetic@example.invalid" };
      issued = true;
      const first = await send(path, body);
      issued = false;
      const second = await send(path, body);
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.deepEqual(await first.json(), { status: "REQUEST_RECEIVED" });
      assert.deepEqual(await second.json(), { status: "REQUEST_RECEIVED" });
      assert.deepEqual(first.headers.getSetCookie(), []);
      assert.equal(first.headers.get("cache-control"), "no-store");
    }
  });

  await t.test("each explicit endpoint limit reaches the installed plugin and recovers after inactivity", async () => {
    for (const path of ["/sign-up/email", "/send-verification-email", "/request-password-reset"]) {
      ipIndex++;
      const before = calls;
      const body = path === "/sign-up/email" ? {} : { email: "synthetic@example.invalid" };
      const responses = await Promise.all(Array.from({ length: 9 }, () => send(path, body)));
      assert.equal(responses.filter((response) => response.status === 200).length, 3);
      assert.equal(calls - before, 3);
      for (const response of responses.filter((response) => response.status === 429)) {
        assert.deepEqual(await response.json(), { code: "RATE_LIMITED" });
        assert.ok(Number(response.headers.get("x-retry-after")) > 0);
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
      const now = Date.now();
      t.mock.method(Date, "now", () => now + 900000);
      assert.equal((await send(path, body)).status, 200);
      t.mock.restoreAll();
    }
    ipIndex++;
    const body = { token: "a".repeat(64) };
    const responses = await Promise.all(Array.from({ length: 65 }, () => send("/verify-email", body)));
    assert.equal(responses.filter((response) => response.status === 200).length, 60);
    assert.equal(responses.filter((response) => response.status === 429).length, 5);
  });

  await t.test("direct API, foreign/missing/null origins, query tokens and library alternate endpoints cannot run operations", async () => {
    ipIndex++;
    const before = calls;
    const direct = await auth.api.signUpEmail({ body: {}, headers: new Headers({ origin: environment.BETTER_AUTH_URL }), asResponse: true });
    assert.equal(direct.status, 403);
    const fabricatedRequest = new Request(`${environment.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
      method: "POST", headers: { origin: environment.BETTER_AUTH_URL, "content-type": "application/json" }, body: "{}",
    });
    const suppliedRequest = await auth.api.signUpEmail({ body: {}, headers: fabricatedRequest.headers, request: fabricatedRequest, asResponse: true });
    assert.equal(suppliedRequest.status, 403, "Supplying a Request cannot bypass handler admission/limiting");
    for (const origin of ["https://hostile.example.invalid", "", "null"]) {
      for (const cookie of ["", "synthetic-cookie=private-sentinel"]) {
        ipIndex++;
        assert.equal((await send("/sign-up/email", {}, { origin, cookie })).status, 403);
      }
    }
    for (const path of ["/get-session", "/sign-in/email", "/set-password", "/update-user", "/verify-email?token=private-sentinel", "/reset-password/private-sentinel"]) {
      assert.equal((await send(path)).status, 404);
    }
    const get = await handler(new Request(`${environment.BETTER_AUTH_URL}/api/auth/verify-email?token=private-sentinel`));
    assert.equal(get.status, 404);
    assert.equal(calls, before);
  });

  await t.test("unsafe parsing, unexpected errors and invalid ownership selectors never escape", async () => {
    ipIndex++;
    const invalid = await send("/request-password-reset", { email: "private-sentinel", accountId: "private-sentinel" });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { code: "INVALID_INPUT" });
    const previous = operations.signup;
    operations.signup = async () => { throw new Error("private-sentinel"); };
    const failed = await send("/sign-up/email");
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { code: "INTERNAL_ERROR" });
    assert.deepEqual(failed.headers.getSetCookie(), []);
    operations.signup = previous;
    const malformed = await handler(new Request(`${environment.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
      method: "POST", headers: { origin: environment.BETTER_AUTH_URL, "content-type": "application/json",
        "x-synthetic-client-ip": "198.51.100.250" }, body: '{"private-sentinel":',
    }));
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { code: "INVALID_INPUT" });
    const outsideFailure = await createAccountFlowHandler({ handler: async () => { throw new Error("private-sentinel"); } })(
      new Request(`${environment.BETTER_AUTH_URL}/api/auth/sign-up/email`));
    assert.equal(outsideFailure.status, 500);
    assert.deepEqual(await outsideFailure.json(), { code: "INTERNAL_ERROR" });
  });
});
