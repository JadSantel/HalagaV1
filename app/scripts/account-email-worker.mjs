import "dotenv/config";
import { runAccountEmailJob, closeAccountEmailWorker } from "../src/server/repositories/account-email-worker.ts";
import { logOperationalEvent } from "../src/server/operational-log.ts";

try {
  const result = await runAccountEmailJob();
  logOperationalEvent({ operation: "account-email-worker", outcome:
    ["FAILED", "UNKNOWN"].includes(result.status) ? "failed" : "success" });
} catch {
  logOperationalEvent({ operation: "account-email-worker", outcome: "failed", code: "INTERNAL_ERROR" });
  process.exitCode = 1;
} finally {
  try { await closeAccountEmailWorker(); }
  catch { process.exitCode = 1; }
}
