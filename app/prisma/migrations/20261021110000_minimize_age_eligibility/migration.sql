BEGIN;

ALTER TABLE "user_account" ADD COLUMN "adultEligibilityCheckedAt" TIMESTAMPTZ(3);

-- Preserve only a supported passed check at its original PHT attestation date.
-- Missing/inconsistent legacy evidence must never become a new eligibility grant.
UPDATE "user_account"
SET "adultEligibilityCheckedAt" = "adultAttestedAt"
WHERE "adultAttestationVersion" = 'adult-eligibility-en-v1'
  AND isfinite("dateOfBirth") AND isfinite("adultAttestedAt")
  AND "adultAttestedAt" <= CURRENT_TIMESTAMP
  AND EXTRACT(YEAR FROM age(("adultAttestedAt" AT TIME ZONE 'Asia/Manila')::date, "dateOfBirth")) >= 18;

-- The owner approved discarding DOB for successful and rejected age checks.
ALTER TABLE "user_account" DROP COLUMN "dateOfBirth";

COMMIT;
