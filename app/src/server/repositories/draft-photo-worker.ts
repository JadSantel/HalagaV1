import "server-only";
import { randomUUID } from "node:crypto";
import { draftCutoff, photoPolicy } from "../../domain/draft-photo-policy.ts";
import { createSafePhoto, PhotoInvalid, photoHash, scanPhoto, type PhotoStore } from "../draft-photo-processing.ts";
import { getPrisma } from "../prisma.ts";
import type { DraftDatabase } from "./laptop-drafts.ts";

type Database = ReturnType<typeof getPrisma>;
type Photo = NonNullable<Awaited<ReturnType<Database["draftPhoto"]["findUnique"]>>>;

// Restricted system-processing/deletion projection, never a participant response.
const workerPhotoSelect = {
  id: true, listingId: true, ownerId: true, expectedRevision: true, resultRevision: true,
  contentSha256: true, byteSize: true, mediaType: true, status: true, reservedBytes: true,
  derivativeBytes: true, approvedAttemptId: true, originalDeletedAt: true, deletedAt: true,
  expiresAt: true, nextAttemptAt: true, executions: true, leaseId: true, leaseUntil: true, createdAt: true,
} as const;

/** Dependency injection is an internal test seam; HTTP/env never selects a fake scanner. */
export function createDraftPhotoWorker(database: Database, store: PhotoStore,
  scan: (path: string, signal: AbortSignal) => Promise<void> = scanPhoto, clock: () => Date = () => new Date()) {
  async function locked<T>(id: string, work: (tx: DraftDatabase, photo: Photo) => Promise<T>) {
    const scope = await database.draftPhoto.findUnique({ where: { id }, select: { listingId: true, ownerId: true } });
    if (!scope) return null;
    return database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT a.id FROM "user" u JOIN user_account a ON a."authUserId" = u.id WHERE a.id = ${scope.ownerId}::uuid FOR UPDATE OF u,a`;
      await tx.$queryRaw`SELECT id FROM listing WHERE id = ${scope.listingId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM draft_photo WHERE id = ${id}::uuid FOR UPDATE`;
      const photo = await tx.draftPhoto.findUnique({ where: { id }, select: workerPhotoSelect });
      return photo ? work(tx, photo) : null;
    }, { timeout: 45000 });
  }
  const held = async (tx: DraftDatabase, listingId: string) => !!await tx.draftRetentionHold.findFirst({
    where: { listingId, releasedAt: null }, select: { id: true } }); // Overdue holds require review, never automatic release.
  async function event(tx: DraftDatabase, photoId: string, kind: string) {
    await tx.draftPhotoEvent.upsert({ where: { photoId_kind: { photoId, kind } }, create: { photoId, kind, createdAt: clock() }, update: {} });
  }
  async function finishInterrupted(tx: DraftDatabase, photo: Photo) {
    if (photo.leaseId) await tx.draftPhotoAttempt.updateMany({ where: { id: photo.leaseId, outcome: "PROCESSING" },
      data: { outcome: "INTERRUPTED", finishedAt: clock() } });
  }
  async function cleanup() {
    const now = clock();
    // Commit deletion intent before touching bytes. A failed erase remains recoverable.
    const expired = await database.listing.findMany({ where: { status: "DRAFT", updatedAt: { lte: draftCutoff(now) }, publicationCycles: { none: {} } }, select: { id: true, sellerId: true } });
    for (const listing of expired) await database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT a.id FROM "user" u JOIN user_account a ON a."authUserId" = u.id WHERE a.id = ${listing.sellerId}::uuid FOR UPDATE OF u,a`;
      await tx.$queryRaw`SELECT id FROM listing WHERE id = ${listing.id}::uuid FOR UPDATE`;
      const current = await tx.listing.findFirst({ where: { id: listing.id, status: "DRAFT", updatedAt: { lte: draftCutoff(clock()) }, publicationCycles: { none: {} } }, select: { id: true } });
      if (!current || await held(tx, listing.id)) return;
      const photos = await tx.draftPhoto.findMany({ where: { listingId: listing.id, status: { not: "DELETED" } }, select: workerPhotoSelect });
      for (const photo of photos) {
        await finishInterrupted(tx, photo);
        await tx.draftPhoto.update({ where: { id: photo.id }, data: { status: "DELETION_PENDING", approvedAttemptId: null, leaseId: null, leaseUntil: null } });
        await event(tx, photo.id, "deletion-requested");
      }
    });

    const rows = await database.draftPhoto.findMany({ select: { id: true } });
    for (const row of rows) await locked(row.id, async (tx, photo) => {
      const now = clock();
      if (await held(tx, photo.listingId)) return;
      if (photo.status === "PROCESSING" && photo.leaseUntil && photo.leaseUntil <= now) {
        await finishInterrupted(tx, photo);
        const status = photo.executions < photoPolicy.maxAttempts && photo.expiresAt > now ? "PENDING" : "FAILED";
        await tx.draftPhoto.update({ where: { id: photo.id }, data: { status, leaseId: null, leaseUntil: null,
          nextAttemptAt: new Date(now.getTime() + 30_000 * 2 ** Math.max(0, photo.executions - 1)) } });
        await event(tx, photo.id, `interrupted:${photo.leaseId}`);
        photo = { ...photo, status, leaseId: null, leaseUntil: null };
      }
      if (photo.status === "DELETION_PENDING") {
        for (const { key } of await store.inventory()) if (key.startsWith(`${photo.id}.`)) await store.remove(key);
        await tx.draftPhoto.update({ where: { id: photo.id }, data: { status: "DELETED", reservedBytes: 0, deletedAt: now,
          originalDeletedAt: photo.originalDeletedAt ?? now, derivativeBytes: 0 } });
        await event(tx, photo.id, "deleted");
        return;
      }
      const eraseOriginal = ["APPROVED", "REJECTED", "DELETED"].includes(photo.status) || photo.expiresAt <= now;
      if (eraseOriginal && !photo.originalDeletedAt) {
        await finishInterrupted(tx, photo);
        await store.remove(`${photo.id}.original`); await store.remove(`${photo.id}.upload`);
        const status = ["UPLOADING", "PENDING", "PROCESSING"].includes(photo.status) ? "FAILED" : photo.status;
        await tx.draftPhoto.update({ where: { id: photo.id }, data: { status, originalDeletedAt: now,
          reservedBytes: photo.derivativeBytes, leaseId: null, leaseUntil: null } });
        await event(tx, photo.id, "original-deleted");
        photo = { ...photo, status, leaseId: null };
      }
      for (const { key } of await store.inventory()) if (key.startsWith(`${photo.id}.`) && key.endsWith(".jpg") &&
        key !== `${photo.id}.${photo.approvedAttemptId}.jpg` && key !== `${photo.id}.${photo.leaseId}.jpg`) await store.remove(key);
    });

    // Only this private, never-published slice is eligible. Unsupported legacy media
    // or ownership records require review; never silently cascade broader history.
    for (const listing of expired) await database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT a.id FROM "user" u JOIN user_account a ON a."authUserId" = u.id WHERE a.id = ${listing.sellerId}::uuid FOR UPDATE OF u,a`;
      await tx.$queryRaw`SELECT id FROM listing WHERE id = ${listing.id}::uuid FOR UPDATE`;
      const eligible = await tx.listing.findFirst({ where: { id: listing.id, status: "DRAFT", updatedAt: { lte: draftCutoff(clock()) },
        publicationCycles: { none: {} }, revisions: { none: { OR: [{ media: { some: {} } }, { ownershipDeclaration: { isNot: null } }] } } }, select: { id: true } });
      if (!eligible || await held(tx, listing.id) || await tx.draftPhoto.count({ where: { listingId: listing.id, status: { not: "DELETED" } } })) return;
      await tx.draftPhotoReference.deleteMany({ where: { listingId: listing.id } });
      await tx.draftPhotoEvent.deleteMany({ where: { photo: { listingId: listing.id } } });
      await tx.draftPhotoAttempt.deleteMany({ where: { photo: { listingId: listing.id } } });
      await tx.draftPhoto.deleteMany({ where: { listingId: listing.id } });
      await tx.diagnosticAnswer.deleteMany({ where: { itemGroup: { revision: { listingId: listing.id } } } });
      await tx.listedItemGroup.deleteMany({ where: { revision: { listingId: listing.id } } });
      await tx.listing.update({ where: { id: listing.id }, data: { currentRevisionNumber: null } });
      await tx.listingRevision.deleteMany({ where: { listingId: listing.id } });
      await tx.draftRetentionHold.deleteMany({ where: { listingId: listing.id, releasedAt: { not: null } } });
      await tx.listing.delete({ where: { id: listing.id } });
    });
    // A rolled-back intent is not an excuse to retain private blobs indefinitely.
    for (const { key, createdAt } of await store.inventory()) {
      const id = key.slice(0, 36);
      if (createdAt.getTime() + photoPolicy.originalLifetime > clock().getTime()) continue;
      if (!await database.draftPhoto.findUnique({ where: { id }, select: { id: true } })) await store.remove(key);
    }
  }

  async function runOnce() {
    await cleanup();
    const candidates = await database.draftPhoto.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: clock() },
      expiresAt: { gt: clock() }, originalDeletedAt: null }, orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }], select: { id: true } });
    let claim: Photo | null = null;
    for (const candidate of candidates) {
      claim = await locked(candidate.id, async (tx, photo) => {
        const listing = await tx.listing.findFirst({ where: { id: photo.listingId, sellerId: photo.ownerId, status: "DRAFT",
          updatedAt: { gt: draftCutoff(clock()) }, publicationCycles: { none: {} }, seller: { deletedAt: null } }, select: { id: true } });
        if (!listing || photo.status !== "PENDING" || photo.nextAttemptAt > clock() || photo.expiresAt <= clock() ||
            photo.executions >= photoPolicy.maxAttempts || !await tx.draftPhotoReference.count({ where: { photoId: photo.id } })) return null;
        const leaseId = randomUUID(), executions = photo.executions + 1;
        await tx.draftPhotoAttempt.create({ data: { id: leaseId, photoId: photo.id, execution: executions, startedAt: clock() } });
        return tx.draftPhoto.update({ where: { id: photo.id }, data: { status: "PROCESSING", leaseId, executions,
          leaseUntil: new Date(clock().getTime() + photoPolicy.lease) }, select: workerPhotoSelect });
      });
      if (claim) break;
    }
    if (!claim?.leaseId) return { status: "IDLE" };
    const photo = claim, leaseId = claim.leaseId;
    const abort = new AbortController();
    const heartbeat = setInterval(() => { void locked(photo.id, async (tx, current) => {
      if (current.status === "PROCESSING" && current.leaseId === leaseId && current.leaseUntil && current.leaseUntil > clock()) {
        await tx.draftPhoto.update({ where: { id: photo.id }, data: { leaseUntil: new Date(clock().getTime() + photoPolicy.lease) } });
      } else abort.abort();
    }).catch(() => abort.abort()); }, photoPolicy.heartbeat);
    const timer = setTimeout(() => abort.abort(), photoPolicy.timeout);
    let outcome = "FAILED", output: Buffer | undefined;
    try {
      output = await Promise.race([(async () => {
        const bytes = await store.read(`${photo.id}.original`);
        if (photoHash(bytes) !== photo.contentSha256) throw new PhotoInvalid();
        await scan(await store.path(`${photo.id}.original`), abort.signal);
        if (abort.signal.aborted) throw new Error("PROCESSING_TIMEOUT");
        return createSafePhoto(bytes, photo.mediaType);
      })(), new Promise<never>((_, reject) => {
        abort.signal.addEventListener("abort", () => reject(new Error("PROCESSING_TIMEOUT")), { once: true });
      })]);
      outcome = "APPROVED";
    } catch (error) { if (error instanceof PhotoInvalid) outcome = "REJECTED"; }
    finally { clearInterval(heartbeat); clearTimeout(timer); }
    const result = await locked(photo.id, async (tx, current) => {
      if (current.status !== "PROCESSING" || current.leaseId !== leaseId || !current.leaseUntil || current.leaseUntil <= clock() || current.expiresAt <= clock()) return { status: "STALE" };
      const listing = await tx.listing.findFirst({ where: { id: current.listingId, sellerId: current.ownerId, status: "DRAFT",
        updatedAt: { gt: draftCutoff(clock()) }, publicationCycles: { none: {} }, seller: { deletedAt: null } }, select: { id: true } });
      if (!listing) return { status: "STALE" };
      if (outcome === "APPROVED" && output) await store.write(`${photo.id}.${leaseId}.jpg`, output);
      await tx.draftPhotoAttempt.update({ where: { id: leaseId }, data: { outcome, finishedAt: clock() } });
      const status = outcome === "FAILED" && current.executions < photoPolicy.maxAttempts ? "PENDING" : outcome;
      await tx.draftPhoto.update({ where: { id: photo.id }, data: { status, leaseId: null, leaseUntil: null,
        approvedAttemptId: outcome === "APPROVED" ? leaseId : null, derivativeBytes: outcome === "APPROVED" ? output!.length : 0,
        nextAttemptAt: new Date(clock().getTime() + 30_000 * 2 ** (current.executions - 1)) } });
      await event(tx, photo.id, `${outcome.toLowerCase()}:${leaseId}`);
      return { status: outcome };
    });
    await cleanup();
    return result ?? { status: "STALE" };
  }
  return { cleanup, runOnce };
}
