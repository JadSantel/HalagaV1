// ADR-095, accepted for local synthetic drafts only.
export const photoPolicy = {
  version: "synthetic-laptop-photo-v1", maxCount: 10, maxBytes: 10 * 1024 * 1024,
  ownerBytes: 256 * 1024 * 1024, maxPixels: 24_000_000, maxAxis: 10_000,
  originalLifetime: 24 * 60 * 60 * 1000, draftLifetime: 30 * 24 * 60 * 60 * 1000,
  lease: 120_000, heartbeat: 30_000, timeout: 30_000, maxAttempts: 5,
} as const;

export type DraftPhoto = { id: string; position: number; status: string; src: string | null };

export function draftCutoff(now: Date) { return new Date(now.getTime() - photoPolicy.draftLifetime); }
