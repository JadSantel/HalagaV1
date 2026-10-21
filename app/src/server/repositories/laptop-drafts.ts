import "server-only";
import { buildLaptopDraftReview } from "../laptop-draft-review.ts";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { diagnosticVersion, type QuestionKey } from "../../domain/laptop-diagnostics.ts";
import { laptopDraftSchema, validatedDraftCondition, type LaptopDraftSnapshot } from "../laptop-draft-validation.ts";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { draftCutoff, type DraftPhoto } from "../../domain/draft-photo-policy.ts";

const createSchema = z.strictObject({ requestId: z.uuid(), draft: laptopDraftSchema });
const saveSchema = createSchema.extend({ expectedRevision: z.number().int().positive().max(2147483646) });
export type DraftDatabase = Pick<ReturnType<typeof getPrisma>, "$queryRaw" | "$executeRaw" | "userAccount" | "listing" | "listingRevision" | "accountMarketplaceRestriction" | "draftPhoto" | "draftPhotoReference" | "draftPhotoAttempt" | "draftPhotoEvent" | "draftRetentionHold">;

export class LaptopDraftRejected extends Error {
  readonly code: "INVALID_INPUT" | "UNAUTHORIZED" | "ACTION_RESTRICTED" | "NOT_FOUND" | "INVALID_STATE" | "INTERNAL_ERROR";

  constructor(code: LaptopDraftRejected["code"]) {
    super(code);
    this.name = "LaptopDraftRejected";
    this.code = code;
  }
}

// Owner-private only. No identity, session, media keys, staff data or publication records.
const revisionSelect = {
  id: true, listingId: true, version: true, createdAt: true, title: true, description: true,
  listingType: true, category: true, diagnosticSchemaVersion: true, conditionSummary: true,
  priceExpectation: true, fulfillment: true, photoCommand: true,
  draftPhotos: { orderBy: { sortOrder: "asc" as const }, select: { photoId: true, sortOrder: true,
    photo: { select: { status: true, approvedAttemptId: true, deletedAt: true } } } },
  itemGroups: { select: { quantity: true, brand: true, model: true, approximateAge: true,
    answers: { select: { schemaVersion: true, questionKey: true, answer: true, detail: true } } } },
} as const;
type Revision = NonNullable<Awaited<ReturnType<typeof loadRevision>>>;

function loadRevision(database: DraftDatabase, id: string, sellerId: string, now = new Date()) {
  return database.listingRevision.findFirst({ where: { id, authoredById: sellerId,
    listing: { sellerId, status: "DRAFT", updatedAt: { gt: draftCutoff(now) }, publicationCycles: { none: {} } } }, select: revisionSelect });
}

export function snapshot(revision: Revision): LaptopDraftSnapshot {
  const group = revision.itemGroups[0];
  if (revision.listingType !== "SINGLE_ITEM" || revision.category !== "LAPTOPS" ||
      revision.diagnosticSchemaVersion !== diagnosticVersion || revision.itemGroups.length !== 1 || group.quantity !== 1) {
    throw new LaptopDraftRejected("INVALID_STATE");
  }
  const answers: Partial<Record<QuestionKey, unknown>> = {};
  const notes: Partial<Record<QuestionKey, string>> = {};
  let behavior: unknown = [], included: unknown = [];
  let behaviorNotes = "", includedNotes = "";
  for (const row of group.answers) {
    if (row.schemaVersion !== diagnosticVersion) throw new LaptopDraftRejected("INVALID_STATE");
    if (row.questionKey === "behavior") { behavior = row.answer; behaviorNotes = row.detail ?? ""; }
    else if (row.questionKey === "included") { included = row.answer; includedNotes = row.detail ?? ""; }
    else {
      answers[row.questionKey as QuestionKey] = row.answer;
      if (row.detail !== null) notes[row.questionKey as QuestionKey] = row.detail;
    }
  }
  const parsed = laptopDraftSchema.safeParse({ diagnosticVersion, title: revision.title,
    description: revision.description, brand: group.brand ?? "", model: group.model ?? "",
    approximateAge: group.approximateAge ?? "", privatePriceExpectation: revision.priceExpectation?.toFixed(2) ?? "",
    fulfillment: revision.fulfillment ?? "", answers, notes, behavior, behaviorNotes, included, includedNotes });
  if (!parsed.success) throw new LaptopDraftRejected("INVALID_STATE");
  return parsed.data;
}

export async function appendRevision(database: DraftDatabase, sellerId: string, listingId: string,
  version: number, requestId: string, draft: LaptopDraftSnapshot, photoIds: string[] = [], photoCommand: string | null = null) {
  const condition = validatedDraftCondition(draft);
  await database.listingRevision.create({ data: {
    id: requestId, listingId, authoredById: sellerId, version, photoCommand,
    listingType: "SINGLE_ITEM", category: "LAPTOPS", title: draft.title, description: draft.description,
    barangayCode: null, priceExpectation: draft.privatePriceExpectation || null,
    fulfillment: draft.fulfillment || null,
    diagnosticSchemaVersion: diagnosticVersion, conditionSummary: condition,
    itemGroups: { create: { quantity: 1, brand: draft.brand, model: draft.model,
      approximateAge: draft.approximateAge, condition,
      answers: { create: [
        ...Object.entries(draft.answers).map(([questionKey, answer]) => ({ schemaVersion: diagnosticVersion,
          questionKey, answer, detail: draft.notes[questionKey as QuestionKey] ?? null })),
        { schemaVersion: diagnosticVersion, questionKey: "behavior", answer: draft.behavior, detail: draft.behaviorNotes },
        { schemaVersion: diagnosticVersion, questionKey: "included", answer: draft.included, detail: draft.includedNotes },
      ] } } },
  }, select: { id: true } });
  if (photoIds.length) await database.draftPhotoReference.createMany({ data: photoIds.map((photoId, sortOrder) => ({
    revisionId: requestId, listingId, ownerId: sellerId, photoId, sortOrder,
  })) });
}

export function projectDraftPhotos(listingId: string, revision: Revision): DraftPhoto[] {
  return revision.draftPhotos.map(({ photoId, sortOrder, photo }) => ({ id: photoId, position: sortOrder + 1,
    status: photo.status, src: photo.status === "APPROVED" && photo.approvedAttemptId && !photo.deletedAt
      ? `/api/laptop-drafts/${listingId}/photos/${photoId}?revision=${revision.version}` : null }));
}

/** Local synthetic slice only. Authentication authorizes private draft work,
 * including unverified accounts; it never grants marketplace participation.
 */
export function createLaptopDraftOperations(
  database: ReturnType<typeof getPrisma>,
  auth: Pick<ReturnType<typeof createAccountAuth>, "api">,
  clock: () => Date = () => new Date(),
) {
  async function withOwner<T>(headers: Headers, work: (transaction: DraftDatabase, owner: string) => Promise<T>,
    applySessionHeaders: (headers: Headers) => void, action?: "CREATE_LAPTOP_DRAFT" | "EDIT_LAPTOP_DRAFT"): Promise<T> {
    try {
      const resolved = await auth.api.getSession({ headers, returnHeaders: true,
        query: { disableCookieCache: true, disableRefresh: action !== undefined } });
      const actor = resolved.response;
      if (!actor || actor.session.userId !== actor.user.id) throw new LaptopDraftRejected("UNAUTHORIZED");
      const result = await database.$transaction(async (transaction) => {
        // Follow account commands' identity/domain -> session lock order.
        // ponytail: serialize per owner for this local slice; narrow locks if measured throughput requires it.
        await transaction.$queryRaw`SELECT a.id FROM "user" u JOIN "user_account" a ON a."authUserId" = u.id
          WHERE u.id = ${actor.user.id} FOR UPDATE OF u, a`;
        const owner = await transaction.userAccount.findUnique({ where: { authUserId: actor.user.id },
          select: { id: true, deletedAt: true } });
        if (!owner || owner.deletedAt) throw new LaptopDraftRejected("UNAUTHORIZED");
        const sessions = await transaction.$queryRaw<Array<{ createdAt: Date; expiresAt: Date }>>`
          SELECT "createdAt", "expiresAt" FROM "session" WHERE id = ${actor.session.id}
          AND "userId" = ${actor.user.id} AND token = ${actor.session.token} FOR UPDATE`;
        const requireLiveSession = () => {
          const now = clock();
          if (!Number.isFinite(now.getTime())) throw new LaptopDraftRejected("INTERNAL_ERROR");
          if (sessions.length !== 1 || sessions[0].createdAt > now || sessions[0].expiresAt <= now) {
            throw new LaptopDraftRejected("UNAUTHORIZED");
          }
          return now;
        };
        const requireActionAllowed = async () => {
          const now = requireLiveSession();
          if (!action) return;
          // Staff/audit data stays internal. The shared account lock also fences
          // restriction writes; never trust session snapshots or client scopes.
          const restriction = await transaction.accountMarketplaceRestriction.findFirst({
            where: { accountId: owner.id, scope: { in: [action, "SUSPENSION"] },
              startsAt: { lte: now }, revokedAt: null }, select: { id: true },
          });
          if (restriction) throw new LaptopDraftRejected("ACTION_RESTRICTED");
        };
        await requireActionAllowed();
        const value = await work(transaction, owner.id);
        await requireActionAllowed(); // Includes time spent waiting on listing locks/writes.
        return value;
      });
      applySessionHeaders(resolved.headers);
      return result;
    } catch (error) {
      if (error instanceof LaptopDraftRejected) throw error;
      throw new LaptopDraftRejected("INTERNAL_ERROR");
    }
  }

  async function lockDraft(transaction: DraftDatabase, id: string, sellerId: string) {
    await transaction.$queryRaw`SELECT id FROM listing WHERE id = ${id}::uuid AND "sellerId" = ${sellerId}::uuid FOR UPDATE`;
    const listing = await transaction.listing.findFirst({ where: { id, sellerId, status: "DRAFT", updatedAt: { gt: draftCutoff(clock()) },
      publicationCycles: { none: {} } }, select: { id: true, currentRevisionNumber: true,
      createdAt: true, updatedAt: true, currentRevision: { select: revisionSelect } } });
    if (!listing || !listing.currentRevision) throw new LaptopDraftRejected("NOT_FOUND");
    return listing;
  }

  return {
    // Internal repository seam. Never accept a callback from HTTP/client input.
    async withDraft<T>(headers: Headers, id: string,
      work: (transaction: DraftDatabase, listing: Awaited<ReturnType<typeof lockDraft>>, owner: string) => Promise<T>,
      apply: (headers: Headers) => void = () => {}, write = false) {
      if (!z.uuid().safeParse(id).success) throw new LaptopDraftRejected("INVALID_INPUT");
      return withOwner(headers, async (transaction, owner) => {
        const listing = await lockDraft(transaction, id, owner);
        const result = await work(transaction, listing, owner);
        if (listing.updatedAt <= draftCutoff(clock())) throw new LaptopDraftRejected("NOT_FOUND");
        return result;
      },
        apply, write ? "EDIT_LAPTOP_DRAFT" : undefined);
    },
    async review(headers: Headers, listingId: unknown, revision: unknown,
      applySessionHeaders: (headers: Headers) => void = () => {}) {
      const id = z.uuid().safeParse(listingId);
      const version = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().positive().max(2147483647)).safeParse(revision);
      if (!id.success || !version.success) throw new LaptopDraftRejected("INVALID_INPUT");
      return withOwner(headers, async (transaction, sellerId) => {
        const listing = await lockDraft(transaction, id.data, sellerId);
        const saved = await transaction.listingRevision.findFirst({ where: {
          listingId: listing.id, version: version.data, authoredById: sellerId,
          listing: { sellerId, status: "DRAFT", publicationCycles: { none: {} } },
        }, select: revisionSelect });
        if (!saved) throw new LaptopDraftRejected("NOT_FOUND");
        return { ...buildLaptopDraftReview(listing.id, saved.version, listing.currentRevisionNumber!, saved.createdAt, snapshot(saved)),
          photos: projectDraftPhotos(listing.id, saved) };
      }, applySessionHeaders);
    },
    async list(headers: Headers, applySessionHeaders: (headers: Headers) => void = () => {}) {
      return withOwner(headers, async (transaction, sellerId) => {
        const listings = await transaction.listing.findMany({
          where: { sellerId, status: "DRAFT", updatedAt: { gt: draftCutoff(clock()) }, publicationCycles: { none: {} },
            currentRevision: { category: "LAPTOPS", listingType: "SINGLE_ITEM", diagnosticSchemaVersion: diagnosticVersion } },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          // Minimal owner-private summary. Never load answers or price expectation.
          select: { id: true, currentRevisionNumber: true, updatedAt: true,
            currentRevision: { select: { title: true, conditionSummary: true } } },
        });
        return { drafts: listings.map((listing) => ({ id: listing.id, title: listing.currentRevision!.title,
          revision: listing.currentRevisionNumber!, updatedAt: listing.updatedAt,
          condition: listing.currentRevision!.conditionSummary })) };
      }, applySessionHeaders);
    },
    async create(headers: Headers, input: unknown, applySessionHeaders: (headers: Headers) => void = () => {}) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new LaptopDraftRejected("INVALID_INPUT");
      const { requestId, draft } = parsed.data;
      return withOwner(headers, async (transaction, sellerId) => {
        const previous = await loadRevision(transaction, requestId, sellerId, clock());
        if (previous) {
          if (previous.version !== 1 || previous.photoCommand || !isDeepStrictEqual(snapshot(previous), draft)) throw new LaptopDraftRejected("INVALID_STATE");
          return { id: previous.listingId, revision: previous.version };
        }
        const listing = await transaction.listing.create({ data: { sellerId, status: "DRAFT" }, select: { id: true } });
        await appendRevision(transaction, sellerId, listing.id, 1, requestId, draft);
        await transaction.listing.update({ where: { id: listing.id, sellerId, status: "DRAFT", currentRevisionNumber: null },
          data: { currentRevisionNumber: 1 }, select: { id: true } });
        return { id: listing.id, revision: 1 };
      }, applySessionHeaders, "CREATE_LAPTOP_DRAFT");
    },
    async save(headers: Headers, listingId: unknown, input: unknown, applySessionHeaders: (headers: Headers) => void = () => {}) {
      const id = z.uuid().safeParse(listingId), parsed = saveSchema.safeParse(input);
      if (!id.success || !parsed.success) throw new LaptopDraftRejected("INVALID_INPUT");
      const { requestId, expectedRevision, draft } = parsed.data;
      return withOwner(headers, async (transaction, sellerId) => {
        const listing = await lockDraft(transaction, id.data, sellerId);
        snapshot(listing.currentRevision!); // Guard this slice's category/type/version before editing.
        const previous = await loadRevision(transaction, requestId, sellerId, clock());
        if (previous) {
          if (previous.photoCommand || previous.listingId !== listing.id || previous.version !== expectedRevision + 1 ||
              !isDeepStrictEqual(snapshot(previous), draft)) throw new LaptopDraftRejected("INVALID_STATE");
          return { id: listing.id, revision: previous.version };
        }
        if (listing.currentRevisionNumber !== expectedRevision) throw new LaptopDraftRejected("INVALID_STATE");
        await appendRevision(transaction, sellerId, listing.id, expectedRevision + 1, requestId, draft,
          listing.currentRevision!.draftPhotos.map((ref) => ref.photoId));
        const updated = await transaction.listing.updateMany({ where: { id: listing.id, sellerId,
          status: "DRAFT", currentRevisionNumber: expectedRevision }, data: { currentRevisionNumber: expectedRevision + 1 } });
        if (updated.count !== 1) throw new LaptopDraftRejected("INVALID_STATE");
        return { id: listing.id, revision: expectedRevision + 1 };
      }, applySessionHeaders, "EDIT_LAPTOP_DRAFT");
    },
    async read(headers: Headers, listingId: unknown, applySessionHeaders: (headers: Headers) => void = () => {}) {
      const id = z.uuid().safeParse(listingId);
      if (!id.success) throw new LaptopDraftRejected("INVALID_INPUT");
      return withOwner(headers, async (transaction, sellerId) => {
        const listing = await lockDraft(transaction, id.data, sellerId);
        return { id: listing.id, status: "DRAFT" as const, revision: listing.currentRevisionNumber!,
          createdAt: listing.createdAt, updatedAt: listing.updatedAt,
          condition: listing.currentRevision!.conditionSummary, draft: snapshot(listing.currentRevision!),
          photos: projectDraftPhotos(listing.id, listing.currentRevision!) };
      }, applySessionHeaders);
    },
  };
}
