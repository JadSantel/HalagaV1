import assert from "node:assert/strict";
import test from "node:test";
import { readAndClearAccountEmailToken } from "../src/domain/account-email-link.ts";

test("fragment capture immediately clears the URL, preserves router state, and rejects ambiguous/query tokens", () => {
  const token = "a".repeat(64);
  for (const [hash, search, expected] of [
    [`#token=${token}`, "", token], ["", "", null], ["#token=private-sentinel", "", null],
    [`#token=${token}&token=${token}`, "", null], [`#token=${token}&extra=1`, "", null],
    [`#token=${token}`, `?token=${token}`, null], ["", `?token=${token}`, null],
  ]) {
    const calls = [];
    const history = { state: { router: "preserved" }, replaceState: (...args) => calls.push(args) };
    assert.equal(readAndClearAccountEmailToken({ hash, search, pathname: "/account/verify-email" }, history), expected);
    assert.deepEqual(calls, [[history.state, "", "/account/verify-email"]]);
    assert.ok(!JSON.stringify(calls).includes(token));
  }
});
