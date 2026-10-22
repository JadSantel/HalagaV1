"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Full navigation clears private state and reauthorizes reads. */
import { useEffect, useRef, useState } from "react";
import { safeTestingGuidance } from "../../domain/laptop-diagnostics";
import type { LaptopDraftReview } from "../../server/laptop-draft-review";
import { DraftPhotoGallery } from "./photos";
import type { DraftPhoto } from "../../domain/draft-photo-policy";

type Review = Omit<LaptopDraftReview, "savedAt"> & { savedAt: string; photos: DraftPhoto[];
  submissionGates: { code: string; message: string }[] };
type CheckPhase = "idle" | "pending" | "paused" | "stale" | "signed-out" | "restricted" | "missing" | "uncertain";
const evaluationLabels = { eligible: "Eligible under evaluated rules", incomplete: "Missing requirements",
  ineligible: "Ineligible for normal publication", "review-required": "Human review required before publication",
  unavailable: "Required checks unavailable" };
const link = "inline-block min-h-11 py-2 font-medium text-[#176b59] underline underline-offset-4";
const section = "mt-9 border-t border-[#d9dfda] pt-7";

export default function DraftReview({ listingId, revision }: { listingId: string; revision: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [phase, setPhase] = useState("loading");
  const heading = useRef<HTMLHeadingElement>(null);
  const [checkPhase, setCheckPhase] = useState<CheckPhase>("idle");
  const [checkedEvaluation, setCheckedEvaluation] = useState<Review["evaluation"] | null>(null);
  const checkFeedback = useRef<HTMLParagraphElement>(null);
  const checking = useRef<AbortController | null>(null);
  const editor = `/drafts/${encodeURIComponent(listingId)}`;
  useEffect(() => {
    const abort = new AbortController();
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pageshow", restore);
    async function load() {
      try {
        const response = await fetch(`/api/laptop-drafts/${encodeURIComponent(listingId)}/review?revision=${encodeURIComponent(revision)}`, {
          credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error", signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        if (!response.ok) { setPhase(response.status === 401 ? "signed-out" : [400, 404].includes(response.status) ? "missing" : "error"); return; }
        const result = await response.json();
        if (abort.signal.aborted) return;
        setReview(result); setPhase("ready");
      } catch { if (!abort.signal.aborted) setPhase("error"); }
    }
    void load();
    return () => { abort.abort(); checking.current?.abort(); window.removeEventListener("pageshow", restore); };
  }, [listingId, revision]);
  useEffect(() => { if (phase !== "loading") heading.current?.focus(); }, [phase]);
  useEffect(() => { if (checkPhase !== "idle" && checkPhase !== "pending") checkFeedback.current?.focus(); }, [checkPhase]);
  async function recheck() {
    if (!review || checking.current) return;
    const abort = new AbortController();
    checking.current = abort;
    setCheckPhase("pending"); setCheckedEvaluation(null);
    try {
      const response = await fetch(`/api/laptop-drafts/${encodeURIComponent(listingId)}/submission-check`, {
        method: "POST", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: review.revision }), signal: abort.signal,
      });
      const result = await response.json();
      if (abort.signal.aborted) return;
      if (response.ok && result.outcome === "PAUSED" && result.listingId === listingId && result.revision === review.revision) {
        setCheckedEvaluation(result.evaluation); setCheckPhase("paused");
      } else setCheckPhase(response.status === 401 ? "signed-out" : response.status === 403 ? "restricted"
        : response.status === 409 && result.code === "STALE_REVISION" ? "stale" : response.status === 404 ? "missing" : "uncertain");
    } catch { if (!abort.signal.aborted) setCheckPhase("uncertain"); }
    finally { if (checking.current === abort) checking.current = null; }
  }
  const content = review?.proposedPublicContent;
  return <>
    <a href="#review" className="sr-only z-10 bg-white p-3 focus:not-sr-only focus:absolute">Skip to review</a>
    <header className="border-b border-[#d9dfda] bg-white"><nav aria-label="Draft review" className="mx-auto flex max-w-4xl flex-wrap gap-5 px-5 py-5">
      <a href="/drafts" className={link}>Your drafts</a><a href={editor} className={link}>Edit current saved draft</a>
    </nav></header>
    <main id="review" className="mx-auto w-full max-w-4xl break-words px-5 py-10 sm:px-8">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight">Review saved laptop revision</h1>
      <p className="mt-3 max-w-2xl">Local synthetic validation only. Nothing is published. This owner-only review does not submit a listing or request operator review.</p>
      <p role="status" aria-atomic="true" className="mt-5 font-medium">{phase === "loading" ? "Loading your saved revision…" : phase === "ready" ? `Reviewing saved revision ${review?.revision}. Nothing is published.` : phase === "signed-out" ? "Sign in to review your saved revision." : phase === "missing" ? "This saved revision is unavailable for this account. Open your draft to choose a saved revision." : "The review could not be loaded. No draft content is available."}</p>
      {phase === "signed-out" && <a href="/account/sign-in" className={link}>Sign in, then return and reload</a>}
      {phase === "error" && <button type="button" onClick={() => window.location.reload()} className={`${link} cursor-pointer`}>Retry loading review</button>}
      {review && content && <>
        <p className="mt-4">Listing <span className="break-all">{review.listingId}</span> · Saved revision {review.revision} · Draft</p>
        <p>Saved <time dateTime={review.savedAt}>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(review.savedAt))} PHT</time></p>
        {review.currentRevision !== review.revision && <p className="mt-3 font-semibold">A newer saved revision exists: {review.currentRevision}. This review still shows revision {review.revision}.</p>}
        <p className="mt-3">Correction links open the current editor. Save corrections as a new revision, then review that saved revision.</p>

        <section aria-labelledby="submission-title" className={section}>
          <h2 id="submission-title" className="text-2xl font-semibold">Submission is paused</h2>
          <p className="mt-2">You can recheck saved revision {review.revision}. This does not submit, publish, reject or place it in a review queue. Your saved work stays available.</p>
          <p className="mt-2">Ownership declaration capture is unavailable. Saving a draft or rechecking it does not attest ownership.</p>
          <details className="mt-3">
            <summary className="min-h-11 cursor-pointer py-2 font-medium underline underline-offset-4">Why submission is paused</summary>
            <ul className="mt-2 list-disc space-y-2 pl-5">{review.submissionGates.map((gate) => <li key={gate.code}>{gate.message}</li>)}</ul>
          </details>
          <p id="submission-feedback" ref={checkFeedback} tabIndex={-1} role={["stale", "signed-out", "restricted", "missing", "uncertain"].includes(checkPhase) ? "alert" : "status"} aria-atomic="true" className="mt-4 font-medium">
            {checkPhase === "pending" ? `Rechecking saved revision ${review.revision}… Nothing is being submitted.`
              : checkPhase === "paused" ? `Revision ${review.revision} was rechecked. Submission remains paused. ${checkedEvaluation ? evaluationLabels[checkedEvaluation.status] : ""}. Nothing was submitted.`
                : checkPhase === "stale" ? "A newer revision exists. This saved review is preserved. Open the current editor, then review its saved revision before rechecking."
                  : checkPhase === "signed-out" ? "Sign in again, then return to recheck. Your saved revision is preserved."
                    : checkPhase === "restricted" ? "This account cannot proceed with publication. Your saved work is preserved; this check created no review request."
                      : checkPhase === "missing" ? "This draft is no longer available for rechecking. The saved review remains below; open your drafts to check its current status."
                        : checkPhase === "uncertain" ? "The recheck result could not be confirmed. Your saved review is preserved. Retry the check for this same revision; nothing was submitted."
                          : "No submission has been made."}
          </p>
          {checkedEvaluation && <ul className="mt-3 list-disc space-y-2 pl-5">{checkedEvaluation.checks.filter((check) => ["ineligible", "review", "missing"].includes(check.status)).map((check) => <li key={check.field}>{check.message}</li>)}</ul>}
          <button type="button" aria-busy={checkPhase === "pending"} disabled={checkPhase === "pending" || checkPhase === "stale" || review.currentRevision !== review.revision}
            onClick={() => void recheck()} className={`${link} cursor-pointer disabled:cursor-default disabled:text-[#52615a]`}>
            {checkPhase === "pending" ? "Rechecking…" : checkPhase === "uncertain" ? "Retry revision recheck" : `Recheck saved revision ${review.revision}`}
          </button>
          {checkPhase === "signed-out" && <a href="/account/sign-in" className={`${link} ml-4`}>Sign in, then return</a>}
        </section>

        <section aria-labelledby="requirements-title" className={section}>
          <h2 id="requirements-title" className="text-2xl font-semibold">Publication evaluation</h2>
          <p className="mt-2 font-semibold">{evaluationLabels[review.evaluation.status]}</p>
          <p className="mt-2">Evaluation of saved revision {review.revision} when this review loaded. Draft state is unchanged. No publication, hold, rejection, operator request or notification was created. Missing or unavailable checks prevent eligibility.</p>
          {(["ineligible", "review"] as const).map((status) => {
            const checks = review.evaluation.checks.filter((check) => check.status === status);
            return checks.length > 0 && <div key={status} className="mt-5">
              <h3 className="text-xl font-semibold">{({ ineligible: "Deterministic exclusions", review: "Review requirements — no violation established" })[status]}</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">{checks.map((check) => <li key={check.field}>{check.message}</li>)}</ul>
            </div>;
          })}
          <h3 className="mt-6 text-xl font-semibold">Missing publication requirements</h3>
          <p className="mt-2">Saved answers are checked on the server. This is not publication approval.</p>
          {review.missingRequirements.length ? <ul className="mt-4 list-disc space-y-3 pl-5">{review.missingRequirements.map((item) => <li key={item.field} id={`requirement-${item.field}`} tabIndex={-1}>{item.message} {!item.href.startsWith("#") && <a href={item.href} className={link}>Correct {item.field.replace(/-/g, " ")}</a>}</li>)}</ul> : <p className="mt-3">No missing requirements were found. Review requirements or unavailable checks still prevent eligibility when listed.</p>}
          <h3 className="mt-6 text-xl font-semibold">Requirements unavailable in this increment</h3>
          <ul className="mt-3 list-disc pl-5">{review.unavailableRequirements.map((item) => <li key={item.field}><a href={`#requirement-${item.field}`} className={link}>About {item.field.replace(/-/g, " ")} requirements</a></li>)}</ul>
          {review.unavailableRequirements.map((item) => <div key={item.field} id={`requirement-${item.field}`} tabIndex={-1} className="mt-4"><p>{item.message}</p></div>)}
        </section>

        <section id="proposed-public" aria-labelledby="public-title" className={section}>
          <h2 id="public-title" className="text-2xl font-semibold">Proposed public content</h2>
          <p className="mt-2">Only you can see this saved draft. These are the fields proposed for buyers after publication requirements are met.</p>
          <dl className="mt-5 space-y-4">{Object.entries({ title: "Title", brand: "Brand", model: "Model", description: "Description and known problems", approximateAge: "Approximate age", listingType: "Listing type", category: "Category", barangay: "Barangay", fulfillment: "Pickup or meetup" }).map(([key, label]) => <div key={key}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap">{content[key as keyof typeof content] as string || "Not provided"}</dd></div>)}</dl>
          <h3 className="mt-7 text-xl font-semibold">Condition derived from saved answers</h3>
          <p className="mt-2 font-semibold">{content.safety === "blocked" || content.safety === "hold" ? "Stop testing. No ordinary condition." : content.condition ?? "Condition not yet validated. Correct incomplete or inconsistent disclosures."}</p>
          <p className="mt-2">Based on seller-provided facts. Not a professional diagnosis, repairability assessment, or price estimate. Correct the source answers to change the result.</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">{content.reasons.map((reason, index) => <li key={index}>{reason.text} <a href={reason.href} className={link}>Change {reason.field.replace(/-/g, " ")} answer</a></li>)}</ul>
          <h3 className="mt-7 text-xl font-semibold">Battery, lock and testing disclosures</h3>
          <dl className="mt-3 space-y-4">{content.disclosures.filter((item) => ["safety", "battery", "lock", "coverage"].includes(item.field)).map((item) => <div key={item.field}><dt className="font-semibold">{item.label}</dt><dd>{item.value} <a href={item.href} className={link}>Change {item.label.toLowerCase()}</a></dd></div>)}</dl>
          <p className="mt-3">A disclosed lock does not itself change condition. Halaga does not guarantee or assist with lock removal.</p>
          <div id="safe-testing" tabIndex={-1} className="mt-5 rounded-md bg-[#f6f5f0] p-4">
            <h3 className="font-semibold">Safe-testing guidance</h3>
            {(content.safety === "blocked" || content.safety === "hold") && <p className="mt-2 font-semibold">Do not continue testing, charging, or handling the battery. No publication, hold, rejection decision, or operator request has been created.</p>}
            <p className="mt-2">{safeTestingGuidance}</p>
          </div>
          <h3 className="mt-7 text-xl font-semibold">Saved diagnostic answers</h3>
          <p className="mt-2">Question version: {content.diagnosticVersion}. Unanswered optional additional checks do not by themselves prevent Fully functional.</p>
          <dl className="mt-4 space-y-4">{content.disclosures.filter((item) => !["safety", "battery", "lock", "coverage"].includes(item.field)).map((item) => <div key={item.field}><dt className="font-semibold">{item.label}</dt><dd className="whitespace-pre-wrap">{item.value} <a href={item.href} className={link}>Change {item.label.toLowerCase()}</a></dd></div>)}</dl>
          <h3 className="mt-6 font-semibold">Known abnormal or intermittent behavior</h3>
          <p className="mt-2 whitespace-pre-wrap">{content.behavior.join("; ") || "Not provided"}{content.behaviorNotes && ` — ${content.behaviorNotes}`}</p>
          <a href={`${editor}#${content.safety === "clear" ? "behavior" : "safety"}`} className={link}>Change known behavior</a>
          <h3 className="mt-4 font-semibold">Included items</h3>
          <p className="mt-2 whitespace-pre-wrap">{content.included.join("; ") || "Not provided"}{content.includedNotes && ` — ${content.includedNotes}`}</p>
          <a href={`${editor}#${content.safety === "clear" ? "included" : "safety"}`} className={link}>Change included items</a>
        </section>

        <section id="owner-private" aria-labelledby="private-title" className={section}>
          <h2 id="private-title" className="text-2xl font-semibold">Owner-private information</h2>
          <p className="mt-2">Private price expectation (optional). Only you see this personal benchmark; buyers do not. It is not an asking price or platform valuation.</p>
          <p className="mt-3 font-semibold">{review.ownerPrivate.privatePriceExpectation ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(review.ownerPrivate.privatePriceExpectation)) : "No private price expectation saved"}</p>
          <a href={`${editor}#privatePriceExpectation`} className={link}>Change private price expectation</a>
          <h3 className="mt-6 text-xl font-semibold">Synthetic photo history for revision {review.revision}</h3>
          <p className="mt-2">Private processed copies only. Synthetic photos never qualify as actual-item publication evidence. Removed photos may remain in earlier revisions until draft expiry.</p>
          <DraftPhotoGallery photos={review.photos ?? []} />
          <a href={`${editor}#photos`} className={link}>Manage current photos</a>
        </section>
        <a href={editor} className={`${link} mt-7`}>Return to current editor</a>
      </>}
    </main>
  </>;
}
