import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { createAccountEmailIntentInspector, AccountEmailIntentRejected } from "../src/server/repositories/account-email-intents.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createPasswordResetOperations } from "../src/server/repositories/password-reset.ts";
import { createEmailChangeOperations } from "../src/server/repositories/email-change.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

const rejects = (code) => (error) => error instanceof AccountEmailIntentRejected &&
  error.message === code && error.code === code && error.cause === undefined;
const cookieHeaders = (result) => new Headers({ cookie: result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
const kinds = {
  verification: ["account.verification-email-requested", "halaga-email-verification:"],
  reset: ["account.password-reset-email-requested", "halaga-password-reset:"],
  change: ["account.email-change-verification-requested", "halaga-email-change:"],
};

test("intent inspection validates before database access and strips exception details", async () => {
  const inspect = createAccountEmailIntentInspector({ $transaction() { assert.fail("No database access"); } });
  for (const input of [null, {}, "private@example.invalid", "a".repeat(64)]) {
    await assert.rejects(inspect(input), rejects("INVALID_INPUT"));
  }
  const failing = createAccountEmailIntentInspector({ $transaction() {
    throw new Error("synthetic-private-recipient-token-provider-diagnostic");
  } });
  await assert.rejects(failing(randomUUID()), rejects("INTERNAL_ERROR"));
});

test("isolated PostgreSQL account email intent inspection (no sending)", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  let now = new Date();
  const inspect = createAccountEmailIntentInspector(database, () => now);
  const signup = createSignupOperation(database, auth, () => now);
  const verification = createEmailVerificationOperations(database, () => now);
  const reset = createPasswordResetOperations(database, auth, () => now);
  const change = createEmailChangeOperations(database, auth, () => now);
  const password = "synthetic-intent-test-password-only";
  const fixture = async (verified = false) => {
    now = new Date();
    const email = `intent-${randomUUID()}@example.invalid`;
    await signup({ email, password, displayName: "Synthetic adult", dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    const identity = await database.user.findUnique({ where: { email }, select: { id: true } });
    const account = await database.userAccount.findUnique({ where: { authUserId: identity.id }, select: { id: true } });
    now = new Date(); // Signup uses the database clock for its initial intent.
    if (verified) await verification.consume((await verification.issue(email)).token);
    return { email, userId: identity.id, accountId: account.id };
  };
  const issue = async (kind, account) => {
    let issued;
    let proposedEmail;
    if (kind === "verification") issued = await verification.issue(account.email);
    else if (kind === "reset") issued = await reset.issue(account.email);
    else {
      const session = await auth.api.signInEmail({ body: { email: account.email, password }, returnHeaders: true });
      now = new Date();
      proposedEmail = `proposed-${randomUUID()}@example.invalid`;
      issued = await change.issue(cookieHeaders(session), { proposedEmail }, () => {});
    }
    const tokenId = kinds[kind][1] + createHash("sha256").update(issued.token).digest("hex");
    const intent = await database.outboxEvent.findFirst({ where: { accountId: account.accountId,
      eventType: kinds[kind][0], deduplicationKey: { endsWith: tokenId } }, select: { id: true } });
    return { ...issued, tokenId, intentId: intent.id, proposedEmail };
  };
  const consume = (kind, token) => kind === "verification" ? verification.consume(token) : kind === "reset"
    ? reset.consume({ token, newPassword: "synthetic-replacement-password-only" }) : change.consume(token);
  const assertStatus = async (id, status) => assert.deepEqual(await inspect(id), { status });
  const snapshot = () => database.outboxEvent.findMany({ orderBy: { id: "asc" }, select: {
    id: true, accountId: true, eventType: true, deduplicationKey: true, recipientEmail: true, createdAt: true, dispatchedAt: true,
  } });
  try {
    await t.test("signup intent owns its initial token and does not borrow a later resend token", async () => {
      const account = await fixture();
      const intent = await database.outboxEvent.findUnique({ where: { deduplicationKey: `signup-verification:${account.accountId}` }, select: { id: true } });
      const before = await database.verification.count();
      await assertStatus(intent.id, "TOKEN_CURRENT");
      assert.equal(await database.verification.count(), before);
      const issued = await issue("verification", account);
      await assertStatus(intent.id, "STALE");
      await verification.consume(issued.token);
      await assertStatus(intent.id, "STALE");
    });

    await t.test("all token kinds bind their intended private recipient and return only a fixed status", async () => {
      for (const kind of Object.keys(kinds)) {
        const account = await fixture(kind === "change");
        const issued = await issue(kind, account);
        const stored = await database.verification.findUnique({ where: { id: issued.tokenId }, select: { value: true } });
        if (kind === "change") assert.deepEqual(JSON.parse(stored.value), {
          accountId: account.accountId, currentEmail: account.email, proposedEmail: issued.proposedEmail,
        });
        else assert.equal(stored.value, account.email);
        const before = await snapshot();
        for (let attempt = 0; attempt < 2; attempt++) await assertStatus(issued.intentId, "TOKEN_CURRENT");
        assert.deepEqual(await snapshot(), before);
        assert.ok(!JSON.stringify(before).includes(issued.token));
        assert.ok(!JSON.stringify(before).includes(issued.proposedEmail ?? account.email));
      }
    });

    await t.test("superseded and consumed tokens are stale across all three token families", async () => {
      for (const kind of Object.keys(kinds)) {
        const account = await fixture(kind === "change");
        const old = await issue(kind, account);
        const replacement = await issue(kind, account);
        await assertStatus(old.intentId, "STALE");
        await assertStatus(replacement.intentId, "TOKEN_CURRENT");
        await consume(kind, replacement.token);
        await assertStatus(old.intentId, "STALE");
        await assertStatus(replacement.intentId, "STALE");
      }
    });

    await t.test("original expiry and future issuance are checked without shifting deadlines", async () => {
      for (const kind of Object.keys(kinds)) {
        const account = await fixture(kind === "change");
        const issued = await issue(kind, account);
        const savedNow = now;
        try {
          now = new Date(savedNow.getTime() - 1);
          await assertStatus(issued.intentId, "STALE");
          now = new Date(issued.expiresAt.getTime() - 1);
          await assertStatus(issued.intentId, "TOKEN_CURRENT");
          now = issued.expiresAt;
          await assertStatus(issued.intentId, "STALE");
        } finally { now = savedNow; }
        assert.equal((await database.verification.findUnique({ where: { id: issued.tokenId }, select: { expiresAt: true } })).expiresAt.getTime(), issued.expiresAt.getTime());
      }
    });

    await t.test("account reference cannot relabel another account's token; unrelated work survives", async () => {
      for (const kind of Object.keys(kinds)) {
        const owner = await fixture(kind === "change");
        const other = await fixture(kind === "change");
        const own = await issue(kind, owner);
        const unrelated = await issue(kind, other);
        await database.outboxEvent.update({ where: { id: own.intentId }, data: { accountId: other.accountId } });
        await assertStatus(own.intentId, "STALE");
        await assertStatus(unrelated.intentId, "TOKEN_CURRENT");
        await database.outboxEvent.update({ where: { id: own.intentId }, data: { accountId: owner.accountId } });
        await assertStatus(own.intentId, "TOKEN_CURRENT");
      }
    });

    await t.test("current address, deletion, verification and credential changes invalidate pending work", async () => {
      for (const kind of Object.keys(kinds)) {
        const account = await fixture(kind === "change");
        const issued = await issue(kind, account);
        await database.user.update({ where: { id: account.userId }, data: { email: `moved-${randomUUID()}@example.invalid` } });
        await assertStatus(issued.intentId, "STALE");
        await database.user.update({ where: { id: account.userId }, data: { email: account.email } });
        await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: now } });
        await assertStatus(issued.intentId, "STALE");
        await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: null } });
        if (kind === "verification") await database.user.update({ where: { id: account.userId }, data: { emailVerified: true } });
        else if (kind === "reset") await database.account.updateMany({ where: { userId: account.userId }, data: { password: null } });
        else await database.userAccount.update({ where: { id: account.accountId }, data: { emailVerifiedAt: null } });
        await assertStatus(issued.intentId, "STALE");
      }
    });

    await t.test("malformed and cross-account email-change bindings cannot become delivery candidates", async () => {
      const account = await fixture(true);
      const other = await fixture(true);
      const issued = await issue("change", account);
      const valid = { accountId: account.accountId, currentEmail: account.email, proposedEmail: issued.proposedEmail };
      for (const value of ["<script>private</script>", JSON.stringify({ ...valid, accountId: other.accountId }),
        JSON.stringify({ ...valid, currentEmail: other.email }), JSON.stringify({ ...valid, extra: "private" }),
        JSON.stringify({ ...valid, proposedEmail: "bad@example.invalid\r\nBcc:unrelated@example.invalid" })]) {
        await database.verification.update({ where: { id: issued.tokenId }, data: { value } });
        await assertStatus(issued.intentId, "STALE");
      }
      await database.verification.update({ where: { id: issued.tokenId }, data: { value: JSON.stringify(valid) } });
      await database.user.update({ where: { id: other.userId }, data: { email: issued.proposedEmail } });
      await assertStatus(issued.intentId, "STALE");
    });

    await t.test("old-address notice uses only its snapshot and never reads the new address", async () => {
      const account = await fixture(true);
      const issued = await issue("change", account);
      await change.consume(issued.token);
      const notice = await database.outboxEvent.findFirst({ where: { accountId: account.accountId,
        eventType: "account.email-changed-security-notice" }, select: { id: true, recipientEmail: true } });
      assert.equal(notice.recipientEmail, account.email);
      const restricted = createAccountEmailIntentInspector({ $transaction: (work) => database.$transaction((transaction) => work(new Proxy(transaction, {
        get(target, key) {
          if (["user", "userAccount", "verification", "$queryRaw"].includes(key)) assert.fail("Notice must not fetch new address or token binding");
          return Reflect.get(target, key);
        },
      }))) }, () => now);
      assert.deepEqual(await restricted(notice.id), { status: "NOTICE_RECORDED" });
      const before = await snapshot();
      assert.ok(!JSON.stringify(before).includes(issued.proposedEmail));
      await assertStatus(notice.id, "NOTICE_RECORDED");
      assert.deepEqual(await snapshot(), before);
      await database.outboxEvent.update({ where: { id: notice.id }, data: { recipientEmail: "old@example.invalid\r\nBcc:other@example.invalid" } });
      await assertStatus(notice.id, "STALE");
    });

    await t.test("missing, unknown version/type and dispatched records do not become current tokens", async () => {
      await assertStatus(randomUUID(), "MISSING");
      const account = await fixture();
      const issued = await issue("verification", account);
      await database.outboxEvent.update({ where: { id: issued.intentId }, data: { eventVersion: 2 } });
      await assertStatus(issued.intentId, "UNSUPPORTED");
      await database.outboxEvent.update({ where: { id: issued.intentId }, data: { eventVersion: 1, eventType: "constructor" } });
      await assertStatus(issued.intentId, "UNSUPPORTED");
      await database.outboxEvent.update({ where: { id: issued.intentId }, data: { eventType: kinds.verification[0], dispatchedAt: now } });
      await assertStatus(issued.intentId, "DISPATCH_RECORDED");
      await assert.rejects(createAccountEmailIntentInspector(database, () => new Date(NaN))((await issue("verification", account)).intentId), rejects("INTERNAL_ERROR"));
    });

    await t.test("issue commit failure preserves prior token/intent and inspection remains read-only", async () => {
      const account = await fixture();
      const original = await issue("verification", account);
      const before = await snapshot();
      await connection.query(`CREATE FUNCTION synthetic_intent_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic-private-recipient-token'; END $$`);
      await connection.query(`CREATE CONSTRAINT TRIGGER synthetic_intent_failure AFTER INSERT ON outbox_event
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION synthetic_intent_failure()`);
      try {
        await assert.rejects(verification.issue(account.email), (error) => error.code === "INTERNAL_ERROR" && error.cause === undefined);
        assert.deepEqual(await snapshot(), before);
        await assertStatus(original.intentId, "TOKEN_CURRENT");
      } finally { await connection.query("DROP TRIGGER synthetic_intent_failure ON outbox_event"); }
      const replacement = await issue("verification", account);
      await assertStatus(original.intentId, "STALE");
      await assertStatus(replacement.intentId, "TOKEN_CURRENT");
    });

    await t.test("expiry is reread after account and credential lock waits", async () => {
      for (const lock of ["account", "credential"]) {
        const account = await fixture();
        const issued = await issue("reset", account);
        const before = await snapshot();
        await connection.query("BEGIN");
        await connection.query(lock === "account"
          ? 'SELECT id FROM user_account WHERE id = $1 FOR UPDATE'
          : 'SELECT id FROM account WHERE "userId" = $1 FOR UPDATE',
        [lock === "account" ? account.accountId : account.userId]);
        const pending = inspect(issued.intentId);
        let waiting = false;
        try {
          for (let attempt = 0; attempt < 100; attempt++) {
            await connection.query("SELECT pg_stat_clear_snapshot()");
            const result = await connection.query(`SELECT 1 FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'
                AND query LIKE $1 AND pid <> pg_backend_pid()`,
            [lock === "account" ? '%FROM "user" u JOIN%' : '%FROM "account" WHERE%']);
            if (result.rowCount) { waiting = true; break; }
            await setTimeout(10);
          }
        } finally {
          now = issued.expiresAt;
          await connection.query("COMMIT");
        }
        assert.deepEqual(await pending, { status: "STALE" });
        assert.ok(waiting, `Inspection must wait for the ${lock} lock`);
        assert.deepEqual(await snapshot(), before);
      }
    });
  } finally { await sandbox.close(); }
});
