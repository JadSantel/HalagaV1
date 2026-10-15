import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createAccountEmailIntentInspector } from "../src/server/repositories/account-email-intents.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createPasswordResetOperations } from "../src/server/repositories/password-reset.ts";
import { createEmailChangeOperations } from "../src/server/repositories/email-change.ts";
import { openSignupSandbox } from "../tests/helpers/signup-sandbox.mjs";

const scenario = process.argv[2];
if (!["verification", "reset", "email-change", "security-notice"].includes(scenario)) {
  throw new Error("Choose verification, reset, email-change, or security-notice.");
}
const sandbox = await openSignupSandbox();
const { database, auth } = sandbox;
let now = new Date();
const inspect = createAccountEmailIntentInspector(database, () => now);
const verification = createEmailVerificationOperations(database, () => now);
const reset = createPasswordResetOperations(database, auth, () => now);
const change = createEmailChangeOperations(database, auth, () => now);
const email = "local-intent@example.invalid";
const password = "synthetic-local-intent-password-only";
const show = async (intentId, expected) => {
  const result = await inspect(intentId);
  assert.deepEqual(result, { status: expected });
  console.log(result); // Fixed status only. Never print a token, address or URL.
};
try {
  await createSignupOperation(database, auth, () => now)({ email, password, displayName: "Synthetic adult",
    dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
  now = new Date();
  const initial = await database.outboxEvent.findFirst({ select: { id: true } });
  await show(initial.id, "SIGNUP_TOKEN_UNBOUND");
  const emailChange = ["email-change", "security-notice"].includes(scenario);
  let issue;
  let namespace;
  let consume;
  if (emailChange) {
    await verification.consume((await verification.issue(email)).token);
    const signedIn = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
    const headers = new Headers({ cookie: signedIn.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
    now = new Date();
    issue = () => change.issue(headers, { proposedEmail: "proposed-local@example.invalid" }, () => {});
    namespace = "halaga-email-change:";
    consume = (token) => change.consume(token);
  } else {
    const operations = scenario === "verification" ? verification : reset;
    issue = () => operations.issue(email);
    namespace = scenario === "verification" ? "halaga-email-verification:" : "halaga-password-reset:";
    consume = (token) => scenario === "verification" ? verification.consume(token)
      : reset.consume({ token, newPassword: "synthetic-local-replacement-password-only" });
  }
  const findIntent = async (token) => {
    const id = namespace + createHash("sha256").update(token).digest("hex");
    return database.outboxEvent.findFirst({ where: { deduplicationKey: { endsWith: id } }, select: { id: true } });
  };
  const original = await issue();
  const oldIntent = await findIntent(original.token);
  await show(oldIntent.id, "TOKEN_CURRENT");
  await show(oldIntent.id, "TOKEN_CURRENT"); // Reinspection is read-only, not deduplication.
  const replacement = await issue();
  const replacementIntent = await findIntent(replacement.token);
  await show(oldIntent.id, "STALE");
  const savedNow = now;
  now = replacement.expiresAt;
  await show(replacementIntent.id, "STALE");
  now = savedNow; // Synthetic clock only; allow the remaining manual consumption check.
  await consume(replacement.token);
  await show(replacementIntent.id, "STALE");
  if (scenario === "security-notice") {
    const notice = await database.outboxEvent.findFirst({ where: { eventType: "account.email-changed-security-notice" },
      select: { id: true, recipientEmail: true } });
    assert.equal(notice.recipientEmail, email);
    await show(notice.id, "NOTICE_RECORDED");
  }
  assert.equal(await database.outboxEvent.count({ where: { dispatchedAt: { not: null } } }), 0);
  console.log({ dispatched: false, sent: false });
} finally { await sandbox.close(); }
