BEGIN;

-- An account reference resolves to the NEW address after a change. The old-address
-- security notice needs its own purpose-limited recipient snapshot (ADR-087).
ALTER TABLE "outbox_event" ADD COLUMN "recipientEmail" TEXT;
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_security_notice_recipient" CHECK (
  ("eventType" = 'account.email-changed-security-notice' AND
   "recipientEmail" IS NOT NULL AND length("recipientEmail") > 0)
  OR ("eventType" <> 'account.email-changed-security-notice' AND "recipientEmail" IS NULL)
);

COMMIT;
