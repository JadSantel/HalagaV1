import assert from "node:assert/strict";
import { createPasswordChangeOperation, PasswordChangeRejected } from "../src/server/repositories/password-change.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { openSignupSandbox } from "../tests/helpers/signup-sandbox.mjs";

const scenario = process.argv[2] ?? "success";
if (!["success", "verified", "freshness", "last-millisecond", "wrong-password", "hash-failure", "failure", "commit-failure"].includes(scenario)) {
  throw new Error("Choose success, verified, freshness, last-millisecond, wrong-password, hash-failure, failure, or commit-failure.");
}
const sandbox = await openSignupSandbox();
const { database, auth, connection } = sandbox;
let now = new Date();
const email = "local-password-change@example.invalid";
const oldPassword = "synthetic-local-old-password-only";
const newPassword = "synthetic-local-new-password-only";
const cookieHeaders = (result) => new Headers({ cookie: result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
const change = createPasswordChangeOperation(database, auth, () => now);
try {
  await createSignupOperation(database, auth, () => now)({ email, password: oldPassword, displayName: "Synthetic local adult",
    dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
  const verification = createEmailVerificationOperations(database, () => now);
  const issued = await verification.issue(email);
  if (scenario === "verified") await verification.consume(issued.token);
  const initiating = cookieHeaders(await auth.api.signInEmail({ body: { email, password: oldPassword }, returnHeaders: true }));
  const other = cookieHeaders(await auth.api.signInEmail({ body: { email, password: oldPassword }, returnHeaders: true }));
  now = new Date();
  const actor = await auth.api.getSession({ headers: initiating });
  const stored = () => database.session.findMany({ where: { userId: actor.user.id }, orderBy: { id: "asc" },
    select: { id: true, token: true, createdAt: true, updatedAt: true, expiresAt: true } });
  const credential = () => database.account.findFirst({ where: { userId: actor.user.id, providerId: "credential" },
    select: { password: true, updatedAt: true } });
  if (["freshness", "last-millisecond"].includes(scenario)) {
    now = new Date(actor.session.createdAt.getTime() + (scenario === "freshness" ? 900000 : 899999));
  }
  const beforeSessions = await stored();
  const beforeCredential = await credential();
  const beforeIntents = await database.outboxEvent.count();
  const beforeTokens = await database.verification.count();
  const beforeNotices = await database.passwordChangeNotice.count();
  const expectFailure = async (operation, code, currentPassword = oldPassword) => {
    await assert.rejects(operation(initiating, { currentPassword, newPassword }, () => {}),
      (error) => error instanceof PasswordChangeRejected && error.code === code && error.message === code && !error.cause);
    assert.deepEqual(await stored(), beforeSessions);
    assert.deepEqual(await credential(), beforeCredential);
    assert.equal(await database.passwordChangeNotice.count(), beforeNotices);
    console.log({ code, oldCredentialAndAllSessionsPreserved: true });
  };
  if (scenario === "freshness") {
    await expectFailure(change, "UNAUTHORIZED");
  } else {
    if (scenario === "wrong-password") await expectFailure(change, "INVALID_PASSWORD", "synthetic-wrong-password");
    if (scenario === "hash-failure") {
      const context = await auth.$context;
      const failing = createPasswordChangeOperation(database, { api: auth.api, $context: Promise.resolve({ ...context,
        password: { ...context.password, hash() { throw new Error("synthetic-private-hash-error"); } } }) }, () => now);
      await expectFailure(failing, "INTERNAL_ERROR");
    }
    if (["failure", "commit-failure"].includes(scenario)) {
      await connection.query(`CREATE FUNCTION synthetic_manual_password_change_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic-private-database-error'; END $$`);
      const table = scenario === "failure" ? "session" : "account";
      const trigger = scenario === "failure" ? 'CREATE TRIGGER synthetic_failure BEFORE DELETE ON "session"'
        : 'CREATE CONSTRAINT TRIGGER synthetic_failure AFTER UPDATE ON "account" DEFERRABLE INITIALLY DEFERRED';
      await connection.query(`${trigger} FOR EACH ROW EXECUTE FUNCTION synthetic_manual_password_change_failure()`);
      try { await expectFailure(change, "INTERNAL_ERROR"); }
      finally { await connection.query(`DROP TRIGGER synthetic_failure ON "${table}"`); }
    }
    assert.deepEqual(await change(initiating, { currentPassword: oldPassword, newPassword }, () => {}), { status: "PASSWORD_CHANGED" });
    assert.deepEqual(await stored(), beforeSessions.filter((session) => session.id === actor.session.id));
    assert.notDeepEqual(await credential(), beforeCredential);
    assert.equal(await database.passwordChangeNotice.count(), beforeNotices + 1);
    const notice = await database.passwordChangeNotice.findFirst({ select: { emailEligibility: true } });
    assert.equal(notice.emailEligibility, scenario === "verified" ? "ELIGIBLE" : "INELIGIBLE");
    assert.ok(await auth.api.getSession({ headers: initiating }));
    assert.equal(await auth.api.getSession({ headers: other }), null);
    await assert.rejects(auth.api.signInEmail({ body: { email, password: oldPassword } }));
    const fresh = await auth.api.signInEmail({ body: { email, password: newPassword } });
    assert.equal(fresh.user.emailVerified, scenario === "verified");
    console.log({ status: "PASSWORD_CHANGED", retainedInitiatingSession: true, otherSessionRevoked: true,
      oldPasswordRejected: true, newPasswordSignInSucceeded: true, verificationPreserved: true, oneInAppNoticeRecorded: true });
  }
  assert.equal(await database.outboxEvent.count(), beforeIntents);
  assert.equal(await database.verification.count(), beforeTokens);
  console.log({ tokensPreserved: true, emailIntentsUnchanged: true });
} finally {
  await sandbox.close();
  console.log("Disposable schema and synthetic records removed. No email sent.");
}
