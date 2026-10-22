import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { defineGuardedCommand, CommandRejected } from "../src/server/guarded-command.ts";
import { defineAtomicPublicationDecision } from "../src/server/atomic-publication-decision.ts";
import { randomUUID } from "node:crypto";
import { openLocalDatabase } from "../scripts/local-database.mjs";

test("synthetic guarded command validates, checks actor/state and writes atomically", async (t) => {
  const client = await openLocalDatabase();
  const phases = [];
  const lines = [];
  const originalError = console.error;
  let failRelatedWrite = false;
  // These identities and ownership rules exist only in this synthetic test.
  const actors = new Map([["owner-session", "synthetic-owner"], ["other-session", "synthetic-other"]]);
  const input = { id: 1, title: "SyntheticPrivateListing-title", body: "SyntheticRestrictedEvidence-body" };
  const snapshot = async () => (await client.query(
    `SELECT target.id, target.title, detail.body
     FROM pg_temp.command_target target JOIN pg_temp.command_detail detail ON detail.target_id = target.id`,
  )).rows;

  try {
    console.error = (line) => lines.push(line);
    // Session-local tables disappear when this connection closes; no Halaga tables are used.
    await client.query(`CREATE TEMP TABLE command_target (
      id integer PRIMARY KEY, owner_id text NOT NULL, state text NOT NULL, title text NOT NULL
    )`);
    await client.query(`CREATE TEMP TABLE command_detail (
      target_id integer PRIMARY KEY REFERENCES command_target(id), body text NOT NULL
    )`);
    await client.query("INSERT INTO pg_temp.command_target VALUES (1, 'synthetic-owner', 'editable', 'Original title')");
    await client.query("INSERT INTO pg_temp.command_detail VALUES (1, 'Original detail')");

    const command = defineGuardedCommand({
      schema: z.strictObject({ id: z.number().int().positive(), title: z.string().trim().min(1), body: z.string().trim().min(1) }),
      resolveActor: async (session) => {
        phases.push("actor");
        return actors.get(session) ?? null;
      },
      transaction: async (work) => {
        phases.push("begin");
        await client.query("BEGIN");
        try {
          const result = await work(client);
          await client.query("COMMIT");
          phases.push("commit");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          phases.push("rollback");
          throw error;
        }
      },
      loadState: async (transaction, input) => {
        phases.push("load");
        const { rows } = await transaction.query(
          "SELECT owner_id, state FROM pg_temp.command_target WHERE id=$1", [input.id],
        );
        return rows[0] ?? null;
      },
      authorize: async ({ actor, state }) => {
        phases.push("authorize");
        return state?.owner_id === actor;
      },
      isStateAllowed: async ({ state }) => {
        phases.push("state");
        return state.state === "editable";
      },
      write: async (transaction, { input }) => {
        phases.push("write");
        await transaction.query("UPDATE pg_temp.command_target SET title=$1 WHERE id=$2", [input.title, input.id]);
        // A real NOT NULL failure on the second write must undo the first write.
        await transaction.query("UPDATE pg_temp.command_detail SET body=$1 WHERE target_id=$2", [
          failRelatedWrite ? null : input.body, input.id,
        ]);
        return { id: input.id, title: input.title };
      },
    });
    const original = await snapshot();

    await t.test("invalid input never resolves an actor or begins a transaction", async () => {
      for (const invalid of [{ ...input, title: " " }, { ...input, actorId: "synthetic-owner" }]) {
        phases.length = 0;
        await assert.rejects(command(invalid, "owner-session"), { name: "CommandRejected", code: "INVALID_INPUT" });
        assert.deepEqual(phases, []);
      }
      assert.deepEqual(await snapshot(), original);
    });
    await t.test("missing actors, non-owners and missing targets cannot write or reveal state", async () => {
      for (const [request, session, expected] of [
        [input, "unknown-session", ["actor"]],
        [input, "other-session", ["actor", "begin", "load", "authorize", "rollback"]],
        [{ ...input, id: 99 }, "owner-session", ["actor", "begin", "load", "authorize", "rollback"]],
      ]) {
        phases.length = 0;
        await assert.rejects(command(request, session), (error) => error instanceof CommandRejected && error.code === "UNAUTHORIZED");
        assert.deepEqual(phases, expected);
      }
      assert.deepEqual(await snapshot(), original);
    });
    await t.test("a disallowed current state prevents both writes", async () => {
      await client.query("UPDATE pg_temp.command_target SET state='sealed' WHERE id=1");
      phases.length = 0;
      await assert.rejects(command(input, "owner-session"), { code: "INVALID_STATE" });
      assert.deepEqual(phases, ["actor", "begin", "load", "authorize", "state", "rollback"]);
      assert.deepEqual(await snapshot(), original);
      await client.query("UPDATE pg_temp.command_target SET state='editable' WHERE id=1");
    });
    await t.test("failure of the related write rolls back the first write", async () => {
      failRelatedWrite = true;
      phases.length = 0;
      await assert.rejects(command(input, "owner-session"), { code: "23502" });
      assert.deepEqual(phases, ["actor", "begin", "load", "authorize", "state", "write", "rollback"]);
      assert.deepEqual(await snapshot(), original);
      failRelatedWrite = false;
    });
    await t.test("success commits both writes and returns only the named projection", async () => {
      phases.length = 0;
      assert.deepEqual(await command(input, "owner-session"), { id: 1, title: input.title });
      assert.deepEqual(phases, ["actor", "begin", "load", "authorize", "state", "write", "commit"]);
      assert.deepEqual(await snapshot(), [{ id: 1, title: input.title, body: input.body }]);
    });
    await t.test("real transaction logs omit input, ownership and PostgreSQL error details", () => {
      assert.deepEqual(lines.map((line) => JSON.parse(line)), [
        ...["INVALID_INPUT", "INVALID_INPUT", "UNAUTHORIZED", "UNAUTHORIZED", "UNAUTHORIZED", "INVALID_STATE"].map((code) => ({
          operation: "guarded-command", outcome: "rejected", code,
        })),
        { operation: "guarded-command", outcome: "failed", code: "INTERNAL_ERROR" },
        { operation: "guarded-command", outcome: "success" },
      ]);
      for (const sentinel of [input.title, input.body, "synthetic-owner", "owner-session", "command_detail", "23502"]) {
        assert.equal(lines.join("\n").includes(sentinel), false);
      }
    });
  } finally {
    console.error = originalError;
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
});

test("atomic publication coordination with a synthetic PostgreSQL adapter (no runtime policy)", async (t) => {
  const client = await openLocalDatabase();
  const listingId = randomUUID();
  const owner = randomUUID();
  const other = randomUUID();
  const operator = randomUUID();
  const lines = [];
  const originalError = console.error;
  let failAt;
  let policyAvailable = true; // Fictional test policy only; never installed in the app.
  let authorized = true;
  let revokeBeforeCommit = false;
  let duplicateEffect;
  let evaluations = 0;
  const input = { requestId: randomUUID(), listingId, revision: 1, command: "SUBMIT" };
  const result = { listingId, revision: 1, outcome: "HELD" };
  const schema = z.strictObject({ requestId: z.uuid(), listingId: z.uuid(), revision: z.number().int().positive(),
    command: z.enum(["SUBMIT", "REVIEW"]) });
  const fail = async (stage) => {
    if (failAt === stage) await client.query("SELECT 1 / 0");
  };
  const counts = async () => {
    const { rows } = await client.query(`SELECT
      (SELECT status FROM pg_temp.publication_target) AS status,
      (SELECT count(*)::int FROM pg_temp.publication_audit) AS audit,
      (SELECT count(*)::int FROM pg_temp.publication_outbox) AS outbox,
      (SELECT count(*)::int FROM pg_temp.publication_job) AS jobs,
      (SELECT count(*)::int FROM pg_temp.publication_receipt) AS receipts`);
    return rows[0];
  };
  try {
    console.error = (line) => lines.push(line);
    // Session-local tables only. These are an adapter fixture, not a physical
    // marketplace schema, job policy, staff role model or approved notification.
    await client.query(`CREATE TEMP TABLE publication_target (
      id uuid PRIMARY KEY, owner_id uuid NOT NULL, revision integer NOT NULL, status text NOT NULL)`);
    await client.query(`CREATE TEMP TABLE publication_audit (
      id uuid PRIMARY KEY, actor uuid NOT NULL, target uuid NOT NULL, prior text NOT NULL,
      outcome text NOT NULL, reason text NOT NULL)`);
    await client.query(`CREATE TEMP TABLE publication_outbox (
      decision_id uuid REFERENCES publication_audit(id), recipient uuid NOT NULL,
      channel text NOT NULL, event text NOT NULL, UNIQUE(decision_id, recipient, channel, event))`);
    await client.query(`CREATE TEMP TABLE publication_job (
      decision_id uuid REFERENCES publication_audit(id), work_key text NOT NULL,
      due_at timestamptz NOT NULL, UNIQUE(decision_id, work_key))`);
    await client.query(`CREATE TEMP TABLE publication_receipt (
      actor uuid NOT NULL, command text NOT NULL, request_id uuid NOT NULL,
      decision_id uuid NOT NULL REFERENCES publication_audit(id) DEFERRABLE INITIALLY DEFERRED, fingerprint text NOT NULL,
      result jsonb NOT NULL, PRIMARY KEY(actor, command, request_id))`);
    await client.query("INSERT INTO pg_temp.publication_target VALUES ($1, $2, 1, 'DRAFT')", [listingId, owner]);
    const command = defineAtomicPublicationDecision({
      schema,
      resolveActor: async (request) => [owner, other, operator].includes(request) ? request : null,
      transaction: async (work) => {
        await client.query("BEGIN");
        try {
          const value = await work(client);
          await client.query("COMMIT");
          return value;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      },
      loadAndLock: async (tx, input, actor) => {
        // Same lock namespace for retries naming different targets. A real
        // adapter must also follow the existing identity/session/listing order.
        await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [JSON.stringify([actor, input.command, input.requestId])]);
        return (await tx.query("SELECT * FROM pg_temp.publication_target WHERE id=$1 FOR UPDATE", [input.listingId])).rows[0];
      },
      authorize: ({ input, actor, state }) => authorized && !!state &&
        (input.command === "SUBMIT" ? actor === state.owner_id : actor === operator),
      readReceipt: async (tx, { input, actor }) => (await tx.query(
        `SELECT fingerprint, result FROM pg_temp.publication_receipt WHERE actor=$1 AND command=$2 AND request_id=$3`,
        [actor, input.command, input.requestId])).rows[0] ?? null,
      isStateAllowed: ({ input, state }) => input.revision === state.revision &&
        state.status === (input.command === "SUBMIT" ? "DRAFT" : "HELD"),
      decide: ({ input, state }) => {
        evaluations++;
        const outcome = input.command === "SUBMIT" ? "HELD" : "REJECTED";
        const notifications = ["IN_APP", "EMAIL"].map((channel) => ({ recipient: state.owner_id, channel, event: "synthetic.decision" }));
        const jobs = [{ key: "synthetic-work", dueAt: "2026-10-22T01:00:00.000Z" }];
        if (duplicateEffect === "notification") notifications[1] = notifications[0];
        if (duplicateEffect === "job") jobs.push(jobs[0]);
        return { domain: { outcome, reason: "SyntheticRestrictedFinding" },
          notifications, jobs,
          result: { listingId: input.listingId, revision: input.revision, outcome } };
      },
      validateEffects: (_context, decision) => policyAvailable && decision.notifications.length >= 2 && decision.jobs.length >= 1,
      writeDomain: async (tx, { input }, domain) => {
        await tx.query("UPDATE pg_temp.publication_target SET status=$1 WHERE id=$2", [domain.outcome, input.listingId]);
        await fail("domain");
      },
      appendAudit: async (tx, { input, actor, state }, id, domain) => {
        await tx.query("INSERT INTO pg_temp.publication_audit VALUES ($1,$2,$3,$4,$5,$6)",
          [id, actor, input.listingId, state.status, domain.outcome, domain.reason]);
        await fail("audit");
      },
      appendNotification: async (tx, id, index, intent) => {
        await tx.query("INSERT INTO pg_temp.publication_outbox VALUES ($1,$2,$3,$4)",
          [id, intent.recipient, intent.channel, intent.event]);
        await fail(`notification-${index}`);
      },
      appendJob: async (tx, id, _index, job) => {
        await tx.query("INSERT INTO pg_temp.publication_job VALUES ($1,$2,$3)", [id, job.key, job.dueAt]);
        await fail("job");
      },
      saveReceipt: async (tx, { input, actor }, id, receipt) => {
        await tx.query("INSERT INTO pg_temp.publication_receipt VALUES ($1,$2,$3,$4,$5,$6)",
          [actor, input.command, input.requestId, failAt === "commit" ? randomUUID() : id, receipt.fingerprint, receipt.result]);
        await fail("receipt");
        if (revokeBeforeCommit) authorized = false;
      },
    });
    const empty = { status: "DRAFT", audit: 0, outbox: 0, jobs: 0, receipts: 0 };
    await t.test("invalid, unauthorized, stale and policy-blocked requests have no effects", async () => {
      await assert.rejects(command({ ...input, recipient: other }, owner), { code: "INVALID_INPUT" });
      await assert.rejects(command(input, null), { code: "UNAUTHORIZED" });
      await assert.rejects(command(input, other), { code: "UNAUTHORIZED" });
      await assert.rejects(command({ ...input, revision: 2 }, owner), { code: "INVALID_STATE" });
      policyAvailable = false;
      await assert.rejects(command(input, owner), { code: "INVALID_STATE" });
      policyAvailable = true;
      assert.deepEqual(await counts(), empty);
    });
    for (const stage of ["domain", "audit", "notification-0", "notification-1", "job", "receipt", "commit"]) {
      await t.test(`${stage} failure rolls back the entire decision for same-command retry`, async () => {
        failAt = stage;
        await assert.rejects(command(input, owner), { code: stage === "commit" ? "23503" : "22012" });
        assert.deepEqual(await counts(), empty);
        failAt = undefined;
      });
    }
    await t.test("database uniqueness rejects duplicate logical intents/jobs without a partial decision", async () => {
      for (const effect of ["notification", "job"]) {
        duplicateEffect = effect;
        await assert.rejects(command(input, owner), { code: "23505" });
        assert.deepEqual(await counts(), empty);
      }
      duplicateEffect = undefined;
    });
    await t.test("authorization lost during writes rolls back effects and receipt", async () => {
      revokeBeforeCommit = true;
      await assert.rejects(command(input, owner), { code: "UNAUTHORIZED" });
      assert.deepEqual(await counts(), empty);
      revokeBeforeCommit = false;
      authorized = true;
    });
    await t.test("one transaction commits domain, audit, both intents, jobs and original safe receipt", async () => {
      assert.deepEqual(await command(input, owner), result);
      assert.deepEqual(await counts(), { status: "HELD", audit: 1, outbox: 2, jobs: 1, receipts: 1 });
      const intents = (await client.query("SELECT recipient, channel, event FROM pg_temp.publication_outbox ORDER BY channel")).rows;
      assert.deepEqual(intents, ["EMAIL", "IN_APP"].map((channel) => ({ recipient: owner, channel, event: "synthetic.decision" })));
      for (const value of [JSON.stringify(result), JSON.stringify(intents)]) {
        for (const secret of ["SyntheticRestrictedFinding", operator, other, "recipientEmail", "priceExpectation"]) {
          assert.equal(value.includes(secret), false);
        }
      }
    });
    await t.test("lost-response retries return the original result without reevaluation or duplicate effects", async () => {
      const before = evaluations;
      const reordered = Object.fromEntries(Object.entries(input).reverse());
      assert.deepEqual(await command(reordered, owner), result);
      assert.deepEqual(await command(input, owner), result);
      assert.equal(evaluations, before);
      assert.deepEqual(await counts(), { status: "HELD", audit: 1, outbox: 2, jobs: 1, receipts: 1 });
      await assert.rejects(command({ ...input, revision: 2 }, owner), { code: "INVALID_STATE" });
      authorized = false;
      await assert.rejects(command(input, owner), { code: "UNAUTHORIZED" });
      authorized = true;
    });
    await t.test("new stale submissions cannot overwrite the committed decision", async () => {
      await assert.rejects(command({ ...input, requestId: randomUUID() }, owner), { code: "INVALID_STATE" });
      assert.equal((await counts()).status, "HELD");
    });
    await t.test("a distinct authorized review has its own audit/effects and does not alter prior receipts or deadlines", async () => {
      const review = { ...input, command: "REVIEW" };
      await assert.rejects(command(review, owner), { code: "UNAUTHORIZED" });
      assert.deepEqual(await command(review, operator), { ...result, outcome: "REJECTED" });
      assert.deepEqual(await command(review, operator), { ...result, outcome: "REJECTED" });
      assert.deepEqual(await command(input, owner), result);
      assert.deepEqual(await counts(), { status: "REJECTED", audit: 2, outbox: 4, jobs: 2, receipts: 2 });
      assert.deepEqual((await client.query("SELECT DISTINCT recipient FROM pg_temp.publication_outbox")).rows, [{ recipient: owner }]);
      const jobs = (await client.query("SELECT due_at FROM pg_temp.publication_job")).rows;
      assert.ok(jobs.every((job) => job.due_at.toISOString() === "2026-10-22T01:00:00.000Z"));
    });
    await t.test("fake delivery failure after commit cannot undo the decision", async () => {
      const before = await counts();
      const fakeSend = async () => { throw new Error("Synthetic delivery failure"); };
      await assert.rejects(fakeSend(), /Synthetic delivery failure/);
      assert.deepEqual(await counts(), before);
      assert.deepEqual(await command(input, owner), result);
    });
    await t.test("operational logs omit actors, targets, findings, database details and notification recipients", () => {
      for (const secret of [owner, other, operator, listingId, input.requestId, "SyntheticRestrictedFinding", "22012", "division by zero"]) {
        assert.equal(lines.join("\n").includes(secret), false);
      }
    });
  } finally {
    console.error = originalError;
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
});
