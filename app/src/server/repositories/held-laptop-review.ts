import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../prisma.ts";
import { createAccountAuth } from "./auth.ts";
import { snapshot } from "./laptop-drafts.ts";
import { buildLaptopDraftReview } from "../laptop-draft-review.ts";
import { evaluateLaptopPublication } from "../laptop-publication-evaluation.ts";
import { hasAdultEligibility } from "../account-access.ts";
import { elapsedDays, moderationBusinessTarget, moderationCopy, moderationExpiry, moderationReasons } from "../moderation-policy.ts";

type Database = ReturnType<typeof getPrisma>;
export type ModerationTransaction = Pick<Database, "$queryRaw" | "$executeRaw" | "listing" | "listingRevision" | "userAccount" | "accountMarketplaceRestriction">;
type Permission = "TRIAGE" | "CLAIM" | "EVIDENCE" | "DECIDE" | "APPEAL" | "RECOVERY" | "AUDIT";
type Purpose = "ADMINISTRATION" | "HELD_REVIEW" | "MODERATION_APPEAL" | "DELIVERY_RECOVERY" | "AUDIT_INSPECTION" | "SELLER";
type Review = { id: string; listing_id: string; revision: number; revision_id: string; seller_id: string;
  status: string; assigned_to: string | null; submitted_at: Date; trigger_class: string; closed_at: Date | null };
type Session = { createdAt: Date; expiresAt: Date };
type Context = { tx: ModerationTransaction; actor: string; review: Review | null; now: () => Date; grant: string | null; purpose: Purpose };
export class HeldReviewRejected extends Error {
  readonly code: "INVALID_INPUT" | "UNAUTHORIZED" | "NOT_FOUND" | "INVALID_STATE" | "ELIGIBILITY_UNAVAILABLE" | "INTERNAL_ERROR";
  constructor(code: HeldReviewRejected["code"]) {
    super(code); this.code=code; this.name = "HeldReviewRejected";
  }
}
function fail(code: HeldReviewRejected["code"]): never { throw new HeldReviewRejected(code); }
const uuid = z.uuid();
const explanation = z.string().trim().refine((s) => Array.from(s).length >= 1 && Array.from(s).length <= 4000);
const command = z.strictObject({ requestId: uuid, reason: explanation });
const reviewCommand = command.extend({ reviewId: uuid });
const date = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
const permissions = z.enum(["TRIAGE", "CLAIM", "EVIDENCE", "DECIDE", "APPEAL", "RECOVERY", "AUDIT"]);
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value, (_key, item) =>
  item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item)).digest("hex");

export async function appendModerationAudit(c: Context, action: string, target: string, reason: string, expiry?: Date) {
  const now = c.now();
  await c.tx.$executeRaw`INSERT INTO moderation_audit(id,actor_id,grant_id,purpose,action,target_id,revision_id,reason,created_at,expires_at)
    VALUES (${randomUUID()}::uuid,${c.actor}::uuid,${c.grant}::uuid,${c.purpose},${action},${target}::uuid,
      ${c.review?.revision_id ?? null}::uuid,${reason},${now},${expiry ?? moderationExpiry(now)})`;
}

async function notice(c: Context, event: keyof typeof moderationCopy, decisionId: string | null = null) {
  const r = c.review!;
  const id = randomUUID(), now = c.now();
  await c.tx.$executeRaw`INSERT INTO moderation_notice(id,review_id,decision_id,account_id,event,created_at)
    VALUES (${id}::uuid,${r.id}::uuid,${decisionId}::uuid,${r.seller_id}::uuid,${event},${now})`;
  if (event !== "HELD") {
    // Both verification stores and the generation are read under identity/account locks.
    const created=await c.tx.$executeRaw`INSERT INTO moderation_email_job(id,notice_id,account_id,binding_generation,recipient,created_at,deadline,available_at)
      SELECT ${randomUUID()}::uuid,${id}::uuid,a.id,b.generation,u.email,${now},${elapsedDays(now,7)},${now}
      FROM user_account a JOIN "user" u ON u.id=a."authUserId" JOIN moderation_email_binding b ON b.user_id=u.id
      WHERE a.id=${r.seller_id}::uuid AND a."deletedAt" IS NULL AND u."emailVerified"
        AND a."emailVerifiedAt" <= ${now}`;
    if(created===1)await c.tx.$executeRaw`UPDATE moderation_notice SET email_outcome='PENDING' WHERE id=${id}::uuid`;
  } else await c.tx.$executeRaw`UPDATE moderation_notice SET email_outcome='NOT_REQUIRED' WHERE id=${id}::uuid`;
  return now;
}

async function grant(c: Context, permission: Permission, account = c.actor) {
  const now = c.now();
  const rows = await c.tx.$queryRaw<{ id: string }[]>`SELECT id FROM moderation_grant
    WHERE account_id=${account}::uuid AND permission=${permission} AND starts_at<=${now}
      AND ends_at>${now} AND revoked_at IS NULL ORDER BY id LIMIT 1`;
  return rows[0]?.id ?? null;
}
async function available(c: Context, account: string) {
  const needed:Permission[]=c.review?.status.startsWith("APPEAL") || c.purpose==="MODERATION_APPEAL" ? ["APPEAL"] : ["CLAIM","EVIDENCE","DECIDE"];
  for(const permission of needed)if(!await grant(c,permission,account))return false;
  const now = c.now();
  const rows = await c.tx.$queryRaw<{ id: string }[]>`SELECT s.id FROM moderation_shift s JOIN user_account a ON a.id=s.account_id
    WHERE s.account_id=${account}::uuid AND a."deletedAt" IS NULL AND s.availability='CONFIRMED'
      AND s.confirmed_at<=${now} AND s.starts_at<=${now} AND s.ends_at>${now} LIMIT 1`;
  return rows.length > 0;
}
async function nonconflicted(c: Context, account: string) {
  if (!c.review || account === c.review.seller_id) return false;
  const rows = await c.tx.$queryRaw<unknown[]>`SELECT 1 FROM moderation_conflict WHERE review_id=${c.review.id}::uuid AND account_id=${account}::uuid`;
  return rows.length === 0;
}
async function appealReviewerAllowed(c: Context) {
  const original=(await c.tx.$queryRaw<{actor_id:string}[]>`SELECT d.actor_id FROM moderation_appeal a JOIN moderation_decision d ON d.id=a.decision_id
    WHERE a.review_id=${c.review!.id}::uuid`)[0];
  if(!original) return false;
  if(original.actor_id!==c.actor)return true;
  const others=await c.tx.$queryRaw<{account_id:string}[]>`SELECT DISTINCT account_id FROM moderation_grant WHERE permission='APPEAL' AND revoked_at IS NULL
    AND starts_at<=${c.now()} AND ends_at>${c.now()} AND account_id<>${c.actor}::uuid`;
  for(const other of others) if(await available(c,other.account_id) && await nonconflicted(c,other.account_id))return false;
  return true;
}

/** Unmounted synthetic repository. No held-submission, owner bootstrap or evidence
 * adoption API exists. Administrative authority comes only from an installation
 * record; ordinary authentication never supplies it. */
export function createHeldLaptopReviewOperations(database: Database, auth: Pick<ReturnType<typeof createAccountAuth>, "api">,
  clock: () => Date = () => new Date()) {
  const now = () => { const value = clock(); if (!Number.isFinite(value.getTime())) fail("INTERNAL_ERROR"); return value; };
  async function run<T>(headers: Headers, options: { permission?: Permission; purpose: Purpose; reviewId?: string;
    targetAccount?: string; assigned?: boolean; fresh?: boolean; command?: string; input?: { requestId: string }; reason: string },
    work: (c: Context) => Promise<T>): Promise<T> {
    try {
      const resolved = await auth.api.getSession({ headers, returnHeaders: true, query: { disableCookieCache: true, disableRefresh: true } });
      const identity = resolved.response;
      if (!identity || identity.user.id !== identity.session.userId) fail("UNAUTHORIZED");
      return await database.$transaction(async (tx) => {
        const metadata = options.reviewId ? (await tx.$queryRaw<Review[]>`SELECT id,listing_id,revision,revision_id,seller_id,status,assigned_to,submitted_at,trigger_class,closed_at
          FROM held_laptop_review WHERE id=${options.reviewId}::uuid`)[0] : null;
        // Lock order: sorted identities/domain accounts -> initiating stored session
        // -> singleton moderation control -> listing -> review. Account commands
        // never acquire moderation locks, so restrictions/email changes share fences.
        const actors = await tx.$queryRaw<{ id: string; authUserId: string; deletedAt: Date | null }[]>`
          SELECT a.id,a."authUserId",a."deletedAt" FROM user_account a JOIN "user" u ON u.id=a."authUserId"
          WHERE u.id=${identity.user.id} OR a.id=${metadata?.seller_id ?? null}::uuid OR a.id=${options.targetAccount ?? null}::uuid
          ORDER BY a.id FOR UPDATE OF u,a`;
        const actor = actors.find((a) => a.authUserId === identity.user.id);
        if (!actor || actor.deletedAt) fail("UNAUTHORIZED");
        const sessions = await tx.$queryRaw<Session[]>`SELECT "createdAt","expiresAt" FROM "session"
          WHERE id=${identity.session.id} AND "userId"=${identity.user.id} AND token=${identity.session.token} FOR UPDATE`;
        // ponytail: serialize this local moderation slice; replace with reviewed
        // per-queue locks if measured throughput requires greater concurrency.
        const control = (await tx.$queryRaw<{ owner_account_id: string | null; verified_at: Date | null }[]>`
          SELECT owner_account_id,verified_at FROM moderation_control WHERE singleton=true FOR UPDATE`)[0];
        let review: Review | null = null;
        if (metadata) {
          await tx.$queryRaw`SELECT id FROM listing WHERE id=${metadata.listing_id}::uuid FOR UPDATE`;
          review = (await tx.$queryRaw<Review[]>`SELECT id,listing_id,revision,revision_id,seller_id,status,assigned_to,submitted_at,trigger_class,closed_at
            FROM held_laptop_review WHERE id=${metadata.id}::uuid FOR UPDATE`)[0] ?? null;
        }
        const c: Context = { tx, actor: actor.id, review, now, grant: null, purpose: options.purpose };
        const authorize = async () => {
          const time = now(), session = sessions[0];
          if (!session || session.createdAt > time || session.expiresAt <= time ||
              (options.fresh && time.getTime()-session.createdAt.getTime() >= 900000)) fail("UNAUTHORIZED");
          if (options.purpose === "ADMINISTRATION") {
            if (control?.owner_account_id !== actor.id || !control.verified_at || control.verified_at > time) fail("UNAUTHORIZED");
          } else if (options.purpose === "SELLER") {
            if (!review || review.seller_id !== actor.id) fail("NOT_FOUND");
          } else {
            c.grant = options.permission ? await grant(c, options.permission) : null;
            if (!c.grant) fail("UNAUTHORIZED");
          }
          if (options.reviewId && !review) fail("NOT_FOUND");
          if(review) {
            let closed=review.closed_at;
            if(!closed && review.status==="REJECTED")closed=(await tx.$queryRaw<{appeal_deadline:Date}[]>`SELECT appeal_deadline FROM moderation_decision
              WHERE review_id=${review.id}::uuid AND action='REJECT' AND appeal_deadline<${time}
              AND NOT EXISTS(SELECT 1 FROM moderation_appeal WHERE review_id=${review.id}::uuid) ORDER BY created_at DESC LIMIT 1`)[0]?.appeal_deadline??null;
            if(closed && moderationExpiry(closed)<=time)fail("NOT_FOUND");
          }
          if (options.assigned && (!review || review.assigned_to !== actor.id || !await nonconflicted(c, actor.id) || !await available(c, actor.id))) fail("UNAUTHORIZED");
          if(options.assigned && options.purpose==="MODERATION_APPEAL" && !await appealReviewerAllowed(c))fail("UNAUTHORIZED");
        };
        await authorize();
        if (options.command && options.input) {
          const receipt = (await tx.$queryRaw<{ fingerprint: string; result: T }[]>`SELECT fingerprint,result FROM moderation_receipt
            WHERE actor_id=${actor.id}::uuid AND command=${options.command} AND request_id=${options.input.requestId}::uuid`)[0];
          if (receipt) {
            if (receipt.fingerprint !== fingerprint(options.input)) fail("INVALID_STATE");
            await authorize();
            await appendModerationAudit(c,"REPLAY",review?.id ?? actor.id,options.reason);
            return receipt.result;
          }
        }
        const result = await work(c);
        if (options.command && options.input) await tx.$executeRaw`INSERT INTO moderation_receipt(actor_id,command,request_id,review_id,fingerprint,result,created_at)
          VALUES (${actor.id}::uuid,${options.command},${options.input.requestId}::uuid,${review?.id ?? null}::uuid,
            ${fingerprint(options.input)},${JSON.stringify(result)}::jsonb,${now()})`;
        await authorize();
        return result;
      }, { timeout: 15000 });
    } catch (error) { if (error instanceof HeldReviewRejected) throw error; throw new HeldReviewRejected("INTERNAL_ERROR"); }
  }
  function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
    const result = schema.safeParse(input); if (!result.success) fail("INVALID_INPUT"); return result.data;
  }
  async function candidate(c: Context) {
    const r = c.review!;
    const revision = await c.tx.listingRevision.findFirst({ where: { id: r.revision_id, listingId: r.listing_id, version: r.revision }, select: {
      id: true, listingId: true, version: true, createdAt: true, title: true, description: true,
      listingType: true, category: true, diagnosticSchemaVersion: true, conditionSummary: true,
      fulfillment: true, photoCommand: true, barangayCode: true, ownershipDeclaration: { select: { revisionId: true } },
      draftPhotos: { orderBy: { sortOrder: "asc" }, select: { photoId: true, sortOrder: true,
        photo: { select: { status: true, approvedAttemptId: true, deletedAt: true } } } },
      itemGroups: { select: { quantity: true, brand: true, model: true, approximateAge: true,
        answers: { select: { schemaVersion: true, questionKey: true, answer: true, detail: true } } } },
    } });
    if (!revision) fail("NOT_FOUND");
    const draft = snapshot({ ...revision, priceExpectation: null }); // Never select private expectation.
    const account = await c.tx.userAccount.findUniqueOrThrow({ where: { id: r.seller_id }, select: {
      adultEligibilityCheckedAt: true, adultAttestedAt: true, emailVerifiedAt: true, deletedAt: true, authUser: { select: { emailVerified: true } },
    } });
    const time = now();
    const restriction = await c.tx.accountMarketplaceRestriction.findFirst({ where: {
      accountId: r.seller_id, scope: { in: ["PUBLISH_LISTING","SUSPENSION"] }, startsAt: { lte: time }, revokedAt: null,
    }, select: { id: true } });
    const evaluation = evaluateLaptopPublication({ listingId: r.listing_id, revisionId: r.revision_id, revision: r.revision,
      listingType: revision.listingType, category: revision.category, quantity: revision.itemGroups[0]?.quantity ?? 0,
      draft, barangayCode: revision.barangayCode, photoIds: revision.draftPhotos.map((p) => p.photoId),
      ownershipDeclarationPresent: revision.ownershipDeclaration !== null,
      account: { adultEligible: !account.deletedAt && hasAdultEligibility(account.adultEligibilityCheckedAt,account.adultAttestedAt,time),
        emailVerified: !account.deletedAt && account.authUser.emailVerified && account.emailVerifiedAt !== null && account.emailVerifiedAt <= time,
        publicationRestricted: !!restriction } });
    return { revision, draft, evaluation };
  }
  async function exactHeld(c: Context) {
    const r = c.review!;
    const listing = await c.tx.listing.findUnique({ where: { id: r.listing_id }, select: { status: true, currentRevisionNumber: true } });
    if (!listing || listing.status !== "HELD" || listing.currentRevisionNumber !== r.revision) fail("INVALID_STATE");
  }
  return {
    async grant(headers: Headers, input: unknown) {
      const i = parse(command.extend({ accountId: uuid, permission: permissions, startsAt: date, endsAt: date, trainingReference: explanation }),input);
      return run(headers,{ purpose:"ADMINISTRATION",targetAccount:i.accountId,fresh:true,command:"GRANT",input:i,reason:i.reason },async(c)=> {
        if (i.endsAt<=i.startsAt || i.endsAt<=now()) fail("INVALID_INPUT");
        const id=randomUUID();
        await c.tx.$executeRaw`INSERT INTO moderation_grant(id,account_id,permission,starts_at,ends_at,training_reference,authorizer_id)
          VALUES (${id}::uuid,${i.accountId}::uuid,${i.permission},${i.startsAt},${i.endsAt},${i.trainingReference},${c.actor}::uuid)`;
        await appendModerationAudit(c,"GRANT",id,i.reason,moderationExpiry(i.endsAt)); return { id };
      });
    },
    async revoke(headers: Headers,input: unknown) {
      const i=parse(command.extend({ accountId:uuid,grantId:uuid }),input);
      return run(headers,{purpose:"ADMINISTRATION",targetAccount:i.accountId,fresh:true,command:"REVOKE",input:i,reason:i.reason},async(c)=>{
        const changed=await c.tx.$executeRaw`UPDATE moderation_grant SET revoked_at=${now()} WHERE id=${i.grantId}::uuid
          AND account_id=${i.accountId}::uuid AND revoked_at IS NULL`;
        if(changed!==1) fail("INVALID_STATE");
        await appendModerationAudit(c,"REVOKE",i.grantId,i.reason); return { id:i.grantId };
      });
    },
    async schedule(headers: Headers,input: unknown) {
      const i=parse(command.extend({accountId:uuid,role:z.enum(["PRIMARY","ALTERNATE"]),startsAt:date,endsAt:date,trainingReference:explanation}),input);
      return run(headers,{purpose:"ADMINISTRATION",targetAccount:i.accountId,fresh:true,command:"SCHEDULE",input:i,reason:i.reason},async(c)=>{
        if(i.endsAt<=i.startsAt || i.endsAt<=now()) fail("INVALID_INPUT");
        const id=randomUUID();
        await c.tx.$executeRaw`INSERT INTO moderation_shift(id,account_id,authorizer_id,role,starts_at,ends_at,training_reference)
          VALUES (${id}::uuid,${i.accountId}::uuid,${c.actor}::uuid,${i.role},${i.startsAt},${i.endsAt},${i.trainingReference})`;
        await appendModerationAudit(c,"SCHEDULE",id,i.reason,moderationExpiry(i.endsAt)); return { id };
      });
    },
    async availability(headers: Headers,input: unknown) {
      const i=parse(command.extend({shiftId:uuid,accountId:uuid,action:z.enum(["CONFIRM","UNAVAILABLE","RESTORE"])}),input);
      return run(headers,{purpose:i.action==="RESTORE"?"ADMINISTRATION":"HELD_REVIEW",permission:"CLAIM",targetAccount:i.accountId,
        fresh:i.action==="RESTORE",command:"AVAILABILITY",input:i,reason:i.reason},async(c)=>{
        if(i.action!=="RESTORE" && c.actor!==i.accountId) fail("UNAUTHORIZED");
        const previous=i.action==="CONFIRM"?"SCHEDULED":i.action==="RESTORE"?"UNAVAILABLE":"CONFIRMED";
        const state=i.action==="UNAVAILABLE"?"UNAVAILABLE":"CONFIRMED";
        const changed=await c.tx.$executeRaw`UPDATE moderation_shift SET availability=${state},confirmed_at=${now()}
          WHERE id=${i.shiftId}::uuid AND account_id=${i.accountId}::uuid AND availability=${previous} AND ends_at>${now()}`;
        if(changed!==1) fail("INVALID_STATE"); await appendModerationAudit(c,i.action,i.shiftId,i.reason); return { id:i.shiftId };
      });
    },
    async queue(headers: Headers) {
      return run(headers,{purpose:"HELD_REVIEW",permission:"TRIAGE",reason:"Held review triage"},async(c)=>{
        const rows=await c.tx.$queryRaw`SELECT r.id,r.trigger_class AS "triggerClass",'LAPTOPS' AS category,r.status,r.submitted_at AS "submittedAt",
          r.necessity_due_at AS "necessityDueAt",(r.assigned_to IS NOT NULL) AS assigned,
          a.acknowledgement_due_at AS "acknowledgementDueAt",a.decision_due_at AS "decisionDueAt",
          (a.acknowledged_at IS NULL AND a.acknowledgement_due_at<${now()}) AS "acknowledgementOverdue",
          (a.resolved_at IS NULL AND a.decision_due_at<${now()}) AS "decisionOverdue"
          FROM held_laptop_review r LEFT JOIN moderation_appeal a ON a.review_id=r.id
          WHERE r.closed_at IS NULL AND NOT EXISTS(SELECT 1 FROM moderation_decision d WHERE d.review_id=r.id AND d.action='REJECT'
            AND ((d.appeal_deadline AT TIME ZONE 'Asia/Manila')+interval '6 months') AT TIME ZONE 'Asia/Manila'<=${now()}
            AND a.id IS NULL) ORDER BY r.submitted_at,r.id LIMIT 100`;
        await appendModerationAudit(c,"QUEUE_READ",c.actor,"Held review triage"); return rows;
      });
    },
    async claim(headers: Headers,input: unknown) {
      const i=parse(reviewCommand.extend({purpose:z.enum(["HELD_REVIEW","MODERATION_APPEAL"])}),input);
      return run(headers,{purpose:i.purpose,permission:i.purpose==="MODERATION_APPEAL"?"APPEAL":"CLAIM",reviewId:i.reviewId,
        command:"CLAIM",input:i,reason:i.reason},async(c)=>{
        const r=c.review!;
        if(!await nonconflicted(c,c.actor) || !await available(c,c.actor)) fail("UNAUTHORIZED");
        if(r.assigned_to && r.assigned_to!==c.actor) fail("INVALID_STATE");
        if(i.purpose==="HELD_REVIEW" ? !["PENDING","CORRECTION_REQUESTED"].includes(r.status) : !["APPEAL_PENDING","APPEAL_REVIEW"].includes(r.status)) fail("INVALID_STATE");
        if(i.purpose==="MODERATION_APPEAL" && !await appealReviewerAllowed(c))fail("UNAUTHORIZED");
        await c.tx.$executeRaw`UPDATE held_laptop_review SET assigned_to=${c.actor}::uuid WHERE id=${r.id}::uuid`;
        r.assigned_to=c.actor;
        await appendModerationAudit(c,"CLAIM",r.id,i.reason); return { id:r.id };
      });
    },
    async handoff(headers: Headers,input: unknown) {
      const i=parse(reviewCommand.extend({toAccountId:uuid.nullable(),purpose:z.enum(["HELD_REVIEW","MODERATION_APPEAL","ADMINISTRATION"])}),input);
      return run(headers,{purpose:i.purpose,permission:i.purpose==="MODERATION_APPEAL"?"APPEAL":"CLAIM",reviewId:i.reviewId,
        targetAccount:i.toAccountId??undefined,fresh:i.purpose==="ADMINISTRATION",command:"HANDOFF",input:i,reason:i.reason},async(c)=>{
        const r=c.review!; if(i.purpose!=="ADMINISTRATION" && r.assigned_to!==c.actor) fail("UNAUTHORIZED");
        const permission=r.status.startsWith("APPEAL")?"APPEAL":"CLAIM";
        if(i.toAccountId && (!await grant(c,permission,i.toAccountId) || !await nonconflicted(c,i.toAccountId) || !await available(c,i.toAccountId))) fail("UNAUTHORIZED");
        await c.tx.$executeRaw`UPDATE held_laptop_review SET assigned_to=${i.toAccountId}::uuid WHERE id=${r.id}::uuid`;
        await appendModerationAudit(c,"HANDOFF",r.id,i.reason); return { id:r.id };
      });
    },
    async conflict(headers: Headers,input: unknown) {
      const i=parse(reviewCommand,input);
      return run(headers,{purpose:"HELD_REVIEW",permission:"CLAIM",reviewId:i.reviewId,command:"CONFLICT",input:i,reason:i.reason},async(c)=>{
        await c.tx.$executeRaw`INSERT INTO moderation_conflict(review_id,account_id,reason,created_at)
          VALUES (${i.reviewId}::uuid,${c.actor}::uuid,${i.reason},${now()}) ON CONFLICT DO NOTHING`;
        await appendModerationAudit(c,"CONFLICT",i.reviewId,i.reason); return { id:i.reviewId };
      });
    },
    async detail(headers: Headers,input: unknown) {
      const i=parse(z.strictObject({reviewId:uuid,purpose:z.enum(["HELD_REVIEW","MODERATION_APPEAL"]),reason:explanation}),input);
      return run(headers,{purpose:i.purpose,permission:i.purpose==="MODERATION_APPEAL"?"APPEAL":"EVIDENCE",reviewId:i.reviewId,assigned:true,reason:i.reason},async(c)=>{
        if(i.purpose==="MODERATION_APPEAL" && !c.review!.status.startsWith("APPEAL")) fail("INVALID_STATE");
        if(i.purpose==="HELD_REVIEW" && c.review!.status.startsWith("APPEAL"))fail("INVALID_STATE");
        const { revision,draft,evaluation }=await candidate(c);
        const review=buildLaptopDraftReview(c.review!.listing_id,revision.version,revision.version,revision.createdAt,draft,evaluation);
        await appendModerationAudit(c,"DETAIL_READ",i.reviewId,i.reason);
        return { id:i.reviewId,revision:revision.version,revisionId:revision.id,status:c.review!.status,candidate:review.proposedPublicContent,evaluation };
      });
    },
    async decide(headers: Headers,input: unknown) {
      const i=parse(reviewCommand.extend({revision: z.number().int().positive(),action:z.enum(["APPROVE","REJECT","REQUEST_CORRECTION"]),
        reasonCode:z.enum(["REQUIRED_INFORMATION","SAFETY_INELIGIBLE","OWNERSHIP_DECLARATION","ACCOUNT_PUBLICATION_RESTRICTED"])}),input);
      return run(headers,{purpose:"HELD_REVIEW",permission:"DECIDE",reviewId:i.reviewId,assigned:true,fresh:true,command:"DECIDE",input:i,reason:i.reason},async(c)=>{
        const r=c.review!; if(!["PENDING","CORRECTION_REQUESTED"].includes(r.status) || r.revision!==i.revision) fail("INVALID_STATE");
        await exactHeld(c);
        const { evaluation }=await candidate(c);
        // No runtime risk/evidence/registry/declaration/readiness provider is accepted
        // and connected. Staff cannot submit assessment overrides. Keep approval gated.
        if(i.action==="APPROVE") fail("ELIGIBILITY_UNAVAILABLE");
        const supported=i.reasonCode==="SAFETY_INELIGIBLE" ? evaluation.checks.some((v)=>v.field==="safety" && v.status==="ineligible")
          : i.reasonCode==="OWNERSHIP_DECLARATION" ? evaluation.checks.some((v)=>v.field==="ownership-declaration" && v.status==="missing")
            : i.reasonCode==="ACCOUNT_PUBLICATION_RESTRICTED" ? evaluation.checks.some((v)=>v.field==="account-clearance" && v.status==="review")
              : evaluation.checks.some((v)=>v.status==="missing" && !["photos","ownership-declaration","adult-eligibility","email-verification","barangay"].includes(v.field));
        if(!supported) fail("INVALID_STATE");
        const id=randomUUID(),time=now(),state=i.action==="REJECT"?"REJECTED":"CORRECTION_REQUESTED";
        const deadline=i.action==="REJECT"?elapsedDays(time,7):null;
        await c.tx.$executeRaw`INSERT INTO moderation_decision(id,review_id,revision_id,actor_id,action,reason_code,rationale,prior_state,resulting_state,created_at,appeal_deadline)
          VALUES (${id}::uuid,${r.id}::uuid,${r.revision_id}::uuid,${c.actor}::uuid,${i.action},${i.reasonCode},${i.reason},${r.status},${state},${time},${deadline})`;
        await c.tx.$executeRaw`UPDATE held_laptop_review SET status=${state} WHERE id=${r.id}::uuid`;
        if(i.action==="REJECT") await c.tx.listing.update({where:{id:r.listing_id,status:"HELD",currentRevisionNumber:r.revision},data:{status:"REJECTED"},select:{id:true}});
        // One captured event instant owns both notice availability and appeal clock.
        await notice({...c,now:()=>time},state,id);
        await appendModerationAudit(c,"DECISION",r.id,i.reason);
        return { id,reviewId:r.id,revision:r.revision,status:state };
      });
    },
    async sellerDetail(headers: Headers,input: unknown) {
      const i=parse(z.strictObject({reviewId:uuid}),input);
      return run(headers,{purpose:"SELLER",reviewId:i.reviewId,reason:"Own moderation status"},async(c)=>{
        const decisions=await c.tx.$queryRaw<{id:string;action:string;reason_code:keyof typeof moderationReasons;created_at:Date;appeal_deadline:Date|null}[]>`
          SELECT id,action,reason_code,created_at,appeal_deadline FROM moderation_decision WHERE review_id=${i.reviewId}::uuid ORDER BY created_at,id`;
        const notices=await c.tx.$queryRaw<{id:string;event:keyof typeof moderationCopy;created_at:Date;read_at:Date|null}[]>`
          SELECT id,event,created_at,read_at FROM moderation_notice WHERE review_id=${i.reviewId}::uuid ORDER BY created_at,id`;
        const appeal=(await c.tx.$queryRaw<{id:string;grounds:string[];explanation:string;submittedAt:Date;acknowledgementDueAt:Date;decisionDueAt:Date;acknowledgedAt:Date|null;resolvedAt:Date|null}[]>`SELECT id,grounds,explanation,created_at AS "submittedAt",acknowledgement_due_at AS "acknowledgementDueAt",
          decision_due_at AS "decisionDueAt",acknowledged_at AS "acknowledgedAt",resolved_at AS "resolvedAt" FROM moderation_appeal WHERE review_id=${i.reviewId}::uuid`)[0]??null;
        await appendModerationAudit(c,"SELLER_READ",i.reviewId,"Own moderation status");
        return {id:i.reviewId,revision:c.review!.revision,status:c.review!.status,
          decisions:decisions.map((d)=>({id:d.id,action:d.action,reasonCode:d.reason_code,guidance:moderationReasons[d.reason_code],noticeTime:d.created_at,appealDeadline:d.appeal_deadline})),
          notices:notices.map((n)=>({id:n.id,text:moderationCopy[n.event],createdAt:n.created_at,readAt:n.read_at})),appeal};
      });
    },
    async readNotice(headers: Headers,input: unknown) {
      const i=parse(reviewCommand.extend({noticeId:uuid}),input);
      return run(headers,{purpose:"SELLER",reviewId:i.reviewId,command:"READ_NOTICE",input:i,reason:"Explicit own notice read"},async(c)=>{
        const changed=await c.tx.$executeRaw`UPDATE moderation_notice SET read_at=COALESCE(read_at,${now()})
          WHERE id=${i.noticeId}::uuid AND review_id=${i.reviewId}::uuid AND account_id=${c.actor}::uuid`;
        if(changed!==1) fail("NOT_FOUND");
        await appendModerationAudit(c,"NOTICE_READ",i.noticeId,"Explicit own notice read"); return {id:i.noticeId};
      });
    },
    async auditTrail(headers:Headers,input:unknown) {
      const i=parse(z.strictObject({reviewId:uuid,reason:explanation}),input);
      return run(headers,{purpose:"AUDIT_INSPECTION",permission:"AUDIT",reviewId:i.reviewId,reason:i.reason},async(c)=>{
        const rows=await c.tx.$queryRaw`SELECT actor_id AS "actorId",grant_id AS "grantId",purpose,action,target_id AS "targetId",
          revision_id AS "revisionId",reason,created_at AS "createdAt" FROM moderation_audit
          WHERE target_id=${i.reviewId}::uuid AND expires_at>${now()} ORDER BY created_at,id LIMIT 100`;
        await appendModerationAudit(c,"AUDIT_READ",i.reviewId,i.reason);return rows;
      });
    },
    async inspectDelivery(headers:Headers,input:unknown) {
      const i=parse(z.strictObject({reviewId:uuid,jobId:uuid,reason:explanation}),input);
      return run(headers,{purpose:"DELIVERY_RECOVERY",permission:"RECOVERY",reviewId:i.reviewId,reason:i.reason},async(c)=>{
        const rows=await c.tx.$queryRaw`SELECT j.id,j.state,j.attempts,j.created_at AS "createdAt",j.deadline,j.outcome_code AS "outcomeCode"
          FROM moderation_email_job j JOIN moderation_notice n ON n.id=j.notice_id WHERE j.id=${i.jobId}::uuid AND n.review_id=${i.reviewId}::uuid`;
        await appendModerationAudit(c,"DELIVERY_INSPECTION",i.reviewId,i.reason);return rows;
      });
    },
    async resolveUnknownDelivery(headers:Headers,input:unknown) {
      const i=parse(reviewCommand.extend({jobId:uuid}),input);
      return run(headers,{purpose:"DELIVERY_RECOVERY",permission:"RECOVERY",reviewId:i.reviewId,fresh:true,command:"RESOLVE_UNKNOWN",input:i,reason:i.reason},async(c)=>{
        const changed=await c.tx.$executeRaw`UPDATE moderation_email_job j SET recipient=NULL,terminal_at=${now()},outcome_code='RESOLVED_WITHOUT_RESEND'
          FROM moderation_notice n WHERE j.id=${i.jobId}::uuid AND j.notice_id=n.id AND n.review_id=${i.reviewId}::uuid AND j.state='UNKNOWN' AND j.terminal_at IS NULL`;
        if(changed!==1)fail("INVALID_STATE");
        await appendModerationAudit(c,"RESOLVE_UNKNOWN_WITHOUT_RESEND",i.reviewId,i.reason);return {id:i.jobId};
      });
    },
    async appeal(headers: Headers,input: unknown) {
      const i=parse(reviewCommand.extend({decisionId:uuid,grounds:z.array(z.enum(["NEW_EVIDENCE","FACTUAL_ERROR","POLICY_MISAPPLICATION","PROCEDURAL_FAILURE"])).min(1).max(4)
        .refine((v)=>new Set(v).size===v.length),explanation}),input);
      return run(headers,{purpose:"SELLER",reviewId:i.reviewId,command:"APPEAL",input:i,reason:"Seller moderation appeal"},async(c)=>{
        const r=c.review!,time=now();
        const decision=(await c.tx.$queryRaw<{appeal_deadline:Date;actor_id:string}[]>`SELECT appeal_deadline,actor_id FROM moderation_decision
          WHERE id=${i.decisionId}::uuid AND review_id=${r.id}::uuid AND action='REJECT'`)[0];
        if(r.status!=="REJECTED" || !decision || time>decision.appeal_deadline) fail("INVALID_STATE");
        const id=randomUUID(),ack=moderationBusinessTarget(time,2),due=moderationBusinessTarget(time,5);
        await c.tx.$executeRaw`INSERT INTO moderation_appeal(id,review_id,decision_id,grounds,explanation,created_at,acknowledgement_due_at,decision_due_at)
          VALUES (${id}::uuid,${r.id}::uuid,${i.decisionId}::uuid,${JSON.stringify(i.grounds)}::jsonb,${i.explanation},${time},${ack},${due})`;
        await c.tx.$executeRaw`UPDATE held_laptop_review SET status='APPEAL_PENDING',assigned_to=NULL,closed_at=NULL WHERE id=${r.id}::uuid`;
        await notice({...c,now:()=>time},"APPEAL_RECEIVED");
        await appendModerationAudit(c,"APPEAL_RECEIVED",r.id,"Seller moderation appeal");
        return {id,reviewId:r.id,status:"APPEAL_PENDING"};
      });
    },
    async acknowledgeAppeal(headers: Headers,input: unknown) {
      const i=parse(reviewCommand,input);
      return run(headers,{purpose:"MODERATION_APPEAL",permission:"APPEAL",reviewId:i.reviewId,assigned:true,command:"ACKNOWLEDGE",input:i,reason:i.reason},async(c)=>{
        if(c.review!.status!=="APPEAL_PENDING") fail("INVALID_STATE");
        await c.tx.$executeRaw`UPDATE moderation_appeal SET acknowledged_at=${now()} WHERE review_id=${i.reviewId}::uuid AND acknowledged_at IS NULL`;
        await c.tx.$executeRaw`UPDATE held_laptop_review SET status='APPEAL_REVIEW' WHERE id=${i.reviewId}::uuid`;
        await notice(c,"APPEAL_UNDER_REVIEW"); await appendModerationAudit(c,"APPEAL_ACKNOWLEDGED",i.reviewId,i.reason); return {id:i.reviewId,status:"APPEAL_REVIEW"};
      });
    },
    async resolveAppeal(headers: Headers,input: unknown) {
      const i=parse(reviewCommand.extend({outcome:z.enum(["CONFIRMED","CORRECTED"]),responses:z.record(z.string(),explanation),fallbackReason:explanation.optional()}),input);
      return run(headers,{purpose:"MODERATION_APPEAL",permission:"APPEAL",reviewId:i.reviewId,assigned:true,fresh:true,command:"RESOLVE_APPEAL",input:i,reason:i.reason},async(c)=>{
        const r=c.review!;
        if(r.status!=="APPEAL_REVIEW") fail("INVALID_STATE");
        const appeal=(await c.tx.$queryRaw<{decision_id:string;grounds:string[];actor_id:string}[]>`SELECT a.decision_id,a.grounds,d.actor_id
          FROM moderation_appeal a JOIN moderation_decision d ON d.id=a.decision_id WHERE a.review_id=${r.id}::uuid AND a.resolved_at IS NULL`)[0];
        if(!appeal || appeal.grounds.some((g)=>!i.responses[g]) || Object.keys(i.responses).some((g)=>!appeal.grounds.includes(g))) fail("INVALID_INPUT");
        if(appeal.actor_id===c.actor) {
          if(!i.fallbackReason) fail("INVALID_INPUT");
          const others=await c.tx.$queryRaw<{account_id:string}[]>`SELECT DISTINCT account_id FROM moderation_grant WHERE permission='APPEAL' AND revoked_at IS NULL
            AND starts_at<=${now()} AND ends_at>${now()} AND account_id<>${c.actor}::uuid`;
          for(const other of others) if(await available(c,other.account_id) && await nonconflicted(c,other.account_id)) fail("UNAUTHORIZED");
        }
        const id=randomUUID(),time=now(),action=i.outcome==="CONFIRMED"?"APPEAL_CONFIRMED":"APPEAL_CORRECTED";
        const reasonCode=i.outcome==="CONFIRMED"?"ORIGINAL_DECISION_CONFIRMED":"DECISION_CORRECTED";
        const listing=await c.tx.listing.findUnique({where:{id:r.listing_id},select:{status:true,currentRevisionNumber:true}});
        if(!listing || listing.status!=="REJECTED" || listing.currentRevisionNumber!==r.revision) fail("INVALID_STATE");
        await c.tx.$executeRaw`INSERT INTO moderation_decision(id,review_id,revision_id,actor_id,action,reason_code,rationale,prior_state,resulting_state,created_at,corrects_id)
          VALUES (${id}::uuid,${r.id}::uuid,${r.revision_id}::uuid,${c.actor}::uuid,${action},${reasonCode},
            ${i.reason},${r.status},'RESOLVED',${time},${appeal.decision_id}::uuid)`;
        for(const [ground,response] of Object.entries(i.responses)) await c.tx.$executeRaw`INSERT INTO moderation_appeal_response(decision_id,ground,explanation)
          VALUES (${id}::uuid,${ground},${response})`;
        if(appeal.actor_id===c.actor) await appendModerationAudit(c,"SEPARATE_RECONSIDERATION",r.id,i.fallbackReason!);
        // Correction explicitly returns to private HELD for a new eligible review;
        // it never approves publication or lifts an account restriction.
        if(i.outcome==="CORRECTED") await c.tx.listing.update({where:{id:r.listing_id,status:"REJECTED",currentRevisionNumber:r.revision},data:{status:"HELD"},select:{id:true}});
        await c.tx.$executeRaw`UPDATE moderation_appeal SET resolved_at=${time} WHERE review_id=${r.id}::uuid`;
        await c.tx.$executeRaw`UPDATE held_laptop_review SET status='RESOLVED',closed_at=${time} WHERE id=${r.id}::uuid`;
        await notice({...c,now:()=>time},"APPEAL_RESOLVED",id); await appendModerationAudit(c,"APPEAL_RESOLVED",r.id,i.reason);
        return {id,reviewId:r.id,status:"RESOLVED"};
      });
    },
  };
}
