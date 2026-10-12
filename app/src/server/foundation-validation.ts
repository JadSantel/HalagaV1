import { z } from "zod";
import { diagnosticVersion, questions, type QuestionKey } from "../domain/laptop-diagnostics.ts";

// Never accept a JS number for money: its precision may already have been lost.
// This is a storage parser, not the positive-amount rule for future proposals.
export const phpAmountSchema = z.string().trim()
  .regex(/^-?\d+(?:\.\d{1,2})?$/, "Use an exact PHP decimal with at most two decimal places.")
  .transform((value) => {
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
    const integer = whole.replace(/^0+(?=\d)/, "");
    const centavos = fraction.padEnd(2, "0");
    return `${negative && (integer !== "0" || centavos !== "00") ? "-" : ""}${integer}.${centavos}`;
  })
  .refine((value) => value.replace(/^-/, "").split(".")[0].length <= 10,
    "This amount exceeds the current database storage precision.");

export const itemQuantitySchema = z.number().int().positive();

// A per-question parser. Whole-draft validation still checks applicability,
// cross-answer consistency, required disclosures, safety and derived condition.
export const laptopDiagnosticAnswerSchema = z.strictObject({
  schemaVersion: z.literal(diagnosticVersion),
  questionKey: z.enum(Object.keys(questions) as [QuestionKey, ...QuestionKey[]]),
  answer: z.string(),
  detail: z.string().optional(),
}).superRefine((value, context) => {
  const question = questions[value.questionKey];
  if (!(question.optional && value.answer === "") &&
      !Object.hasOwn(question.options, value.answer)) {
    context.addIssue({ code: "custom", path: ["answer"], message: "Choose a defined answer for this question." });
  }
  if (question.explain?.includes(value.answer) && !value.detail?.trim()) {
    context.addIssue({ code: "custom", path: ["detail"], message: "An explanation is required for this answer." });
  }
});
