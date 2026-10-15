BEGIN;

CREATE TABLE "account_email_delivery" (
  "id" UUID NOT NULL,
  "outboxEventId" UUID NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'READY',
  "keyId" TEXT NOT NULL,
  "ciphertext" BYTEA NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "leaseId" UUID,
  "leaseExpiresAt" TIMESTAMPTZ(3),
  "lastErrorCode" TEXT,
  "providerMessageId" TEXT,
  "acceptedAt" TIMESTAMPTZ(3),
  "terminalAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "account_email_delivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_email_delivery_outbox_fk" FOREIGN KEY ("outboxEventId")
    REFERENCES "outbox_event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "account_email_delivery_state_check" CHECK ("state" IN (
    'READY', 'LEASED', 'SENDING', 'ACCEPTED', 'SUPPRESSED', 'FAILED', 'UNKNOWN'
  )),
  CONSTRAINT "account_email_delivery_key_check" CHECK ("keyId" ~ '^[A-Za-z0-9_-]{1,32}$'),
  CONSTRAINT "account_email_delivery_ciphertext_check" CHECK (octet_length("ciphertext") >= 28),
  CONSTRAINT "account_email_delivery_attempt_check" CHECK ("attemptCount" BETWEEN 0 AND 5),
  CONSTRAINT "account_email_delivery_diagnostic_check" CHECK (
    ("lastErrorCode" IS NULL OR length("lastErrorCode") <= 64) AND
    ("providerMessageId" IS NULL OR length("providerMessageId") <= 200)
  ),
  CONSTRAINT "account_email_delivery_lease_check" CHECK (
    ("state" IN ('LEASED', 'SENDING') AND "leaseId" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
    OR ("state" NOT IN ('LEASED', 'SENDING') AND "leaseId" IS NULL AND "leaseExpiresAt" IS NULL)
  ),
  CONSTRAINT "account_email_delivery_terminal_check" CHECK (
    ("state" IN ('ACCEPTED', 'SUPPRESSED', 'FAILED', 'UNKNOWN') AND "terminalAt" IS NOT NULL)
    OR ("state" IN ('READY', 'LEASED', 'SENDING') AND "terminalAt" IS NULL)
  ),
  CONSTRAINT "account_email_delivery_accepted_check" CHECK (
    ("state" = 'ACCEPTED' AND "acceptedAt" IS NOT NULL) OR
    ("state" <> 'ACCEPTED' AND "acceptedAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "account_email_delivery_outboxEventId_key"
  ON "account_email_delivery"("outboxEventId");
CREATE INDEX "account_email_delivery_state_availableAt_createdAt_idx"
  ON "account_email_delivery"("state", "availableAt", "createdAt");
CREATE INDEX "account_email_delivery_state_leaseExpiresAt_idx"
  ON "account_email_delivery"("state", "leaseExpiresAt");

COMMIT;
