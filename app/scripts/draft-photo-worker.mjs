import "dotenv/config";
import { openPhotoStore } from "../src/server/draft-photo-processing.ts";
import { runDraftPhotoJob, closeDraftPhotoWorker } from "../src/server/repositories/draft-photo-runtime.ts";

try {
  const result = await runDraftPhotoJob(await openPhotoStore(process.env.DRAFT_PHOTO_ROOT ?? ""));
  // Fixed state only. Never print filesystem paths, scanner output or private payloads.
  console.info(["IDLE", "APPROVED", "REJECTED", "FAILED", "STALE"].includes(result.status) ? result.status : "FAILED");
  if (["FAILED", "STALE"].includes(result.status)) process.exitCode = 1;
} catch { console.error("DRAFT_PHOTO_WORKER_FAILED"); process.exitCode = 1; }
finally { await closeDraftPhotoWorker().catch(() => { process.exitCode = 1; }); }
