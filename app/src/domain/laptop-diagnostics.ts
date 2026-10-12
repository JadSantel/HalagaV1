import { z } from "zod";

// Accepted first English prototype, ADR-068. This module has no I/O.
export const diagnosticVersion = "laptop-diagnostics-en-v1";
export const safeTestingGuidance = "Only perform brief checks you already know how to do using the normal power button and a compatible charger. Do not open the laptop, remove or press the battery, bypass a password or device lock, install test software, or run demanding tests. Stop immediately if you notice swelling, leaking, puncture damage, unusual heat, smoke, sparks, or a strong chemical or burning odor.";

export type QuestionKey = "safety" | "coverage" | "reason" | "power" | "display" | "startup" | "keyboard" | "pointing" | "external" | "charger" | "battery" | "wifi" | "audio" | "camera" | "usb" | "missing" | "lock";
type Question = { title: string; short: string; options: Record<string, string>; help?: string; explain?: string[]; optional?: boolean };
export const questions: Record<QuestionKey, Question> = {
  safety: {
    title: "Before testing, do you see or notice any sign that the battery may be unsafe?", short: "Battery safety",
    help: "Look only from the outside. Do not press, remove, open, or handle the battery.",
    options: { clear: "No sign of a battery safety problem", hazard: "Yes — swelling, leaking, puncture damage, unusual heat, smoke, sparks, or strong odor", uncertain: "Not sure — something looks or feels unsafe", "no-battery": "No battery is installed or this configuration has no battery" },
  },
  coverage: {
    title: "How much of this laptop could you safely test?", short: "Test coverage",
    options: { all: "I completed all applicable required checks below", some: "I completed only some checks", none: "I could not safely test it" },
  },
  reason: {
    title: "Why could you not complete the checks?", short: "Reason for incomplete testing", optional: true,
    options: { "no-charger": "No compatible charger", locked: "Device lock or password prevented testing", missing: "A required component is missing", unsure: "I do not know how to test it safely", other: "Another reason — describe" }, explain: ["other"],
  },
  power: {
    title: "What happens when you press the normal power button?", short: "Power response",
    help: "This records power response only. It does not answer whether the display works or the operating system starts.",
    options: { on: "It powers on consistently", intermittent: "It powers on only sometimes", signs: "Lights or fans start, but there is no usable output", nothing: "Nothing happens", unknown: "Could not test" },
  },
  display: {
    title: "What does the laptop's built-in screen do after power-on?", short: "Built-in display",
    help: "Visible problems include lines, flickering, discoloration, dark areas, cracks affecting use, or intermittent image loss.",
    options: { clear: "Shows a clear and stable image", issue: "Shows an image but has a visible problem — describe", blank: "Lights up but shows no usable image", none: "Shows no image", na: "Not applicable — this configuration has no built-in display", unknown: "Could not test" }, explain: ["issue", "na"],
  },
  startup: {
    title: "How far does the laptop start?", short: "Startup behavior",
    help: "This remains separate from built-in display behavior. A laptop may display an image without reaching a usable system state.",
    options: { usable: "Reaches a usable sign-in, setup, or desktop screen", firmware: "Reaches firmware/BIOS only", recovery: "Reaches a recovery or error screen only — describe", locked: "Stops at a disclosed activation, account, firmware, or organization lock", unusable: "Does not reach a usable screen", unknown: "Could not test" }, explain: ["recovery"],
  },
  keyboard: {
    title: "Did the built-in keyboard work during a brief normal check?", short: "Built-in keyboard",
    options: { works: "Works for the keys I checked, with no known issue", issue: "Has one or more known issues — describe", failed: "Does not work", na: "Not applicable — no built-in keyboard by design", unknown: "Could not test" }, explain: ["issue", "na"],
  },
  pointing: {
    title: "Did the built-in trackpad or pointing device work during a brief normal check?", short: "Built-in pointing device",
    options: { works: "Works with no known issue", issue: "Has one or more known issues — describe", failed: "Does not work", na: "Not applicable — none by design", unknown: "Could not test" }, explain: ["issue", "na"],
  },
  external: {
    title: "What happens when a compatible charger is connected?", short: "External-power operation",
    options: { works: "The laptop operates normally from external power", intermittent: "External power works intermittently or only in a certain position — describe", failed: "The laptop does not operate from external power", "no-charger": "No compatible charger was available", unknown: "Could not test for another reason" }, explain: ["intermittent"],
  },
  charger: { title: "Is a compatible charger included with the listing?", short: "Charger included", options: { yes: "Yes", no: "No" } },
  battery: {
    title: "Which statement best describes the installed battery?", short: "Battery presence and operation",
    help: "Do not estimate runtime or use battery-health software. Report only what you observed.",
    options: { normal: "Present, charges, and powers the laptop with no known issue", degraded: "Present and powers the laptop, but performance is degraded — describe what you observed", "no-power": "Present but does not power the laptop", "no-charge": "Present but does not charge", absent: "Expected for this model but absent", na: "Not applicable by design or configuration — explain", unknown: "Could not test" }, explain: ["degraded", "na"],
  },
  wifi: { title: "Wi-Fi", short: "Wi-Fi", optional: true, options: {}, explain: ["issue"] },
  audio: { title: "Speakers or audio output", short: "Speakers or audio output", optional: true, options: {}, explain: ["issue"] },
  camera: { title: "Camera", short: "Camera", optional: true, options: {}, explain: ["issue"] },
  usb: { title: "At least one USB port", short: "USB port", optional: true, options: {}, explain: ["issue"] },
  missing: {
    title: "Are any expected laptop parts missing?", short: "Missing expected parts",
    options: { none: "No expected parts are known to be missing", yes: "Yes — choose or describe: storage drive, memory, keyboard keys, bottom cover, screws, battery, or other", unknown: "Not sure" }, explain: ["yes"],
  },
  lock: {
    title: "Is the laptop restricted by an activation, account, firmware/BIOS, or organization-management lock?", short: "Lock and management status",
    help: "Disclose the known lock type and what you know about removal capability. Halaga does not assist with lock removal or bypass.",
    options: { none: "No known lock", activation: "Activation or linked-account lock", firmware: "Firmware/BIOS password or lock", managed: "Organization, school, or employer management", other: "Another restriction — describe", unknown: "Not sure" }, explain: ["activation", "firmware", "managed", "other"],
  },
};
export const enhancedKeys: QuestionKey[] = ["wifi", "audio", "camera", "usb"];
for (const key of enhancedKeys) questions[key].options = { works: "Works with no known issue", issue: "Has an issue — describe", failed: "Does not work", na: "Not applicable", untested: "Did not test" };

export const behaviorOptions: Record<string, string> = {
  shutdown: "Unexpected shutdown or restart", heat: "Unusual heat that did not trigger the safety stop", noise: "Unusual fan, drive, electrical, or mechanical noise", liquid: "Evidence of past liquid exposure", intermittent: "Intermittent behavior not already described", other: "Another known functional issue — describe", none: "None known", unknown: "Could not observe during testing",
};
export const includedOptions = ["Laptop", "Charger", "Adapter", "Dock", "Bag", "Removable storage", "Other supported accessories"];
export type Draft = {
  diagnosticVersion: string;
  title: string; brand: string; model: string; description: string;
  answers: Record<QuestionKey, string>;
  notes: Partial<Record<QuestionKey, string>>;
  behavior: string[]; behaviorNotes: string;
  included: string[]; includedNotes: string;
};
export type Condition = "Fully functional" | "Functional with issues" | "Not functional" | "Untested/unknown";
export type Reason = { field: string; text: string };
export type Result = { safety: "clear" | "unanswered" | "blocked" | "hold"; condition: Condition | null; reasons: Reason[] };

export function emptyDraft(): Draft {
  const answers = Object.fromEntries(Object.keys(questions).map((key) => [key, enhancedKeys.includes(key as QuestionKey) ? "untested" : ""])) as Draft["answers"];
  return { diagnosticVersion, title: "", brand: "", model: "", description: "", answers, notes: {}, behavior: [], behaviorNotes: "", included: [], includedNotes: "" };
}

export function answerText(draft: Draft, key: QuestionKey): string {
  const label = Object.hasOwn(questions[key].options, draft.answers[key]) ? questions[key].options[draft.answers[key]] : "Not answered";
  return draft.notes[key]?.trim() ? `${label}. ${draft.notes[key]?.trim()}` : label;
}

export function changeAnswer(draft: Draft, key: QuestionKey, value: string): Draft {
  const answers = { ...draft.answers, [key]: value };
  const notes = { ...draft.notes, [key]: "" };
  if (key === "safety" && (value === "hazard" || value === "uncertain")) {
    const fresh = emptyDraft();
    return { ...draft, answers: { ...fresh.answers, safety: value }, notes: {}, behavior: [], behaviorNotes: "" };
  }
  if (key === "coverage" && value === "all") { answers.reason = ""; notes.reason = ""; }
  return { ...draft, answers, notes };
}

export function toggleBehavior(current: string[], value: string): string[] {
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (value === "none" || value === "unknown") return [value];
  return [...current.filter((item) => item !== "none" && item !== "unknown"), value];
}

const identitySchema = z.object({
  diagnosticVersion: z.literal(diagnosticVersion),
  title: z.string().trim().min(1, "Enter a title for the sample laptop."),
  brand: z.string().trim().min(1, "Enter a brand, or write Unknown."),
  model: z.string().trim().min(1, "Enter a model, or write Unknown."),
  description: z.string().trim().min(1, "Describe the sample laptop and any known problems."),
});

// Feedback for this browser-only exercise; server validation is required before persistence.
export function validateDraft(draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  const identity = identitySchema.safeParse(draft);
  if (!identity.success) for (const issue of identity.error.issues) errors[String(issue.path[0])] = issue.message;
  const route = deriveCondition(draft).safety;
  if (route === "blocked" || route === "hold") return { ...errors, safety: "Stop testing. This safety concern prevents ordinary review." };
  for (const [rawKey, question] of Object.entries(questions)) {
    const key = rawKey as QuestionKey;
    if (key !== "safety" && route === "unanswered") continue;
    if (key === "reason" && draft.answers.coverage === "all") continue;
    const answer = draft.answers[key];
    if (!answer && question.optional) continue;
    if (!Object.hasOwn(question.options, answer)) errors[key] = `Choose an answer for ${question.short.toLowerCase()}.`;
    if (question.explain?.includes(answer) && !draft.notes[key]?.trim()) errors[`${key}-note`] = `Describe or explain ${question.short.toLowerCase()}.`;
  }
  if (route !== "unanswered") {
    if (!draft.behavior.length || draft.behavior.some((value) => !Object.hasOwn(behaviorOptions, value))) errors.behavior = "Choose known issues, None known, or Could not observe during testing.";
    if (draft.behavior.length > 1 && draft.behavior.some((value) => value === "none" || value === "unknown")) errors.behavior = "None known and Could not observe cannot be combined with other issues.";
    if (draft.behavior.includes("other") && !draft.behaviorNotes.trim()) errors["behavior-note"] = "Describe the other known functional issue.";
    if (!draft.included.length || draft.included.some((value) => !includedOptions.includes(value))) errors.included = "Select the laptop and any included accessories.";
    if (!draft.included.includes("Laptop")) errors.included = "Include the laptop in this single-laptop practice listing.";
    if (draft.included.includes("Other supported accessories") && !draft.includedNotes.trim()) errors["included-note"] = "Describe the other supported accessories.";
    if (draft.answers.charger && (draft.answers.charger === "yes") !== draft.included.includes("Charger")) errors.included = "Make the included items match your charger-inclusion answer.";
    if (draft.answers.safety === "no-battery" && ["normal", "degraded", "no-power", "no-charge"].includes(draft.answers.battery)) errors.battery = "The safety answer says no battery is installed. Correct the battery answers.";
    if (draft.answers.startup === "locked" && draft.answers.lock === "none") errors.lock = "Startup stopped at a lock. Disclose it here or correct the startup answer.";
  }
  return errors;
}

const primaryKeys: QuestionKey[] = ["power", "display", "startup", "keyboard", "pointing", "external"];
const passing: Partial<Record<QuestionKey, string>> = { power: "on", display: "clear", startup: "usable", keyboard: "works", pointing: "works", external: "works" };

export function deriveCondition(draft: Draft): Result {
  const a = draft.answers;
  const result = (condition: Condition, reasons: Reason[]): Result => ({ safety: "clear", condition, reasons });
  if (a.safety === "hazard" || a.safety === "uncertain") return {
    safety: a.safety === "hazard" ? "blocked" : "hold", condition: null,
    reasons: [{ field: "safety", text: a.safety === "hazard" ? "Stop testing. A hazardous battery blocks an ordinary listing." : "Stop testing. Uncertain safety requires human review in the full marketplace." }],
  };
  if (!["clear", "no-battery"].includes(a.safety)) return { safety: "unanswered", condition: null, reasons: [{ field: "safety", text: "Answer the battery safety question first." }] };

  const systemResponse = ["usable", "firmware", "recovery", "locked"].includes(a.startup);
  // Contradictory positive and negative observations cannot establish a terminal failure.
  const contradictoryPower = a.power === "nothing" && (systemResponse || ["normal", "degraded"].includes(a.battery) || ["works", "intermittent"].includes(a.external) || ["clear", "issue"].includes(a.display) || a.keyboard === "works" || a.pointing === "works");
  if (contradictoryPower) return result("Untested/unknown", [{ field: "power", text: "Nothing happens conflicts with an observed screen, battery-powered use, or external-power operation. Correct the source answers." }]);

  // ADR-068 §5.1: a conclusive terminal failure precedes general test sufficiency.
  if (a.coverage !== "none" && a.power === "nothing" && a.external === "failed") return result("Not functional", [
    { field: "power", text: answerText(draft, "power") }, { field: "external", text: answerText(draft, "external") },
    { field: "startup", text: "These tested failures establish no intended computing function. Downstream checks do not need artificial passing or failing answers." },
  ]);
  const noScreenOrInput = a.power === "signs" && ["blank", "none"].includes(a.display) && a.startup === "unusable" && a.keyboard === "failed" && a.pointing === "failed" && a.external === "failed";
  if (a.coverage === "all" && noScreenOrInput) return result("Not functional", primaryKeys.map((field) => ({ field, text: `${questions[field].short}: ${answerText(draft, field)}` })));

  const insufficient: Reason[] = [];
  for (const key of primaryKeys) {
    const value = a[key];
    if (!value || !Object.hasOwn(questions[key].options, value) || value === "unknown" || value === "no-charger") insufficient.push({ field: key, text: `${questions[key].short}: ${value ? answerText(draft, key) : "not answered"}. Required testing is incomplete.` });
    else if (value === "na" && !draft.notes[key]?.trim()) insufficient.push({ field: `${key}-note`, text: `${questions[key].short}: explain why this feature is genuinely absent by design or configuration. A missing or broken expected part is not Not applicable.` });
  }
  if (a.coverage === "none" || !a.coverage) insufficient.push({ field: "coverage", text: "Required safe testing has not been confirmed." });
  // Q5 says startup stopped. Treat the required usable-system test as prevented;
  // Q13 lock metadata alone never changes a conclusive startup result (see README).
  if (a.startup === "locked") insufficient.push({ field: "startup", text: "Startup stopped at a lock, so reaching a usable system state could not be verified. Lock status itself does not change condition." });
  if (insufficient.length) return result("Untested/unknown", insufficient);
  if (!systemResponse) return result("Untested/unknown", [{ field: "startup", text: "These observations do not conclusively establish a usable system, firmware, recovery, or locked-screen response. Lights and fans alone are not an intended computing function." }]);

  const issues: Reason[] = [];
  for (const key of primaryKeys) if (a[key] !== passing[key] && a[key] !== "na") issues.push({ field: key, text: `${questions[key].short}: ${answerText(draft, key)}` });
  for (const key of enhancedKeys) if (["issue", "failed"].includes(a[key])) issues.push({ field: key, text: `${questions[key].short}: ${answerText(draft, key)}` });
  if (["degraded", "no-power", "no-charge", "absent"].includes(a.battery)) issues.push({ field: "battery", text: `Battery: ${answerText(draft, "battery")}` });
  if (a.missing === "yes") issues.push({ field: "missing", text: `Missing expected parts: ${draft.notes.missing?.trim() || "reported missing"}` });
  for (const value of draft.behavior) if (value !== "none" && value !== "unknown") issues.push({ field: "behavior", text: `${behaviorOptions[value]}${value === "other" && draft.behaviorNotes.trim() ? `: ${draft.behaviorNotes.trim()}` : ""}` });

  const facts = primaryKeys.filter((key) => a[key] === passing[key] || a[key] === "na").map((field) => ({ field, text: `${questions[field].short}: ${answerText(draft, field)}` }));
  return issues.length ? result("Functional with issues", [...facts, ...issues]) : result("Fully functional", facts);
}

function workingSample(): Draft {
  const draft = emptyDraft();
  return { ...draft, title: "Made-up laptop for practice", brand: "Example brand", model: "Demo 14", description: "Fictional laptop with a scratched lid. This is sample data, not a real item.", answers: { ...draft.answers, safety: "clear", coverage: "all", power: "on", display: "clear", startup: "usable", keyboard: "works", pointing: "works", external: "works", charger: "yes", battery: "normal", missing: "none", lock: "none" }, behavior: ["none"], included: ["Laptop", "Charger"] };
}
const safe = workingSample();
const defective = { ...workingSample(), answers: { ...safe.answers, battery: "no-power", camera: "failed" } };
const insufficient = { ...workingSample(), answers: { ...safe.answers, coverage: "some", reason: "no-charger", external: "no-charger", charger: "no", battery: "unknown" }, included: ["Laptop"] };
const dead = { ...workingSample(), answers: { ...safe.answers, coverage: "some", power: "nothing", external: "failed", display: "unknown", startup: "unknown", keyboard: "unknown", pointing: "unknown", battery: "unknown" } };
export const samples: { name: string; draft: Draft; expected: Condition | null; safety: Result["safety"] }[] = [
  { name: "Safe", draft: safe, expected: "Fully functional", safety: "clear" },
  { name: "Defective", draft: defective, expected: "Functional with issues", safety: "clear" },
  { name: "Insufficiently tested", draft: insufficient, expected: "Untested/unknown", safety: "clear" },
  { name: "Not functional", draft: dead, expected: "Not functional", safety: "clear" },
  { name: "Unsafe battery", draft: changeAnswer(workingSample(), "safety", "hazard"), expected: null, safety: "blocked" },
  { name: "Uncertain safety", draft: changeAnswer(workingSample(), "safety", "uncertain"), expected: null, safety: "hold" },
];

export function copyDraft(draft: Draft): Draft {
  return { ...draft, answers: { ...draft.answers }, notes: { ...draft.notes }, behavior: [...draft.behavior], included: [...draft.included] };
}
