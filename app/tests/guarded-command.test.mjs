import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { defineGuardedCommand, CommandRejected } from "../src/server/guarded-command.ts";
import { openLocalDatabase } from "../scripts/local-database.mjs";

test("synthetic guarded command validates, checks actor/state and writes atomically", async (t) => {
  const client = await openLocalDatabase();
  const phases = [];
  let failRelatedWrite = false;
  // These identities and ownership rules exist only in this synthetic test.
  const actors = new Map([["owner-session", "synthetic-owner"], ["other-session", "synthetic-other"]]);
  const input = { id: 1, title: "New synthetic title", body: "New synthetic detail" };
  const snapshot = async () => (await client.query(
    `SELECT target.id, target.title, detail.body
     FROM pg_temp.command_target target JOIN pg_temp.command_detail detail ON detail.target_id = target.id`,
  )).rows;

  try {
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
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
});
