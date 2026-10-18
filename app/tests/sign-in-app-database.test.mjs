import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { registerHooks } from "node:module";
import test from "node:test";
import next from "next";

// This harness runs Next in its normal React environment. Only trusted fixture
// imports need the server-only marker bypass; application bundles retain it.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { openSignupSandbox } = await import("./helpers/signup-sandbox.mjs");
const { createAccountFlowOperations } = await import("../src/server/repositories/account-flows.ts");

test("actual Next sign-in route uses only a disposable synthetic schema", { timeout: 180000 }, async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth } = sandbox;
  const origin = "http://127.0.0.1:3102";
  const email = "local-sign-in@example.invalid";
  const password = "synthetic-local-sign-in-password";
  const environment = { ...process.env };
  let app;
  let server;
  try {
    process.env.NODE_ENV = "development";
    process.env.BETTER_AUTH_URL = origin;
    process.env.BETTER_AUTH_SECRET = "synthetic-signup-secret-for-local-tests-only";
    process.env.ACCOUNT_EMAIL_SENDING_ENABLED = "false";
    delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
    process.env.AUTH_TRUSTED_IP_HEADER = "x-synthetic-ip";
    // Existing Next development reuse seam; no application test endpoint or
    // production schema override. Every route adapter uses this sandbox client.
    globalThis.halagaPrisma = database;
    const operations = createAccountFlowOperations(database, auth);
    await operations.signup({ email, password, displayName: "Synthetic local adult",
      dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    app = next({ dev: true, hostname: "127.0.0.1", port: 3102 });
    await app.prepare();
    server = createServer(app.getRequestHandler());
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(3102, "127.0.0.1", resolve); });
    let sequence = 0;
    // Unlike fetch, http.request preserves supplied Fetch Metadata headers.
    const send = (path, body = {}, headers = {}) => new Promise((resolve, reject) => {
      const outgoing = request(`${origin}/api/auth/${path}`, {
        method: "POST", headers: { origin, "content-type": "application/json", "x-synthetic-ip": `192.0.2.${++sequence}`, ...headers },
      }, (incoming) => {
        const chunks = [];
        incoming.on("data", (chunk) => chunks.push(chunk));
        incoming.on("end", () => {
          const responseHeaders = new Headers();
          for (let i = 0; i < incoming.rawHeaders.length; i += 2) responseHeaders.append(incoming.rawHeaders[i], incoming.rawHeaders[i + 1]);
          resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode, headers: responseHeaders }));
        });
        incoming.on("error", reject);
      });
      outgoing.on("error", reject);
      outgoing.end(JSON.stringify(body));
    });
    const read = async (response, status, body) => {
      assert.equal(response.status, status);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("location"), null);
      assert.deepEqual(await response.json(), body);
      if (status !== 200) assert.deepEqual(response.headers.getSetCookie(), []);
    };

    await t.test("sign-in page has enabled labeled password-manager controls and private response headers", async () => {
      const response = await fetch(`${origin}/account/sign-in`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.match(html, /autoComplete="username"/);
      assert.match(html, /autoComplete="current-password"/);
      assert.doesNotMatch(html, /This action is not available yet/);
      for (const path of ["register", "change-password"]) {
        const preview = await (await fetch(`${origin}/account/${path}`)).text();
        assert.match(preview, /This action is not available yet/);
        assert.match(preview, /<button[^>]*disabled/);
      }
    });
    await t.test("signup, password change and unrelated library routes remain closed", async () => {
      for (const path of ["sign-up/email", "change-password", "get-session", "sign-out", "delete-user", "sign-in/social", "sign-in/email/", "sign-in%2Femail"]) {
        const response = await send(path);
        // Next may normalize a trailing slash with 308; it never performs a command.
        if (path.endsWith("/")) assert.ok([308, 404].includes(response.status));
        else await read(response, 404, { code: "NOT_FOUND" });
      }
      assert.equal((await fetch(`${origin}/api/auth/sign-in/email`)).status, 405);
      assert.equal(await database.session.count(), 0);
    });
    await t.test("the six email commands still reach their protected handlers", async () => {
      for (const path of ["send-verification-email", "request-password-reset", "verify-email", "reset-password", "change-email", "confirm-email-change"]) {
        await read(await send(path), path === "change-email" ? 401 : 400,
          { code: path === "change-email" ? "UNAUTHORIZED" : "INVALID_INPUT" });
      }
    });
    await t.test("configured-origin and first-login CSRF rejection survive actual route dispatch", async () => {
      await read(await send("sign-in/email", { email, password }, { origin: "https://hostile.example.invalid" }), 403, { code: "FORBIDDEN" });
      await read(await send("sign-in/email", { email, password }, { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }), 403, { code: "FORBIDDEN" });
      await read(await send("sign-in/email?callbackURL=/", { email, password }), 404, { code: "NOT_FOUND" });
      assert.equal(await database.session.count(), 0);
    });
    await t.test("unverified synthetic adult signs in with fixed JSON and a stored session cookie", async () => {
      const response = await send("sign-in/email", { email, password });
      const values = response.headers.getSetCookie();
      await read(response, 200, { status: "SIGNED_IN" });
      assert.equal(values.length, 1);
      assert.match(values[0], /^better-auth\.session_token=.*; Path=\/.*; HttpOnly.*; SameSite=Lax/i);
      assert.doesNotMatch(values[0], /; Domain=/i);
      const headers = new Headers({ cookie: values[0].split(";")[0] });
      const session = await auth.api.getSession({ headers });
      assert.equal(session.user.emailVerified, false);
      assert.equal(await database.session.count(), 1);
      const { emailVerifiedAt } = await database.userAccount.findUnique({ where: { authUserId: session.user.id }, select: { emailVerifiedAt: true } });
      assert.equal(emailVerifiedAt, null);
    });
  } finally {
    delete globalThis.halagaPrisma;
    for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
    Object.assign(process.env, environment);
    await sandbox.close();
    if (server) { server.close(); server.closeAllConnections(); }
    await app?.close();
  }
});
