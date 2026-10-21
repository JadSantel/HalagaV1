import "server-only";
import { z } from "zod";
import { photoPolicy } from "../../domain/draft-photo-policy.ts";
import { hasPhotoSignature, photoHash, readPhotoBody, type PhotoStore } from "../draft-photo-processing.ts";
import { appendRevision, createLaptopDraftOperations, LaptopDraftRejected, projectDraftPhotos, snapshot } from "./laptop-drafts.ts";

const admission = z.strictObject({ requestId: z.uuid(), expectedRevision: z.number().int().positive().max(2147483646),
  sha256: z.string().regex(/^[0-9a-f]{64}$/), byteSize: z.number().int().positive().max(photoPolicy.maxBytes),
  mediaType: z.enum(["image/jpeg", "image/png"]) });
const mutation = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("remove"), requestId: z.uuid(), expectedRevision: z.number().int().positive().max(2147483646), photoId: z.uuid() }),
  z.strictObject({ action: z.literal("order"), requestId: z.uuid(), expectedRevision: z.number().int().positive().max(2147483646), photoIds: z.array(z.uuid()).max(photoPolicy.maxCount) }),
]);
const reject = (code: LaptopDraftRejected["code"]): never => { throw new LaptopDraftRejected(code); };

export function createDraftPhotoOperations(drafts: ReturnType<typeof createLaptopDraftOperations>, store: PhotoStore,
  clock: () => Date = () => new Date()) {
  const uuid = (value: string) => { if (!z.uuid().safeParse(value).success) reject("INVALID_INPUT"); };
  return {
    async admit(headers: Headers, listingId: string, input: unknown, apply?: (headers: Headers) => void) {
      const parsed = admission.safeParse(input);
      if (!parsed.success) return reject("INVALID_INPUT");
      const value = parsed.data;
      return drafts.withDraft(headers, listingId, async (tx, listing, owner) => {
        // Internal upload-command projection; never returned as an owner payload.
        const old = await tx.draftPhoto.findUnique({ where: { id: value.requestId }, select: {
          id: true, ownerId: true, listingId: true, expectedRevision: true, contentSha256: true,
          byteSize: true, mediaType: true, status: true, resultRevision: true,
        } });
        if (old) {
          if (old.ownerId !== owner || old.listingId !== listingId || old.expectedRevision !== value.expectedRevision ||
              old.contentSha256 !== value.sha256 || old.byteSize !== value.byteSize || old.mediaType !== value.mediaType) reject("INVALID_STATE");
          return { photoId: old.id, status: old.status, revision: old.resultRevision };
        }
        if (listing.currentRevisionNumber !== value.expectedRevision) reject("INVALID_STATE");
        snapshot(listing.currentRevision!);
        const pending = await tx.draftPhoto.count({ where: { listingId, status: "UPLOADING" } });
        if (pending + listing.currentRevision!.draftPhotos.length >= photoPolicy.maxCount) reject("INVALID_INPUT");
        const usage = await tx.draftPhoto.aggregate({ where: { ownerId: owner }, _sum: { reservedBytes: true } });
        const reservedBytes = value.byteSize + photoPolicy.maxBytes;
        if ((usage._sum.reservedBytes ?? 0) + reservedBytes > photoPolicy.ownerBytes) reject("INVALID_INPUT");
        const now = clock();
        await tx.draftPhoto.create({ data: { id: value.requestId, listingId, ownerId: owner,
          expectedRevision: value.expectedRevision, contentSha256: value.sha256, byteSize: value.byteSize,
          mediaType: value.mediaType, reservedBytes, createdAt: now,
          expiresAt: new Date(now.getTime() + photoPolicy.originalLifetime) } });
        await tx.draftPhotoEvent.create({ data: { photoId: value.requestId, kind: "admitted", createdAt: now } });
        return { photoId: value.requestId, status: "UPLOADING", revision: null };
      }, apply, true);
    },
    async upload(headers: Headers, listingId: string, photoId: string, body: ReadableStream<Uint8Array> | null,
      mediaType: string, apply?: (headers: Headers) => void) {
      uuid(photoId);
      return drafts.withDraft(headers, listingId, async (tx, listing, owner) => {
        const photo = await tx.draftPhoto.findFirst({ where: { id: photoId, ownerId: owner, listingId }, select: {
          id: true, expectedRevision: true, contentSha256: true, byteSize: true, mediaType: true,
          resultRevision: true, status: true, expiresAt: true,
        } });
        if (!photo) return reject("NOT_FOUND");
        if (mediaType !== photo.mediaType) reject("INVALID_INPUT");
        let bytes: Buffer;
        try { bytes = await readPhotoBody(body, photo.byteSize); } catch { return reject("INVALID_INPUT"); }
        if (photoHash(bytes) !== photo.contentSha256 || !hasPhotoSignature(bytes, photo.mediaType)) reject("INVALID_INPUT");
        if (photo.resultRevision !== null) return { id: listingId, revision: photo.resultRevision };
        if (photo.status !== "UPLOADING" || photo.expiresAt <= clock()) reject("INVALID_STATE");
        if (listing.currentRevisionNumber !== photo.expectedRevision || listing.currentRevision!.draftPhotos.length >= photoPolicy.maxCount) reject("INVALID_STATE");
        // Owner lock serializes finalization, retry and cleanup, including byte writes.
        await store.remove(`${photoId}.upload`);
        await store.remove(`${photoId}.original`);
        await store.write(`${photoId}.upload`, bytes);
        await store.commitUpload(photoId);
        const version = photo.expectedRevision + 1;
        await appendRevision(tx, owner, listingId, version, photoId, snapshot(listing.currentRevision!),
          [...listing.currentRevision!.draftPhotos.map((ref) => ref.photoId), photoId], `upload:${photoId}`);
        await tx.listing.update({ where: { id: listingId }, data: { currentRevisionNumber: version, updatedAt: clock() }, select: { id: true } });
        // This row is the durable PostgreSQL processing job. Event + domain/job commit together.
        await tx.draftPhoto.update({ where: { id: photoId }, data: { resultRevision: version, status: "PENDING", nextAttemptAt: clock() } });
        await tx.draftPhotoEvent.create({ data: { photoId, kind: "processing-requested", createdAt: clock() } });
        return { id: listingId, revision: version };
      }, apply, true);
    },
    async change(headers: Headers, listingId: string, input: unknown, apply?: (headers: Headers) => void) {
      const parsed = mutation.safeParse(input);
      if (!parsed.success) return reject("INVALID_INPUT");
      const value = parsed.data, command = JSON.stringify(parsed.data);
      return drafts.withDraft(headers, listingId, async (tx, listing, owner) => {
        const old = await tx.listingRevision.findUnique({ where: { id: value.requestId }, select: { listingId: true, authoredById: true, photoCommand: true, version: true } });
        if (old) {
          if (old.listingId !== listingId || old.authoredById !== owner || old.photoCommand !== command) reject("INVALID_STATE");
          return { id: listingId, revision: old.version };
        }
        if (listing.currentRevisionNumber !== value.expectedRevision) reject("INVALID_STATE");
        const current = listing.currentRevision!.draftPhotos.map((ref) => ref.photoId);
        const next = value.action === "remove" ? current.filter((id) => id !== value.photoId) : value.photoIds;
        if (value.action === "remove" ? next.length !== current.length - 1 :
            next.length !== current.length || new Set(next).size !== next.length || next.some((id) => !current.includes(id))) reject("INVALID_INPUT");
        const version = value.expectedRevision + 1;
        await appendRevision(tx, owner, listingId, version, value.requestId, snapshot(listing.currentRevision!), next, command);
        await tx.listing.update({ where: { id: listingId }, data: { currentRevisionNumber: version, updatedAt: clock() }, select: { id: true } });
        return { id: listingId, revision: version };
      }, apply, true);
    },
    async cancel(headers: Headers, listingId: string, photoId: string, apply?: (headers: Headers) => void) {
      uuid(photoId);
      await drafts.withDraft(headers, listingId, async (tx, _, owner) => {
        const photo = await tx.draftPhoto.findFirst({ where: { id: photoId, listingId, ownerId: owner },
          select: { id: true, resultRevision: true, status: true } });
        if (!photo) return reject("NOT_FOUND");
        if (photo.resultRevision !== null) reject("INVALID_STATE");
        if (photo.status === "DELETED") return;
        await tx.draftPhoto.update({ where: { id: photoId }, data: { status: "DELETION_PENDING" } });
        await tx.draftPhotoEvent.upsert({ where: { photoId_kind: { photoId, kind: "deletion-requested" } }, create: { photoId, kind: "deletion-requested", createdAt: clock() }, update: {} });
      }, apply, true);
      return drafts.withDraft(headers, listingId, async (tx, _, owner) => {
        const photo = await tx.draftPhoto.findFirst({ where: { id: photoId, listingId, ownerId: owner },
          select: { id: true, resultRevision: true, status: true } });
        if (!photo || photo.resultRevision !== null || !["DELETION_PENDING", "DELETED"].includes(photo.status)) return reject("INVALID_STATE");
        if (await tx.draftRetentionHold.findFirst({ where: { listingId, releasedAt: null }, select: { id: true } })) return { canceled: true };
        await store.remove(`${photoId}.original`); await store.remove(`${photoId}.upload`);
        await tx.draftPhoto.update({ where: { id: photoId }, data: { status: "DELETED", reservedBytes: 0, deletedAt: clock(), originalDeletedAt: clock() } });
        await tx.draftPhotoEvent.upsert({ where: { photoId_kind: { photoId, kind: "canceled" } }, create: { photoId, kind: "canceled", createdAt: clock() }, update: {} });
        return { canceled: true };
      }, apply, true);
    },
    async list(headers: Headers, listingId: string, revision?: string | null, apply?: (headers: Headers) => void) {
      return drafts.withDraft(headers, listingId, async (tx, listing, owner) => {
        let saved = listing.currentRevision!;
        if (revision !== undefined && revision !== null) {
          if (!/^[1-9]\d*$/.test(revision) || Number(revision) > 2147483647) reject("INVALID_INPUT");
          const found = await tx.listingRevision.findFirst({ where: { listingId, authoredById: owner, version: Number(revision) },
            select: { id: true } });
          if (!found) return reject("NOT_FOUND");
          // Reuse the pinned projection, never a current-version substitution.
          const refs = await tx.draftPhotoReference.findMany({ where: { revisionId: found.id }, orderBy: { sortOrder: "asc" },
            select: { photoId: true, sortOrder: true, photo: { select: { status: true, approvedAttemptId: true, deletedAt: true } } } });
          saved = { ...saved, version: Number(revision), draftPhotos: refs };
        }
        return { revision: saved.version, currentRevision: listing.currentRevisionNumber, photos: projectDraftPhotos(listingId, saved) };
      }, apply);
    },
    async image(headers: Headers, listingId: string, photoId: string, revision: string | null, apply?: (headers: Headers) => void) {
      uuid(photoId);
      if (!revision || !/^[1-9]\d*$/.test(revision) || Number(revision) > 2147483647) reject("INVALID_INPUT");
      return drafts.withDraft(headers, listingId, async (tx, _, owner) => {
        const ref = await tx.draftPhotoReference.findFirst({ where: { photoId, listingId, ownerId: owner, revision: { version: Number(revision) } },
          select: { photo: { select: { status: true, approvedAttemptId: true, deletedAt: true } } } });
        const photo = ref?.photo;
        if (!photo || photo.status !== "APPROVED" || !photo.approvedAttemptId || photo.deletedAt) return reject("NOT_FOUND");
        const approval = await tx.draftPhotoAttempt.findFirst({ where: { id: photo.approvedAttemptId, photoId, outcome: "APPROVED", policy: photoPolicy.version }, select: { id: true } });
        if (!approval) return reject("NOT_FOUND");
        try { return await store.read(`${photoId}.${approval.id}.jpg`); } catch { return reject("NOT_FOUND"); }
      }, apply);
    },
  };
}
