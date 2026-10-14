import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { openSignupSandbox } from "../tests/helpers/signup-sandbox.mjs";

// Synthetic direct-domain exercise. Each invocation removes its disposable schema.
const scenario = process.argv[2] ?? "adult";
if (!["adult", "underage", "duplicate"].includes(scenario)) {
  throw new Error("Choose adult, underage, or duplicate.");
}
const sandbox = await openSignupSandbox();
try {
  const signup = createSignupOperation(sandbox.database, sandbox.auth);
  const input = { displayName: "Synthetic local adult", email: "local-signup@example.invalid",
    password: "synthetic-local-password-only", dateOfBirth: scenario === "underage" ? "2020-01-01" : "2000-01-01",
    adultAttestationAccepted: true };
  try {
    console.log(await signup(input));
    if (scenario === "duplicate") console.log(await signup(input));
  } catch (error) {
    console.log({ code: error.code ?? "INTERNAL_ERROR" });
  }
  console.log({ identities: await sandbox.database.user.count(), credentials: await sandbox.database.account.count(),
    domainAccounts: await sandbox.database.userAccount.count(), emailIntents: await sandbox.database.outboxEvent.count(),
    sessions: await sandbox.database.session.count(), verificationTokens: await sandbox.database.verification.count() });
} finally {
  await sandbox.close();
  console.log("Disposable schema and synthetic records removed. No email sent.");
}
