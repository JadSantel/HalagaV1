BEGIN;

CREATE TABLE account_marketplace_restriction (
  id uuid PRIMARY KEY,
  "accountId" uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  scope text NOT NULL CHECK (scope IN ('CREATE_LAPTOP_DRAFT', 'EDIT_LAPTOP_DRAFT',
    'PUBLISH_LISTING', 'SEND_INQUIRY', 'SUBMIT_PROPOSAL', 'SUSPENSION')),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  "startsAt" timestamptz(3) NOT NULL,
  "reviewAt" timestamptz(3) NOT NULL CHECK ("reviewAt" >= "startsAt"),
  "authorizedBy" text NOT NULL CHECK (length(btrim("authorizedBy")) > 0),
  "appealRoute" text CHECK ("appealRoute" IS NULL OR length(btrim("appealRoute")) > 0),
  "revokedAt" timestamptz(3),
  "revokedBy" text,
  CHECK (("revokedAt" IS NULL AND "revokedBy" IS NULL) OR
    ("revokedAt" IS NOT NULL AND "revokedAt" >= "startsAt" AND
      "revokedBy" IS NOT NULL AND length(btrim("revokedBy")) > 0))
);
CREATE INDEX account_marketplace_restriction_account_scope_start_idx
  ON account_marketplace_restriction ("accountId", scope, "startsAt");

-- Restriction changes serialize with draft commands, including direct synthetic
-- fixture writes. Review time is not automatic expiry. Corrections append a new
-- decision after revocation; authorized retention deletion remains separate.
CREATE FUNCTION guard_marketplace_restriction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW."accountId", NEW.scope, NEW.reason, NEW."startsAt",
        NEW."reviewAt", NEW."authorizedBy", NEW."appealRoute") IS DISTINCT FROM
       ROW(OLD.id, OLD."accountId", OLD.scope, OLD.reason, OLD."startsAt",
        OLD."reviewAt", OLD."authorizedBy", OLD."appealRoute") OR
       OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL THEN
      RAISE EXCEPTION 'Marketplace restriction decision history is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM id FROM user_account WHERE id = OLD."accountId" FOR UPDATE;
    RETURN OLD;
  END IF;
  PERFORM id FROM user_account WHERE id = NEW."accountId" FOR UPDATE;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_restriction_guard
  BEFORE INSERT OR UPDATE OR DELETE ON account_marketplace_restriction
  FOR EACH ROW EXECUTE FUNCTION guard_marketplace_restriction();

COMMIT;
