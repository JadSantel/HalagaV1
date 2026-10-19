"use client";

import { behaviorOptions, changeAnswer, deriveCondition, enhancedKeys, includedOptions, questions,
  safeTestingGuidance, toggleBehavior, type Draft, type QuestionKey } from "../domain/laptop-diagnostics";
const controlClass = "mt-2 min-h-12 w-full rounded-md border border-[#75837c] bg-white px-3 py-2 text-base text-[#17231f]";
const secondaryClass = "min-h-12 rounded-md border border-[#75837c] bg-white px-4 py-2 font-semibold hover:bg-[#e7f2ee]";
const groups: { title: string; keys: QuestionKey[] }[] = [
  { title: "Test coverage", keys: ["coverage", "reason"] },
  { title: "Power, display, and startup", keys: ["power", "display", "startup"] },
  { title: "Keyboard and pointing device", keys: ["keyboard", "pointing"] },
  { title: "Power input and battery", keys: ["external", "charger", "battery"] },
];

export default function LaptopDiagnosticFields({ draft, update, errors = {}, practice = false }:
  { draft: Draft; update: (draft: Draft) => void; errors?: Record<string, string>; practice?: boolean }) {
  const result = deriveCondition(draft);
  const stopped = result.safety === "blocked" || result.safety === "hold";
  const diagnosticsVisible = result.safety === "clear";
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


  return <div>
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
      <p className="mt-2">{practice ? "This is a practice form. Nothing has been submitted; no operator request has been created." : "You can save these private answers. No publication, hold, or operator request is created."}</p>
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
  </div>;
}
