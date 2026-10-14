BEGIN;

-- Nullable for legacy foundation fixtures; never invent prior acceptance/version.
ALTER TABLE "user_account" ADD COLUMN "adultAttestationVersion" TEXT;

-- The account reference is the entire minimized payload. No DOB, email or token copy.
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMPTZ(3),
    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_event_version_positive" CHECK ("eventVersion" > 0),
    CONSTRAINT "outbox_event_accountId_fkey" FOREIGN KEY ("accountId")
        REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "outbox_event_deduplicationKey_key" ON "outbox_event"("deduplicationKey");
CREATE INDEX "outbox_event_dispatchedAt_createdAt_idx" ON "outbox_event"("dispatchedAt", "createdAt");

COMMIT;
