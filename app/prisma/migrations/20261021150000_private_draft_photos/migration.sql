-- Preserve the unused legacy ListingMedia scaffold. Do not reinterpret its rows.
ALTER TABLE listing_revision ADD COLUMN "photoCommand" text;
ALTER TABLE listing ADD CONSTRAINT draft_photo_listing_owner UNIQUE (id,"sellerId");
CREATE TABLE draft_photo (
  id uuid PRIMARY KEY, "listingId" uuid NOT NULL REFERENCES listing(id) ON DELETE RESTRICT,
  "ownerId" uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  "expectedRevision" integer NOT NULL CHECK ("expectedRevision" > 0), "resultRevision" integer,
  "contentSha256" text NOT NULL CHECK ("contentSha256" ~ '^[0-9a-f]{64}$'),
  "byteSize" integer NOT NULL CHECK ("byteSize" BETWEEN 1 AND 10485760),
  "mediaType" text NOT NULL CHECK ("mediaType" IN ('image/jpeg','image/png')),
  status text NOT NULL DEFAULT 'UPLOADING' CHECK (status IN
    ('UPLOADING','PENDING','PROCESSING','APPROVED','FAILED','REJECTED','QUARANTINED','DELETION_PENDING','DELETED')),
  "reservedBytes" integer NOT NULL CHECK ("reservedBytes" >= 0),
  "derivativeBytes" integer NOT NULL DEFAULT 0 CHECK ("derivativeBytes" >= 0),
  "approvedAttemptId" uuid, "originalDeletedAt" timestamptz(3), "deletedAt" timestamptz(3),
  "expiresAt" timestamptz(3) NOT NULL, "nextAttemptAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  executions integer NOT NULL DEFAULT 0 CHECK (executions BETWEEN 0 AND 5),
  "leaseId" uuid, "leaseUntil" timestamptz(3), "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id,"listingId","ownerId"),
  FOREIGN KEY ("listingId","ownerId") REFERENCES listing(id,"sellerId") ON DELETE RESTRICT,
  CHECK ((status = 'APPROVED') = ("approvedAttemptId" IS NOT NULL)),
  CHECK (("leaseId" IS NULL) = ("leaseUntil" IS NULL))
);
CREATE INDEX draft_photo_owner ON draft_photo("ownerId");
CREATE INDEX draft_photo_work ON draft_photo(status,"nextAttemptAt");
ALTER TABLE listing_revision ADD CONSTRAINT draft_photo_revision_scope UNIQUE (id,"listingId","authoredById");
CREATE TABLE draft_photo_reference (
  "revisionId" uuid NOT NULL, "photoId" uuid NOT NULL, "listingId" uuid NOT NULL, "ownerId" uuid NOT NULL,
  "sortOrder" integer NOT NULL CHECK ("sortOrder" BETWEEN 0 AND 9),
  PRIMARY KEY ("revisionId","photoId"), UNIQUE ("revisionId","sortOrder"),
  FOREIGN KEY ("revisionId","listingId","ownerId") REFERENCES listing_revision(id,"listingId","authoredById") ON DELETE RESTRICT,
  FOREIGN KEY ("photoId","listingId","ownerId") REFERENCES draft_photo(id,"listingId","ownerId") ON DELETE RESTRICT
);
CREATE TRIGGER draft_photo_reference_immutable BEFORE UPDATE ON draft_photo_reference
  FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE FUNCTION draft_photo_owner_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM listing WHERE id = NEW."listingId" AND "sellerId" = NEW."ownerId") THEN
    RAISE EXCEPTION 'Invalid photo scope' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id,NEW."listingId",NEW."ownerId",NEW."contentSha256",NEW."byteSize",NEW."mediaType",NEW."createdAt",NEW."expiresAt",NEW."expectedRevision")
    IS DISTINCT FROM (OLD.id,OLD."listingId",OLD."ownerId",OLD."contentSha256",OLD."byteSize",OLD."mediaType",OLD."createdAt",OLD."expiresAt",OLD."expectedRevision") THEN
    RAISE EXCEPTION 'Immutable photo identity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER draft_photo_owner BEFORE INSERT OR UPDATE ON draft_photo
  FOR EACH ROW EXECUTE FUNCTION draft_photo_owner_check();
CREATE TABLE draft_photo_attempt (
  id uuid PRIMARY KEY, "photoId" uuid NOT NULL REFERENCES draft_photo(id) ON DELETE RESTRICT,
  execution integer NOT NULL CHECK (execution BETWEEN 1 AND 5), outcome text NOT NULL DEFAULT 'PROCESSING',
  policy text NOT NULL DEFAULT 'synthetic-laptop-photo-v1' CHECK (policy = 'synthetic-laptop-photo-v1'),
  "startedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" timestamptz(3), UNIQUE ("photoId",execution)
);
CREATE FUNCTION finish_draft_photo_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.outcome <> 'PROCESSING' OR NEW.outcome NOT IN ('APPROVED','REJECTED','FAILED','INTERRUPTED') OR NEW."finishedAt" IS NULL
    OR (NEW.id,NEW."photoId",NEW.execution,NEW.policy,NEW."startedAt") IS DISTINCT FROM
       (OLD.id,OLD."photoId",OLD.execution,OLD.policy,OLD."startedAt") THEN
    RAISE EXCEPTION 'Immutable photo attempt' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER draft_photo_attempt_finish BEFORE UPDATE ON draft_photo_attempt
  FOR EACH ROW EXECUTE FUNCTION finish_draft_photo_attempt();
CREATE TABLE draft_photo_event (
  id uuid PRIMARY KEY, "photoId" uuid NOT NULL REFERENCES draft_photo(id) ON DELETE RESTRICT,
  kind text NOT NULL, "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("photoId",kind)
);
CREATE TRIGGER draft_photo_event_immutable BEFORE UPDATE ON draft_photo_event
  FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TABLE draft_retention_hold (
  id uuid PRIMARY KEY, "listingId" uuid NOT NULL REFERENCES listing(id) ON DELETE RESTRICT,
  "authorizedById" uuid NOT NULL, purpose text NOT NULL CHECK (length(trim(purpose)) > 0),
  "startedAt" timestamptz(3) NOT NULL, "reviewAt" timestamptz(3) NOT NULL,
  "releasedAt" timestamptz(3), "releasedById" uuid,
  CHECK (("releasedAt" IS NULL) = ("releasedById" IS NULL)),
  CHECK ("reviewAt" > "startedAt" AND "reviewAt" <= "startedAt" + interval '30 days')
);
CREATE INDEX draft_retention_hold_listing ON draft_retention_hold("listingId","releasedAt");
CREATE FUNCTION release_draft_retention_hold() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."releasedAt" IS NOT NULL OR NEW."releasedAt" IS NULL OR NEW."releasedById" IS NULL OR NEW."releasedAt" < OLD."startedAt"
    OR (NEW.id,NEW."listingId",NEW."authorizedById",NEW.purpose,NEW."startedAt",NEW."reviewAt") IS DISTINCT FROM
       (OLD.id,OLD."listingId",OLD."authorizedById",OLD.purpose,OLD."startedAt",OLD."reviewAt") THEN
    RAISE EXCEPTION 'Immutable scoped hold' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER draft_retention_hold_release BEFORE UPDATE ON draft_retention_hold
  FOR EACH ROW EXECUTE FUNCTION release_draft_retention_hold();
