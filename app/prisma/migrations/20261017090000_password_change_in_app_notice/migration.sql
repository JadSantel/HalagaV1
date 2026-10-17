-- ADR-087 independent in-app work only. Do not broaden email recipient storage.
BEGIN;
CREATE TABLE "password_change_notice" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL,
    "inAppWorkKey" TEXT NOT NULL,
    "emailEligibility" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    CONSTRAINT "password_change_notice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_change_notice_accountId_fkey" FOREIGN KEY ("accountId")
        REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "password_change_notice_event_check" CHECK (
        "eventType" = 'account.password-changed' AND "eventVersion" = 1),
    CONSTRAINT "password_change_notice_work_check" CHECK (
        "inAppWorkKey" = 'password-changed-in-app:' || "id"::text),
    CONSTRAINT "password_change_notice_eligibility_check" CHECK (
        "emailEligibility" IN ('ELIGIBLE', 'INELIGIBLE')),
    CONSTRAINT "password_change_notice_read_check" CHECK (
        "readAt" IS NULL OR "readAt" >= "createdAt")
);
CREATE UNIQUE INDEX "password_change_notice_inAppWorkKey_key" ON "password_change_notice"("inAppWorkKey");
CREATE INDEX "password_change_notice_accountId_createdAt_idx" ON "password_change_notice"("accountId", "createdAt");
COMMIT;
