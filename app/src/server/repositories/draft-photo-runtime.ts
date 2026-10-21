import "server-only";
import { getPrisma } from "../prisma.ts";
import type { PhotoStore } from "../draft-photo-processing.ts";
import { createDraftPhotoWorker } from "./draft-photo-worker.ts";

export async function runDraftPhotoJob(store: PhotoStore) { return createDraftPhotoWorker(getPrisma(), store).runOnce(); }
export async function closeDraftPhotoWorker() { await getPrisma().$disconnect(); }
