-- SQL-only foundation enforcement. Append after Prisma's generated table/FK SQL.
-- Columns are quoted camelCase, matching the Prisma schema.
-- Keep this fragment byte-for-byte aligned with the first migration's SQL suffix.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE listing
  ADD CONSTRAINT listing_current_revision_required CHECK (
    status = 'DRAFT' OR "currentRevisionNumber" IS NOT NULL
  ),
  ADD CONSTRAINT listing_closed_timestamp CHECK (
    (status = 'CLOSED') = ("closedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT listing_expired_timestamp CHECK (
    status <> 'EXPIRED' OR "expiredAt" IS NOT NULL
  );

ALTER TABLE listing_revision
  ADD CONSTRAINT listing_revision_version_positive CHECK (version > 0);

ALTER TABLE publication_cycle
  ADD CONSTRAINT publication_cycle_number_positive CHECK ("cycleNumber" > 0),
  ADD CONSTRAINT publication_cycle_kind CHECK (
    ("cycleNumber" = 1 AND kind = 'INITIAL_PUBLICATION') OR
    ("cycleNumber" > 1 AND kind = 'RENEWAL')
  ),
  ADD CONSTRAINT publication_cycle_thirty_days CHECK (
    isfinite("startsAt") AND isfinite("expiresAt") AND "expiresAt" = (
      ("startsAt" AT TIME ZONE 'Asia/Manila') + INTERVAL '30 days'
    ) AT TIME ZONE 'Asia/Manila'
  );

ALTER TABLE publication_availability_interval
  ADD CONSTRAINT publication_availability_interval_order CHECK (
    isfinite("startedAt") AND
    ("endedAt" IS NULL OR (isfinite("endedAt") AND "endedAt" >= "startedAt"))
  ),
  ADD CONSTRAINT publication_availability_no_overlap EXCLUDE USING gist (
    "listingId" WITH =,
    tstzrange("startedAt", "endedAt", '[)') WITH &&
  );

CREATE UNIQUE INDEX publication_availability_one_open
  ON publication_availability_interval ("listingId") WHERE "endedAt" IS NULL;

ALTER TABLE listed_item_group
  ADD CONSTRAINT listed_item_group_quantity_positive CHECK (quantity > 0);

ALTER TABLE listing_media
  ADD CONSTRAINT listing_media_byte_size_positive CHECK ("byteSize" > 0),
  ADD CONSTRAINT listing_media_sort_order_nonnegative CHECK ("sortOrder" >= 0);

-- Eligibility, validated revision and publication policy remain server command gates.
CREATE FUNCTION validate_publication_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  listing_seller uuid;
  last_number integer;
  last_start timestamptz;
BEGIN
  SELECT "sellerId" INTO listing_seller FROM listing
    WHERE id = NEW."listingId" FOR UPDATE;
  IF listing_seller IS DISTINCT FROM NEW."confirmedById" THEN
    RAISE EXCEPTION 'Publication confirmation must belong to the listing seller'
      USING ERRCODE = '23514';
  END IF;
  SELECT "cycleNumber", "startsAt" INTO last_number, last_start
    FROM publication_cycle WHERE "listingId" = NEW."listingId"
    ORDER BY "cycleNumber" DESC LIMIT 1;
  IF NEW."cycleNumber" <> COALESCE(last_number, 0) + 1 OR
     (last_start IS NOT NULL AND NEW."startsAt" < last_start) THEN
    RAISE EXCEPTION 'Publication cycles must be ordered and sequential'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER publication_cycle_validate BEFORE INSERT ON publication_cycle
  FOR EACH ROW EXECUTE FUNCTION validate_publication_cycle();

CREATE FUNCTION validate_publication_availability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cycle_start timestamptz;
  cycle_expiry timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW."cycleId" IS DISTINCT FROM OLD."cycleId" OR
    NEW."listingId" IS DISTINCT FROM OLD."listingId" OR
    NEW."startedAt" IS DISTINCT FROM OLD."startedAt" OR
    (OLD."endedAt" IS NOT NULL AND NEW."endedAt" IS DISTINCT FROM OLD."endedAt")
  ) THEN
    RAISE EXCEPTION 'Availability history may only close an open interval'
      USING ERRCODE = '23514';
  END IF;
  SELECT "startsAt", "expiresAt" INTO cycle_start, cycle_expiry
    FROM publication_cycle WHERE id = NEW."cycleId" AND "listingId" = NEW."listingId";
  IF cycle_start IS NULL OR NEW."startedAt" < cycle_start OR
     NEW."startedAt" >= cycle_expiry OR
     (NEW."endedAt" IS NOT NULL AND NEW."endedAt" > cycle_expiry) THEN
    RAISE EXCEPTION 'Availability must remain inside its publication cycle'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER publication_availability_validate
  BEFORE INSERT OR UPDATE ON publication_availability_interval
  FOR EACH ROW EXECUTE FUNCTION validate_publication_availability();

-- No DELETE trigger: authorized retention may delete eligible records.
CREATE FUNCTION prevent_history_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Create a new history record instead of updating an existing record'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER publication_cycle_immutable BEFORE UPDATE ON publication_cycle
  FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TRIGGER listing_revision_immutable BEFORE UPDATE ON listing_revision
  FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TRIGGER listed_item_group_immutable BEFORE UPDATE ON listed_item_group
  FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TRIGGER diagnostic_answer_immutable BEFORE UPDATE ON diagnostic_answer
  FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
CREATE TRIGGER ownership_declaration_immutable BEFORE UPDATE ON ownership_declaration
  FOR EACH ROW EXECUTE FUNCTION prevent_history_update();
