import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { createSignupOperation } from "../src/server/repositories/signup.ts";
import { createEmailVerificationOperations } from "../src/server/repositories/email-verification.ts";
import { createPasswordResetOperations } from "../src/server/repositories/password-reset.ts";
import { createEmailChangeOperations } from "../src/server/repositories/email-change.ts";
import { createAccountEmailDispatcher } from "../src/server/repositories/account-email-dispatch.ts";
import { runAccountEmailJob } from "../src/server/repositories/account-email-worker.ts";
import { BrevoSendError, sendBrevoEmail } from "../src/server/account-email-provider.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";

const password = "synthetic-delivery-password-only";
const cookieHeaders = (result) => new Headers({ cookie: result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
const actionToken = (message) => new URL(message.text.match(/https?:\/\/\S+#token=[a-f0-9]+/)[0]).hash.slice(7);

test("provider is disabled even with credentials and malformed success is ambiguous (fake fetch only)", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.ACCOUNT_EMAIL_SENDING_ENABLED;
    process.env.BREVO_API_KEY = "synthetic-provider-key";
    process.env.HALAGA_EMAIL_FROM = "sender@example.invalid";
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({}); };
    const message = { to: "recipient@example.invalid", subject: "Synthetic", text: "Synthetic", html: "Synthetic" };
    await assert.rejects(sendBrevoEmail(message), (error) => error.category === "REJECTED");
    assert.equal(calls, 0);
    process.env.ACCOUNT_EMAIL_SENDING_ENABLED = "true";
    await assert.rejects(sendBrevoEmail(message), (error) => error.category === "AMBIGUOUS");
    assert.equal(calls, 1);
  } finally { process.env = saved; globalThis.fetch = originalFetch; }
});

test("durable account-email runtime with synthetic accounts and a fake provider", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  const savedOrigin = process.env.HALAGA_PUBLIC_ORIGIN;
  process.env.HALAGA_PUBLIC_ORIGIN = "http://127.0.0.1:3000";
  let now = new Date();
  const verification = createEmailVerificationOperations(database, () => now);
  const reset = createPasswordResetOperations(database, auth, () => now);
  const change = createEmailChangeOperations(database, auth, () => now);
  const messages = [];
  const fake = async (message) => { messages.push(message); return `synthetic-${messages.length}`; };
  const dispatcher = createAccountEmailDispatcher(database, fake, () => now);
  const fixture = async (verified = false) => {
    now = new Date();
    const email = `delivery-${randomUUID()}@example.invalid`;
    await createSignupOperation(database, auth, () => now)({ email, password, displayName: "Synthetic adult",
      dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
    const user = await database.user.findUnique({ where: { email }, select: { id: true } });
    const account = await database.userAccount.findUnique({ where: { authUserId: user.id }, select: { id: true } });
    const event = await database.outboxEvent.findUnique({ where: { deduplicationKey: `signup-verification:${account.id}` }, select: { id: true } });
    now = new Date();
    if (verified) {
      await database.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      await database.userAccount.update({ where: { id: account.id }, data: { emailVerifiedAt: now } });
      await database.outboxEvent.delete({ where: { id: event.id } });
    }
    return { email, userId: user.id, accountId: account.id, eventId: event.id };
  };
  const job = () => database.accountEmailDelivery.findFirst({ orderBy: { createdAt: "desc" } });
  const run = (name, check) => t.test(name, async () => {
    await database.outboxEvent.deleteMany();
    messages.length = 0;
    now = new Date();
    await check();
  });
  try {
    await run("signup delivery, verification, reset, email proof and immutable old-address notice complete end to end", async () => {
      const owner = await fixture();
      assert.deepEqual(await runAccountEmailJob(dispatcher), { status: "ACCEPTED" });
      assert.equal(messages[0].to, owner.email);
      assert.ok(messages[0].text.includes("/account/verify-email#token="));
      assert.deepEqual(await verification.consume(actionToken(messages[0])), { status: "EMAIL_VERIFIED" });
      await assert.rejects(verification.consume(actionToken(messages[0])), { code: "INVALID_TOKEN" });
      await reset.issue(owner.email);
      now = new Date();
      assert.deepEqual(await runAccountEmailJob(dispatcher), { status: "ACCEPTED" });
      const resetToken = actionToken(messages[1]);
      await reset.consume({ token: resetToken, newPassword: password });
      await assert.rejects(reset.consume({ token: resetToken, newPassword: password }), { code: "INVALID_TOKEN" });
      const session = await auth.api.signInEmail({ body: { email: owner.email, password }, returnHeaders: true });
      now = new Date();
      const proposedEmail = `new-${randomUUID()}@example.invalid`;
      await change.issue(cookieHeaders(session), { proposedEmail }, () => {});
      now = new Date();
      assert.deepEqual(await runAccountEmailJob(dispatcher), { status: "ACCEPTED" });
      assert.equal(messages[2].to, proposedEmail);
      await change.consume(actionToken(messages[2]));
      await assert.rejects(change.consume(actionToken(messages[2])), { code: "INVALID_TOKEN" });
      now = new Date();
      assert.deepEqual(await runAccountEmailJob(dispatcher), { status: "ACCEPTED" });
      assert.equal(messages[3].to, owner.email);
      assert.ok(!messages[3].text.includes(proposedEmail));
      assert.ok(!messages[3].text.includes("#token="));
      assert.equal(await database.session.count({ where: { userId: owner.userId } }), 0);
      assert.equal((await database.user.findUnique({ where: { id: owner.userId } })).email, proposedEmail);
      assert.equal(await database.accountEmailDelivery.count({ where: { state: "ACCEPTED" } }), 4);
      assert.ok((await database.accountEmailDelivery.findMany()).every((row) => row.ciphertext.length === 0));
      assert.deepEqual(await runAccountEmailJob(dispatcher), { status: "EMPTY" });
      assert.equal(messages.length, 4);
    });

    await run("default sending-disabled runtime still recovers leases without consuming READY work", async () => {
      await fixture();
      const saved = process.env.ACCOUNT_EMAIL_SENDING_ENABLED;
      delete process.env.ACCOUNT_EMAIL_SENDING_ENABLED;
      try {
        assert.deepEqual(await runAccountEmailJob(createAccountEmailDispatcher(database, undefined, () => now)), { status: "DISABLED" });
        assert.equal((await job()).state, "READY");
        assert.equal((await job()).attemptCount, 0);
      } finally {
        if (saved === undefined) delete process.env.ACCOUNT_EMAIL_SENDING_ENABLED;
        else process.env.ACCOUNT_EMAIL_SENDING_ENABLED = saved;
      }
    });

    await run("replacement suppresses its token family and consumed/deleted/address-stale work never sends", async () => {
      const owner = await fixture();
      const issued = await verification.issue(owner.email);
      assert.equal((await database.accountEmailDelivery.findUnique({ where: { outboxEventId: owner.eventId } })).state, "SUPPRESSED");
      now = new Date();
      await verification.consume(issued.token);
      assert.deepEqual(await dispatcher.dispatchOne(), { status: "SUPPRESSED" });
      assert.equal(messages.length, 0);
      await reset.issue(owner.email);
      await database.userAccount.update({ where: { id: owner.accountId }, data: { deletedAt: now } });
      now = new Date();
      assert.deepEqual(await dispatcher.dispatchOne(), { status: "SUPPRESSED" });
      await database.userAccount.update({ where: { id: owner.accountId }, data: { deletedAt: null } });
      await reset.issue(owner.email);
      await database.user.update({ where: { id: owner.userId }, data: { email: `different-${randomUUID()}@example.invalid` } });
      now = new Date();
      assert.deepEqual(await dispatcher.dispatchOne(), { status: "SUPPRESSED" });
      assert.equal(messages.length, 0);
    });

    await run("concurrent workers send one logical job once", async () => {
      await fixture();
      const results = await Promise.all([dispatcher.dispatchOne(), dispatcher.dispatchOne()]);
      assert.deepEqual(results.map((result) => result.status).sort(), ["ACCEPTED", "EMPTY"]);
      assert.equal(messages.length, 1);
    });

    await run("429 retries use original expiry, 30/60/120/240 second backoff and stop after five attempts", async () => {
      await fixture();
      let attempts = 0;
      const limited = createAccountEmailDispatcher(database, async () => { attempts++; throw new BrevoSendError("RATE_LIMIT"); }, () => now);
      const originalExpiry = (await job()).expiresAt;
      for (let attempt = 1; attempt <= 5; attempt++) {
        const before = now;
        assert.equal((await runAccountEmailJob(limited)).status, attempt === 5 ? "FAILED" : "RETRY_SCHEDULED");
        const current = await job();
        assert.equal(current.attemptCount, attempt);
        assert.deepEqual(current.expiresAt, originalExpiry);
        if (attempt < 5) {
          assert.equal(current.availableAt.getTime() - before.getTime(), 30_000 * 2 ** (attempt - 1));
          assert.deepEqual(await limited.dispatchOne(), { status: "EMPTY" });
          now = current.availableAt;
        }
      }
      assert.deepEqual(await runAccountEmailJob(limited), { status: "EMPTY" });
      assert.equal(attempts, 5);
    });

    await run("expired LEASED work recovers, exhausted leases fail, expired SENDING is quarantined without resend", async () => {
      await fixture();
      let current = await job();
      await database.accountEmailDelivery.update({ where: { id: current.id }, data: { state: "LEASED",
        leaseId: randomUUID(), leaseExpiresAt: new Date(now.getTime() - 1), attemptCount: 1 } });
      assert.deepEqual(await runAccountEmailJob(dispatcher), { status: "ACCEPTED" });
      assert.equal((await job()).attemptCount, 2);
      await database.outboxEvent.deleteMany();
      await fixture();
      current = await job();
      await database.accountEmailDelivery.update({ where: { id: current.id }, data: { state: "LEASED",
        leaseId: randomUUID(), leaseExpiresAt: new Date(now.getTime() - 1), attemptCount: 5 } });
      assert.deepEqual(await runAccountEmailJob(dispatcher), { status: "EMPTY" });
      assert.equal((await job()).state, "FAILED");
      await database.outboxEvent.deleteMany();
      await fixture();
      current = await job();
      await database.accountEmailDelivery.update({ where: { id: current.id }, data: { state: "SENDING",
        leaseId: randomUUID(), leaseExpiresAt: new Date(now.getTime() - 1), attemptCount: 1 } });
      assert.deepEqual(await runAccountEmailJob(dispatcher), { status: "EMPTY" });
      assert.equal((await job()).state, "UNKNOWN");
      assert.equal(messages.length, 1);
    });

    await run("definite rejection fails and ambiguous sends never retry", async () => {
      for (const category of ["REJECTED", "AMBIGUOUS"]) {
        await database.outboxEvent.deleteMany();
        await fixture();
        let attempts = 0;
        const failing = createAccountEmailDispatcher(database, async () => { attempts++; throw new BrevoSendError(category); }, () => now);
        assert.equal((await failing.dispatchOne()).status, category === "REJECTED" ? "FAILED" : "UNKNOWN");
        now = new Date(now.getTime() + 120_001);
        assert.deepEqual(await runAccountEmailJob(failing), { status: "EMPTY" });
        assert.equal(attempts, 1);
      }
    });

    await run("expired ciphertext/tokens are erased and terminal outbox metadata purges after 30 days", async () => {
      await fixture();
      now = (await job()).expiresAt;
      assert.deepEqual(await runAccountEmailJob(dispatcher), { status: "EMPTY" });
      assert.equal((await job()).state, "SUPPRESSED");
      assert.equal((await job()).ciphertext.length, 0);
      assert.equal(await database.verification.count({ where: { expiresAt: { lte: now } } }), 0);
      now = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await dispatcher.recoverAndClean();
      assert.equal(await database.outboxEvent.count(), 0);
      assert.equal(await database.accountEmailDelivery.count(), 0);
      assert.equal(messages.length, 0);
    });

    await run("late provider acknowledgement cannot overwrite crash quarantine or dispatch again", async () => {
      await fixture();
      let release;
      let started;
      const sending = new Promise((resolve) => { started = resolve; });
      const paused = createAccountEmailDispatcher(database, async (message) => {
        messages.push(message);
        started();
        return new Promise((resolve) => { release = () => resolve("synthetic-late-accept"); });
      }, () => now);
      const pending = paused.dispatchOne();
      await sending;
      now = new Date(now.getTime() + 120_001);
      await dispatcher.recoverAndClean();
      assert.equal((await job()).state, "UNKNOWN");
      release();
      assert.deepEqual(await pending, { status: "UNKNOWN" });
      assert.equal((await job()).state, "UNKNOWN");
      assert.equal(await database.outboxEvent.count({ where: { dispatchedAt: { not: null } } }), 0);
      assert.deepEqual(await runAccountEmailJob(paused), { status: "EMPTY" });
      assert.equal(messages.length, 1);
    });

    await run("corrupt private ciphertext fails closed with fixed diagnostics and no provider call", async () => {
      await fixture();
      const current = await job();
      const bytes = Uint8Array.from(current.ciphertext);
      bytes[bytes.length - 1] ^= 1;
      await database.accountEmailDelivery.update({ where: { id: current.id }, data: { ciphertext: bytes } });
      assert.deepEqual(await dispatcher.dispatchOne(), { status: "FAILED" });
      assert.equal((await job()).lastErrorCode, "PREPARATION_FAILED");
      assert.equal((await job()).ciphertext.length, 0);
      assert.equal(messages.length, 0);
    });

    await run("lease expiry during account-lock wait fences the old worker", async () => {
      const owner = await fixture();
      await connection.query("BEGIN");
      await connection.query('SELECT id FROM "user" WHERE id = $1 FOR UPDATE', [owner.userId]);
      try {
        const pending = dispatcher.dispatchOne();
        for (let poll = 0; poll < 100; poll++) {
          if ((await job()).state === "LEASED") break;
          await setTimeout(10);
        }
        assert.equal((await job()).state, "LEASED");
        now = new Date(now.getTime() + 120_001);
        await dispatcher.recoverAndClean();
        await connection.query("COMMIT");
        assert.deepEqual(await pending, { status: "LEASE_LOST" });
        assert.equal(messages.length, 0);
        assert.equal((await job()).state, "READY");
        assert.deepEqual(await dispatcher.dispatchOne(), { status: "ACCEPTED" });
        assert.equal(messages.length, 1);
      } finally { await connection.query("ROLLBACK"); }
    });
  } finally {
    if (savedOrigin === undefined) delete process.env.HALAGA_PUBLIC_ORIGIN;
    else process.env.HALAGA_PUBLIC_ORIGIN = savedOrigin;
    await sandbox.close();
  }
});
