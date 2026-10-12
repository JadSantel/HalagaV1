BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'VALIDATING', 'HELD', 'PUBLISHED', 'PAUSED_BY_RESERVATION', 'RESOLVING_EXISTING_ACTIVITY', 'REMOVED', 'REJECTED', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PublicationCycleKind" AS ENUM ('INITIAL_PUBLICATION', 'RENEWAL');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SINGLE_ITEM', 'BUNDLE');

-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('SMARTPHONES_TABLETS', 'LAPTOPS', 'DESKTOP_COMPUTERS', 'COMPUTER_COMPONENTS_PERIPHERALS', 'MONITORS', 'PRINTERS_SCANNERS', 'NETWORKING_DEVICES', 'UPS_SMALL_BACKUP_POWER', 'ACCESSORIES_SMALL_ELECTRONICS');

-- CreateEnum
CREATE TYPE "BundleFamily" AS ENUM ('MOBILE', 'COMPUTING', 'PRINTING', 'NETWORKING', 'POWER_PROTECTION');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('UNTESTED_UNKNOWN', 'FULLY_FUNCTIONAL', 'FUNCTIONAL_WITH_ISSUES', 'NOT_FUNCTIONAL');

-- CreateEnum
CREATE TYPE "MediaProcessingStatus" AS ENUM ('PENDING', 'QUARANTINED', 'APPROVED', 'REJECTED', 'DELETION_PENDING', 'DELETED');

-- CreateTable
CREATE TABLE "user_account" (
    "id" UUID NOT NULL,
    "authUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "adultAttestedAt" TIMESTAMPTZ(3),
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionNumber" INTEGER,
    "expiredAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_revision" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "authoredById" UUID NOT NULL,
    "listingType" "ListingType" NOT NULL,
    "category" "ListingCategory" NOT NULL,
    "bundleFamily" "BundleFamily",
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "barangayCode" TEXT NOT NULL,
    "priceExpectation" DECIMAL(12,2),
    "conditionSummary" "ItemCondition",
    "diagnosticSchemaVersion" TEXT,
    "material" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_cycle" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "kind" "PublicationCycleKind" NOT NULL,
    "confirmedById" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_availability_interval" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),

    CONSTRAINT "publication_availability_interval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listed_item_group" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "brand" TEXT,
    "model" TEXT,
    "approximateAge" TEXT,
    "condition" "ItemCondition" NOT NULL,
    "batteryStatus" TEXT,
    "lockStatus" TEXT,
    "knownIssues" TEXT,
    "missingParts" TEXT,
    "includedItems" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listed_item_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_answer" (
    "id" UUID NOT NULL,
    "itemGroupId" UUID NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_declaration" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "declaredById" UUID NOT NULL,
    "textVersion" TEXT NOT NULL,
    "attestedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ownership_declaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_media" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "publicDerivativeKey" TEXT,
    "contentSha256" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "processingStatus" "MediaProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL,
    "retainedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_authUserId_key" ON "user_account"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "listing_sellerId_status_idx" ON "listing"("sellerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "listing_id_currentRevisionNumber_key" ON "listing"("id", "currentRevisionNumber");

-- CreateIndex
CREATE INDEX "listing_revision_listingId_createdAt_idx" ON "listing_revision"("listingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_revision_listingId_version_key" ON "listing_revision"("listingId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "publication_cycle_listingId_cycleNumber_key" ON "publication_cycle"("listingId", "cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "publication_cycle_listingId_id_key" ON "publication_cycle"("listingId", "id");

-- CreateIndex
CREATE INDEX "publication_availability_interval_cycleId_startedAt_idx" ON "publication_availability_interval"("cycleId", "startedAt");

-- CreateIndex
CREATE INDEX "listed_item_group_revisionId_idx" ON "listed_item_group"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_answer_itemGroupId_schemaVersion_questionKey_key" ON "diagnostic_answer"("itemGroupId", "schemaVersion", "questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "ownership_declaration_revisionId_key" ON "ownership_declaration"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_media_objectKey_key" ON "listing_media"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "listing_media_publicDerivativeKey_key" ON "listing_media"("publicDerivativeKey");

-- CreateIndex
CREATE UNIQUE INDEX "listing_media_revisionId_sortOrder_key" ON "listing_media"("revisionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_id_currentRevisionNumber_fkey" FOREIGN KEY ("id", "currentRevisionNumber") REFERENCES "listing_revision"("listingId", "version") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "listing_revision" ADD CONSTRAINT "listing_revision_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_revision" ADD CONSTRAINT "listing_revision_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_cycle" ADD CONSTRAINT "publication_cycle_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_cycle" ADD CONSTRAINT "publication_cycle_listingId_revisionNumber_fkey" FOREIGN KEY ("listingId", "revisionNumber") REFERENCES "listing_revision"("listingId", "version") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publication_cycle" ADD CONSTRAINT "publication_cycle_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_availability_interval" ADD CONSTRAINT "publication_availability_interval_listingId_cycleId_fkey" FOREIGN KEY ("listingId", "cycleId") REFERENCES "publication_cycle"("listingId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "listed_item_group" ADD CONSTRAINT "listed_item_group_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "listing_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_answer" ADD CONSTRAINT "diagnostic_answer_itemGroupId_fkey" FOREIGN KEY ("itemGroupId") REFERENCES "listed_item_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_declaration" ADD CONSTRAINT "ownership_declaration_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "listing_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_declaration" ADD CONSTRAINT "ownership_declaration_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "listing_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

COMMIT;
