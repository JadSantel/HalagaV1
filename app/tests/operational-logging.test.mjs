import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { defineGuardedCommand } from "../src/server/guarded-command.ts";
import { logOperationalEvent } from "../src/server/operational-log.ts";

test("guarded command logs safe outcome metadata, never input, request, or raw error", async () => {
  const lines = [];
  const originalError = console.error;
  console.error = (line) => lines.push(line);
  const sentinels = ["SyntheticDateOfBirth-2000-01-02", "SyntheticPrivatePrice-98765.43", "SyntheticEvidence-contents", "SyntheticSessionToken-secret"];
  const command = defineGuardedCommand({
    schema: z.strictObject({ privateData: z.string() }),
    resolveActor: async () => { throw new Error(`Database failed for ${sentinels.join(" ")}`); },
    transaction: async (work) => work({}),
    loadState: async () => null,
    authorize: () => true,
    isStateAllowed: () => true,
    write: async () => ({}),
  });

  try {
    await assert.rejects(command({ privateData: sentinels.join(" ") }, { session: sentinels[3] }));
  } finally {
    console.error = originalError;
  }

  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    operation: "guarded-command", outcome: "failed", code: "INTERNAL_ERROR",
  });
  for (const sentinel of sentinels) assert.equal(lines.join("\n").includes(sentinel), false);
});

test("invalid input logs only a stable rejection code; request IDs require UUID shape", () => {
  const lines = [];
  logOperationalEvent({
    operation: "guarded-command", outcome: "rejected", code: "INVALID_INPUT",
    requestId: "SyntheticSessionToken-secret",
    body: "SyntheticSubmittedFormContents",
  }, (line) => lines.push(line));

  assert.deepEqual(JSON.parse(lines[0]), {
    operation: "guarded-command", outcome: "rejected", code: "INVALID_INPUT",
  });
  assert.equal(lines[0].includes("Synthetic"), false);

  logOperationalEvent({
    operation: "guarded-command", outcome: "success",
    requestId: "123e4567-e89b-42d3-a456-426614174000",
  }, (line) => lines.push(line));
  assert.deepEqual(JSON.parse(lines[1]), {
    operation: "guarded-command", outcome: "success",
    requestId: "123e4567-e89b-42d3-a456-426614174000",
  });
});

test("request IDs cannot use coercion to serialize sensitive objects", () => {
  const lines = [];
  for (const requestId of [null, 123, "123e4567-e89b-42d3-a456-426614174000\n", {
      toString: () => "123e4567-e89b-42d3-a456-426614174000",
      toJSON: () => "SyntheticSessionToken-secret",
    }]) {
    logOperationalEvent({ operation: "guarded-command", outcome: "success", requestId }, (line) => lines.push(line));
  }
  assert.deepEqual(lines.map((line) => JSON.parse(line)), Array.from({ length: 4 }, () => ({
    operation: "guarded-command", outcome: "success",
  })));
});

test("logging sink failure preserves committed results and original command errors", async () => {
  const originalError = console.error;
  const failure = new Error("SyntheticEvidence-private-failure");
  let committed = false;
  const definition = {
    schema: z.strictObject({}),
    resolveActor: async () => "synthetic-owner",
    transaction: async (work) => {
      const result = await work({});
      committed = true;
      return result;
    },
    loadState: async () => ({}),
    authorize: () => true,
    isStateAllowed: () => true,
    write: async () => ({ id: "synthetic-result" }),
  };
  console.error = () => { throw new Error("SyntheticSinkFailure"); };
  try {
    assert.deepEqual(await defineGuardedCommand(definition)({}, {}), { id: "synthetic-result" });
    assert.equal(committed, true);
    await assert.rejects(defineGuardedCommand({
      ...definition, write: async () => { throw failure; },
    })({}, {}), (error) => error === failure);
    await assert.rejects(defineGuardedCommand(definition)({ unexpected: "SyntheticToken" }, {}), {
      name: "CommandRejected", code: "INVALID_INPUT",
    });
  } finally {
    console.error = originalError;
  }
});

test("all command phases and outcomes exclude synthetic sensitive values", async () => {
  const sentinels = [
    "SyntheticDateOfBirth-2000-01-02", "SyntheticPrivatePrice-98765.43",
    "SyntheticEvidence-contents", "SyntheticSessionToken-secret", "SyntheticPassword-secret",
    "SyntheticVerificationToken-secret", "SyntheticEmail@example.invalid",
    "SyntheticIMEI-123456789012345", "SyntheticExactLocation-private", "SyntheticPrivateMessage-contents",
  ];
  const secret = sentinels.join(" ");
  const lines = [];
  const originalError = console.error;
  const definition = {
    schema: z.strictObject({ privateData: z.string().min(1, secret) }),
    resolveActor: async () => ({ id: "synthetic-owner", token: secret }),
    // This runner exercises logging only. PostgreSQL atomicity is verified in guarded-command.test.mjs.
    transaction: async (work) => work({}),
    loadState: async () => ({ evidence: secret }),
    authorize: () => true,
    isStateAllowed: () => true,
    write: async () => ({ privateData: secret }),
  };
  const input = { privateData: secret };
  const request = { body: secret, session: secret };
  console.error = (line) => lines.push(line);
  try {
    await assert.rejects(defineGuardedCommand(definition)({ privateData: "", extra: secret }, request), { code: "INVALID_INPUT" });
    await assert.rejects(defineGuardedCommand({ ...definition, resolveActor: async () => null })(input, request), { code: "UNAUTHORIZED" });
    await assert.rejects(defineGuardedCommand({ ...definition, authorize: () => false })(input, request), { code: "UNAUTHORIZED" });
    await assert.rejects(defineGuardedCommand({ ...definition, isStateAllowed: () => false })(input, request), { code: "INVALID_STATE" });

    for (const phase of ["schema", "resolveActor", "transaction", "loadState", "authorize", "isStateAllowed", "write", "commit"]) {
      const failure = new Error(secret);
      const overrides = phase === "schema"
        ? { schema: definition.schema.transform(() => { throw failure; }) }
        : phase === "commit"
          ? { transaction: async (work) => { await work({}); throw failure; } }
          : { [phase]: async () => { throw failure; } };
      await assert.rejects(defineGuardedCommand({ ...definition, ...overrides })(input, request), (error) => error === failure);
    }
    assert.deepEqual(await defineGuardedCommand(definition)(input, request), { privateData: secret });
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(lines.map((line) => JSON.parse(line)), [
    ...["INVALID_INPUT", "UNAUTHORIZED", "UNAUTHORIZED", "INVALID_STATE"].map((code) => ({
      operation: "guarded-command", outcome: "rejected", code,
    })),
    ...Array.from({ length: 8 }, () => ({ operation: "guarded-command", outcome: "failed", code: "INTERNAL_ERROR" })),
    { operation: "guarded-command", outcome: "success" },
  ]);
  for (const sentinel of sentinels) assert.equal(lines.join("\n").includes(sentinel), false);
});
