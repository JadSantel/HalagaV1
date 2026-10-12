import assert from "node:assert/strict";
import test from "node:test";
import { changeAnswer, copyDraft, deriveCondition, samples } from "../src/domain/laptop-diagnostics.ts";
import { emptyListingDetails, sampleListingDetails, toPublicLaptopPreview, validateListingDetails } from "../src/domain/laptop-listing.ts";

const sample = () => ({ ...copyDraft(samples[0].draft), ...sampleListingDetails });

test("public preview excludes seller-only fields and unexpected private data", () => {
  const draft = { ...sample(), privatePriceExpectation: "987654.32", contactEmail: "sample-only@example.invalid", exactAddress: "Fictional secret address", auditNote: "Private sample audit" };
  const preview = toPublicLaptopPreview(draft);
  assert.deepEqual(Object.keys(preview).sort(), ["diagnosticVersion", "title", "brand", "model", "description", "approximateAge", "city", "barangay", "fulfillment", "answers", "notes", "behavior", "behaviorNotes", "included", "includedNotes"].sort());
  for (const field of ["privatePriceExpectation", "ownershipDeclared", "contactEmail", "exactAddress", "auditNote"]) assert.equal(Object.hasOwn(preview, field), false);
  for (const value of [draft.privatePriceExpectation, draft.contactEmail, draft.exactAddress, draft.auditNote]) assert.equal(JSON.stringify(preview).includes(value), false);
  assert.equal(preview.barangay, "Practice barangay A (fictional)");
  assert.equal(preview.fulfillment, "Buyer pickup or mutually agreed meetup");
  assert.equal(deriveCondition(preview).condition, "Fully functional");
});

test("local review requires controlled geography, a supported method, and explicit ownership", () => {
  assert.deepEqual(validateListingDetails(sample()), {});
  assert.deepEqual(Object.keys(validateListingDetails(emptyListingDetails)).sort(), ["barangay", "fulfillment", "ownershipDeclared"]);
  for (const [field, value] of [["barangay", "Exact fictional address"], ["fulfillment", "shipping"], ["ownershipDeclared", false]]) {
    assert.ok(validateListingDetails({ ...sample(), [field]: value })[field]);
  }
  assert.deepEqual(validateListingDetails({ ...sample(), approximateAge: "", privatePriceExpectation: "" }), {});
  assert.ok(validateListingDetails({ ...sample(), privatePriceExpectation: "not an amount" }).privatePriceExpectation);
});

test("public diagnostics and mutable arrays are independent from the seller draft", () => {
  const draft = sample();
  const preview = toPublicLaptopPreview(draft);
  preview.answers.power = "nothing";
  preview.notes.power = "Synthetic correction";
  preview.behavior.push("other");
  preview.included.length = 0;
  assert.equal(draft.answers.power, "on");
  assert.equal(draft.notes.power, undefined);
  assert.deepEqual(draft.behavior, ["none"]);
  assert.deepEqual(draft.included, ["Laptop", "Charger"]);
});

test("age can be unknown and safety stops retain listing details without deriving a condition", () => {
  const draft = { ...sample(), approximateAge: " " };
  assert.equal(toPublicLaptopPreview(draft).approximateAge, "Unknown");
  const stopped = changeAnswer(draft, "safety", "hazard");
  assert.equal(stopped.barangay, draft.barangay);
  assert.equal(stopped.privatePriceExpectation, draft.privatePriceExpectation);
  assert.equal(deriveCondition(stopped).condition, null);
});
