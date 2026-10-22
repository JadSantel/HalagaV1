import assert from "node:assert/strict";
import "./held-laptop-review-database.test.mjs";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { laptopDraftSchema, validatedDraftCondition } from "../src/server/laptop-draft-validation.ts";
import { copyDraft, samples } from "../src/domain/laptop-diagnostics.ts";
import { createLaptopDraftOperations, LaptopDraftRejected } from "../src/server/repositories/laptop-drafts.ts";
import { createLaptopDraftHandler } from "../src/server/repositories/laptop-drafts-http.ts";
import { createAccountSignInOperation } from "../src/server/repositories/sign-in.ts";
import { createPasswordChangeOperation } from "../src/server/repositories/password-change.ts";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";
import { evaluateLaptopPublication, reviewChecks } from "../src/server/laptop-publication-evaluation.ts";

const origin = "http://127.0.0.1:3000";
const input = (draft = {}) => ({ requestId: randomUUID(), draft });
const rejects = (code) => (error) => error instanceof LaptopDraftRejected && error.code === code &&
  error.message === code && error.cause === undefined;

// Fictional assessment records only, not real photos or a runtime assessment provider.
function publicationFixture() {
  const saved = { listingId: randomUUID(), revisionId: randomUUID(), revision: 3,
    listingType: "SINGLE_ITEM", category: "LAPTOPS", quantity: 1, barangayCode: "fictional-test-code",
    photoIds: ["fictional-photo-a", "fictional-photo-b"], ownershipDeclarationPresent: true,
    account: { adultEligible: true, emailVerified: true, publicationRestricted: false },
    draft: laptopDraftSchema.parse({ ...copyDraft(samples[0].draft), fulfillment: "both", privatePriceExpectation: "8123456.78" }) };
  const assessments = { revisionId: saved.revisionId, geography: "pass", ownership: "pass", defectCoverage: "pass",
    photos: saved.photoIds.map((id) => ({ id, approved: true, derivativeAvailable: true, kind: "actual-item", clear: "pass" })),
    risk: Object.fromEntries(reviewChecks.map((key) => [key, "pass"])), readiness: "pass" };
  return { saved, assessments };
}

test("publication rules distinguish eligibility, incompleteness, unavailable checks and unsupported schemas", () => {
  const { saved, assessments } = publicationFixture();
  const original = structuredClone({ saved, assessments });
  const result = evaluateLaptopPublication(saved, assessments);
  assert.equal(result.status, "eligible");
  assert.equal(result.eligible, true);
  assert.equal(result.revision, 3);
  assert.equal(JSON.stringify(result).includes("8123456.78"), false);
  assert.equal(JSON.stringify(result).includes(saved.revisionId), false);
  const missing = evaluateLaptopPublication({ ...saved, draft: laptopDraftSchema.parse({}) }, assessments);
  assert.equal(missing.status, "incomplete");
  for (const field of ["title", "brand", "model", "description", "safety", "fulfillment"]) {
    assert.ok(missing.checks.some((check) => check.field === field && check.status === "missing"));
  }
  for (const input of [undefined, { ...assessments, revisionId: randomUUID() }]) {
    const unavailable = evaluateLaptopPublication(saved, input);
    assert.equal(unavailable.eligible, false);
    assert.ok(unavailable.checks.some((check) => check.status === "unavailable"));
  }
  for (const field of ["geography", "ownership", "defectCoverage", "readiness"]) {
    const result = evaluateLaptopPublication(saved, { ...assessments, [field]: undefined });
    assert.equal(result.eligible, false, field);
    assert.equal(result.status, "unavailable", field);
  }
  for (const key of reviewChecks) {
    for (const value of [undefined, "unsupported-outcome", "unavailable"]) {
      assert.equal(evaluateLaptopPublication(saved, { ...assessments, risk: { ...assessments.risk, [key]: value } }).eligible, false, key);
    }
  }
  assert.equal(evaluateLaptopPublication({ ...saved, barangayCode: null }, assessments).eligible, false);
  for (const fulfillment of ["", "shipping"]) assert.equal(evaluateLaptopPublication({ ...saved, draft: { ...saved.draft, fulfillment } }, assessments).eligible, false);
  assert.equal(evaluateLaptopPublication({ ...saved, category: "DESKTOP_COMPUTERS" }, assessments).status, "unavailable");
  assert.equal(evaluateLaptopPublication({ ...saved, draft: { ...saved.draft, diagnosticVersion: "unsupported" } }, assessments).status, "unavailable");
  assert.deepEqual({ saved, assessments }, original);
});

test("publication requires two distinct qualifying revision-member photos, beyond technical processing approval", () => {
  const { saved, assessments } = publicationFixture();
  for (const changes of [{ kind: "synthetic" }, { kind: "stock" }, { kind: "catalog" }, { kind: "screenshot" },
    { approved: false }, { derivativeAvailable: false }, { clear: "missing" }, { clear: "unavailable" }]) {
    const result = evaluateLaptopPublication(saved, { ...assessments, photos: assessments.photos.map((photo) => ({ ...photo, ...changes })) });
    assert.equal(result.eligible, false, JSON.stringify(changes));
    assert.ok(result.checks.some((check) => check.field === "photos" && check.status === "missing"));
  }
  for (const photos of [[], [assessments.photos[0]], [assessments.photos[0], assessments.photos[0]],
    [...assessments.photos.slice(0, 1), { ...assessments.photos[1], id: "another-revision-photo" }]]) {
    assert.equal(evaluateLaptopPublication(saved, { ...assessments, photos }).status, "incomplete");
  }
  for (const changes of [{ kind: "unknown" }, { clear: "review" }]) {
    assert.equal(evaluateLaptopPublication(saved, { ...assessments, photos: assessments.photos.map((photo) => ({ ...photo, ...changes })) }).status, "review-required");
  }
  assert.equal(evaluateLaptopPublication(saved, { ...assessments, defectCoverage: "review" }).status, "review-required");
  const third = "fictional-photo-c";
  const threePhotos = { ...saved, photoIds: [...saved.photoIds, third] };
  for (const extra of [{}, { kind: "unsupported-kind" }, { clear: "unsupported-outcome" }, { clear: "unavailable" }]) {
    const photos = [...assessments.photos, { ...assessments.photos[0], id: third, clear: "unavailable", ...extra }];
    assert.equal(evaluateLaptopPublication(threePhotos, { ...assessments, photos }).eligible, false);
  }
  assert.equal(evaluateLaptopPublication(threePhotos, assessments).eligible, false);
});

test("unknown brand/model requires the applicable markings or different-angle evidence and descriptive facts", () => {
  for (const identity of [{ brand: " Unknown " }, { model: "unknown" }, { brand: "Unknown", model: "Unknown" }]) {
    const { saved, assessments } = publicationFixture();
    saved.draft = { ...saved.draft, ...identity };
    assert.equal(evaluateLaptopPublication(saved, assessments).eligible, false);
    for (const [markings, property, ids] of [["present", "markingPhotoIds", [saved.photoIds[0]]],
      ["absent", "differentAnglePhotoIds", saved.photoIds]]) {
      const complete = { ...assessments, markings, [property]: ids, descriptiveFacts: "pass" };
      assert.equal(evaluateLaptopPublication(saved, complete).status, "eligible");
      assert.equal(evaluateLaptopPublication(saved, { ...complete, [property]: [] }).status, "incomplete");
      assert.equal(evaluateLaptopPublication(saved, { ...complete, [property]: ["foreign-photo"] }).status, "incomplete");
      assert.equal(evaluateLaptopPublication(saved, { ...complete, descriptiveFacts: "review" }).status, "review-required");
    }
    assert.equal(evaluateLaptopPublication(saved, { ...assessments, markings: "unknown" }).status, "review-required");
  }
});

test("publication distinguishes hazardous batteries from ambiguous safety and preserves accepted laptop/lock semantics", () => {
  const { saved, assessments } = publicationFixture();
  for (const sample of samples) {
    const result = evaluateLaptopPublication({ ...saved, draft: laptopDraftSchema.parse({ ...sample.draft, fulfillment: "both" }) }, assessments);
    assert.equal(result.status, sample.safety === "blocked" ? "ineligible" : sample.safety === "hold" ? "review-required" : "eligible", sample.name);
    if (["blocked", "hold"].includes(sample.safety)) assert.equal(result.checks.some((check) => check.field === "safety" && check.status === "missing"), false);
  }
  for (const lock of ["activation", "firmware", "managed", "other"]) {
    const locked = { ...saved, draft: { ...saved.draft, answers: { ...saved.draft.answers, lock }, notes: { lock: "Fictional known lock; removal capability unknown" } } };
    assert.equal(evaluateLaptopPublication(locked, assessments).status, "eligible");
    assert.equal(evaluateLaptopPublication({ ...locked, draft: { ...locked.draft, notes: {} } }, assessments).status, "incomplete");
  }
});

test("sensitive text and all accepted risk signals require review without returning private findings or treating ambiguity as guilt", () => {
  const { saved, assessments } = publicationFixture();
  for (const field of reviewChecks) {
    const privateAssessments = { ...assessments, risk: { ...assessments.risk, [field]: "review" },
      privateFinding: "PRIVATE_FINDING_SENTINEL", matchedText: "PRIVATE_MATCH_SENTINEL", deviceIdentifier: "PRIVATE_IDENTIFIER_SENTINEL" };
    const result = evaluateLaptopPublication(saved, privateAssessments);
    assert.equal(result.status, "review-required", field);
    assert.equal(result.eligible, false);
    assert.equal(result.checks.some((check) => check.status === "ineligible"), false);
    assert.equal(result.checks.some((check) => check.field === field), false);
    assert.ok(result.checks.some((check) => check.field === "publication-review"));
    for (const sentinel of ["PRIVATE_FINDING_SENTINEL", "PRIVATE_MATCH_SENTINEL", "PRIVATE_IDENTIFIER_SENTINEL"]) assert.equal(JSON.stringify(result).includes(sentinel), false);
  }
  for (const property of ["adultEligible", "emailVerified"]) {
    assert.equal(evaluateLaptopPublication({ ...saved, account: { ...saved.account, [property]: false } }, assessments).status, "incomplete");
  }
  assert.equal(evaluateLaptopPublication({ ...saved, account: { ...saved.account, publicationRestricted: true } }, assessments).status, "review-required");
});

test("draft validation reuses accepted rules, permits incompleteness and never accepts owner/lifecycle overrides", () => {
  const blank = laptopDraftSchema.parse({});
  assert.equal(blank.fulfillment, "");
  for (const fulfillment of ["", "pickup", "meetup", "both"]) {
    assert.equal(laptopDraftSchema.parse({ fulfillment }).fulfillment, fulfillment);
  }
  assert.equal(validatedDraftCondition(blank), null);
  for (const sample of samples) {
    const draft = laptopDraftSchema.parse(sample.draft);
    assert.equal(validatedDraftCondition(draft), {
      "Fully functional": "FULLY_FUNCTIONAL", "Functional with issues": "FUNCTIONAL_WITH_ISSUES",
      "Not functional": "NOT_FUNCTIONAL", "Untested/unknown": "UNTESTED_UNKNOWN",
    }[sample.expected] ?? null);
  }
  const good = copyDraft(samples[0].draft);
  for (const draft of [
    { ...good, answers: { ...good.answers, lock: "managed" }, notes: {} },
    { ...good, answers: { ...good.answers, charger: "no" } },
    { ...good, answers: { ...good.answers, safety: "no-battery" } },
    { ...good, behavior: ["none", "heat"] },
    { ...good, included: ["Laptop", "Charger", "Other supported accessories"], includedNotes: "" },
  ]) assert.equal(validatedDraftCondition(laptopDraftSchema.parse(draft)), null);
  for (const draft of [
    { sellerId: randomUUID() }, { accountId: randomUUID() }, { condition: "FULLY_FUNCTIONAL" }, { status: "PUBLISHED" },
    { barangay: "sample-a" }, { barangayCode: "sample-b" }, { barangayCode: "anything" }, { photos: [] },
    { media: [] }, { ownershipDeclared: true }, { category: "SMARTPHONES_TABLETS" },
    ...[null, true, [], ["pickup", "meetup"], "shipping", "delivery", "exact synthetic location"].map((fulfillment) => ({ fulfillment })),
    { exactAddress: "Synthetic address" }, { pickupAddress: "Synthetic address" },
    { meetingLocation: "Synthetic meeting point" }, { latitude: 8.4, longitude: 124.6 }, { coordinates: [8.4, 124.6] },
    { listingType: "BUNDLE" }, { quantity: 2 }, { diagnosticVersion: "invented-v2" },
    { answers: { power: "invented" } }, { answers: { secret: "anything" } }, { notes: { secret: "anything" } },
    { privatePriceExpectation: 2.5 }, { privatePriceExpectation: "2.505" },
  ]) assert.equal(laptopDraftSchema.safeParse(draft).success, false, JSON.stringify(draft));
  assert.equal(laptopDraftSchema.parse({ privatePriceExpectation: "0002.5" }).privatePriceExpectation, "2.50");
});

test("owner-private laptop drafts in disposable synthetic PostgreSQL", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth, connection } = sandbox;
  const operations = createLaptopDraftOperations(database, auth);
  const handler = createLaptopDraftHandler(operations, origin);
  const cookieHeaders = (result) => new Headers({ cookie: result.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
  // Direct synthetic identity/credential fixtures avoid unrelated signup/email work.
  const fixture = async (mapped = true) => {
    const id = randomUUID(), email = `${id}@example.invalid`, password = "synthetic-draft-password-only";
    const { password: hashing } = await auth.$context;
    await database.user.create({ data: { id, name: "Synthetic owner", email, emailVerified: false } });
    await database.account.create({ data: { id: randomUUID(), userId: id, accountId: id,
      providerId: "credential", password: await hashing.hash(password) } });
    const account = mapped ? await database.userAccount.create({ data: { authUserId: id,
      displayName: "Synthetic owner", adultEligibilityCheckedAt: new Date(), adultAttestedAt: new Date() } }) : null;
    const signedIn = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
    const headers = cookieHeaders(signedIn);
    const actor = await auth.api.getSession({ headers });
    return { userId: id, accountId: account?.id, headers, actor, email, password };
  };
  const send = (owner, method, body, id, extra = {}) => handler(new Request(`${origin}/api/laptop-drafts${id ? `/${id}` : ""}`, {
    method, headers: { origin, "content-type": "application/json", cookie: owner?.headers.get("cookie") ?? "", ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), id);
  const read = async (response, status, expected) => {
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(response.headers.get("vary"), "Cookie");
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(response.headers.get("location"), null);
    const value = await response.json();
    if (expected) assert.deepEqual(value, expected);
    if (status !== 200) assert.deepEqual(response.headers.getSetCookie(), []);
    return value;
  };
  const counts = () => Promise.all([database.listing.count(), database.listingRevision.count(),
    database.listedItemGroup.count(), database.diagnosticAnswer.count()]);
  const history = (id) => database.listingRevision.findMany({ where: { listingId: id }, orderBy: { version: "asc" },
    include: { itemGroups: { include: { answers: { orderBy: { questionKey: "asc" } } } } } });
  const restrict = (account, scope, extra = {}) => database.accountMarketplaceRestriction.create({ data: {
    accountId: account.accountId, scope, reason: "Synthetic private review reason",
    startsAt: new Date(Date.now() - 120000), reviewAt: new Date(Date.now() - 60000),
    authorizedBy: "synthetic-authorized-operator", appealRoute: "synthetic-private-appeal", ...extra,
  } });
  const state = async (id) => ({ counts: await counts(), history: await history(id),
    listing: await database.listing.findUnique({ where: { id } }),
    sessions: await database.session.findMany({ orderBy: { id: "asc" } }) });

  try {
    await t.test("saved revision review is owner-only, pinned, server-derived and separates private data without writes", async () => {
      const account = await fixture(), stranger = await fixture();
      const created = await operations.create(account.headers, input({ privatePriceExpectation: "8123456.78" }));
      const reviewRequest = (actor, revision = "1", extra = {}) => handler(new Request(
        `${origin}/api/laptop-drafts/${created.id}/review?revision=${revision}`, {
          headers: { cookie: actor?.headers.get("cookie") ?? "", ...extra },
        }), created.id, true);
      const before = await history(created.id);
      const sideEffects = async () => ({ listing: await database.listing.findUnique({ where: { id: created.id } }),
        cycles: await database.publicationCycle.count(), outbox: await database.outboxEvent.count(),
        notices: await database.passwordChangeNotice.count(), photos: await database.draftPhotoEvent.count() });
      const unchanged = await sideEffects();
      const review = await read(await reviewRequest(account), 200);
      assert.equal(review.listingId, created.id);
      assert.equal(review.revision, 1);
      assert.equal(review.status, "DRAFT");
      assert.equal(review.savedAt, before[0].createdAt.toISOString());
      assert.deepEqual(review.ownerPrivate, { privatePriceExpectation: "8123456.78" });
      assert.equal(JSON.stringify(review.proposedPublicContent).includes("8123456.78"), false);
      assert.equal(Object.hasOwn(review.proposedPublicContent, "privatePriceExpectation"), false);
      assert.equal(review.proposedPublicContent.condition, null);
      assert.equal(review.evaluation.status, "incomplete");
      assert.equal(review.evaluation.eligible, false);
      assert.equal(review.evaluation.revision, 1);
      assert.equal(review.evaluation.checks.find((check) => check.field === "email-verification").status, "missing");
      for (const field of ["title", "brand", "model", "description", "safety", "fulfillment"]) {
        assert.ok(review.missingRequirements.some((item) => item.field === field && item.href === `/drafts/${created.id}#${field}`));
      }
      for (const field of ["geography", "photo-assessment", "ownership", "publication-checks", "readiness"]) {
        assert.ok(review.unavailableRequirements.some((item) => item.field === field && item.message.length));
      }
      assert.equal(JSON.stringify(review).includes("sample-a"), false);
      for (const secret of [account.userId, account.accountId, account.actor.session.token, before[0].id]) {
        assert.equal(JSON.stringify(review).includes(secret), false);
      }
      await read(await reviewRequest(stranger), 404, { code: "NOT_FOUND" });
      await read(await reviewRequest(null), 401, { code: "UNAUTHORIZED" });
      await read(await reviewRequest(account, "99"), 404, { code: "NOT_FOUND" });
      for (const version of ["", "0", "-1", "1.5", "1e0", "2147483648"]) await read(await reviewRequest(account, version), 400, { code: "INVALID_INPUT" });
      await read(await reviewRequest(account, "1", { "sec-fetch-site": "cross-site" }), 401, { code: "UNAUTHORIZED" });
      await read(await reviewRequest(account, "1", { origin: "https://foreign.invalid" }), 401, { code: "UNAUTHORIZED" });
      await read(await handler(new Request(`${origin}/review`, { method: "POST" }), created.id, true), 404, { code: "NOT_FOUND" });
      assert.deepEqual(await history(created.id), before);
      assert.deepEqual(await sideEffects(), unchanged);

      let version = 1;
      for (const sample of samples) {
        await operations.save(account.headers, created.id, { ...input({ ...copyDraft(sample.draft), fulfillment: "both" }), expectedRevision: version++ });
        const result = await read(await reviewRequest(account, String(version)), 200);
        assert.equal(result.proposedPublicContent.condition, sample.expected);
        assert.equal(result.proposedPublicContent.safety, sample.safety);
        assert.equal(result.evaluation.status, sample.safety === "blocked" ? "ineligible" : sample.safety === "hold" ? "review-required" : "incomplete");
        assert.equal(result.evaluation.eligible, false);
        assert.equal(result.status, "DRAFT");
        assert.ok(result.proposedPublicContent.reasons.length);
        for (const reason of result.proposedPublicContent.reasons) assert.ok(reason.href.startsWith(`/drafts/${created.id}#`));
        for (const key of ["battery", "lock", "coverage", "safety"]) assert.ok(result.proposedPublicContent.disclosures.some((row) => row.field === key));
        if (["blocked", "hold"].includes(sample.safety)) {
          assert.ok(result.proposedPublicContent.reasons.every((row) => row.href.endsWith("#safety")));
        }
      }
      const historical = await read(await reviewRequest(account), 200);
      assert.equal(historical.revision, 1);
      assert.equal(historical.currentRevision, version);
      assert.deepEqual(historical.ownerPrivate, review.ownerPrivate);
      assert.deepEqual(historical.proposedPublicContent, review.proposedPublicContent);
      await restrict(account, "SUSPENSION");
      const restricted = await read(await reviewRequest(account), 200); // Reads remain available.
      assert.equal(restricted.evaluation.status, "review-required");
      for (const secret of ["Synthetic private review reason", "synthetic-authorized-operator", "synthetic-private-appeal"]) {
        assert.equal(JSON.stringify(restricted).includes(secret), false);
      }
      await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: new Date() } });
      await read(await reviewRequest(account), 401, { code: "UNAUTHORIZED" });
      await database.userAccount.update({ where: { id: account.accountId }, data: { deletedAt: null } });
      await database.listing.update({ where: { id: created.id }, data: { status: "HELD" } });
      await read(await reviewRequest(account), 404, { code: "NOT_FOUND" });
      await database.listing.update({ where: { id: created.id }, data: { status: "DRAFT" } });
      await database.session.delete({ where: { id: account.actor.session.id } });
      await read(await reviewRequest(account), 401, { code: "UNAUTHORIZED" });
    });
    await t.test("availability round-trips in incomplete immutable revisions with guarded retries and owner-only reads", async () => {
      const account = await fixture(), stranger = await fixture();
      for (const initial of [undefined, "", "pickup", "meetup", "both"]) {
        const create = input(initial === undefined ? {} : { fulfillment: initial });
        const created = await read(await send(account, "POST", create), 200);
        assert.deepEqual(await read(await send(account, "POST", create), 200), created);
        let detail = await read(await send(account, "GET", undefined, created.id), 200);
        assert.equal(detail.draft.fulfillment, initial ?? "");
        assert.equal(detail.condition, null);
        assert.equal((await history(created.id))[0].fulfillment, initial || null);
        for (const fulfillment of ["pickup", "meetup", "both", "", undefined]) {
          const before = await history(created.id);
          const draft = { title: "Synthetic availability laptop", privatePriceExpectation: "12.34",
            ...(fulfillment === undefined ? {} : { fulfillment }) };
          const save = { ...input(draft), expectedRevision: detail.revision };
          const saved = await read(await send(account, "PUT", save, created.id), 200);
          assert.deepEqual(await read(await send(account, "PUT", save, created.id), 200), saved);
          const after = await history(created.id);
          assert.deepEqual(after.slice(0, -1), before);
          assert.equal(after.at(-1).fulfillment, fulfillment || null);
          detail = await read(await send(account, "GET", undefined, created.id), 200);
          assert.deepEqual(detail.draft, laptopDraftSchema.parse(draft));
          // Availability alone cannot turn unfinished diagnostics into a condition.
          assert.equal(detail.condition, null);
          assert.equal(detail.status, "DRAFT");
          await read(await send(account, "PUT", { ...save, requestId: randomUUID() }, created.id), 409, { code: "INVALID_STATE" });
          await read(await send(account, "PUT", { ...save, draft: { ...draft, fulfillment: fulfillment === "pickup" ? "meetup" : "pickup" } }, created.id),
            409, { code: "INVALID_STATE" });
          await read(await send(stranger, "GET", undefined, created.id), 404, { code: "NOT_FOUND" });
          await read(await send(stranger, "PUT", save, created.id), 404, { code: "NOT_FOUND" });
          await read(await send(null, "GET", undefined, created.id), 401, { code: "UNAUTHORIZED" });
          assert.deepEqual(await history(created.id), after);
        }
        assert.deepEqual(await read(await send(account, "POST", create), 200), created);
        await assert.rejects(database.listingRevision.update({ where: { id: create.requestId }, data: { fulfillment: "pickup" } }));
        for (const fulfillment of ["", "shipping", "Synthetic address"]) {
          await assert.rejects(database.listingRevision.create({ data: { listingId: created.id, version: 100,
            authoredById: account.accountId, listingType: "SINGLE_ITEM", category: "LAPTOPS",
            title: "Synthetic invalid storage choice", description: "", fulfillment } }));
        }
      }
      const summary = await read(await send(account, "GET"), 200);
      for (const draft of summary.drafts) assert.equal(Object.hasOwn(draft, "fulfillment"), false);
    });

    await t.test("each live scope blocks only matching writes; suspension blocks both; reads and rejected state remain intact", async () => {
      for (const scope of ["CREATE_LAPTOP_DRAFT", "EDIT_LAPTOP_DRAFT", "PUBLISH_LISTING", "SEND_INQUIRY", "SUBMIT_PROPOSAL", "SUSPENSION"]) {
        const account = await fixture();
        const original = input({ title: "Synthetic restricted draft", fulfillment: "pickup" });
        const created = await operations.create(account.headers, original);
        const firstSave = { ...input({ title: "Synthetic saved revision", fulfillment: "both" }), expectedRevision: 1 };
        await operations.save(account.headers, created.id, firstSave);
        const decision = await restrict(account, scope);
        const reviewed = await operations.review(account.headers, created.id, "1");
        assert.equal(reviewed.evaluation.status, ["PUBLISH_LISTING", "SUSPENSION"].includes(scope) ? "review-required" : "incomplete");
        const detail = await read(await send(account, "GET", undefined, created.id), 200);
        assert.equal((await read(await send(account, "GET"), 200)).drafts.length, 1);
        const create = input({ fulfillment: "meetup" }), save = { ...input({ title: "Synthetic attempted edit", fulfillment: "meetup" }), expectedRevision: 2 };
        for (const [method, body, id, blocked] of [
          ["POST", create, undefined, ["CREATE_LAPTOP_DRAFT", "SUSPENSION"].includes(scope)],
          ["PUT", save, created.id, ["EDIT_LAPTOP_DRAFT", "SUSPENSION"].includes(scope)],
        ]) {
          if (blocked) {
            const before = await state(created.id);
            await read(await send(account, method, body, id), 403, { code: "ACTION_RESTRICTED" });
            // Successful request IDs cannot bypass current restrictions on retry.
            await read(await send(account, method, method === "POST" ? original : firstSave, id),
              403, { code: "ACTION_RESTRICTED" });
            assert.deepEqual(await state(created.id), before);
            assert.deepEqual(await read(await send(account, "GET", undefined, created.id), 200), detail);
          } else {
            const result = await read(await send(account, method, body, id), 200);
            assert.equal(result.revision, method === "POST" ? 1 : 3);
          }
        }
        assert.deepEqual(await database.accountMarketplaceRestriction.findUnique({ where: { id: decision.id } }), decision);
        // Overdue review does not lift a restriction. Explicit revocation does.
        await database.accountMarketplaceRestriction.update({ where: { id: decision.id },
          data: { revokedAt: new Date(), revokedBy: "synthetic-review-operator" } });
        await assert.rejects(database.accountMarketplaceRestriction.update({ where: { id: decision.id },
          data: { revokedAt: null, revokedBy: null } }));
        if (["CREATE_LAPTOP_DRAFT", "SUSPENSION"].includes(scope)) await read(await send(account, "POST", create), 200);
        if (["EDIT_LAPTOP_DRAFT", "SUSPENSION"].includes(scope)) await read(await send(account, "PUT", save, created.id), 200);
      }
    });

    await t.test("publication review rereads live account prerequisites without granting eligibility or changing the draft", async () => {
      const account = await fixture();
      const created = await operations.create(account.headers, input({ ...samples[0].draft, fulfillment: "pickup" }));
      const before = await history(created.id);
      const check = async (field) => (await operations.review(account.headers, created.id, "1")).evaluation.checks.find((item) => item.field === field).status;
      assert.equal(await check("adult-eligibility"), "pass");
      assert.equal(await check("email-verification"), "missing");
      await database.userAccount.update({ where: { id: account.accountId }, data: { emailVerifiedAt: new Date() } });
      assert.equal(await check("email-verification"), "missing"); // Domain alone cannot override auth.
      await database.user.update({ where: { id: account.userId }, data: { emailVerified: true } });
      assert.equal(await check("email-verification"), "pass");
      await database.userAccount.update({ where: { id: account.accountId }, data: { adultEligibilityCheckedAt: null } });
      assert.equal(await check("adult-eligibility"), "missing");
      assert.equal((await operations.review(account.headers, created.id, "1")).evaluation.eligible, false);
      assert.deepEqual(await history(created.id), before);
      assert.equal((await database.listing.findUnique({ where: { id: created.id } })).status, "DRAFT");
    });

    await t.test("rejected writes do not renew an otherwise rolling session or change draft history", async () => {
      const account = await fixture();
      const draft = await operations.create(account.headers, input());
      await restrict(account, "SUSPENSION");
      const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      await database.session.update({ where: { id: account.actor.session.id },
        data: { createdAt: old, updatedAt: old, expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) } });
      const before = await state(draft.id);
      await read(await send(account, "POST", input()), 403, { code: "ACTION_RESTRICTED" });
      await read(await send(account, "PUT", { ...input(), expectedRevision: 1 }, draft.id), 403, { code: "ACTION_RESTRICTED" });
      assert.deepEqual(await state(draft.id), before);
    });

    await t.test("future restrictions, other owners and combined scopes use current stored decisions", async () => {
      const account = await fixture(), other = await fixture();
      const created = await operations.create(account.headers, input());
      await restrict(other, "SUSPENSION");
      for (const data of [{ scope: "INVENTED_SCOPE" }, { reason: " " }, { authorizedBy: " " },
        { reviewAt: new Date(0) }, { revokedAt: new Date(), revokedBy: null }]) {
        await assert.rejects(restrict(account, "CREATE_LAPTOP_DRAFT", data));
      }
      const start = new Date(Date.now() + 60000);
      const future = await restrict(account, "SUSPENSION", { startsAt: start, reviewAt: start });
      await operations.create(account.headers, input());
      await operations.save(account.headers, created.id, { ...input(), expectedRevision: 1 });
      // Both guards use the exact start instant, and reject even a successful retry.
      const atStart = createLaptopDraftOperations(database, auth, () => start);
      const before = await state(created.id);
      await assert.rejects(atStart.create(account.headers, input()), rejects("ACTION_RESTRICTED"));
      await assert.rejects(atStart.save(account.headers, created.id, { ...input(), expectedRevision: 2 }), rejects("ACTION_RESTRICTED"));
      assert.deepEqual(await state(created.id), before);
      assert.equal((await atStart.read(account.headers, created.id)).revision, 2);
      // Activation after append but before commit also rolls back every draft write.
      for (const command of ["create", "save"]) {
        let calls = 0;
        const crossing = createLaptopDraftOperations(database, auth, () => ++calls === 1 ? new Date(start.getTime() - 1) : start);
        const pending = command === "create" ? crossing.create(account.headers, input())
          : crossing.save(account.headers, created.id, { ...input(), expectedRevision: 2 });
        await assert.rejects(pending, rejects("ACTION_RESTRICTED"));
        assert.deepEqual(await state(created.id), before);
      }
      await assert.rejects(database.accountMarketplaceRestriction.update({ where: { id: future.id }, data: { scope: "PUBLISH_LISTING" } }));
      await restrict(account, "CREATE_LAPTOP_DRAFT");
      await restrict(account, "EDIT_LAPTOP_DRAFT");
      await read(await send(account, "POST", input()), 403, { code: "ACTION_RESTRICTED" });
      await read(await send(account, "PUT", { ...input(), expectedRevision: 2 }, created.id), 403, { code: "ACTION_RESTRICTED" });
      assert.deepEqual(await state(created.id), before);
    });

    await t.test("writes waiting behind restriction changes reread current scopes and suspension after the account lock", async () => {
      for (const [command, scope] of [["create", "CREATE_LAPTOP_DRAFT"], ["save", "EDIT_LAPTOP_DRAFT"], ["create", "SUSPENSION"], ["save", "SUSPENSION"]]) {
        const account = await fixture();
        const draft = await operations.create(account.headers, input());
        const before = await state(draft.id);
        const entered = Promise.withResolvers(), release = Promise.withResolvers();
        const restricting = database.$transaction(async (transaction) => {
          // The SQL trigger takes the same parent lock as the draft command.
          await transaction.accountMarketplaceRestriction.create({ data: {
            accountId: account.accountId, scope, reason: "Synthetic concurrent restriction",
            startsAt: new Date(), reviewAt: new Date(Date.now() + 60000), authorizedBy: "synthetic-operator",
          } });
          const [{ pid }] = await transaction.$queryRaw`SELECT pg_backend_pid() AS pid`;
          entered.resolve(pid);
          await release.promise;
        }, { timeout: 10000 });
        const blocker = await entered.promise;
        const pending = command === "create" ? operations.create(account.headers, input())
          : operations.save(account.headers, draft.id, { ...input(), expectedRevision: 1 });
        const rejected = assert.rejects(pending, rejects("ACTION_RESTRICTED"));
        try {
          let blocked = false;
          for (let attempt = 0; attempt < 200; attempt++) {
            await connection.query("SELECT pg_stat_clear_snapshot()");
            const result = await connection.query(`SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
              AND wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))`, [blocker]);
            if (result.rowCount) { blocked = true; break; }
            await setTimeout(10);
          }
          assert.equal(blocked, true, "Draft write must wait on this restriction transaction's exact backend");
        } finally { release.resolve(); await restricting; await rejected; }
        assert.deepEqual(await state(draft.id), before);
      }
    });

    await t.test("deleted owners cannot list, read, create or save drafts; unrelated owners remain unaffected", async () => {
      const deleted = await fixture(), unrelated = await fixture();
      const original = input({ title: "Deleted owner's private draft", privatePriceExpectation: "123.45" });
      const created = await operations.create(deleted.headers, original);
      const other = await operations.create(unrelated.headers, input({ title: "Unrelated owner's private draft" }));
      await database.userAccount.update({ where: { id: deleted.accountId }, data: { deletedAt: new Date() } });
      const beforeCounts = await counts(), beforeHistory = await history(created.id);
      const otherDetail = await operations.read(unrelated.headers, other.id);
      const sessions = await database.session.findMany({ orderBy: { id: "asc" } });
      for (const [method, body, id] of [
        ["GET"], ["GET", undefined, created.id], ["POST", input()],
        ["POST", original], // An idempotent retry must still check current eligibility.
        ["PUT", { ...input({ title: "Denied edit" }), expectedRevision: 1 }, created.id],
      ]) {
        await read(await send(deleted, method, body, id), 401, { code: "UNAUTHORIZED" });
      }
      assert.deepEqual(await counts(), beforeCounts);
      assert.deepEqual(await history(created.id), beforeHistory);
      assert.deepEqual(await database.session.findMany({ orderBy: { id: "asc" } }), sessions);
      assert.deepEqual(await operations.read(unrelated.headers, other.id), otherDetail);
      const saved = await read(await send(unrelated, "PUT", {
        ...input({ title: "Unrelated owner can still edit" }), expectedRevision: 1,
      }, other.id), 200);
      assert.equal(saved.revision, 2);
      await read(await send(unrelated, "POST", input()), 200);
      assert.equal((await read(await send(unrelated, "GET"), 200)).drafts.length, 2);
      assert.deepEqual(await history(created.id), beforeHistory);
    });

    const owner = await fixture(), other = await fixture();
    await t.test("list requires a current owner session and has an explicit minimal projection", async () => {
      await read(await send(null, "GET"), 401, { code: "UNAUTHORIZED" });
      await read(await send(owner, "GET"), 200, { drafts: [] });
      const own = await operations.create(owner.headers, input({ title: "Synthetic summary", privatePriceExpectation: "1234567.89" }));
      const foreign = await operations.create(other.headers, input({ title: "Other owner's private title" }));
      const result = await read(await send(owner, "GET"), 200);
      assert.equal(result.drafts.length, 1);
      assert.deepEqual(Object.keys(result.drafts[0]).sort(), ["condition", "id", "revision", "title", "updatedAt"]);
      assert.equal(result.drafts[0].id, own.id);
      assert.equal(result.drafts[0].condition, null);
      assert.ok(!JSON.stringify(result).includes("1234567.89"));
      assert.ok(!JSON.stringify(result).includes(foreign.id));
      const saved = await operations.save(owner.headers, own.id, { ...input(copyDraft(samples[0].draft)), expectedRevision: 1 });
      const summary = (await operations.list(owner.headers)).drafts[0];
      assert.equal(summary.revision, saved.revision);
      assert.equal(summary.condition, "FULLY_FUNCTIONAL");
      const unmapped = await fixture(false);
      await read(await send(unmapped, "GET"), 401, { code: "UNAUTHORIZED" });
      await database.userAccount.update({ where: { id: owner.accountId }, data: { deletedAt: new Date() } });
      await read(await send(owner, "GET"), 401, { code: "UNAUTHORIZED" });
      await database.userAccount.update({ where: { id: owner.accountId }, data: { deletedAt: null } });
    });
    let listingId;
    await t.test("unverified authenticated owner creates incomplete draft, server owns seller and condition", async () => {
      const before = await counts();
      await read(await send(null, "POST", input()), 401, { code: "UNAUTHORIZED" });
      for (const data of [{ ...input(), sellerId: other.accountId }, input({ sellerId: other.accountId }),
        input({ barangayCode: "sample-a" }), input({ status: "HELD" }), input({ privatePriceExpectation: "1.234" })]) {
        await read(await send(owner, "POST", data), 400, { code: "INVALID_INPUT" });
      }
      assert.deepEqual(await counts(), before);
      const create = input({ title: "Synthetic private unfinished laptop", privatePriceExpectation: "987654.32" });
      owner.headers.set("x-account-id", other.accountId);
      const created = await read(await send(owner, "POST", create), 200);
      listingId = created.id;
      assert.deepEqual(Object.keys(created).sort(), ["id", "revision"]);
      assert.equal(created.revision, 1);
      assert.deepEqual(await read(await send(owner, "POST", create), 200), created);
      const row = await database.listing.findUnique({ where: { id: listingId } });
      assert.equal(row.sellerId, owner.accountId);
      assert.equal(row.status, "DRAFT");
      const saved = (await history(listingId))[0];
      assert.equal(saved.authoredById, owner.accountId);
      assert.equal(saved.id, create.requestId);
      assert.equal(saved.barangayCode, null);
      assert.equal(saved.conditionSummary, null);
      assert.equal(saved.itemGroups[0].quantity, 1);
      assert.equal(saved.itemGroups[0].condition, null);
      assert.equal(saved.priceExpectation.toFixed(2), "987654.32");
      const detail = await read(await send(owner, "GET", undefined, listingId), 200);
      assert.deepEqual(Object.keys(detail).sort(), ["id", "status", "revision", "createdAt", "updatedAt", "condition", "draft", "photos"].sort());
      assert.deepEqual(detail.draft, laptopDraftSchema.parse(create.draft));
      assert.equal(detail.condition, null);
      for (const secret of [owner.userId, owner.accountId, other.accountId, owner.actor.session.token, create.requestId]) {
        assert.equal(JSON.stringify(detail).includes(secret), false);
      }
      await read(await send(owner, "POST", { ...create, draft: { title: "Changed retry" } }), 409, { code: "INVALID_STATE" });
    });

    await t.test("every read/edit checks owner and live stored session; unrelated reads expose no private projection", async () => {
      const before = await history(listingId);
      for (const id of [listingId, randomUUID()]) {
        await read(await send(other, "GET", undefined, id), 404, { code: "NOT_FOUND" });
        await read(await send(other, "PUT", { ...input(), expectedRevision: 1 }, id), 404, { code: "NOT_FOUND" });
      }
      await read(await send(null, "GET", undefined, listingId), 401, { code: "UNAUTHORIZED" });
      const unmapped = await fixture(false);
      await read(await send(unmapped, "POST", input()), 401, { code: "UNAUTHORIZED" });
      await database.userAccount.update({ where: { id: other.accountId }, data: { deletedAt: new Date() } });
      await read(await send(other, "POST", input()), 401, { code: "UNAUTHORIZED" });
      await database.userAccount.update({ where: { id: other.accountId }, data: { deletedAt: null } });
      // A stale auth snapshot cannot authorize after revoke, expiry, future creation or token replacement.
      const stale = { api: { getSession: async () => ({ response: other.actor, headers: new Headers() }) } };
      const staleOperations = createLaptopDraftOperations(database, stale);
      const session = await database.session.findUnique({ where: { id: other.actor.session.id } });
      for (const data of [{ expiresAt: new Date(0) }, { createdAt: new Date(Date.now() + 60000) }, { token: randomUUID() }]) {
        await database.session.update({ where: { id: session.id }, data });
        await assert.rejects(staleOperations.create(other.headers, input()), rejects("UNAUTHORIZED"));
        await assert.rejects(staleOperations.list(other.headers), rejects("UNAUTHORIZED"));
        await assert.rejects(staleOperations.read(other.headers, listingId), rejects("UNAUTHORIZED"));
        await assert.rejects(staleOperations.review(other.headers, listingId, "1"), rejects("UNAUTHORIZED"));
        await assert.rejects(staleOperations.save(other.headers, listingId, { ...input(), expectedRevision: 1 }), rejects("UNAUTHORIZED"));
        await database.session.update({ where: { id: session.id }, data: {
          createdAt: session.createdAt, expiresAt: session.expiresAt, token: session.token } });
      }
      await database.session.delete({ where: { id: session.id } });
      await assert.rejects(staleOperations.list(other.headers), rejects("UNAUTHORIZED"));
      await assert.rejects(staleOperations.create(other.headers, input()), rejects("UNAUTHORIZED"));
      await assert.rejects(staleOperations.read(other.headers, listingId), rejects("UNAUTHORIZED"));
      await assert.rejects(staleOperations.save(other.headers, listingId, { ...input(), expectedRevision: 1 }), rejects("UNAUTHORIZED"));
      assert.deepEqual(await history(listingId), before);
    });

    await t.test("valid answers derive on server; incomplete, contradictory and unsafe revisions keep null condition and immutable answers", async () => {
      const first = (await history(listingId))[0];
      let version = 1;
      const good = { ...copyDraft(samples[0].draft), approximateAge: "About four years", privatePriceExpectation: "1234.56" };
      const cases = [
        [good, "FULLY_FUNCTIONAL"],
        [{ ...good, answers: { ...good.answers, lock: "managed" }, notes: {} }, null],
        [{ ...good, answers: { ...good.answers, charger: "no" } }, null],
        [{ ...good, answers: { ...good.answers, safety: "no-battery" } }, null],
        [{ ...good, answers: { ...good.answers, battery: "degraded" }, notes: { battery: "Synthetic runtime issue" } }, "FUNCTIONAL_WITH_ISSUES"],
        [{ ...good, answers: { ...good.answers, safety: "hazard" } }, null],
        [{ ...good, answers: { ...good.answers, safety: "uncertain" } }, null],
        [{}, null],
      ];
      for (const [draft, condition] of cases) {
        const data = { ...input(draft), expectedRevision: version };
        const before = await history(listingId);
        const saved = await read(await send(owner, "PUT", data, listingId), 200);
        assert.equal(saved.revision, ++version);
        assert.deepEqual(await read(await send(owner, "PUT", data, listingId), 200), saved);
        const after = await history(listingId);
        assert.deepEqual(after.slice(0, -1), before);
        assert.equal(after.at(-1).conditionSummary, condition);
        assert.equal(after.at(-1).itemGroups[0].condition, condition);
        const detail = await read(await send(owner, "GET", undefined, listingId), 200);
        assert.deepEqual(detail.draft, laptopDraftSchema.parse(draft));
        assert.equal(detail.condition, condition);
        assert.equal(detail.status, "DRAFT");
      }
      assert.deepEqual((await history(listingId))[0], first);
      await assert.rejects(database.listingRevision.update({ where: { id: first.id }, data: { title: "Cannot overwrite" } }));
      await assert.rejects(database.listedItemGroup.update({ where: { id: first.itemGroups[0].id }, data: { condition: "FULLY_FUNCTIONAL" } }));
      await assert.rejects(database.diagnosticAnswer.update({ where: { id: first.itemGroups[0].answers[0].id }, data: { answer: "Cannot overwrite" } }));
    });

    await t.test("concurrent creates/retries are idempotent; competing revision saves cannot overwrite each other", async () => {
      const create = input({ title: "Synthetic concurrent draft" });
      const [a, b] = await Promise.all([operations.create(owner.headers, create), operations.create(owner.headers, create)]);
      assert.deepEqual(a, b);
      assert.equal((await history(a.id)).length, 1);
      const same = { ...input({ title: "Synthetic same retry", fulfillment: "both" }), expectedRevision: 1 };
      assert.deepEqual(...await Promise.all([operations.save(owner.headers, a.id, same), operations.save(owner.headers, a.id, same)]));
      const results = await Promise.allSettled(["A", "B"].map((title) => operations.save(owner.headers, a.id,
        { ...input({ title }), expectedRevision: 2 })));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.ok(rejects("INVALID_STATE")(results.find((result) => result.status === "rejected").reason));
      assert.equal((await history(a.id)).length, 3);
      // Earlier successful requests remain safe retries after later revisions.
      assert.deepEqual(await operations.create(owner.headers, create), a);
      assert.equal((await operations.save(owner.headers, a.id, same)).revision, 2);
      await assert.rejects(operations.save(owner.headers, a.id, { ...same, draft: { title: "Reused key" } }), rejects("INVALID_STATE"));
      await assert.rejects(operations.save(owner.headers, a.id, { ...input(), expectedRevision: 1 }), rejects("INVALID_STATE"));
    });

    await t.test("reads and writes waiting behind revocation recheck stored sessions after the exact account lock", async () => {
      for (const command of ["review", "read", "save", "create", "list"]) {
        const account = await fixture();
        const draft = await operations.create(account.headers, input());
        const before = await counts();
        const entered = Promise.withResolvers(), release = Promise.withResolvers();
        const revoking = database.$transaction(async (transaction) => {
          await transaction.$queryRaw`SELECT a.id FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
            WHERE u.id = ${account.userId} FOR UPDATE OF u, a`;
          const [{ pid }] = await transaction.$queryRaw`SELECT pg_backend_pid() AS pid`;
          entered.resolve(pid);
          await release.promise;
          await transaction.session.delete({ where: { id: account.actor.session.id } });
        }, { timeout: 10000 });
        const blocker = await entered.promise;
        const stale = createLaptopDraftOperations(database, { api: { getSession: async () =>
          ({ response: account.actor, headers: new Headers() }) } });
        const pending = command === "review" ? stale.review(account.headers, draft.id, "1") : command === "list" ? stale.list(account.headers) : command === "create" ? stale.create(account.headers, input()) : command === "save"
          ? stale.save(account.headers, draft.id, { ...input(), expectedRevision: 1 }) : stale.read(account.headers, draft.id);
        const rejected = assert.rejects(pending, rejects("UNAUTHORIZED"));
        try {
          let blocked = false;
          for (let attempt = 0; attempt < 200; attempt++) {
            await connection.query("SELECT pg_stat_clear_snapshot()");
            const result = await connection.query(`SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
              AND wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))`, [blocker]);
            if (result.rowCount) { blocked = true; break; }
            await setTimeout(10);
          }
          assert.equal(blocked, true, "Draft operation must wait on this account's exact revocation backend");
        } finally { release.resolve(); await revoking; await rejected; }
        assert.deepEqual(await counts(), before);
      }
    });

    await t.test("required write and deferred commit failures roll back creation and edits; retry works", async () => {
      await connection.query(`CREATE FUNCTION synthetic_draft_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic-private-draft-error'; END $$`);
      for (const deferred of [false, true]) {
        const draft = input({ title: "Synthetic rollback" });
        const before = await counts();
        const old = await history(listingId);
        await connection.query(`CREATE ${deferred ? "CONSTRAINT " : ""}TRIGGER synthetic_draft_fail
          AFTER INSERT ON diagnostic_answer ${deferred ? "DEFERRABLE INITIALLY DEFERRED" : ""}
          FOR EACH ROW EXECUTE FUNCTION synthetic_draft_failure()`);
        try {
          await read(await send(owner, "POST", draft), 500, { code: "INTERNAL_ERROR" });
          await read(await send(owner, "PUT", { ...draft, expectedRevision: old.length }, listingId), 500, { code: "INTERNAL_ERROR" });
          assert.deepEqual(await counts(), before);
          assert.deepEqual(await history(listingId), old);
          assert.equal((await operations.read(owner.headers, listingId)).revision, old.length);
        } finally { await connection.query("DROP TRIGGER synthetic_draft_fail ON diagnostic_answer"); }
        await operations.create(owner.headers, draft);
        await operations.save(owner.headers, listingId, { ...input(draft.draft), expectedRevision: old.length });
      }
    });

    await t.test("origin/JSON protection and lifecycle gates expose no draft, public metadata or side effects", async () => {
      const before = await counts();
      for (const headers of [{ origin: "https://foreign.invalid" }, { origin: "null" }, { "sec-fetch-site": "cross-site" }]) {
        await read(await send(owner, "POST", input(), undefined, headers), 401, { code: "UNAUTHORIZED" });
        await read(await send(owner, "GET", undefined, listingId, headers), 401, { code: "UNAUTHORIZED" });
        await read(await send(owner, "GET", undefined, undefined, headers), 401, { code: "UNAUTHORIZED" });
      }
      const noOrigin = new Request(`${origin}/api/laptop-drafts`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      await read(await handler(noOrigin), 401, { code: "UNAUTHORIZED" });
      await read(await send(owner, "POST", input(), undefined, { "content-type": "text/plain" }), 400, { code: "INVALID_INPUT" });
      await read(await handler(new Request(`${origin}/api/laptop-drafts`, { method: "POST",
        headers: { origin, "content-type": "application/json" }, body: "{" })), 400, { code: "INVALID_INPUT" });
      assert.equal((await read(await send(owner, "GET"), 200)).drafts.some((draft) => draft.id === listingId), true);
      assert.deepEqual(await counts(), before);
      const revision = (await operations.read(owner.headers, listingId)).revision;
      for (const status of ["VALIDATING", "HELD", "PUBLISHED", "PAUSED_BY_RESERVATION", "RESOLVING_EXISTING_ACTIVITY", "REMOVED", "REJECTED", "EXPIRED", "CLOSED"]) {
        await database.listing.update({ where: { id: listingId }, data: { status,
          expiredAt: status === "EXPIRED" ? new Date() : null, closedAt: status === "CLOSED" ? new Date() : null } });
        await read(await send(owner, "GET", undefined, listingId), 404, { code: "NOT_FOUND" });
        await assert.rejects(operations.review(owner.headers, listingId, "1"), rejects("NOT_FOUND"));
        await read(await send(owner, "PUT", { ...input(), expectedRevision: revision }, listingId), 404, { code: "NOT_FOUND" });
        assert.equal((await operations.list(owner.headers)).drafts.some((draft) => draft.id === listingId), false);
      }
      await database.listing.update({ where: { id: listingId }, data: { status: "DRAFT", expiredAt: null, closedAt: null } });
      assert.deepEqual(await counts(), before);
      for (const table of ["publicationCycle", "publicationAvailabilityInterval", "ownershipDeclaration", "listingMedia",
        "outboxEvent", "accountEmailDelivery", "passwordChangeNotice"]) assert.equal(await database[table].count(), 0, table);
      assert.equal(await database.listing.count({ where: { status: { not: "DRAFT" } } }), 0);
      assert.equal(await database.listingRevision.count({ where: { barangayCode: { not: null } } }), 0);
    });
    await t.test("a draft with any prior publication cycle is excluded from list and detail", async () => {
      const { id } = await operations.create(owner.headers, input({ title: "Synthetic previously published fixture" }));
      const startsAt = new Date("2026-10-01T00:00:00Z");
      await database.publicationCycle.create({ data: { listingId: id, revisionNumber: 1, cycleNumber: 1,
        kind: "INITIAL_PUBLICATION", confirmedById: owner.accountId, startsAt,
        expiresAt: new Date("2026-10-31T00:00:00Z") } });
      assert.equal((await operations.list(owner.headers)).drafts.some((draft) => draft.id === id), false);
      await read(await send(owner, "GET", undefined, id), 404, { code: "NOT_FOUND" });
      await assert.rejects(operations.review(owner.headers, id, "1"), rejects("NOT_FOUND"));
      await read(await send(owner, "PUT", { ...input(), expectedRevision: 1 }, id), 404, { code: "NOT_FOUND" });
    });
    await t.test("scoped restrictions and suspension preserve guarded sign-in and password change", async () => {
      for (const scopes of [["CREATE_LAPTOP_DRAFT", "EDIT_LAPTOP_DRAFT"], ["SUSPENSION"]]) {
        const account = await fixture();
        for (const scope of scopes) await restrict(account, scope);
        const decisions = await database.accountMarketplaceRestriction.findMany({ where: { accountId: account.accountId } });
        const signedIn = await createAccountSignInOperation(database, auth)(new Headers(),
          { email: account.email, password: account.password });
        const headers = cookieHeaders(signedIn);
        const nextPassword = "synthetic-new-security-password";
        assert.deepEqual(await createPasswordChangeOperation(database, auth)(headers,
          { currentPassword: account.password, newPassword: nextPassword }, () => {}), { status: "PASSWORD_CHANGED" });
        assert.ok(await auth.api.getSession({ headers }));
        await createAccountSignInOperation(database, auth)(new Headers(), { email: account.email, password: nextPassword });
        assert.deepEqual(await database.accountMarketplaceRestriction.findMany({ where: { accountId: account.accountId } }), decisions);
        assert.equal(await database.passwordChangeNotice.count({ where: { accountId: account.accountId } }), 1);
      }
    });
  } finally { await sandbox.close(); }
});
