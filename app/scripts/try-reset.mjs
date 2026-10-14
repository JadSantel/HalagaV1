import assert from "node:assert/strict";
import { createPasswordResetOperations, PasswordResetRejected } from "../src/server/repositories/password-reset.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { openSignupSandbox } from "../tests/helpers/signup-sandbox.mjs";

const scenario = process.argv[2] ?? "success";
if (!["success", "verified", "expiry", "reuse", "replacement", "failure", "commit-failure", "issue-failure"].includes(scenario)) {
  throw new Error("Choose success, verified, expiry, reuse, replacement, failure, commit-failure, or issue-failure.");
}
const sandbox = await openSignupSandbox();
const { database, auth, connection } = sandbox;
let now = new Date();
const email = "local-reset@example.invalid";
const oldPassword = "synthetic-local-old-password-only";
const newPassword = "synthetic-local-new-password-only";
const operations = createPasswordResetOperations(database, auth, () => now);
const verification = createEmailVerificationOperations(database, () => now);
const verified = scenario === "verified";
const attempt = async (token, expected) => {
  try {
    const result = await operations.consume({ token, newPassword });
    assert.equal(expected, "PASSWORD_RESET");
    console.log(result);
  } catch (error) {
    if (!(error instanceof PasswordResetRejected)) throw error;
    assert.equal(error.code, expected);
    console.log({ code: error.code });
  }
};
const snapshot = async () => {
  const identity = await database.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  const account = await database.userAccount.findUnique({ where: { authUserId: identity.id }, select: { emailVerifiedAt: true } });
  const state = { identityVerified: identity.emailVerified, accountVerified: account.emailVerifiedAt !== null,
    sessions: await database.session.count(), resetTokens: await database.verification.count({ where: { identifier: `halaga-password-reset:${identity.id}` } }),
    verificationTokens: await database.verification.count({ where: { identifier: `halaga-email-verification:${identity.id}` } }),
    emailIntents: await database.outboxEvent.count() };
  console.log(state); // Counts/booleans only; no email, password/hash, cookie or token.
  return state;
};
try {
  await createSignupOperation(database, auth, () => now)({ displayName: "Synthetic local adult", email, password: oldPassword,
    dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
  const emailToken = await verification.issue(email);
  if (verified) await verification.consume(emailToken.token);
  await auth.api.signInEmail({ body: { email, password: oldPassword } });
  await auth.api.signInEmail({ body: { email, password: oldPassword } });
  let issued = await operations.issue(email);
  assert.equal(issued.expiresAt.getTime() - now.getTime(), 60 * 60 * 1000);
  console.log({ tokenLifetimeHours: 1 });
  const before = await snapshot();
  assert.deepEqual(before, { identityVerified: verified, accountVerified: verified,
    sessions: 2, resetTokens: 1, verificationTokens: verified ? 0 : 1, emailIntents: 3 });
  let intentCount = 3;
  if (scenario === "expiry") {
    now = issued.expiresAt;
    await attempt(issued.token, "INVALID_TOKEN");
    assert.deepEqual(await snapshot(), before);
  } else {
    if (scenario === "replacement") {
      const replacement = await operations.issue(email);
      assert.notEqual(issued.token, replacement.token);
      await attempt(issued.token, "INVALID_TOKEN");
      issued = replacement;
      intentCount++;
    }
    if (["failure", "commit-failure", "issue-failure"].includes(scenario)) {
      await connection.query(`CREATE FUNCTION synthetic_manual_reset_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic-private-error'; END $$`);
      const table = scenario === "issue-failure" ? "outbox_event" : scenario === "commit-failure" ? "account" : "session";
      const trigger = scenario === "commit-failure"
        ? 'CREATE CONSTRAINT TRIGGER synthetic_failure AFTER UPDATE ON "account" DEFERRABLE INITIALLY DEFERRED'
        : `CREATE TRIGGER synthetic_failure BEFORE ${table === "outbox_event" ? "INSERT" : "DELETE"} ON "${table}"`;
      await connection.query(`${trigger} FOR EACH ROW EXECUTE FUNCTION synthetic_manual_reset_failure()`);
      try {
        if (scenario === "issue-failure") {
          await assert.rejects(operations.issue(email), (error) => error instanceof PasswordResetRejected && error.code === "INTERNAL_ERROR");
          console.log({ code: "INTERNAL_ERROR" });
        } else await attempt(issued.token, "INTERNAL_ERROR");
        assert.deepEqual(await snapshot(), before);
      } finally { await connection.query(`DROP TRIGGER synthetic_failure ON "${table}"`); }
      // Old credentials still work after rollback; reset must revoke this session too.
      await auth.api.signInEmail({ body: { email, password: oldPassword } });
    }
    await attempt(issued.token, "PASSWORD_RESET");
    if (scenario === "reuse") await attempt(issued.token, "INVALID_TOKEN");
    assert.deepEqual(await snapshot(), { identityVerified: verified, accountVerified: verified,
      sessions: 0, resetTokens: 0, verificationTokens: verified ? 0 : 1, emailIntents: intentCount });
    await assert.rejects(auth.api.signInEmail({ body: { email, password: oldPassword } }));
    const fresh = await auth.api.signInEmail({ body: { email, password: newPassword } });
    assert.equal(fresh.user.emailVerified, verified);
    console.log({ oldPasswordRejected: true, freshSignInSucceeded: true, emailVerified: fresh.user.emailVerified });
  }
} finally {
  await sandbox.close();
  console.log("Disposable schema and synthetic records removed. No email sent.");
}
