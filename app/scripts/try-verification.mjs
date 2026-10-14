import assert from "node:assert/strict";
import { createEmailVerificationOperations, EmailVerificationRejected } from "../src/server/repositories/email-verification.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { openSignupSandbox } from "../tests/helpers/signup-sandbox.mjs";

const scenario = process.argv[2] ?? "success";
if (!["success", "expiry", "reuse", "replacement", "failure"].includes(scenario)) {
  throw new Error("Choose success, expiry, reuse, replacement, or failure.");
}
const sandbox = await openSignupSandbox();
const { database, auth, connection } = sandbox;
let now = new Date();
const email = "local-verification@example.invalid";
const password = "synthetic-local-password-only";
const operations = createEmailVerificationOperations(database, () => now);
const attempt = async (token, expected) => {
  try {
    const result = await operations.consume(token);
    assert.equal(expected, "EMAIL_VERIFIED");
    console.log(result);
  } catch (error) {
    if (!(error instanceof EmailVerificationRejected)) throw error;
    assert.equal(error.code, expected);
    console.log({ code: error.code });
  }
};
const snapshot = async () => {
  const identity = await database.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  const account = await database.userAccount.findUnique({ where: { authUserId: identity.id }, select: { emailVerifiedAt: true } });
  const state = { identityVerified: identity.emailVerified, accountVerified: account.emailVerifiedAt !== null,
    sessions: await database.session.count(), tokens: await database.verification.count(),
    emailIntents: await database.outboxEvent.count() };
  console.log(state); // Fixed synthetic state only; no email, credentials or token material.
  return state;
};
try {
  await createSignupOperation(database, auth, () => now)({ displayName: "Synthetic local adult", email, password,
    dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
  await auth.api.signInEmail({ body: { email, password } });
  const issued = await operations.issue(email);
  assert.equal(issued.expiresAt.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
  console.log({ tokenLifetimeHours: 24 });
  const before = await snapshot();
  assert.deepEqual(before, { identityVerified: false, accountVerified: false, sessions: 1, tokens: 1, emailIntents: 2 });
  if (scenario === "expiry") {
    now = issued.expiresAt; // Advance the synthetic clock; no actual wait.
    await attempt(issued.token, "INVALID_TOKEN");
    assert.deepEqual(await snapshot(), before);
  } else if (scenario === "replacement") {
    const replacement = await operations.issue(email);
    assert.notEqual(issued.token, replacement.token);
    await attempt(issued.token, "INVALID_TOKEN");
    await attempt(replacement.token, "EMAIL_VERIFIED");
    assert.deepEqual(await snapshot(), { identityVerified: true, accountVerified: true, sessions: 0, tokens: 0, emailIntents: 3 });
  } else if (scenario === "failure") {
    await connection.query(`CREATE FUNCTION synthetic_manual_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic-private-error'; END $$`);
    await connection.query('CREATE TRIGGER synthetic_failure BEFORE DELETE ON "session" FOR EACH ROW EXECUTE FUNCTION synthetic_manual_failure()');
    try {
      await attempt(issued.token, "INTERNAL_ERROR");
      assert.deepEqual(await snapshot(), before);
    } finally { await connection.query('DROP TRIGGER synthetic_failure ON "session"'); }
    await attempt(issued.token, "EMAIL_VERIFIED");
    assert.deepEqual(await snapshot(), { identityVerified: true, accountVerified: true, sessions: 0, tokens: 0, emailIntents: 2 });
  } else {
    await attempt(issued.token, "EMAIL_VERIFIED");
    if (scenario === "reuse") await attempt(issued.token, "INVALID_TOKEN");
    assert.deepEqual(await snapshot(), { identityVerified: true, accountVerified: true, sessions: 0, tokens: 0, emailIntents: 2 });
  }
} finally {
  await sandbox.close();
  console.log("Disposable schema and synthetic records removed. No email sent.");
}
