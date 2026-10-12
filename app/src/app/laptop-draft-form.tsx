"use client";

import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";

const safetyOptions = [
  "No sign of a battery safety problem",
  "Yes — swelling, leaking, puncture damage, unusual heat, smoke, sparks, or strong odor",
  "Not sure — something looks or feels unsafe",
  "No battery is installed or this configuration has no battery",
] as const;
const coverageOptions = [
  "I completed all applicable required checks below",
  "I completed only some checks",
  "I could not safely test it",
] as const;
const powerOptions = [
  "It powers on consistently",
  "It powers on only sometimes",
  "Lights or fans start, but there is no usable output",
  "Nothing happens",
  "Could not test",
] as const;

// Client feedback for an in-memory exercise only. No server command or persistence.
const draftSchema = z.object({
  title: z.string().trim().min(1, "Enter a title for the sample laptop."),
  brand: z.string().trim().min(1, "Enter a brand, or write Unknown."),
  model: z.string().trim().min(1, "Enter a model, or write Unknown."),
  description: z.string().trim().min(1, "Describe the sample laptop and any known problems."),
  safety: z.enum(safetyOptions, { error: "Choose a battery safety answer." }),
  coverage: z.enum(coverageOptions, { error: "Choose how much testing was completed." }),
  power: z.enum(powerOptions, { error: "Choose a power response." }),
});

type Draft = Record<keyof z.infer<typeof draftSchema>, string>;
type Errors = Partial<Record<keyof Draft, string>>;
const blank: Draft = { title: "", brand: "", model: "", description: "", safety: "", coverage: "", power: "" };
const sample: Draft = {
  title: "Sample laptop with a scratched lid",
  brand: "Example brand",
  model: "Demo 14",
  description: "Made-up example: a single laptop with scratches on the lid. A compatible charger is included. Only the power response was checked; other functions have not been tested.",
  safety: safetyOptions[0],
  coverage: coverageOptions[1],
  power: powerOptions[0],
};
const labels: Record<keyof Draft, string> = {
  title: "Listing title", brand: "Brand", model: "Model", description: "Description and known problems",
  safety: "Battery safety", coverage: "Test coverage", power: "Power response",
};
const controlClass = "mt-2 min-h-12 w-full rounded-md border border-[#75837c] bg-white px-3 py-2 text-base text-[#17231f]";
const primaryClass = "min-h-12 rounded-md bg-[#176b59] px-5 py-3 font-semibold text-white hover:bg-[#105746] disabled:bg-[#53615c]";
const secondaryClass = "min-h-12 rounded-md border border-[#75837c] bg-white px-4 py-2 font-semibold hover:bg-[#e7f2ee]";

export default function LaptopDraftForm() {
  const [draft, setDraft] = useState<Draft>({ ...blank });
  const [errors, setErrors] = useState<Errors>({});
  const [review, setReview] = useState(false);
  const [status, setStatus] = useState("");
  const errorSummary = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const stopped = draft.safety === safetyOptions[1] || draft.safety === safetyOptions[2];

  function change(field: keyof Draft, value: string) {
    setDraft((previous) => {
      const next = { ...previous, [field]: value };
      // A safety stop invalidates answers from the earlier safe scenario.
      if (field === "safety" && (value === safetyOptions[1] || value === safetyOptions[2])) {
        next.coverage = "";
        next.power = "";
      }
      return next;
    });
    setErrors({});
    setStatus("");
  }

  function replaceDraft(next: Draft, message: string) {
    if (Object.values(draft).some(Boolean) && !window.confirm("Replace the current practice answers? They will be lost.")) return;
    setDraft({ ...next });
    setErrors({});
    setReview(false);
    setStatus(message);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stopped) return;
    const result = draftSchema.safeParse(draft);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof Draft;
        if (!draft.safety && (field === "coverage" || field === "power")) continue;
        next[field] ??= issue.message;
      }
      setErrors(next);
      requestAnimationFrame(() => errorSummary.current?.focus());
      return;
    }
    setDraft(result.data);
    setReview(true);
    setStatus("Sample draft ready to review. Nothing has been saved or published.");
    requestAnimationFrame(() => heading.current?.focus());
  }

  function fieldError(field: keyof Draft) {
    return errors[field] ? <p id={`${field}-error`} className="mt-2 text-sm font-medium text-[#a83232]">{errors[field]}</p> : null;
  }

  function choice(field: "safety" | "coverage" | "power", question: string, options: readonly string[], help?: string) {
    if (field === "safety") return <fieldset id="safety" tabIndex={-1} className="min-w-0"
      aria-describedby={`safety-help${errors.safety ? " safety-error" : ""}`} aria-invalid={Boolean(errors.safety)}>
      <legend className="font-semibold">{question} <span className="font-normal text-[#53615c]">(required)</span></legend>
      <p id="safety-help" className="mt-1 text-sm text-[#53615c]">{help}</p>
      <div className="mt-3 space-y-2">
        {options.map((option) => <label key={option} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-[#75837c] p-3 hover:bg-[#e7f2ee]">
          <input type="radio" name="safety" value={option} checked={draft.safety === option}
            onChange={(event) => change("safety", event.target.value)} className="mt-1.5 h-4 w-4 shrink-0 accent-[#176b59]" />
          <span>{option}</span>
        </label>)}
      </div>
      {fieldError("safety")}
    </fieldset>;
    return <div>
      <label htmlFor={field} className="block font-semibold">{question} <span className="font-normal text-[#53615c]">(required)</span></label>
      {help && <p id={`${field}-help`} className="mt-1 text-sm text-[#53615c]">{help}</p>}
      <select id={field} value={draft[field]} onChange={(event) => change(field, event.target.value)}
        aria-required="true" aria-invalid={Boolean(errors[field])}
        aria-describedby={[help ? `${field}-help` : "", errors[field] ? `${field}-error` : ""].filter(Boolean).join(" ") || undefined}
        className={controlClass}>
        <option value="">Choose an answer</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {draft[field] && <p className="mt-2 text-sm text-[#53615c]">Selected: {draft[field]}</p>}
      {fieldError(field)}
    </div>;
  }

  return <>
    <a href="#main" className="sr-only z-10 bg-white p-3 focus:not-sr-only focus:absolute">Skip to form</a>
    <header className="border-b border-[#d9dfda] bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <span className="text-2xl font-bold tracking-tight text-[#176b59]">halaga</span>
        <span className="text-sm font-medium text-[#53615c]">Local practice · English prototype</span>
      </div>
    </header>
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight sm:text-4xl">{review ? "Review your sample draft" : "Describe a laptop"}</h1>
      <p className="mt-3 max-w-2xl text-lg text-[#53615c]">Practice with made-up details. Your answers stay in this tab and disappear when you refresh. Nothing is published.</p>
      <button type="button" className={`${secondaryClass} mt-5`} onClick={() => replaceDraft(sample, "Made-up example loaded. You can edit every answer.")}>Load made-up example</button>
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 rounded-xl border border-[#d9dfda] bg-white p-5 sm:p-8">
          {review ? <section aria-label="Sample draft review">
            <p className="mb-6 font-medium text-[#176b59]">Single item · Laptops</p>
            <dl className="space-y-5">
              {(Object.keys(labels) as (keyof Draft)[]).map((field) => <div key={field}>
                <dt className="text-sm font-semibold text-[#53615c]">{labels[field]}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">{draft[field]}</dd>
              </div>)}
            </dl>
            <p className="mt-8 rounded-md bg-[#fff3d6] p-4 text-[#855600]">Partial draft only. No condition has been derived: the remaining diagnostic questions and photos are still needed.</p>
            <button type="button" className={`${primaryClass} mt-6`} onClick={() => {
              setReview(false); setStatus(""); requestAnimationFrame(() => heading.current?.focus());
            }}>Edit answers</button>
          </section> : <form noValidate onSubmit={submit}>
            {Object.keys(errors).length > 0 && <div ref={errorSummary} tabIndex={-1} role="alert" className="mb-8 rounded-md border border-[#a83232] bg-[#fce8e7] p-4">
              <h2 className="font-semibold">Check these answers</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {(Object.keys(errors) as (keyof Draft)[]).map((field) => <li key={field}><a className="underline underline-offset-4" href={`#${field}`}>{errors[field]}</a></li>)}
              </ul>
            </div>}
            <fieldset className="min-w-0">
              <legend className="text-xl font-semibold">Laptop details</legend>
              <p className="mt-2 text-sm text-[#53615c]">One laptop for this exercise. All fields are required. Use Unknown for a brand or model you do not know.</p>
              <div className="mt-6 space-y-5">
                {(["title", "brand", "model"] as const).map((field) => <div key={field}>
                  <label htmlFor={field} className="font-semibold">{labels[field]} <span className="font-normal text-[#53615c]">(required)</span></label>
                  <input id={field} type="text" autoComplete="off" value={draft[field]}
                    onChange={(event) => change(field, event.target.value)} aria-required="true"
                    aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${field}-error` : undefined} className={controlClass} />
                  {fieldError(field)}
                </div>)}
                <div>
                  <label htmlFor="description" className="font-semibold">Description and known problems <span className="font-normal text-[#53615c]">(required)</span></label>
                  <p id="description-help" className="mt-1 text-sm text-[#53615c]">Describe visible damage, missing parts, and included accessories. Use made-up details; leave out names, contact details, and exact addresses.</p>
                  <textarea id="description" rows={5} value={draft.description} onChange={(event) => change("description", event.target.value)}
                    aria-required="true" aria-invalid={Boolean(errors.description)} aria-describedby={`description-help${errors.description ? " description-error" : ""}`}
                    className={`${controlClass} resize-y`} />
                  {fieldError("description")}
                </div>
              </div>
            </fieldset>
            <fieldset className="mt-9 min-w-0 border-t border-[#d9dfda] pt-7">
              <legend className="float-left mb-3 w-full text-xl font-semibold">Safety first</legend>
              <details className="clear-both mb-6 rounded-md bg-[#f6f5f0] p-4" open>
                <summary className="min-h-11 cursor-pointer font-semibold">Safe-testing guidance</summary>
                <p className="mt-2 text-sm">Only perform brief checks you already know how to do using the normal power button and a compatible charger. Do not open the laptop, remove or press the battery, bypass a password or device lock, install test software, or run demanding tests. Stop immediately if you notice swelling, leaking, puncture damage, unusual heat, smoke, sparks, or a strong chemical or burning odor.</p>
              </details>
              {choice("safety", "Before testing, do you see or notice any sign that the battery may be unsafe?", safetyOptions, "Look only from the outside. Do not press, remove, open, or handle the battery.")}
              <div aria-live="polite" aria-atomic="true">
                {stopped && <div className="mt-5 rounded-md border border-[#a83232] bg-[#fce8e7] p-4 text-[#a83232]">
                  <h2 className="font-semibold">Stop testing</h2>
                  <p className="mt-1">Do not continue testing, charging, or handling the battery.</p>
                  <p className="mt-2">{draft.safety === safetyOptions[1]
                    ? "A hazardous battery blocks an ordinary listing. This practice form has stopped; nothing has been submitted."
                    : "Uncertain battery safety requires human review in the full marketplace. This practice form has stopped; no review request has been created."}</p>
                </div>}
              </div>
            </fieldset>
            {draft.safety && !stopped && <fieldset className="mt-9 min-w-0 border-t border-[#d9dfda] pt-7">
              <legend className="float-left mb-3 w-full text-xl font-semibold">Basic observations</legend>
              <div className="clear-both space-y-6">
                <p className="text-sm text-[#53615c]">This first exercise includes only test coverage and power response. Use Could not test instead of guessing. No condition label is calculated.</p>
                {choice("coverage", "How much of this laptop could you safely test?", coverageOptions)}
                {choice("power", "What happens when you press the normal power button?", powerOptions, "This records power response only. It does not answer whether the display works or the operating system starts.")}
              </div>
            </fieldset>}
            <div className="mt-8 flex flex-wrap gap-3 border-t border-[#d9dfda] pt-6">
              <button type="submit" disabled={stopped} className={primaryClass}>Review sample draft</button>
              <button type="button" className={secondaryClass} onClick={() => replaceDraft(blank, "Form cleared. Nothing has been saved.")}>Clear form</button>
            </div>
          </form>}
        </div>
        <aside className="space-y-6 text-sm" aria-label="Practice instructions">
          <div>
            <h2 className="text-lg font-semibold">Try a made-up example</h2>
            <p className="mt-2 text-[#53615c]">Use the button above to fill the form with an example laptop, then change an answer to see what happens.</p>
          </div>
          <div className="border-t border-[#d9dfda] pt-5">
            <h2 className="font-semibold">A first small step</h2>
            <p className="mt-2 text-[#53615c]">This covers item details and the first safety questions. Photos, the remaining diagnostics, and publication come later.</p>
          </div>
        </aside>
      </div>
      <p role="status" aria-atomic="true" className="mt-6 min-h-6 text-sm font-medium text-[#176b59]">{status}</p>
    </main>
    <footer className="mx-auto w-full max-w-5xl px-5 pb-8 text-sm text-[#53615c] sm:px-8">Halaga · Local practice with sample data</footer>
  </>;
}
