import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { createAuthPolicy } from "../src/server/auth-policy.ts";
import { accountEmailPaths, createAccountFlowHandler, createAccountFlowPlugin } from "../src/server/account-flow-plugin.ts";
import { createAccountFlowOperations } from "../src/server/repositories/account-flows.ts";
import { createAccountEmailHandler } from "../src/server/repositories/account-email-http.ts";
import { createAccountSignInHandler } from "../src/server/repositories/sign-in-http.ts";
import { createAccountPasswordChangeHandler } from "../src/server/repositories/password-change-http.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

const origin = "http://127.0.0.1:3000";
const password = "synthetic-http-sign-in-password";
const replacement = "synthetic-http-sign-in-replacement";
const secret = "synthetic-signup-secret-for-local-tests-only";
const cookies = (response) => new Headers({ cookie: response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });

function gate() {
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const deadline = setTimeout(10000, undefined, { ref: false }).then(() => { throw new Error("Synthetic gate was not reached"); });
  return { entered: Promise.race([entered.promise, deadline]), release: release.resolve,
    async pause(value) { entered.resolve(value); await release.promise; } };
}

// Real account transaction and database locks; pause only immediately before commit.
function beforeCommit(database, paused) {
  return new Proxy(database, { get(target, key) {
    if (key !== "$transaction") return Reflect.get(target, key);
    return (work) => target.$transaction(async (transaction) => {
      const result = await work(transaction);
      const [{ pid }] = await transaction.$queryRaw`SELECT pg_backend_pid() AS pid`;
      await paused.pause(pid);
      return result;
    });
  } });
}

async function read(response, status, body) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("location"), null);
  assert.deepEqual(await response.json(), body);
  if (status !== 200) assert.deepEqual(response.headers.getSetCookie(), []);
  return response;
}

test("protected sign-in HTTP integration with disposable synthetic PostgreSQL", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  const operations = createAccountFlowOperations(database, auth);
  const configuration = (url = origin, production = false) => ({
    ...createAuthPolicy({ NODE_ENV: production ? "production" : "test", BETTER_AUTH_URL: url,
      BETTER_AUTH_SECRET: secret, AUTH_TRUSTED_IP_HEADER: "x-synthetic-ip" }),
    database: prismaAdapter(database, { provider: "postgresql", transaction: true }),
  });
  const handler = createAccountSignInHandler(database, auth, configuration());
  const second = createAccountSignInHandler(database, auth, configuration());
  let sequence = 0;
  const request = (body, { path = "/sign-in/email", headers = {}, method = "POST", url = origin } = {}) => {
    const requestHeaders = new Headers({ origin, "content-type": "application/json", "x-synthetic-ip": `192.0.2.${++sequence}`, ...headers });
    if (headers.origin === null) requestHeaders.delete("origin");
    return new Request(`${url}/api/auth${path}`, { method, headers: requestHeaders,
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
  };
  const send = (account, options, target = handler) => target(request({ email: account.email, password, ...account.input }, options));
  const fixture = async (verified = false) => {
    const email = `http-sign-in-${++sequence}@example.invalid`;
    await operations.signup({ email, password, displayName: "Synthetic private display name",
      dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    if (verified) await operations.verification.consume((await operations.verification.issue(email)).token);
    const { id: userId } = await database.user.findUnique({ where: { email }, select: { id: true } });
    return { email, userId };
  };
  const waitForBlock = async (blocker) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      await connection.query("SELECT pg_stat_clear_snapshot()");
      const result = await connection.query(`SELECT pid FROM pg_stat_activity WHERE datname = current_database()
        AND wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))`, [blocker]);
      if (result.rowCount) return;
      await setTimeout(10);
    }
    assert.fail("Expected PostgreSQL lock wait against the exact blocking backend");
  };
  const assertSessionCookie = (response, secure = false, remembered = true) => {
    const values = response.headers.getSetCookie();
    assert.equal(values.length, 1, "Only the required session cookie leaves the handler");
    assert.match(values[0], secure ? /^__Secure-better-auth\.session_token=/ : /^better-auth\.session_token=/);
    assert.match(values[0], /; Path=\//i);
    assert.match(values[0], /; HttpOnly/i);
    assert.match(values[0], /; SameSite=Lax/i);
    assert.doesNotMatch(values[0], /; Domain=/i);
    assert.equal(/; Secure/i.test(values[0]), secure);
    if (remembered) assert.match(values[0], /; Max-Age=604800/i);
    else assert.doesNotMatch(values[0], /; (Max-Age|Expires)=/i);
  };
  const messages = [];
  const originals = [console.error, console.warn, console.log];
  console.error = console.warn = console.log = (...args) => messages.push(args);
  try {
    for (const verified of [false, true]) await t.test(`${verified ? "verified" : "unverified"} sign-in returns fixed success and a usable host-only session cookie`, async () => {
      const account = await fixture(verified);
      const response = await read(await send({ ...account, email: account.email.toUpperCase() }), 200, { status: "SIGNED_IN" });
      assertSessionCookie(response);
      const session = await auth.api.getSession({ headers: cookies(response) });
      assert.equal(session.user.id, account.userId);
      assert.equal(session.user.emailVerified, verified);
      assert.equal(await database.session.count({ where: { userId: account.userId } }), 1);
      const domain = await database.userAccount.findUnique({ where: { authUserId: account.userId }, select: { emailVerifiedAt: true } });
      assert.equal(Boolean(domain.emailVerifiedAt), verified);
    });

    await t.test("rememberMe false emits only a browser-session cookie; HTTPS uses Secure host-only cookies", async () => {
      const account = await fixture();
      const response = await read(await send({ ...account, input: { rememberMe: false } }), 200, { status: "SIGNED_IN" });
      assertSessionCookie(response, false, false);
      assert.ok(await auth.api.getSession({ headers: cookies(response) }));
      const url = "https://app.example.invalid";
      const config = configuration(url, true);
      const secureAuth = betterAuth({ ...config, emailAndPassword: { enabled: true, requireEmailVerification: false } });
      const secureHandler = createAccountSignInHandler(database, secureAuth, config);
      const secureResponse = await read(await send(account, { url, headers: { origin: url } }, secureHandler), 200, { status: "SIGNED_IN" });
      assertSessionCookie(secureResponse, true);
      assert.ok(await secureAuth.api.getSession({ headers: cookies(secureResponse) }));
    });

    await t.test("invalid credentials and malformed/extra input return safe failures without cookies or sessions", async () => {
      const account = await fixture();
      for (const input of [{ email: account.email, password: "wrong-synthetic-password" },
        { email: "absent@example.invalid", password }]) {
        await read(await handler(request(input)), 401, { code: "UNAUTHORIZED" });
      }
      for (const input of [{ email: account.email }, { email: "bad-email", password },
        { email: account.email, password, callbackURL: "/" }, { email: account.email, password, accountId: "private-sentinel" },
        { email: account.email, password, rememberMe: "false" }]) {
        await read(await handler(request(input)), 400, { code: "INVALID_INPUT" });
      }
      // The operation intentionally minimizes non-credential library errors.
      await read(await send({ ...account, input: { password: "x".repeat(129) } }), 500, { code: "INTERNAL_ERROR" });
      await read(await handler(new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST", headers: { origin, "content-type": "application/json", "x-synthetic-ip": "198.51.100.99" },
        body: '{"private-sentinel":',
      })), 400, { code: "INVALID_INPUT" });
      assert.equal(await database.session.count({ where: { userId: account.userId } }), 0);
    });

    await t.test("five attempts per minute share atomic PostgreSQL counters across handler instances", async () => {
      const account = await fixture();
      const ip = "198.51.100.20";
      const attempts = await Promise.all(Array.from({ length: 12 }, (_, index) =>
        send({ ...account, input: { password: "wrong-synthetic-password" } }, { headers: { "x-synthetic-ip": ip } }, index % 2 ? second : handler)));
      assert.equal(attempts.filter((response) => response.status === 401).length, 5);
      assert.equal(attempts.filter((response) => response.status === 429).length, 7);
      for (const response of attempts) {
        if (response.status === 429) assert.ok(Number(response.headers.get("x-retry-after")) > 0);
        await read(response, response.status, { code: response.status === 429 ? "RATE_LIMITED" : "UNAUTHORIZED" });
      }
      const row = await database.rateLimit.findFirst({ where: { key: { contains: ip } } });
      assert.equal(row.count, 5);
      await read(await send(account, { headers: { "x-synthetic-ip": ip } }, second), 429, { code: "RATE_LIMITED" });
      assert.deepEqual(await database.rateLimit.findUnique({ where: { id: row.id } }), row, "Denial does not extend inactivity");
      await read(await send(account), 200, { status: "SIGNED_IN" });
      await database.rateLimit.update({ where: { id: row.id }, data: { lastRequest: BigInt(Date.now() - 61000) } });
      await read(await send(account, { headers: { "x-synthetic-ip": ip } }, second), 200, { status: "SIGNED_IN" });
      assert.equal((await database.rateLimit.findUnique({ where: { id: row.id } })).count, 1);
    });

    await t.test("configured origin and installed first-login CSRF middleware reject unsafe requests", async () => {
      const account = await fixture();
      for (const cookie of [undefined, "better-auth.session_token=private-sentinel"]) {
        for (const value of [null, "null", "https://hostile.example.invalid", "http://127.0.0.1:3001"]) {
          await read(await send(account, { headers: { origin: value, ...(cookie ? { cookie } : {}),
            "x-forwarded-host": "hostile.example.invalid", "x-forwarded-proto": "https" } }), 403, { code: "FORBIDDEN" });
        }
      }
      // A matching Origin alone would pass our admission hook. The installed
      // endpoint-specific middleware must still reject cross-site navigation login.
      await read(await send(account, { headers: { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" } }), 403, { code: "FORBIDDEN" });
      assert.equal(await database.session.count({ where: { userId: account.userId } }), 0);
    });

    await t.test("alternate paths/methods/query input and direct API calls cannot reach sign-in", async () => {
      const account = await fixture();
      for (const path of ["/sign-up/email", "/change-password", "/get-session", "/sign-in/social", "/send-verification-email",
        "/sign-in/email?password=private-sentinel", "/sign-in/email/", "/sign-in%2Femail"]) {
        await read(await send(account, { path }), 404, { code: "NOT_FOUND" });
      }
      for (const method of ["GET", "PUT", "DELETE"]) await read(await send(account, { method }), 404, { code: "NOT_FOUND" });
      const protectedAuth = betterAuth({ ...configuration(), emailAndPassword: { enabled: true },
        plugins: [createAccountFlowPlugin(() => operations, ["/sign-in/email"])] });
      for (const supplied of [undefined, request({ email: account.email, password })]) {
        const response = await protectedAuth.api.signInEmail({ body: { email: account.email, password },
          headers: new Headers({ origin }), ...(supplied ? { request: supplied } : {}), asResponse: true });
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), { code: "FORBIDDEN" });
        assert.deepEqual(response.headers.getSetCookie(), []);
      }
      assert.equal(await database.session.count({ where: { userId: account.userId } }), 0);
    });

    await t.test("session insertion and deferred commit failures roll back, emit no cookies, and allow retry", async () => {
      const account = await fixture();
      await connection.query(`CREATE FUNCTION synthetic_http_sign_in_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'private-http-password-token-email-cookie'; END $$`);
      for (const deferred of [false, true]) {
        const before = await database.session.count({ where: { userId: account.userId } });
        await connection.query(`CREATE ${deferred ? "CONSTRAINT " : ""}TRIGGER synthetic_http_failure
          ${deferred ? "AFTER" : "BEFORE"} INSERT ON "session" ${deferred ? "DEFERRABLE INITIALLY DEFERRED" : ""}
          FOR EACH ROW EXECUTE FUNCTION synthetic_http_sign_in_failure()`);
        try { await read(await send(account), 500, { code: "INTERNAL_ERROR" }); }
        finally { await connection.query('DROP TRIGGER synthetic_http_failure ON "session"'); }
        assert.equal(await database.session.count({ where: { userId: account.userId } }), before);
        const retried = await read(await send(account), 200, { status: "SIGNED_IN" });
        assertSessionCookie(retried);
        assert.ok(await auth.api.getSession({ headers: cookies(retried) }));
        assert.equal(await database.session.count({ where: { userId: account.userId } }), before + 1);
      }
    });

    for (const kind of ["password-change", "reset", "verification", "email-proof"]) {
      const mutation = async (account, headers) => {
        if (kind === "password-change") return { run: async (db) => {
          const handler = createAccountPasswordChangeHandler(db, auth, configuration());
          const response = await handler(request({ currentPassword: password, newPassword: replacement },
            { path: "/change-password", headers: { cookie: headers.get("cookie") } }));
          assert.deepEqual(response.headers.getSetCookie(), []);
          await read(response, 200, { status: "PASSWORD_CHANGED" });
        } };
        if (kind === "reset") {
          const { token } = await operations.reset.issue(account.email);
          return { run: (db) => createAccountFlowOperations(db, auth).reset.consume({ token, newPassword: replacement }) };
        }
        if (kind === "verification") {
          const { token } = await operations.verification.issue(account.email);
          return { run: (db) => createAccountFlowOperations(db, auth).verification.consume(token) };
        }
        const proposedEmail = `proved-${++sequence}@example.invalid`;
        const { token } = await operations.emailChange.issue(headers, { proposedEmail }, () => {});
        return { proposedEmail, run: (db) => createAccountFlowOperations(db, auth).emailChange.consume(token) };
      };

      await t.test(`${kind}: no HTTP success/cookie before sign-in commit; waiting writer revokes that session`, async () => {
        const account = await fixture(kind === "email-proof");
        const initiating = await send(account);
        const command = await mutation(account, cookies(initiating));
        const paused = gate();
        const gatedHandler = createAccountSignInHandler(beforeCommit(database, paused), auth, configuration());
        let returned = false;
        const pending = Promise.allSettled([send(account, undefined, gatedHandler).then((response) => { returned = true; return response; })]);
        let writer;
        try {
          const blocker = await paused.entered;
          writer = Promise.allSettled([command.run(database)]);
          await waitForBlock(blocker);
          assert.equal(returned, false);
          assert.equal(await database.session.count({ where: { userId: account.userId } }), 1, "Uncommitted session is invisible");
        } finally { paused.release(); }
        const [signedIn] = await pending;
        assert.equal(signedIn.status, "fulfilled");
        const response = await read(signedIn.value, 200, { status: "SIGNED_IN" });
        assertSessionCookie(response);
        assert.equal((await writer)[0].status, "fulfilled");
        assert.equal(await auth.api.getSession({ headers: cookies(response) }), null, "Delayed cookie cannot recreate a revoked session");
        assert.equal(await database.session.count({ where: { userId: account.userId } }), kind === "password-change" ? 1 : 0);
        if (kind === "verification" || kind === "email-proof") {
          assert.equal(await auth.api.getSession({ headers: cookies(initiating) }), null);
          const fresh = await send({ ...account, email: command.proposedEmail ?? account.email });
          await read(fresh, 200, { status: "SIGNED_IN" });
          assert.equal((await auth.api.getSession({ headers: cookies(fresh) })).user.emailVerified, true);
        }
      });

      await t.test(`${kind}: waiting HTTP sign-in rereads committed credentials/address/verification`, async () => {
        const account = await fixture(kind === "email-proof");
        const initiating = await send(account);
        const command = await mutation(account, cookies(initiating));
        const paused = gate();
        const writer = Promise.allSettled([command.run(beforeCommit(database, paused))]);
        let pending;
        let returned = false;
        try {
          const blocker = await paused.entered;
          pending = Promise.allSettled([send(account).then((response) => { returned = true; return response; })]);
          await waitForBlock(blocker);
          assert.equal(returned, false);
        } finally { paused.release(); }
        assert.equal((await writer)[0].status, "fulfilled");
        const [signedIn] = await pending;
        assert.equal(signedIn.status, "fulfilled");
        if (kind === "verification") {
          await read(signedIn.value, 200, { status: "SIGNED_IN" });
          assert.equal((await auth.api.getSession({ headers: cookies(signedIn.value) })).user.emailVerified, true);
        } else {
          await read(signedIn.value, 401, { code: "UNAUTHORIZED" });
          const fresh = await send({ ...account, email: command.proposedEmail ?? account.email,
            input: kind === "email-proof" ? {} : { password: replacement } });
          await read(fresh, 200, { status: "SIGNED_IN" });
          assert.ok(await auth.api.getSession({ headers: cookies(fresh) }));
        }
        assert.ok(await auth.api.getSession({ headers: cookies(initiating) }) === null || kind === "password-change");
      });
    }

    await t.test("application opts in only to protected sign-in; email-only and generic defaults still exclude it", async () => {
      assert.ok(!accountEmailPaths.includes("/sign-in/email"));
      const route = await readFile(new URL("../src/app/api/auth/[...all]/route.ts", import.meta.url), "utf8");
      assert.match(route, /pathname === "\/api\/auth\/sign-in\/email"/);
      assert.match(route, /handleAccountSignInRequest\(request\)/);
      assert.match(route, /handleAccountEmailRequest\(request\)/);
      assert.doesNotMatch(route, /createAccountSignInOperation|createAccountAuth|auth\.handler/);
      const emailHandler = createAccountEmailHandler(database, auth, configuration());
      const defaultHandler = createAccountFlowHandler(betterAuth({ ...configuration(),
        plugins: [createAccountFlowPlugin(() => operations)] }));
      for (const path of ["/sign-up/email", "/sign-in/email", "/change-password"]) {
        await read(await emailHandler(request({}, { path })), 404, { code: "NOT_FOUND" });
      }
      await read(await defaultHandler(request({})), 404, { code: "NOT_FOUND" });
      const screens = await readFile(new URL("../src/app/account/screens.tsx", import.meta.url), "utf8");
      assert.match(screens, /AccountPasswordChangeForm/);
      const page = await readFile(new URL("../src/app/account/[flow]/page.tsx", import.meta.url), "utf8");
      assert.match(page, /AccountScreen/);
      assert.doesNotMatch(page, /sign-in-http|SignInHandler/);
    });
  } finally {
    [console.error, console.warn, console.log] = originals;
    await sandbox.close();
  }
  assert.deepEqual(messages, [], "No request, credentials, cookies, account data or raw exceptions are logged");
});
