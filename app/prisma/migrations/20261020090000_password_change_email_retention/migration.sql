-- ADR-089. Preserve the existing email-switch recipient rule unchanged.
BEGIN;
ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_security_notice_recipient";
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_security_notice_recipient" CHECK (
  ("eventType" = 'account.email-changed-security-notice' AND "recipientEmail" IS NOT NULL AND length("recipientEmail") > 0)
  OR ("eventType" = 'account.password-changed-security-notice' AND
      ("recipientEmail" IS NULL OR length("recipientEmail") > 0) AND "eventVersion" = 1 AND
      "deduplicationKey" ~ '^password-changed-email:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  OR ("eventType" NOT IN ('account.email-changed-security-notice', 'account.password-changed-security-notice') AND "recipientEmail" IS NULL)
);

CREATE FUNCTION guard_password_change_email_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."eventType" = 'account.password-changed-security-notice' AND NEW."recipientEmail" IS NULL THEN
      RAISE EXCEPTION 'password_change_recipient_required';
    END IF;
  ELSIF OLD."eventType" = 'account.password-changed-security-notice' THEN
    IF ROW(NEW.id, NEW."accountId", NEW."eventType", NEW."eventVersion", NEW."deduplicationKey", NEW."createdAt") IS DISTINCT FROM
       ROW(OLD.id, OLD."accountId", OLD."eventType", OLD."eventVersion", OLD."deduplicationKey", OLD."createdAt") OR
       (NEW."recipientEmail" IS DISTINCT FROM OLD."recipientEmail" AND NEW."recipientEmail" IS NOT NULL) THEN
      RAISE EXCEPTION 'password_change_binding_immutable';
    END IF;
  ELSIF NEW."eventType" = 'account.password-changed-security-notice' THEN
    RAISE EXCEPTION 'password_change_binding_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER password_change_email_binding_guard BEFORE INSERT OR UPDATE ON "outbox_event"
  FOR EACH ROW EXECUTE FUNCTION guard_password_change_email_binding();

CREATE FUNCTION guard_password_change_delivery_deadline() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_kind TEXT; event_time TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT "eventType" INTO event_kind FROM "outbox_event" WHERE id = OLD."outboxEventId";
    IF event_kind = 'account.password-changed-security-notice' AND
       ROW(NEW."outboxEventId", NEW."expiresAt", NEW."createdAt") IS DISTINCT FROM
       ROW(OLD."outboxEventId", OLD."expiresAt", OLD."createdAt") THEN
      RAISE EXCEPTION 'password_change_deadline_immutable';
    END IF;
  END IF;
  SELECT "eventType", "createdAt" INTO event_kind, event_time FROM "outbox_event" WHERE id = NEW."outboxEventId";
  IF event_kind = 'account.password-changed-security-notice' AND
     (NEW."expiresAt" IS DISTINCT FROM event_time + INTERVAL '168 hours' OR NEW."createdAt" IS DISTINCT FROM event_time) THEN
    RAISE EXCEPTION 'password_change_deadline_invalid';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER password_change_delivery_deadline_guard BEFORE INSERT OR UPDATE ON "account_email_delivery"
  FOR EACH ROW EXECUTE FUNCTION guard_password_change_delivery_deadline();

-- Runs inside the future deletion command's transaction; no deletion endpoint is mounted.
-- Lock order: account (already locked), delivery, then outbox. In-flight mail cannot be recalled.
CREATE FUNCTION erase_deleted_account_password_notices() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."deletedAt" IS NULL AND NEW."deletedAt" IS NOT NULL THEN
    UPDATE "account_email_delivery" d SET
      state = CASE WHEN d.state IN ('READY', 'LEASED') THEN 'SUPPRESSED' WHEN d.state = 'SENDING' THEN 'UNKNOWN' ELSE d.state END,
      "terminalAt" = CASE WHEN d.state IN ('READY', 'LEASED', 'SENDING') THEN NEW."deletedAt" ELSE d."terminalAt" END,
      "lastErrorCode" = CASE WHEN d.state IN ('READY', 'LEASED', 'SENDING') THEN 'ACCOUNT_DELETED' ELSE d."lastErrorCode" END,
      "leaseId" = NULL, "leaseExpiresAt" = NULL, ciphertext = ''::bytea, "updatedAt" = CURRENT_TIMESTAMP
      FROM "outbox_event" e WHERE d."outboxEventId" = e.id AND e."accountId" = NEW.id
      AND e."eventType" = 'account.password-changed-security-notice';
    UPDATE "outbox_event" SET "recipientEmail" = NULL
      WHERE "accountId" = NEW.id AND "eventType" = 'account.password-changed-security-notice';
    DELETE FROM "password_change_notice" WHERE "accountId" = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER erase_deleted_account_password_notices AFTER UPDATE OF "deletedAt" ON "user_account"
  FOR EACH ROW EXECUTE FUNCTION erase_deleted_account_password_notices();
COMMIT;
