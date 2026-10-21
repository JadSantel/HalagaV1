import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { createEmailChangeOperations, EmailChangeRejected } from "../src/server/repositories/email-change.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createPasswordResetOperations } from "../src/server/repositories/password-reset.ts";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { createAccountAccessReader } from "../src/server/repositories/accounts.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

const namespace = "halaga-email-change:";
const tokenId = (token) => namespace + createHash("sha256").update(token).digest("hex");
const rejects = (code) => (error) => error instanceof EmailChangeRejected &&
  error.code === code && error.message === code && error.cause === undefined;
const proposed = () => `proposed-${randomUUID()}@example.invalid`;
const cookieHeaders = (result) => new Headers({ cookie: result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });

test("email change validates before auth/database and sanitizes unexpected failures", async () => {
  const noDatabase = { $transaction() { assert.fail("No database access"); } };
  const noAuth = { get api() { assert.fail("No auth access"); } };
  const operations = createEmailChangeOperations(noDatabase, noAuth);
  for (const input of [null, {}, { proposedEmail: "invalid" }, { proposedEmail: proposed(), accountId: randomUUID() }]) {
    await assert.rejects(operations.issue(new Headers(), input, () => {}), rejects("INVALID_INPUT"));
  }
  for (const input of [null, {}, "", "g".repeat(64), "a".repeat(65)]) {
    await assert.rejects(operations.consume(input), rejects("INVALID_TOKEN"));
  }
  const failing = createEmailChangeOperations(noDatabase, { api: { getSession() { throw new Error("synthetic-private-session"); } } });
  await assert.rejects(failing.issue(new Headers(), { proposedEmail: proposed() }, () => {}), rejects("INTERNAL_ERROR"));
});

test("isolated PostgreSQL email-change transactions", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  let now = new Date();
  const operations = createEmailChangeOperations(database, auth, () => now);
  const verification = createEmailVerificationOperations(database, () => now);
  const reset = createPasswordResetOperations(database, auth, () => now);
  const signup = createSignupOperation(database, auth, () => now);
  const password = "synthetic-email-change-password-only";
  const fixture = async (verified = true) => {
    now = new Date();
    const email = `change-${randomUUID()}@example.invalid`;
    await signup({ email, password, displayName: "Synthetic email change adult", dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    const identity = await database.user.findUnique({ where: { email }, select: { id: true } });
    const account = await database.userAccount.findUnique({ where: { authUserId: identity.id }, select: { id: true } });
    if (verified) await verification.consume((await verification.issue(email)).token);
    const signIn = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
    now = new Date();
    return { email, userId: identity.id, accountId: account.id, headers: cookieHeaders(signIn) };
  };
  const issue = (account, proposedEmail = proposed(), ops = operations) => ops.issue(account.headers, { proposedEmail }, () => {});
  const state = async ({ userId, accountId }) => ({
    identity: await database.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, updatedAt: true } }),
    account: await database.userAccount.findUnique({ where: { id: accountId }, select: { id: true, authUserId: true, displayName: true,
      adultEligibilityCheckedAt: true, adultAttestedAt: true, adultAttestationVersion: true, emailVerifiedAt: true, deletedAt: true, createdAt: true, updatedAt: true } }),
    credentials: await database.account.findMany({ where: { userId }, orderBy: { id: "asc" }, select: { id: true, userId: true, accountId: true, password: true, updatedAt: true } }),
    sessions: await database.session.findMany({ where: { userId }, orderBy: { id: "asc" }, select: { id: true, userId: true, createdAt: true, updatedAt: true, expiresAt: true } }),
    tokens: await database.verification.findMany({ where: { identifier: { in: [namespace + userId, "halaga-email-verification:" + userId, "halaga-password-reset:" + userId] } },
      orderBy: { id: "asc" }, select: { id: true, identifier: true, value: true, createdAt: true, updatedAt: true, expiresAt: true } }),
    intents: await database.outboxEvent.findMany({ where: { accountId }, orderBy: { deduplicationKey: "asc" }, select: {
      accountId: true, eventType: true, eventVersion: true, deduplicationKey: true, recipientEmail: true, createdAt: true, dispatchedAt: true } }),
  });
  const changeTokens = (snapshot) => snapshot.tokens.filter((row) => row.identifier.startsWith(namespace));
  const noticeIntents = (snapshot) => snapshot.intents.filter((row) => row.eventType === "account.email-changed-security-notice");
  const assertHistory = (before, after) => {
    assert.deepEqual(after.credentials, before.credentials);
    const { emailVerifiedAt: beforeVerified, updatedAt: beforeUpdated, ...beforeHistory } = before.account;
    const { emailVerifiedAt: afterVerified, updatedAt: afterUpdated, ...afterHistory } = after.account;
    assert.ok(beforeVerified && afterVerified && beforeUpdated && afterUpdated);
    assert.deepEqual(afterHistory, beforeHistory);
    assert.equal(after.identity.id, before.identity.id);
    assert.equal(after.identity.name, before.identity.name);
    assert.deepEqual(after.identity.createdAt, before.identity.createdAt);
    assert.deepEqual(after.tokens.filter((row) => !row.identifier.startsWith(namespace)), before.tokens.filter((row) => !row.identifier.startsWith(namespace)));
    assert.deepEqual(after.intents.filter((row) => row.eventType !== "account.email-changed-security-notice"), before.intents);
  };
  const injectFailure = async (table, timing, action, deferred, work) => {
    await connection.query(`CREATE ${deferred ? "CONSTRAINT " : ""}TRIGGER synthetic_failure ${timing} ${action} ON "${table}" ${deferred} FOR EACH ROW EXECUTE FUNCTION synthetic_change_failure()`);
    try { await work(); } finally { await connection.query(`DROP TRIGGER synthetic_failure ON "${table}"`); }
  };
  try {
    await connection.query(`CREATE FUNCTION synthetic_change_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic-private-email-change-error'; END $$`);

    await t.test("request preserves primary verification; proof switches once, preserves history and other tokens, revokes sessions and snapshots only old recipient", async () => {
      const account = await fixture();
      const unrelated = await fixture();
      const unrelatedBefore = await state(unrelated);
      // Preserve unrelated token families, even stale verification work on a verified identity.
      await database.verification.create({ data: { id: randomUUID(), identifier: "halaga-email-verification:" + account.userId,
        value: account.email, expiresAt: new Date(now.getTime() + 86400000) } });
      await reset.issue(account.email);
      await auth.api.signInEmail({ body: { email: account.email, password } });
      await database.session.create({ data: { id: randomUUID(), userId: account.userId, token: randomUUID(), expiresAt: new Date(now.getTime() - 1) } });
      now = new Date();
      const old = await state(account);
      const nextEmail = proposed();
      let responseHeaders;
      const issued = await operations.issue(account.headers, { proposedEmail: nextEmail.toUpperCase() }, (headers) => { responseHeaders = headers; });
      assert.ok(responseHeaders instanceof Headers);
      assert.equal(issued.expiresAt.getTime() - now.getTime(), 86400000);
      const before = await state(account);
      assert.deepEqual(before.identity, old.identity);
      assert.deepEqual(before.account, old.account);
      assert.deepEqual(before.sessions, old.sessions);
      const token = changeTokens(before)[0];
      assert.equal(token.id, tokenId(issued.token));
      assert.deepEqual(JSON.parse(token.value), { accountId: account.accountId, currentEmail: account.email, proposedEmail: nextEmail });
      assert.ok(!JSON.stringify(before).includes(issued.token));
      const intent = before.intents.find((row) => row.eventType === "account.email-change-verification-requested");
      assert.equal(intent.deduplicationKey, `email-change-verification:${token.id}`);
      assert.equal(intent.recipientEmail, null);
      assert.ok(!JSON.stringify(before.intents).includes(nextEmail));
      assert.ok(!JSON.stringify(before.intents).includes(account.email));
      const reader = createAccountAccessReader(auth, database);
      assert.equal((await reader(account.headers, () => {})).emailVerified, true);
      now = new Date();
      assert.deepEqual(await operations.consume(issued.token), { status: "EMAIL_CHANGED" });
      const after = await state(account);
      assertHistory(before, after);
      assert.equal(after.identity.email, nextEmail);
      assert.equal(after.identity.emailVerified, true);
      assert.equal(after.account.emailVerifiedAt.getTime(), now.getTime());
      assert.equal(after.sessions.length, 0);
      assert.equal(changeTokens(after).length, 0);
      assert.deepEqual(noticeIntents(after), [{ accountId: account.accountId, eventType: "account.email-changed-security-notice", eventVersion: 1,
        deduplicationKey: `email-changed-notice:${token.id}`, recipientEmail: account.email, createdAt: now, dispatchedAt: null }]);
      assert.ok(!JSON.stringify(after.intents).includes(nextEmail));
      assert.equal(await reader(account.headers, () => {}), null);
      await assert.rejects(auth.api.signInEmail({ body: { email: account.email, password } }));
      const fresh = await auth.api.signInEmail({ body: { email: nextEmail, password }, returnHeaders: true });
      assert.equal(fresh.response.user.emailVerified, true);
      assert.equal((await reader(cookieHeaders(fresh), () => {})).emailVerified, true);
      const committed = await state(account);
      await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
      assert.deepEqual(await state(account), committed);
      assert.deepEqual(await state(unrelated), unrelatedBefore);
    });

    await t.test("expiry at 24 hours, future issue and unknown token preserve old state; last millisecond succeeds", async () => {
      const account = await fixture();
      const issued = await issue(account);
      const before = await state(account);
      const savedNow = now;
      try {
        for (const instant of [issued.expiresAt.getTime(), issued.expiresAt.getTime() + 1, now.getTime() - 1]) {
          now = new Date(instant);
          await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
          assert.deepEqual(await state(account), before);
        }
        now = savedNow;
        await assert.rejects(operations.consume("a".repeat(64)), rejects("INVALID_TOKEN"));
        now = new Date(issued.expiresAt.getTime() - 1);
        await operations.consume(issued.token);
      } finally { now = savedNow; }
    });

    await t.test("new request supersedes only previous change token and gives a full 24 hours", async () => {
      const account = await fixture();
      const first = await issue(account);
      now = new Date(now.getTime() + 60000);
      const secondAddress = proposed();
      const second = await issue(account, secondAddress);
      assert.equal(second.expiresAt.getTime() - now.getTime(), 86400000);
      const before = await state(account);
      assert.equal(changeTokens(before).length, 1);
      await assert.rejects(operations.consume(first.token), rejects("INVALID_TOKEN"));
      assert.deepEqual(await state(account), before);
      await operations.consume(second.token);
      assert.equal((await state(account)).identity.email, secondAddress);
    });

    await t.test("session ownership, exact freshness, future creation, expiry, renewal and revocation fail closed", async () => {
      const account = await fixture();
      const session = await database.session.findFirst({ where: { userId: account.userId }, select: { id: true, createdAt: true, expiresAt: true } });
      const savedNow = now;
      try {
        for (const age of [900000, 900001, -1]) {
          now = new Date(session.createdAt.getTime() + age);
          await database.session.update({ where: { id: session.id }, data: { updatedAt: now } });
          const before = await state(account);
          await assert.rejects(issue(account), rejects("UNAUTHORIZED"));
          assert.deepEqual(await state(account), before);
        }
        now = new Date(session.createdAt.getTime() + 899999);
        const issued = await issue(account);
        await operations.consume(issued.token); // No fresh session needed to prove the proposed address.
        await assert.rejects(issue(account), rejects("UNAUTHORIZED"));
      } finally { now = savedNow; }
      await assert.rejects(operations.issue(new Headers(), { proposedEmail: proposed() }, () => {}), rejects("UNAUTHORIZED"));
      const expired = await fixture();
      await database.session.updateMany({ where: { userId: expired.userId }, data: { expiresAt: now } });
      const tokenCount = await database.verification.count({ where: { identifier: namespace + expired.userId } });
      await assert.rejects(issue(expired), rejects("UNAUTHORIZED"));
      assert.equal(await database.verification.count({ where: { identifier: namespace + expired.userId } }), tokenCount);
      const owner = await fixture();
      const other = await fixture();
      const before = await state(other);
      await assert.rejects(operations.issue(owner.headers, { proposedEmail: proposed(), accountId: other.accountId }, () => {}), rejects("INVALID_INPUT"));
      assert.deepEqual(await state(other), before);
    });

    await t.test("each request write and deferred commit failure preserves prior token and all state; replacement retry succeeds", async () => {
      const account = await fixture();
      let issued = await issue(account);
      for (const failure of [["verification", "BEFORE", "DELETE", ""], ["verification", "BEFORE", "INSERT", ""],
        ["outbox_event", "BEFORE", "INSERT", ""], ["outbox_event", "AFTER", "INSERT", "DEFERRABLE INITIALLY DEFERRED"]]) {
        const before = await state(account);
        await injectFailure(...failure, async () => {
          await assert.rejects(issue(account), rejects("INTERNAL_ERROR"));
          assert.deepEqual(await state(account), before);
        });
        const replacement = await issue(account);
        await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
        issued = replacement;
      }
      await operations.consume(issued.token);
    });

    await t.test("each completion write and commit failure rolls back switch, notice and revocation; same-token retry succeeds", async () => {
      for (const failure of [["verification", "BEFORE", "DELETE", ""], ["user", "BEFORE", "UPDATE", ""],
        ["user_account", "BEFORE", "UPDATE", ""], ["session", "BEFORE", "DELETE", ""],
        ["outbox_event", "BEFORE", "INSERT", ""], ["outbox_event", "AFTER", "INSERT", "DEFERRABLE INITIALLY DEFERRED"]]) {
        const account = await fixture();
        const nextEmail = proposed();
        const issued = await issue(account, nextEmail);
        const before = await state(account);
        await injectFailure(...failure, async () => {
          await assert.rejects(operations.consume(issued.token), rejects("INTERNAL_ERROR"));
          assert.deepEqual(await state(account), before);
        });
        await auth.api.signInEmail({ body: { email: account.email, password } });
        await operations.consume(issued.token);
        const after = await state(account);
        assertHistory(before, after);
        assert.equal(after.identity.email, nextEmail);
        assert.equal(after.sessions.length, 0);
        assert.equal(noticeIntents(after).length, 1);
      }
    });

    await t.test("same/current and occupied proposed addresses reject without replacing prior pending work; late conflict is retryable", async () => {
      const account = await fixture();
      const other = await fixture();
      const issued = await issue(account);
      const before = await state(account);
      for (const address of [account.email, account.email.toUpperCase(), other.email]) {
        await assert.rejects(issue(account, address), rejects("INVALID_STATE"));
        assert.deepEqual(await state(account), before);
      }
      const target = JSON.parse(changeTokens(before)[0].value).proposedEmail;
      await database.user.update({ where: { id: other.userId }, data: { email: target } });
      const conflict = await state(other);
      await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
      assert.deepEqual(await state(account), before);
      assert.deepEqual(await state(other), conflict);
      await database.user.update({ where: { id: other.userId }, data: { email: other.email } });
      await operations.consume(issued.token);
    });

    await t.test("deleted, missing, remapped and ineligible accounts reject requests and proof without repairs", async () => {
      for (const change of ["deleted", "missing-account", "missing-identity", "remapped", "no-age-check", "future-age-check", "no-attestation", "future-attestation", "unverified", "no-domain-verification", "future-verification", "current-address"]) {
        const account = await fixture();
        const issued = await issue(account);
        if (change === "deleted") await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: now } });
        if (["missing-account", "missing-identity", "remapped"].includes(change)) {
          await database.outboxEvent.deleteMany({ where: { accountId: account.accountId } });
          await database.userAccount.delete({ where: { id: account.accountId } });
          if (change === "missing-identity") await database.user.delete({ where: { id: account.userId } });
          if (change === "remapped") await database.userAccount.create({ data: { authUserId: account.userId, displayName: "Synthetic remapping",
            adultEligibilityCheckedAt: now, adultAttestedAt: now, emailVerifiedAt: now } });
        }
        if (change === "no-age-check") await database.userAccount.update({ where: { id: account.accountId }, data: { adultEligibilityCheckedAt: null } });
        if (change === "future-age-check") await database.userAccount.update({ where: { id: account.accountId }, data: { adultEligibilityCheckedAt: new Date(now.getTime() + 1) } });
        if (change === "no-attestation") await database.userAccount.update({ where: { id: account.accountId }, data: { adultAttestedAt: null } });
        if (change === "future-attestation") await database.userAccount.update({ where: { id: account.accountId }, data: { adultAttestedAt: new Date(now.getTime() + 1) } });
        if (change === "unverified") await database.user.update({ where: { id: account.userId }, data: { emailVerified: false } });
        if (change === "no-domain-verification") await database.userAccount.update({ where: { id: account.accountId }, data: { emailVerifiedAt: null } });
        if (change === "future-verification") await database.userAccount.update({ where: { id: account.accountId }, data: { emailVerifiedAt: new Date(now.getTime() + 1) } });
        if (change === "current-address") await database.user.update({ where: { id: account.userId }, data: { email: proposed() } });
        const before = await state(account);
        await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
        assert.deepEqual(await state(account), before);
        // Remapping/current-address can issue NEW valid work; existing proof stays pinned.
        if (!["remapped", "current-address"].includes(change)) {
          await assert.rejects(issue(account), (error) => rejects("INVALID_STATE")(error) || rejects("UNAUTHORIZED")(error));
          assert.deepEqual(await state(account), before);
        }
      }
      const account = await fixture(false);
      const before = await state(account);
      await assert.rejects(issue(account), rejects("INVALID_STATE"));
      assert.deepEqual(await state(account), before);
    });

    await t.test("malformed private bindings, changed target to current address and token-family confusion fail closed", async () => {
      const account = await fixture();
      const issued = await issue(account);
      const token = changeTokens(await state(account))[0];
      const binding = JSON.parse(token.value);
      for (const value of ["not-json", "null", JSON.stringify({ ...binding, extra: "private" }),
        JSON.stringify({ ...binding, accountId: randomUUID() }), JSON.stringify({ ...binding, proposedEmail: "invalid" }),
        JSON.stringify({ ...binding, proposedEmail: account.email }), JSON.stringify({ ...binding, proposedEmail: binding.proposedEmail.toUpperCase() })]) {
        await database.verification.update({ where: { id: token.id }, data: { value } });
        const before = await state(account);
        await assert.rejects(operations.consume(issued.token), rejects("INVALID_TOKEN"));
        assert.deepEqual(await state(account), before);
      }
      await database.verification.update({ where: { id: token.id }, data: { value: token.value } });
      const resetToken = await reset.issue(account.email);
      await assert.rejects(operations.consume(resetToken.token), rejects("INVALID_TOKEN"));
      await operations.consume(issued.token);
    });

    await t.test("concurrent requests leave one token; concurrent proof switches once and records one old-address notice", async () => {
      const account = await fixture();
      const addresses = Array.from({ length: 4 }, proposed);
      const issued = await Promise.all(addresses.map((address) => issue(account, address)));
      const before = await state(account);
      assert.equal(changeTokens(before).length, 1);
      const winner = issued.findIndex((result) => tokenId(result.token) === changeTokens(before)[0].id);
      for (const result of issued.filter((_, index) => index !== winner)) await assert.rejects(operations.consume(result.token), rejects("INVALID_TOKEN"));
      const results = await Promise.allSettled(Array.from({ length: 4 }, () => operations.consume(issued[winner].token)));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      for (const result of results.filter((result) => result.status === "rejected")) assert.ok(rejects("INVALID_TOKEN")(result.reason));
      const after = await state(account);
      assertHistory(before, after);
      assert.equal(after.identity.email, addresses[winner]);
      assert.equal(after.sessions.length, 0);
      assert.equal(changeTokens(after).length, 0);
      assert.equal(noticeIntents(after).length, 1);
    });

    await t.test("requests racing proof have serialized outcomes and cannot use a revoked session", async () => {
      for (let iteration = 0; iteration < 3; iteration++) {
        const account = await fixture();
        const first = await issue(account);
        const [requested, consumed] = await Promise.allSettled([issue(account), operations.consume(first.token)]);
        const after = await state(account);
        if (consumed.status === "fulfilled") {
          assert.equal(requested.status, "rejected");
          assert.ok(rejects("UNAUTHORIZED")(requested.reason));
          assert.equal(changeTokens(after).length, 0);
          assert.equal(after.sessions.length, 0);
          assert.equal(noticeIntents(after).length, 1);
        } else {
          assert.ok(rejects("INVALID_TOKEN")(consumed.reason));
          assert.equal(requested.status, "fulfilled");
          assert.equal(changeTokens(after)[0].id, tokenId(requested.value.token));
          assert.equal(after.identity.email, account.email);
          await operations.consume(requested.value.token);
        }
      }
    });

    await t.test("two accounts racing the same proposed address commit one switch; losing token and sessions survive for retry", async () => {
      const accounts = [await fixture(), await fixture()];
      const target = proposed();
      const issued = await Promise.all(accounts.map((account) => issue(account, target)));
      const before = await Promise.all(accounts.map(state));
      const results = await Promise.allSettled(issued.map((result) => operations.consume(result.token)));
      const winner = results.findIndex((result) => result.status === "fulfilled");
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const loser = 1 - winner;
      assert.ok(rejects("INVALID_TOKEN")(results[loser].reason));
      assert.deepEqual(await state(accounts[loser]), before[loser]);
      await database.user.update({ where: { id: accounts[winner].userId }, data: { email: proposed() } });
      await operations.consume(issued[loser].token);
      assert.equal((await state(accounts[loser])).identity.email, target);
    });

    await t.test("stored session is reread after resolution and freshness/expiry are checked after lock waits", async () => {
      for (const change of ["revoke", "expire", "stale", "token", "owner"]) {
        const account = await fixture();
        const other = await fixture();
        const delayed = createEmailChangeOperations(database, { api: { async getSession(options) {
          const result = await auth.api.getSession(options);
          const id = result.response.session.id;
          if (change === "revoke") await database.session.delete({ where: { id } });
          if (change === "expire") await database.session.update({ where: { id }, data: { expiresAt: now } });
          if (change === "stale") now = new Date(result.response.session.createdAt.getTime() + 900000);
          if (change === "token") await database.session.update({ where: { id }, data: { token: randomUUID() } });
          if (change === "owner") await database.session.update({ where: { id }, data: { userId: other.userId } });
          return result;
        } } }, () => now);
        await assert.rejects(issue(account, proposed(), delayed), rejects("UNAUTHORIZED"));
        assert.equal(changeTokens(await state(account)).length, 0);
      }
      // Hold the actual domain lock while consume resolves its token, then advance time.
      const account = await fixture();
      const issued = await issue(account);
      const before = await state(account);
      await connection.query("BEGIN");
      await connection.query('SELECT id FROM "user_account" WHERE id = $1 FOR UPDATE', [account.accountId]);
      const pending = operations.consume(issued.token);
      const rejected = assert.rejects(pending, rejects("INVALID_TOKEN"));
      let waiting = false;
      try {
        for (let attempt = 0; attempt < 100; attempt++) {
          await connection.query("SELECT pg_stat_clear_snapshot()");
          const result = await connection.query(`SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM "user" u JOIN%'
              AND pid <> pg_backend_pid()`);
          if (result.rowCount) { waiting = true; break; }
          await setTimeout(10);
        }
      } finally {
        now = issued.expiresAt;
        await connection.query("COMMIT");
      }
      await rejected;
      assert.ok(waiting, "Consume must actually wait for the account lock before expiry advances");
      assert.deepEqual(await state(account), before);
    });

    await t.test("schema restricts recipient snapshots to security notices and requires their old-address recipient", async () => {
      const account = await fixture();
      for (const data of [{ eventType: "account.email-change-verification-requested", recipientEmail: proposed() },
        { eventType: "account.email-changed-security-notice", recipientEmail: null }]) {
        await assert.rejects(database.outboxEvent.create({ data: { accountId: account.accountId, eventVersion: 1,
          deduplicationKey: randomUUID(), ...data }, select: { id: true } }));
      }
      assert.equal(noticeIntents(await state(account)).length, 0);
    });
  } finally { await sandbox.close(); }
});
