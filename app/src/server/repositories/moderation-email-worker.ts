import "server-only";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../prisma.ts";
import { moderationEmail, moderationExpiry } from "../moderation-policy.ts";

type Database=ReturnType<typeof getPrisma>;
type Job={id:string;account_id:string;attempts:number;recipient:string|null;binding_generation:bigint;deadline:Date;available_at:Date;lease_id:string;lease_until:Date;state:string};
type FakeSender=(message:{to:string;subject:string;text:string;html:string},signal:AbortSignal)=>Promise<{status:number;accepted?:boolean}>;
const backoff=[60,300,1800,7200];

/** Local synthetic adapter only. There is no provider integration, scheduler or
 * HTTP route. Default is disabled; tests explicitly inject a fictional sender. */
export function createModerationEmailWorker(database:Database,send?:FakeSender,clock:()=>Date=()=>new Date()) {
  const now=()=>{const value=clock();if(!Number.isFinite(value.getTime()))throw new Error("Invalid moderation clock");return value;};
  async function withJob<T>(id:string,work:(tx:Pick<Database,"$queryRaw"|"$executeRaw">,job:Job)=>Promise<T>) {
    return database.$transaction(async(tx)=>{
      // Match the review command's account -> control -> work-row lock order.
      await tx.$queryRaw`SELECT a.id FROM user_account a JOIN "user" u ON u.id=a."authUserId"
        WHERE a.id=(SELECT account_id FROM moderation_email_job WHERE id=${id}::uuid) ORDER BY a.id FOR UPDATE OF u,a`;
      await tx.$queryRaw`SELECT singleton FROM moderation_control WHERE singleton=true FOR UPDATE`;
      const job=(await tx.$queryRaw<Job[]>`SELECT id,account_id,attempts,recipient,binding_generation,deadline,available_at,lease_id,lease_until,state
        FROM moderation_email_job WHERE id=${id}::uuid FOR UPDATE SKIP LOCKED`)[0];
      return job?work(tx,job):null;
    });
  }
  async function attempt(tx:Pick<Database,"$executeRaw">,job:Job,phase:string) {
    if(job.attempts>0) await tx.$executeRaw`INSERT INTO moderation_email_attempt(id,job_id,execution,phase,created_at)
      VALUES (${randomUUID()}::uuid,${job.id}::uuid,${job.attempts},${phase},${now()}) ON CONFLICT DO NOTHING`;
    if(["ACCEPTED","FAILED","UNKNOWN","SUPPRESSED","EXPIRED"].includes(phase))await tx.$executeRaw`UPDATE moderation_notice SET email_outcome=${phase}
      WHERE id=(SELECT notice_id FROM moderation_email_job WHERE id=${job.id}::uuid)`;
  }
  async function maintain() {
    // Bounded recovery/expiry. Exceptions cannot extend a delivery window.
    const jobs=await database.$queryRaw<{id:string}[]>`SELECT id FROM moderation_email_job WHERE
      (deadline<=${now()} AND (terminal_at IS NULL OR recipient IS NOT NULL)) OR (state IN ('LEASED','SENDING') AND lease_until<=${now()}) ORDER BY deadline,id LIMIT 100`;
    for(const {id} of jobs) await withJob(id,async(tx,job)=>{
      const time=now();
      if(job.deadline<=time) {
        await tx.$executeRaw`UPDATE moderation_email_job SET recipient=NULL,state=CASE WHEN terminal_at IS NULL THEN 'EXPIRED' ELSE state END,
          terminal_at=COALESCE(terminal_at,deadline),lease_id=NULL,lease_until=NULL WHERE id=${id}::uuid`;
        await attempt(tx,job,"EXPIRED");
      } else if(job.lease_until<=time && ["LEASED","SENDING"].includes(job.state)) {
        const state=job.state==="SENDING"?"UNKNOWN":job.attempts>=5?"FAILED":"READY";
        await tx.$executeRaw`UPDATE moderation_email_job SET state=${state},recipient=CASE WHEN ${state}='FAILED' THEN NULL ELSE recipient END,
          terminal_at=CASE WHEN ${state}='FAILED' THEN ${time} ELSE NULL END,lease_id=NULL,lease_until=NULL WHERE id=${id}::uuid`;
        if(state!=="READY")await attempt(tx,job,state);
      }
    });
    await database.$executeRaw`DELETE FROM moderation_email_job WHERE id IN (SELECT id FROM moderation_email_job
      WHERE terminal_at<=${new Date(now().getTime()-30*86400000)} ORDER BY terminal_at,id LIMIT 100)`;
  }
  return {
    async runOnce() {
      await maintain();
      await this.cleanupReviews();
      if(!send)return {status:"DISABLED"};
      const next=(await database.$queryRaw<{id:string}[]>`SELECT id FROM moderation_email_job
        WHERE state='READY' AND attempts<5 AND available_at<=${now()} AND deadline>${now()} ORDER BY available_at,id LIMIT 1`)[0];
      if(!next)return {status:"IDLE"};
      const leased=await withJob(next.id,async(tx,job)=>{
        const time=now();
        if(job.state!=="READY" || job.attempts>=5 || job.deadline<=time || job.available_at>time)return null;
        const lease=randomUUID();
        await tx.$executeRaw`UPDATE moderation_email_job SET state='LEASED',attempts=attempts+1,lease_id=${lease}::uuid,
          lease_until=${new Date(time.getTime()+120000)} WHERE id=${job.id}::uuid`;
        job.attempts++; job.lease_id=lease;
        await attempt(tx,job,"CLAIM");return job;
      });
      if(!leased)return {status:"IDLE"};
      const sending=await withJob(leased.id,async(tx,job)=>{
        const time=now();
        if(job.state!=="LEASED" || job.lease_id!==leased.lease_id || job.lease_until<=time || job.deadline<=time)return null;
        const valid=await tx.$queryRaw<{email:string}[]>`SELECT u.email FROM user_account a JOIN "user" u ON u.id=a."authUserId"
          JOIN moderation_email_binding b ON b.user_id=u.id WHERE a.id=${job.account_id}::uuid AND a."deletedAt" IS NULL
          AND u."emailVerified" AND a."emailVerifiedAt"<=${time} AND u.email=${job.recipient} AND b.generation=${job.binding_generation}`;
        if(!valid.length) {
          await tx.$executeRaw`UPDATE moderation_email_job SET state='SUPPRESSED',recipient=NULL,terminal_at=${time},lease_id=NULL,lease_until=NULL WHERE id=${job.id}::uuid`;
          await attempt(tx,job,"SUPPRESSED");return null;
        }
        await tx.$executeRaw`UPDATE moderation_email_job SET state='SENDING' WHERE id=${job.id}::uuid`;
        await attempt(tx,job,"SENDING");return job;
      });
      if(!sending)return {status:"SUPPRESSED"};
      const controller=new AbortController();
      let timer:ReturnType<typeof setTimeout>|undefined;
      let state="UNKNOWN";
      try {
        const result=await Promise.race([send({to:sending.recipient!,...moderationEmail},controller.signal),
          new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error("Timeout"));},30000);})]);
        if(result.status===429)state="RATE_LIMITED";
        else if(result.status>=400 && result.status<500)state="FAILED";
        else if(result.status>=200 && result.status<300 && result.accepted===true)state="ACCEPTED";
      } catch { state="UNKNOWN"; } finally {if(timer)clearTimeout(timer);}
      const result=await withJob(sending.id,async(tx,job)=>{
        const time=now();
        if(job.state!=="SENDING" || job.lease_id!==leased.lease_id || job.lease_until<=time)return "LOST_LEASE";
        await attempt(tx,job,state);
        const retry=state==="RATE_LIMITED" && job.attempts<5 && time<job.deadline;
        const outcome=retry?"READY":state==="RATE_LIMITED"?"FAILED":state;
        const terminal=["ACCEPTED","FAILED"].includes(outcome);
        await tx.$executeRaw`UPDATE moderation_email_job SET state=${outcome},recipient=CASE WHEN ${terminal} THEN NULL ELSE recipient END,
          available_at=${retry?new Date(time.getTime()+backoff[job.attempts-1]*1000):time},lease_id=NULL,lease_until=NULL,
          terminal_at=${terminal?time:null},outcome_code=${state} WHERE id=${job.id}::uuid`;
        if(outcome==="FAILED" && state==="RATE_LIMITED")await tx.$executeRaw`UPDATE moderation_notice SET email_outcome='FAILED'
          WHERE id=(SELECT notice_id FROM moderation_email_job WHERE id=${job.id}::uuid)`;
        return outcome;
      });
      return {status:result??"LOST_LEASE"};
    },
    async cleanupReviews() {
      // Source revisions/media are NOT adopted or erased by this cleanup. Only
      // separately classified moderation references/history are owned here.
      const ids=await database.$queryRaw<{id:string;seller_id:string}[]>`SELECT r.id,r.seller_id FROM held_laptop_review r
        LEFT JOIN LATERAL(SELECT appeal_deadline FROM moderation_decision d WHERE d.review_id=r.id AND d.action='REJECT'
          ORDER BY created_at DESC LIMIT 1) d ON true
        WHERE (r.closed_at IS NULL AND r.status='REJECTED' AND d.appeal_deadline<${now()}
          AND NOT EXISTS(SELECT 1 FROM moderation_appeal a WHERE a.review_id=r.id))
        OR (r.closed_at IS NOT NULL AND (((r.closed_at AT TIME ZONE 'Asia/Manila')+interval '6 months') AT TIME ZONE 'Asia/Manila')<=${now()}
          AND NOT EXISTS(SELECT 1 FROM moderation_retention_exception e WHERE e.record_kind='REVIEW' AND e.record_id=r.id AND e.released_at IS NULL))
        ORDER BY r.submitted_at,r.id LIMIT 100`;
      let removed=0;
      for(const row of ids) await database.$transaction(async(tx)=>{
        await tx.$queryRaw`SELECT a.id FROM user_account a JOIN "user" u ON u.id=a."authUserId" WHERE a.id=${row.seller_id}::uuid FOR UPDATE OF u,a`;
        await tx.$queryRaw`SELECT singleton FROM moderation_control WHERE singleton=true FOR UPDATE`;
        const review=(await tx.$queryRaw<{closed_at:Date|null;status:string}[]>`SELECT closed_at,status FROM held_laptop_review WHERE id=${row.id}::uuid FOR UPDATE`)[0];
        if(!review)return;
        const time=now();
        if(!review.closed_at && review.status==="REJECTED") {
          const decision=(await tx.$queryRaw<{appeal_deadline:Date}[]>`SELECT appeal_deadline FROM moderation_decision WHERE review_id=${row.id}::uuid AND action='REJECT'
            AND appeal_deadline<${time} AND NOT EXISTS(SELECT 1 FROM moderation_appeal WHERE review_id=${row.id}::uuid) ORDER BY created_at DESC LIMIT 1`)[0];
          if(decision) {
            review.closed_at=decision.appeal_deadline;
            await tx.$executeRaw`UPDATE held_laptop_review SET closed_at=${review.closed_at} WHERE id=${row.id}::uuid`;
          }
        }
        if(!review.closed_at || moderationExpiry(review.closed_at)>time)return;
        const exception=await tx.$queryRaw<unknown[]>`SELECT id FROM moderation_retention_exception WHERE record_kind='REVIEW' AND record_id=${row.id}::uuid AND released_at IS NULL`;
        if(exception.length)return;
        await tx.$executeRaw`DELETE FROM held_laptop_review WHERE id=${row.id}::uuid`;
        removed++;
      });
      await database.$executeRaw`DELETE FROM moderation_audit WHERE id IN (SELECT a.id FROM moderation_audit a WHERE expires_at<=${now()}
        AND NOT EXISTS(SELECT 1 FROM moderation_grant g WHERE g.id=a.target_id)
        AND NOT EXISTS(SELECT 1 FROM moderation_shift s WHERE s.id=a.target_id)
        AND NOT EXISTS(SELECT 1 FROM moderation_retention_exception e WHERE e.record_kind='AUDIT' AND e.record_id=a.id AND e.released_at IS NULL)
        ORDER BY expires_at,id LIMIT 100)`;
      return {removed,continuationRequired:ids.length===100};
    },
  };
}
