import assert from "node:assert/strict";
import test from "node:test";
import { changeAnswer, copyDraft, deriveCondition, emptyDraft, enhancedKeys, samples, toggleBehavior, validateDraft } from "../src/domain/laptop-diagnostics.ts";

const working = () => copyDraft(samples[0].draft);

for (const sample of samples) {
  test(`${sample.name}: expected condition and distinct safety route`, () => {
    const draft = copyDraft(sample.draft);
    const result = deriveCondition(draft);
    assert.equal(result.condition, sample.expected);
    assert.equal(result.safety, sample.safety);
    assert.ok(result.reasons.length);
    if (sample.safety === "clear") assert.deepEqual(validateDraft(draft), {});
    else assert.match(validateDraft(draft).safety, /Stop testing/);
  });
}

test("optional untested functions and cosmetic scratches do not prevent Fully functional", () => {
  const draft = working();
  for (const key of enhancedKeys) assert.equal(draft.answers[key], "untested");
  assert.equal(deriveCondition(draft).condition, "Fully functional");
});

test("all tested optional defects are explained", () => {
  const draft = working();
  draft.answers.camera = "failed";
  draft.answers.wifi = "issue";
  draft.notes.wifi = "Connection drops during ordinary use.";
  const result = deriveCondition(draft);
  assert.equal(result.condition, "Functional with issues");
  assert.ok(result.reasons.some((reason) => reason.field === "camera"));
  assert.ok(result.reasons.some((reason) => reason.field === "wifi" && reason.text.includes("Connection drops")));
});

for (const battery of ["degraded", "no-power", "no-charge", "absent"]) {
  test(`expected battery ${battery} is an issue, not whole-laptop failure`, () => {
    const draft = working();
    draft.answers.battery = battery;
    if (battery === "degraded") draft.notes.battery = "Powers the laptop briefly before shutting down.";
    assert.equal(deriveCondition(draft).condition, "Functional with issues");
    assert.ok(deriveCondition(draft).reasons.some((reason) => reason.field === "battery"));
  });
}

test("battery genuinely not applicable can be Fully functional", () => {
  const draft = working();
  draft.answers.safety = "no-battery";
  draft.answers.battery = "na";
  draft.notes.battery = "This configuration is designed for external power with no battery.";
  assert.equal(deriveCondition(draft).condition, "Fully functional");
  assert.deepEqual(validateDraft(draft), {});
});

test("unknown battery operation is separate from sufficient primary testing", () => {
  const draft = working();
  draft.answers.battery = "unknown";
  assert.equal(deriveCondition(draft).condition, "Fully functional");
});

test("explained Not applicable is allowed; unexplained applicability is insufficient", () => {
  const draft = working();
  draft.answers.pointing = "na";
  assert.equal(deriveCondition(draft).condition, "Untested/unknown");
  assert.ok(validateDraft(draft)["pointing-note"]);
  draft.notes.pointing = "No built-in pointing device by design; external mouse used.";
  assert.equal(deriveCondition(draft).condition, "Fully functional");
});

test("missing expected parts are defects, not Not applicable", () => {
  const draft = working();
  draft.answers.missing = "yes";
  draft.notes.missing = "Two keyboard keys are missing.";
  assert.equal(deriveCondition(draft).condition, "Functional with issues");
  assert.ok(deriveCondition(draft).reasons.some((reason) => reason.field === "missing" && reason.text.includes("Two keyboard")));
});

for (const key of ["power", "display", "startup", "keyboard", "pointing", "external"]) {
  test(`${key}: incomplete required check overrides known optional defects`, () => {
    const draft = working();
    draft.answers[key] = "unknown";
    draft.answers.camera = "failed";
    const result = deriveCondition(draft);
    assert.equal(result.condition, "Untested/unknown");
    assert.ok(result.reasons.some((reason) => reason.field === key));
  });
}

test("conclusive terminal failure precedes untested downstream checks", () => {
  const draft = copyDraft(samples[3].draft);
  assert.equal(draft.answers.keyboard, "unknown");
  assert.equal(deriveCondition(draft).condition, "Not functional");
  draft.answers.external = "no-charger";
  assert.equal(deriveCondition(draft).condition, "Untested/unknown");
});

test("lights or fans alone are not an intended computing function", () => {
  const draft = working();
  Object.assign(draft.answers, { power: "signs", display: "blank", startup: "unusable", keyboard: "unknown", pointing: "unknown", external: "failed" });
  assert.equal(deriveCondition(draft).condition, "Untested/unknown");
  Object.assign(draft.answers, { keyboard: "failed", pointing: "failed" });
  assert.equal(deriveCondition(draft).condition, "Not functional");
});

test("firmware/recovery are intended functions but fail usable-system startup", () => {
  for (const startup of ["firmware", "recovery"]) {
    const draft = working();
    draft.answers.startup = startup;
    if (startup === "recovery") draft.notes.startup = "The system displays a recovery error.";
    assert.equal(deriveCondition(draft).condition, "Functional with issues");
  }
});

test("lock disclosure alone never lowers condition", () => {
  const draft = working();
  draft.answers.lock = "managed";
  draft.notes.lock = "Managed device; removal capability is unknown.";
  assert.equal(deriveCondition(draft).condition, "Fully functional");
  assert.deepEqual(validateDraft(draft), {});
});

test("a lock that prevents testing leaves required testing insufficient", () => {
  const draft = working();
  Object.assign(draft.answers, { startup: "locked", lock: "activation", keyboard: "unknown" });
  draft.notes.lock = "Linked-account restriction; removal capability is unknown.";
  const result = deriveCondition(draft);
  assert.equal(result.condition, "Untested/unknown");
  assert.ok(result.reasons.some((reason) => reason.field === "startup"));
});

test("contradictory positive observations do not produce Not functional", () => {
  const draft = working();
  Object.assign(draft.answers, { power: "nothing", external: "failed" });
  assert.equal(deriveCondition(draft).condition, "Untested/unknown");
});

test("observed keyboard/pointing response prevents a contradictory terminal result", () => {
  for (const key of ["keyboard", "pointing"]) {
    const draft = copyDraft(samples[3].draft);
    draft.answers[key] = "works";
    assert.equal(deriveCondition(draft).condition, "Untested/unknown");
  }
});

test("validation rejects unknown and inherited option names", () => {
  const draft = working();
  draft.answers.power = "constructor";
  draft.behavior = ["toString"];
  const errors = validateDraft(draft);
  assert.ok(errors.power);
  assert.ok(errors.behavior);
  assert.equal(deriveCondition(draft).condition, "Untested/unknown");
});

test("safe scenario changed to hazard/uncertainty clears old test answers and never gives an ordinary label", () => {
  for (const safety of ["hazard", "uncertain"]) {
    const original = working();
    const stopped = changeAnswer(original, "safety", safety);
    assert.equal(deriveCondition(stopped).condition, null);
    assert.equal(deriveCondition(stopped).safety, safety === "hazard" ? "blocked" : "hold");
    assert.equal(stopped.answers.power, "");
    assert.deepEqual(stopped.notes, {});
    assert.equal(original.answers.power, "on");
    const resumed = changeAnswer(stopped, "safety", "clear");
    assert.equal(deriveCondition(resumed).condition, "Untested/unknown");
    assert.ok(validateDraft(resumed).power);
  }
});

test("safety takes priority over conclusive terminal failure", () => {
  const draft = copyDraft(samples[3].draft);
  draft.answers.safety = "hazard";
  assert.equal(deriveCondition(draft).condition, null);
  assert.equal(deriveCondition(draft).safety, "blocked");
});

test("no battery continues testing; contradictory battery presence needs correction", () => {
  const draft = working();
  draft.answers.safety = "no-battery";
  assert.equal(deriveCondition(draft).safety, "clear");
  assert.ok(validateDraft(draft).battery);
});

test("publication-required disclosures accept untested answers, not empty answers", () => {
  const draft = working();
  draft.answers.keyboard = "unknown";
  assert.deepEqual(validateDraft(draft), {});
  draft.answers.keyboard = "";
  assert.ok(validateDraft(draft).keyboard);
});

test("described choices require details; Unknown brand and model remain valid", () => {
  const draft = working();
  draft.brand = "Unknown";
  draft.model = "Unknown";
  draft.answers.display = "issue";
  assert.ok(validateDraft(draft)["display-note"]);
  draft.notes.display = "Vertical lines on the screen.";
  assert.deepEqual(validateDraft(draft), {});
});

test("known functional behavior changes condition and includes each source fact", () => {
  const draft = working();
  draft.behavior = ["shutdown", "other"];
  draft.behaviorNotes = "Known intermittent storage errors.";
  const result = deriveCondition(draft);
  assert.equal(result.condition, "Functional with issues");
  assert.ok(result.reasons.some((reason) => reason.text.includes("Unexpected shutdown")));
  assert.ok(result.reasons.some((reason) => reason.text.includes("storage errors")));
});

test("None known and Could not observe stay exclusive from reported issues", () => {
  assert.deepEqual(toggleBehavior(["none"], "noise"), ["noise"]);
  assert.deepEqual(toggleBehavior(["noise", "heat"], "unknown"), ["unknown"]);
  assert.deepEqual(toggleBehavior(["unknown"], "shutdown"), ["shutdown"]);
  assert.deepEqual(toggleBehavior(["noise"], "noise"), []);
});

test("charger inclusion is distinct from power-input function", () => {
  const draft = working();
  draft.answers.charger = "no";
  draft.included = ["Laptop"];
  assert.equal(deriveCondition(draft).condition, "Fully functional");
  assert.deepEqual(validateDraft(draft), {});
  draft.included.push("Charger");
  assert.ok(validateDraft(draft).included);
});

test("blank form error links only address visible controls before safety", () => {
  assert.equal(deriveCondition(emptyDraft()).condition, null);
  assert.deepEqual(Object.keys(validateDraft(emptyDraft())).sort(), ["brand", "description", "model", "safety", "title"]);
});

test("editing a copied fixture never changes the shipped example", () => {
  const draft = working();
  draft.answers.power = "nothing";
  draft.behavior.push("noise");
  assert.equal(samples[0].draft.answers.power, "on");
  assert.deepEqual(samples[0].draft.behavior, ["none"]);
});
