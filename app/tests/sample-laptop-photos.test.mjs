import assert from "node:assert/strict";
import test from "node:test";
import { sampleLaptopPhotos, selectedSamplePhotos, updateSamplePhotoSelection } from "../src/domain/sample-laptop-photos.ts";
import { toPublicLaptopPreview, sampleListingDetails } from "../src/domain/laptop-listing.ts";
import { copyDraft, samples } from "../src/domain/laptop-diagnostics.ts";

test("selection reaches the practice target without duplicates or arbitrary image sources", () => {
  const empty = [];
  const first = updateSamplePhotoSelection(empty, { type: "select", id: "front" });
  const second = updateSamplePhotoSelection(first, { type: "select", id: "lid" });
  assert.deepEqual(empty, []);
  assert.deepEqual(first, ["front"]);
  assert.equal(selectedSamplePhotos(second).length, 2);
  assert.deepEqual(updateSamplePhotoSelection(second, { type: "select", id: "front" }), second);
  assert.deepEqual(updateSamplePhotoSelection(second, { type: "select", id: "https://example.invalid/real-photo.jpg" }), second);
  assert.equal(selectedSamplePhotos(["front", "front", "unknown"]).length, 1);
  assert.equal(selectedSamplePhotos(updateSamplePhotoSelection(second, { type: "select", id: "underside" })).length, 3);
});

test("removal and clearing update previews and permit re-selection", () => {
  const selected = ["front", "lid"];
  const removed = updateSamplePhotoSelection(selected, { type: "remove", id: "front" });
  assert.deepEqual(selectedSamplePhotos(removed).map((photo) => photo.id), ["lid"]);
  assert.deepEqual(selected, ["front", "lid"]);
  assert.equal(selectedSamplePhotos(updateSamplePhotoSelection(removed, { type: "select", id: "front" })).length, 2);
  const cleared = updateSamplePhotoSelection(removed, { type: "clear" });
  assert.deepEqual(selectedSamplePhotos(cleared), []);
  assert.deepEqual(updateSamplePhotoSelection(cleared, { type: "clear" }), []);
});

test("every fixture is a labeled inline fictional laptop illustration with no active or remote SVG content", () => {
  for (const photo of sampleLaptopPhotos) {
    assert.match(photo.alt, /Sample illustration.*fictional.*Not an actual item photo/);
    assert.match(photo.src, /^data:image\/svg\+xml;charset=utf-8,/);
    const svg = decodeURIComponent(photo.src.split(",")[1]);
    assert.match(svg, /SAMPLE IMAGE - FICTIONAL LAPTOP/);
    assert.doesNotMatch(svg, /<script|<foreignObject|\bon\w+\s*=|\bhref\s*=|<image|<metadata/i);
  }
});

test("public review includes only selected sample image fields, independently from source and private draft", () => {
  const draft = { ...copyDraft(samples[0].draft), ...sampleListingDetails, privatePriceExpectation: "99999.99" };
  const selected = selectedSamplePhotos(["lid", "front"]);
  selected[0].privateMetadata = "Fictional secret address";
  const publicDraft = toPublicLaptopPreview(draft, selected);
  assert.deepEqual(publicDraft.samplePhotos.map((photo) => photo.id), ["lid", "front"]);
  assert.equal(JSON.stringify(publicDraft).includes(draft.privatePriceExpectation), false);
  assert.equal(JSON.stringify(publicDraft).includes(selected[0].privateMetadata), false);
  publicDraft.samplePhotos[0].label = "Edited practice label";
  assert.notEqual(selected[0].label, "Edited practice label");
  assert.equal(toPublicLaptopPreview(draft, selectedSamplePhotos([])).samplePhotos.length, 0);
});
