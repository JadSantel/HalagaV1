import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";
import { createLaptopDraftOperations, LaptopDraftRejected } from "../src/server/repositories/laptop-drafts.ts";
import { createDraftPhotoOperations } from "../src/server/repositories/draft-photos.ts";
import { createDraftPhotoHandler } from "../src/server/repositories/draft-photos-http.ts";
import { createDraftPhotoWorker } from "../src/server/repositories/draft-photo-worker.ts";
import { createSafePhoto, openPhotoStore, PhotoInvalid, photoHash, readPhotoBody, scanPhoto } from "../src/server/draft-photo-processing.ts";
import { photoPolicy } from "../src/domain/draft-photo-policy.ts";

const stream = (bytes) => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
const rejected = (code) => (error) => error instanceof LaptopDraftRejected && error.code === code;
const fixtureImage = () => sharp(Buffer.from('<svg width="320" height="200"><rect width="320" height="200" fill="#eef2ee"/><path d="M50 40h220v110H50z" fill="#36443f"/><path d="M35 150h250l20 20H15z" fill="#75837c"/></svg>')).jpeg().toBuffer();

test("strict image processing removes fictional metadata and rejects unsafe inputs", async () => {
  const original = await sharp(await fixtureImage()).withExif({ IFD0: { Artist: "FICTIONAL_PRIVATE_AUTHOR", ImageDescription: "FICTIONAL_GPS_LOCATION" },
    IFD2: { GPSLatitudeRef: "N", GPSLatitude: "8/1 0/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "124/1 0/1 0/1" } })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">FICTIONAL_PRIVATE_XMP</x:xmpmeta>').toBuffer();
  assert.ok((await sharp(original).metadata()).exif);
  const output = await createSafePhoto(original, "image/jpeg");
  const metadata = await sharp(output).metadata();
  for (const key of ["exif", "xmp", "iptc", "icc", "comments"]) assert.equal(metadata[key], undefined);
  for (const sentinel of ["FICTIONAL_PRIVATE_AUTHOR", "FICTIONAL_GPS_LOCATION", "FICTIONAL_PRIVATE_XMP"]) assert.equal(output.includes(Buffer.from(sentinel)), false);
  assert.equal(metadata.format, "jpeg"); await sharp(output).raw().toBuffer();
  const png = await sharp({ create: { width: 25, height: 25, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  assert.equal((await sharp(await createSafePhoto(png, "image/png")).metadata()).format, "jpeg");
  for (const [bytes, type] of [[Buffer.alloc(0), "image/jpeg"], [Buffer.from('<svg><script>bad</script></svg>'), "image/png"],
    [original.subarray(0, 60), "image/jpeg"], [original, "image/png"], [Buffer.from("PK archive"), "image/jpeg"],
    [Buffer.from("MZ executable"), "image/jpeg"]]) await assert.rejects(createSafePhoto(bytes, type), PhotoInvalid);
  const huge = await sharp({ create: { width: 10001, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(createSafePhoto(huge, "image/png"), PhotoInvalid);
  const bomb = await sharp({ create: { width: 6000, height: 4001, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(createSafePhoto(bomb, "image/png"), PhotoInvalid);
  // APNG control chunk must be rejected even if the codec sees a static first frame.
  const animated = Buffer.concat([png.subarray(0, 33), Buffer.from([0, 0, 0, 8]), Buffer.from("acTL"), Buffer.alloc(12), png.subarray(33)]);
  await assert.rejects(createSafePhoto(animated, "image/png"), PhotoInvalid);
  await assert.rejects(readPhotoBody(stream(original), original.length - 1), PhotoInvalid);
  await assert.rejects(readPhotoBody(stream(original), original.length + 1), PhotoInvalid);
  await assert.rejects(scanPhoto("fictional-original", AbortSignal.timeout(50)), /SCANNER_UNAVAILABLE/);
});

test("private synthetic draft photos, job recovery and bounded cleanup", async (t) => {
  const sandbox = await openSignupSandbox();
  const { database, auth } = sandbox;
  const root = await mkdtemp(join(tmpdir(), "halaga-synthetic-photos-"));
  const store = await openPhotoStore(root);
  let instant = new Date();
  const clock = () => new Date(instant);
  const drafts = createLaptopDraftOperations(database, auth, clock);
  const photos = createDraftPhotoOperations(drafts, store, clock);
  const handler = createDraftPhotoHandler(photos, "http://127.0.0.1:3000");
  const worker = createDraftPhotoWorker(database, store, async () => {}, clock); // Tests only; runtime never bypasses ClamAV.
  const bytes = await fixtureImage();
  const fixture = async () => {
    const user = await database.user.create({ data: { id: randomUUID(), name: "Synthetic owner", email: `${randomUUID()}@example.invalid` } });
    const owner = await database.userAccount.create({ data: { authUserId: user.id, displayName: "Synthetic owner" } });
    const token = randomUUID();
    await database.session.create({ data: { id: randomUUID(), userId: user.id, token, createdAt: clock(), updatedAt: clock(), expiresAt: new Date(instant.getTime() + 90 * 86400000) } });
    // Resolve through a trusted internal auth double but recheck the actual stored session in commands.
    const session = await database.session.findFirst({ where: { token } });
    const fakeAuth = { api: { getSession: async ({ headers }) => ({ response: headers.get("cookie") === token ? { user, session } : null, headers: new Headers() }) } };
    const ops = createLaptopDraftOperations(database, fakeAuth, clock);
    const media = createDraftPhotoOperations(ops, store, clock);
    const headers = new Headers({ cookie: token });
    const draft = await ops.create(headers, { requestId: randomUUID(), draft: {} });
    return { owner, user, session, headers, draft, ops, media, handler: createDraftPhotoHandler(media, "http://127.0.0.1:3000") };
  };
  const admission = (revision, file = bytes, mediaType = "image/jpeg") => ({ requestId: randomUUID(), expectedRevision: revision, sha256: photoHash(file), byteSize: file.length, mediaType });
  const upload = async (actor, file = bytes) => {
    const detail = await actor.ops.read(actor.headers, actor.draft.id);
    const input = admission(detail.revision, file);
    await actor.media.admit(actor.headers, actor.draft.id, input);
    const result = await actor.media.upload(actor.headers, actor.draft.id, input.requestId, stream(file), "image/jpeg");
    return { input, result };
  };
  try {
    await t.test("upload/retries are owner-bound and images are private before and after processing", async () => {
      const a = await fixture(), b = await fixture();
      const input = admission(1);
      await a.media.admit(a.headers, a.draft.id, input);
      await a.media.admit(a.headers, a.draft.id, input);
      await assert.rejects(a.media.admit(a.headers, a.draft.id, { ...input, sha256: "a".repeat(64) }), rejected("INVALID_STATE"));
      await assert.rejects(b.media.upload(b.headers, a.draft.id, input.requestId, stream(bytes), "image/jpeg"), rejected("NOT_FOUND"));
      await assert.rejects(b.media.admit(b.headers, b.draft.id, input), rejected("INVALID_STATE"));
      const first = await a.media.upload(a.headers, a.draft.id, input.requestId, stream(bytes), "image/jpeg");
      assert.equal(first.revision, 2);
      assert.deepEqual(await a.media.upload(a.headers, a.draft.id, input.requestId, stream(bytes), "image/jpeg"), first);
      await assert.rejects(a.media.upload(a.headers, a.draft.id, input.requestId, stream(Buffer.alloc(bytes.length)), "image/jpeg"), rejected("INVALID_INPUT"));
      assert.equal(await database.draftPhoto.count({ where: { id: input.requestId } }), 1);
      assert.equal(await database.draftPhotoEvent.count({ where: { photoId: input.requestId, kind: "processing-requested" } }), 1);
      await assert.rejects(a.media.image(a.headers, a.draft.id, input.requestId, "2"), rejected("NOT_FOUND"));
      assert.equal((await a.ops.read(a.headers, a.draft.id)).photos[0].src, null);
      assert.equal((await worker.runOnce()).status, "APPROVED");
      assert.equal((await worker.runOnce()).status, "IDLE");
      assert.equal(await database.draftPhotoAttempt.count({ where: { photoId: input.requestId } }), 1);
      assert.equal((await sharp(await a.media.image(a.headers, a.draft.id, input.requestId, "2")).metadata()).format, "jpeg");
      await assert.rejects(store.read(`${input.requestId}.original`));
      await assert.rejects(b.media.image(b.headers, a.draft.id, input.requestId, "2"), rejected("NOT_FOUND"));
      await assert.rejects(a.media.image(new Headers(), a.draft.id, input.requestId, "2"), rejected("UNAUTHORIZED"));
      await assert.rejects(a.media.image(a.headers, a.draft.id, input.requestId, "1"), rejected("NOT_FOUND"));
      const response = await a.handler(new Request(`http://127.0.0.1:3000/api/laptop-drafts/${a.draft.id}/photos/${input.requestId}?revision=2`, { headers: a.headers }), a.draft.id, input.requestId);
      assert.equal(response.status, 200);
      for (const [key, value] of [["cache-control", "no-store"], ["content-type", "image/jpeg"], ["vary", "Cookie"], ["referrer-policy", "no-referrer"], ["x-content-type-options", "nosniff"]]) assert.equal(response.headers.get(key), value);
      const detail = await a.ops.read(a.headers, a.draft.id);
      assert.deepEqual(Object.keys(detail.photos[0]).sort(), ["id", "position", "src", "status"]);
      for (const secret of [input.sha256, a.owner.id, ".original", root]) assert.equal(JSON.stringify(detail).includes(secret), false);
      await database.session.delete({ where: { id: a.session.id } });
      await assert.rejects(a.media.image(a.headers, a.draft.id, input.requestId, "2"), rejected("UNAUTHORIZED"));
    });

    await t.test("invalid files, bounded admissions, origin and restricted edits cannot mutate evidence", async () => {
      const a = await fixture();
      for (const patch of [{ byteSize: 0 }, { byteSize: photoPolicy.maxBytes + 1 }, { mediaType: "image/svg+xml" }, { ownerId: randomUUID() }, { sha256: "bad" }]) {
        await assert.rejects(a.media.admit(a.headers, a.draft.id, { ...admission(1), ...patch }), rejected("INVALID_INPUT"));
      }
      const invalid = Buffer.from("MZ fictional executable");
      const input = admission(1, invalid);
      await a.media.admit(a.headers, a.draft.id, input);
      await assert.rejects(a.media.upload(a.headers, a.draft.id, input.requestId, stream(invalid), "image/jpeg"), rejected("INVALID_INPUT"));
      assert.equal((await a.ops.read(a.headers, a.draft.id)).revision, 1);
      await a.media.cancel(a.headers, a.draft.id, input.requestId);
      await a.media.cancel(a.headers, a.draft.id, input.requestId);
      assert.equal((await database.draftPhoto.findUnique({ where: { id: input.requestId } })).reservedBytes, 0);
      const response = await a.handler(new Request("http://127.0.0.1:3000/photos", { method: "POST", headers: { ...Object.fromEntries(a.headers), origin: "https://other.invalid", "content-type": "application/json" }, body: JSON.stringify(admission(1)) }), a.draft.id);
      assert.equal(response.status, 401);
      await database.accountMarketplaceRestriction.create({ data: { accountId: a.owner.id, scope: "EDIT_LAPTOP_DRAFT", reason: "Synthetic restriction", authorizedBy: "synthetic-operator", startsAt: new Date(instant.getTime() - 1000), reviewAt: new Date(instant.getTime() + 1000), appealRoute: "synthetic" } });
      await assert.rejects(a.media.admit(a.headers, a.draft.id, admission(1)), rejected("ACTION_RESTRICTED"));
      assert.deepEqual((await a.media.list(a.headers, a.draft.id)).photos, []);
    });

    await t.test("ordering/removal and ordinary saves append immutable scoped reference snapshots", async () => {
      const a = await fixture(), b = await fixture();
      const one = await upload(a), two = await upload(a), foreign = await upload(b);
      const before = await database.draftPhotoReference.findMany({ where: { listingId: a.draft.id }, orderBy: [{ revisionId: "asc" }, { sortOrder: "asc" }] });
      const command = { action: "order", requestId: randomUUID(), expectedRevision: 3, photoIds: [two.input.requestId, one.input.requestId] };
      const result = await a.media.change(a.headers, a.draft.id, command);
      assert.equal(result.revision, 4);
      assert.deepEqual(await a.media.change(a.headers, a.draft.id, command), result);
      await assert.rejects(a.media.change(a.headers, a.draft.id, { ...command, photoIds: [one.input.requestId, two.input.requestId] }), rejected("INVALID_STATE"));
      await assert.rejects(a.media.change(a.headers, a.draft.id, { ...command, requestId: randomUUID(), expectedRevision: 4, photoIds: [foreign.input.requestId, one.input.requestId] }), rejected("INVALID_INPUT"));
      await a.ops.save(a.headers, a.draft.id, { requestId: randomUUID(), expectedRevision: 4, draft: { title: "Synthetic text edit" } });
      assert.deepEqual((await a.media.list(a.headers, a.draft.id)).photos.map((p) => p.id), command.photoIds);
      await a.media.change(a.headers, a.draft.id, { action: "remove", requestId: randomUUID(), expectedRevision: 5, photoId: two.input.requestId });
      assert.deepEqual((await a.media.list(a.headers, a.draft.id)).photos.map((p) => p.id), [one.input.requestId]);
      assert.deepEqual((await a.media.list(a.headers, a.draft.id, "3")).photos.map((p) => p.id), [one.input.requestId, two.input.requestId]);
      assert.deepEqual(await database.draftPhotoReference.findMany({ where: { revisionId: { in: before.map((ref) => ref.revisionId) } }, orderBy: [{ revisionId: "asc" }, { sortOrder: "asc" }] }), before);
      const revision = await database.listingRevision.findFirst({ where: { listingId: a.draft.id, version: 1 } });
      await assert.rejects(database.draftPhotoReference.create({ data: { revisionId: revision.id, photoId: foreign.input.requestId, listingId: a.draft.id, ownerId: a.owner.id, sortOrder: 0 } }));
      await assert.rejects(database.draftPhotoReference.updateMany({ where: { photoId: one.input.requestId }, data: { sortOrder: 9 } }));
      assert.equal(await database.draftPhotoReference.count({ where: { photoId: two.input.requestId } }) > 0, true);
      const sameOwnerDraft = await a.ops.create(a.headers, { requestId: randomUUID(), draft: {} });
      const sameOwnerRevision = await database.listingRevision.findFirst({ where: { listingId: sameOwnerDraft.id } });
      await assert.rejects(database.draftPhotoReference.create({ data: { revisionId: sameOwnerRevision.id, photoId: one.input.requestId,
        listingId: sameOwnerDraft.id, ownerId: a.owner.id, sortOrder: 0 } }));
    });

    await t.test("concurrent retry and failed outbox commit preserve one revision/job with recoverable bytes", async () => {
      const a = await fixture();
      const input = admission(1);
      await Promise.all([a.media.admit(a.headers, a.draft.id, input), a.media.admit(a.headers, a.draft.id, input)]);
      await sandbox.connection.query(`CREATE FUNCTION reject_photo_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.kind = 'processing-requested' THEN RAISE EXCEPTION 'synthetic rollback'; END IF; RETURN NEW; END; $$;
        CREATE TRIGGER reject_photo_event BEFORE INSERT ON draft_photo_event FOR EACH ROW EXECUTE FUNCTION reject_photo_event()`);
      try { await assert.rejects(a.media.upload(a.headers, a.draft.id, input.requestId, stream(bytes), "image/jpeg"), rejected("INTERNAL_ERROR")); }
      finally { await sandbox.connection.query("DROP TRIGGER reject_photo_event ON draft_photo_event; DROP FUNCTION reject_photo_event()"); }
      assert.equal((await a.ops.read(a.headers, a.draft.id)).revision, 1);
      assert.equal((await database.draftPhoto.findUnique({ where: { id: input.requestId } })).status, "UPLOADING");
      assert.equal(await database.draftPhotoReference.count({ where: { photoId: input.requestId } }), 0);
      const results = await Promise.all([a.media.upload(a.headers, a.draft.id, input.requestId, stream(bytes), "image/jpeg"),
        a.media.upload(a.headers, a.draft.id, input.requestId, stream(bytes), "image/jpeg")]);
      assert.deepEqual(results[0], results[1]);
      assert.equal(await database.listingRevision.count({ where: { listingId: a.draft.id } }), 2);
      assert.equal(await database.draftPhotoEvent.count({ where: { photoId: input.requestId, kind: "processing-requested" } }), 1);
    });

    await t.test("pending slots and aggregate byte reservations are enforced across concurrent admissions", async () => {
      const a = await fixture();
      for (let index = 0; index < photoPolicy.maxCount; index++) await a.media.admit(a.headers, a.draft.id, admission(1));
      await assert.rejects(a.media.admit(a.headers, a.draft.id, admission(1)), rejected("INVALID_INPUT"));
      const otherDraft = await a.ops.create(a.headers, { requestId: randomUUID(), draft: {} });
      const allocated = await database.draftPhoto.findMany({ where: { ownerId: a.owner.id }, select: { id: true } });
      // Internal fixture models bytes retained by historical revisions, not a client allowance.
      await database.draftPhoto.update({ where: { id: allocated[0].id }, data: { reservedBytes: photoPolicy.ownerBytes } });
      await assert.rejects(a.media.admit(a.headers, otherDraft.id, admission(1)), rejected("INVALID_INPUT"));
      for (const row of allocated) await a.media.cancel(a.headers, a.draft.id, row.id);
    });

    await t.test("transient and permanent processing failures remain non-evidence; stale leases recover without duplicate approval", async () => {
      // Previous pending fixtures must be drained before targeting this isolated job.
      while ((await worker.runOnce()).status !== "IDLE") {}
      const a = await fixture();
      const one = await upload(a);
      const failed = createDraftPhotoWorker(database, store, async () => { throw new Error("FICTIONAL_PRIVATE_SCANNER_ERROR"); }, clock);
      assert.equal((await failed.runOnce()).status, "FAILED");
      assert.equal((await a.media.list(a.headers, a.draft.id)).photos[0].src, null);
      let photo = await database.draftPhoto.findUnique({ where: { id: one.input.requestId } });
      assert.equal(photo.status, "PENDING"); assert.equal(photo.executions, 1);
      assert.equal((await failed.runOnce()).status, "IDLE");
      instant = new Date(instant.getTime() + 30001);
      assert.equal((await worker.runOnce()).status, "APPROVED");
      assert.equal(await database.draftPhotoAttempt.count({ where: { photoId: photo.id } }), 2);
      const two = await upload(a);
      const rejectedWorker = createDraftPhotoWorker(database, store, async () => { throw new PhotoInvalid(); }, clock);
      assert.equal((await rejectedWorker.runOnce()).status, "REJECTED");
      assert.equal((await database.draftPhoto.findUnique({ where: { id: two.input.requestId } })).status, "REJECTED");
      await assert.rejects(store.read(`${two.input.requestId}.original`));
      const three = await upload(a);
      const leaseId = randomUUID();
      await database.draftPhotoAttempt.create({ data: { id: leaseId, photoId: three.input.requestId, execution: 1, startedAt: clock() } });
      await database.draftPhoto.update({ where: { id: three.input.requestId }, data: { status: "PROCESSING", leaseId, leaseUntil: new Date(instant.getTime() - 1), executions: 1 } });
      await worker.cleanup();
      assert.equal((await database.draftPhotoAttempt.findUnique({ where: { id: leaseId } })).outcome, "INTERRUPTED");
      instant = new Date(instant.getTime() + 30001);
      assert.equal((await worker.runOnce()).status, "APPROVED");
      photo = await database.draftPhoto.findUnique({ where: { id: three.input.requestId } });
      assert.notEqual(photo.approvedAttemptId, leaseId);
      const four = await upload(a);
      for (let index = 0; index < photoPolicy.maxAttempts; index++) {
        assert.equal((await failed.runOnce()).status, "FAILED");
        instant = new Date(instant.getTime() + 300001);
      }
      assert.equal((await database.draftPhoto.findUnique({ where: { id: four.input.requestId } })).status, "FAILED");
      assert.equal((await failed.runOnce()).status, "IDLE");
      assert.equal(await database.draftPhotoAttempt.count({ where: { photoId: four.input.requestId } }), 5);
      assert.equal((await a.media.list(a.headers, a.draft.id)).photos.find((p) => p.id === four.input.requestId).src, null);
    });

    await t.test("late processing cannot approve through a newer deletion intent; failed erasure stays recoverable", async () => {
      const a = await fixture();
      const one = await upload(a);
      let release, started;
      const ready = new Promise((accept) => { started = accept; });
      const wait = new Promise((accept) => { release = accept; });
      const slow = createDraftPhotoWorker(database, store, async () => { started(); await wait; }, clock);
      const running = slow.runOnce();
      await ready;
      const listing = await database.listing.findUnique({ where: { id: a.draft.id } });
      await database.listing.update({ where: { id: listing.id }, data: { updatedAt: new Date(instant.getTime() - photoPolicy.draftLifetime - 1) } });
      const broken = createDraftPhotoWorker(database, { ...store, remove: async (key) => {
        if (key.startsWith(one.input.requestId)) throw new Error("synthetic deletion I/O failure");
        return store.remove(key);
      } }, async () => {}, clock);
      await assert.rejects(broken.cleanup(), /synthetic deletion I\/O failure/);
      assert.equal((await database.draftPhoto.findUnique({ where: { id: one.input.requestId } })).status, "DELETION_PENDING");
      release();
      assert.equal((await running).status, "STALE");
      await worker.cleanup();
      assert.equal(await database.listing.count({ where: { id: a.draft.id } }), 0);
      assert.equal((await store.inventory()).some(({ key }) => key.startsWith(one.input.requestId)), false);
    });

    await t.test("expiry hides drafts, purges originals/history idempotently and honors scoped holds", async () => {
      while ((await worker.runOnce()).status !== "IDLE") {}
      const a = await fixture(), b = await fixture();
      const one = await upload(a), two = await upload(b);
      await worker.runOnce(); await worker.runOnce();
      const hold = await database.draftRetentionHold.create({ data: { listingId: b.draft.id, authorizedById: randomUUID(), purpose: "Synthetic scoped case hold", startedAt: clock(), reviewAt: new Date(instant.getTime() + 86400000) } });
      const pending = admission((await a.ops.read(a.headers, a.draft.id)).revision);
      await a.media.admit(a.headers, a.draft.id, pending);
      await store.write(`${pending.requestId}.upload`, bytes);
      instant = new Date(instant.getTime() + photoPolicy.originalLifetime + 1);
      await worker.cleanup(); await worker.cleanup();
      await assert.rejects(store.read(`${pending.requestId}.upload`));
      await assert.rejects(a.media.upload(a.headers, a.draft.id, pending.requestId, stream(bytes), "image/jpeg"), rejected("INVALID_STATE"));
      const saved = await database.listing.findUnique({ where: { id: a.draft.id } });
      instant = new Date(saved.updatedAt.getTime() + photoPolicy.draftLifetime);
      await assert.rejects(a.ops.read(a.headers, a.draft.id), rejected("NOT_FOUND"));
      assert.equal((await a.ops.list(a.headers)).drafts.length, 0);
      await assert.rejects(a.media.image(a.headers, a.draft.id, one.input.requestId, "2"), rejected("NOT_FOUND"));
      await worker.cleanup(); await worker.cleanup();
      assert.equal(await database.listing.count({ where: { id: a.draft.id } }), 0);
      assert.equal(await database.draftPhoto.count({ where: { listingId: a.draft.id } }), 0);
      assert.equal((await store.inventory()).some(({ key }) => key.startsWith(one.input.requestId)), false);
      // Set b to the same expired instant: the scoped hold preserves bytes/history but not owner visibility.
      await database.listing.update({ where: { id: b.draft.id }, data: { updatedAt: saved.updatedAt } });
      await worker.cleanup();
      assert.equal(await database.listing.count({ where: { id: b.draft.id } }), 1);
      assert.equal(await database.draftPhoto.count({ where: { id: two.input.requestId } }), 1);
      await assert.rejects(b.ops.read(b.headers, b.draft.id), rejected("NOT_FOUND"));
      await database.draftRetentionHold.update({ where: { id: hold.id }, data: { releasedAt: clock(), releasedById: randomUUID() } });
      await worker.cleanup();
      assert.equal(await database.listing.count({ where: { id: b.draft.id } }), 0);
    });
    // The unbound real-auth handler cannot expose test fixtures.
    assert.equal((await handler(new Request("http://127.0.0.1:3000/photos"), randomUUID())).status, 401);
  } finally { await sandbox.close(); await rm(root, { recursive: true, force: true }); }
});

