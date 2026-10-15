import assert from "node:assert/strict";
import test from "node:test";
import { createSignupOperation, SignupRejected, adultAttestationVersion } from "../src/server/repositories/signup.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

export const syntheticSignup = {
  displayName: "Synthetic adult", email: "signup@example.invalid",
  password: "synthetic-password-for-tests-only", dateOfBirth: "2000-01-01",
  adultAttestationAccepted: true,
};
const now = new Date("2026-10-13T16:00:00.000Z"); // October 14 midnight PHT.
const received = { status: "SIGNUP_RECEIVED" };
const rejects = (code) => (error) => error instanceof SignupRejected && error.code === code &&
  error.message === code && error.cause === undefined;

test("signup validation rejects underage and malformed data before auth or database access", async () => {
  const database = { $transaction() { assert.fail("Database must not be touched"); } };
  const auth = { get $context() { assert.fail("Auth must not be touched"); } };
  const signup = createSignupOperation(database, auth, () => now);
  for (const dateOfBirth of ["2008-10-15", "2027-01-01"]) {
    await assert.rejects(signup({ ...syntheticSignup, dateOfBirth }), rejects("ADULT_ELIGIBILITY_REQUIRED"));
  }
  for (const patch of [{ dateOfBirth: "2000-02-30" }, { dateOfBirth: "2000-01-01T00:00:00Z" },
    { adultAttestationAccepted: false }, { adultAttestationAccepted: "true" }, { email: "invalid" },
    { displayName: " " }, { extra: "private-input" }]) {
    await assert.rejects(signup({ ...syntheticSignup, ...patch }), rejects("INVALID_INPUT"));
  }
});

test("isolated PostgreSQL signup transaction", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  const signup = createSignupOperation(database, auth, () => now);
  const counts = async () => Promise.all([database.user.count(), database.account.count(),
    database.userAccount.count(), database.outboxEvent.count(), database.session.count(), database.verification.count(),
    database.accountEmailDelivery.count()]);
  try {
    await t.test("underage DOB and invalid password persist nothing", async () => {
      await assert.rejects(signup({ ...syntheticSignup, dateOfBirth: "2008-10-15" }), rejects("ADULT_ELIGIBILITY_REQUIRED"));
      const { password } = await auth.$context;
      for (const value of ["x".repeat(password.config.minPasswordLength - 1), "x".repeat(password.config.maxPasswordLength + 1)]) {
        await assert.rejects(signup({ ...syntheticSignup, password: value }), rejects("INVALID_INPUT"));
      }
      assert.deepEqual(await counts(), [0, 0, 0, 0, 0, 0, 0]);
      const hashingFailure = createSignupOperation(database, { $context: Promise.resolve({ password: {
        config: password.config, hash() { throw new Error("synthetic-private-hash-error"); },
      } }) }, () => now);
      await assert.rejects(hashingFailure(syntheticSignup), rejects("INTERNAL_ERROR"));
      assert.deepEqual(await counts(), [0, 0, 0, 0, 0, 0, 0]);
    });

    await t.test("database failure at each required write rolls back every record", async () => {
      await connection.query(`CREATE FUNCTION synthetic_write_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic-private-error'; END $$`);
      for (const table of ["user", "account", "user_account", "verification", "outbox_event", "account_email_delivery"]) {
        await connection.query(`CREATE TRIGGER synthetic_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION synthetic_write_failure()`);
        try {
          await assert.rejects(signup(syntheticSignup), rejects("INTERNAL_ERROR"));
          assert.deepEqual(await counts(), [0, 0, 0, 0, 0, 0, 0], `No residual writes after ${table} failure`);
        } finally {
          await connection.query(`DROP TRIGGER synthetic_failure ON "${table}"`);
        }
      }
      // A transaction can also fail only when COMMIT checks deferred constraints.
      await connection.query('CREATE CONSTRAINT TRIGGER synthetic_failure AFTER INSERT ON "outbox_event" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION synthetic_write_failure()');
      try {
        await assert.rejects(signup(syntheticSignup), rejects("INTERNAL_ERROR"));
        assert.deepEqual(await counts(), [0, 0, 0, 0, 0, 0, 0]);
      } finally {
        await connection.query('DROP TRIGGER synthetic_failure ON "outbox_event"');
      }
    });

    await t.test("eighteenth birthday in PHT commits mapped identity, hashed credential, private eligibility and intent", async () => {
      assert.deepEqual(await signup({ ...syntheticSignup, dateOfBirth: "2008-10-14", email: "Signup@Example.Invalid" }), received);
      assert.deepEqual(await counts(), [1, 1, 1, 1, 0, 1, 1]);
      const identity = await database.user.findUnique({ where: { email: syntheticSignup.email }, select: { id: true, emailVerified: true } });
      assert.equal(identity.emailVerified, false);
      const credential = await database.account.findFirst({ where: { userId: identity.id }, select: { userId: true, accountId: true, providerId: true, password: true } });
      assert.equal(credential.accountId, identity.id);
      assert.equal(credential.providerId, "credential");
      assert.notEqual(credential.password, syntheticSignup.password);
      assert.equal(await (await auth.$context).password.verify({ hash: credential.password, password: syntheticSignup.password }), true);
      const account = await database.userAccount.findUnique({ where: { authUserId: identity.id }, select: {
        id: true, displayName: true, dateOfBirth: true, adultAttestedAt: true, adultAttestationVersion: true, emailVerifiedAt: true,
      } });
      assert.equal(account.dateOfBirth.toISOString(), "2008-10-14T00:00:00.000Z");
      assert.equal(account.adultAttestedAt.toISOString(), now.toISOString());
      assert.equal(account.adultAttestationVersion, adultAttestationVersion);
      assert.equal(account.displayName, syntheticSignup.displayName);
      assert.equal(account.emailVerifiedAt, null);
      const intent = await database.outboxEvent.findFirst({ select: { accountId: true, eventType: true, eventVersion: true, deduplicationKey: true, dispatchedAt: true } });
      assert.deepEqual(intent, { accountId: account.id, eventType: "account.verification-email-requested", eventVersion: 1,
        deduplicationKey: `signup-verification:${account.id}`, dispatchedAt: null });
      assert.ok(!JSON.stringify(intent).includes(syntheticSignup.email));
      // Prove the intent survives reopening a DB connection, outside signup's transaction.
      await database.$disconnect();
      assert.equal(await database.outboxEvent.count(), 1);
      await connection.query('DELETE FROM "outbox_event"');
      await connection.query('DELETE FROM "verification"');
      await connection.query('DELETE FROM "user_account"');
      await connection.query('DELETE FROM "user"');
    });

    await t.test("concurrent normalized-email signups and retries leave exactly one complete account and intent", async () => {
      const otherSignup = createSignupOperation(database, auth, () => now);
      const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) =>
        (index % 2 ? signup : otherSignup)({ ...syntheticSignup, email: index % 2 ? "Signup@Example.Invalid" : syntheticSignup.email })));
      assert.deepEqual(results, Array.from({ length: 6 }, () => ({ status: "fulfilled", value: received })));
      assert.deepEqual(await signup(syntheticSignup), received);
      assert.deepEqual(await counts(), [1, 1, 1, 1, 0, 1, 1]);
      const { rows } = await connection.query(`SELECT count(*)::int AS count FROM "user" u
        JOIN "account" c ON c."userId" = u.id
        JOIN "user_account" a ON a."authUserId" = u.id
        JOIN "outbox_event" e ON e."accountId" = a.id`);
      assert.equal(rows[0].count, 1);
    });

    await t.test("Better Auth signs in the created unverified adult with its stored credential", async () => {
      const result = await auth.api.signInEmail({ body: { email: syntheticSignup.email, password: syntheticSignup.password } });
      assert.equal(result.user.emailVerified, false);
      assert.equal(await database.session.count(), 1);
      assert.equal(await database.verification.count(), 1);
      assert.equal(await database.outboxEvent.count(), 1);
    });
  } finally {
    await sandbox.close();
  }
});
