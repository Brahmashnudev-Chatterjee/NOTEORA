-- Phase 5C merchant management foundation
ALTER TYPE "gateway"."MerchantStatus" RENAME TO "MerchantStatus_old";
CREATE TYPE "gateway"."MerchantStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');
ALTER TABLE "gateway"."Merchant" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "gateway"."Merchant" ALTER COLUMN "status" TYPE "gateway"."MerchantStatus"
  USING CASE WHEN "status"::text = 'VERIFIED' THEN 'APPROVED'::"gateway"."MerchantStatus" ELSE "status"::text::"gateway"."MerchantStatus" END;
ALTER TABLE "gateway"."Merchant" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "gateway"."MerchantStatus_old";

CREATE TYPE "gateway"."MerchantRole" AS ENUM ('MERCHANT_OWNER', 'MERCHANT_ADMIN', 'MERCHANT_DEVELOPER', 'MERCHANT_VIEWER');

ALTER TABLE "gateway"."Merchant"
  ADD COLUMN IF NOT EXISTS "contactName" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "businessType" TEXT,
  ADD COLUMN IF NOT EXISTS "gstin" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "address" JSONB,
  ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;

CREATE TABLE IF NOT EXISTS "gateway"."MerchantUser" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "gateway"."MerchantRole" NOT NULL DEFAULT 'MERCHANT_VIEWER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantUser_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantUser_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "gateway"."Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantUser_email_key" ON "gateway"."MerchantUser"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantUser_merchantId_email_key" ON "gateway"."MerchantUser"("merchantId", "email");
CREATE INDEX IF NOT EXISTS "MerchantUser_merchantId_role_active_idx" ON "gateway"."MerchantUser"("merchantId", "role", "active");

ALTER TABLE "gateway"."WebhookEndpoint"
  ADD COLUMN IF NOT EXISTS "signingSecretEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "eventSubscriptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DROP INDEX IF EXISTS "gateway"."Merchant_status_idx";
CREATE INDEX IF NOT EXISTS "Merchant_status_createdAt_idx" ON "gateway"."Merchant"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Merchant_contactEmail_idx" ON "gateway"."Merchant"("contactEmail");
