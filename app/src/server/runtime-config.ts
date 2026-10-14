import { z } from "zod";

const databaseUrlSchema = z.url({ error: "expected a valid URL" }).refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}, "expected a PostgreSQL URL");

export const runtimeConfigSchema = z.object({ DATABASE_URL: databaseUrlSchema });
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

/** Report configuration field names only; Zod issues may contain secret input values. */
export function readRuntimeConfig(environment: Record<string, string | undefined>): RuntimeConfig {
  const parsed = runtimeConfigSchema.safeParse(environment);
  if (parsed.success) return parsed.data;

  const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] || "environment")))];
  throw new Error(`Invalid server configuration for ${fields.join(", ")}. Check app/.env.example.`);
}
