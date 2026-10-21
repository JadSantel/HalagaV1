"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation clears private state and obtains fresh session-authorized reads. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { deriveCondition, validateDraft, type Draft } from "../../domain/laptop-diagnostics";
import { fulfillmentOptions } from "../../domain/laptop-listing";
import LaptopDiagnosticFields from "../laptop-diagnostic-fields";

const primary = "min-h-12 rounded-md bg-[#176b59] px-5 py-3 font-semibold text-white hover:bg-[#105746] disabled:bg-[#53615c]";
const secondary = "min-h-12 rounded-md border border-[#75837c] bg-white px-4 py-2 font-semibold hover:bg-[#e7f2ee]";
const control = "mt-2 min-h-12 w-full rounded-md border border-[#75837c] bg-white px-3 py-2 text-base";
const conditions: Record<string, string> = { FULLY_FUNCTIONAL: "Fully functional", FUNCTIONAL_WITH_ISSUES: "Functional with issues",
  NOT_FUNCTIONAL: "Not functional", UNTESTED_UNKNOWN: "Untested/unknown" };
type Snapshot = Draft & { privatePriceExpectation: string; fulfillment: string };
type Summary = { id: string; title: string; revision: number; updatedAt: string; condition: string | null };
type Detail = Summary & { draft: Snapshot };
type Phase = "loading" | "ready" | "pending" | "signed-out" | "error" | "uncertain" | "conflict" | "missing";
type Command = { requestId: string; draft: Snapshot | Record<string, never>; expectedRevision?: number };
const time = (value: string) => new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
}).format(new Date(value));

export default function DraftWorkspace({ listingId }: { listingId?: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [drafts, setDrafts] = useState<Summary[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [draft, setDraft] = useState<Snapshot | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [priceError, setPriceError] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const pending = useRef<Command | null>(null);
  const working = useRef(false);
  const target = `/api/laptop-drafts${listingId ? `/${encodeURIComponent(listingId)}` : ""}`;
  const draftLoaded = draft !== null;

  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);

  // Hash targets become available only after the authorized draft fetch renders.
  useEffect(() => {
    if (!draftLoaded) return;
    const target = document.getElementById(window.location.hash.slice(1));
    target?.focus();
    target?.scrollIntoView();
  }, [draftLoaded]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    if (dirty || phase === "uncertain") window.addEventListener("beforeunload", warn);
    // A restored browser document must obtain a new authorized response.
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pageshow", restore);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("pageshow", restore); };
  }, [dirty, phase]);

  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch(target, { credentials: "same-origin", cache: "no-store",
          referrerPolicy: "no-referrer", redirect: "error", signal: abort.signal });
        if (abort.signal.aborted) return;
        if (response.status === 401) { setPhase("signed-out"); return; }
        if (response.status === 404) { setPhase("missing"); return; }
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (abort.signal.aborted) return;
        if (listingId) { setDetail(result); setDraft(result.draft); }
        else setDrafts(result.drafts);
        setPhase("ready");
      } catch {
        if (!abort.signal.aborted) setPhase("error");
      }
    }
    void load();
    return () => abort.abort();
  }, [listingId, target]);

  function reload() {
    if ((dirty || pending.current) && !window.confirm("Reload the saved draft? Unsaved changes in this form will be discarded.")) return;
    setDirty(false);
    // A full document navigation also clears private component state and the pending command.
    window.location.reload();
  }

  async function write(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (working.current || phase === "conflict") return;
    working.current = true;
    // Keep this exact replacement body and UUID until the result is certain.
    pending.current ??= { requestId: crypto.randomUUID(), draft: listingId ? structuredClone(draft!) : {},
      ...(listingId ? { expectedRevision: detail!.revision } : {}) };
    setPhase("pending");
    setMessage(listingId ? "Saving private draft…" : "Creating private draft…");
    try {
      const response = await fetch(target, { method: listingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify(pending.current),
        credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error" });
      if (response.status === 401) {
        pending.current = null; setDetail(null); setDraft(null); setDrafts([]); setDirty(false);
        setPhase("signed-out"); setMessage("Your session is no longer available. Sign in again to resume your saved drafts."); return;
      }
      if (response.status === 409) {
        pending.current = null; setPhase("conflict");
        setMessage("This draft has a newer revision. Your edits were not saved. Reload the saved draft before editing again."); return;
      }
      if (response.status === 403) {
        pending.current = null; setPhase("ready");
        setMessage("This account cannot perform this draft action while a marketplace restriction is active. Nothing was saved. Existing drafts remain readable."); return;
      }
      if (response.status === 404) {
        pending.current = null; setDetail(null); setDraft(null); setDirty(false); setPhase("missing");
        setMessage("This draft is unavailable for this account."); return;
      }
      if (response.status === 400) {
        pending.current = null; setPhase("ready"); setPriceError(true);
        setMessage("The draft could not be saved. Check the private amount: use an exact PHP number with at most two decimal places."); return;
      }
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (typeof result.id !== "string" || !Number.isInteger(result.revision)) throw new Error();
      pending.current = null;
      setDirty(false);
      if (!listingId) { window.location.assign(new URL(`/drafts/${encodeURIComponent(result.id)}`, window.location.origin).href); return; }
      setDetail((current) => ({ ...current!, revision: result.revision }));
      setPhase("ready"); setPriceError(false);
      setMessage(`Private draft saved at revision ${result.revision}. Incomplete answers can be resumed later. Nothing is published.`);
    } catch {
      setPhase("uncertain");
      setMessage("The result could not be confirmed. Retry the same request to avoid duplicate work, or reload the saved draft.");
    } finally { working.current = false; }
  }

  const problem = ["error", "uncertain", "conflict", "missing"].includes(phase) || priceError;
  const locked = phase !== "ready";
  const diagnostics = draft && deriveCondition(draft);
  const valid = draft && Object.keys(validateDraft(draft)).length === 0;

  return <>
    <a href="#workspace" className="sr-only z-10 bg-white p-3 focus:not-sr-only focus:absolute">Skip to workspace</a>
    <header className="border-b border-[#d9dfda] bg-white">
      <nav aria-label="Workspace" className="mx-auto flex max-w-4xl flex-wrap items-center gap-5 px-5 py-5">
        <a href="/drafts" className="min-h-11 py-2 text-xl font-bold text-[#176b59]">halaga · Your drafts</a>
        <a href="/account/sign-in" className="min-h-11 py-2 underline underline-offset-4">Sign in</a>
        <a href="/" className="min-h-11 py-2 underline underline-offset-4">Browser practice</a>
      </nav>
    </header>
    <main id="workspace" className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">{listingId ? "Edit private laptop draft" : "Your laptop drafts"}</h1>
      <p className="mt-3 max-w-2xl text-[#53615c]">Local synthetic validation only. Use made-up details. Drafts are private to your account. Saving never publishes a listing.</p>
      <div ref={feedback} tabIndex={-1} role={problem ? "alert" : "status"} aria-atomic="true"
        className="my-5 break-words font-medium">{message}</div>
      {phase === "loading" && <p role="status">Loading your private {listingId ? "draft" : "drafts"}…</p>}
      {phase === "signed-out" && <section aria-label="Sign-in required">
        <p>Sign in to find, create, and resume your private laptop drafts.</p>
        <a href="/account/sign-in" className="mt-3 inline-block min-h-12 py-3 font-semibold text-[#176b59] underline">Sign in to Halaga</a>
        <p>After signing in, return to this page and reload.</p>
      </section>}
      {phase === "error" && <div role="alert"><p>Your drafts could not be loaded. No private content is available.</p><button className={`${secondary} mt-4`} onClick={reload}>Retry loading</button></div>}
      {phase === "missing" && <p role="status">This draft is unavailable for this account. <a href="/drafts" className="underline">Return to your drafts</a>.</p>}
      {phase === "uncertain" && <div className="mb-5 flex flex-wrap gap-3">
        <button className={primary} onClick={() => void write()}>Retry same {listingId ? "save" : "create"}</button>
        <button className={secondary} onClick={reload}>Reload saved {listingId ? "draft" : "drafts"}</button>
      </div>}
      {phase === "conflict" && <button className={`${secondary} mb-5`} onClick={reload}>Reload saved draft</button>}
      {!listingId && ["ready", "pending", "uncertain"].includes(phase) && <section aria-label="Saved laptop drafts" aria-busy={phase === "pending"}>
        <button className={primary} disabled={locked} onClick={() => void write()}>{phase === "pending" ? "Creating…" : "Create laptop draft"}</button>
        {drafts.length === 0 ? <p className="mt-8">No laptop drafts yet. Create one and save as much or as little as you know.</p> :
          <ul className="mt-8 divide-y divide-[#d9dfda] border-y border-[#d9dfda]">
            {drafts.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-6">
              <div className="min-w-0 flex-1 basis-60"><h2 className="break-words text-xl font-semibold">{item.title.trim() || "Untitled laptop draft"}</h2>
                <p className="mt-1">Revision {item.revision} · {item.condition ? conditions[item.condition] : "Condition not yet validated"}</p>
                <p className="text-sm text-[#53615c]">Updated <time dateTime={item.updatedAt}>{time(item.updatedAt)} PHT</time></p>
              </div>
              <a href={`/drafts/${item.id}`} className={`${secondary} inline-flex items-center`} aria-label={`Resume ${item.title.trim() || "untitled laptop draft"}`}>Resume draft</a>
            </li>)}
          </ul>}
      </section>}
      {listingId && draft && detail && <form onSubmit={write} noValidate aria-busy={phase === "pending"}>
        <p className="mb-5">Saved revision {detail.revision}{dirty ? " · Unsaved changes" : ""}</p>
        {phase === "ready" && <p className="mb-5"><a href={`/drafts/${listingId}/review?revision=${detail.revision}`} className="inline-block min-h-11 py-2 font-semibold text-[#176b59] underline">Review saved revision {detail.revision}</a>{dirty && " · Review shows saved content; save first to include these edits."}</p>}
        <fieldset disabled={locked} className="min-w-0">
          <legend className="text-xl font-semibold">Laptop details</legend>
          <p className="mt-2 text-sm text-[#53615c]">Every field may be left incomplete when saving. Diagnostic labels mark disclosures needed for a validated condition.</p>
          <div className="mt-5 space-y-5">
            {Object.entries({ title: "Listing title", brand: "Brand", model: "Model", description: "Description and known problems", approximateAge: "Approximate age" }).map(([key, label]) => {
              const props = { id: key, value: draft[key as keyof typeof draft] as string, autoComplete: "off",
                onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setDraft({ ...draft, [key]: event.target.value }); setDirty(true); setMessage(""); }, className: control };
              return <div key={key}><label htmlFor={key} className="font-semibold">{label}</label>
                {key === "description" ? <textarea {...props} rows={4} /> : <input {...props} type="text" />}</div>;
            })}
          </div>
          <LaptopDiagnosticFields draft={draft} update={(next) => { setDraft({ ...draft, ...next }); setDirty(true); setMessage(""); }} />
          <section aria-labelledby="availability-title" className="mt-9 border-t border-[#d9dfda] pt-7">
            <h2 id="availability-title" className="text-xl font-semibold">Pickup or meetup availability</h2>
            <label htmlFor="fulfillment" className="mt-5 block font-semibold">Available methods (optional in a draft)</label>
            <p id="fulfillment-help" className="mt-2 text-sm text-[#53615c]">Choose buyer pickup, mutually agreed meetup, or both. You can leave this unselected and resume later. Do not enter an exact address, meeting location, or precise coordinates. Exact details belong in private coordination after reservation.</p>
            <select id="fulfillment" value={draft.fulfillment} aria-describedby="fulfillment-help" className={control}
              onChange={(event) => { setDraft({ ...draft, fulfillment: event.target.value }); setDirty(true); setMessage(""); }}>
              <option value="">Not selected</option>
              {Object.entries(fulfillmentOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </section>
          <section aria-labelledby="private-title" className="mt-9 border-t border-[#d9dfda] pt-7">
            <h2 id="private-title" className="text-xl font-semibold">Private seller details</h2>
            <label htmlFor="privatePriceExpectation" className="mt-5 block font-semibold">Private price expectation (PHP, optional)</label>
            <p id="price-help" className="mt-2 text-sm text-[#53615c]">Only you see this benchmark. It is excluded from the draft list. Use a made-up amount.</p>
            <input id="privatePriceExpectation" type="text" inputMode="decimal" autoComplete="off" className={control}
              value={draft.privatePriceExpectation} aria-invalid={priceError} aria-describedby={`price-help${priceError ? " price-error" : ""}`}
              onChange={(event) => { setDraft({ ...draft, privatePriceExpectation: event.target.value }); setDirty(true); setPriceError(false); setMessage(""); }} />
            {priceError && <p id="price-error" className="mt-2 font-medium text-[#a83232]">Use an exact PHP amount with at most two decimal places, within the current storage precision.</p>}
          </section>
        </fieldset>
        <section aria-label="Condition feedback" className="mt-8 border-t border-[#d9dfda] pt-5">
          <h2 className="text-xl font-semibold">Condition from your answers</h2>
          <p role="status" aria-atomic="true" className="mt-2">{diagnostics?.safety === "blocked" || diagnostics?.safety === "hold" ? "Stop testing. No ordinary condition." : valid ? diagnostics?.condition : "Condition not yet validated. Incomplete answers can still be saved."}</p>
          {valid && <ul className="mt-3 list-disc space-y-2 pl-5">{diagnostics?.reasons.map((reason, index) => <li key={index}>{reason.text} <a href={`#${reason.field}`} className="underline">Change answer</a></li>)}</ul>}
        </section>
        <div className="mt-7 flex flex-wrap gap-3">
          <button type="submit" className={primary} disabled={locked}>{phase === "pending" ? "Saving…" : "Save private draft"}</button>
          <a href="/drafts" className={`${secondary} inline-flex items-center`}>Back to your drafts</a>
        </div>
      </form>}
    </main>
  </>;
}
