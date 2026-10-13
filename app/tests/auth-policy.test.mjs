import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthPolicy } from "../src/server/auth-policy.ts";

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
