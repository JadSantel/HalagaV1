import assert from "node:assert/strict";
import { createEmailChangeOperations, EmailChangeRejected } from "../src/server/repositories/email-change.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { openSignupSandbox } from "../tests/helpers/signup-sandbox.mjs";

const scenario = process.argv[2] ?? "success";
if (!["success", "expiry", "reuse", "replacement", "freshness", "conflict", "failure", "commit-failure", "issue-failure"].includes(scenario)) {
  throw new Error("Choose success, expiry, reuse, replacement, freshness, conflict, failure, commit-failure, or issue-failure.");
}
const sandbox = await openSignupSandbox();
const { database, auth, connection } = sandbox;
let now = new Date();
const oldEmail = "local-change-old@example.invalid";
const proposedEmail = "local-change-new@example.invalid";
const password = "synthetic-local-email-change-password-only";
const operations = createEmailChangeOperations(database, auth, () => now);
const verification = createEmailVerificationOperations(database, () => now);
const rejected = (code) => (error) => error instanceof EmailChangeRejected && error.code === code;
try {
  await createSignupOperation(database, auth, () => now)({ displayName: "Synthetic local adult", email: oldEmail, password,
    dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
  await verification.consume((await verification.issue(oldEmail)).token);
  const identity = await database.user.findUnique({ where: { email: oldEmail }, select: { id: true } });
  const account = await database.userAccount.findUnique({ where: { authUserId: identity.id }, select: { id: true } });
  const session = await auth.api.signInEmail({ body: { email: oldEmail, password }, returnHeaders: true });
  await auth.api.signInEmail({ body: { email: oldEmail, password } });
  now = new Date();
  const headers = new Headers({ cookie: session.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
  const issue = () => operations.issue(headers, { proposedEmail }, () => {});
  const snapshot = async () => {
    const user = await database.user.findUnique({ where: { id: identity.id }, select: { email: true, emailVerified: true } });
    const domain = await database.userAccount.findUnique({ where: { id: account.id }, select: { emailVerifiedAt: true } });
    const notices = await database.outboxEvent.findMany({ where: { accountId: account.id, eventType: "account.email-changed-security-notice" },
      select: { recipientEmail: true, dispatchedAt: true } });
    const result = { oldAddressPrimary: user.email === oldEmail, newAddressPrimary: user.email === proposedEmail,
      verified: user.emailVerified && domain.emailVerifiedAt !== null,
      sessions: await database.session.count({ where: { userId: identity.id } }),
      changeTokens: await database.verification.count({ where: { identifier: `halaga-email-change:${identity.id}` } }),
      emailIntents: await database.outboxEvent.count({ where: { accountId: account.id } }),
      oldAddressNotices: notices.length, noticeRecipientCorrect: notices.every((row) => row.recipientEmail === oldEmail && row.dispatchedAt === null) };
    console.log(result); // Booleans/counts only; no email, cookie, credential or token.
    return result;
  };
  if (scenario === "freshness") {
    await database.session.updateMany({ where: { userId: identity.id }, data: { createdAt: new Date(now.getTime() - 900000), updatedAt: now } });
    const before = await snapshot();
    await assert.rejects(issue(), rejected("UNAUTHORIZED"));
    console.log({ code: "UNAUTHORIZED" });
    assert.deepEqual(await snapshot(), before);
  } else {
    let issued = await issue();
    assert.equal(issued.expiresAt.getTime() - now.getTime(), 86400000);
    console.log({ tokenLifetimeHours: 24 });
    const before = await snapshot();
    assert.equal(before.oldAddressPrimary, true);
    assert.equal(before.verified, true);
    assert.equal(before.sessions, 2);
    assert.equal(before.changeTokens, 1);
    let intentCount = before.emailIntents;
    if (scenario === "expiry") {
      now = issued.expiresAt;
      await assert.rejects(operations.consume(issued.token), rejected("INVALID_TOKEN"));
      console.log({ code: "INVALID_TOKEN" });
      assert.deepEqual(await snapshot(), before);
    } else {
      if (scenario === "replacement") {
        const replacement = await issue();
        await assert.rejects(operations.consume(issued.token), rejected("INVALID_TOKEN"));
        console.log({ code: "INVALID_TOKEN" });
        issued = replacement;
        intentCount++;
      }
      if (scenario === "conflict") {
        await createSignupOperation(database, auth, () => now)({ displayName: "Synthetic address claimant", email: proposedEmail, password,
          dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
        await assert.rejects(operations.consume(issued.token), rejected("INVALID_TOKEN"));
        console.log({ code: "INVALID_TOKEN" });
        assert.deepEqual(await snapshot(), before);
        // Free the address solely in this disposable synthetic fixture, then retry.
        await database.user.update({ where: { email: proposedEmail }, data: { email: "local-conflict-freed@example.invalid" } });
      }
      if (["failure", "commit-failure", "issue-failure"].includes(scenario)) {
        await connection.query(`CREATE FUNCTION synthetic_manual_change_failure() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'synthetic-private-error'; END $$`);
        const table = scenario === "failure" ? "session" : "outbox_event";
        const trigger = scenario === "commit-failure"
          ? 'CREATE CONSTRAINT TRIGGER synthetic_failure AFTER INSERT ON "outbox_event" DEFERRABLE INITIALLY DEFERRED'
          : `CREATE TRIGGER synthetic_failure BEFORE ${table === "session" ? "DELETE" : "INSERT"} ON "${table}"`;
        await connection.query(`${trigger} FOR EACH ROW EXECUTE FUNCTION synthetic_manual_change_failure()`);
        try {
          await assert.rejects(scenario === "issue-failure" ? issue() : operations.consume(issued.token), rejected("INTERNAL_ERROR"));
          console.log({ code: "INTERNAL_ERROR" });
          assert.deepEqual(await snapshot(), before);
        } finally { await connection.query(`DROP TRIGGER synthetic_failure ON "${table}"`); }
      }
      assert.deepEqual(await operations.consume(issued.token), { status: "EMAIL_CHANGED" });
      console.log({ status: "EMAIL_CHANGED" });
      assert.deepEqual(await snapshot(), { oldAddressPrimary: false, newAddressPrimary: true, verified: true,
        sessions: 0, changeTokens: 0, emailIntents: intentCount + 1, oldAddressNotices: 1, noticeRecipientCorrect: true });
      if (scenario === "reuse") {
        await assert.rejects(operations.consume(issued.token), rejected("INVALID_TOKEN"));
        console.log({ code: "INVALID_TOKEN" });
        assert.equal((await snapshot()).oldAddressNotices, 1);
      }
      await assert.rejects(auth.api.signInEmail({ body: { email: oldEmail, password } }));
      const fresh = await auth.api.signInEmail({ body: { email: proposedEmail, password } });
      assert.equal(fresh.user.emailVerified, true);
      console.log({ oldAddressSignInRejected: true, newAddressSignInVerified: true });
    }
  }
} finally {
  await sandbox.close();
  console.log("Disposable schema and synthetic records removed. No email sent.");
}
