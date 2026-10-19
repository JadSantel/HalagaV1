import { z } from "zod";
import {
  behaviorOptions, diagnosticVersion, emptyDraft, includedOptions, questions,
  deriveCondition, validateDraft, type Condition, type Draft, type QuestionKey,
} from "../domain/laptop-diagnostics.ts";
import { laptopDiagnosticAnswerSchema, phpAmountSchema } from "./foundation-validation.ts";

const questionKeys = Object.keys(questions) as [QuestionKey, ...QuestionKey[]];
const answers = z.partialRecord(z.enum(questionKeys), z.string()).superRefine((values, context) => {
  for (const key of questionKeys) {
    const value = values[key];
    // Empty is a valid unfinished answer; undefined choices are never stored.
    if (value && !Object.hasOwn(questions[key].options, value)) {
      context.addIssue({ code: "custom", path: [key], message: "INVALID_INPUT" });
    }
  }
});

/** Full replacement snapshot, with omitted fields reset to unfinished values.
 * No seller, condition, lifecycle, geography, fulfillment, declaration or media input.
 * Those last four fields await their separate implementation/publication gates.
 */
export const laptopDraftSchema = z.strictObject({
  diagnosticVersion: z.literal(diagnosticVersion).optional(),
  title: z.string().default(""), brand: z.string().default(""), model: z.string().default(""),
  description: z.string().default(""), approximateAge: z.string().default(""),
  answers: answers.optional(), notes: z.partialRecord(z.enum(questionKeys), z.string()).optional(),
  behavior: z.array(z.enum(Object.keys(behaviorOptions) as [string, ...string[]])).optional(),
  behaviorNotes: z.string().default(""),
  included: z.array(z.enum(includedOptions as [string, ...string[]])).optional(),
  includedNotes: z.string().default(""),
  privatePriceExpectation: z.union([z.literal(""), phpAmountSchema]).default(""),
}).transform((value) => ({
  ...emptyDraft(), ...value, diagnosticVersion,
  answers: { ...emptyDraft().answers, ...value.answers }, notes: value.notes ?? {},
  behavior: value.behavior ?? [], included: value.included ?? [],
}));

export type LaptopDraftSnapshot = z.output<typeof laptopDraftSchema>;

const conditions = {
  "Fully functional": "FULLY_FUNCTIONAL", "Functional with issues": "FUNCTIONAL_WITH_ISSUES",
  "Not functional": "NOT_FUNCTIONAL", "Untested/unknown": "UNTESTED_UNKNOWN",
} as const satisfies Record<Condition, string>;

export function validatedDraftCondition(draft: Draft) {
  // Keep incomplete disclosures, notes and cross-answer errors in a private draft,
  // but never persist a condition derived from answers that failed validation.
  if (Object.keys(validateDraft(draft)).length) return null;
  for (const questionKey of questionKeys) {
    if (!draft.answers[questionKey]) continue;
    if (!laptopDiagnosticAnswerSchema.safeParse({ schemaVersion: diagnosticVersion,
      questionKey, answer: draft.answers[questionKey], detail: draft.notes[questionKey] }).success) return null;
  }
  const result = deriveCondition(draft);
  return result.safety === "clear" && result.condition ? conditions[result.condition] : null;
}
