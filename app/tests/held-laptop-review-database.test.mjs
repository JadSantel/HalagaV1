import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { openSignupSandbox } from "./helpers/signup-sandbox.mjs";
import { createLaptopDraftOperations } from "../src/server/repositories/laptop-drafts.ts";
import { createHeldLaptopReviewOperations, HeldReviewRejected } from "../src/server/repositories/held-laptop-review.ts";
import { createHeldReviewHandler } from "../src/server/repositories/held-laptop-review-http.ts";
import { createModerationEmailWorker } from "../src/server/repositories/moderation-email-worker.ts";
import { elapsedDays, moderationBusinessTarget, moderationExpiry, moderationEmail } from "../src/server/moderation-policy.ts";

const origin="http://127.0.0.1:3000";
const request=(extra={})=>({requestId:randomUUID(),reason:"Synthetic necessary review purpose",...extra});
const rejects=(code)=>(error)=>error instanceof HeldReviewRejected && error.code===code && error.message===code;

test("moderation PHT calendar clamps months, skips Sundays and preserves original clocks",()=>{
  assert.equal(moderationExpiry(new Date("2026-08-31T15:31:12Z")).toISOString(),"2027-02-28T15:31:12.000Z");
  assert.equal(moderationBusinessTarget(new Date("2026-10-24T15:30:00Z"),2).toISOString(),"2026-10-27T15:30:00.000Z");
  assert.equal(elapsedDays(new Date("2026-10-22T00:00:00Z"),7).toISOString(),"2026-10-29T00:00:00.000Z");
});

test("ADR-096 held-review controls in disposable synthetic PostgreSQL",async(t)=>{
  const sandbox=await openSignupSandbox();
  const {database:db,auth,connection}=sandbox;
  let time=new Date();
  const clock=()=>new Date(time);
  const ops=createHeldLaptopReviewOperations(db,auth,clock);
  const drafts=createLaptopDraftOperations(db,auth,clock);
  const handler=createHeldReviewHandler(ops,origin);
  const fixture=async()=>{
    const id=randomUUID(),email=`${id}@example.invalid`,password="synthetic-review-secret-only";
    const ctx=await auth.$context;
    await db.user.create({data:{id,name:"Synthetic reviewer",email,emailVerified:true}});
    await db.account.create({data:{id:randomUUID(),userId:id,accountId:id,providerId:"credential",password:await ctx.password.hash(password)}});
    const account=await db.userAccount.create({data:{authUserId:id,displayName:"Synthetic participant",adultAttestedAt:time,adultEligibilityCheckedAt:time,emailVerifiedAt:time}});
    const signed=await auth.api.signInEmail({body:{email,password},returnHeaders:true});
    const headers=new Headers({cookie:signed.headers.getSetCookie().map((v)=>v.split(";")[0]).join("; ")});
    const actor=await auth.api.getSession({headers});
    time=new Date(Math.max(time.getTime(),Date.now()+10));
    return {id:account.id,userId:id,headers,email,session:actor.session};
  };
  const accounts={};
  const counts=async()=>({decisions:await scalar("moderation_decision"),notices:await scalar("moderation_notice"),jobs:await scalar("moderation_email_job"),receipts:await scalar("moderation_receipt")});
  async function scalar(table) {return Number((await connection.query(`SELECT count(*) FROM ${table}`)).rows[0].count);}
  const prepare=async(actor,permission)=>ops.grant(accounts.owner.headers,request({accountId:actor.id,permission,
    startsAt:new Date(time.getTime()-1000).toISOString(),endsAt:elapsedDays(time,2).toISOString(),trainingReference:"Synthetic training record"}));
  const shift=async(actor,role="PRIMARY")=>{
    const result=await ops.schedule(accounts.owner.headers,request({accountId:actor.id,role,startsAt:new Date(time.getTime()-1000).toISOString(),
      endsAt:elapsedDays(time,2).toISOString(),trainingReference:"Synthetic training"}));
    await ops.availability(actor.headers,request({shiftId:result.id,accountId:actor.id,action:"CONFIRM"}));
    return result.id;
  };
  // Trusted test setup only. No production submission/provenance policy or owner
  // identity is invented. Never expose these fixture writes through a command.
  const held=async(seller=accounts.seller)=>{
    const created=await drafts.create(seller.headers,{requestId:randomUUID(),draft:{title:"Synthetic held laptop",privatePriceExpectation:"8123456.78"}});
    const revision=await db.listingRevision.findFirstOrThrow({where:{listingId:created.id,version:1}});
    await db.listing.update({where:{id:created.id},data:{status:"HELD"}});
    const id=randomUUID();
    await db.$executeRaw`INSERT INTO held_laptop_review(id,listing_id,revision,revision_id,seller_id,source_reference,source_policy,trigger_class,submitted_at,necessity_due_at)
      VALUES (${id}::uuid,${created.id}::uuid,1,${revision.id}::uuid,${seller.id}::uuid,${randomUUID()}::uuid,'synthetic-fixture-only','EVIDENCE',${time},${elapsedDays(time,30)})`;
    return {id,listingId:created.id,revisionId:revision.id,seller};
  };
  const claim=async(r,actor=accounts.reviewer,purpose="HELD_REVIEW")=>ops.claim(actor.headers,request({reviewId:r.id,purpose}));
  const decide=(r,extra={})=>request({reviewId:r.id,revision:1,action:"REJECT",reasonCode:"REQUIRED_INFORMATION",...extra});
  const detail=(r,extra={})=>({reviewId:r.id,purpose:"HELD_REVIEW",reason:"Synthetic necessary candidate inspection",...extra});
  try {
    for(const name of ["owner","reviewer","alternate","seller","stranger"])accounts[name]=await fixture();
    time=new Date(Date.now()+10);
    await t.test("missing installation binding denies owner administration; signed-in participants are never staff",async()=>{
      await assert.rejects(prepare(accounts.reviewer,"TRIAGE"),rejects("UNAUTHORIZED"));
      for(const actor of [new Headers(),accounts.owner.headers,accounts.seller.headers,accounts.stranger.headers])
        await assert.rejects(ops.queue(actor),rejects("UNAUTHORIZED"));
      await db.$executeRaw`UPDATE moderation_control SET owner_account_id=${accounts.owner.id}::uuid,installation_reference='synthetic-installation-record',verified_at=${time}`;
      // Installation evidence is fabricated only for this disposable test.
      await db.$executeRaw`INSERT INTO moderation_audit(id,actor_id,purpose,action,target_id,reason,created_at,expires_at)
        VALUES (${randomUUID()}::uuid,${accounts.owner.id}::uuid,'ADMINISTRATION','SYNTHETIC_OWNER_BINDING',${accounts.owner.id}::uuid,'Fictional installation evidence',${time},${moderationExpiry(time)})`;
      for(const actor of [accounts.reviewer,accounts.alternate]) {
        actor.grants={};
        for(const permission of ["TRIAGE","CLAIM","EVIDENCE","DECIDE","APPEAL"])actor.grants[permission]=(await prepare(actor,permission)).id;
        actor.shift=await shift(actor,actor===accounts.reviewer?"PRIMARY":"ALTERNATE");
      }
      await assert.rejects(prepare(accounts.stranger,"RECOVERY").then(()=>ops.grant(accounts.stranger.headers,request({accountId:accounts.stranger.id,permission:"DECIDE",
        startsAt:time.toISOString(),endsAt:elapsedDays(time,1).toISOString(),trainingReference:"Synthetic"}))),rejects("UNAUTHORIZED"));
      await assert.rejects(ops.queue(accounts.owner.headers),rejects("UNAUTHORIZED"));
    });
    await t.test("queue/detail projections exclude private expectation, identity and media; held remains inaccessible through drafts",async()=>{
      const r=await held();
      const queue=await ops.queue(accounts.reviewer.headers);
      assert.deepEqual(Object.keys(queue[0]).sort(),["id","triggerClass","category","status","submittedAt","necessityDueAt","assigned",
        "acknowledgementDueAt","decisionDueAt","acknowledgementOverdue","decisionOverdue"].sort());
      await assert.rejects(ops.detail(accounts.reviewer.headers,detail(r)),rejects("UNAUTHORIZED"));
      await claim(r);
      const result=await ops.detail(accounts.reviewer.headers,detail(r));
      assert.equal(result.revisionId,r.revisionId);assert.equal(result.candidate.title,"Synthetic held laptop");
      for(const secret of ["8123456.78",accounts.seller.id,accounts.seller.email,accounts.reviewer.email,accounts.reviewer.session.token,"source_reference","originalKey"])
        assert.equal(JSON.stringify(result).includes(secret),false,secret);
      await assert.rejects(ops.detail(accounts.stranger.headers,detail(r)),rejects("UNAUTHORIZED"));
      await assert.rejects(ops.detail(accounts.alternate.headers,detail(r)),rejects("UNAUTHORIZED"));
      await assert.rejects(ops.detail(accounts.reviewer.headers,detail(r,{purpose:"DELIVERY_RECOVERY"})),rejects("INVALID_INPUT"));
      await assert.rejects(drafts.read(accounts.seller.headers,r.listingId));
      assert.equal((await drafts.list(accounts.seller.headers)).drafts.some((d)=>d.id===r.listingId),false);
      assert.ok((await connection.query("SELECT * FROM moderation_audit WHERE action='DETAIL_READ' AND target_id=$1",[r.id])).rowCount);
    });
    await t.test("access audit failure denies disclosure; mandatory action/notice/job/receipt failure rolls everything back",async()=>{
      const r=await held();await claim(r);
      await connection.query(`CREATE FUNCTION synthetic_deny_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`);
      await connection.query("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON moderation_audit FOR EACH ROW EXECUTE FUNCTION synthetic_deny_audit()");
      try {await assert.rejects(ops.detail(accounts.reviewer.headers,detail(r)),rejects("INTERNAL_ERROR"));}
      finally {await connection.query("DROP TRIGGER synthetic_audit_failure ON moderation_audit");}
      for(const table of ["moderation_audit","moderation_notice","moderation_email_job","moderation_receipt"]) {
        const before=await counts();
        await connection.query(`CREATE TRIGGER synthetic_write_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION synthetic_deny_audit()`);
        try {await assert.rejects(ops.decide(accounts.reviewer.headers,decide(r)),rejects("INTERNAL_ERROR"));}
        finally {await connection.query(`DROP TRIGGER synthetic_write_failure ON ${table}`);}
        assert.deepEqual(await counts(),before);
        assert.equal((await db.listing.findUnique({where:{id:r.listingId}})).status,"HELD");
      }
    });
    await t.test("approval cannot override unavailable assessments, restrictions, revision or state",async()=>{
      const r=await held();await claim(r);const before=await counts();
      await assert.rejects(ops.decide(accounts.reviewer.headers,decide(r,{action:"APPROVE"})),rejects("ELIGIBILITY_UNAVAILABLE"));
      await db.accountMarketplaceRestriction.create({data:{accountId:accounts.seller.id,scope:"PUBLISH_LISTING",reason:"Synthetic restricted evidence",
        authorizedBy:"synthetic-operator",startsAt:time,reviewAt:elapsedDays(time,1)}});
      await assert.rejects(ops.decide(accounts.reviewer.headers,decide(r,{action:"APPROVE"})),rejects("ELIGIBILITY_UNAVAILABLE"));
      await assert.rejects(ops.decide(accounts.reviewer.headers,decide(r,{revision:2})),rejects("INVALID_STATE"));
      await db.listing.update({where:{id:r.listingId},data:{status:"REMOVED"}});
      await assert.rejects(ops.decide(accounts.reviewer.headers,decide(r)),rejects("INVALID_STATE"));
      assert.deepEqual(await counts(),before);assert.equal(await db.publicationCycle.count(),0);
    });
    await t.test("competing decisions, changed retries and safe seller feedback preserve exact immutable history",async()=>{
      const r=await held();await claim(r);
      const first=decide(r),second=decide(r);
      const settled=await Promise.allSettled([ops.decide(accounts.reviewer.headers,first),ops.decide(accounts.reviewer.headers,second)]);
      assert.equal(settled.filter((v)=>v.status==="fulfilled").length,1);
      const index=settled[0].status==="fulfilled"?0:1,winner=index===0?first:second;
      const result=settled[index].value;
      assert.deepEqual(await ops.decide(accounts.reviewer.headers,winner),result);
      await assert.rejects(ops.decide(accounts.reviewer.headers,{...winner,reason:"Changed payload"}),rejects("INVALID_STATE"));
      const seller=await ops.sellerDetail(accounts.seller.headers,{reviewId:r.id});
      assert.equal(seller.decisions[0].noticeTime.getTime()+7*86400000,seller.decisions[0].appealDeadline.getTime());
      for(const secret of [winner.reason,accounts.reviewer.id,accounts.reviewer.email,r.revisionId,"8123456.78"])
        assert.equal(JSON.stringify(seller).includes(secret),false);
      await assert.rejects(ops.sellerDetail(accounts.stranger.headers,{reviewId:r.id}),rejects("NOT_FOUND"));
      await assert.rejects(db.$executeRaw`UPDATE moderation_decision SET rationale='overwrite' WHERE id=${result.id}::uuid`);
      const notice=seller.notices[0];
      await ops.readNotice(accounts.seller.headers,request({reviewId:r.id,noticeId:notice.id}));
      const later=await ops.sellerDetail(accounts.seller.headers,{reviewId:r.id});
      assert.equal(later.decisions[0].appealDeadline.getTime(),seller.decisions[0].appealDeadline.getTime());
      assert.ok(later.notices[0].readAt);
    });
    await t.test("one authenticated Unicode text appeal, inclusive original deadline and human acknowledgement remain distinct",async()=>{
      const r=await held();await claim(r);const decision=await ops.decide(accounts.reviewer.headers,decide(r));
      const current=await ops.sellerDetail(accounts.seller.headers,{reviewId:r.id});
      const submission=request({reviewId:r.id,decisionId:decision.id,grounds:["FACTUAL_ERROR"],explanation:"Fictional appeal 🙂"});
      for(const changes of [{grounds:[]},{explanation:""},{explanation:"🙂".repeat(4001)},{references:["arbitrary-key"]}])
        await assert.rejects(ops.appeal(accounts.seller.headers,{...submission,...changes}),rejects("INVALID_INPUT"));
      // Separate synthetic clock avoids moving other fixtures beyond staff sessions.
      const deadline=current.decisions[0].appealDeadline;
      const atDeadline=createHeldLaptopReviewOperations(db,auth,()=>deadline);
      await db.session.update({where:{id:accounts.seller.session.id},data:{expiresAt:elapsedDays(deadline,1)}});
      const received=await atDeadline.appeal(accounts.seller.headers,submission);
      assert.deepEqual(await atDeadline.appeal(accounts.seller.headers,submission),received);
      await assert.rejects(atDeadline.appeal(accounts.seller.headers,{...submission,requestId:randomUUID()}),rejects("INVALID_STATE"));
      const status=await ops.sellerDetail(accounts.seller.headers,{reviewId:r.id});
      assert.equal(status.status,"APPEAL_PENDING");assert.equal(status.appeal.acknowledgedAt,null);
      assert.equal(status.appeal.acknowledgementDueAt.toISOString(),moderationBusinessTarget(deadline,2).toISOString());
      assert.equal((await db.listing.findUnique({where:{id:r.listingId}})).status,"REJECTED");
      const late=await held();await claim(late);const d=await ops.decide(accounts.reviewer.headers,decide(late));
      await assert.rejects(createHeldLaptopReviewOperations(db,auth,()=>new Date(deadline.getTime()+1)).appeal(accounts.seller.headers,
        request({reviewId:late.id,decisionId:d.id,grounds:["FACTUAL_ERROR"],explanation:"Late fictional appeal"})),rejects("INVALID_STATE"));
    });
    await t.test("appeal reconsideration addresses every ground and cannot bypass another available reviewer or a conflict",async()=>{
      const r=await held();await claim(r);const d=await ops.decide(accounts.reviewer.headers,decide(r));
      await ops.appeal(accounts.seller.headers,request({reviewId:r.id,decisionId:d.id,grounds:["FACTUAL_ERROR","PROCEDURAL_FAILURE"],explanation:"Synthetic grounds"}));
      await assert.rejects(claim(r,accounts.reviewer,"MODERATION_APPEAL"),rejects("UNAUTHORIZED"));
      await claim(r,accounts.alternate,"MODERATION_APPEAL");
      await ops.acknowledgeAppeal(accounts.alternate.headers,request({reviewId:r.id}));
      const resolve=request({reviewId:r.id,outcome:"CONFIRMED",responses:{FACTUAL_ERROR:"Synthetic response",PROCEDURAL_FAILURE:"Synthetic response"},fallbackReason:"Synthetic no alternate claim"});
      await assert.rejects(ops.resolveAppeal(accounts.reviewer.headers,resolve),rejects("UNAUTHORIZED"));
      await assert.rejects(ops.resolveAppeal(accounts.alternate.headers,{...resolve,responses:{FACTUAL_ERROR:"Incomplete"}}),rejects("INVALID_INPUT"));
      const outcome=await ops.resolveAppeal(accounts.alternate.headers,resolve);
      assert.equal(outcome.status,"RESOLVED");
      assert.equal((await connection.query("SELECT count(*) FROM moderation_appeal_response WHERE decision_id=$1",[outcome.id])).rows[0].count,"2");
      await assert.rejects(ops.appeal(accounts.seller.headers,request({reviewId:r.id,decisionId:outcome.id,grounds:["FACTUAL_ERROR"],explanation:"Second appeal"})),rejects("INVALID_STATE"));
      const conflicted=await held();await claim(conflicted);
      await ops.conflict(accounts.reviewer.headers,request({reviewId:conflicted.id}));
      await assert.rejects(ops.detail(accounts.reviewer.headers,detail(conflicted)),rejects("UNAUTHORIZED"));
      await assert.rejects(ops.decide(accounts.reviewer.headers,decide(conflicted)),rejects("UNAUTHORIZED"));
    });
    await t.test("current coverage, fresh sessions, declared availability and grant revocation gate reads/actions and receipt replay",async()=>{
      const r=await held();await claim(r);
      await ops.availability(accounts.reviewer.headers,request({shiftId:accounts.reviewer.shift,accountId:accounts.reviewer.id,action:"UNAVAILABLE"}));
      await assert.rejects(ops.detail(accounts.reviewer.headers,detail(r)),rejects("UNAUTHORIZED"));
      await assert.rejects(ops.availability(accounts.reviewer.headers,request({shiftId:accounts.reviewer.shift,accountId:accounts.reviewer.id,action:"CONFIRM"})),rejects("INVALID_STATE"));
      await ops.availability(accounts.owner.headers,request({shiftId:accounts.reviewer.shift,accountId:accounts.reviewer.id,action:"RESTORE"}));
      const input=decide(r);await ops.decide(accounts.reviewer.headers,input);
      await ops.revoke(accounts.owner.headers,request({accountId:accounts.reviewer.id,grantId:accounts.reviewer.grants.DECIDE}));
      await assert.rejects(ops.decide(accounts.reviewer.headers,input),rejects("UNAUTHORIZED"));
      accounts.reviewer.grants.DECIDE=(await prepare(accounts.reviewer,"DECIDE")).id;
      const stale=createHeldLaptopReviewOperations(db,auth,()=>new Date(accounts.reviewer.session.createdAt.getTime()+900000));
      await assert.rejects(stale.decide(accounts.reviewer.headers,input),rejects("UNAUTHORIZED"));
    });
    await t.test("original reviewer fallback is separate and logged; conflicts remain blocking; explicit correction never publishes",async()=>{
      const r=await held();await claim(r);const d=await ops.decide(accounts.reviewer.headers,decide(r));
      await ops.appeal(accounts.seller.headers,request({reviewId:r.id,decisionId:d.id,grounds:["FACTUAL_ERROR"],explanation:"Fictional correction"}));
      await ops.availability(accounts.alternate.headers,request({accountId:accounts.alternate.id,shiftId:accounts.alternate.shift,action:"UNAVAILABLE"}));
      try {
        await claim(r,accounts.reviewer,"MODERATION_APPEAL");
        await ops.acknowledgeAppeal(accounts.reviewer.headers,request({reviewId:r.id}));
        await ops.resolveAppeal(accounts.reviewer.headers,request({reviewId:r.id,outcome:"CORRECTED",responses:{FACTUAL_ERROR:"Synthetic ground addressed"},fallbackReason:"No different eligible operator is available"}));
        assert.equal((await db.listing.findUnique({where:{id:r.listingId}})).status,"HELD");
        assert.equal((await connection.query("SELECT count(*) FROM moderation_audit WHERE target_id=$1 AND action='SEPARATE_RECONSIDERATION'",[r.id])).rows[0].count,"1");
        const conflicted=await held();await claim(conflicted);const previous=await ops.decide(accounts.reviewer.headers,decide(conflicted));
        await ops.appeal(accounts.seller.headers,request({reviewId:conflicted.id,decisionId:previous.id,grounds:["FACTUAL_ERROR"],explanation:"Synthetic conflict"}));
        await ops.conflict(accounts.reviewer.headers,request({reviewId:conflicted.id}));
        await assert.rejects(claim(conflicted,accounts.reviewer,"MODERATION_APPEAL"),rejects("UNAUTHORIZED"));
      } finally {await ops.availability(accounts.owner.headers,request({accountId:accounts.alternate.id,shiftId:accounts.alternate.shift,action:"RESTORE"}));}
    });
    await t.test("coverage expiring during required writes fails final authorization and rolls the decision back",async()=>{
      const r=await held();await claim(r);
      await ops.availability(accounts.reviewer.headers,request({accountId:accounts.reviewer.id,shiftId:accounts.reviewer.shift,action:"UNAVAILABLE"}));
      try {
        const ends=new Date(time.getTime()+1000);
        const short=await ops.schedule(accounts.owner.headers,request({accountId:accounts.reviewer.id,role:"PRIMARY",startsAt:time.toISOString(),endsAt:ends.toISOString(),trainingReference:"Synthetic short shift"}));
        await ops.availability(accounts.reviewer.headers,request({accountId:accounts.reviewer.id,shiftId:short.id,action:"CONFIRM"}));
        let decisionTime=new Date(time);
        const wrapped={$transaction:(work,options)=>db.$transaction((tx)=>work(new Proxy(tx,{get(target,key){
          if(key==="$executeRaw")return async(strings,...values)=>{
            const result=await target.$executeRaw(strings,...values);
            if(strings[0].startsWith("INSERT INTO moderation_receipt"))decisionTime=ends;
            return result;
          };
          return Reflect.get(target,key);
        }})),options)};
        const guarded=createHeldLaptopReviewOperations(wrapped,auth,()=>decisionTime),before=await counts();
        await assert.rejects(guarded.decide(accounts.reviewer.headers,decide(r)),rejects("UNAUTHORIZED"));
        assert.deepEqual(await counts(),before);assert.equal((await db.listing.findUnique({where:{id:r.listingId}})).status,"HELD");
      } finally {await ops.availability(accounts.owner.headers,request({accountId:accounts.reviewer.id,shiftId:accounts.reviewer.shift,action:"RESTORE"}));}
    });
    await t.test("a concurrent revision replacement cannot resolve the formerly current held revision",async()=>{
      const seller=await fixture(),r=await held(seller);await claim(r);
      await connection.query("BEGIN");await connection.query('SELECT id FROM user_account WHERE id=$1 FOR UPDATE',[seller.id]);
      const pending=ops.decide(accounts.reviewer.headers,decide(r)).catch((error)=>error);
      try {
        let blocked=false;
        for(let n=0;n<80;n++) {
          if((await connection.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked",[connection.processID])).rows[0].blocked){blocked=true;break;}
          await delay(10);
        }
        assert.equal(blocked,true);
        await connection.query(`INSERT INTO listing_revision(id,"listingId",version,"authoredById","listingType",category,title,description)
          VALUES ($1,$2,2,$3,'SINGLE_ITEM','LAPTOPS','Synthetic replacement','')`,[randomUUID(),r.listingId,seller.id]);
        await connection.query('UPDATE listing SET "currentRevisionNumber"=2 WHERE id=$1',[r.listingId]);
        await connection.query("COMMIT");assert.equal((await pending).code,"INVALID_STATE");
        const pinned=await ops.detail(accounts.reviewer.headers,detail(r));assert.equal(pinned.revisionId,r.revisionId);
      } finally {await connection.query("ROLLBACK");await pending;}
    });
    await t.test("restriction committed while waiting is rechecked after account lock",async()=>{
      const seller=await fixture(),r=await held(seller);await claim(r);
      await connection.query("BEGIN");
      await connection.query('SELECT id FROM user_account WHERE id=$1 FOR UPDATE',[seller.id]);
      let pending;
      try {
        pending=ops.decide(accounts.reviewer.headers,decide(r,{reasonCode:"ACCOUNT_PUBLICATION_RESTRICTED"}));
        const handled=pending.catch((error)=>error);
        let blocked=false;
        for(let n=0;n<80;n++) {
          const result=await connection.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked",[connection.processID]);
          if(result.rows[0].blocked){blocked=true;break;} await delay(10);
        }
        assert.equal(blocked,true,"Decision must wait for the exact restriction backend");
        await connection.query(`INSERT INTO account_marketplace_restriction(id,"accountId",scope,reason,"startsAt","reviewAt","authorizedBy")
          VALUES ($1,$2,'SUSPENSION','Synthetic concurrent restriction',$3,$4,'synthetic-operator')`,[randomUUID(),seller.id,time,elapsedDays(time,1)]);
        await connection.query("COMMIT");
        assert.equal((await handled).status,"REJECTED");
      } finally {await connection.query("ROLLBACK");if(pending)await pending.catch(()=>{});}
      assert.equal((await db.listing.findUnique({where:{id:r.listingId}})).status,"REJECTED");
    });
    await t.test("protected unmounted HTTP adapter denies cross-origin, participant, invalid purpose and admin dispatch",async()=>{
      const r=await held();await claim(r);
      const call=(actor,path,body,extra={})=>handler(new Request(`${origin}${path}`,{method:body?"POST":"GET",
        headers:{origin,"content-type":"application/json",cookie:actor?.headers.get("cookie")??"",...extra},...(body?{body:JSON.stringify(body)}:{})}));
      for(const actor of [null,accounts.seller,accounts.stranger]) {
        const denied=await call(actor,"/api/operator/held-laptops");assert.equal(denied.status,403);
        assert.equal(denied.headers.get("cache-control"),"no-store");assert.equal(denied.headers.get("vary"),"Cookie");
      }
      assert.equal((await call(accounts.reviewer,`/api/operator/held-laptops/${r.id}/detail`,{reason:"Synthetic",purpose:"HELD_REVIEW"},{origin:"https://foreign.invalid"})).status,403);
      assert.equal((await call(accounts.reviewer,`/api/operator/held-laptops/${r.id}/detail`,{reason:"Synthetic",purpose:"AUDIT_INSPECTION"})).status,400);
      assert.equal((await call(accounts.owner,`/api/operator/held-laptops/${r.id}/grant`,request())).status,404);
    });
    await t.test("email defaults disabled; generic fake delivery, ABA suppression, ambiguity and five-execution bounds preserve decisions",async()=>{
      assert.equal((await createModerationEmailWorker(db,undefined,clock).runOnce()).status,"DISABLED");
      // Clear older ready fixture jobs so each assertion names exactly one event.
      await db.$executeRaw`UPDATE moderation_email_job SET state='SUPPRESSED',recipient=NULL,terminal_at=${time} WHERE state='READY'`;
      const r=await held();await claim(r);await ops.decide(accounts.reviewer.headers,decide(r));
      let messages=[];
      const worker=createModerationEmailWorker(db,async(message)=>{messages.push(message);return {status:202,accepted:true};},clock);
      assert.equal((await worker.runOnce()).status,"ACCEPTED");assert.equal(messages.length,1);
      assert.deepEqual(messages[0],{to:accounts.seller.email,...moderationEmail});
      assert.equal((await worker.runOnce()).status,"IDLE");
      const aba=await held();await claim(aba);await ops.decide(accounts.reviewer.headers,decide(aba));
      await db.user.update({where:{id:accounts.seller.userId},data:{email:"fictional-switched@example.invalid"}});
      await db.user.update({where:{id:accounts.seller.userId},data:{email:accounts.seller.email}});
      assert.equal((await worker.runOnce()).status,"SUPPRESSED");assert.equal(messages.length,1);
      const unknown=await held();await claim(unknown);await ops.decide(accounts.reviewer.headers,decide(unknown));
      const ambiguous=createModerationEmailWorker(db,async()=>{throw new Error("Fictional private provider failure");},clock);
      assert.equal((await ambiguous.runOnce()).status,"UNKNOWN");assert.equal((await ambiguous.runOnce()).status,"IDLE");
      const limited=await held();await claim(limited);await ops.decide(accounts.reviewer.headers,decide(limited));
      let workerTime=new Date(time);
      const throttled=createModerationEmailWorker(db,async()=>({status:429}),()=>workerTime);
      for(const [index,seconds] of [60,300,1800,7200,1].entries()) {
        assert.equal((await throttled.runOnce()).status,index===4?"FAILED":"READY");
        workerTime=new Date(workerTime.getTime()+seconds*1000);
      }
      assert.equal((await throttled.runOnce()).status,"IDLE");
      const jobs=await connection.query("SELECT * FROM moderation_email_job WHERE state IN ('ACCEPTED','SUPPRESSED','FAILED')");
      assert.ok(jobs.rows.every((j)=>j.recipient===null));
      assert.equal((await db.listing.findUnique({where:{id:limited.listingId}})).status,"REJECTED");
      await createModerationEmailWorker(db,undefined,()=>elapsedDays(time,8)).runOnce();
      assert.equal((await connection.query("SELECT count(*) FROM moderation_email_job WHERE recipient IS NOT NULL")).rows[0].count,"0");
    });
    await t.test("six-month cleanup preserves scoped exceptions, original clocks and independent source revisions",async()=>{
      const r=await held();await claim(r);await ops.decide(accounts.reviewer.headers,decide(r));
      const original=await ops.sellerDetail(accounts.seller.headers,{reviewId:r.id});
      const close=original.decisions[0].appealDeadline;
      const expiry=new Date(moderationExpiry(close).getTime()+1);
      const exception=randomUUID();
      await db.$executeRaw`INSERT INTO moderation_retention_exception(id,record_kind,record_id,authorizer_id,purpose,started_at,review_at)
        VALUES (${exception}::uuid,'REVIEW',${r.id}::uuid,${accounts.owner.id}::uuid,'Synthetic scoped safety hold',${time},${elapsedDays(time,30)})`;
      const worker=createModerationEmailWorker(db,undefined,()=>expiry);
      await worker.cleanupReviews();
      assert.equal((await connection.query("SELECT count(*) FROM held_laptop_review WHERE id=$1",[r.id])).rows[0].count,"1");
      await db.$executeRaw`UPDATE moderation_retention_exception SET released_at=${expiry} WHERE id=${exception}::uuid`;
      await worker.cleanupReviews();
      assert.equal((await connection.query("SELECT count(*) FROM held_laptop_review WHERE id=$1",[r.id])).rows[0].count,"0");
      assert.ok(await db.listingRevision.findUnique({where:{id:r.revisionId}}));
    });
    await t.test("recovery/audit permissions are separate; unknown delivery can be resolved without resend and recipient disclosure",async()=>{
      const r=await held();await claim(r);await ops.decide(accounts.reviewer.headers,decide(r));
      await createModerationEmailWorker(db,async()=>{throw new Error("Synthetic ambiguity");},clock).runOnce();
      const job=(await connection.query("SELECT j.id FROM moderation_email_job j JOIN moderation_notice n ON n.id=j.notice_id WHERE n.review_id=$1",[r.id])).rows[0];
      const input={reviewId:r.id,jobId:job.id,reason:"Synthetic delivery diagnosis"};
      await assert.rejects(ops.inspectDelivery(accounts.reviewer.headers,input),rejects("UNAUTHORIZED"));
      const projected=await ops.inspectDelivery(accounts.stranger.headers,input);
      assert.equal(projected[0].state,"UNKNOWN");assert.equal(Object.hasOwn(projected[0],"recipient"),false);
      await assert.rejects(ops.auditTrail(accounts.stranger.headers,{reviewId:r.id,reason:"Synthetic audit inspection"}),rejects("UNAUTHORIZED"));
      await prepare(accounts.stranger,"AUDIT");
      assert.ok((await ops.auditTrail(accounts.stranger.headers,{reviewId:r.id,reason:"Synthetic audit inspection"})).length);
      await assert.rejects(ops.detail(accounts.stranger.headers,detail(r)),rejects("UNAUTHORIZED"));
      await ops.resolveUnknownDelivery(accounts.stranger.headers,request({reviewId:r.id,jobId:job.id}));
      const retained=(await connection.query("SELECT * FROM moderation_email_job WHERE id=$1",[job.id])).rows[0];
      assert.equal(retained.recipient,null);assert.equal(retained.outcome_code,"RESOLVED_WITHOUT_RESEND");assert.equal(retained.attempts,1);
    });
    await t.test("ineligible email is never backfilled by later verification",async()=>{
      const seller=await fixture();await db.user.update({where:{id:seller.userId},data:{emailVerified:false}});
      const r=await held(seller);await claim(r);await ops.decide(accounts.reviewer.headers,decide(r));
      assert.equal((await connection.query("SELECT count(*) FROM moderation_email_job j JOIN moderation_notice n ON n.id=j.notice_id WHERE n.review_id=$1",[r.id])).rows[0].count,"0");
      await db.user.update({where:{id:seller.userId},data:{emailVerified:true}});
      await createModerationEmailWorker(db,undefined,clock).runOnce();
      assert.equal((await connection.query("SELECT count(*) FROM moderation_email_job j JOIN moderation_notice n ON n.id=j.notice_id WHERE n.review_id=$1",[r.id])).rows[0].count,"0");
    });
  } finally {await sandbox.close();}
});
