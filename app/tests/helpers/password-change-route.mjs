import assert from "node:assert/strict";
import { createAccountEmailDispatcher } from "../../src/server/repositories/account-email-dispatch.ts";
import { passwordChangeEmailEvent } from "../../src/server/password-change-notice-policy.ts";

/** Real Next dispatch, synthetic accounts, SQL fault injection and fake delivery only. */
export async function checkPasswordChangeRoute(origin, { database, auth, connection }, send, read) {
  const email = "mounted-password-change@example.invalid", password = "synthetic-route-current-password";
  const input = { currentPassword: password, newPassword: "synthetic-route-new-password" };
  await read(await send("sign-up/email", { email, password, displayName: "Synthetic maintenance",
    dateOfBirth: "2000-01-01", adultAttestationAccepted: true }), 200, { status: "REQUEST_RECEIVED" });
  const { id: userId } = await database.user.findUnique({ where: { email }, select: { id: true } });
  const account = await database.userAccount.findUnique({ where: { authUserId: userId }, select: { id: true } });
  const signIn = async (value = password) => {
    const response = await send("sign-in/email", { email, password: value });
    const cookie = response.headers.getSetCookie()[0]?.split(";")[0];
    await read(response, 200, { status: "SIGNED_IN" });
    return cookie;
  };
  let cookie = await signIn();
  const change = async (body = input, headers = {}) => {
    const response = await send("change-password", body, { cookie, ...headers });
    assert.deepEqual(response.headers.getSetCookie(), []);
    return response;
  };
  const snapshot = () => Promise.all([
    database.account.findMany({ where: { userId } }), database.session.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    database.passwordChangeNotice.findMany({ where: { accountId: account.id } }),
    database.outboxEvent.findMany({ where: { accountId: account.id }, include: { emailDelivery: true } }),
  ]);
  const before = await snapshot();
  for (const headers of [{ origin: "https://hostile.example.invalid" }, { origin: "" },
    { origin: "https://hostile.example.invalid", "sec-fetch-site": "cross-site" }]) {
    await read(await change(input, headers), 403, { code: "FORBIDDEN" });
  }
  await read(await send("change-password?currentPassword=synthetic-query-sentinel", input, { cookie }), 404, { code: "NOT_FOUND" });
  await read(await change(input, { cookie: "" }), 401, { code: "UNAUTHORIZED" });
  for (const body of [null, {}, "private-input-sentinel", { ...input, newPassword: "short" }, { ...input, accountId: account.id },
    { ...input, revokeOtherSessions: false }, { ...input, currentPassword: "wrong-password-sentinel" }]) {
    await read(await change(body), 400, { code: "INVALID_INPUT" });
  }
  const malformed = await fetch(`${origin}/api/auth/change-password`, { method: "POST",
    headers: { origin, cookie, "content-type": "application/json" }, body: '{"currentPassword":' });
  await read(malformed, 400, { code: "INVALID_INPUT" });
  assert.deepEqual(await snapshot(), before);

  const { session } = await auth.api.getSession({ headers: new Headers({ cookie }), query: { disableRefresh: true } });
  await database.session.update({ where: { id: session.id }, data: { createdAt: new Date(Date.now() - 15 * 60 * 1000) } });
  await read(await change(), 403, { code: "FORBIDDEN" });
  await database.session.delete({ where: { id: session.id } });
  await read(await change(), 401, { code: "UNAUTHORIZED" });
  cookie = await signIn();
  const otherCookie = await signIn();
  const preserved = await database.session.findMany({ where: { userId } });
  await read(await change(), 200, { status: "PASSWORD_CHANGED" });
  assert.equal(await database.passwordChangeNotice.count({ where: { accountId: account.id } }), 1);
  assert.equal(await database.outboxEvent.count({ where: { accountId: account.id, eventType: passwordChangeEmailEvent } }), 0);
  assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: otherCookie }) }), null);
  const current = await auth.api.getSession({ headers: new Headers({ cookie }), query: { disableRefresh: true } });
  assert.deepEqual(await database.session.findMany({ where: { userId } }), preserved.filter((row) => row.id === current.session.id));

  // Same initiating session, now verified in both stores. Every required failure rolls back.
  input.currentPassword = input.newPassword;
  input.newPassword = "synthetic-route-final-password";
  await database.user.update({ where: { id: userId }, data: { emailVerified: true } });
  await database.userAccount.update({ where: { id: account.id }, data: { emailVerifiedAt: new Date() } });
  await signIn(input.currentPassword);
  const verifiedBefore = await snapshot();
  await connection.query(`CREATE FUNCTION synthetic_change_route_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'private-change-route-error-sentinel'; END $$`);
  for (const [table, event] of [["account", "UPDATE"], ["session", "DELETE"], ["password_change_notice", "INSERT"],
    ["outbox_event", "INSERT"], ["account_email_delivery", "INSERT"]]) {
    await connection.query(`CREATE TRIGGER synthetic_change_route_failure BEFORE ${event} ON "${table}"
      FOR EACH ROW EXECUTE FUNCTION synthetic_change_route_failure()`);
    try {
      await read(await change(), 500, { code: "INTERNAL_ERROR" });
      assert.deepEqual(await snapshot(), verifiedBefore);
    } finally { await connection.query(`DROP TRIGGER synthetic_change_route_failure ON "${table}"`); }
  }
  await connection.query(`CREATE CONSTRAINT TRIGGER synthetic_change_route_failure AFTER INSERT ON "outbox_event"
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION synthetic_change_route_failure()`);
  try {
    await read(await change(), 500, { code: "INTERNAL_ERROR" });
    assert.deepEqual(await snapshot(), verifiedBefore);
  } finally { await connection.query('DROP TRIGGER synthetic_change_route_failure ON "outbox_event"'); }
  await read(await change(), 200, { status: "PASSWORD_CHANGED" });
  const event = await database.outboxEvent.findFirst({ where: { accountId: account.id, eventType: passwordChangeEmailEvent },
    include: { emailDelivery: true } });
  assert.equal(event.recipientEmail, email);
  assert.equal(event.emailDelivery.state, "READY");
  assert.equal(await database.passwordChangeNotice.count({ where: { accountId: account.id } }), 2);
  assert.ok(await auth.api.getSession({ headers: new Headers({ cookie }), query: { disableRefresh: true } }));
  await read(await change(), 400, { code: "INVALID_INPUT" }); // Replay cannot repeat the committed effect.
  await read(await send("sign-in/email", { email, password: input.currentPassword }), 401, { code: "UNAUTHORIZED" });
  await signIn(input.newPassword);
  assert.deepEqual(await createAccountEmailDispatcher(database).dispatchOne(), { status: "DISABLED" });
  const messages = [];
  const fake = createAccountEmailDispatcher(database, async (message) => { messages.push(message); return "synthetic-change-route-accept"; });
  // Older signup work can be selected first; no external delivery occurs.
  for (let attempt = 0; attempt < 8 && !messages.some((message) => message.subject === "Your Halaga password changed"); attempt++) await fake.dispatchOne();
  const notice = messages.find((message) => message.subject === "Your Halaga password changed");
  assert.equal(notice.to, email);
  assert.doesNotMatch(notice.text, /https?:|synthetic-route|@example/);
  assert.equal((await database.outboxEvent.findUnique({ where: { id: event.id } })).recipientEmail, null);
  for (let attempt = 0; attempt < 60; attempt++) {
    await read(await send("change-password", {}, { "x-synthetic-ip": "198.51.100.251" }), 401, { code: "UNAUTHORIZED" });
  }
  const limited = await send("change-password", {}, { "x-synthetic-ip": "198.51.100.251" });
  assert.match(limited.headers.get("x-retry-after"), /^\d+$/);
  await read(limited, 429, { code: "RATE_LIMITED" });
}
