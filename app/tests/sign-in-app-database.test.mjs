import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const { createAccountEmailDispatcher } = await import("../src/server/repositories/account-email-dispatch.ts");

test("actual Next account routes use only a disposable synthetic schema", { timeout: 360000 }, async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth } = sandbox;
  const origin = "http://127.0.0.1:3102";
  const email = "local-sign-in@example.invalid";
  const password = "synthetic-local-sign-in-password";
  const signup = { email, password, displayName: "Synthetic local adult", dateOfBirth: "2000-01-01", adultAttestationAccepted: true };
  const counts = () => Promise.all([database.user.count(), database.account.count(), database.userAccount.count(),
    database.verification.count(), database.outboxEvent.count(), database.accountEmailDelivery.count(), database.session.count()]);
  const environment = { ...process.env };
  let app;
  let server;
  try {
    process.env.NODE_ENV = "development";
    process.env.BETTER_AUTH_URL = origin;
    process.env.BETTER_AUTH_SECRET = "synthetic-signup-secret-for-local-tests-only";
    process.env.ACCOUNT_EMAIL_SENDING_ENABLED = "false";
    process.env.HALAGA_PUBLIC_ORIGIN = origin;
    process.env.HALAGA_ACCOUNT_INTEGRATION_TEST = "true";
    delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
    process.env.AUTH_TRUSTED_IP_HEADER = "x-synthetic-ip";
    // Existing Next development reuse seam; no application test endpoint or
    // production schema override. Every route adapter uses this sandbox client.
    globalThis.halagaPrisma = database;
    app = next({ dev: true, hostname: "127.0.0.1", port: 3102 });
    await app.prepare();
    server = createServer(app.getRequestHandler());
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(3102, "127.0.0.1", resolve); });
    let sequence = 0;
    let draftCookie, draftId;
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
      const change = await (await fetch(`${origin}/account/change-password`)).text();
      assert.doesNotMatch(change, /This action is not available yet/);
      assert.match(change, /autoComplete="current-password"/);
      assert.match(change, /autoComplete="new-password"/);
    });
    await t.test("signup page has enabled labels, private hints and the exact unchecked adult attestation", async () => {
      const response = await fetch(`${origin}/account/register`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      for (const name of ["displayName", "email", "password", "dateOfBirth", "adultAttestationAccepted"]) {
        assert.match(html, new RegExp(`<label[^>]*for="${name}"`));
        const input = html.match(new RegExp(`<input[^>]*id="${name}"[^>]*>`))?.[0];
        assert.ok(input, name);
        assert.doesNotMatch(input, /disabled|checked/);
        assert.match(input, /required/);
      }
      for (const value of ["nickname", "email", "new-password", "bday"]) assert.ok(html.includes(`autoComplete="${value}"`));
      assert.match(html, /I confirm that I am at least 18 years old and eligible to participate in Halaga\./);
      assert.match(html, /Use made-up information only/);
      assert.match(html, /Terms and privacy documents are review drafts; approval and launch readiness remain incomplete/);
      for (const path of ["terms", "privacy"]) assert.ok(html.includes(`href="/account/${path}"`));
      assert.equal((html.match(/type="checkbox"/g) ?? []).length, 1, "Only the approved adult attestation is collected");
      assert.match(html, /role="status"/);
      assert.doesNotMatch(html, /This action is not available yet/);
    });
    await t.test("draft terms/privacy are readable without sessions or writes and never claim to be effective", async () => {
      const before = await counts();
      for (const [path, title, version] of [["terms", "Terms of Use", "terms-en-draft-2026-10-21"],
        ["privacy", "Privacy Notice", "privacy-en-draft-2026-10-21"]]) {
        const response = await fetch(`${origin}/account/${path}`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("referrer-policy"), "no-referrer");
        assert.deepEqual(response.headers.getSetCookie(), []);
        const html = await response.text();
        const heading = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1];
        assert.equal(heading?.replace(/<!--[\s\S]*?-->/g, ""), `${title} — review draft`);
        assert.match(html, /For review only\. Not approved for real registration/);
        assert.ok(html.includes("JCA"));
        assert.ok(html.includes("support@halaga.ph"));
        assert.match(html, /Legal operator identity, correspondence address and privacy-request responsibility remain unresolved/);
        assert.match(html, /No effective date has been set/);
        assert.ok(html.includes(version));
        assert.match(html, /name="robots" content="noindex, nofollow"/);
        assert.doesNotMatch(html, /<form|type="checkbox"|mailto:/);
      }
      assert.deepEqual(await counts(), before);
    });
    await t.test("unrelated library routes remain closed", async () => {
      for (const path of ["get-session", "sign-out", "delete-user", "sign-in/social", "sign-in/email/", "sign-in%2Femail", "sign-up/email/", "sign-up%2Femail", "signup/email", "change-password/", "change%2Dpassword"]) {
        const response = await send(path);
        // Next may normalize a trailing slash with 308; it never performs a command.
        if (path.endsWith("/")) assert.ok([308, 404].includes(response.status));
        else await read(response, 404, { code: "NOT_FOUND" });
      }
      assert.equal((await fetch(`${origin}/api/auth/sign-in/email`)).status, 405);
      assert.equal((await fetch(`${origin}/api/auth/sign-up/email`)).status, 405);
      assert.equal((await fetch(`${origin}/api/auth/change-password`)).status, 405);
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
      for (const headers of [{ origin: "https://hostile.example.invalid" }, { origin: "" },
        { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }]) {
        await read(await send("sign-up/email", signup, headers), 403, { code: "FORBIDDEN" });
      }
      await read(await send("sign-up/email?callbackURL=/", signup), 404, { code: "NOT_FOUND" });
      assert.deepEqual(await counts(), [0, 0, 0, 0, 0, 0, 0]);
    });
    await t.test("server rejects underage, future DOB, missing attestation and raw library payload without records", async () => {
      for (const patch of [{ dateOfBirth: "2009-01-01" }, { dateOfBirth: "2099-01-01" },
        { dateOfBirth: "2000-02-30" }, { adultAttestationAccepted: false }, { adultAttestationAccepted: "true" },
        { adultAttestationVersion: "invented-client-version" }, { password: "short" },
        { termsAccepted: true, termsVersion: "terms-en-draft-2026-10-21" },
        { adultEligibilityCheckedAt: new Date().toISOString() }, { adultEligible: true }]) {
        await read(await send("sign-up/email", { ...signup, ...patch }), 400, { code: "INVALID_INPUT" });
        assert.deepEqual(await counts(), [0, 0, 0, 0, 0, 0, 0]);
      }
      await read(await send("sign-up/email", { name: signup.displayName, email, password }), 400, { code: "INVALID_INPUT" });
      assert.deepEqual(await counts(), [0, 0, 0, 0, 0, 0, 0]);
    });
    await t.test("each required write and deferred commit failure rolls back; the same request can retry", async () => {
      const { connection } = sandbox;
      await connection.query(`CREATE FUNCTION synthetic_route_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'private-route-failure-sentinel'; END $$`);
      for (const table of ["user", "account", "user_account", "verification", "outbox_event", "account_email_delivery"]) {
        await connection.query(`CREATE TRIGGER synthetic_route_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION synthetic_route_failure()`);
        try {
          await read(await send("sign-up/email", signup), 500, { code: "INTERNAL_ERROR" });
          assert.deepEqual(await counts(), [0, 0, 0, 0, 0, 0, 0]);
        } finally { await connection.query(`DROP TRIGGER synthetic_route_failure ON "${table}"`); }
      }
      await connection.query('CREATE CONSTRAINT TRIGGER synthetic_route_failure AFTER INSERT ON "outbox_event" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION synthetic_route_failure()');
      try {
        await read(await send("sign-up/email", signup), 500, { code: "INTERNAL_ERROR" });
        assert.deepEqual(await counts(), [0, 0, 0, 0, 0, 0, 0]);
      } finally { await connection.query('DROP TRIGGER synthetic_route_failure ON "outbox_event"'); }
      const response = await send("sign-up/email", signup);
      assert.deepEqual(response.headers.getSetCookie(), []);
      await read(response, 200, { status: "REQUEST_RECEIVED" });
      assert.deepEqual(await counts(), [1, 1, 1, 1, 1, 1, 0]);
      const account = await database.userAccount.findFirst({ select: { adultAttestationVersion: true, adultAttestedAt: true, adultEligibilityCheckedAt: true, emailVerifiedAt: true } });
      assert.deepEqual(account.adultEligibilityCheckedAt, account.adultAttestedAt);
      assert.equal(account.adultAttestationVersion, "adult-eligibility-en-v1");
      assert.ok(account.adultAttestedAt instanceof Date);
      assert.equal(account.emailVerifiedAt, null);
      assert.deepEqual(await createAccountEmailDispatcher(database).dispatchOne(), { status: "DISABLED" });
    });
    await t.test("duplicates and normalized concurrent retries return identical generic confirmation without new work or sessions", async () => {
      for (const response of await Promise.all(Array.from({ length: 4 }, (_, index) =>
        send("sign-up/email", { ...signup, email: index % 2 ? email.toUpperCase() : email })))) {
        assert.deepEqual(response.headers.getSetCookie(), []);
        await read(response, 200, { status: "REQUEST_RECEIVED" });
      }
      assert.deepEqual(await counts(), [1, 1, 1, 1, 1, 1, 0]);
    });
    await t.test("actual route enforces three requests per endpoint/IP without creating extra work", async () => {
      const headers = { "x-synthetic-ip": "198.51.100.250" };
      for (let index = 0; index < 3; index++) await read(await send("sign-up/email", signup, headers), 200, { status: "REQUEST_RECEIVED" });
      const response = await send("sign-up/email", { ...signup, email: "rate-denied@example.invalid" }, headers);
      assert.match(response.headers.get("x-retry-after"), /^\d+$/);
      await read(response, 429, { code: "RATE_LIMITED" });
      assert.deepEqual(await counts(), [1, 1, 1, 1, 1, 1, 0]);
    });
    await t.test("unverified synthetic adult signs in with fixed JSON and a stored session cookie", async () => {
      const response = await send("sign-in/email", { email, password });
      const values = response.headers.getSetCookie();
      await read(response, 200, { status: "SIGNED_IN" });
      assert.equal(values.length, 1);
      assert.match(values[0], /^better-auth\.session_token=.*; Path=\/.*; HttpOnly.*; SameSite=Lax/i);
      assert.doesNotMatch(values[0], /; Domain=/i);
      const headers = new Headers({ cookie: values[0].split(";")[0] });
      draftCookie = headers.get("cookie");
      const session = await auth.api.getSession({ headers });
      assert.equal(session.user.emailVerified, false);
      assert.equal(await database.session.count(), 1);
      const { emailVerifiedAt } = await database.userAccount.findUnique({ where: { authUserId: session.user.id }, select: { emailVerifiedAt: true } });
      assert.equal(emailVerifiedAt, null);
      // A subsequent signup cannot publish, replace or refresh this session.
      const before = await database.session.findMany();
      const responseSignup = await send("sign-up/email", signup, { cookie: values[0].split(";")[0] });
      assert.deepEqual(responseSignup.headers.getSetCookie(), []);
      await read(responseSignup, 200, { status: "REQUEST_RECEIVED" });
      assert.deepEqual(await database.session.findMany(), before);
    });
    await t.test("actual private laptop draft routes create/read/save without publishing or exposing public metadata", async () => {
      const target = `${origin}/api/laptop-drafts`;
      const sendDraft = (method, body, id, cookie = draftCookie) => fetch(`${target}${id ? `/${id}` : ""}`, {
        method, headers: { origin, cookie, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const create = { requestId: randomUUID(), draft: { title: "Synthetic owner-private laptop", privatePriceExpectation: "7654321.98" } };
      await read(await sendDraft("POST", create, undefined, ""), 401, { code: "UNAUTHORIZED" });
      const created = await sendDraft("POST", create);
      assert.equal(created.status, 200);
      const result = await created.json();
      draftId = result.id;
      assert.deepEqual(Object.keys(result).sort(), ["id", "revision"]);
      await read(await sendDraft("POST", create), 200, result);
      const privateResponse = await sendDraft("GET", undefined, draftId);
      assert.equal(privateResponse.headers.get("cache-control"), "no-store");
      assert.equal(privateResponse.headers.get("x-robots-tag"), "noindex, nofollow");
      const detail = await privateResponse.json();
      assert.equal(detail.draft.privatePriceExpectation, "7654321.98");
      assert.equal(detail.condition, null);
      assert.equal(detail.status, "DRAFT");
      const save = { requestId: randomUUID(), expectedRevision: 1, draft: { title: "Synthetic private correction" } };
      await read(await sendDraft("PUT", save, draftId), 200, { id: draftId, revision: 2 });
      await read(await sendDraft("PUT", save, draftId), 200, { id: draftId, revision: 2 });
      await read(await sendDraft("PUT", { ...save, requestId: randomUUID() }, draftId), 409, { code: "INVALID_STATE" });
      await read(await sendDraft("GET", undefined, draftId, ""), 401, { code: "UNAUTHORIZED" });
      await read(await fetch(target), 401, { code: "UNAUTHORIZED" });
      const summary = await sendDraft("GET");
      assert.equal(summary.headers.get("cache-control"), "no-store");
      const list = await summary.json();
      assert.deepEqual(list.drafts.map(({ id }) => id), [draftId]);
      assert.deepEqual(Object.keys(list.drafts[0]).sort(), ["condition", "id", "revision", "title", "updatedAt"]);
      assert.equal(list.drafts[0].revision, 2);
      for (const path of ["/drafts", `/drafts/${draftId}`]) {
        const shell = await fetch(`${origin}${path}`, { headers: { cookie: draftCookie } });
        assert.equal(shell.headers.get("cache-control"), "no-store");
        assert.equal(shell.headers.get("referrer-policy"), "no-referrer");
        const html = await shell.text();
        assert.ok(!html.includes(create.draft.title));
        assert.ok(!html.includes(save.draft.title));
        assert.ok(!html.includes(create.draft.privatePriceExpectation));
      }
      assert.equal((await fetch(`${origin}/api/listings/${draftId}`)).status, 404);
      assert.equal((await database.listing.findUnique({ where: { id: draftId } })).status, "DRAFT");
      assert.equal(await database.publicationCycle.count(), 0);
      assert.equal(await database.publicationAvailabilityInterval.count(), 0);
      assert.equal(await database.listingMedia.count(), 0);
      assert.equal(await database.outboxEvent.count(), 1); // Existing signup intent only.
      const home = await (await fetch(origin)).text();
      assert.ok(!home.includes(create.draft.title));
      assert.ok(!home.includes(create.draft.privatePriceExpectation));
    });
    await t.test("mounted draft commands enforce current scopes/suspension while preserving reads, state and sign-in", async () => {
      const account = await database.userAccount.findFirst({ where: { authUser: { email } }, select: { id: true } });
      const sendDraft = (method, body, id) => fetch(`${origin}/api/laptop-drafts${id ? `/${id}` : ""}`, {
        method, headers: { origin, cookie: draftCookie, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const scope of ["CREATE_LAPTOP_DRAFT", "EDIT_LAPTOP_DRAFT", "SUSPENSION", "PUBLISH_LISTING"]) {
        const initial = { requestId: randomUUID(), draft: { title: "Synthetic route guard fixture" } };
        const created = await (await sendDraft("POST", initial)).json();
        const restriction = await database.accountMarketplaceRestriction.create({ data: {
          accountId: account.id, scope, reason: "Synthetic private restriction reason", startsAt: new Date(),
          reviewAt: new Date(Date.now() + 60000), authorizedBy: "synthetic-operator", appealRoute: "synthetic-appeal",
        } });
        if (scope === "SUSPENSION") await read(await send("sign-in/email", { email, password }), 200, { status: "SIGNED_IN" });
        const before = await database.listing.findUnique({ where: { id: created.id },
          include: { revisions: { include: { itemGroups: { include: { answers: true } } } } } });
        const sessions = await database.session.findMany({ orderBy: { id: "asc" } });
        const total = await database.listing.count();
        const createBlocked = ["CREATE_LAPTOP_DRAFT", "SUSPENSION"].includes(scope);
        const editBlocked = ["EDIT_LAPTOP_DRAFT", "SUSPENSION"].includes(scope);
        const post = await sendDraft("POST", { requestId: randomUUID(), draft: {} });
        if (createBlocked) {
          await read(post, 403, { code: "ACTION_RESTRICTED" });
          await read(await sendDraft("POST", initial), 403, { code: "ACTION_RESTRICTED" });
          assert.equal(await database.listing.count(), total);
        } else assert.equal(post.status, 200);
        const put = await sendDraft("PUT", { requestId: randomUUID(), expectedRevision: 1,
          draft: { title: "Synthetic route edit" } }, created.id);
        if (editBlocked) {
          await read(put, 403, { code: "ACTION_RESTRICTED" });
          assert.deepEqual(await database.listing.findUnique({ where: { id: created.id },
            include: { revisions: { include: { itemGroups: { include: { answers: true } } } } } }), before);
        } else assert.equal(put.status, 200);
        const detail = await sendDraft("GET", undefined, created.id);
        assert.equal(detail.status, 200);
        assert.equal((await detail.json()).revision, editBlocked ? 1 : 2);
        assert.equal((await sendDraft("GET")).status, 200);
        assert.deepEqual(await database.session.findMany({ orderBy: { id: "asc" } }), sessions);
        await database.accountMarketplaceRestriction.update({ where: { id: restriction.id },
          data: { revokedAt: new Date(), revokedBy: "synthetic-reviewer" } });
      }
    });
    await t.test("fake delivery feeds the mounted verification command; proof revokes sessions and creates none", async () => {
      const messages = [];
      const dispatcher = createAccountEmailDispatcher(database, async (message) => { messages.push(message); return "synthetic-route-accept"; });
      assert.equal((await dispatcher.dispatchOne()).status, "ACCEPTED");
      assert.equal(messages.length, 1);
      assert.equal(messages[0].to, email);
      const token = new URL(messages[0].text.match(/https?:\/\/\S+#token=[a-f0-9]+/)[0]).hash.slice(7);
      await read(await send("verify-email", { token }), 200, { status: "EMAIL_VERIFIED" });
      assert.equal(await database.session.count(), 0);
      const revokedDraftRead = await fetch(`${origin}/api/laptop-drafts/${draftId}`, { headers: { cookie: draftCookie } });
      await read(revokedDraftRead, 401, { code: "UNAUTHORIZED" });
      await read(await fetch(`${origin}/api/laptop-drafts`, { headers: { cookie: draftCookie } }), 401, { code: "UNAUTHORIZED" });
      assert.equal((await database.user.findUnique({ where: { email }, select: { emailVerified: true } })).emailVerified, true);
      assert.ok((await database.userAccount.findFirst({ select: { emailVerifiedAt: true } })).emailVerifiedAt);
      await read(await send("verify-email", { token }), 400, { code: "INVALID_INPUT" });
      const response = await send("sign-up/email", signup);
      assert.deepEqual(response.headers.getSetCookie(), []);
      await read(response, 200, { status: "REQUEST_RECEIVED" });
      assert.equal(await database.outboxEvent.count(), 1);
      assert.equal(await database.session.count(), 0);
    });
    await t.test("mounted password change validates protected dispatch, atomic commit and fake delivery", async () => {
      const { checkPasswordChangeRoute } = await import("./helpers/password-change-route.mjs");
      await checkPasswordChangeRoute(origin, sandbox, send, read);
    });
    if (process.env.SIGNUP_BROWSER_EXECUTABLE) await t.test("installed browser verifies password maintenance through route and database", async () => {
      const { checkPasswordChangeBrowser } = await import("./helpers/password-change-browser.mjs");
      await checkPasswordChangeBrowser(origin, database, auth);
    });
    if (process.env.SIGNUP_BROWSER_EXECUTABLE) await t.test("optional installed browser verifies private draft create, save, resume, retry, stale edit and reflow", async () => {
      const { checkLaptopDraftBrowser } = await import("./helpers/laptop-drafts-browser.mjs");
      await checkLaptopDraftBrowser(origin, database, auth);
    });
    if (process.env.SIGNUP_BROWSER_EXECUTABLE) await t.test("optional installed browser verifies signup keyboard, pending, result, errors and reflow", async () => {
      const { checkSignupBrowser } = await import("./helpers/signup-browser.mjs");
      await checkSignupBrowser(origin, database);
    });
  } finally {
    try {
      if (server) { server.close(); server.closeAllConnections(); }
      await app?.close();
    } finally {
      delete globalThis.halagaPrisma;
      for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
      Object.assign(process.env, environment);
      await sandbox.close();
    }
  }
});
