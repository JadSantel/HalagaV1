import "server-only";
import { createAccountEmailDispatcher } from "./account-email-dispatch.ts";
import { getPrisma } from "../prisma.ts";

/** One bounded job-runtime invocation; no in-request background task or invented polling cadence. */
export async function runAccountEmailJob(dispatcher = createAccountEmailDispatcher(getPrisma())) {
  await dispatcher.recoverAndClean();
  return dispatcher.dispatchOne();
}

export async function closeAccountEmailWorker() {
  await getPrisma().$disconnect();
}
