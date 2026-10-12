import assert from "node:assert/strict";
import test from "node:test";
import { phpAmountSchema, itemQuantitySchema, laptopDiagnosticAnswerSchema } from "../src/server/foundation-validation.ts";

test("PHP parser preserves exact centavos and rejects coercion/rounding", () => {
  for (const [input, expected] of [["1", "1.00"], ["0001.1", "1.10"], ["9999999999.99", "9999999999.99"], ["-0.00", "0.00"]]) {
    assert.equal(phpAmountSchema.parse(input), expected);
  }
  for (const input of [1.1, "1.001", "1e3", "NaN", "Infinity", "", "10000000000.00"]) {
    assert.equal(phpAmountSchema.safeParse(input).success, false);
  }
});

test("item quantity must be a positive integer", () => {
  assert.equal(itemQuantitySchema.parse(1), 1);
  for (const value of [0, -1, 1.5, "1", Number.NaN]) {
    assert.equal(itemQuantitySchema.safeParse(value).success, false);
  }
});

test("laptop answers use the accepted version, question and choice with required explanation", () => {
  const base = { schemaVersion: "laptop-diagnostics-en-v1", questionKey: "power", answer: "on" };
  assert.deepEqual(laptopDiagnosticAnswerSchema.parse(base), base);
  for (const changes of [
    { schemaVersion: "unaccepted-v2" }, { questionKey: "price" }, { answer: "invented" },
    { answer: { value: "on" } }, { hiddenField: "private" },
    { questionKey: "lock", answer: "managed" },
  ]) {
    assert.equal(laptopDiagnosticAnswerSchema.safeParse({ ...base, ...changes }).success, false);
  }
  assert.equal(laptopDiagnosticAnswerSchema.safeParse({
    ...base, questionKey: "lock", answer: "managed", detail: "Synthetic organization lock disclosure",
  }).success, true);
});
