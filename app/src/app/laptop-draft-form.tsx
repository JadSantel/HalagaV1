"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  answerText, behaviorOptions, changeAnswer, copyDraft, deriveCondition,
  emptyDraft, enhancedKeys, includedOptions, questions, safeTestingGuidance,
  samples, toggleBehavior, validateDraft, type Draft, type QuestionKey,
} from "../domain/laptop-diagnostics";
import {
  emptyListingDetails, fulfillmentOptions, ownershipDeclaration, practiceBarangays,
  sampleListingDetails, toPublicLaptopPreview, validateListingDetails, type LocalLaptopDraft,
} from "../domain/laptop-listing";

const controlClass = "mt-2 min-h-12 w-full rounded-md border border-[#75837c] bg-white px-3 py-2 text-base text-[#17231f]";
const primaryClass = "min-h-12 rounded-md bg-[#176b59] px-5 py-3 font-semibold text-white hover:bg-[#105746] disabled:bg-[#53615c]";
const secondaryClass = "min-h-12 rounded-md border border-[#75837c] bg-white px-4 py-2 font-semibold hover:bg-[#e7f2ee]";
const identityLabels = { title: "Listing title", brand: "Brand", model: "Model", description: "Description and known problems" };
const groups: { title: string; keys: QuestionKey[] }[] = [
  { title: "Test coverage", keys: ["coverage", "reason"] },
  { title: "Power, display, and startup", keys: ["power", "display", "startup"] },
  { title: "Keyboard and pointing device", keys: ["keyboard", "pointing"] },
  { title: "Power input and battery", keys: ["external", "charger", "battery"] },
];

export default function LaptopDraftForm() {
  const [draft, setDraft] = useState<LocalLaptopDraft>(() => ({ ...emptyDraft(), ...emptyListingDetails }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [status, setStatus] = useState("");
  const errorSummary = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const result = deriveCondition(draft);
  const stopped = result.safety === "blocked" || result.safety === "hold";
  const diagnosticsVisible = result.safety === "clear";
  const publicDraft = toPublicLaptopPreview(draft);
  const publicResult = deriveCondition(publicDraft);

  function update(next: Draft | LocalLaptopDraft) {
    setDraft((current) => ({ ...current, ...next }));
    setErrors({});
    setStatus("");
  }

  function replace(next: LocalLaptopDraft, message: string) {
    const hasWork = Boolean(draft.title || draft.brand || draft.model || draft.description || draft.answers.safety || draft.included.length || draft.approximateAge || draft.barangay || draft.fulfillment || draft.ownershipDeclared || draft.privatePriceExpectation);
    if (hasWork && !window.confirm("Replace the current practice answers? They will be lost.")) return;
    setDraft({ ...next, ...copyDraft(next) });
    setErrors({});
    setReview(false);
    setStatus(message);
  }

  function edit(field?: string) {
    setReview(false);
    setStatus("");
    requestAnimationFrame(() => {
      if (field) document.getElementById(field)?.focus();
      else heading.current?.focus();
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stopped) return;
    const nextErrors = { ...validateDraft(draft), ...validateListingDetails(draft) };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => errorSummary.current?.focus());
      return;
    }
    setReview(true);
    setStatus("Sample draft ready to review. Nothing has been saved or published.");
    requestAnimationFrame(() => heading.current?.focus());
  }

  function fieldError(field: string) {
    return errors[field] ? <p id={`${field}-error`} className="mt-2 text-sm font-medium text-[#a83232]">{errors[field]}</p> : null;
  }

  function note(field: string, value: string, label: string, onChange: (value: string) => void, required = true) {
    return <div className="mt-3">
      <label htmlFor={field} className="block font-medium">{label} <span className="text-[#53615c]">({required ? "required" : "optional"})</span></label>
      <textarea id={field} rows={2} value={value} onChange={(event) => onChange(event.target.value)}
        aria-required={required} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${field}-error` : undefined}
        className={`${controlClass} resize-y`} />
      {fieldError(field)}
    </div>;
  }

  function question(key: QuestionKey) {
    if (key === "reason" && draft.answers.coverage !== "some" && draft.answers.coverage !== "none") return null;
    const q = questions[key];
    const value = draft.answers[key];
    const describedBy = [q.help ? `${key}-help` : "", errors[key] ? `${key}-error` : ""].filter(Boolean).join(" ") || undefined;
    const explanation = q.explain?.includes(value);
    const noteLabel = value === "na" ? "Explain why this feature is genuinely absent by design or configuration" : key === "lock" ? "Describe the restriction and what you know about removal capability" : "Describe what you observed";
    const explanationControl = explanation && note(`${key}-note`, draft.notes[key] ?? "", noteLabel,
      (text) => update({ ...draft, notes: { ...draft.notes, [key]: text } }));
    if (key === "safety") return <fieldset id="safety" tabIndex={-1} className="min-w-0" aria-describedby={describedBy} aria-invalid={Boolean(errors.safety)}>
      <legend className="font-semibold">{q.title} <span className="font-normal text-[#53615c]">(required)</span></legend>
      <p id="safety-help" className="mt-1 text-sm text-[#53615c]">{q.help}</p>
      <div className="mt-3 space-y-2">
        {Object.entries(q.options).map(([option, label]) => <label key={option} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-[#75837c] p-3 hover:bg-[#e7f2ee]">
          <input type="radio" name="safety" value={option} checked={value === option}
            onChange={(event) => update(changeAnswer(draft, key, event.target.value))} className="mt-1.5 h-4 w-4 shrink-0 accent-[#176b59]" />
          <span>{label}</span>
        </label>)}
      </div>
      {fieldError(key)}
    </fieldset>;
    return <div key={key}>
      <label htmlFor={key} className="block font-semibold">{q.title} <span className="font-normal text-[#53615c]">({q.optional ? "optional" : "required"})</span></label>
      {q.help && <p id={`${key}-help`} className="mt-1 text-sm text-[#53615c]">{q.help}</p>}
      <select id={key} value={value} onChange={(event) => update(changeAnswer(draft, key, event.target.value))}
        aria-required={!q.optional} aria-invalid={Boolean(errors[key])} aria-describedby={describedBy} className={controlClass}>
        <option value="">{q.optional ? "Skip this optional answer" : "Choose an answer"}</option>
        {Object.entries(q.options).map(([option, label]) => <option key={option} value={option}>{label}</option>)}
      </select>
      {value && <p className="mt-2 text-sm text-[#53615c]">Selected: {q.options[value]}</p>}
      {fieldError(key)}
      {value === "na" && <p className="mt-2 text-sm text-[#53615c]">A missing or broken expected component is not Not applicable.</p>}
      {explanationControl}
    </div>;
  }

  function guidanceLink() {
    return <a href="#safety-guidance" className="inline-block min-h-11 py-2 text-sm font-medium text-[#176b59] underline underline-offset-4">Read safe-testing guidance</a>;
  }

  function labelFor(field: string) {
    const key = field.replace(/-note$/, "");
    return questions[key as QuestionKey]?.short ?? (key === "behavior" ? "known issues" : key === "included" ? "included items" : key);
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
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <label htmlFor="sample" className="font-semibold">Choose a made-up example</label>
          <select id="sample" className={controlClass} value={sampleIndex} onChange={(event) => setSampleIndex(Number(event.target.value))}>
            {samples.map((sample, index) => <option key={sample.name} value={index}>{sample.name}</option>)}
          </select>
        </div>
        <button type="button" className={secondaryClass} onClick={() => replace({ ...samples[sampleIndex].draft, ...sampleListingDetails }, `${samples[sampleIndex].name} example loaded. You can edit every answer.`)}>Load example</button>
      </div>
      <p role="status" aria-atomic="true" className="mt-3 min-h-6 text-sm font-medium text-[#176b59]">{status}</p>
      <div className="mt-6 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 rounded-xl border border-[#d9dfda] bg-white p-5 sm:p-8">
          {review ? <section aria-label="Sample draft review">
            <section aria-labelledby="public-preview-title">
            <h2 id="public-preview-title" className="text-xl font-semibold">Public listing preview</h2>
            <p className="mt-2 text-sm text-[#53615c]">These item facts would be visible to everyone on a published listing. This preview is local practice.</p>
            <h3 className="mt-5 break-words text-2xl font-bold">{publicDraft.title}</h3>
            <p className="font-medium text-[#176b59]">Single item · Laptops</p>
            <dl className="mt-5 space-y-4">
              <div><dt className="font-semibold">Brand and model</dt><dd className="break-words">{publicDraft.brand} · {publicDraft.model}</dd></div>
              <div><dt className="font-semibold">Approximate age</dt><dd className="break-words">{publicDraft.approximateAge}</dd></div>
              <div><dt className="font-semibold">Public location</dt><dd>{publicDraft.city} · {publicDraft.barangay}</dd><dd className="text-sm text-[#53615c]">Fictional practice geography. No map or exact address.</dd></div>
              <div><dt className="font-semibold">Availability</dt><dd>{publicDraft.fulfillment}</dd></div>
              <div><dt className="font-semibold">Description and known problems</dt><dd className="whitespace-pre-wrap break-words">{publicDraft.description}</dd></div>
            </dl>
            <h3 className="mt-6 text-lg font-semibold">Condition derived from your answers</h3>
            <p className="mt-2 text-2xl font-bold">{publicResult.condition}</p>
            <h3 className="mt-6 font-semibold">Why Halaga derived this</h3>
            <ul className="mt-3 space-y-4">
              {publicResult.reasons.map((reason, index) => <li key={`${reason.field}-${index}`}>
                <p className="break-words">{reason.text}</p>
                <button type="button" className="min-h-11 py-2 text-sm font-medium text-[#176b59] underline underline-offset-4" onClick={() => edit(reason.field)}>Change {labelFor(reason.field)}</button>
              </li>)}
            </ul>
            <p className="mt-5 text-sm text-[#53615c]">This condition is based on the facts you provided. It is not a professional diagnosis, repairability assessment, or price estimate.</p>
            <h3 className="mt-8 border-t border-[#d9dfda] pt-6 text-lg font-semibold">Separate disclosures</h3>
            <dl className="mt-4 space-y-4">
              {(["safety", "battery", "lock", "coverage", "charger"] as QuestionKey[]).map((key) => <div key={key}>
                <dt className="font-semibold">{questions[key].short}</dt>
                <dd className="break-words">{answerText(publicDraft, key)}</dd>
                <dd><button type="button" className="min-h-11 py-2 text-sm font-medium text-[#176b59] underline underline-offset-4" onClick={() => edit(key)}>Change {questions[key].short.toLowerCase()}</button></dd>
              </div>)}
            </dl>
            <details className="mt-7 border-t border-[#d9dfda] pt-5">
              <summary className="min-h-11 cursor-pointer font-semibold">All item details and diagnostic answers</summary>
              <dl className="mt-4 space-y-4">
                {Object.entries(identityLabels).map(([key, label]) => <div key={key}>
                  <dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-words">{publicDraft[key as keyof typeof identityLabels]}</dd>
                </div>)}
                {(Object.keys(questions) as QuestionKey[]).filter((key) => key !== "reason" || publicDraft.answers.reason).map((key) => <div key={key}>
                  <dt className="font-semibold">{questions[key].short}</dt><dd className="whitespace-pre-wrap break-words">{answerText(publicDraft, key)}</dd>
                  <dd><button type="button" className="min-h-11 py-2 text-sm text-[#176b59] underline underline-offset-4" onClick={() => edit(key)}>Change answer</button></dd>
                </div>)}
                <div><dt className="font-semibold">Known issues</dt><dd className="whitespace-pre-wrap break-words">{publicDraft.behavior.map((value) => behaviorOptions[value]).join("; ")}{publicDraft.behaviorNotes && ` — ${publicDraft.behaviorNotes}`}</dd></div>
                <div><dt className="font-semibold">Included items</dt><dd className="whitespace-pre-wrap break-words">{publicDraft.included.join(", ")}{publicDraft.includedNotes && ` — ${publicDraft.includedNotes}`}</dd></div>
              </dl>
            </details>
            </section>
            <section aria-labelledby="private-review-title" className="mt-8 border-t-2 border-[#75837c] pt-6">
              <h2 id="private-review-title" className="text-xl font-semibold">Private seller review</h2>
              <p className="mt-2 text-sm text-[#53615c]">This information is excluded from the public preview.</p>
              <dl className="mt-4 space-y-4">
                <div><dt className="font-semibold">Your private price expectation</dt><dd className="break-words">{draft.privatePriceExpectation.trim() ? `PHP ${draft.privatePriceExpectation.trim()}` : "Not provided"}</dd><dd className="text-sm text-[#53615c]">A seller-only benchmark for comparing offers, not an asking price or Halaga valuation.</dd></div>
                <div><dt className="font-semibold">Practice ownership declaration</dt><dd>{draft.ownershipDeclared ? "Accepted for this sample draft" : "Not accepted"}</dd><dd>{ownershipDeclaration}</dd><dd className="text-sm text-[#53615c]">A seller declaration, not independent proof of ownership. No declaration record has been saved.</dd></div>
              </dl>
              <button type="button" className="mt-3 min-h-11 py-2 text-sm font-medium text-[#176b59] underline underline-offset-4" onClick={() => edit("privatePriceExpectation")}>Change private seller details</button>
            </section>
            <div className="mt-7 rounded-md bg-[#fff3d6] p-4 text-[#855600]">
              <p className="font-semibold">Photos missing: 0 of 2 required</p>
              <p className="mt-2">A real listing needs at least two clear photos of the actual laptop. Stock images, catalog images, and screenshots alone do not qualify. Photo upload is not available in this practice form.</p>
              <p className="mt-2">Publishing is disabled for this local prototype.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className={primaryClass} onClick={() => edit()}>Edit answers</button>
              <button type="button" disabled aria-describedby="publication-help" className={primaryClass}>Publish listing (disabled)</button>
            </div>
            <p id="publication-help" className="mt-2 text-sm text-[#53615c]">Local practice only. Nothing is saved or published.</p>
          </section> : <form noValidate onSubmit={submit}>
            {Object.keys(errors).length > 0 && <div ref={errorSummary} tabIndex={-1} role="alert" className="mb-8 rounded-md border border-[#a83232] bg-[#fce8e7] p-4">
              <h2 className="font-semibold">Check these answers</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {Object.entries(errors).map(([field, message]) => <li key={field}><a className="underline underline-offset-4" href={`#${field}`}>{message}</a></li>)}
              </ul>
            </div>}
            <fieldset className="min-w-0">
              <legend className="text-xl font-semibold">Laptop details</legend>
              <p className="mt-2 text-sm text-[#53615c]">One laptop for this exercise. Use Unknown for a brand or model you do not know. Use made-up details; leave out names, contact details, and exact addresses.</p>
              <div className="mt-6 space-y-5">
                {Object.entries(identityLabels).map(([rawKey, label]) => {
                  const key = rawKey as keyof typeof identityLabels;
                  const props = { id: key, value: draft[key], onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update({ ...draft, [key]: event.target.value }), "aria-required": true as const, "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `${key}-error` : undefined, className: controlClass };
                  return <div key={key}><label htmlFor={key} className="font-semibold">{label} <span className="font-normal text-[#53615c]">(required)</span></label>
                    {key === "description" ? <textarea {...props} rows={4} className={`${controlClass} resize-y`} /> : <input {...props} type="text" autoComplete="off" />}
                    {fieldError(key)}
                  </div>;
                })}
                <div>
                  <label htmlFor="approximateAge" className="font-semibold">Approximate age <span className="font-normal text-[#53615c]">(optional, when known)</span></label>
                  <p id="approximateAge-help" className="mt-1 text-sm text-[#53615c]">For example, About 4 years. Leave blank if unknown; age appears in the public preview.</p>
                  <input id="approximateAge" type="text" autoComplete="off" value={draft.approximateAge} onChange={(event) => update({ ...draft, approximateAge: event.target.value })} aria-describedby="approximateAge-help" className={controlClass} />
                </div>
              </div>
            </fieldset>
            <section className="mt-9 border-t border-[#d9dfda] pt-7" aria-labelledby="safety-title">
              <h2 id="safety-title" className="text-xl font-semibold">Safety first</h2>
              <div id="safety-guidance" tabIndex={-1} className="my-5 rounded-md bg-[#f6f5f0] p-4">
                <h3 className="font-semibold">Safe-testing guidance</h3>
                <p className="mt-2 text-sm">{safeTestingGuidance}</p>
              </div>
              {question("safety")}
              {stopped && <div className="mt-5 rounded-md border border-[#a83232] bg-[#fce8e7] p-4 text-[#a83232]">
                <h3 className="font-semibold">Stop testing</h3>
                <p className="mt-1">Do not continue testing, charging, or handling the battery.</p>
                <p className="mt-2">{result.reasons[0].text} No ordinary condition is calculated.</p>
                <p className="mt-2">This is a practice form. Nothing has been submitted; no operator request has been created.</p>
              </div>}
            </section>
            {diagnosticsVisible && <>
              {groups.map((group) => <section key={group.title} aria-label={group.title} className="mt-9 border-t border-[#d9dfda] pt-7">
                <h2 className="text-xl font-semibold">{group.title}</h2>
                {guidanceLink()}
                <div className="mt-3 space-y-6">{group.keys.map(question)}</div>
              </section>)}
              <section className="mt-9 border-t border-[#d9dfda] pt-7" aria-labelledby="enhanced-title">
                <h2 id="enhanced-title" className="text-xl font-semibold">Optional additional checks</h2>
                <p className="mt-2 font-medium">Did you safely test any of these additional functions?</p>
                <p className="mt-1 text-sm text-[#53615c]">Did not test does not by itself prevent Fully functional. A tested defect affects condition.</p>
                {guidanceLink()}
                <div className="mt-3 space-y-6">{enhancedKeys.map(question)}</div>
              </section>
              <section className="mt-9 border-t border-[#d9dfda] pt-7" aria-labelledby="behavior-title">
                <h2 id="behavior-title" className="text-xl font-semibold">Known issues</h2>
                {guidanceLink()}
                <fieldset id="behavior" tabIndex={-1} className="mt-3 min-w-0" aria-invalid={Boolean(errors.behavior)} aria-describedby={errors.behavior ? "behavior-error" : undefined}>
                  <legend className="font-semibold">During brief normal use, did you notice any of these issues? Select all that apply. <span className="font-normal text-[#53615c]">(required)</span></legend>
                  <div className="mt-3 space-y-2">
                    {Object.entries(behaviorOptions).map(([value, label]) => <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
                      <input type="checkbox" checked={draft.behavior.includes(value)} onChange={() => update({ ...draft, behavior: toggleBehavior(draft.behavior, value), behaviorNotes: value === "none" || value === "unknown" ? "" : draft.behaviorNotes })} className="mt-1.5 h-4 w-4 shrink-0 accent-[#176b59]" />
                      <span>{label}</span>
                    </label>)}
                  </div>
                  {fieldError("behavior")}
                </fieldset>
                {note("behavior-note", draft.behaviorNotes, "Describe the known behavior", (text) => update({ ...draft, behaviorNotes: text }), draft.behavior.includes("other"))}
                <p className="mt-5 text-sm text-[#a83232]">If these observations suggest a hazardous battery or electrical condition, stop testing immediately.</p>
                <button type="button" className={`${secondaryClass} mt-3`} onClick={() => {
                  update(changeAnswer(draft, "safety", "uncertain"));
                  requestAnimationFrame(() => document.getElementById("safety")?.focus());
                }}>Stop testing — safety concern</button>
              </section>
              <section className="mt-9 border-t border-[#d9dfda] pt-7" aria-labelledby="contents-title">
                <h2 id="contents-title" className="text-xl font-semibold">Missing parts and included items</h2>
                {guidanceLink()}
                <div className="mt-3">{question("missing")}</div>
                <fieldset id="included" tabIndex={-1} className="mt-6 min-w-0" aria-invalid={Boolean(errors.included)} aria-describedby={errors.included ? "included-error" : undefined}>
                  <legend className="font-semibold">What is included with the listing? <span className="font-normal text-[#53615c]">(required)</span></legend>
                  <div className="mt-3 space-y-1">
                    {includedOptions.map((value) => <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
                      <input type="checkbox" checked={draft.included.includes(value)} onChange={() => update({ ...draft, included: draft.included.includes(value) ? draft.included.filter((item) => item !== value) : [...draft.included, value] })} className="mt-1.5 h-4 w-4 shrink-0 accent-[#176b59]" />
                      <span>{value}</span>
                    </label>)}
                  </div>
                  {fieldError("included")}
                </fieldset>
                {note("included-note", draft.includedNotes, "Describe included items", (text) => update({ ...draft, includedNotes: text }), draft.included.includes("Other supported accessories"))}
              </section>
              <section className="mt-9 border-t border-[#d9dfda] pt-7" aria-labelledby="lock-title">
                <h2 id="lock-title" className="text-xl font-semibold">Lock and management status</h2>
                {guidanceLink()}
                <div className="mt-3">{question("lock")}</div>
                <p className="mt-3 text-sm text-[#53615c]">A disclosed lock does not itself change condition. Checks prevented by a lock remain Could not test.</p>
              </section>
            </>}
            <section aria-labelledby="location-title" className="mt-9 border-t border-[#d9dfda] pt-7">
              <h2 id="location-title" className="text-xl font-semibold">Location and availability</h2>
              <p className="mt-2 text-sm text-[#53615c]">Public location shows Cagayan de Oro City and a barangay. These practice choices are fictional, not a real barangay directory. Exact pickup or meetup details belong in private coordination after reservation.</p>
              <div className="mt-5 space-y-5">
                <div>
                  <label htmlFor="barangay" className="font-semibold">Practice barangay <span className="font-normal text-[#53615c]">(required, public)</span></label>
                  <select id="barangay" value={draft.barangay} onChange={(event) => update({ ...draft, barangay: event.target.value })} aria-required="true" aria-invalid={Boolean(errors.barangay)} aria-describedby={errors.barangay ? "barangay-error" : undefined} className={controlClass}>
                    <option value="">Choose a fictional barangay</option>
                    {Object.entries(practiceBarangays).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  {fieldError("barangay")}
                </div>
                <div>
                  <label htmlFor="fulfillment" className="font-semibold">Pickup or meetup availability <span className="font-normal text-[#53615c]">(required, public)</span></label>
                  <select id="fulfillment" value={draft.fulfillment} onChange={(event) => update({ ...draft, fulfillment: event.target.value })} aria-required="true" aria-invalid={Boolean(errors.fulfillment)} aria-describedby={errors.fulfillment ? "fulfillment-error" : undefined} className={controlClass}>
                    <option value="">Choose availability</option>
                    {Object.entries(fulfillmentOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  {fieldError("fulfillment")}
                </div>
              </div>
            </section>
            <section aria-labelledby="seller-title" className="mt-9 border-t border-[#d9dfda] pt-7">
              <h2 id="seller-title" className="text-xl font-semibold">Private seller details</h2>
              <div className="mt-5">
                <label htmlFor="privatePriceExpectation" className="font-semibold">Private price expectation (PHP) <span className="font-normal text-[#53615c]">(optional)</span></label>
                <p id="privatePriceExpectation-help" className="mt-1 text-sm text-[#53615c]">Use a made-up amount. Only you see this benchmark when comparing offers. It is not a public asking price or a Halaga valuation.</p>
                <input id="privatePriceExpectation" type="text" inputMode="decimal" autoComplete="off" value={draft.privatePriceExpectation} onChange={(event) => update({ ...draft, privatePriceExpectation: event.target.value })} aria-invalid={Boolean(errors.privatePriceExpectation)} aria-describedby={`privatePriceExpectation-help${errors.privatePriceExpectation ? " privatePriceExpectation-error" : ""}`} className={controlClass} />
                {fieldError("privatePriceExpectation")}
              </div>
              <div className="mt-6">
                <p id="ownershipDeclared-help" className="text-sm text-[#53615c]">Practice declaration only. This is a seller attestation, not independent proof of ownership.</p>
                <label className="mt-2 flex min-h-12 cursor-pointer items-start gap-3 py-2">
                  <input id="ownershipDeclared" type="checkbox" checked={draft.ownershipDeclared} onChange={(event) => update({ ...draft, ownershipDeclared: event.target.checked })} aria-required="true" aria-invalid={Boolean(errors.ownershipDeclared)} aria-describedby={`ownershipDeclared-help${errors.ownershipDeclared ? " ownershipDeclared-error" : ""}`} className="mt-1.5 h-4 w-4 shrink-0 accent-[#176b59]" />
                  <span>{ownershipDeclaration} <span className="text-[#53615c]">(required)</span></span>
                </label>
                {fieldError("ownershipDeclared")}
              </div>
            </section>
            <section aria-labelledby="photos-title" className="mt-9 border-t border-[#d9dfda] pt-7">
              <h2 id="photos-title" className="text-xl font-semibold">Photos missing: 0 of 2 required</h2>
              <p className="mt-2 text-sm text-[#53615c]">A real listing needs at least two clear photos of the actual laptop, including known visible defects. Stock images, catalog images, and screenshots alone do not qualify.</p>
              <p className="mt-2 text-sm text-[#53615c]">You can review this practice draft without photos. Photo upload is unavailable, and publishing stays disabled.</p>
            </section>
            <div className="mt-8 flex flex-wrap gap-3 border-t border-[#d9dfda] pt-6">
              <button type="submit" disabled={stopped} className={primaryClass}>Review sample draft</button>
              <button type="button" className={secondaryClass} onClick={() => replace({ ...emptyDraft(), ...emptyListingDetails }, "Form cleared. Nothing has been saved.")}>Clear form</button>
            </div>
          </form>}
        </div>
        <aside className="min-w-0 space-y-6 text-sm lg:sticky lg:top-8" aria-label="Condition and practice instructions">
          <div>
            <h2 className="text-lg font-semibold">Condition from your answers</h2>
            <p role="status" aria-atomic="true" className="mt-2 text-lg font-bold">{result.condition ?? (result.safety === "blocked" ? "Stop testing: unsafe battery" : result.safety === "hold" ? "Stop testing: uncertain safety" : "Answer battery safety first")}</p>
            <p className="mt-2 text-[#53615c]">Updates as you change an answer. Complete the required disclosures to see the explanation in review.</p>
          </div>
          <div className="border-t border-[#d9dfda] pt-5">
            <h2 className="font-semibold">Keep facts separate</h2>
            <p className="mt-2 text-[#53615c]">Power, screen, and startup are different checks. Battery operation and device locks are separate disclosures.</p>
          </div>
          <div className="border-t border-[#d9dfda] pt-5">
            <h2 className="font-semibold">Local practice only</h2>
            <p className="mt-2 text-[#53615c]">No photos, real users, or publication. Refreshing loses this practice draft.</p>
          </div>
        </aside>
      </div>
    </main>
    <footer className="mx-auto w-full max-w-5xl px-5 pb-8 text-sm text-[#53615c] sm:px-8">Halaga · Local practice with sample data</footer>
  </>;
}
