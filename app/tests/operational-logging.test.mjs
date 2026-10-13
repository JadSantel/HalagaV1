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
